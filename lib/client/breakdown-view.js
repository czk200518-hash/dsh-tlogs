/**
 * tlogs — the "breakdown" tab of the detail modal: token composition, cost composition and the
 * per-project token table.
 *
 * Everything here is derived from data the plugin already holds: the platform bill's five token
 * counters and five money buckets per day. Both sides of a percentage therefore come from the same
 * calls — mixing in the local log would make token and money denominators disagree, since local
 * usage has no prices.
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatMoneyFull, formatMoney, formatNumber } from './format.js';
import { StatTable } from './detail-view.js';
import { useT } from './i18n/index.js';
import { moneyTotal } from '../types.js';
const PARTS = [
    { id: 'hit', labelKey: 'breakdown.hit', key: 'PROMPT_CACHE_HIT_TOKEN', color: 'var(--tlogs-c1)' },
    { id: 'miss', labelKey: 'breakdown.miss', key: 'PROMPT_CACHE_MISS_TOKEN', color: 'var(--tlogs-c3)' },
    { id: 'plain', labelKey: 'breakdown.plain', key: 'PROMPT_TOKEN', color: 'var(--tlogs-c6)' },
    { id: 'out', labelKey: 'breakdown.output', key: 'RESPONSE_TOKEN', color: 'var(--tlogs-c4)' },
];
const SCOPES = [
    { id: 'total', labelKey: 'breakdown.scope.total' },
    { id: 'month', labelKey: 'breakdown.scope.month' },
    { id: 'today', labelKey: 'breakdown.scope.today' },
    { id: 'custom', labelKey: 'breakdown.scope.custom' },
];
/** `YYYY-MM` → 年月；格式不认识返回 undefined。 */
function parseYm(key) {
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m)
        return undefined;
    const year = Number(m[1]);
    const month = Number(m[2]);
    return month >= 1 && month <= 12 ? { year, month } : undefined;
}
/** 把金额塞进单个桶：表格只按总额展示，桶名保持 Money 的形状。 */
function singleBucket(amount) {
    return {
        PROMPT_TOKEN: amount,
        PROMPT_CACHE_HIT_TOKEN: 0,
        PROMPT_CACHE_MISS_TOKEN: 0,
        RESPONSE_TOKEN: 0,
        REQUEST: 0,
    };
}
const pct = (part, whole) => (whole > 0 ? part / whole : 0);
const pctText = (v) => `${(v * 100).toFixed(v > 0 && v < 0.001 ? 3 : 1)}%`;
/**
 * 一行构成：色标 + 名称 + 占比条 + 主数值 + 占比。
 *
 * token 与金额各用一遍：金额那一路不该再显示 token 数（同一个数看两遍只会读错），
 * 所以主数值与条宽都由调用方给，组件本身不认识 token 或金额。
 */
