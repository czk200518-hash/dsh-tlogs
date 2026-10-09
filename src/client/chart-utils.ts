/**
 * tlogs — chart math (no React, no DOM, unit-testable): data into geometry (buckets, ticks,
 * paths, arc lengths) while charts.tsx only renders SVG. The split matters because these
 * conversions are the only place a chart can be silently wrong, and a chart library is not an
 * option: only react resolves from the platform seed table.
 */

import { inputTokens, outputTokens } from '../api/parser.js'
import { t as translate, type MessageKey } from './i18n/index.js'
import type { SeriesPoint, Stat } from '../types.js'

/** Unit of a metric. `money` is formatted as currency (`¥12.34`), never abbreviated as tokens. */
export type MetricUnit = 'tokens' | 'requests' | 'money'

export type ChartMetric =
  | 'total'
  | 'input'
  | 'output'
  | 'cacheHit'
  | 'cacheMiss'
  | 'requests'
  | 'cost'

/** Grain; `auto` is resolved from the range span. */
export type ChartGrain = 'auto' | 'day' | 'month' | 'year'

export type ResolvedGrain = 'day' | 'month' | 'year'

/**
 * The metric table stores keys, not labels: labels are translated at render time so they follow
 * the language. The token labels reuse `stat.*` because the calendar summary and table headers
 * use the same words — one key, one wording.
 */
export const METRICS: ReadonlyArray<{ id: ChartMetric; labelKey: MessageKey; unit: MetricUnit }> = [
  { id: 'total', labelKey: 'stat.totalTokens', unit: 'tokens' },
  { id: 'input', labelKey: 'stat.input', unit: 'tokens' },
  { id: 'output', labelKey: 'stat.output', unit: 'tokens' },
  { id: 'cacheHit', labelKey: 'chart.metric.cacheHit', unit: 'tokens' },
  { id: 'cacheMiss', labelKey: 'chart.metric.cacheMiss', unit: 'tokens' },
  { id: 'requests', labelKey: 'chart.metric.requests', unit: 'requests' },
  { id: 'cost', labelKey: 'chart.metric.cost', unit: 'money' },
]

export const GRAINS: ReadonlyArray<{ id: ChartGrain; labelKey: MessageKey }> = [
  { id: 'auto', labelKey: 'chart.grain.auto' },
  { id: 'day', labelKey: 'chart.grain.day' },
  { id: 'month', labelKey: 'chart.grain.month' },
  { id: 'year', labelKey: 'chart.grain.year' },
]

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
    // Cost lives in a separate Money structure, never in Stat; buckets carry it.
    case 'cost':
      return 0
    default:
      return 0
  }
}

/**
 * Unit suffix: money and requests get one from the dictionary, tokens get none.
 *
 * `t` comes from the caller (a component passes its `useT()`): the suffix is rendered output, and
 * a module-level `t` would freeze it in whatever language was active when it first ran.
 */
export function metricSuffix(unit: MetricUnit, t: (key: MessageKey) => string): string {
  if (unit === 'requests') return t('chart.unit.requests')
  if (unit === 'money') return t('chart.unit.money')
  return ''
}

export interface Bucket {
  /** `YYYY-MM-DD` / `YYYY-MM` / `YYYY`; `label` is the short axis form, `full` the tooltip form. */
  key: string
  label: string
  full: string
  stat: Stat
  /**
   * Money spent in this bucket (CNY). Absent means no money data for this range, not 0 spent.
   * Money stays out of `stat`, which holds integer counts: mixing decimals in would break
   * `metricValue`'s type assumptions.
   */
  cost?: number
  /** Filled-in empty day rather than a real zero, so "genuinely 0" stays distinguishable from "not fetched". */
  empty: boolean
}

/** The point a chart consumes: bucket plus the selected metric's value. Computed once by the
 * panel, so the three chart components never handle metrics and cannot disagree with the summary. */
