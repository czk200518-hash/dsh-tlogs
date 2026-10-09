/**
 * tlogs — the "charts" tab inside the detail modal.
 *
 * The three sub-tabs share one set of controls (range / source / metric / grain) and all of
 * them follow any change. The two sources must not be mixed: platform billing is account-wide
 * with per-day detail back to the configured history start, while a project exists locally
 * only — the host reports one "so far" number, so the trend depends on the daily snapshots the
 * plugin records (store/project-history.ts) and cannot reach back before it was enabled. The
 * UI says so while a project is selected instead of showing an empty chart.
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatMoneyFull, formatMoneyShort, formatShort } from './format.js';
import { LineChart, StackedBarChart, DonutChart } from './charts.js';
import {} from '../types.js';
import { GRAINS, METRICS, bucketMetricValue, bucketValues, dayBuckets, metricSuffix, metricValue, monthBuckets, pieSlices, projectBuckets, resolveGrain, toPoints, yearBuckets, } from './chart-utils.js';
import { useT } from './i18n/index.js';
/**
 * These tables hold keys rather than text: the labels have to change with the language, so
 * they are resolved at render time. Freezing them at module load would leave this row in the
 * language that was active when the module was imported.
 */
const RANGES = [
    { id: 'all', labelKey: 'chart.range.all' },
    { id: 'custom', labelKey: 'chart.range.custom' },
    { id: 'today', labelKey: 'chart.range.today' },
    { id: 'week', labelKey: 'chart.range.week' },
    { id: 'month', labelKey: 'chart.range.month' },
    // The same two rolling windows the console offers as its time dimension, so the user can
    // compare a curve one to one against the console.
    { id: 'last7', labelKey: 'chart.range.last7' },
    { id: 'last30', labelKey: 'chart.range.last30' },
];
const PIE_DIMS = [
    { id: 'model', labelKey: 'chart.dim.model' },
    { id: 'composition', labelKey: 'chart.dim.composition' },
    { id: 'project', labelKey: 'chart.dim.project' },
];
const KINDS = [
    { id: 'line', labelKey: 'chart.kind.line' },
    { id: 'pie', labelKey: 'chart.kind.pie' },
    { id: 'bar', labelKey: 'chart.kind.bar' },
];
/** Local date key, `YYYY-MM-DD`. */
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Local date key N days back. */
function daysAgoKey(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** An all-zero Stat, used as the accumulator when summing rows. */
function zeroStat() {
    return {
        PROMPT_TOKEN: 0,
        PROMPT_CACHE_HIT_TOKEN: 0,
        PROMPT_CACHE_MISS_TOKEN: 0,
        RESPONSE_TOKEN: 0,
        REQUEST: 0,
    };
}
function zeroMoney() {
    return zeroStat();
}
/**
 * Starting value for cumulative mode.
 *
 * Money is not part of `Stat`, so `priorCost` comes in separately; without it, switching to
 * cumulative while showing cost would start the curve at 0, unlike the token metrics.
 */
function priorValue(stat, cost, metric) {
    return metric === 'cost' ? (cost ?? 0) : metricValue(stat, metric);
}
/** Add up several Stat rows. */
function sumStats(list) {
    const acc = zeroStat();
    for (const s of list) {
        acc.PROMPT_TOKEN += s.PROMPT_TOKEN;
        acc.PROMPT_CACHE_HIT_TOKEN += s.PROMPT_CACHE_HIT_TOKEN;
        acc.PROMPT_CACHE_MISS_TOKEN += s.PROMPT_CACHE_MISS_TOKEN;
        acc.RESPONSE_TOKEN += s.RESPONSE_TOKEN;
        acc.REQUEST += s.REQUEST;
    }
    return acc;
}
export function ChartPanel(props) {
    const { series, loading, error, onLoad } = props;
    const t = useT();
    const [range, setRange] = React.useState('all');
    const [from, setFrom] = React.useState('');
    const [to, setTo] = React.useState('');
    const [projectId, setProjectId] = React.useState('');
    const [metric, setMetric] = React.useState('total');
    const [grain, setGrain] = React.useState('auto');
    const [mode, setMode] = React.useState('perBucket');
    const [pieDim, setPieDim] = React.useState('model');
    /** Which chart is shown. Switching it re-renders only, no request. */
    const [kind, setKind] = React.useState('line');
    /**
     * Fires only when the query parameters really changed.
     *
     * The signature string keeps `series` out of the dependency list on purpose: otherwise a
     * new response would retrigger the effect and start a request loop. A new series leaves the
     * signature unchanged, so nothing is re-sent.
     */
    const lastSig = React.useRef('');
    React.useEffect(() => {
        if (range === 'custom' && (!from || !to))
            return;
        const query = { range };
        if (range === 'custom') {
            query.from = from;
            query.to = to;
        }
        if (projectId)
            query.projectId = projectId;
        const sig = JSON.stringify(query);
        if (lastSig.current === sig)
            return;
        lastSig.current = sig;
        onLoad(query);
    }, [range, from, to, projectId, onLoad]);
    const projectSource = projectId !== '';
    const selectedProject = series?.projects.find((p) => p.id === projectId);
    /**
     * Clear the selection when the chosen project disappears from the list (host restart wipes
     * the session, project deleted).
     *
     * Otherwise `<select value>` points at an option that no longer exists: the browser shows
     * the first entry while the state still holds the old id, so the UI no longer matches the
     * data source being queried.
     */
    React.useEffect(() => {
        if (!projectId || !series)
            return;
        if (series.projects.length === 0)
            return;
        if (series.projects.some((p) => p.id === projectId))
            return;
        setProjectId('');
    }, [projectId, series]);
    const resolvedGrain = series ? resolveGrain(grain, series.from, series.to) : 'day';
    /** Time buckets: project scope reads snapshots, platform scope follows the resolved grain. */
    const buckets = React.useMemo(() => {
        if (!series)
            return [];
        if (projectSource) {
            const points = series.project?.points ?? [];
            return projectBuckets(points, series.project?.prior?.stat, mode);
        }
        if (resolvedGrain === 'day')
            return dayBuckets(series.days, series.from, series.to);
        if (resolvedGrain === 'year')
            return yearBuckets(series.months);
        return monthBuckets(series.months);
    }, [series, projectSource, resolvedGrain, mode]);
    /** Line values: platform scope can switch per-bucket / cumulative; project buckets carry their mode. */
    const values = React.useMemo(() => {
        if (projectSource)
            return buckets.map((b) => bucketMetricValue(b, metric));
        const prior = mode === 'cumulative' && series ? priorValue(series.prior, series.priorCost, metric) : 0;
        return bucketValues(buckets, metric, mode, prior);
    }, [buckets, metric, mode, projectSource, series]);
    const points = React.useMemo(() => toPoints(buckets, values), [buckets, values]);
    const metricDef = METRICS.find((m) => m.id === metric);
    const unit = metricDef.unit;
    /** Range total (donut centre and notes): sums the monthly totals, so missing days cannot understate it. */
    const rangeStat = React.useMemo(() => (series ? sumStats(series.months.map((m) => m.stat)) : zeroStat()), [series]);
    /** Range money total (CNY). Money is not part of Stat, so it is summed on its own. */
    const rangeCost = React.useMemo(() => (series ? series.months.reduce((s, m) => s + (m.cost ?? 0), 0) : 0), [series]);
    /** Range money split by token type; the host computes it in one pass. */
    const rangeMoney = series?.costByType ?? zeroMoney();
    /** Donut dimension: a selected project has no "by model" — platform models are unrelated and would mislead. */
    const effectiveDim = projectSource && pieDim === 'model' ? 'composition' : pieDim;
    const dims = projectSource ? PIE_DIMS.filter((d) => d.id !== 'model') : PIE_DIMS;
    const pieItems = React.useMemo(() => {
        if (!series)
            return [];
        if (effectiveDim === 'model') {
            return series.models.map((m) => ({
                key: m.key,
                label: m.key,
                // Model money exists as a total only (`SeriesPoint.cost`); there is no five-way split.
                value: metric === 'cost' ? (m.cost ?? 0) : metricValue(m.stat, metric),
            }));
        }
        if (effectiveDim === 'project') {
            // Project usage comes from the local session projection and has no money in the
            // platform bill. Return nothing and let the donut's emptyText explain, rather than
            // drawing an all-zero chart.
            if (metric === 'cost')
                return [];
            return series.projects.map((p) => ({ key: p.id, label: p.label, value: metricValue(p.stat, metric) }));
        }
        // Composition dimension: money uses Money's token-type split, everything else uses Stat.
        if (metric === 'cost') {
            return [
                { key: 'hit', label: t('chart.legend.hit'), value: rangeMoney.PROMPT_CACHE_HIT_TOKEN },
                {
                    key: 'miss',
                    label: t('chart.legend.miss'),
                    value: rangeMoney.PROMPT_CACHE_MISS_TOKEN + rangeMoney.PROMPT_TOKEN,
                },
                { key: 'out', label: t('stat.output'), value: rangeMoney.RESPONSE_TOKEN },
            ];
        }
        const s = projectSource ? sumStats((series.project?.points ?? []).map((p) => p.stat)) : rangeStat;
        return [
            { key: 'hit', label: t('chart.legend.hit'), value: s.PROMPT_CACHE_HIT_TOKEN },
            { key: 'miss', label: t('chart.legend.miss'), value: s.PROMPT_CACHE_MISS_TOKEN + s.PROMPT_TOKEN },
            { key: 'out', label: t('stat.output'), value: s.RESPONSE_TOKEN },
        ];
    }, [series, effectiveDim, metric, projectSource, rangeStat, rangeMoney, t]);
    // The merged "other" slice is translated at render time, so the current t() result is
    // passed in and the slices are recomputed when the language changes.
    const slices = React.useMemo(() => pieSlices(pieItems, 8, t('chart.other')), [pieItems, t]);
    const pickRange = (r) => {
        if (r === 'custom' && (!from || !to)) {
            // First entry into custom range: seed it with the current range so the user has a
            // reference point when editing.
            setFrom(series?.from ?? daysAgoKey(30));
            setTo(series?.to ?? todayKey());
        }
        setRange(r);
    };
    const projectPoints = series?.project?.points.length ?? 0;
    return (h(Fragment, null,
        h("div", { className: "tlogs-subtabs" },
            h("span", { className: "tlogs-ctl-group", role: "group", "aria-label": t('chart.aria.kind') },
                h("span", { className: "tlogs-ctl-label" }, t('chart.label.kind')),
                KINDS.map((k) => (h("button", { key: k.id, type: "button", className: k.id === kind ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setKind(k.id), "aria-pressed": k.id === kind, "data-kind": k.id }, t(k.labelKey))))),
            h("span", { className: "tlogs-ctl-group" }, kind === 'pie' ? (h(Fragment, null,
                h("span", { className: "tlogs-ctl-label" }, t('chart.label.composition')),
                dims.map((d) => (h("button", { key: d.id, type: "button", className: d.id === effectiveDim ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setPieDim(d.id), "aria-pressed": d.id === effectiveDim }, t(d.labelKey)))))) : null)),
        h("div", { className: "tlogs-chart-controls" },
            h("span", { className: "tlogs-ctl-group", role: "group", "aria-label": t('chart.aria.range') },
                h("span", { className: "tlogs-ctl-label" }, t('chart.label.range')),
                RANGES.map((r) => (h("button", { key: r.id, type: "button", className: r.id === range ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => pickRange(r.id), "aria-pressed": r.id === range }, t(r.labelKey))))),
            h("span", { className: "tlogs-ctl-group" },
                h("span", { className: "tlogs-ctl-label" }, t('chart.label.source')),
                h("select", { className: "tlogs-input tlogs-chart-select", value: projectId, onChange: (e) => setProjectId(e.target.value), "aria-label": t('chart.aria.source') },
                    h("option", { value: "" }, t('chart.source.platform')),
                    (series?.projects ?? []).map((p) => (h("option", { key: p.id, value: p.id }, p.label)))))),
        h("div", { className: "tlogs-chart-controls" },
            h("span", { className: "tlogs-ctl-group" },
                h("span", { className: "tlogs-ctl-label" }, t('chart.label.metric')),
                h("select", { className: "tlogs-input tlogs-chart-select", value: metric, onChange: (e) => setMetric(e.target.value), "aria-label": t('chart.aria.metric') }, METRICS.map((m) => (h("option", { key: m.id, value: m.id }, t(m.labelKey)))))),
            h("span", { className: "tlogs-ctl-group" },
                h("span", { className: "tlogs-ctl-label" }, t('chart.label.grain')),
                h("select", { className: "tlogs-input tlogs-chart-select", value: grain, onChange: (e) => setGrain(e.target.value), "aria-label": t('chart.aria.grain'), disabled: projectSource }, GRAINS.map((g) => (h("option", { key: g.id, value: g.id }, t(g.labelKey)))))),
            h("span", { className: "tlogs-ctl-group" },
                h("span", { className: "tlogs-ctl-label" }, t('chart.label.basis')),
                h("button", { type: "button", className: mode === 'perBucket' ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setMode('perBucket'), "aria-pressed": mode === 'perBucket' }, t('chart.mode.perBucket')),
                h("button", { type: "button", className: mode === 'cumulative' ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setMode('cumulative'), "aria-pressed": mode === 'cumulative' }, t('chart.mode.cumulative')))),
        range === 'custom' ? (h("div", { className: "tlogs-chart-controls" },
            h("span", { className: "tlogs-ctl-group" },
                h("span", { className: "tlogs-ctl-label" }, t('chart.label.from')),
                h("input", { type: "date", className: "tlogs-input tlogs-chart-date", value: from, max: to || todayKey(), onChange: (e) => setFrom(e.target.value), "aria-label": t('chart.aria.from') }),
                h("span", { className: "tlogs-ctl-label" }, t('chart.label.to')),
                h("input", { type: "date", className: "tlogs-input tlogs-chart-date", value: to, min: from || undefined, max: todayKey(), onChange: (e) => setTo(e.target.value), "aria-label": t('chart.aria.to') })))) : null,
        series ? (h("div", { className: "tlogs-chart-scope" },
            h("span", { className: "tlogs-chart-scope-range" },
                series.from,
                " ~ ",
                series.to),
            h("span", { className: "tlogs-metric", title: metric === 'cost'
                    ? `${formatMoneyFull(rangeCost)}${t('chart.unit.money')}`
                    : formatFull(metricValue(rangeStat, metric)) },
                h("span", { className: "tlogs-metric-label" }, t('chart.rangeTotal')),
                h("span", { className: "tlogs-metric-value" },
                    metric === 'cost'
                        ? formatMoneyShort(rangeCost)
                        : formatShort(metricValue(rangeStat, metric)),
                    metricSuffix(unit, t))),
            h("span", { className: "tlogs-metric" },
                h("span", { className: "tlogs-metric-label" }, t('stat.requests')),
                h("span", { className: "tlogs-metric-value" },
                    formatFull(rangeStat.REQUEST),
                    t('chart.unit.requests'))),
            metric === 'cost' && series.costPartial ? (h("span", { className: "tlogs-chart-scope-note" }, t('chart.costPartial'))) : null,
            h("span", { className: "tlogs-chart-scope-note" }, projectSource
                ? t('chart.scope.snapshots', { n: projectPoints })
                : t(resolvedGrain === 'day'
                    ? 'chart.scope.bucketsDay'
                    : resolvedGrain === 'month'
                        ? 'chart.scope.bucketsMonth'
                        : 'chart.scope.bucketsYear', { n: buckets.length })),
            loading ? h("span", { className: "tlogs-chart-busy" }, t('chart.updating')) : null)) : null,
        error ? h("div", { className: "tlogs-error" }, error) : null,
        !series ? (h("div", { className: "tlogs-empty" }, loading ? t('common.loading') : t('chart.noData'))) : (h(Fragment, null,
            series.partial && !projectSource ? (h("div", { className: "tlogs-hint" },
                t('chart.partialNote.lead'),
                h("b", null, t('chart.partialNote.bold')),
                t('chart.partialNote.tail'))) : null,
            projectSource && projectPoints < 2 ? (h("div", { className: "tlogs-hint" }, t('chart.projectSnapshots', { n: projectPoints }))) : null,
            h("div", { className: "tlogs-chart-stage" }, kind === 'line' ? (h("div", { className: "tlogs-chart-card" },
                h("div", { className: "tlogs-chart-head" },
                    h("span", { className: "tlogs-chart-title" },
                        t('chart.title.line'),
                        h("span", { className: "tlogs-chart-sub" },
                            t(metricDef.labelKey),
                            mode === 'cumulative' ? t('chart.sub.cumulative') : t('chart.sub.perBucket')))),
                h(LineChart, { points: points, unit: unit, cumulative: mode === 'cumulative' }))) : kind === 'pie' ? (h("div", { className: "tlogs-chart-card" },
                h("div", { className: "tlogs-chart-head" },
                    h("span", { className: "tlogs-chart-title" },
                        t('chart.title.pie'),
                        h("span", { className: "tlogs-chart-sub" }, effectiveDim === 'model'
                            ? t('chart.dim.model')
                            : effectiveDim === 'project'
                                ? t('chart.dim.project')
                                : t('chart.sub.composition')))),
                h(DonutChart, { slices: slices, centerLabel: effectiveDim === 'model'
                        ? t('chart.dim.model')
                        : effectiveDim === 'project'
                            ? t('chart.dim.project')
                            : projectSource
                                ? (selectedProject?.label ?? t('chart.selectedProject'))
                                : t('chart.rangeTotal'), centerValue: metric === 'cost'
                        ? formatMoneyShort(slices.reduce((s, x) => s + x.value, 0))
                        : formatShort(slices.reduce((s, x) => s + x.value, 0)), unit: unit, emptyText: effectiveDim === 'project'
                        ? metric === 'cost'
                            ? t('chart.empty.projectCost')
                            : t('chart.empty.project')
                        : t('chart.empty.composition') }))) : (h("div", { className: "tlogs-chart-card" },
                h("div", { className: "tlogs-chart-head" },
                    h("span", { className: "tlogs-chart-title" },
                        t('chart.title.bar'),
                        h("span", { className: "tlogs-chart-sub" }, t('chart.sub.bar')))),
                h(StackedBarChart, { points: points }))))))));
}
//# sourceMappingURL=chart-panel.js.map