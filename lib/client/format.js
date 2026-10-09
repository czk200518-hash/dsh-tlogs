/**
 * tlogs — number and money formatting.
 *
 * Pure functions: no DOM, no components, only the current language (money scale and labels come
 * from i18n/index.js). Node reports en-US, so a test asserting Chinese must call
 * `setLangPref('zh')` first.
 */
import { getLang, t as translate } from './i18n/index.js';
/** Thousand separators for an integer part: `1234567` → `1,234,567`. */
function group(intPart) {
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
/**
 * Render the host's machine-readable reason (SessionUsageStore) as a sentence; both the expand
 * panel and the detail view's provider tab show it, so the wording must not drift between them.
 *
 * `tr` is a parameter because render paths must pass the component's `t` (`useT()`) — a
 * module-level `t` would freeze the sentence in the language it first ran in; the default serves
 * non-render callers (event handlers, logs).
 */
export function localReasonLabel(reason, tr = translate) {
    switch (reason) {
        case undefined:
        case 'not-scanned':
            return tr('error.reason.notScanned');
        case 'disabled':
            return tr('error.reason.disabled');
        case 'no-session-logs':
            return tr('error.reason.noSessionLogs');
        case 'zstd-unavailable':
            return tr('error.reason.zstd');
        case 'restored-empty':
            return tr('error.reason.restoredEmpty');
        case 'no-usage-in-window':
            return tr('error.reason.noUsageInWindow');
        case 'session-log-read-failed':
            return tr('error.reason.sessionLogReadFailed');
        default:
            return reason.startsWith('sessions-dir-unreadable')
                ? tr('error.reason.sessionsDir')
                : tr('error.reason.readFailed');
    }
}
/** Exact format: `1234567` → `1,234,567`. */
export function formatFull(n) {
    if (!Number.isFinite(n))
        return '0';
    const neg = n < 0;
    const s = group(Math.abs(Math.trunc(n)).toString());
    return neg ? `-${s}` : s;
}
/**
 * Abbreviated format: `12345678` → `12.3M`. Below an absolute value of 100 keep one decimal
 * (12.3M / 45.6K), at 100 or more round to an integer (320K), drop a trailing `.0` (2M), and
 * below 1000 print as-is.
 */
export function formatShort(n) {
    if (!Number.isFinite(n))
        return '0';
    const neg = n < 0;
    const abs = Math.abs(n);
    const units = [
        [1e9, 'B'],
        [1e6, 'M'],
        [1e3, 'K'],
    ];
    for (const [div, suffix] of units) {
        if (abs >= div) {
            const v = abs / div;
            const s = v < 100 ? v.toFixed(1).replace(/\.0$/, '') : String(Math.round(v));
            return (neg ? '-' : '') + s + suffix;
        }
    }
    return (neg ? '-' : '') + String(Math.trunc(abs));
}
export function formatNumber(n, mode) {
    return mode === 'short' ? formatShort(n) : formatFull(n);
}
/**
 * Exact money: `¥172.48` / `¥675.73521086` — up to 8 decimals with trailing zeros trimmed. The
 * API's per-unit prices go down to 1e-8, and the summed remainder has to be visible in tooltips
 * to reconcile against the official bill.
 */
export function formatMoneyFull(n) {
    if (!Number.isFinite(n))
        return '¥0';
    const neg = n < 0;
    const abs = Math.abs(n);
    const s = abs.toFixed(8).replace(/\.?0+$/, '');
    const [int, frac] = s.split('.');
    return `${neg ? '-' : ''}¥${group(int)}${frac ? `.${frac}` : ''}`;
}
/** Display money: always two decimals (cents) with thousand separators. */
export function formatMoney(n) {
    if (!Number.isFinite(n))
        return '¥0.00';
    const neg = n < 0;
    const [int, frac] = Math.abs(n).toFixed(2).split('.');
    return `${neg ? '-' : ''}¥${group(int)}.${frac}`;
}
/**
 * Abbreviated money: Chinese scales by 1e4 / 1e8, English by 1e3 / 1e6 (`¥12.3K`, `¥1.2M`).
 * English must not reuse the Chinese scale: 1e8 is not B there (billion is 1e9). Both suffixes
 * come from the dictionary, and below the smallest step it falls back to the exact two-decimal
 * form, which reads better than a fraction of that step.
 *
 * `t` is not a parameter: many callers and the scale itself depends on the language, so the
 * language is read once per call via `getLang()` and components re-render on a language change.
 */
export function formatMoneyShort(n) {
    if (!Number.isFinite(n))
        return '¥0';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    const en = getLang() === 'en';
    const big = en ? 1e6 : 1e8;
    const small = en ? 1e3 : 1e4;
    if (abs >= big)
        return `${sign}¥${scaledMoney(abs / big)}${translate('money.shortBig')}`;
    if (abs >= small)
        return `${sign}¥${scaledMoney(abs / small)}${translate('money.shortSmall')}`;
    return formatMoney(n);
}
/** Scaled money digit form: below 100 keep two decimals and trim trailing zeros, otherwise round. */
function scaledMoney(v) {
    return v < 100 ? v.toFixed(2).replace(/\.?0+$/, '') : String(Math.round(v));
}
export function formatMoneyBy(n, mode) {
    return mode === 'short' ? formatMoneyShort(n) : formatMoney(n);
}
/** Exact text for hover tooltips. */
export function tooltipOf(n) {
    return formatFull(n);
}
//# sourceMappingURL=format.js.map