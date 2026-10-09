/**
 * tlogs — 平台响应体的解析与聚合。输入是 `usage/amount` / `usage/cost` 的 `biz_data`，
 * 输出是五类计量项的合计（整体 / 按模型 / 按天）。接口字段名与类型见 `types.ts`，这里只做归一化。
 *
 * 不可从代码推断的口径约束：
 *  - token 的 `amount` 是整数字符串，金额的 `amount` 是 16 位小数字符串，必须走各自的转换函数，金额用 `Math.trunc` 会被吞成 0；
 *  - `usage/cost` 的 `biz_data` 是长度 1 的数组（`usage/amount` 是对象），先归一化再解析；未知 `type` 既不进合计也不进按模型明细（与 Python 参考实现一致）；非字典条目整条跳过。
 */

import {
  emptyMoney,
  emptyStat,
  isTokenType,
  moneyTotal,
  TOKEN_TYPES,
  type BizData,
  type DayUsage,
  type ModelUsage,
  type Money,
  type ParsedUsage,
  type ScopeStat,
  type Stat,
  type UsageEntry,
} from '../types.js'

/** `isinstance(x, dict)` 的等价判断（排除 null 与数组）。 */
function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 把接口里的 `amount` 转成整数：`int(float(value or 0))`，向零截断，非有限数归 0。只用于 token 计数；
 * 金额走 `toMoneyAmount`，否则会被截成 0。
 */
export function toAmount(value: unknown): number {
  const raw = value || 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}

/**
 * 把金额字符串转成数值（CNY 元），保留小数。接口给 16 位小数，`Number()` 取最近 double，逐项累加的
 * 误差量级约 1e-11 元，而展示只到分甚至厘，因此无需定点数。这里的 1e-8 圆整只为去掉 double 表示噪声，
 * 让持久化的 JSON 更短更稳定。
 */
export function toMoneyAmount(value: unknown): number {
  const raw = value || 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1e8) / 1e8
}

/**
 * 归一化 `biz_data`：`usage/amount` 给对象，`usage/cost` 给长度 1 的数组。
 * 不做这一步会静默拿到 `undefined.total`，金额全部显示成 ¥0.00 且不报错。
 */
export function unwrapBizData(raw: unknown): BizData {
  if (Array.isArray(raw)) {
    const first = raw[0]
    return isDict(first) ? (first as BizData) : {}
  }
  return isDict(raw) ? (raw as BizData) : {}
}

/**
 * 把一个模型条目数组按五类计量项聚合。即使某个模型的 `usage` 为空或缺省，它的键也会被创建（全 0）——
 * 接口的 `total[]` 本来就会返回若干全 0 模型，是否展示由调用方决定。
 */
function aggregateModels(
  items: unknown,
  onModel?: (model: string, stat: Stat) => void,
): { agg: Stat; models: Record<string, Stat> } {
  const agg = emptyStat()
  const models: Record<string, Stat> = {}

  const list = Array.isArray(items) ? items : []
  for (const item of list) {
    if (!isDict(item)) continue
    const model = (item.model as string) || 'unknown'
    let m = models[model]
    if (!m) {
      m = emptyStat()
      models[model] = m
    }

    const usage = (item as ModelUsage).usage
    for (const u of Array.isArray(usage) ? usage : []) {
      if (!isDict(u)) continue
      const t = (u as UsageEntry).type
      if (!isTokenType(t)) continue
      const a = toAmount((u as UsageEntry).amount)
      agg[t] += a
      m[t] += a
    }

    onModel?.(model, m)
  }

  return { agg, models }
}

/** 解析 `biz_data`，返回整体合计与按模型合计。 */
export function parseBizData(bizData: BizData | null | undefined): ParsedUsage {
  return aggregateModels(bizData?.total)
}

/**
 * 解析 `biz_data.days[]`，得到每一天的合计。`days[].data[]` 与 `total[]` 同构，因此复用同一套聚合逻辑。
 * 接口会返回当月完整天数（含尚未到来的日期，全为 0），所以按日期过滤 today / week / month 时不必处理缺失日期。
 */
export function parseDays(
  bizData: BizData | null | undefined,
  cost?: ParsedCost | null,
): Array<{ date: string; stat: Stat; cost?: Money }> {
  const days = bizData?.days
  const list = Array.isArray(days) ? days : []
  const out: Array<{ date: string; stat: Stat; cost?: Money }> = []
  // 金额与 token 的逐日日期逐个相同，因此按 date 建索引对齐，不依赖两边顺序一致。
  const costByDate = new Map<string, Money>()
  for (const c of cost?.days ?? []) costByDate.set(c.date, c.cost)
  for (const day of list) {
    if (!isDict(day)) continue
    const date = (day as DayUsage).date
    if (typeof date !== 'string' || date.length === 0) continue
    const { agg } = aggregateModels((day as DayUsage).data)
    const entry: { date: string; stat: Stat; cost?: Money } = { date, stat: agg }
    const c = costByDate.get(date)
    if (c) entry.cost = c
    out.push(entry)
  }
  return out
}

