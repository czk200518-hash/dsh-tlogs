/**
 * tlogs — 本地日历日期工具。
 *
 * 用途：把接口返回的 `days[].date`（形如 `2026-10-01`）切片成
 * 「今日 / 当周 / 当月」三个范围（需求 1.3）。
 *
 * 口径说明（重要假设，已在 README 中声明）：
 *  - 接口返回的日期是**平台侧日历日的标签**，不带时区信息。
 *  - 本插件按**本机本地日历**与之比较。对 GMT+8 用户（平台所在地时区）
 *    两者一致；跨时区用户可能在上下午边界看到一天的偏差。
 *  - 历史全量拉取的**月份边界**则严格跟随 Python 脚本的 UTC 口径
 *    （见 store/history.ts 的 utcYearMonth），以保证与脚本逐月对拍一致。
 */
/** 本地日历日键：`YYYY-MM-DD`。 */
export function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/** 本地当天 00:00:00.000。 */
export function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
/**
 * 本地当周周一 00:00:00.000。
 * 对应需求 1.3「当周消耗：本周一 00:00 至今」。
 */
export function startOfWeek(d) {
    const x = startOfDay(d);
    // getDay(): 0=周日 … 6=周六；换算成「距离本周一的天数」。
    const dow = x.getDay();
    const back = dow === 0 ? 6 : dow - 1;
    x.setDate(x.getDate() - back);
    return x;
}
/** 本地当月 1 日 00:00:00.000。 */
export function startOfMonth(d) {
    const x = startOfDay(d);
    x.setDate(1);
    return x;
}
/** 今日窗口。 */
export function todayWindow(now = new Date()) {
    return { from: dateKey(startOfDay(now)), to: dateKey(now) };
}
/** 当周窗口（周一至今）。 */
export function weekWindow(now = new Date()) {
    return { from: dateKey(startOfWeek(now)), to: dateKey(now) };
}
/** 当月窗口（1 日至今）。 */
export function monthWindow(now = new Date()) {
    return { from: dateKey(startOfMonth(now)), to: dateKey(now) };
}
/** 判断日期键是否落在窗口内。 */
export function inWindow(key, w) {
    return key >= w.from && key <= w.to;
}
//# sourceMappingURL=dates.js.map