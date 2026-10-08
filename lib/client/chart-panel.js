/**
 * tlogs — 「图表」页签（详细数据弹窗内）。
 *
 * 三张图共享同一套控制项，**切换任意控制项三张图一起变**：
 *   范围（有史以来 / 自定义 / 今日 / 本周 / 本月）× 数据源（平台账单 / 指定项目）
 *   × 指标（总 Token / 输入 / 输出 / 缓存命中 / 缓存未命中 / 请求数）× 粒度（自动/天/月/年）
 *
 * 数据来源的口径差异（重要，别混）：
 *  - **平台账单**：账号维度，接口按天返回逐日明细，可回溯到配置的历史起点。
 *  - **指定项目**：只存在于本机。宿主只给「累计至今」一个数，因此趋势依赖插件
 *    自己每天记的快照（`store/project-history.ts`），**无法回溯到启用之前**。
 *    这一点在选中项目时会明确写在界面上，而不是让用户对着一张空图猜。
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatMoneyFull, formatMoneyShort, formatShort } from './format.js';
import { LineChart, StackedBarChart, DonutChart } from './charts.js';
import {} from '../types.js';
import { GRAINS, METRICS, bucketMetricValue, bucketValues, dayBuckets, metricSuffix, metricValue, monthBuckets, pieSlices, projectBuckets, resolveGrain, toPoints, yearBuckets, } from './chart-utils.js';
import { useT } from './i18n/index.js';
/**
 * 下面几张控制项表里存的是**键**而不是文案：文案必须随语言实时变，
 * 只能在渲染时翻译（模块加载时定死的话，切语言后这一排按钮不会更新）。
 */
const RANGES = [
    { id: 'all', labelKey: 'chart.range.all' },
    { id: 'custom', labelKey: 'chart.range.custom' },
    { id: 'today', labelKey: 'chart.range.today' },
    { id: 'week', labelKey: 'chart.range.week' },
    { id: 'month', labelKey: 'chart.range.month' },
    // 与控制台「时间维度」一致的两个滚动窗口。做成图表的范围预设后，
    // 用户可以直接对着控制台把同一条曲线比出来。
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
/** 本地今天（`YYYY-MM-DD`）。 */
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 本地 N 天前。 */
function daysAgoKey(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 空的五类计量项（用于「构成」聚合）。 */
function zeroStat() {
    return {
        PROMPT_TOKEN: 0,
        PROMPT_CACHE_HIT_TOKEN: 0,
        PROMPT_CACHE_MISS_TOKEN: 0,
        RESPONSE_TOKEN: 0,
        REQUEST: 0,
    };
}
/** 空的金额五类。 */
function zeroMoney() {
    return zeroStat();
}
/**
 * 累计模式的起点值。
 *
 * 金额不在 `Stat` 里，必须单独取 `priorCost`；否则切到「累计 + 消费金额」时
 * 曲线会从 0 起跳（与 token 侧的行为不一致）。
 */
function priorValue(stat, cost, metric) {
    return metric === 'cost' ? (cost ?? 0) : metricValue(stat, metric);
}
/** 把若干 Stat 相加。 */
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
    /** 当前显示哪张图（子标签）。切它**不发请求**，只换渲染。 */
    const [kind, setKind] = React.useState('line');
    /**
     * 只在「查询参数真的变了」时发请求。
     *
     * 用签名字符串（而不是把 series 放进依赖）是为了避免「请求 → 新 series →
     * 触发 effect → 再请求」的循环：series 变化不改变签名，因此不会重发。
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
     * 选中的项目从列表里消失时（宿主重启后会话被清理、项目被删）把选择清掉。
     *
     * 否则 `<select value>` 会指向一个不存在的 option：浏览器显示第一项、而 state
     * 仍是旧 id，界面与实际查询的数据源对不上。
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
    /** 时间桶：项目维度走快照，平台维度按粒度取逐日 / 逐月 / 逐年。 */
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
    /** 折线图的数值：平台维度可在「每期」与「累计」之间切；项目维度的桶已内含口径。 */
    const values = React.useMemo(() => {
        if (projectSource)
            return buckets.map((b) => bucketMetricValue(b, metric));
        const prior = mode === 'cumulative' && series ? priorValue(series.prior, series.priorCost, metric) : 0;
        return bucketValues(buckets, metric, mode, prior);
    }, [buckets, metric, mode, projectSource, series]);
    const points = React.useMemo(() => toPoints(buckets, values), [buckets, values]);
    const metricDef = METRICS.find((m) => m.id === metric);
    const unit = metricDef.unit;
    /** 范围内的合计（用于环形中心与说明）：只累加**月度合计**，因此不会因缺天而低估。 */
    const rangeStat = React.useMemo(() => (series ? sumStats(series.months.map((m) => m.stat)) : zeroStat()), [series]);
    /** 范围内的金额合计（元）。金额不在 `Stat` 里，因此单独累加。 */
    const rangeCost = React.useMemo(() => (series ? series.months.reduce((s, m) => s + (m.cost ?? 0), 0) : 0), [series]);
    /** 范围内的金额构成（输入命中 / 未命中 / 输出），由 host 一次算好下发。 */
    const rangeMoney = series?.costByType ?? zeroMoney();
    /** 环形图的维度：选中项目时不再有「按模型」——平台模型与该项目无关，会误导。 */
    const effectiveDim = projectSource && pieDim === 'model' ? 'composition' : pieDim;
    const dims = projectSource ? PIE_DIMS.filter((d) => d.id !== 'model') : PIE_DIMS;
    const pieItems = React.useMemo(() => {
        if (!series)
            return [];
        if (effectiveDim === 'model') {
            return series.models.map((m) => ({
                key: m.key,
                label: m.key,
                // 模型金额只有总额（`SeriesPoint.cost`），没有五类拆分。
                value: metric === 'cost' ? (m.cost ?? 0) : metricValue(m.stat, metric),
            }));
        }
        if (effectiveDim === 'project') {
            // 项目用量来自本机会话投影，平台账单里没有它的金额 —— 明确返回空，
            // 由饼图的 emptyText 说明，而不是画一张全 0 的图。
            if (metric === 'cost')
                return [];
            return series.projects.map((p) => ({ key: p.id, label: p.label, value: metricValue(p.stat, metric) }));
        }
        // 构成维度：金额走 Money 的五类拆分，其余走 Stat。
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
    // 合并项（「其他」）在渲染时才翻译，因此把 t 的当前结果传进去并随 t 重算。
    const slices = React.useMemo(() => pieSlices(pieItems, 8, t('chart.other')), [pieItems, t]);
    const pickRange = (r) => {
        if (r === 'custom' && (!from || !to)) {
            // 首次进入自定义：用当前范围当默认值，用户改起来才有对照。
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