export interface ChartPoint {
  key: string
  label: string
  full: string
  value: number
  stat: Stat
  empty: boolean
}

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

/** Parse `YYYY-MM-DD` / `YYYY-MM` / `YYYY` to UTC milliseconds; NaN when malformed. */
function parseKeyMs(key: string): number {
  const parts = key.split('-')
  const y = Number(parts[0])
  if (!Number.isFinite(y)) return NaN
  const m = parts.length > 1 ? Number(parts[1]) : 1
  const d = parts.length > 2 ? Number(parts[2]) : 1
  return Date.UTC(y, m - 1, d)
}

/** Days between two date keys, inclusive of both ends. */
export function spanDays(from: string, to: string): number {
  const a = parseKeyMs(from)
  const b = parseKeyMs(to)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.floor((b - a) / 86_400_000) + 1
}

/**
 * Pick a grain from the range span: up to 92 days (about a quarter) by day, up to 1100 days
 * (about three years) by month, anything longer by year. Today / this week / this month therefore
 * land on days, and all-time lands on months.
 */
export function autoGrain(from: string, to: string): ResolvedGrain {
  const days = spanDays(from, to)
  if (days <= 92) return 'day'
  if (days <= 1100) return 'month'
  return 'year'
}

export function resolveGrain(grain: ChartGrain, from: string, to: string): ResolvedGrain {
  return grain === 'auto' ? autoGrain(from, to) : grain
}

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
 * Day-grain buckets, one per day of the range. Missing days are filled, zeroed and flagged
 * `empty`: the line chart needs an evenly spaced x axis, otherwise a five-day gap is drawn as
 * two adjacent points and reads as if those days never existed.
 *
 * Above MAX_FILL_DAYS (400) the fill is skipped — a range that long belongs to the month or year
 * grain, and one point per day would be thousands of points.
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
    // No fill: only days that actually have data, kept in ascending order.
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
 * Month-grain buckets, taken straight from the host's monthly totals: never sum the daily detail
 * into months, because a month whose `days` were never fetched would be badly understated and the
 * daily detail covers only a fraction of the recorded months.
 */
export function monthBuckets(months: SeriesPoint[]): Bucket[] {
  return [...months]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((p) => makeBucket(p.key, 'month', p.stat, false, p.cost))
}

/** Year-grain buckets, rolled up from the monthly totals. */
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
    // A filled gap and a real zero both plot at 0; only the gap counts as empty.
    empty: empty && !filled,
  }
  if (cost !== undefined) b.cost = cost
  return b
}

/** Short axis label: `YYYY` for years, `YY-MM` for months, `MM-DD` for days. */
export function shortLabel(key: string, grain: ResolvedGrain): string {
  if (grain === 'year') return key.slice(0, 4)
  if (grain === 'month') return key.slice(2)
  return key.slice(5)
}

/**
 * Values for the line chart, per bucket or cumulative. The cumulative curve starts at `prior`
 * (everything before the first day of the range); without it the curve would jump from 0 and the
 * earlier usage would look like it appeared out of nowhere. Money goes through
 * `bucketMetricValue`, which reads `bucket.cost` — not part of `stat`.
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
 * Read a metric from a bucket: money from `bucket.cost`, everything else from `stat`. Every chart
 * lookup has to go through here — `metricValue(bucket.stat, metric)` always yields 0 for money.
 */
export function bucketMetricValue(bucket: Bucket, metric: ChartMetric): number {
  if (metric === 'cost') return bucket.cost ?? 0
  return metricValue(bucket.stat, metric)
}

/**
 * "Nice" tick values (0, step, 2*step … ≥ max). A raw max/4 step yields ticks like 8237101; here
 * the step snaps to 1/2/5 × 10^n.
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

/** Line path (`M x y L …`). Coordinates keep two decimals to bound the string length. */
export function linePath(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return ''
  const pts = pointsOf(values, width, height, max)
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ')
}

