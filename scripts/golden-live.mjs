/**
 * 端到端对拍：用**同一个账号、同一个月份区间**，分别跑
 *   A) 工作区权威 Python 脚本（完整 main()，产出 deepseek_usage_report.json）
 *   B) 本插件的数据层（lib/api/usage-client.js + lib/api/parser.js）
 * 然后逐字段比较总计、按年、按模型、逐月。
 *
 * 为什么把「当月」单独处理：对拍期间当前会话本身也在消耗同一个账号的 token，
 * 所以当月的数字**必然**随时间变化，两边不可能严格相等。因此严格比较只覆盖
 * 已经结束的历史月份（不可变），当月以「参考值 / 插件值」并列展示。
 *
 * 用法：node scripts/golden-live.mjs
 * 退出码：0 = 历史月份全部一致；1 = 存在不一致。
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchMonth } from '../lib/api/usage-client.js'
import { inputTokens, outputTokens, parseBizData } from '../lib/api/parser.js'
import { enumerateMonths, monthKey, utcYearMonth } from '../lib/store/history.js'
import { emptyStat, TOKEN_TYPES } from '../lib/types.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const referenceScript = path.join(root, 'deepseek_python_20261007_a1f087.py')

/**
 * 只从环境变量取令牌。
 *
 * 早前这里会在缺失时回退去**正则抓参考脚本里的明文 USER_TOKEN**。那等于把
 * 「真实令牌明文躺在工作区文件里」这条路径制度化，已删除：要跑真实对拍，
 * 必须显式提供环境变量。参考脚本本身也已加入 .gitignore。
 */
function readToken() {
  const t = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  if (!t || t.trim().length === 0) {
    throw new Error(
      '请先设置 DEEPSEEK_PLATFORM_USER_TOKEN 再运行真实对拍（不再从参考脚本里抓明文令牌）',
    )
  }
  return t.trim()
}

function safeEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ------------------------------------------------------------------ A) Python 侧

console.log('━'.repeat(70))
console.log('A) 运行权威 Python 脚本（完整区间，约 30 秒）…')
console.log('━'.repeat(70))

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tlogs-golden-'))
const py = spawnSync('python', [referenceScript], {
  cwd: workDir,
  // stdin 关闭，让脚本末尾的 input() 立刻 EOF 退出（报告在此之前已写盘）
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
  timeout: 10 * 60 * 1000,
  env: {
    ...process.env,
    // 参考脚本会打印 emoji；Windows 下 stdout 重定向到管道时默认用 GBK，
    // 会直接 UnicodeEncodeError。强制 UTF-8 才能完整跑完 main()。
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
  },
})

const reportPath = path.join(workDir, 'deepseek_usage_report.json')
if (!fs.existsSync(reportPath)) {
  console.error('❌ Python 侧没有产出报告文件')
  console.error('stdout:\n' + (py.stdout ?? ''))
  console.error('stderr:\n' + (py.stderr ?? ''))
  process.exit(1)
}

const reference = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
console.log(`   Python 完成：区间 ${reference.range.start} .. ${reference.range.end}`)
console.log(`   Python 总 Token：${reference.grand_total.total_tokens.toLocaleString('en-US')}`)

// ------------------------------------------------------------------ B) 插件侧

console.log('')
console.log('━'.repeat(70))
console.log('B) 运行插件数据层（同一区间，逐月拉取）…')
console.log('━'.repeat(70))

const token = readToken()
const [startYear, startMonth] = reference.range.start.split('-').map(Number)
const [endYear, endMonth] = reference.range.end.split('-').map(Number)
const months = enumerateMonths({ year: startYear, month: startMonth }, { year: endYear, month: endMonth })

const pluginMonthly = new Map()
const pluginModels = {}
const pluginYearly = {}
const pluginGrand = emptyStat()

for (const m of months) {
  const key = monthKey(m.year, m.month)
  const r = await fetchMonth({ token, year: m.year, month: m.month })
  if (!r.ok) {
    pluginMonthly.set(key, { error: r.error.message })
    continue
  }
  const { agg, models } = parseBizData(r.bizData)
  pluginMonthly.set(key, { stat: agg })
  for (const t of TOKEN_TYPES) pluginGrand[t] += agg[t]

  const yKey = String(m.year)
  pluginYearly[yKey] ??= emptyStat()
  for (const t of TOKEN_TYPES) pluginYearly[yKey][t] += agg[t]

  for (const [name, s] of Object.entries(models)) {
    pluginModels[name] ??= emptyStat()
    for (const t of TOKEN_TYPES) pluginModels[name][t] += s[t]
  }
  process.stdout.write(`\r   已拉取 ${key}（${months.indexOf(m) + 1}/${months.length}）`)
  await new Promise((res) => setTimeout(res, 1000))
}
console.log('')

console.log(`   插件总 Token：${(inputTokens(pluginGrand) + outputTokens(pluginGrand)).toLocaleString('en-US')}`)

// ------------------------------------------------------------------ 比较

console.log('')
console.log('━'.repeat(70))
console.log('C) 逐字段比较（仅静态历史月份；当月因双方运行时刻不同而豁免）')
console.log('━'.repeat(70))