function CompositionRow(props) {
    const { label, color, barShare, value, valueTip, share } = props;
    return (h("div", { className: "tlogs-bd-row" },
        h("i", { className: "tlogs-bd-dot", style: { background: color } }),
        h("span", { className: "tlogs-bd-label" }, label),
        h("span", { className: "tlogs-bd-bar" },
            h("i", { style: { width: `${Math.min(100, barShare * 100)}%`, background: color } })),
        h("span", { className: "tlogs-bd-value", title: valueTip }, value),
        h("span", { className: "tlogs-bd-pct" }, share)));
}
function Kpi(props) {
    return (h("div", { className: "tlogs-bd-kpi", title: props.tip },
        h("span", { className: "tlogs-bd-kpi-label" },
            props.glyph ? h("i", { className: "tlogs-bd-glyph" }, props.glyph) : null,
            props.label),
        h("b", { className: "tlogs-bd-kpi-value" }, props.value)));
}
function WindowView(props) {
    const { w, numberFormat, t } = props;
    const raw = w.stat.raw;
    const input = raw.PROMPT_TOKEN + raw.PROMPT_CACHE_HIT_TOKEN + raw.PROMPT_CACHE_MISS_TOKEN;
    const total = w.stat.totalTokens;
    const cost = w.stat.cost;
    const money = cost ? moneyTotal(cost) : undefined;
    /** 分母为 0（例如选了没有用量的未来日期）时给「—」：0.0% 会被读成「一次都没命中」。 */
    const pctOrDash = (part, whole) => (whole > 0 ? pctText(pct(part, whole)) : '—');
    return (h(Fragment, null,
        h("div", { className: "tlogs-bd-kpis" },
            h(Kpi, { label: t('breakdown.hitRate'), value: pctOrDash(raw.PROMPT_CACHE_HIT_TOKEN, input), tip: t('breakdown.hitRateTip'), glyph: "\u25C9" }),
            h(Kpi, { label: t('breakdown.outputShare'), value: pctOrDash(raw.RESPONSE_TOKEN, total), tip: t('breakdown.outputShareTip'), glyph: "\u25B2" }),
            h(Kpi, { label: t('breakdown.requests'), value: formatNumber(raw.REQUEST, numberFormat), glyph: "\u21BA" }),
            h(Kpi, { label: t('breakdown.cost'), value: money === undefined ? '—' : formatMoney(money), tip: money === undefined ? t('breakdown.costTip') : `${t('breakdown.costTip')} ${formatMoneyFull(money)}`, glyph: "\u00A5" })),
        h("div", { className: "tlogs-bd-title" }, t('breakdown.tokenTitle')),
        h("div", { className: "tlogs-bd-rows" }, PARTS.map((p) => (h(CompositionRow, { key: p.id, label: t(p.labelKey), color: p.color, barShare: pct(raw[p.key], total), value: formatNumber(raw[p.key], numberFormat), valueTip: `${formatNumber(raw[p.key], 'full')} tokens`, share: pctText(pct(raw[p.key], total)) })))),
        h("div", { className: "tlogs-bd-title" }, t('breakdown.moneyTitle')),
        cost ? (h("div", { className: "tlogs-bd-rows" }, PARTS.map((p) => (h(CompositionRow, { key: p.id, label: t(p.labelKey), color: p.color, barShare: pct(cost[p.key], moneyTotal(cost)), value: formatMoney(cost[p.key]), valueTip: formatMoneyFull(cost[p.key]), share: pctText(pct(cost[p.key], moneyTotal(cost))) }))))) : (h("div", { className: "tlogs-hint" }, t('breakdown.noCost'))),
        w.partial ? h("div", { className: "tlogs-hint" }, t('breakdown.partial')) : null));
}
const BUCKET_HIT_KEYS = [
    'breakdown.hitBucket.1',
    'breakdown.hitBucket.2',
    'breakdown.hitBucket.3',
    'breakdown.hitBucket.4',
    'breakdown.hitBucket.5',
];
export function BreakdownView(props) {
    const { breakdown, projects, months, monthDetail, onSelectMonth, currency, numberFormat, unitPrices, insights } = props;
    const t = useT();
    const [scope, setScope] = React.useState('total');
    /** 指定口径：选中的月份（`YYYY-MM`）与日期；日期留空表示整月。 */
    const [month, setMonth] = React.useState(() => months[months.length - 1]?.key ?? '');
    const [day, setDay] = React.useState('');
    /*
     * 「指定」用的是弹窗已经加载过的月明细：换月份只是让 host 拉那一个月的逐日表，
     * 逐日表本身已经带 token 与金额，所以这里不需要新的取数端点。
     */
    const picked = parseYm(month);
    const loaded = monthDetail && picked && monthDetail.year === picked.year && monthDetail.month === picked.month;
    React.useEffect(() => {
        if (scope !== 'custom' || !picked || loaded)
            return;
        onSelectMonth(picked.year, picked.month);
    }, [scope, picked, loaded, onSelectMonth]);
    if (!breakdown)
        return h("div", { className: "tlogs-empty" }, t('breakdown.empty'));
    /** 指定窗口：选到日期就只看那一天，否则整月。 */
    const customWindow = (() => {
        if (!monthDetail || !loaded)
            return undefined;
        if (day) {
            const row = monthDetail.days.find((d) => d.key === day);
            if (!row)
                return undefined;
            // 零用量的一天没有金额条目，那不是「缺失」——只有当天真有调用才算没拿到钱。
            const used = row.stat.totalTokens > 0 || row.stat.requests > 0;
            return { stat: row.stat, currency: monthDetail.currency ?? currency, partial: used && !row.stat.cost };
        }
        return {
            stat: monthDetail.stat,
            currency: monthDetail.currency ?? currency,
            partial: monthDetail.costAvailable === false,
        };
    })();
    const window = scope === 'custom' ? customWindow : breakdown[scope];
    return (h("div", { className: "tlogs-bd" },
        h("div", { className: "tlogs-chart-controls" },
            h("span", { className: "tlogs-ctl-group", role: "group", "aria-label": t('breakdown.scope') },
                h("span", { className: "tlogs-ctl-label" }, t('breakdown.scope')),
                SCOPES.map((s) => (h("button", { key: s.id, type: "button", className: s.id === scope ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setScope(s.id), "aria-pressed": s.id === scope }, t(s.labelKey))))),
            scope === 'custom' ? (h(Fragment, null,
                h("span", { className: "tlogs-ctl-group" },
                    h("span", { className: "tlogs-ctl-label" }, t('breakdown.pickMonth')),
                    h("select", { className: "tlogs-input tlogs-chart-select", value: month, onChange: (e) => {
                            setMonth(e.target.value);
                            setDay('');
                        }, "aria-label": t('breakdown.pickMonth') }, months.map((m) => (h("option", { key: m.key, value: m.key }, m.key))))),
                h("span", { className: "tlogs-ctl-group" },
                    h("span", { className: "tlogs-ctl-label" }, t('breakdown.pickDay')),
                    h("select", { className: "tlogs-input tlogs-chart-select", value: day, onChange: (e) => setDay(e.target.value), "aria-label": t('breakdown.pickDay'), disabled: !loaded },
                        h("option", { value: "" }, t('breakdown.wholeMonth')),
                        (monthDetail?.days ?? []).map((d) => (h("option", { key: d.key, value: d.key }, d.key))))))) : null),
        window ? (h(WindowView, { w: window, numberFormat: numberFormat, t: t })) : (h("div", { className: "tlogs-empty" }, t('breakdown.loadingMonth'))),
        insights ? (h(Fragment, null,
            h("div", { className: "tlogs-bd-title" }, t('breakdown.stepHitTitle')),
            h("div", { className: "tlogs-bd-rows" }, insights.stepHitBuckets.map((n, i) => {
                const total = insights.stepHitBuckets.reduce((a, b) => a + b, 0);
                const max = Math.max(1, ...insights.stepHitBuckets);
                return (h("div", { className: "tlogs-bd-row", key: i },
                    h("i", { className: "tlogs-bd-dot", style: { background: 'var(--tlogs-c1)' } }),
                    h("span", { className: "tlogs-bd-label" }, t(BUCKET_HIT_KEYS[i])),
                    h("span", { className: "tlogs-bd-bar" },
                        h("i", { style: { width: `${Math.min(100, (n / max) * 100)}%`, background: 'var(--tlogs-c1)' } })),
                    h("span", { className: "tlogs-bd-value" }, formatNumber(n, numberFormat)),
                    h("span", { className: "tlogs-bd-pct" }, total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—')));
            })),
            h("div", { className: "tlogs-hint" }, t('breakdown.stepHitHint')))) : null,
        h("div", { className: "tlogs-bd-title" }, t('breakdown.projects')),
        h("div", { className: "tlogs-hint" }, t('breakdown.projectsHint')),
        unitPrices ? h("div", { className: "tlogs-hint" }, t('breakdown.estimatedHint')) : null,
        h(StatTable, { rows: projects.map((p) => {
                const raw = p.stat.raw;
                let estimate = 0;
                let any = false;
                for (const [type, price] of Object.entries(unitPrices ?? {})) {
                    const tokens = raw[type] ?? 0;
                    if (tokens > 0 && price > 0) {
                        estimate += tokens * price;
                        any = true;
                    }
                }
                return {
                    key: p.id,
                    label: p.label,
                    stat: any ? { ...p.stat, cost: singleBucket(estimate), currency } : p.stat,
                };
            }) })));
}
//# sourceMappingURL=breakdown-view.js.map