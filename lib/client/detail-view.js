/**
 * tlogs — 可排序的统计表格。
 *
 * 从原「内嵌详细视图」中抽出，现在作为详细数据弹窗（detail-modal.tsx）的表格页复用。
 * 本组件**不带**弹窗外壳，只负责表格本身（列可点排序、数字右对齐、完整值走 tooltip）。
 *
 * 金额列（¥）是**按需出现**的：只有当这批行里有任意一行带金额时才渲染该列。
 * 理由：日历/历史里有大量「当期没花钱」的行，若无脑显示一列 ¥0.00，用户会以为
 * 插件算错了；而整列消失只说明「这批数据还没抓到金额」。
 */
import * as React from 'react';
import { h } from './h.js';
import { formatFull, formatMoneyFull } from './format.js';
import { useT } from './i18n/index.js';
import { moneyTotal } from '../types.js';
/** 每行的金额（元）；没有金额数据时返回 undefined。 */
function rowCost(r) {
    return r.stat.cost ? moneyTotal(r.stat.cost) : undefined;
}
function sortRows(rows, key, dir) {
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        if (key === 'label')
            return sign * a.label.localeCompare(b.label);
        if (key === 'cost')
            return sign * ((rowCost(a) ?? 0) - (rowCost(b) ?? 0));
        return sign * (a.stat[key] - b.stat[key]);
    });
}
export function StatTable(props) {
    const { rows, emptyText } = props;
    const t = useT();
    const [sort, setSort] = React.useState({
        key: 'totalTokens',
        dir: 'desc',
    });
    const hasCost = rows.some((r) => rowCost(r) !== undefined);
    const columns = React.useMemo(() => {
        // 列头与日历汇总行、选中日明细用的是同一批词，直接复用 part A 的 `stat.*`，
        // 免得同一句话在字典里出现两份。
        const base = [
            { key: 'label', labelKey: 'table.name' },
            { key: 'inputTokens', labelKey: 'stat.input' },
            { key: 'outputTokens', labelKey: 'stat.output' },
            { key: 'totalTokens', labelKey: 'stat.totalTokens' },
            { key: 'requests', labelKey: 'stat.requests' },
        ];
        // 金额放最后一列：它是「补充信息」，指标列应保持原有的阅读顺序。
        if (hasCost)
            base.push({ key: 'cost', labelKey: 'stat.cost' });
        return base;
    }, [hasCost]);
    const sorted = sortRows(rows, sort.key, sort.dir);
    const toggleSort = (key) => {
        setSort((prev) => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
    };
    if (rows.length === 0)
        return h("div", { className: "tlogs-empty" }, emptyText ?? t('common.noData'));
    return (h("div", { className: "tlogs-table-wrap" },
        h("table", { className: "tlogs-table" },
            h("thead", null,
                h("tr", null, columns.map((c) => (h("th", { key: c.key, onClick: () => toggleSort(c.key), title: t('table.sortBy', { column: t(c.labelKey) }), "aria-sort": sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none' },
                    t(c.labelKey),
                    sort.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''))))),
            h("tbody", null, sorted.map((r) => {
                const c = rowCost(r);
                return (h("tr", { key: r.key },
                    h("td", { title: r.label },
                        r.tag ? (h("span", { className: "tlogs-src tlogs-src-inline", title: r.tagTitle ?? r.tag }, r.tag)) : null,
                        r.label),
                    h("td", { title: formatFull(r.stat.inputTokens) }, formatFull(r.stat.inputTokens)),
                    h("td", { title: formatFull(r.stat.outputTokens) }, formatFull(r.stat.outputTokens)),
                    h("td", { title: formatFull(r.stat.totalTokens) }, formatFull(r.stat.totalTokens)),
                    h("td", { title: formatFull(r.stat.requests) }, formatFull(r.stat.requests)),
                    hasCost ? (h("td", { className: "tlogs-td-money", title: c === undefined ? '' : formatMoneyFull(c) }, c === undefined ? '—' : formatMoneyFull(c))) : null));
            })))));
}
//# sourceMappingURL=detail-view.js.map