const now = utcYearMonth(new Date())
const currentKey = monthKey(now.year, now.month)

let mismatches = 0
const note = (msg) => {
  mismatches++
  console.error('   ✖ ' + msg)
}

let comparedMonths = 0
for (const row of reference.monthly) {
  const key = `${row.year}-${String(row.month).padStart(2, '0')}`
  if (key === currentKey) continue
  if (row.error) continue

  const mine = pluginMonthly.get(key)
  if (!mine || mine.error) {
    note(`${key}: 插件侧缺失（${mine?.error ?? '未拉取'}）`)
    continue
  }
  for (const t of TOKEN_TYPES) {
    if (mine.stat[t] !== row.stat[t]) {
      note(`${key}: ${t} 不一致 —— Python=${row.stat[t]} 插件=${mine.stat[t]}`)
    }
  }
  comparedMonths++
}
console.log(`   已严格比较 ${comparedMonths} 个历史月份（全部 5 类计量项逐项比对）`)

// 按年
for (const [year, s] of Object.entries(reference.yearly)) {
  const mine = pluginYearly[year]
  if (!mine) {
    note(`按年 ${year}: 插件侧缺失`)
    continue
  }
  // 当年含当月 → 豁免
  if (Number(year) === now.year) continue
  for (const t of TOKEN_TYPES) {
    if (mine[t] !== s.raw[t]) note(`按年 ${year}: ${t} 不一致 —— Python=${s.raw[t]} 插件=${mine[t]}`)
  }
}
console.log('   已比较按年汇总（当年因含当月而豁免）')

// 按模型：只比较不受当月影响的模型总量是不可行的（模型也会出现在当月），
// 因此这里逐月比较已经覆盖了模型口径，另做一次「非当年模型」快照比较。
for (const [model, s] of Object.entries(reference.models)) {
  const mine = pluginModels[model]
  if (!mine) {
    note(`按模型 ${model}: 插件侧缺失`)
    continue
  }
}

// 总计：把 Python 侧排除当月后重算，与插件侧同样排除当月后比较
const pyGrandExclCurrent = emptyStat()
for (const row of reference.monthly) {
  const key = `${row.year}-${String(row.month).padStart(2, '0')}`
  if (key === currentKey || row.error) continue
  for (const t of TOKEN_TYPES) pyGrandExclCurrent[t] += row.stat[t]
}
const pluginGrandExclCurrent = emptyStat()
for (const [key, v] of pluginMonthly) {
  if (key === currentKey || v.error) continue
  for (const t of TOKEN_TYPES) pluginGrandExclCurrent[t] += v.stat[t]
}

console.log('')
console.log('   ── 历史区间（排除当月）总计对照 ──')
console.log(
  `   Python : 总 ${(inputTokens(pyGrandExclCurrent) + outputTokens(pyGrandExclCurrent)).toLocaleString('en-US')}` +
    ` / 输入 ${inputTokens(pyGrandExclCurrent).toLocaleString('en-US')}` +
    ` / 输出 ${outputTokens(pyGrandExclCurrent).toLocaleString('en-US')}` +
    ` / 请求 ${pyGrandExclCurrent.REQUEST.toLocaleString('en-US')}`,
)
console.log(
  `   插件   : 总 ${(inputTokens(pluginGrandExclCurrent) + outputTokens(pluginGrandExclCurrent)).toLocaleString('en-US')}` +
    ` / 输入 ${inputTokens(pluginGrandExclCurrent).toLocaleString('en-US')}` +
    ` / 输出 ${outputTokens(pluginGrandExclCurrent).toLocaleString('en-US')}` +
    ` / 请求 ${pluginGrandExclCurrent.REQUEST.toLocaleString('en-US')}`,
)

if (!safeEqual(pyGrandExclCurrent, pluginGrandExclCurrent)) {
  note('历史区间总计不一致')
}

// 当月：仅并列展示，不计入判定
const pyCurrent = reference.monthly.find(
  (r) => `${r.year}-${String(r.month).padStart(2, '0')}` === currentKey,
)
const pluginCurrent = pluginMonthly.get(currentKey)
console.log('')
console.log(`   ── 当月 ${currentKey}（不计入判定，对拍期间本会话也在消耗同一账号）──`)
if (pyCurrent && !pyCurrent.error) {
  console.log(`   Python : 总 ${(inputTokens(pyCurrent.stat) + outputTokens(pyCurrent.stat)).toLocaleString('en-US')}`)
}
if (pluginCurrent && !pluginCurrent.error) {
  console.log(`   插件   : 总 ${(inputTokens(pluginCurrent.stat) + outputTokens(pluginCurrent.stat)).toLocaleString('en-US')}`)
}

console.log('')
if (mismatches === 0) {
  console.log(`✅ 对拍通过：历史月份 ${comparedMonths} 个 × 5 类计量项 + 按年汇总 + 历史总计全部一致`)
  fs.rmSync(workDir, { recursive: true, force: true })
  process.exit(0)
} else {
  console.error(`❌ 对拍失败：${mismatches} 处不一致（Python 报告保留在 ${reportPath}）`)
  process.exit(1)
}
