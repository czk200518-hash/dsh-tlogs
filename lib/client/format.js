/**
 * tlogs — 数字格式化（需求 1.3「数字使用千分位或 K/M/B 缩写，hover 显示精确值」）。
 *
 * 纯函数，无 DOM/React 依赖，便于单测。
 */
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
 * 规则（与需求 1.2 的紧凑条示例对齐；注意**已不再使用 Σ**，总计的标签是「总」）：
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
/** hover tooltip 用的完整文案（永远精确）。 */
export function tooltipOf(n) {
    return formatFull(n);
}
//# sourceMappingURL=format.js.map