/**
 * tlogs — 日期窗口工具：把接口的 `days[].date`（`2026-10-01` 这种）切成「今日 / 当周 / 当月」等范围。
 *
 * 平台按 UTC 日切桶，日界是 00:00 UTC（北京时间 08:00）；接口只给「日」粒度，没有日内分辨率，
 * 所以本地日历日无法还原，这里一律按平台日（UTC）切片，历史拉取的月份边界同样按 UTC
 * （见 `store/history.ts` 的 `utcYearMonth`）。所以下面的日期计算都不能换成 `getFullYear` /
 * `setHours` 这类本地版本：换成本地后，北京时间 00:00–08:00 的 `todayWindow()` 会指向平台尚未
 * 开始的桶，而平台把整月每一天都预建了空条目，于是「今日」不会报无数据，只会安静地显示 0。
 */

/** 平台日历日键（UTC）：`YYYY-MM-DD`。 */
export function dateKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 平台当天 00:00:00.000（UTC）。 */
export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

/**
 * 平台当周周一 00:00:00.000（UTC）。「当周消耗」的口径是本周一 00:00 起算，按平台日即
 * 周一 00:00 UTC。
 */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  // getUTCDay(): 0=周日 … 6=周六；换算成距本周一的天数。
  const dow = x.getUTCDay()
  const back = dow === 0 ? 6 : dow - 1
  x.setUTCDate(x.getUTCDate() - back)
  return x
}

/** 平台当月 1 日 00:00:00.000（UTC）。 */
export function startOfMonth(d: Date): Date {
  const x = startOfDay(d)
  x.setUTCDate(1)
  return x
}

/** 一个查询窗口，含首尾两端。 */
export interface DateWindow {
  /** 起始日（含），`YYYY-MM-DD`。 */
  from: string
  /** 结束日（含），`YYYY-MM-DD`。 */
  to: string
}

/** 今日窗口。 */
export function todayWindow(now: Date = new Date()): DateWindow {
  return { from: dateKey(startOfDay(now)), to: dateKey(now) }
}

/** 当周窗口：本周一 00:00（平台日）至今。 */
export function weekWindow(now: Date = new Date()): DateWindow {
  return { from: dateKey(startOfWeek(now)), to: dateKey(now) }
}

/** 当月窗口：本月 1 日 00:00（平台日）至今。 */
export function monthWindow(now: Date = new Date()): DateWindow {
  return { from: dateKey(startOfMonth(now)), to: dateKey(now) }
}

/**
 * 最近 `days` 个平台日，含今天：`rollingWindow(7, now)` → `[today-6, today]`。与控制台
 * 「近 7 天 / 近 30 天」对应，不受星期与自然月边界约束，因此可能跨月（例如 3 月 1 日的
 * 「近 30 天」会落到 1 月 31 日）；`weekWindow` 才是本周一起算。
 */
export function rollingWindow(days: number, now: Date = new Date()): DateWindow {
  const span = Math.max(1, Math.trunc(days))
  const x = startOfDay(now)
  x.setUTCDate(x.getUTCDate() - (span - 1))
  return { from: dateKey(x), to: dateKey(now) }
}

/** 日期键是否落在窗口内（键是定长 `YYYY-MM-DD`，可直接按字符串比较）。 */
export function inWindow(key: string, w: DateWindow): boolean {
  return key >= w.from && key <= w.to
}