export function inputTokens(stat: Stat): number {
  return stat.PROMPT_TOKEN + stat.PROMPT_CACHE_HIT_TOKEN + stat.PROMPT_CACHE_MISS_TOKEN
}

export function outputTokens(stat: Stat): number {
  return stat.RESPONSE_TOKEN
}

/** 由原始 Stat 派生 ScopeStat（拆分输入/输出/总计/请求）。 */
export function toScopeStat(stat: Stat, cost?: Money, currency?: string): ScopeStat {
  const input = inputTokens(stat)
  const output = outputTokens(stat)
  const base: ScopeStat = {
    raw: stat,
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    requests: stat.REQUEST,
  }
  if (cost) {
    base.cost = cost
    base.currency = currency ?? 'CNY'
  }
  return base
}

/** 该行是否有可见用量（详细视图据此跳过空行）。 */
export function isNonEmpty(stat: ScopeStat): boolean {
  return stat.totalTokens !== 0 || stat.requests !== 0
}

/** 把 src 累加进 target（就地修改并返回 target）。 */
export function addInto(target: Stat, src: Stat): Stat {
  for (const t of TOKEN_TYPES) target[t] += src[t]
  return target
}

/** 累加两个 Stat，返回新对象。 */
export function mergeStats(a: Stat, b: Stat): Stat {
  return addInto(addInto(emptyStat(), a), b)
}

export function sumStats(list: Iterable<Stat>): Stat {
  const acc = emptyStat()
  for (const s of list) addInto(acc, s)
  return acc
}

/** 由 Stat 构造 StatRow，用于详细视图的表格；`label` 仅作展示，`key` 用于排序与 stable key。 */
export function toRow(key: string, label: string, stat: Stat): {
  key: string
  label: string
  stat: ScopeStat
} {
  return { key, label, stat: toScopeStat(stat) }
}

/**
 * 按五类计量项聚合金额。与 `aggregateModels` 同构，区别只在用 `toMoneyAmount` 保留小数，以及只登记
 * 真的花了钱的模型（接口会给一堆全 0 模型，登记进去界面只会多出空行）。
 */
function aggregateMoney(
  items: unknown,
  onModel?: (model: string, amount: number) => void,
): { total: Money; models: Record<string, number> } {
  const total = emptyMoney()
  const models: Record<string, number> = {}

  const list = Array.isArray(items) ? items : []
  for (const item of list) {
    if (!isDict(item)) continue
    const model = (item.model as string) || 'unknown'
    let sum = 0
    const usage = (item as ModelUsage).usage
    for (const u of Array.isArray(usage) ? usage : []) {
      if (!isDict(u)) continue
      const t = (u as UsageEntry).type
      if (!isTokenType(t)) continue
      const a = toMoneyAmount((u as UsageEntry).amount)
      total[t] += a
      sum += a
    }
    if (sum > 0) models[model] = toMoneyAmount(sum)
    onModel?.(model, sum)
  }

  return { total, models }
}

/**
 * 某月的金额解析结果：`total` 该月总费用（按五类拆分）、`amount` 合计元数、
 * `models` 按模型费用（已过滤 0）、`days` 逐日费用（日期与 `usage/amount` 的逐日日期逐个相同）、`currency` 币种（接口给 `CNY`）。
 */
export interface ParsedCost {
  total: Money
  amount: number
  models: Record<string, number>
  days: Array<{ date: string; cost: Money }>
  currency: string
}

/**
 * 解析 `usage/cost` 的 `biz_data`。接口侧的几条事实决定了这里的写法：
 *  - `biz_data` 是数组 `[{ total, days, currency }]`，先 `unwrapBizData` 再解析；
 *  - `days[].data[]` 与 `total[]` 同构，逐日金额之和与月度金额之和完全相等；
 *  - `days[].date` 与 `usage/amount` 的 `days[].date` 逐个相同，故可与 token 逐日对齐；`REQUEST` 的金额恒为 0（请求不计费）。
 *
 * 逐日保存五类拆分而不是一个总额：today/week/month/last7/last30 都是按天切出来的窗口，
 * 只留总额就没法回答「输入花了多少钱 / 输出花了多少钱」。
 */
export function parseCost(bizData: BizData | null | undefined): ParsedCost {
  const { total, models } = aggregateMoney(bizData?.total)
  const days: Array<{ date: string; cost: Money }> = []
  for (const day of Array.isArray(bizData?.days) ? bizData!.days! : []) {
    if (!isDict(day)) continue
    const date = (day as DayUsage).date
    if (typeof date !== 'string' || date.length === 0) continue
    const { total: dayTotal } = aggregateMoney((day as DayUsage).data)
    days.push({ date, cost: dayTotal })
  }
  const currency = typeof bizData?.currency === 'string' && bizData.currency ? bizData.currency : 'CNY'
  return {
    total,
    amount: toMoneyAmount(moneyTotal(total)),
    models,
    days,
    currency,
  }
}

/** 把 src 的金额累加进 target（就地）。 */
export function addMoneyInto(target: Money, src: Money | undefined): Money {
  if (!src) return target
  for (const t of TOKEN_TYPES) target[t] += src[t]
  return target
}
