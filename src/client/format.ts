/**
 * tlogs — 数字格式化（需求 1.3「数字使用千分位或 K/M/B 缩写，hover 显示精确值」）。
 *
 * 纯函数，无 DOM/React 依赖，便于单测。
 */

/**
 * 本机口径不可用的原因（英文枚举，来自 host 侧 `SessionUsageStore`）转成一句人话。
 *
 * 放在这里而不是某个组件里：展开面板与详细数据的「供应商」页签都要用，
 * 两处文案必须一致（同一个原因在两处显示不同的说法只会让人更困惑）。
 */
export function localReasonLabel(reason: string | undefined): string {
  switch (reason) {
    case undefined:
      return '尚未扫描'
    case 'disabled':
      return '配置里已关闭 localUsage'
    case 'no-session-logs':
      return '未找到会话日志（候选目录都不存在）'
    case 'zstd-unavailable':
      return '当前运行时不支持 zstd（需要 Node 22.15+ / 24）'
    case 'not-scanned':
      return '尚未扫描'
    case 'restored-empty':
      return '缓存里没有可用数据'
    case 'no-usage-in-window':
      return '日志里没有窗口内的用量'
    case 'session-log-read-failed':
      return '会话日志读取失败'
    default:
      return reason.startsWith('sessions-dir-unreadable') ? '会话目录不可读' : '读取失败'
  }
}

/** 千分位精确格式：`1234567` → `1,234,567`。 */
export function formatFull(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const neg = n < 0
  const abs = Math.abs(Math.trunc(n))
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return neg ? `-${s}` : s
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
export function formatShort(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const neg = n < 0
  const abs = Math.abs(n)
  const units: Array<[number, string]> = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ]
  for (const [div, suffix] of units) {
    if (abs >= div) {
      const v = abs / div
      const s = v < 100 ? v.toFixed(1).replace(/\.0$/, '') : String(Math.round(v))
      return (neg ? '-' : '') + s + suffix
    }
  }
  return (neg ? '-' : '') + String(Math.trunc(abs))
}

/** 按配置选择格式。 */
export function formatNumber(n: number, mode: 'full' | 'short'): string {
  return mode === 'short' ? formatShort(n) : formatFull(n)
}

/* ------------------------------------------------------------------ *
 * 金额
 * ------------------------------------------------------------------ */

/** 给整数部分加千分位。 */
function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 金额的**精确**写法：`¥172.48` / `¥675.73521086`。
 *
 * 最多保留 8 位小数并去掉尾随 0 —— 接口给的单价能细到 1e-8，逐月相加的尾数
 * 在 tooltip 里如实呈现，才便于和官方账单对账。
 */
export function formatMoneyFull(n: number): string {
  if (!Number.isFinite(n)) return '¥0'
  const neg = n < 0
  const abs = Math.abs(n)
  const s = abs.toFixed(8).replace(/\.?0+$/, '')
  const [int, frac] = s.split('.')
  return `${neg ? '-' : ''}¥${group(int)}${frac ? `.${frac}` : ''}`
}

/** 金额的展示写法：固定两位小数（分），带千分位。 */
export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '¥0.00'
  const neg = n < 0
  const [int, frac] = Math.abs(n).toFixed(2).split('.')
  return `${neg ? '-' : ''}¥${group(int)}.${frac}`
}

/**
 * 金额的缩写写法：`¥1.23万`。
 *
 * 中文习惯用「万」而不是 K/M，因此与 token 的 `formatShort` 分开实现。
 * 不足 1 万时退回两位小数的精确写法（`¥172.48` 比 `¥0.02万` 好读得多）。
 */
export function formatMoneyShort(n: number): string {
  if (!Number.isFinite(n)) return '¥0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e8) return `${sign}¥${(abs / 1e8).toFixed(2).replace(/\.?0+$/, '')}亿`
  if (abs >= 1e4) {
    const wan = abs / 1e4
    const s = wan < 100 ? wan.toFixed(2).replace(/\.?0+$/, '') : String(Math.round(wan))
    return `${sign}¥${s}万`
  }
  return formatMoney(n)
}

/** 按配置选择金额格式。 */
export function formatMoneyBy(n: number, mode: 'full' | 'short'): string {
  return mode === 'short' ? formatMoneyShort(n) : formatMoney(n)
}

/** hover tooltip 用的完整文案（永远精确）。 */
export function tooltipOf(n: number): string {
  return formatFull(n)
}
