/**
 * tlogs — 详细数据弹窗（含日历查询）。
 *
 * 取代原先「在侧边栏页脚内就地切换」的详细视图：侧边栏太窄，表格与日历都需要
 * 横向空间，所以改成浮层弹窗（同一容器内不再切换视图）。
 *
 * 日历查询的数据来源：host 侧每个已抓取的月份都把**逐日明细**存进了历史缓存，
 * 因此这里可以回溯任意月份的每一天，而不是只有当月。
 *
 * 关于 `position: fixed`：需求 1.1 要求内嵌组件留在文档流内、不得用 fixed 伪造悬浮；
 * 那一条针对的是**侧边栏页脚里的组件**（紧凑条与展开面板，至今仍然遵守）。
 * 弹窗本质上就该是浮层，因此它的遮罩/对话框使用 fixed。
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
 * 页签表里存的是**键**而不是文案：文案要随语言切换实时变，
 * 所以只能在渲染时翻译，不能在模块加载时定死。
 * 「设置」放在最后 —— 那一排的末尾，与其它数据页签区分开。
 */
const TABS = [
    { id: 'calendar', labelKey: 'tab.calendar' },
    { id: 'charts', labelKey: 'tab.charts' },
    { id: 'models', labelKey: 'tab.models' },
    // 「供应商」表来自本机会话日志（含平台账单看不到的火山方舟/小米/GLM…），
    // 紧跟在平台口径的「模型」表后面，两张表的口径差异在表头上写明。
    { id: 'providers', labelKey: 'tab.providers' },
    { id: 'years', labelKey: 'tab.years' },
    { id: 'months', labelKey: 'tab.months' },
    { id: 'days', labelKey: 'tab.days' },
    { id: 'settings', labelKey: 'tab.settings' },
];
/** 周一起始的星期标题（与插件「本周 = 周一至今」的口径一致）。 */
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
/** 解析 `YYYY-MM`。非法返回 undefined。 */
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
/** 某年某月的天数。 */
function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
/** 该月 1 日是周几（0=周日），偏移到「周一起始」的 0..6。 */
function leadingBlanks(year, month) {
    const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return (dow + 6) % 7;
}
const ZERO_COUNTERS = { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 };
/**
 * 汇总行：输入 / 输出 / 总 Token / 请求（+ 有金额时的 ¥）。
 *
 * 金额项**只在真的有金额数据时出现**：没有金额而硬显示 ¥0.00 会让人以为真没花钱，
 * 而实际是那一段还没回补到金额。
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
/** 日历面板。 */
function Calendar(props) {
    const { months, monthDetail, onSelectMonth } = props;
    const t = useT();
    /**
     * 月份一律按 `YYYY-MM` 升序处理，**不依赖 host 的下发顺序**。
     *
     * （原先直接用传入数组的末项当默认月份，一旦顺序是降序就会默认到更早的月份 ——
     * 实测就踩到了：默认落在 8 月而不是 9 月。）
     */
    const sorted = React.useMemo(() => [...months].sort((a, b) => a.key.localeCompare(b.key)), [months]);
    /** 已选月份：初始为最新一个有数据的月份。 */
    const [sel, setSel] = React.useState(null);
    const [selectedDate, setSelectedDate] = React.useState(null);
    // 月份列表就绪后补上默认选中项（只在还没选过时）。
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
    // 该月逐日统计：date -> 计数（含金额）
    const byDate = new Map();
    for (const d of monthDetail?.days ?? [])
        byDate.set(d.key, d.stat);
    const maxDay = Math.max(1, ...[...byDate.values()].map((s) => s.totalTokens));
    const maxCost = Math.max(0, ...[...byDate.values()].map((s) => (s.cost ? moneyTotal(s.cost) : 0)));
    const hasCost = maxCost > 0;
    const total = daysInMonth(current.year, current.month);
    const blanks = leadingBlanks(current.year, current.month);
    /**
     * 日历**固定 6 行（42 格）**，不足的部分补空格。
     *
     * 为什么：一次最多需要 6 行（31 天 + 最多 6 个前置空格）。如果按实际需要渲染，
     * 7 月只要 5 行、8 月要 6 行，切月时弹窗高度就会跳一下（用户实测反馈）。补满 42 格
     * 后无论怎么切月，网格高度恒定。
     *
     * 同理：金额那一行**无条件渲染**（无金额时留空占位），否则有/无金额的月份之间
     * 单元格高度会差一行，切月时高度又跳 —— 这正是网格高度恒定要避免的事。
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
        // 热度按 token 与金额的较大者着色：否则「token 少但很贵」的日子会看不出来。
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
    // 尾部补齐到固定格数，保证 6 行恒定
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
        // 兜底：确实拿不到该月逐日明细时，明确说明而不是渲染一片「—」。
        // （正常情况下插件会自动回补缺失的逐日明细，见 history.plan 的说明。）
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
    // Esc 关闭：弹窗的基本可用性要求。
    React.useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (h("div", { className: "tlogs-modal-mask", role: "presentation", onClick: (e) => {
            // 只有点遮罩本身才关闭；点对话框内部不关闭。
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
                // 设置页签**先于**加载分支：语言开关不该因为用量还没拉回来就点不开。
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