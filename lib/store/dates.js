/**
 * tlogs — 平台日历日期工具。
 *
 * 用途：把接口返回的 `days[].date`（形如 `2026-10-01`）切片成
 * 「今日 / 当周 / 当月」三个范围（需求 1.3）。
 *
 * 口径（2026-10 实测确定）：
 *  - 平台接口的 `days[]` 按 **UTC 日**切桶，日界是 00:00 UTC（= 北京时间 08:00）。
 *    实测：北京时间 2026-10-08 00:20 仍在持续对话，用量全部记进桶 `2026-10-07`
 *    （30 秒内 +5,110,422），而桶 `2026-10-08` 恒为 0。
 *  - 接口只提供「日」粒度，**没有日内分辨率**，所以「本地日历日」在数据上
 *    无法还原。本模块一律按**平台日（UTC）**切片，使数字与平台口径一致。
 *  - 历史全量拉取的月份边界同样按 UTC（见 `store/history.ts` 的 `utcYearMonth`），
 *    与 Python 脚本的 `datetime.now(timezone.utc)`（py:141）逐月对拍一致。
 *
 * ⚠️ 不要把下面任何 `getUTC*` / `setUTC*` 改回本地版。改回后每天
 * 北京时间 00:00–08:00，`todayWindow()` 会指向一个平台尚未开始的桶（全 0），
 * 「今日」与「今日请求」都会显示 0 —— 而平台把整月 31 天都预建了空条目，
 * 所以这个错误不会报「无数据」，只会安静地显示 0。
 */
/** 平台日历日键（UTC）：`YYYY-MM-DD`。 */
export function dateKey(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/** 平台当天 00:00:00.000（UTC）。 */
export function startOfDay(d) {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
}
/**
 * 平台当周周一 00:00:00.000（UTC）。
 * 对应需求 1.3「当周消耗：本周一 00:00 至今」——按平台日口径即周一 00:00 UTC。
 */
export function startOfWeek(d) {
    const x = startOfDay(d);
    // getUTCDay(): 0=周日 … 6=周六；换算成「距离本周一的天数」。
    const dow = x.getUTCDay();
    const back = dow === 0 ? 6 : dow - 1;
    x.setUTCDate(x.getUTCDate() - back);
    return x;
}
/** 平台当月 1 日 00:00:00.000（UTC）。 */
export function startOfMonth(d) {
    const x = startOfDay(d);
    x.setUTCDate(1);
    return x;
}
/** 今日窗口（平台日）。 */
export function todayWindow(now = new Date()) {
    return { from: dateKey(startOfDay(now)), to: dateKey(now) };
}
/** 当周窗口（平台口径的周一至今）。 */
export function weekWindow(now = new Date()) {
    return { from: dateKey(startOfWeek(now)), to: dateKey(now) };
}
/** 当月窗口（平台口径的 1 日至今）。 */
export function monthWindow(now = new Date()) {
    return { from: dateKey(startOfMonth(now)), to: dateKey(now) };
}
/**
 * 滚动窗口：最近 `days` 个平台日（**含今天**）。
 *
 * `rollingWindow(7, now)` = 今天往前数 7 天（含今天）→ `[today-6, today]`。
 *
 * 与 `weekWindow`（本周一起）刻意区分：这是控制台「近 7 天 / 近 30 天」的口径，
 * 不受星期与自然月边界影响，因此可能**横跨两到三个自然月**
 * （例如 3 月 1 日的「近 30 天」会落到 1 月 31 日）。
 */
export function rollingWindow(days, now = new Date()) {
    const span = Math.max(1, Math.trunc(days));
    const x = startOfDay(now);
    x.setUTCDate(x.getUTCDate() - (span - 1));
    return { from: dateKey(x), to: dateKey(now) };
}
/** 判断日期键是否落在窗口内。 */
export function inWindow(key, w) {
    return key >= w.from && key <= w.to;
}
//# sourceMappingURL=dates.js.map