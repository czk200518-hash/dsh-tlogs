/**
 * tlogs — 图表纯函数（无 React、无 DOM，可单测）。
 *
 * 分成两层：这一层只做**数据 → 几何**的换算（分桶、刻度、路径、弧长），
 * charts.tsx 只负责把它们渲染成 SVG。之所以拆开，是因为这些换算是图表里唯一
 * 会算错的地方（刻度不整、首尾点被裁掉、单色饼图画不出来），必须能单独钉住。
 *
 * 依赖策略：**不引入任何图表库**。客户端 bundle 只允许 require 平台种子表里的
 * react，任何图表库都得整包打进来（几百 KB），而这里需要的不过是几条 path。
 */

import { inputTokens, outputTokens } from '../api/parser.js'
import type { SeriesPoint, Stat } from '../types.js'

/** 指标的计量单位。`money` 走金额格式化（`¥12.34`），不能按 token 缩写。 */
export type MetricUnit = 'tokens' | 'requests' | 'money'

/** 可切换的指标。 */
export type ChartMetric =
  | 'total'
  | 'input'
  | 'output'
  | 'cacheHit'
  | 'cacheMiss'
  | 'requests'
  | 'cost'

/** 可选的粒度（auto 由范围跨度决定）。 */
export type ChartGrain = 'auto' | 'day' | 'month' | 'year'

/** 解析后的粒度。 */
export type ResolvedGrain = 'day' | 'month' | 'year'

export const METRICS: ReadonlyArray<{ id: ChartMetric; label: string; unit: MetricUnit }> = [
  { id: 'total', label: '总 Token', unit: 'tokens' },
  { id: 'input', label: '输入', unit: 'tokens' },
  { id: 'output', label: '输出', unit: 'tokens' },
  { id: 'cacheHit', label: '缓存命中', unit: 'tokens' },
  { id: 'cacheMiss', label: '缓存未命中', unit: 'tokens' },
  { id: 'requests', label: '请求数', unit: 'requests' },
  { id: 'cost', label: '消费金额 (¥)', unit: 'money' },
]

export const GRAINS: ReadonlyArray<{ id: ChartGrain; label: string }> = [
  { id: 'auto', label: '自动' },
  { id: 'day', label: '按天' },
  { id: 'month', label: '按月' },
  { id: 'year', label: '按年' },
]

/** 从原始五类计量项里取出某个指标的数值。 */
export function metricValue(stat: Stat, metric: ChartMetric): number {
  switch (metric) {
    case 'total':
      return inputTokens(stat) + outputTokens(stat)
    case 'input':
      return inputTokens(stat)
    case 'output':
      return outputTokens(stat)
    case 'cacheHit':
      return stat.PROMPT_CACHE_HIT_TOKEN
    case 'cacheMiss':
      return stat.PROMPT_CACHE_MISS_TOKEN
    case 'requests':
      return stat.REQUEST
    // 金额不在 Stat 里（它是另一套 Money 结构），必须由 bucket 携带。
    case 'cost':
      return 0
    default:
      return 0
  }
}

/**
 * 单位后缀。金额用「元」，请求用「次」，token 无后缀。
 *
 * 原先只有 tokens/requests 两种，金额被并进 tokens 分支后会显示成
 * 「172」而不是「¥172.48」—— 这正是要单独分一支的原因。
 */
export function metricSuffix(unit: MetricUnit): string {
  if (unit === 'requests') return ' 次'
  if (unit === 'money') return ' 元'
  return ''
}

/** 图表里的一个时间桶。 */
export interface Bucket {
  /** 桶键：`YYYY-MM-DD` / `YYYY-MM` / `YYYY`。 */
  key: string
  /** 轴上的短标签。 */
  label: string
  /** 完整标签（tooltip 用）。 */
  full: string
  stat: Stat
  /**
   * 该桶的消费金额（CNY 元）。
   *
   * 金额**不放进 `stat`**：`stat` 是整数计数，而金额是小数，混进去会让
   * `metricValue` 的类型假设失效。缺省表示这一段没有金额数据（≠ 花了 0 元）。
   */
  cost?: number
  /**
   * 该桶是否**完全没数据**（补齐出来的空天）。
   * 用于区分「真的是 0」和「这段时间没拉到」。
   */
  empty: boolean
}

