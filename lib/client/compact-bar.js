/**
 * tlogs — form A: the compact bar, the default state in the sidebar footer.
 *
 * One row of numbers plus the refresh / expand buttons (which toggle it): it renders the cached
 * snapshot only and never triggers a request itself — requests come from mount, the expand
 * toggle and the refresh button. The digits are never allowed to shrink — the row wraps instead.
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatMoney, formatMoneyFull, formatNumber } from './format.js';
import { useT } from './i18n/index.js';
export function CompactBar(props) {
    const { snapshot, numberFormat, wide, expanded, busy, onToggle, onRefresh } = props;
    const t = useT();
    const metrics = snapshot?.compact ?? [];
    const stale = snapshot?.stale === true;
    const progress = snapshot?.loading ? (snapshot.progress ?? 0) : null;
    const lead = metrics.find((m) => m.scope === 'total') ?? metrics[0];
    const fullTitle = (label, value, unit, source) => {
        // No room for a scope badge here, but hovering still has to say when the number is not
        // pure platform billing.
        const note = source === 'local'
            ? t('bar.noteLocal')
            : source === 'merged'
                ? t('bar.noteMerged')
                : '';
        if (unit === 'requests')
            return t('bar.titleRequests', { label, value: formatFull(value), note });
        if (unit === 'money')
            return t('bar.titleMoney', { label, value: formatMoneyFull(value) });
        return t('bar.titleTokens', { label, value: formatFull(value), note });
    };
    return (h(Fragment, null,
        h("div", { className: wide ? 'tlogs-compact' : 'tlogs-compact tlogs-collapsed', onClick: onToggle, title: t('bar.title') },
            wide ? (h("span", { className: "tlogs-metrics" },
                metrics.map((m, i) => (h("span", { key: `${m.scope}-${m.label}-${i}`, className: "tlogs-metric", title: fullTitle(m.label, m.value, m.unit, m.source) },
                    h("span", { className: "tlogs-metric-label" }, m.label),
                    h("span", { className: m.unit === 'money'
                            ? 'tlogs-metric-value tlogs-metric-money'
                            : 'tlogs-metric-value' }, m.unit === 'money'
                        ? formatMoney(m.value)
                        : formatNumber(m.value, numberFormat))))),
                metrics.length === 0 ? h("span", { className: "tlogs-metric-label" }, t('common.noData')) : null)) : (h("span", { className: "tlogs-collapsed-value", title: lead
                    ? lead.unit === 'money'
                        ? t('bar.titleMoney', { label: lead.label, value: formatMoneyFull(lead.value) })
                        : t('bar.titleTokens', { label: lead.label, value: formatFull(lead.value), note: '' })
                    : t('bar.title') }, lead
                ? lead.unit === 'money'
                    ? formatMoney(lead.value)
                    : formatNumber(lead.value, numberFormat)
                : '—')),
            h("span", { className: "tlogs-actions" },
                stale ? (h("span", { className: "tlogs-stale", title: snapshot?.error ?? t('bar.staleTip') }, "\u26A0")) : null,
                busy ? (h("span", { className: "tlogs-stale", title: t('bar.busyTip') }, "\u27F3")) : null,
                h("button", { type: "button", className: "tlogs-iconbtn tlogs-refresh", disabled: busy, onClick: (e) => {
                        // Stop propagation to the bar, where onToggle would flip the state right back.
                        e.stopPropagation();
                        onRefresh();
                    }, "aria-label": t('bar.refreshLabel'), title: t('bar.refreshTitle') }, "\u21BB"),
                h("button", { type: "button", className: "tlogs-iconbtn", onClick: (e) => {
                        // Stop propagation to the bar, where onToggle would flip the state right back.
                        e.stopPropagation();
                        onToggle();
                    }, "aria-expanded": expanded, "aria-label": expanded ? t('bar.collapseLabel') : t('bar.expandLabel'), title: expanded ? t('bar.collapse') : t('bar.expand') }, expanded ? '▴' : '▾'))),
        progress !== null ? (h("span", { className: "tlogs-progress", "aria-hidden": "true" },
            h("i", { style: { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` } }))) : null));
}
//# sourceMappingURL=compact-bar.js.map