/** Area path (the line, closed along the bottom edge). */
export function areaPath(values: number[], width: number, height: number, max: number): string {
  if (values.length === 0) return ''
  const pts = pointsOf(values, width, height, max)
  const first = pts[0]
  const last = pts[pts.length - 1]
  return `${linePath(values, width, height, max)} L${last[0]} ${height} L${first[0]} ${height} Z`
}

/** Coordinates of every point, exposed so dots and guides match the line exactly. */
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

export interface StackBar {
  key: string
  label: string
  full: string
  /** Three segments: cache hit / cache miss / output. */
  parts: [number, number, number]
  total: number
  requests: number
}

/** Stacked-bar buckets: input split into cache hit and miss, plus output. The three segments add
 * up to total tokens, so the cheap cached input is visible at a glance. */
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

export interface PieSlice {
  key: string
  label: string
  value: number
  percent: number
  colorIndex: number
}

/**
 * Turn composition items into pie slices: zero values are dropped (otherwise the legend fills
 * with 0% noise), and after a descending sort the first `maxSlices - 1` are kept with the rest
 * merged into "other" — there can be dozens of models, and drawing all of them makes the legend
 * longer than the chart.
 *
 * `otherLabel` defaults to the module-level `t` for non-render callers (tests, scripts);
 * components must pass `t('chart.other')`, or the merged slice keeps the language it was made in.
 */
export function pieSlices(
  items: Array<{ key: string; label: string; value: number }>,
  maxSlices = 8,
  otherLabel = translate('chart.other'),
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

/** One donut arc, drawn with stroke-dasharray/offset so a lone segment still spans 360°. */
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

/** x-axis sampling: at most `max` labels, so they never crowd together. */
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
  // Add the final bucket on its own: otherwise the last axis label lands on the
  // bucket step positions back, which reads as if the data ends there. If it
  // would overlap the previous label, drop that one instead.
  const last = picked[picked.length - 1]
  if (last !== undefined && count - 1 - last < step * 0.6 && picked.length > 1) picked.pop()
  for (const i of picked) out.add(i)
  out.add(count - 1)
  return out
}

/** Largest value in a series, for the y-axis ceiling; 0 for an empty array. */
export function maxOf(values: number[]): number {
  let max = 0
  for (const v of values) if (Number.isFinite(v) && v > max) max = v
  return max
}

/**
 * Hover span `[x0, x1]` for every point. Hitting the 3px dot itself is unusable with a single
 * point or tightly packed points, so neighbour boundaries sit on the perpendicular bisector and
 * the outer edges stretch to the canvas: every horizontal mouse position hits exactly one point,
 * with no dead zones between spans.
 */
export function hitSpans(
  xs: Array<[number, number]>,
  width: number,
): Array<[number, number]> {
  const n = xs.length
  if (n === 0) return []
  if (n === 1) return [[0, width]]
  // bounds[i] is the left edge of point i's span; the outer edges sit on the canvas.
  const bounds: number[] = [0]
  for (let i = 1; i < n; i++) bounds.push((xs[i - 1][0] + xs[i][0]) / 2)
  bounds.push(width)
  return xs.map((_, i) => [bounds[i], bounds[i + 1]])
}

/**
 * Project snapshots to buckets. This dimension has no monthly totals (the host only exposes a
 * running value), so the buckets are the snapshots themselves:
 *  - `cumulative`: the snapshot values directly, a true cumulative curve
 *  - `perBucket`: the difference between consecutive snapshots, what was added in that stretch
 *
 * In per-bucket mode the first point is accurate only with a snapshot before the range (`prior`);
 * without one it degrades to the first point itself — everything since the project was first
 * recorded — and reads as too high. The UI says so. Differences are clamped to at least 0: a
 * cumulative value moves backwards when the host prunes session data, and a negative bar means
 * nothing.
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
