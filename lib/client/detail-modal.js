/**
 * tlogs — the detail modal, calendar included.
 *
 * A real overlay (the one place using position: fixed) rather than an in-place view switch:
 * the sidebar is too narrow for the tables and the calendar, while the compact bar and the
 * expanded panel stay in document flow. The host keeps per-day detail for every month it has
 * fetched, so any month in history can be shown, not just the current one.
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatMoneyFull, formatMoneyShort, formatNumber, localReasonLabel } from './format.js';
import { moneyTotal } from '../types.js';
import { StatTable } from './detail-view.js';
import { ChartPanel } from './chart-panel.js';
import { SettingsPanel } from './settings-panel.js';
import { useT } from './i18n/index.js';
/**
 * The tab table holds keys, not text: labels have to follow the language, so they are resolved
 * at render time rather than frozen at module load. Settings sits last, set apart from the data
 * tabs. The providers table follows the platform-scoped models table although its rows come
 * from the local session logs (including Volcengine / Xiaomi / GLM usage the platform bill
 * never sees); each header explains the difference in scope.
 */
const TABS = [
    { id: 'calendar', labelKey: 'tab.calendar' },
    { id: 'charts', labelKey: 'tab.charts' },
    { id: 'models', labelKey: 'tab.models' },
    { id: 'providers', labelKey: 'tab.providers' },
    { id: 'years', labelKey: 'tab.years' },
    { id: 'months', labelKey: 'tab.months' },
    { id: 'days', labelKey: 'tab.days' },
    { id: 'settings', labelKey: 'tab.settings' },
];
/** Weekday headers in Monday-first order, matching the plugin's "this week = Monday to now". */
const WEEKDAY_KEYS = [
    'weekday.1',
    'weekday.2',
    'weekday.3',
    'weekday.4',
    'weekday.5',
    'weekday.6',
    'weekday.7',
];
const pad2 = (n) => String(n).padStart(2, '0');
const ymKey = (y, m) => `${y}-${pad2(m)}`;
/** Parse `YYYY-MM`; undefined when the key is malformed. */
function parseYm(key) {
    const m = /^(\d{4})-(\d{1,2})$/.exec(key);
    if (!m)
        return undefined;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12)
        return undefined;
    return { year, month };
}
/** Number of days in a month. */
function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
/** Weekday of the 1st (0 = Sunday) shifted to a Monday-first 0..6. */
function leadingBlanks(year, month) {
    const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return (dow + 6) % 7;
}
const ZERO_COUNTERS = { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 };
/**
 * Summary row: input / output / total tokens / requests, plus ¥ when there is cost data.
 *
 * The money entry appears only when there really is cost data: a hard ¥0.00 would claim the
 * period spent nothing, when the backfill simply has not reached it.
 */
