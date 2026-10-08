/**
 * tlogs — 形态 A：紧凑条（默认）。
 *
 * 需求 1.2：高约 28–32px，横向排列核心数字，右侧展开/收起按钮。
 * 需求 1.5：紧凑条上的数字只使用缓存值，自身不主动触发请求。
 *
 * 布局原则（实测修正）：
 *   - **不再有求和符号标识**。原先左侧有一个徽标、总计的标签又是同一个符号，
 *     两个符号加上 4 个指标会把这一行挤爆，末尾指标被右边缘裁掉（实测：最后一项
 *     显示成「本月 359」而不是完整的「359M」）。总计的标签现在是「总」。
 *   - 紧凑条默认只放 **总计 + 今日**；本周/本月只在展开面板里看。
 *   - CSS 侧保证**数字优先**：空间不足时先压缩/省略标签，数字永不截断。
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatMoney, formatMoneyFull, formatNumber } from './format.js';
export function CompactBar(props) {
    const { snapshot, numberFormat, wide, expanded, busy, onToggle, onRefresh } = props;
    const metrics = snapshot?.compact ?? [];
    const stale = snapshot?.stale === true;
    const progress = snapshot?.loading ? (snapshot.progress ?? 0) : null;
    // 收起态（图标栏）显示总计：优先取 scope==='total' 的那一项，
    // 万一用户把 total 从 compactMetrics 里去掉就退回第一项。
    const lead = metrics.find((m) => m.scope === 'total') ?? metrics[0];
    /** 指标的完整 tooltip：请求数用「次请求」，金额用「元」，其余按 token 计。 */
    const fullTitle = (label, value, unit, source) => {
        // 侧边栏太窄放不下口径徽标，但悬停必须能说明「这个数不是平台账单给的」。
        const note = source === 'local'
            ? '（本机口径：DSH 会话日志）'
            : source === 'merged'
                ? '（平台 + 本机合并口径）'
                : '';
        if (unit === 'requests')
            return `${label} ${formatFull(value)} 次请求${note}`;
        if (unit === 'money')
            return `${label} ${formatMoneyFull(value)} 元`;
        return `${label} ${formatFull(value)} tokens${note}`;
    };
    return (h(Fragment, null,
        h("div", { className: wide ? 'tlogs-compact' : 'tlogs-compact tlogs-collapsed', onClick: onToggle, title: "tlogs \u2014 DeepSeek \u7528\u91CF" },
            wide ? (h("span", { className: "tlogs-metrics" },
                metrics.map((m, i) => (h(Fragment, { key: `${m.scope}-${m.label}-${i}` },
                    h("span", { className: "tlogs-metric", title: fullTitle(m.label, m.value, m.unit, m.source) },
                        h("span", { className: "tlogs-metric-label" }, m.label),
                        h("span", { className: m.unit === 'money'
                                ? 'tlogs-metric-value tlogs-metric-money'
                                : 'tlogs-metric-value' }, m.unit === 'money'
                            ? formatMoney(m.value)
                            : formatNumber(m.value, numberFormat)))))),
                metrics.length === 0 ? h("span", { className: "tlogs-metric-label" }, "\u6682\u65E0\u6570\u636E") : null)) : (h("span", { className: "tlogs-collapsed-value", title: lead
                    ? lead.unit === 'money'
                        ? `${lead.label} ${formatMoneyFull(lead.value)} 元`
                        : `${lead.label} ${formatFull(lead.value)} tokens`
                    : 'tlogs — DeepSeek 用量' }, lead
                ? lead.unit === 'money'
                    ? formatMoney(lead.value)
                    : formatNumber(lead.value, numberFormat)
                : '—')),
            h("span", { className: "tlogs-actions" },
                stale ? (h("span", { className: "tlogs-stale", title: snapshot?.error ?? '数据可能过期：最近一次刷新失败，当前显示缓存值' }, "\u26A0")) : null,
                busy ? (h("span", { className: "tlogs-stale", title: "\u6B63\u5728\u5237\u65B0\u2026" }, "\u27F3")) : null,
                h("button", { type: "button", className: "tlogs-iconbtn tlogs-refresh", disabled: busy, onClick: (e) => {
                        // 阻止冒泡：否则点刷新会连带把面板展开/收起。
                        e.stopPropagation();
                        onRefresh();
                    }, "aria-label": "\u5237\u65B0\u7528\u91CF\u6570\u636E", title: "\u5237\u65B0\u7528\u91CF" }, "\u21BB"),
                h("button", { type: "button", className: "tlogs-iconbtn", onClick: (e) => {
                        // 阻止冒泡到紧凑条，否则会被父级的 onToggle 再切一次（等于没反应）。
                        e.stopPropagation();
                        onToggle();
                    }, "aria-expanded": expanded, "aria-label": expanded ? '收起 tlogs 面板' : '展开 tlogs 面板', title: expanded ? '收起' : '展开' }, expanded ? '▴' : '▾'))),
        progress !== null ? (h("span", { className: "tlogs-progress", "aria-hidden": "true" },
            h("i", { style: { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` } }))) : null));
}
//# sourceMappingURL=compact-bar.js.map