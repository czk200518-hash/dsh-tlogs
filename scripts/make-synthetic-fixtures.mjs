/**
 * 生成**合成**对拍夹具（确定性，可复现）。
 *
 * 为什么需要：原先入仓的 `usage-YYYY-MM.json` 是从**真实账号**的接口响应缩放而来，
 * 虽然绝对数值被整数因子混淆过，但仍保留了「模型使用清单」与「逐日活跃形态」——
 * 那是账号持有人的工作节奏指纹。本脚本生成与之形态完全一致、但**内容纯属虚构**的
 * 夹具，于是仓库里不再有任何由真实数据派生的内容。
 *
 * 与真实接口保持一致的形态（这些不变量有测试守着）：
 *   - 顶层 `code: 0`，内层 `data.biz_code: 0`（双层错误码）
 *   - `biz_data.total[]` 与 `biz_data.days[].data[]` 同构
 *   - 每个 `usage[].amount` 都是**字符串**
 *   - `sum(days[].data)` 逐计量项**等于** `total`（真实接口满足该恒等式）
 *   - `total` 里含**全 0 模型**（真实接口会返回一批，用来验证「仍要建键」）
 *   - `days` 覆盖整个月（≥28 天）
 *
 * 生成的活跃形态（工作日活跃、周末多为静默）是**造的**，与任何真实账号无关。
 *
 * 用法：`node scripts/make-synthetic-fixtures.mjs`
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'test', 'fixtures')

const TOKEN_TYPES = [
  'PROMPT_TOKEN',
  'PROMPT_CACHE_HIT_TOKEN',
  'PROMPT_CACHE_MISS_TOKEN',
  'RESPONSE_TOKEN',
  'REQUEST',
]

/**
 * 模型标识：用的是平台**公开的产品名**（不是用户数据）。
 * 其中 `deepseek-chat & deepseek-reasoner` 是平台会产生的「聚合标签」形态，
 * 特意保留以覆盖「模型名含空格与 &」的解析路径。
 */
const MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
  'deepseek-chat & deepseek-reasoner',
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'deepseek-v4-flash-vision-exp',
]

/** 故意保留一个**全 0 模型**：真实接口会返回一批，用来验证「即使 usage 为空也要建键」。 */
const ZERO_MODEL = 'deepseek-retired-preview'

/** 确定性 PRNG（mulberry32）：同一 seed 永远产出同一份夹具。 */
function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), 1 | t)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeUsage(rnd, active) {
  const value = {
    PROMPT_TOKEN: active ? 200 + Math.floor(rnd() * 18_000) : 0,
    PROMPT_CACHE_HIT_TOKEN: active ? 2_000 + Math.floor(rnd() * 420_000) : 0,
    PROMPT_CACHE_MISS_TOKEN: active ? 500 + Math.floor(rnd() * 90_000) : 0,
    RESPONSE_TOKEN: active ? 120 + Math.floor(rnd() * 5_200) : 0,
    REQUEST: active ? 1 + Math.floor(rnd() * 38) : 0,
  }
  return TOKEN_TYPES.map((t) => ({ type: t, amount: String(value[t]) }))
}

function buildFixture(year, month, seed) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const rnd = mulberry32(seed)

  const totals = new Map(MODELS.map((m) => [m, Object.fromEntries(TOKEN_TYPES.map((t) => [t, 0]))]))
  const days = []

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay()
    // 造的活跃形态：周末静默，工作日有 85% 概率活跃
    const active = dow !== 0 && dow !== 6 && rnd() > 0.15

    const data = MODELS.map((model) => {
      const usage = makeUsage(rnd, active)
      const acc = totals.get(model)
      for (const u of usage) acc[u.type] += Number(u.amount)
      return { model, usage }
    })
    days.push({ date, data })
  }

  // total 由 days 的逐项累加得出 —— 保证「逐日之和 == 月总计」恒等式成立
  const total = MODELS.map((model) => ({
    model,
    usage: TOKEN_TYPES.map((t) => ({ type: t, amount: String(totals.get(model)[t]) })),
  }))
  total.push({
    model: ZERO_MODEL,
    usage: TOKEN_TYPES.map((t) => ({ type: t, amount: '0' })),
  })

  return {
    _synthetic: true,
    _note: '合成数据，由 scripts/make-synthetic-fixtures.mjs 确定性生成，不含任何真实账号数据。',
    code: 0,
    msg: '',
    data: { biz_code: 0, biz_msg: '', biz_data: { total, days } },
  }
}

const MONTHS = [
  { year: 2026, month: 8, seed: 20_260_801 },
  { year: 2026, month: 9, seed: 20_260_901 },
]

for (const { year, month, seed } of MONTHS) {
  const file = path.join(OUT_DIR, `usage-${year}-${String(month).padStart(2, '0')}.json`)
  const payload = buildFixture(year, month, seed)
  fs.writeFileSync(file, JSON.stringify(payload), 'utf8')
  const bytes = fs.statSync(file).size
  console.log(`wrote ${path.relative(ROOT, file)}  (${bytes} bytes, ${payload.data.biz_data.days.length} days)`)
}
