/**
 * tlogs — 详细视图。
 *
 * 需求 1.4：点击「详细数据 >」后在同一内嵌容器内切换（不新开窗口、不弹 Modal），
 * 顶部有「‹ 返回」回到展开面板；四张表格（模型 / 年 / 月 / 当月按天），
 * 支持列排序、数字右对齐。
 */
import * as React from 'react';
import { h } from './h.js';
import { formatFull } from './format.js';
const COLUMNS = [
    { key: 'label', label: '名称' },
    { key: 'inputTokens', label: '输入' },
    { key: 'outputTokens', label: '输出' },
    { key: 'totalTokens', label: '总 Token' },
    { key: 'requests', label: '请求' },
];
const TABS = [
    { id: 'models', label: '模型', pick: (d) => d.models },
    { id: 'years', label: '年', pick: (d) => d.years },
    { id: 'months', label: '月', pick: (d) => d.months },
    { id: 'days', label: '当月按天', pick: (d) => d.days },
];
function sortRows(rows, key, dir) {
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        if (key === 'label')
            return sign * a.label.localeCompare(b.label);
        return sign * (a.stat[key] - b.stat[key]);
    });
}
export function DetailView(props) {
    const { detail, loading, onBack, onRefresh, busy } = props;
    const [tab, setTab] = React.useState('models');
    const [sort, setSort] = React.useState({
        key: 'totalTokens',
        dir: 'desc',
    });
    const active = TABS.find((t) => t.id === tab) ?? TABS[0];
    const rows = detail ? sortRows(active.pick(detail), sort.key, sort.dir) : [];
    const toggleSort = (key) => {
        setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
    };
    return (h("div", { className: "tlogs-panel tlogs-detail" },
        h("div", { className: "tlogs-detail-head" },
            h("button", { type: "button", className: "tlogs-btn", onClick: onBack }, "\u2039 \u8FD4\u56DE"),
            h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? '刷新中…' : '刷新')),
        h("div", { className: "tlogs-tabs", role: "tablist" }, TABS.map((t) => (h("button", { key: t.id, type: "button", role: "tab", "aria-selected": t.id === tab, className: t.id === tab ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setTab(t.id) }, t.label)))),
        loading && !detail ? (h("div", { className: "tlogs-empty" }, "\u52A0\u8F7D\u4E2D\u2026")) : rows.length === 0 ? (h("div", { className: "tlogs-empty" }, "\u6682\u65E0\u6570\u636E")) : (h("div", { className: "tlogs-scroll" },
            h("table", { className: "tlogs-table" },
                h("thead", null,
                    h("tr", null, COLUMNS.map((c) => (h("th", { key: c.key, onClick: () => toggleSort(c.key), title: `按${c.label}排序`, "aria-sort": sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none' },
                        c.label,
                        sort.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''))))),
                h("tbody", null, rows.map((r) => (h("tr", { key: r.key },
                    h("td", { title: r.label }, r.label),
                    h("td", { title: formatFull(r.stat.inputTokens) }, formatFull(r.stat.inputTokens)),
                    h("td", { title: formatFull(r.stat.outputTokens) }, formatFull(r.stat.outputTokens)),
                    h("td", { title: formatFull(r.stat.totalTokens) }, formatFull(r.stat.totalTokens)),
                    h("td", { title: formatFull(r.stat.requests) }, formatFull(r.stat.requests)))))))))));
}
//# sourceMappingURL=detail-view.js.map