function statLine(stat, t) {
    const out = [
        { key: 'stat.input', label: t('stat.input'), text: formatNumber(stat.inputTokens, 'short'), full: formatFull(stat.inputTokens) },
        { key: 'stat.output', label: t('stat.output'), text: formatNumber(stat.outputTokens, 'short'), full: formatFull(stat.outputTokens) },
        { key: 'stat.totalTokens', label: t('stat.totalTokens'), text: formatNumber(stat.totalTokens, 'short'), full: formatFull(stat.totalTokens) },
        { key: 'stat.requests', label: t('stat.requests'), text: formatNumber(stat.requests, 'short'), full: formatFull(stat.requests) },
    ];
    if (stat.cost) {
        const m = moneyTotal(stat.cost);
        out.push({
            key: 'stat.cost',
            label: t('stat.cost'),
            text: formatMoneyShort(m),
            full: formatMoneyFull(m),
        });
    }
    return out;
}
/** Calendar panel. */
function Calendar(props) {
    const { months, monthDetail, onSelectMonth } = props;
    const t = useT();
    /**
     * Months are always handled in ascending `YYYY-MM` order and never in the host's delivery
     * order: defaulting to the last entry would land on an earlier month whenever the host sends
     * them descending.
     */
    const sorted = React.useMemo(() => [...months].sort((a, b) => a.key.localeCompare(b.key)), [months]);
    const [sel, setSel] = React.useState(null);
    const [selectedDate, setSelectedDate] = React.useState(null);
    React.useEffect(() => {
        if (sel || sorted.length === 0)
            return;
        const last = sorted[sorted.length - 1];
        const ym = parseYm(last.key);
        if (!ym)
            return;
        setSel(ym);
        onSelectMonth(ym.year, ym.month);
    }, [sorted, sel, onSelectMonth]);
    if (sorted.length === 0)
        return h("div", { className: "tlogs-empty" }, t('common.noData'));
    const pick = (ym) => {
        setSel(ym);
        setSelectedDate(null);
        onSelectMonth(ym.year, ym.month);
    };
    const idx = sel ? sorted.findIndex((r) => r.key === ymKey(sel.year, sel.month)) : -1;
    const step = (delta) => {
        if (idx < 0)
            return;
        const next = sorted[idx + delta];
        if (!next)
            return;
        const ym = parseYm(next.key);
        if (ym)
            pick(ym);
    };
    const current = sel ?? (() => {
        const ym = parseYm(sorted[sorted.length - 1].key);
        return ym ?? { year: 0, month: 0 };
    })();
    const byDate = new Map();
    for (const d of monthDetail?.days ?? [])
        byDate.set(d.key, d.stat);
    const maxDay = Math.max(1, ...[...byDate.values()].map((s) => s.totalTokens));
    const maxCost = Math.max(0, ...[...byDate.values()].map((s) => (s.cost ? moneyTotal(s.cost) : 0)));
    const hasCost = maxCost > 0;
    const total = daysInMonth(current.year, current.month);
    const blanks = leadingBlanks(current.year, current.month);
    /**
     * The calendar always renders 6 rows (42 cells), padded with blanks; 31 days plus up to 6
     * leading blanks is the worst case. Rendering only what a month needs would make the dialog
     * height jump between a 5-row and a 6-row month. The money line is rendered unconditionally
     * for the same reason, empty when there is no data, so cells keep a single height.
     */
    const CAL_CELLS = 42;
    const cells = [];
    for (let i = 0; i < blanks; i++) {
        cells.push(h("div", { key: `blank-${i}`, className: "tlogs-cal-cell is-empty" }));
    }
    for (let day = 1; day <= total; day++) {
        const date = `${ymKey(current.year, current.month)}-${pad2(day)}`;
        const stat = byDate.get(date);
        const value = stat?.totalTokens ?? 0;
        // Heat takes the larger of the token and cost ratios, so an expensive day with few tokens
        // does not stay invisible.
        const heatToken = stat ? value / maxDay : 0;
        const dayCost = stat?.cost ? moneyTotal(stat.cost) : 0;
        const heatCost = maxCost > 0 ? dayCost / maxCost : 0;
        const heat = stat ? Math.round(Math.max(heatToken, heatCost) * 55) : 0;
        const title = stat
            ? t('cal.cell', {
                date,
                tokens: formatFull(value),
                requests: formatFull(stat.requests),
                cost: stat.cost ? t('cal.cellCost', { money: formatMoneyFull(dayCost) }) : '',
            })
            : t('cal.cellNoData', { date });
        cells.push(h("button", { key: date, type: "button", className: selectedDate === date ? 'tlogs-cal-cell is-selected' : 'tlogs-cal-cell', style: heat > 0 ? { background: `color-mix(in srgb, var(--tlogs-accent) ${heat}%, transparent)` } : undefined, title: title, onClick: () => setSelectedDate(date), "data-date": date },
            h("span", { className: "tlogs-cal-day" }, day),
            h("span", { className: "tlogs-cal-val" }, stat ? formatNumber(value, 'short') : '—'),
            h("span", { className: "tlogs-cal-money" }, stat?.cost && hasCost ? formatMoneyShort(moneyTotal(stat.cost)) : '')));
    }
    for (let i = cells.length; i < CAL_CELLS; i++) {
        cells.push(h("div", { key: `tail-${i}`, className: "tlogs-cal-cell is-empty" }));
    }
    const selected = selectedDate ? byDate.get(selectedDate) : undefined;
    return (h(Fragment, null,
        h("div", { className: "tlogs-cal-nav" },
            h("button", { type: "button", className: "tlogs-btn", onClick: () => step(-1), disabled: idx <= 0, "aria-label": t('cal.prevMonth') }, "\u2039"),
            h("select", { className: "tlogs-input tlogs-cal-select", value: ymKey(current.year, current.month), onChange: (e) => {
                    const ym = parseYm(e.target.value);
                    if (ym)
                        pick(ym);
                }, "aria-label": t('cal.selectMonth') }, sorted.map((r) => (h("option", { key: r.key, value: r.key }, t('cal.option', {
                key: r.key,
                tokens: formatNumber(r.stat.totalTokens, 'short'),
                cost: r.stat.cost
                    ? t('cal.optionCost', { money: formatMoneyShort(moneyTotal(r.stat.cost)) })
                    : '',
            }))))),
            h("button", { type: "button", className: "tlogs-btn", onClick: () => step(1), disabled: idx < 0 || idx >= sorted.length - 1, "aria-label": t('cal.nextMonth') }, "\u203A")),
        h("div", { className: "tlogs-cal-summary" },
            h("span", { className: "tlogs-cal-summary-title" }, t('cal.monthTotal', { month: ymKey(current.year, current.month) })),
            statLine(monthDetail?.stat ?? ZERO_COUNTERS, t).map((s) => (h("span", { key: s.key, className: "tlogs-metric", title: s.full },
                h("span", { className: "tlogs-metric-label" }, s.label),
                h("span", { className: "tlogs-metric-value" }, s.text))))),
        byDate.size === 0 ? (
        // Fallback: say the daily detail is unavailable rather than render a grid of dashes.
        // The plugin normally backfills missing days (history.plan).
        h("div", { className: "tlogs-empty" }, t('cal.noDaily'))) : (h(Fragment, null,
            h("div", { className: "tlogs-cal", role: "grid" },
                WEEKDAY_KEYS.map((w) => (h("div", { key: w, className: "tlogs-cal-head" }, t(w)))),
                cells),
            h("div", { className: "tlogs-cal-detail" }, selectedDate && selected ? (h(Fragment, null,
                h("span", { className: "tlogs-cal-summary-title" }, selectedDate),
                statLine(selected, t).map((s) => (h("span", { key: s.key, className: "tlogs-metric", title: s.full },
                    h("span", { className: "tlogs-metric-label" }, s.label),
                    h("span", { className: "tlogs-metric-value" }, s.text)))))) : (h("span", { className: "tlogs-hint" }, t('cal.pickDay'))))))));
}
export function DetailModal(props) {
    const { detail, monthDetail, series, seriesLoading, loading, busy, error, onClose, onRefresh, onSelectMonth, onLoadSeries } = props;
    const [tab, setTab] = React.useState('calendar');
    const t = useT();
    // Escape closes the dialog.
    React.useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (h("div", { className: "tlogs-modal-mask", role: "presentation", onClick: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        } },
        h("div", { className: "tlogs-modal", role: "dialog", "aria-modal": "true", "aria-label": t('modal.label') },
            h("div", { className: "tlogs-modal-head" },
                h("span", { className: "tlogs-modal-title" }, t('modal.title')),
                h("span", { className: "tlogs-actions" },
                    h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? t('common.refreshing') : t('common.refresh')),
                    h("button", { type: "button", className: "tlogs-btn", onClick: onClose, "aria-label": t('modal.close'), title: t('modal.closeTitle') }, "\u2715"))),
            h("div", { className: "tlogs-modal-body" },
                h("div", { className: "tlogs-tabs", role: "tablist" }, TABS.map((item) => (h("button", { key: item.id, type: "button", role: "tab", "aria-selected": item.id === tab, className: item.id === tab ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setTab(item.id) }, t(item.labelKey))))),
                tab === 'settings' ? (
                // Settings renders before the loading branch: the language switch must not be
                // blocked while usage is still loading.
                h(SettingsPanel, null)) : loading && !detail ? (h("div", { className: "tlogs-empty" }, t('common.loading'))) : tab === 'calendar' ? (h(Calendar, { months: detail?.months ?? [], monthDetail: monthDetail, onSelectMonth: onSelectMonth })) : tab === 'charts' ? (h(ChartPanel, { series: series, loading: seriesLoading, error: error, onLoad: onLoadSeries })) : tab === 'providers' ? (h("div", null,
                    h("div", { className: "tlogs-hint" },
                        detail?.localRange
                            ? t('providers.localRange', {
                                source: detail.localRange.sourceLabel
                                    ? t('providers.localRangeSource', { source: detail.localRange.sourceLabel })
                                    : '',
                                range: `${detail.localRange.from} ~ ${detail.localRange.to}`,
                                days: detail.localRange.days,
                                files: detail.localRange.files,
                            })
                            : t('providers.unavailable', {
                                reason: localReasonLabel(detail?.localUnavailable?.reason),
                            }),
                        t('providers.coverage')),
                    h(StatTable, { rows: detail?.providers ?? [], emptyText: detail?.localUnavailable
                            ? t('providers.unavailableLong', {
                                reason: localReasonLabel(detail.localUnavailable.reason),
                            })
                            : t('providers.empty') }))) : tab === 'models' && detail?.modelsIncludeLocal ? (h("div", null,
                    h("div", { className: "tlogs-hint" }, t('providers.modelsNote')),
                    h(StatTable, { rows: detail?.models ?? [] }))) : (h(StatTable, { rows: tab === 'models'
                        ? (detail?.models ?? [])
                        : tab === 'years'
                            ? (detail?.years ?? [])
                            : tab === 'months'
                                ? (detail?.months ?? [])
                                : (monthDetail?.days ?? detail?.days ?? []) }))))));
}
//# sourceMappingURL=detail-modal.js.map