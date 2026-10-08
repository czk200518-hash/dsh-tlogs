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
import { formatFull, formatMoneyFull, formatMoneyShort, formatNumber } from './format.js';
import { moneyTotal } from '../types.js';
import { StatTable } from './detail-view.js';
import { ChartPanel } from './chart-panel.js';
const TABS = [
    { id: 'calendar', label: '日历' },
    { id: 'charts', label: '图表' },
    { id: 'models', label: '模型' },
    // 「供应商」表来自本机会话日志（含平台账单看不到的火山方舟/小米/GLM…），
    // 紧跟在平台口径的「模型」表后面，两张表的口径差异在表头上写明。
    { id: 'providers', label: '供应商' },
    { id: 'years', label: '年' },
    { id: 'months', label: '月' },
    { id: 'days', label: '当月按天' },
];
/** 周一起始的星期标题（与插件「本周 = 周一至今」的口径一致）。 */
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
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
function statLine(stat) {
    const out = [
        { label: '输入', text: formatNumber(stat.inputTokens, 'short'), full: formatFull(stat.inputTokens) },
        { label: '输出', text: formatNumber(stat.outputTokens, 'short'), full: formatFull(stat.outputTokens) },
        { label: '总 Token', text: formatNumber(stat.totalTokens, 'short'), full: formatFull(stat.totalTokens) },
        { label: '请求', text: formatNumber(stat.requests, 'short'), full: formatFull(stat.requests) },
    ];
    if (stat.cost) {
        const m = moneyTotal(stat.cost);
        out.push({ label: '金额', text: formatMoneyShort(m), full: formatMoneyFull(m) });
    }
    return out;
}
/** 日历面板。 */
function Calendar(props) {
    const { months, monthDetail, onSelectMonth } = props;
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
        return h("div", { className: "tlogs-empty" }, "\u6682\u65E0\u6570\u636E");
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
            ? `${date} · ${formatFull(value)} tokens · ${formatFull(stat.requests)} 次请求` +
                (stat.cost ? ` · ${formatMoneyFull(dayCost)} 元` : '')
            : `${date} · 无数据`;
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
            h("button", { type: "button", className: "tlogs-btn", onClick: () => step(-1), disabled: idx <= 0, "aria-label": "\u4E0A\u4E00\u4E2A\u6708" }, "\u2039"),
            h("select", { className: "tlogs-input tlogs-cal-select", value: ymKey(current.year, current.month), onChange: (e) => {
                    const ym = parseYm(e.target.value);
                    if (ym)
                        pick(ym);
                }, "aria-label": "\u9009\u62E9\u6708\u4EFD" }, sorted.map((r) => (h("option", { key: r.key, value: r.key },
                r.key,
                "\uFF08",
                formatNumber(r.stat.totalTokens, 'short'),
                " tokens",
                r.stat.cost ? ` · ${formatMoneyShort(moneyTotal(r.stat.cost))}` : '',
                "\uFF09")))),
            h("button", { type: "button", className: "tlogs-btn", onClick: () => step(1), disabled: idx < 0 || idx >= sorted.length - 1, "aria-label": "\u4E0B\u4E00\u4E2A\u6708" }, "\u203A")),
        h("div", { className: "tlogs-cal-summary" },
            h("span", { className: "tlogs-cal-summary-title" },
                ymKey(current.year, current.month),
                " \u5408\u8BA1"),
            statLine(monthDetail?.stat ?? ZERO_COUNTERS).map((s) => (h("span", { key: s.label, className: "tlogs-metric", title: s.full },
                h("span", { className: "tlogs-metric-label" }, s.label),
                h("span", { className: "tlogs-metric-value" }, s.text))))),
        byDate.size === 0 ? (
        // 兜底：确实拿不到该月逐日明细时，明确说明而不是渲染一片「—」。
        // （正常情况下插件会自动回补缺失的逐日明细，见 history.plan 的说明。）
        h("div", { className: "tlogs-empty" }, "\u8BE5\u6708\u6682\u65E0\u9010\u65E5\u660E\u7EC6\uFF0C\u4EC5\u663E\u793A\u4E0A\u65B9\u6708\u5EA6\u5408\u8BA1\u3002\u4E0B\u4E00\u6B21\u81EA\u52A8\u5237\u65B0\u4F1A\u5C1D\u8BD5\u56DE\u8865\u3002")) : (h(Fragment, null,
            h("div", { className: "tlogs-cal", role: "grid" },
                WEEKDAYS.map((w) => (h("div", { key: w, className: "tlogs-cal-head" }, w))),
                cells),
            h("div", { className: "tlogs-cal-detail" }, selectedDate && selected ? (h(Fragment, null,
                h("span", { className: "tlogs-cal-summary-title" }, selectedDate),
                statLine(selected).map((s) => (h("span", { key: s.label, className: "tlogs-metric", title: s.full },
                    h("span", { className: "tlogs-metric-label" }, s.label),
                    h("span", { className: "tlogs-metric-value" }, s.text)))))) : (h("span", { className: "tlogs-hint" }, "\u70B9\u51FB\u65E5\u5386\u4E2D\u7684\u67D0\u4E00\u5929\u67E5\u770B\u5F53\u5929\u660E\u7EC6\u3002")))))));
}
export function DetailModal(props) {
    const { detail, monthDetail, series, seriesLoading, loading, busy, error, onClose, onRefresh, onSelectMonth, onLoadSeries } = props;
    const [tab, setTab] = React.useState('calendar');
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
        h("div", { className: "tlogs-modal", role: "dialog", "aria-modal": "true", "aria-label": "tlogs \u7528\u91CF\u8BE6\u7EC6\u6570\u636E" },
            h("div", { className: "tlogs-modal-head" },
                h("span", { className: "tlogs-modal-title" }, "\u7528\u91CF\u8BE6\u7EC6\u6570\u636E"),
                h("span", { className: "tlogs-actions" },
                    h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? '刷新中…' : '刷新'),
                    h("button", { type: "button", className: "tlogs-btn", onClick: onClose, "aria-label": "\u5173\u95ED\u8BE6\u7EC6\u6570\u636E", title: "\u5173\u95ED\uFF08Esc\uFF09" }, "\u2715"))),
            h("div", { className: "tlogs-modal-body" },
                h("div", { className: "tlogs-tabs", role: "tablist" }, TABS.map((t) => (h("button", { key: t.id, type: "button", role: "tab", "aria-selected": t.id === tab, className: t.id === tab ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setTab(t.id) }, t.label)))),
                loading && !detail ? (h("div", { className: "tlogs-empty" }, "\u52A0\u8F7D\u4E2D\u2026")) : tab === 'calendar' ? (h(Calendar, { months: detail?.months ?? [], monthDetail: monthDetail, onSelectMonth: onSelectMonth })) : tab === 'charts' ? (h(ChartPanel, { series: series, loading: seriesLoading, error: error, onLoad: onLoadSeries })) : tab === 'providers' ? (h("div", null,
                    h("div", { className: "tlogs-hint" },
                        detail?.localRange
                            ? `本机口径（DSH 会话日志）：${detail.localRange.from} ~ ${detail.localRange.to} · ` +
                                `${detail.localRange.days} 天 · ${detail.localRange.files} 个会话日志`
                            : '本机口径：无数据',
                        '；含平台账单看不到的供应商（火山方舟 / 小米 / GLM / GPT…）'),
                    h(StatTable, { rows: detail?.providers ?? [], emptyText: "\u672C\u673A\u53E3\u5F84\u6682\u65E0\u6570\u636E\uFF08\u4F1A\u8BDD\u65E5\u5FD7\u672A\u5C31\u7EEA\u6216\u5DF2\u5173\u95ED localUsage\uFF09" }))) : (h(StatTable, { rows: tab === 'models'
                        ? (detail?.models ?? [])
                        : tab === 'years'
                            ? (detail?.years ?? [])
                            : tab === 'months'
                                ? (detail?.months ?? [])
                                : (monthDetail?.days ?? detail?.days ?? []) }))))));
}
//# sourceMappingURL=detail-modal.js.map