/**
 * 图表组件真正消费的点：桶 + 已选定指标的数值。
 *
 * 由面板层一次性算好，三个图组件就不再各自知道「指标」这回事，
 * 也不需要在组件里再取一次值（避免图和汇总用不同口径）。
 */
export interface ChartPoint {
  key: string
  label: string
  full: string
  value: number
  stat: Stat
  empty: boolean
}

/** 把桶 + 已算好的数值折成图表点。 */
export function toPoints(buckets: Bucket[], values: number[]): ChartPoint[] {
  return buckets.map((b, i) => ({
    key: b.key,
    label: b.label,
    full: b.full,
    value: values[i] ?? 0,
    stat: b.stat,
    empty: b.empty,
  }))
}

/** 解析 `YYYY-MM-DD` / `YYYY-MM` / `YYYY` 成 UTC 毫秒；非法返回 NaN。 */
function parseKeyMs(key: string): number {
  const parts = key.split('-')
  const y = Number(parts[0])
  if (!Number.isFinite(y)) return NaN
  const m = parts.length > 1 ? Number(parts[1]) : 1
  const d = parts.length > 2 ? Number(parts[2]) : 1
  return Date.UTC(y, m - 1, d)
}

/** 两个日期键之间相差多少天（含首尾）。 */
export function spanDays(from: string, to: string): number {
  const a = parseKeyMs(from)
  const b = parseKeyMs(to)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.floor((b - a) / 86_400_000) + 1
}

/**
 * 由范围跨度选择粒度。
 *
 * 阈值：≤ 92 天（约一季度）按天；≤ 1100 天（约三年）按月；更长按年。
 * 这样「今日/本周/本月」天然是按天，「有史以来」天然是按月。
 */
export function autoGrain(from: string, to: string): ResolvedGrain {
  const days = spanDays(from, to)
  if (days <= 92) return 'day'
  if (days <= 1100) return 'month'
  return 'year'
}

/** 解析粒度。 */
export function resolveGrain(grain: ChartGrain, from: string, to: string): ResolvedGrain {
  return grain === 'auto' ? autoGrain(from, to) : grain
}

/** 补齐用：某天的空 Stat。 */
function zeroStat(): Stat {
  return {
    PROMPT_TOKEN: 0,
    PROMPT_CACHE_HIT_TOKEN: 0,
    PROMPT_CACHE_MISS_TOKEN: 0,
    RESPONSE_TOKEN: 0,
    REQUEST: 0,
  }
}

/**
 * 天粒度的桶：**按范围补齐每一天**。
 *
 * 为什么要补空格：折线图的 x 轴必须等距，否则「中间空了 5 天」会画成相邻两点，
 * 读起来像那 5 天不存在。缺的天补 0 并标记 `empty`，图上表现为落到 0。
 *
 * 跨度超过 {@link MAX_FILL_DAYS} 时不再补齐 —— 那种范围本该用月/年粒度，
 * 真按天铺开会有几千个点（SVG 与 hover 命中区都扛不住）。
 */
export const MAX_FILL_DAYS = 400

