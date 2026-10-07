/**
 * tlogs — 响应解析与聚合。
 *
 * 本文件是工作区权威参考实现 `deepseek_python_20261007_a1f087.py` 中
 * `parse_biz_data` / `input_tokens` / `output_tokens` / `empty_stat` 的逐行翻译。
 * 注释里的 `py:NN` 指向该 Python 文件的行号，便于逐条对拍。
 *
 * 翻译过程中刻意保留的 Python 语义：
 *  - `u.get("amount") or 0`   → `entry.amount || 0`（0 / "" / null 均归零）
 *  - `int(float(x))`          → `Number(x)` 后 `Math.trunc`（向零截断，非四舍五入）
 *  - `except (ValueError, TypeError)` → 非有限数一律归 0
 *  - `if t not in agg: continue` → 未知 type 既不进 agg 也不进 models
 *  - `if not isinstance(item, dict): continue` → 非字典条目整条跳过
 */

import {
  emptyStat,
  isTokenType,
  TOKEN_TYPES,
  type BizData,
  type DayUsage,
  type ModelUsage,
  type ParsedUsage,
  type ScopeStat,
  type Stat,
  type UsageEntry,
} from '../types.js'

/** Python `isinstance(x, dict)` 的等价判断（排除 null 与数组）。 */
function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 把接口里的 `amount` 转成整数，等价于 Python：
 *   `int(float(u.get("amount") or 0))`，异常时取 0。
 *
 * 唯一有意的偏差：Python 的 `int(float("inf"))` 会抛 OverflowError 且**不在**
 * `except (ValueError, TypeError)` 覆盖范围内（脚本会整体崩溃）；这里对非有限数
 * 一律返回 0。真实接口的 amount 始终是整数字符串，不会触发该分支。
 */
export function toAmount(value: unknown): number {
  const raw = value || 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}

/**
 * 把一个模型条目数组按五类计量项聚合。等价于 Python `parse_biz_data` 内层循环。
 *
 * 注意：即使某个模型的 `usage` 为空或缺省，该模型键也会被创建（全部为 0），
 * 这与 Python `models.setdefault(model, empty_stat())` 的行为一致 —— 实测接口
 * 的 `total[]` 会返回若干全 0 模型，UI 侧再按需求过滤。
 */
function aggregateModels(
  items: unknown,
  onModel?: (model: string, stat: Stat) => void,
): { agg: Stat; models: Record<string, Stat> } {
  const agg = emptyStat() // py:97
  const models: Record<string, Stat> = {} // py:98

  const list = Array.isArray(items) ? items : [] // py:100 `biz_data.get("total") or []`
  for (const item of list) {
    if (!isDict(item)) continue // py:102
    const model = (item.model as string) || 'unknown' // py:104 `item.get("model") or "unknown"`
    let m = models[model]
    if (!m) {
      m = emptyStat()
      models[model] = m // py:105 setdefault
    }

    const usage = (item as ModelUsage).usage
    const usageList = Array.isArray(usage) ? usage : [] // py:107
    for (const u of usageList) {
      if (!isDict(u)) continue // py:108
      const t = (u as UsageEntry).type
      if (!isTokenType(t)) continue // py:110-111 `if t not in agg: continue`
      const a = toAmount((u as UsageEntry).amount) // py:113-117
      agg[t] += a // py:118
      m[t] += a // py:119
    }

    onModel?.(model, m)
  }

  return { agg, models }
}

/**
 * 解析 `biz_data`，返回整体合计与按模型合计。
 * 等价于 Python `parse_biz_data(biz_data) -> (agg, models)`（py:91-120）。
 */
export function parseBizData(bizData: BizData | null | undefined): ParsedUsage {
  return aggregateModels(bizData?.total)
}

/**
 * 解析 `biz_data.days[]`，得到每一天的合计。
 *
 * 结构上 `days[].data[]` 与 `total[]` 同构，因此复用同一套聚合逻辑。
 * 实测接口会返回**当月完整天数**（含尚未到来的日期，全为 0），
 * 所以按日期过滤 today / week / month 无需额外处理缺失日期。
 */
export function parseDays(bizData: BizData | null | undefined): Array<{ date: string; stat: Stat }> {
  const days = bizData?.days
  const list = Array.isArray(days) ? days : []
  const out: Array<{ date: string; stat: Stat }> = []
  for (const day of list) {
    if (!isDict(day)) continue
    const date = (day as DayUsage).date
    if (typeof date !== 'string' || date.length === 0) continue
    const { agg } = aggregateModels((day as DayUsage).data)
    out.push({ date, stat: agg })
  }
  return out
}

/** 总输入 = PROMPT + CACHE_HIT + CACHE_MISS。等价于 Python `input_tokens`（py:123-128）。 */
export function inputTokens(stat: Stat): number {
  return (
    stat.PROMPT_TOKEN + // py:125
    stat.PROMPT_CACHE_HIT_TOKEN + // py:126
    stat.PROMPT_CACHE_MISS_TOKEN // py:127
  )
}

/** 总输出 = RESPONSE_TOKEN。等价于 Python `output_tokens`（py:131-132）。 */
export function outputTokens(stat: Stat): number {
  return stat.RESPONSE_TOKEN
}

/** 由原始 Stat 派生 ScopeStat（拆分输入/输出/总计/请求）。 */
export function toScopeStat(stat: Stat): ScopeStat {
  const input = inputTokens(stat)
  const output = outputTokens(stat)
  return {
    raw: stat,
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output, // py:204 `g_total = g_in + g_out`
    requests: stat.REQUEST,
  }
}

/** 过滤掉「零用量」的行 —— 对应屏幕表格里的可见性规则。 */
export function isNonEmpty(stat: ScopeStat): boolean {
  // 等价于 Python 汇总区的 `if t == 0 and s["REQUEST"] == 0: continue`（py:229-230）
  return stat.totalTokens !== 0 || stat.requests !== 0
}

/** 把 src 累加进 target（就地修改 target 并返回）。等价于 py:169-174 的双层循环。 */
export function addInto(target: Stat, src: Stat): Stat {
  for (const t of TOKEN_TYPES) target[t] += src[t]
  return target
}

/** 累加两个 Stat，返回新对象。 */
export function mergeStats(a: Stat, b: Stat): Stat {
  return addInto(addInto(emptyStat(), a), b)
}

/** 全部归零的 Stat 之和。 */
export function sumStats(list: Iterable<Stat>): Stat {
  const acc = emptyStat()
  for (const s of list) addInto(acc, s)
  return acc
}

/**
 * 由 Stat 构造 StatRow，用于详细视图的表格。
 * `label` 仅作展示，`key` 用于排序与 stable key。
 */
export function toRow(key: string, label: string, stat: Stat): {
  key: string
  label: string
  stat: ScopeStat
} {
  return { key, label, stat: toScopeStat(stat) }
}
