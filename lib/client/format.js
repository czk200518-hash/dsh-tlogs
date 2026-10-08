/**
 * tlogs — 数字格式化（需求 1.3「数字使用千分位或 K/M/B 缩写，hover 显示精确值」）。
 *
 * 纯函数：不碰 DOM、不渲染组件，只按当前语言产出字符串（金额档位、原因标签走
 * `i18n/index.js`）。因此可以在单测里直接调用 —— 注意语言是从环境解析的，
 * Node 里 `navigator.language` 是 en-US，所以单测要断言中文得先 `setLangPref('zh')`。
 */
import { getLang, t as translate } from './i18n/index.js';
/**
 * 本机口径不可用的原因（英文枚举，来自 host 侧 `SessionUsageStore`）转成一句人话。
 *
 * 放在这里而不是某个组件里：展开面板与详细数据的「供应商」页签都要用，
 * 两处文案必须一致（同一个原因在两处显示不同的说法只会让人更困惑）。
 *
 * `tr` 之所以是参数：渲染路径必须传组件里的 `t`（`useT()`），否则切语言时这句
 * 不会跟着变；缺省值是模块级 `t`，给非渲染调用方（事件回调、日志）一个合理兜底。
 */
export function localReasonLabel(reason, tr = translate) {
    switch (reason) {
        case undefined:
            return tr('error.reason.notScanned');
        case 'disabled':
            return tr('error.reason.disabled');
        case 'no-session-logs':
            return tr('error.reason.noSessionLogs');
        case 'zstd-unavailable':
            return tr('error.reason.zstd');
        case 'not-scanned':
            return tr('error.reason.notScanned');
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
/** 千分位精确格式：`1234567` → `1,234,567`。 */
export function formatFull(n) {
    if (!Number.isFinite(n))
        return '0';
    const neg = n < 0;
    const abs = Math.abs(Math.trunc(n));
    const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return neg ? `-${s}` : s;
}
/**
 * 缩写格式：`12345678` → `12.3M`。
 *
 * 规则（与需求 1.2 的紧凑条示例对齐；总计的标签是「总」，不使用求和符号）：
 *  - 数值绝对值 < 100 时保留 1 位小数（12.3M / 45.6K）
 *  - >= 100 时取整（320K）
 *  - 结尾的 `.0` 去掉（2.0M → 2M）
 *  - 小于 1000 时原样输出
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
/** 按配置选择格式。 */
export function formatNumber(n, mode) {
    return mode === 'short' ? formatShort(n) : formatFull(n);
}
/* ------------------------------------------------------------------ *
 * 金额
 * ------------------------------------------------------------------ */
/** 给整数部分加千分位。 */
function group(intPart) {
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
/**
 * 金额的**精确**写法：`¥172.48` / `¥675.73521086`。
 *
 * 最多保留 8 位小数并去掉尾随 0 —— 接口给的单价能细到 1e-8，逐月相加的尾数
 * 在 tooltip 里如实呈现，才便于和官方账单对账。
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
/** 金额的展示写法：固定两位小数（分），带千分位。 */
export function formatMoney(n) {
    if (!Number.isFinite(n))
        return '¥0.00';
    const neg = n < 0;
    const [int, frac] = Math.abs(n).toFixed(2).split('.');
    return `${neg ? '-' : ''}¥${group(int)}.${frac}`;
}
/**
 * 金额的缩写写法：中文 `¥1.23万` / `¥1.2亿`，英文 `¥12.3K` / `¥1.2M`。
 *
 * 中文习惯用「万 / 亿」而不是 K/M；英文里 1e8 也不是 B（billion = 1e9），
 * 所以两套缩放阈值按语言分开，后缀走字典（`money.shortSmall` / `money.shortBig`）。
 * 不足一档时退回两位小数的精确写法（`¥172.48` 比 `¥0.02万` 好读得多）。
 *
 * 这里不把 `t` 当参数：调用方很多（含详细数据弹窗），而**缩放阈值本身**也要跟着
 * 语言走，于是统一在调用时读一次 `getLang()`。组件渲染时每次重渲染都会重新调用本函数，
 * 因此切语言后显示会跟着更新。
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
/** 万 / 亿（K / M）档位的数字写法：< 100 保留两位小数并去掉尾随 0，否则取整。 */
function scaledMoney(v) {
    return v < 100 ? v.toFixed(2).replace(/\.?0+$/, '') : String(Math.round(v));
}
/** 按配置选择金额格式。 */
export function formatMoneyBy(n, mode) {
    return mode === 'short' ? formatMoneyShort(n) : formatMoney(n);
}
/** hover tooltip 用的完整文案（永远精确）。 */
export function tooltipOf(n) {
    return formatFull(n);
}
//# sourceMappingURL=format.js.map