export function dayBuckets(
  days: Array<{ date: string; stat: Stat; cost?: number }>,
  from: string,
  to: string,
): Bucket[] {
  const byDate = new Map<string, { stat: Stat; cost?: number }>()
  for (const d of days) byDate.set(d.date, { stat: d.stat, cost: d.cost })

  const span = spanDays(from, to)
  if (span <= 0) return []
  if (span > MAX_FILL_DAYS) {
    // 不补齐：只画真的有数据的天（保持升序）。
    return [...byDate.entries()]
      .filter(([date]) => date >= from && date <= to)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => makeBucket(date, 'day', v.stat, true, v.cost))
  }

  const out: Bucket[] = []
  const start = parseKeyMs(from)
  for (let i = 0; i < span; i++) {
    const d = new Date(start + i * 86_400_000)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`
    if (key > to) break
    const v = byDate.get(key)
    out.push(v ? makeBucket(key, 'day', v.stat, true, v.cost) : makeBucket(key, 'day', zeroStat(), false))
  }
  return out
}

/**
 * 月粒度的桶：直接使用 host 下发的**月度合计**。
 *
 * 关键：绝不能把逐日明细按月相加 —— 没抓到 `days` 的月份会因此被严重低估
 * （实测 31 个月里只有 2 个有逐日明细）。月度合计始终完整。
 */
export function monthBuckets(months: SeriesPoint[]): Bucket[] {
  return [...months]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((p) => makeBucket(p.key, 'month', p.stat, false, p.cost))
}

/** 年粒度的桶：由月度合计按年汇总。 */
export function yearBuckets(months: SeriesPoint[]): Bucket[] {
  const acc = new Map<string, Stat>()
  const costs = new Map<string, number>()
  for (const p of months) {
    const year = p.key.slice(0, 4)
    let target = acc.get(year)
    if (!target) {
      target = zeroStat()
      acc.set(year, target)
    }
    target.PROMPT_TOKEN += p.stat.PROMPT_TOKEN
    target.PROMPT_CACHE_HIT_TOKEN += p.stat.PROMPT_CACHE_HIT_TOKEN
    target.PROMPT_CACHE_MISS_TOKEN += p.stat.PROMPT_CACHE_MISS_TOKEN
    target.RESPONSE_TOKEN += p.stat.RESPONSE_TOKEN
    target.REQUEST += p.stat.REQUEST
    if (p.cost !== undefined) costs.set(year, (costs.get(year) ?? 0) + p.cost)
  }
  return [...acc.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, stat]) => makeBucket(year, 'year', stat, false, costs.get(year)))
}

function makeBucket(
  key: string,
  grain: ResolvedGrain,
  stat: Stat,
  filled: boolean,
  cost?: number,
): Bucket {
  const empty = stat.PROMPT_TOKEN === 0
    && stat.PROMPT_CACHE_HIT_TOKEN === 0
    && stat.PROMPT_CACHE_MISS_TOKEN === 0
    && stat.RESPONSE_TOKEN === 0
    && stat.REQUEST === 0
  const b: Bucket = {
    key,
    label: shortLabel(key, grain),
    full: key,
    stat: { ...stat },
    // 「补齐的空天」与「真的有数据但为 0」在图上都画成 0，但只有前者算 empty。
    empty: empty && !filled,
  }
  if (cost !== undefined) b.cost = cost
  return b
}

/** 轴上的短标签。 */
export function shortLabel(key: string, grain: ResolvedGrain): string {
  if (grain === 'year') return key.slice(0, 4)
  if (grain === 'month') return key.slice(2) // YY-MM
  return key.slice(5) // MM-DD
}

/**
 * 折线图点的取值（可切「每期」/「累计」）。
 *
 * 累计模式下起点是 `prior`（范围内首日之前的全部用量），否则「累计」曲线会从 0
 * 起跳，看上去像那段时间的用量凭空出现。
 *
 * 金额走 `bucketMetricValue`：它读的是桶上的 `cost`，不在 `stat` 里。
 */
export function bucketValues(
  buckets: Bucket[],
  metric: ChartMetric,
  mode: 'perBucket' | 'cumulative',
  prior: number,
): number[] {
  const raw = buckets.map((b) => bucketMetricValue(b, metric))
  if (mode === 'perBucket') return raw
  let acc = prior
  return raw.map((v) => {
    acc += v
    return acc
  })
}

/**
 * 从桶里取指标值：金额读 `bucket.cost`，其余读 `stat`。
 *
 * 图表里所有取值都必须经过这里 —— 直接调 `metricValue(bucket.stat, metric)`
 * 拿金额会永远得到 0（金额不在 `stat` 里）。
 */
export function bucketMetricValue(bucket: Bucket, metric: ChartMetric): number {
  if (metric === 'cost') return bucket.cost ?? 0
  return metricValue(bucket.stat, metric)
}

/**
 * 「好看」的刻度值（0, step, 2*step … ≥ max）。
 *
 * 直接用 max/4 当步长会得到 8237101 这种刻度；这里把步长吸附到 1/2/5×10^n。
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1]
  const rough = max / Math.max(1, count)
  const exp = Math.floor(Math.log10(rough))
  const pow = Math.pow(10, exp)
  const f = rough / pow
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  const step = nice * pow
  const out: number[] = []
  for (let v = 0; v <= max + step * 0.5; v += step) out.push(round(v))
  if (out.length < 2) out.push(round(step))
  return out
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/** 折线路径（`M x y L …`）。坐标保留两位小数，避免超长字符串。 */
export function linePath(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return ''
  const pts = pointsOf(values, width, height, max)
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')
}

/** 面积路径（折线 + 底部闭合）。 */
export function areaPath(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return ''
  const pts = pointsOf(values, width, height, max)
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  return `${linePath(values, width, height, max)} L${last[0]} ${height} L${first[0]} ${height} Z`
}

/** 每个点的坐标（暴露出来供渲染圆点/参考线复用，保证与折线完全一致）。 */
export function pointsOf(
  values: number[],
  width: number,
  height: number,
  max: number,
): Array<[number, number]> {
  const n = values.length
  const safeMax = max > 0 ? max : 1
  const x = (i: number): number => (n <= 1 ? width / 2 : (i / (n - 1)) * width)
  const y = (v: number): number => height - (Math.max(0, v) / safeMax) * height
  return values.map((v, i) => [round2(x(i)), round2(y(v))])
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 堆叠柱的一根柱子。 */
export interface StackBar {
  key: string
  label: string
  full: string
  /** 三段：缓存命中 / 缓存未命中 / 输出。 */
  parts: [number, number, number]
  total: number
  requests: number
}

/**
 * 堆叠柱的桶：输入分「缓存命中 / 未命中」，再加输出。
 *
 * 三段堆起来的高度 = 总 Token；这样一眼能看出用量里有多少是缓存命中的便宜输入。
 */
export function stackBars(buckets: Bucket[]): StackBar[] {
  return buckets.map((b) => {
    const hit = b.stat.PROMPT_CACHE_HIT_TOKEN
    const miss = b.stat.PROMPT_CACHE_MISS_TOKEN + b.stat.PROMPT_TOKEN
    const out = b.stat.RESPONSE_TOKEN
    return {
      key: b.key,
      label: b.label,
      full: b.full,
      parts: [hit, miss, out],
      total: hit + miss + out,
      requests: b.stat.REQUEST,
    }
  })
}

/** 饼图切片的配色下标。 */
export interface PieSlice {
  key: string
  label: string
  value: number
  percent: number
  colorIndex: number
}

/**
 * 把若干「构成项」整理成饼图切片。
 *
 * - 过滤掉 0（否则图例里会出现 0% 的噪声项）
 * - 降序排列，保留前 `maxSlices - 1` 项，其余合并为「其他」
 *   （模型可能有几十个，全画上去图例比图还长）
 */
export function pieSlices(
  items: Array<{ key: string; label: string; value: number }>,
  maxSlices = 8,
  otherLabel = '其他',
): PieSlice[] {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  const total = positive.reduce((s, i) => s + i.value, 0)
  if (total <= 0) return []

  let head = positive
  let tail: Array<{ key: string; label: string; value: number }> = []
  if (positive.length > maxSlices) {
    head = positive.slice(0, maxSlices - 1)
    tail = positive.slice(maxSlices - 1)
  }

  const slices: PieSlice[] = head.map((i, idx) => ({
    key: i.key,
    label: i.label,
    value: i.value,
    percent: i.value / total,
    colorIndex: idx,
  }))
  if (tail.length > 0) {
    const sum = tail.reduce((s, i) => s + i.value, 0)
    slices.push({
      key: '__other__',
      label: otherLabel,
      value: sum,
      percent: sum / total,
      colorIndex: slices.length,
    })
  }
  return slices
}

/** 环形图的一段弧：用 stroke-dasharray/offset 画，天然支持「只剩一段」的 360°。 */
export function donutSegment(
  value: number,
  total: number,
  radius: number,
  before = 0,
): { dasharray: string; dashoffset: string; circumference: number } {
  const circumference = 2 * Math.PI * radius
  if (!(total > 0) || !(value > 0)) {
    return { dasharray: `0 ${round2(circumference)}`, dashoffset: '0', circumference }
  }
  const len = (value / total) * circumference
  return {
    dasharray: `${round2(len)} ${round2(circumference - len)}`,
    dashoffset: `${round2(-(before / total) * circumference)}`,
    circumference,
  }
}

/** x 轴采样：最多 `max` 个标签，避免挤成一团。 */
export function labelIndices(count: number, max = 7): Set<number> {
  const out = new Set<number>()
  if (count <= 0) return out
  if (count <= max) {
    for (let i = 0; i < count; i++) out.add(i)
    return out
  }
  const step = Math.ceil((count - 1) / (max - 1))
  const picked: number[] = []
  for (let i = 0; i < count - 1; i += step) picked.push(i)
  // 末尾那个桶单独补：否则轴上最后一个标签会落在倒数第 step 个桶上，
  // 让用户以为数据到那儿就没了。若它离前一个太近（会叠字），就牺牲前一个。
  const last = picked[picked.length - 1]
  if (last !== undefined && count - 1 - last < step * 0.6 && picked.length > 1) picked.pop()
  for (const i of picked) out.add(i)
  out.add(count - 1)
  return out
}

/** 一组数值里的最大值（用于 y 轴上限）；空数组返回 0。 */
export function maxOf(values: number[]): number {
  let max = 0
  for (const v of values) if (Number.isFinite(v) && v > max) max = v
  return max
}

/**
 * 每个点的悬停命中区间 `[x0, x1]`。
 *
 * 折线图只有一个点、或点很密的时候，「只命中那个 3px 的圆点」是没法用的；
 * 因此把相邻两点的中垂线当作边界，首尾各延伸到画布边缘 —— 鼠标落在任意横向位置
 * 都必然命中恰好一个点（还杜绝了区间之间出现缝隙无法命中的情况）。
 */
export function hitSpans(
  xs: Array<[number, number]>,
  width: number,
): Array<[number, number]> {
  const n = xs.length
  if (n === 0) return []
  if (n === 1) return [[0, width]]
  // bounds[i] 是第 i 个点区间的左边界；首尾固定贴画布两端。
  const bounds: number[] = [0]
  for (let i = 1; i < n; i++) bounds.push((xs[i - 1]![0] + xs[i]![0]) / 2)
  bounds.push(width)
  return xs.map((_, i) => [bounds[i]!, bounds[i + 1]!])
}

/**
 * 项目快照 → 桶。
 *
 * 项目维度没有「逐月合计」可用（宿主只给累计值），所以桶就是快照本身：
 *  - `cumulative`：直接用快照值（真实累计曲线，不需要任何假设）
 *  - `perBucket`：相邻两次快照之差，即「这段时间新增」
 *
 * 「每期」模式下第一个点的基线：若范围内首点之前还有快照（`prior`），差值才准确；
 * 没有更早的快照就退化为「首点自身」——那是该项目自插件启用以来的全部增量，
 * 会显得偏高，这一点由 UI 的说明文字交代。
 *
 * 差值一律**钳到 ≥ 0**：累计值偶尔会因宿主侧会话数据被清理而回退，
 * 负的柱子/负的用量没有任何意义。
 */
export function projectBuckets(
  points: Array<{ date: string; stat: Stat }>,
  prior: Stat | undefined,
  mode: 'perBucket' | 'cumulative',
): Bucket[] {
  if (mode === 'cumulative') {
    return points.map((p) => makeBucket(p.date, 'day', p.stat, true))
  }
  let prev = prior ? { ...prior } : undefined
  const out: Bucket[] = []
  for (const p of points) {
    const delta = zeroStat()
    if (prev) {
      delta.PROMPT_CACHE_HIT_TOKEN = Math.max(0, p.stat.PROMPT_CACHE_HIT_TOKEN - prev.PROMPT_CACHE_HIT_TOKEN)
      delta.PROMPT_CACHE_MISS_TOKEN = Math.max(0, p.stat.PROMPT_CACHE_MISS_TOKEN - prev.PROMPT_CACHE_MISS_TOKEN)
      delta.PROMPT_TOKEN = Math.max(0, p.stat.PROMPT_TOKEN - prev.PROMPT_TOKEN)
      delta.RESPONSE_TOKEN = Math.max(0, p.stat.RESPONSE_TOKEN - prev.RESPONSE_TOKEN)
      delta.REQUEST = Math.max(0, p.stat.REQUEST - prev.REQUEST)
    } else {
      delta.PROMPT_CACHE_HIT_TOKEN = p.stat.PROMPT_CACHE_HIT_TOKEN
      delta.PROMPT_CACHE_MISS_TOKEN = p.stat.PROMPT_CACHE_MISS_TOKEN
      delta.PROMPT_TOKEN = p.stat.PROMPT_TOKEN
      delta.RESPONSE_TOKEN = p.stat.RESPONSE_TOKEN
      delta.REQUEST = p.stat.REQUEST
    }
    out.push(makeBucket(p.date, 'day', delta, false))
    prev = p.stat
  }
  return out
}
