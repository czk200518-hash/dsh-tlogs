/**
 * 金额（usage/cost）管线单测。
 *
 * 这一组用例钉住的全是**实测踩过或极易踩**的坑，而不是「测试实现」：
 *  1. `usage/cost` 的 `amount` 是 16 位小数 —— 用 token 的 `toAmount`（Math.trunc）
 *     解析会把所有金额吞成 0（实测踩过：整月金额全变 ¥0.00 且不报任何错）
 *  2. `usage/cost` 的 `biz_data` 是**数组**，`usage/amount` 的是**对象**
 *     —— 不归一化就静默拿到全 0
 *  3. 逐日金额与逐日 token 必须按 **date** 对齐，不能依赖两边顺序相同
 *  4. 滚动窗口（近 7 / 近 30 天）会横跨两到三个自然月，不能只读「当月」
 *  5. 金额必须能**往返持久化** —— 丢了就等于每次重启都重打一遍 31 次请求
 *  6. 「缺金额」与「花了 0 元」必须可区分（一次性回补的判定依据）
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseBizData,
  parseCost,
  parseDays,
  toAmount,
  toMoneyAmount,
  unwrapBizData,
  addMoneyInto,
} from '../lib/api/parser.js'
import {
  fetchAccountSummary,
  fetchMonth,
  buildUrl,
  BASE_URL,
} from '../lib/api/usage-client.js'
import { HistoryStore, monthKey } from '../lib/store/history.js'
import { ProjectHistoryStore } from '../lib/store/project-history.js'
import { UsageService } from '../lib/service.js'
import { resolveConfig } from '../lib/config.js'
import { rollingWindow, todayWindow, weekWindow, monthWindow, dateKey } from '../lib/store/dates.js'
import {
  emptyMoney,
  emptyStat,
  moneyTotal,
  type BizData,
  type MonthRow,
  type Stat,
} from '../lib/types.js'
import { formatMoney, formatMoneyBy, formatMoneyFull, formatMoneyShort } from '../lib/client/format.js'
import { bucketMetricValue, monthBuckets, yearBuckets } from '../lib/client/chart-utils.js'

/* ------------------------------------------------------------------ *
 * 真实响应形状的夹具
 * ------------------------------------------------------------------ */

/**
 * `usage/cost` 的真实形状（2026-10 抓包核对）：
 * `data.biz_data` 是**长度 1 的数组**，元素含 total / days / currency。
 */
function costFixture(): { code: number; data: { biz_code: number; biz_data: unknown } } {
  return {
    code: 0,
    data: {
      biz_code: 0,
      biz_data: [
        {
          currency: 'CNY',
          total: [
            {
              model: 'deepseek-flash',
              usage: [
                { type: 'PROMPT_TOKEN', amount: '0' },
                { type: 'PROMPT_CACHE_HIT_TOKEN', amount: '12.1115392000000000' },
                { type: 'PROMPT_CACHE_MISS_TOKEN', amount: '5.9521160000000000' },
                { type: 'RESPONSE_TOKEN', amount: '7.1393520000000000' },
                { type: 'REQUEST', amount: '0' },
              ],
            },
            // 接口会返回一堆全 0 的模型：不应出现在按模型金额里
            {
              model: 'deepseek-v4-pro',
              usage: [
                { type: 'PROMPT_TOKEN', amount: '0' },
                { type: 'PROMPT_CACHE_HIT_TOKEN', amount: '0' },
                { type: 'PROMPT_CACHE_MISS_TOKEN', amount: '0' },
                { type: 'RESPONSE_TOKEN', amount: '0' },
                { type: 'REQUEST', amount: '0' },
              ],
            },
          ],
          days: [
            {
              date: '2026-10-01',
              data: [
                {
                  model: 'deepseek-flash',
                  usage: [
                    { type: 'PROMPT_CACHE_HIT_TOKEN', amount: '2.6896921600000000' },
                    { type: 'PROMPT_CACHE_MISS_TOKEN', amount: '2.2388090000000000' },
                    { type: 'RESPONSE_TOKEN', amount: '1.3987080000000000' },
                  ],
                },
              ],
            },
            {
              date: '2026-10-02',
              data: [
                {
                  model: 'deepseek-flash',
                  usage: [
                    { type: 'PROMPT_CACHE_HIT_TOKEN', amount: '9.4218470400000000' },
                    { type: 'PROMPT_CACHE_MISS_TOKEN', amount: '3.7133070000000000' },
                    { type: 'RESPONSE_TOKEN', amount: '5.7406440000000000' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

/* ------------------------------------------------------------------ *
 * 1. 金额解析绝不能截断
 * ------------------------------------------------------------------ */

test('toMoneyAmount 保留小数，而 toAmount 会把它截成 0', () => {
  const raw = '12.1115392000000000'
  // 这就是当初把金额做成全 0 的根因：token 的解析器用 Math.trunc。
  assert.equal(toAmount(raw), 12)
  assert.equal(toAmount('0.5'), 0)
  assert.equal(toMoneyAmount(raw), 12.1115392)
  assert.equal(toMoneyAmount('0.5'), 0.5)
  assert.equal(toMoneyAmount('0'), 0)
  assert.equal(toMoneyAmount(null), 0)
  assert.equal(toMoneyAmount(''), 0)
  assert.equal(toMoneyAmount('abc'), 0)
  // 非有限数归 0，不抛
  assert.equal(toMoneyAmount('Infinity'), 0)
})

/* ------------------------------------------------------------------ *
 * 2. biz_data 数组 vs 对象
 * ------------------------------------------------------------------ */

test('unwrapBizData 同时接受对象（amount）与数组（cost）', () => {
  // amount：对象
  const obj = { total: [{ model: 'm', usage: [] }], days: [{ date: '2026-10-01', data: [] }] } as BizData
  assert.equal(unwrapBizData(obj), obj)

  // cost：数组
  const arr = [{ total: [], days: [], currency: 'CNY' }]
  assert.deepEqual(unwrapBizData(arr), { total: [], days: [], currency: 'CNY' })

  // 空数组 / 非法输入一律降级为空对象，不抛
  assert.deepEqual(unwrapBizData([]), {})
  assert.deepEqual(unwrapBizData(null), {})
  assert.deepEqual(unwrapBizData(42), {})
})

test('parseCost 解析真实形状：总额、按模型（滤掉 0）、逐日五类、币种', () => {
  const biz = unwrapBizData(costFixture().data.biz_data)
  const c = parseCost(biz)

  assert.equal(c.currency, 'CNY')
  // 12.1115392 + 5.952116 + 7.139352 = 25.2030072
  assert.equal(c.amount, 25.2030072)
  assert.equal(moneyTotal(c.total), c.amount)
  // 请求不计费
  assert.equal(c.total.REQUEST, 0)

  // 全 0 的模型不进 costModels（否则界面会出现一行 ¥0.00）
  assert.deepEqual(Object.keys(c.models), ['deepseek-flash'])
  assert.equal(c.models['deepseek-flash'], 25.2030072)

  assert.equal(c.days.length, 2)
  assert.equal(c.days[0]!.date, '2026-10-01')
  // 2.68969216 + 2.238809 + 1.398708 = 6.32720916
  assert.equal(moneyTotal(c.days[0]!.cost), 6.32720916)
  // 逐日之和必须等于月度合计（实测接口就是这个性质，也是「日历加起来 = 月合计」的依据）
  const daySum = c.days.reduce((s, d) => s + moneyTotal(d.cost), 0)
  assert.ok(Math.abs(daySum - c.amount) < 1e-9, `逐日之和 ${daySum} 应等于月合计 ${c.amount}`)
})

test('parseCost 对缺 currency / 空 biz_data 的降级', () => {
  const c = parseCost({ total: [], days: [] })
  assert.equal(c.currency, 'CNY', '缺 currency 时默认 CNY')
  assert.equal(c.amount, 0)
  assert.deepEqual(c.models, {})
  assert.deepEqual(c.days, [])
  assert.equal(parseCost(null).amount, 0)
})

/* ------------------------------------------------------------------ *
 * 3. 逐日按 date 对齐
 * ------------------------------------------------------------------ */

test('parseDays 把金额按 date 合并，且不依赖两边顺序相同', () => {
  const amountBiz: BizData = {
    total: [],
    // amount 顺序：01 在前
    days: [
      { date: '2026-10-01', data: [{ model: 'm', usage: [{ type: 'PROMPT_TOKEN', amount: '100' }] }] },
      { date: '2026-10-02', data: [{ model: 'm', usage: [{ type: 'RESPONSE_TOKEN', amount: '7' }] }] },
    ],
  }
  const cost = parseCost({
    total: [],
    // cost 顺序**故意反过来**：只按 date 对齐才正确
    days: [
      { date: '2026-10-02', data: [{ model: 'm', usage: [{ type: 'RESPONSE_TOKEN', amount: '1.5' }] }] },
      { date: '2026-10-01', data: [{ model: 'm', usage: [{ type: 'PROMPT_TOKEN', amount: '2.5' }] }] },
    ],
  })

  const days = parseDays(amountBiz, cost)
  const map = new Map(days.map((d) => [d.date, d]))
  assert.equal(map.get('2026-10-01')!.stat.PROMPT_TOKEN, 100)
  assert.equal(moneyTotal(map.get('2026-10-01')!.cost), 2.5)
  assert.equal(map.get('2026-10-02')!.stat.RESPONSE_TOKEN, 7)
  assert.equal(moneyTotal(map.get('2026-10-02')!.cost), 1.5)
})

test('parseDays 在没传 cost 时不给 cost 字段（缺金额 ≠ 0 元）', () => {
  const days = parseDays({
    total: [],
    days: [{ date: '2026-10-01', data: [{ model: 'm', usage: [{ type: 'PROMPT_TOKEN', amount: '5' }] }] }],
  })
  assert.equal(days.length, 1)
  assert.equal('cost' in days[0]!, false, '没有金额数据时不应带 cost 字段')
})

/* ------------------------------------------------------------------ *
 * 4. 滚动窗口
 * ------------------------------------------------------------------ */

test('rollingWindow：含今天、共 N 天，且能跨越自然月', () => {
  const now = new Date(Date.UTC(2026, 9, 7)) // 平台日 2026-10-07（UTC）
  assert.deepEqual(rollingWindow(7, now), { from: '2026-10-01', to: '2026-10-07' })
  assert.deepEqual(rollingWindow(30, now), { from: '2026-09-08', to: '2026-10-07' })
  // 1 天 = 今天
  assert.deepEqual(rollingWindow(1, now), { from: '2026-10-07', to: '2026-10-07' })
  // 非法天数按 1 天处理，不产生反向区间
  assert.deepEqual(rollingWindow(0, now), { from: '2026-10-07', to: '2026-10-07' })
  assert.deepEqual(rollingWindow(-5, now), { from: '2026-10-07', to: '2026-10-07' })

  // 跨年：3 月 1 日的「近 30 天」要落到 1 月 31 日（跨两个月）
  const mar1 = new Date(Date.UTC(2026, 2, 1))
  assert.deepEqual(rollingWindow(30, mar1), { from: '2026-01-31', to: '2026-03-01' })

  // 与「当周/当月」口径不同：这是刻意的，两者在月初会明显不一致
  const firstOfMonth = new Date(Date.UTC(2026, 9, 1))
  assert.deepEqual(monthWindow(firstOfMonth), { from: '2026-10-01', to: '2026-10-01' })
  assert.deepEqual(rollingWindow(7, firstOfMonth), { from: '2026-09-25', to: '2026-10-01' })
  // 同一时刻，当周窗口与近 7 天窗口一般也不相同
  assert.notDeepEqual(weekWindow(firstOfMonth), rollingWindow(7, firstOfMonth))
  assert.deepEqual(todayWindow(firstOfMonth), { from: '2026-10-01', to: '2026-10-01' })
  assert.equal(dateKey(firstOfMonth), '2026-10-01')
})

test('平台日口径：北京时间凌晨仍属前一个 UTC 日桶（回归「今日恒为 0」）', () => {
  // 实测：北京时间 2026-10-08 00:20 持续对话，用量记进桶 2026-10-07
  // （30 秒 +5,110,422），桶 2026-10-08 恒为 0 —— 因为平台按 UTC 日切桶。
  const beijing0020 = new Date('2026-10-08T00:20:00+08:00')
  assert.equal(dateKey(beijing0020), '2026-10-07')
  assert.deepEqual(todayWindow(beijing0020), { from: '2026-10-07', to: '2026-10-07' })

  // 日界 = 00:00 UTC = 北京时间 08:00
  assert.equal(dateKey(new Date('2026-10-08T07:59:59+08:00')), '2026-10-07')
  assert.equal(dateKey(new Date('2026-10-08T08:00:00+08:00')), '2026-10-08')

  // 当周/当月窗口同样按平台日：周一 00:00 UTC 起算
  // 2026-10-08（周四）00:20 北京 = 2026-10-07 16:20 UTC，当周周一为 2026-10-05
  assert.deepEqual(weekWindow(beijing0020), { from: '2026-10-05', to: '2026-10-07' })
  assert.deepEqual(monthWindow(beijing0020), { from: '2026-10-01', to: '2026-10-07' })
})

/* ------------------------------------------------------------------ *
 * 5. 金额持久化往返
 * ------------------------------------------------------------------ */

function makeRow(over: Partial<MonthRow> = {}): MonthRow {
  const cost = emptyMoney()
  cost.PROMPT_CACHE_HIT_TOKEN = 12.1115392
  cost.PROMPT_CACHE_MISS_TOKEN = 5.952116
  cost.RESPONSE_TOKEN = 7.139352
  return {
    year: 2026,
    month: 10,
    stat: { ...emptyStat(), PROMPT_TOKEN: 0, PROMPT_CACHE_HIT_TOKEN: 576173824, RESPONSE_TOKEN: 1667660 },
    models: {},
    days: [
      {
        date: '2026-10-01',
        stat: { ...emptyStat(), PROMPT_CACHE_HIT_TOKEN: 134484608 },
        cost: { ...emptyMoney(), PROMPT_CACHE_HIT_TOKEN: 2.68969216, RESPONSE_TOKEN: 1.398708 },
      },
      { date: '2026-10-02', stat: emptyStat() },
    ],
    daysFetched: true,
    cost,
    costModels: { 'deepseek-flash': 25.2030072 },
    currency: 'CNY',
    costFetched: true,
    ...over,
  }
}

test('金额与逐日金额能往返序列化（否则每次重启都重打 31 次请求）', () => {
  const store = new HistoryStore()
  store.set(makeRow())
  const json = JSON.parse(JSON.stringify(store.serialize()))
  const back = HistoryStore.deserialize(json)

  const row = back.get(2026, 10)
  assert.ok(row, '该月必须被恢复')
  assert.ok(row.cost, '月度金额必须被恢复')
  assert.equal(moneyTotal(row.cost), 25.2030072)
  assert.equal(row.currency, 'CNY')
  assert.deepEqual(row.costModels, { 'deepseek-flash': 25.2030072 })
  assert.equal(row.costFetched, true)
  assert.equal(row.stat.PROMPT_CACHE_HIT_TOKEN, 576173824, 'token 数据不能被金额改动')
  assert.equal(row.days!.length, 2)
  assert.equal(moneyTotal(row.days![0]!.cost), 2.68969216 + 1.398708, '逐日金额必须被恢复')
  assert.equal('cost' in row.days![1]!, false, '没有金额的那天不应凭空多出 cost')
})

test('全 0 金额的缓存行视为「没有金额」，从而被一次性回补', () => {
  // 旧缓存（金额能力上线前）没有 cost 字段
  const old = HistoryStore.deserialize({ rows: [{ ...makeRow(), cost: undefined, costFetched: undefined }] })
  assert.equal(old.get(2026, 10)?.cost, undefined, '没有 cost 的行不应凭空得到金额')
  assert.equal(old.get(2026, 10)?.costFetched, undefined)
  // 计划器必须把它挑出来重抓（这是「金额能力上线后自动回补」的依据）
  const plan = old.plan({ year: 2024, month: 4 }, { year: 2026, month: 10 }, false, true)
  assert.ok(
    plan.months.some((m) => m.year === 2026 && m.month === 10),
    '缺金额的月份必须出现在需要回补的计划里',
  )

  // 反过来：已经有金额的行不该再被抓（否则每次全量刷新都多打一遍）
  const fresh = new HistoryStore()
  fresh.set(makeRow())
  const plan2 = fresh.plan({ year: 2026, month: 10 }, { year: 2026, month: 10 }, false, true)
  assert.deepEqual(plan2.months, [], '已有金额 + 已有逐日明细的月份不该被重抓')
})

test('全 0 的 Money 对象不视为「已抓到金额」（否则永远不再回补）', () => {
  // 模拟坏缓存：cost 存在但五项全 0
  const back = HistoryStore.deserialize({
    rows: [{ ...makeRow(), cost: emptyMoney(), costFetched: undefined }],
  })
  assert.equal(back.get(2026, 10)?.cost, undefined)
})

/* ------------------------------------------------------------------ *
 * 6. 缺金额 ≠ 0 元；costComplete
 * ------------------------------------------------------------------ */

test('costComplete 区分「全部月份都抓到金额」与「还有月份没抓」', () => {
  const store = new HistoryStore()
  store.set(makeRow())
  const lack = makeRow({ year: 2026, month: 9, cost: undefined, costFetched: undefined, days: [] })
  store.set(lack)

  const range = { start: { year: 2026, month: 9 }, end: { year: 2026, month: 10 } }
  assert.equal(store.costComplete(range.start, range.end), false, '9 月没金额 → 不完整')
  assert.deepEqual(store.plan(range.start, range.end, false, true).months, [{ year: 2026, month: 9 }])

  // 补上 9 月后即完整
  store.set(makeRow({ year: 2026, month: 9, costModels: {}, days: [] }))
  assert.equal(store.costComplete(range.start, range.end), true)
})

test('toReport 把金额汇总到总计 / 按年 / 按模型，且不污染 token 口径', () => {
  const store = new HistoryStore()
  store.set(makeRow())
  store.set(
    makeRow({
      month: 9,
      stat: { ...emptyStat(), PROMPT_TOKEN: 1000, RESPONSE_TOKEN: 200 },
      days: [],
      cost: { ...emptyMoney(), PROMPT_CACHE_HIT_TOKEN: 50.5 },
      costModels: { 'deepseek-flash': 50.5, 'deepseek-v4-pro': 0.5 },
      currency: 'CNY',
    }),
  )

  const rep = store.toReport({ year: 2026, month: 9 }, { year: 2026, month: 10 })
  assert.equal(rep.currency, 'CNY')
  assert.equal(rep.costComplete, true)
  // 总计金额 = 25.2030072 + 50.5
  assert.equal(moneyTotal(rep.grand.cost), 75.7030072)
  // token 总计不受金额影响：1000 + 200 + 576173824 + 1667660
  assert.equal(rep.grand.totalTokens, 1000 + 200 + 576173824 + 1667660)
  // 按年
  assert.equal(moneyTotal(rep.yearly['2026']!.cost), 75.7030072)
  // 按模型：金额单独走 modelCosts（接口按模型只有总额，没有五类拆分）
  assert.equal(rep.modelCosts['deepseek-flash'], 75.7030072)
  assert.equal(rep.modelCosts['deepseek-v4-pro'], 0.5)
})

test('toReport 在完全没有金额时不产出 cost（避免界面显示 ¥0.00）', () => {
  const store = new HistoryStore()
  store.set(makeRow({ cost: undefined, costModels: undefined, costFetched: undefined }))
  const rep = store.toReport({ year: 2026, month: 10 }, { year: 2026, month: 10 })
  assert.equal(rep.grand.cost, undefined, '没有任何金额数据时不应伪造出全 0 的 cost')
  assert.equal(rep.costComplete, false)
})

/* ------------------------------------------------------------------ *
 * 7. 金额格式化
 * ------------------------------------------------------------------ */

test('金额格式化：两位小数、千分位、精确值、万/亿缩写', () => {
  assert.equal(formatMoney(172.48), '¥172.48')
  assert.equal(formatMoney(0), '¥0.00')
  assert.equal(formatMoney(25.2030072), '¥25.20')
  assert.equal(formatMoney(1234567.891), '¥1,234,567.89')
  assert.equal(formatMoney(-3.5), '-¥3.50')
  assert.equal(formatMoney(Number.NaN), '¥0.00')

  // 精确值：最多 8 位小数、去掉尾随 0、带千分位
  assert.equal(formatMoneyFull(25.2030072), '¥25.2030072')
  assert.equal(formatMoneyFull(172.48), '¥172.48')
  assert.equal(formatMoneyFull(0), '¥0')
  assert.equal(formatMoneyFull(1234.5), '¥1,234.5')

  // 中文习惯用「万 / 亿」，而不是 K/M
  assert.equal(formatMoneyShort(172.48), '¥172.48')
  assert.equal(formatMoneyShort(12345.6), '¥1.23万')
  assert.equal(formatMoneyShort(123456789), '¥1.23亿')
  assert.equal(formatMoneyShort(9999), '¥9,999.00', '不足 1 万时用精确写法')
  // 按配置选择
  assert.equal(formatMoneyBy(172.48, 'full'), '¥172.48')
  assert.equal(formatMoneyBy(12345.6, 'short'), '¥1.23万')
  assert.equal(formatMoneyBy(12345.6, 'full'), '¥12,345.60')
})

/* ------------------------------------------------------------------ *
 * 8. 图表金额指标
 * ------------------------------------------------------------------ */

test('bucketMetricValue 从 bucket.cost 取金额（金额不在 stat 里）', () => {
  const months = [
    { key: '2026-09', stat: { ...emptyStat(), REQUEST: 5 }, cost: 186.04156218 },
    { key: '2026-10', stat: { ...emptyStat(), REQUEST: 3 }, cost: 25.27191484 },
  ]
  const buckets = monthBuckets(months)
  assert.equal(buckets.length, 2)
  assert.equal(bucketMetricValue(buckets[0]!, 'cost'), 186.04156218)
  // 金额不能从 stat 里取出来：这正是要单独走 bucket.cost 的原因
  assert.equal(bucketMetricValue(buckets[0]!, 'requests'), 5)
})

test('yearBuckets 按年汇总金额；缺金额的月份不参与（而不是当 0）', () => {
  const buckets = yearBuckets([
    { key: '2025-12', stat: { ...emptyStat(), RESPONSE_TOKEN: 10 }, cost: 3.137037 },
    { key: '2026-01', stat: { ...emptyStat(), RESPONSE_TOKEN: 5 }, cost: 0.038263 },
    // 这一月没有金额数据（尚未回补）
    { key: '2026-02', stat: { ...emptyStat(), RESPONSE_TOKEN: 1 } },
    { key: '2026-03', stat: { ...emptyStat(), RESPONSE_TOKEN: 2 }, cost: 2.559259 },
  ])
  const byYear = new Map(buckets.map((b) => [b.key, b]))
  assert.equal(bucketMetricValue(byYear.get('2025')!, 'cost'), 3.137037)
  assert.ok(Math.abs(bucketMetricValue(byYear.get('2026')!, 'cost') - (0.038263 + 2.559259)) < 1e-9)
  // token 侧不受影响
  assert.equal(bucketMetricValue(byYear.get('2026')!, 'output'), 5 + 1 + 2)
})

test('addMoneyInto 就地累加五类', () => {
  const acc = emptyMoney()
  addMoneyInto(acc, { ...emptyMoney(), PROMPT_TOKEN: 1.5, RESPONSE_TOKEN: 2.25 })
  addMoneyInto(acc, { ...emptyMoney(), PROMPT_TOKEN: 0.5 })
  addMoneyInto(acc, undefined)
  assert.equal(acc.PROMPT_TOKEN, 2)
  assert.equal(acc.RESPONSE_TOKEN, 2.25)
  assert.equal(moneyTotal(acc), 4.25)
})

/* ------------------------------------------------------------------ *
 * 9. 与 token 管线互不干扰
 * ------------------------------------------------------------------ */

test('mount 一个只有金额的响应不会影响 parseBizData 的 token 口径', () => {
  const costBiz = unwrapBizData(costFixture().data.biz_data)
  const cost = parseCost(costBiz)
  // cost 响应的 total[] 同样有「五类」字段名，但那里面装的是钱。
  // 绝不能把它当成 token 解析（否则 token 会变成一堆小数）。
  const asTokens = parseBizData(costBiz)
  assert.equal(asTokens.agg.PROMPT_TOKEN, 0)
  assert.equal(asTokens.agg.PROMPT_CACHE_HIT_TOKEN, 12, 'Math.trunc 会把金额截断 —— 所以两边必须分开解析')
  // 真正的 token 解析走 amount 响应，与金额无关
  const tokenBiz: BizData = {
    total: [{ model: 'deepseek-flash', usage: [{ type: 'PROMPT_CACHE_HIT_TOKEN', amount: '576173824' }] }],
    days: [],
  }
  assert.equal(parseBizData(tokenBiz).agg.PROMPT_CACHE_HIT_TOKEN, 576173824)
  assert.equal(moneyTotal(cost.total), 25.2030072)
})

test('MonthRow 的 days 在缺金额时仍能算出 token 窗口（金额是纯增量）', () => {
  const store = new HistoryStore()
  const stat: Stat = { ...emptyStat(), PROMPT_CACHE_HIT_TOKEN: 100, RESPONSE_TOKEN: 20, REQUEST: 3 }
  store.set({ year: 2026, month: 10, stat, models: {}, days: [{ date: '2026-10-07', stat }], daysFetched: true })
  const row = store.get(2026, 10)
  assert.equal(row?.days?.[0]?.stat.RESPONSE_TOKEN, 20)
  assert.equal(row?.days?.[0]?.cost, undefined)
  assert.equal(monthKey(2026, 10), '2026-10')
})

/* ------------------------------------------------------------------ *
 * 10. 请求层：URL 走对端点
 * ------------------------------------------------------------------ */

test('buildUrl 按 kind 选择端点：amount（token）与 cost（金额）', () => {
  assert.equal(buildUrl(2026, 10), `${BASE_URL}/usage/amount?year=2026&month=10`)
  assert.equal(buildUrl(2026, 10, 'amount'), `${BASE_URL}/usage/amount?year=2026&month=10`)
  assert.equal(buildUrl(2026, 10, 'cost'), `${BASE_URL}/usage/cost?year=2026&month=10`)
  // 月份补零交给调用方；这里只保证参数被编码
  assert.match(buildUrl(2026, 9, 'cost'), /year=2026&month=9$/)
})

/** 极简 fetch 替身：按 URL 命中返回预设 JSON。 */
function fakeFetch(routes: Record<string, unknown>, log?: string[]) {
  return async (url: string | URL | Request): Promise<Response> => {
    const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
    if (log) log.push(href)
    const hit = Object.entries(routes).find(([frag]) => href.includes(frag))
    const body = hit ? hit[1] : { code: 0, msg: '', data: { biz_code: 0, biz_msg: '', biz_data: {} } }
    return {
      status: 200,
      json: async () => body,
      headers: { get: () => null },
    } as unknown as Response
  }
}

test('fetchMonth(kind=cost) 归一化数组形状的 biz_data（不归一化就静默全 0）', async () => {
  const res = await fetchMonth({
    token: 't',
    year: 2026,
    month: 10,
    kind: 'cost',
    fetchImpl: fakeFetch({ '/usage/cost': costFixture() }) as unknown as typeof fetch,
  })
  assert.equal(res.ok, true)
  assert.ok(res.ok)
  const c = parseCost(res.bizData)
  assert.equal(c.amount, 25.2030072, 'cost 的 biz_data 是数组，必须被 unwrapBizData 抹平')
})

test('fetchAccountSummary 解析余额与官方累计消费', async () => {
  const res = await fetchAccountSummary({
    token: 't',
    fetchImpl: fakeFetch({
      '/users/get_user_summary': {
        code: 0,
        msg: '',
        data: {
          biz_code: 0,
          biz_msg: '',
          biz_data: {
            normal_wallets: [{ currency: 'CNY', balance: '41.4566270200000000', token_estimation: '0' }],
            bonus_wallets: [{ currency: 'CNY', balance: '0', token_estimation: '0' }],
            total_costs: [{ currency: 'CNY', amount: '675.7352108600000000' }],
          },
        },
      },
    }) as unknown as typeof fetch,
  })
  assert.equal(res.ok, true)
  assert.ok(res.ok)
  assert.equal(res.summary.currency, 'CNY')
  assert.equal(res.summary.balance, 41.45662702)
  assert.equal(res.summary.bonusBalance, 0)
  assert.equal(res.summary.totalCosts, 675.73521086)
})

test('fetchAccountSummary 缺字段/异常时降级为 0，而不是抛错', async () => {
  const res = await fetchAccountSummary({
    token: 't',
    fetchImpl: fakeFetch({ '/users/get_user_summary': { code: 0, data: { biz_code: 0, biz_data: {} } } }) as unknown as typeof fetch,
  })
  assert.equal(res.ok, true)
  assert.ok(res.ok)
  assert.deepEqual(res.summary, { balance: 0, bonusBalance: 0, totalCosts: 0, currency: 'CNY' })
})

test('fetchAccountSummary 认证失败时如实报 unauthorized（不伪装成 0 余额）', async () => {
  const res = await fetchAccountSummary({
    token: 't',
    fetchImpl: fakeFetch({ '/users/get_user_summary': { code: 40003, msg: 'Authorization Failed' } }) as unknown as typeof fetch,
  })
  assert.equal(res.ok, false)
  assert.ok(!res.ok)
  assert.equal(res.error.kind, 'unauthorized')
})

/* ------------------------------------------------------------------ *
 * 11. 服务端刷新：一个月要打两遍（amount + cost），近月优先
 * ------------------------------------------------------------------ */

function monthAmountPayload(hit: number, out: number, req: number, day: string) {
  return {
    code: 0,
    msg: '',
    data: {
      biz_code: 0,
      biz_msg: '',
      biz_data: {
        total: [
          {
            model: 'deepseek-flash',
            usage: [
              { type: 'PROMPT_CACHE_HIT_TOKEN', amount: String(hit) },
              { type: 'RESPONSE_TOKEN', amount: String(out) },
              { type: 'REQUEST', amount: String(req) },
            ],
          },
        ],
        days: [
          {
            date: day,
            data: [
              {
                model: 'deepseek-flash',
                usage: [
                  { type: 'PROMPT_CACHE_HIT_TOKEN', amount: String(hit) },
                  { type: 'RESPONSE_TOKEN', amount: String(out) },
                  { type: 'REQUEST', amount: String(req) },
                ],
              },
            ],
          },
        ],
      },
    },
  }
}

function monthCostPayload(amount: number, day: string) {
  return {
    code: 0,
    msg: '',
    data: {
      biz_code: 0,
      biz_msg: '',
      biz_data: [
        {
          currency: 'CNY',
          total: [
            {
              model: 'deepseek-flash',
              usage: [
                { type: 'PROMPT_CACHE_HIT_TOKEN', amount: amount.toFixed(10) },
              ],
            },
          ],
          days: [
            {
              date: day,
              data: [
                { model: 'deepseek-flash', usage: [{ type: 'PROMPT_CACHE_HIT_TOKEN', amount: amount.toFixed(10) }] },
              ],
            },
          ],
        },
      ],
    },
  }
}

test('一次刷新同时抓 token 与金额，并把金额落进历史（近月优先）', async () => {
  const history = new HistoryStore()
  const projectHistory = new ProjectHistoryStore()
  const calls: string[] = []
  // 按 URL 里的 year/month 精确回放
  const routes: Record<string, unknown> = {}
  for (const [y, m, hit, out, req, amount] of [
    [2026, 9, 100, 10, 2, 50.5],
    [2026, 10, 900, 30, 5, 25.25],
  ] as Array<[number, number, number, number, number, number]>) {
    const day = `${y}-${String(m).padStart(2, '0')}-07`
    routes[`/usage/amount?year=${y}&month=${m}`] = monthAmountPayload(hit, out, req, day)
    routes[`/usage/cost?year=${y}&month=${m}`] = monthCostPayload(amount, day)
  }
  routes['/users/get_user_summary'] = {
    code: 0,
    data: {
      biz_code: 0,
      biz_data: {
        normal_wallets: [{ currency: 'CNY', balance: '12.5' }],
        bonus_wallets: [],
        total_costs: [{ currency: 'CNY', amount: '99.75' }],
      },
    },
  }

  const service = new UsageService({
    // 金额默认不进紧凑条（见 src/config.ts），这里显式开启 cost_total 才能从
    // snapshot.compact 里读到它 —— 本用例验证的是金额链路，不是默认值。
    config: resolveConfig(
      {
        startYear: 2026,
        startMonth: 9,
        requestIntervalMs: 0,
        compactMetrics: ['total', 'cost_total'],
      },
      () => undefined,
    ),
    history,
    projectHistory,
    resolveToken: async () => ({ token: 'fake-token', source: 'config' }),
    authState: async () => ({ status: 'ok', source: 'config' }),
    now: () => new Date(2026, 9, 7, 12, 0, 0),
    fetchImpl: fakeFetch(routes, calls) as unknown as typeof fetch,
    sleep: async () => {},
    projectProvider: { available: () => false, list: async () => [] },
  })

  await service.refresh('manual')

  // 每个月都要打两遍：amount 与 cost
  assert.equal(calls.filter((u) => u.includes('/usage/amount')).length, 2)
  assert.equal(calls.filter((u) => u.includes('/usage/cost')).length, 2)
  // 账户概览只打一次
  assert.equal(calls.filter((u) => u.includes('get_user_summary')).length, 1)

  // 近月优先：第一次请求应该是 2026-10 的 amount，而不是 9 月
  assert.match(calls[0]!, /year=2026&month=10/)

  // 金额落进历史
  const oct = history.get(2026, 10)
  assert.equal(oct?.costFetched, true)
  assert.equal(moneyTotal(oct?.cost), 25.25)
  assert.equal(oct?.days?.[0]?.cost?.PROMPT_CACHE_HIT_TOKEN, 25.25)
  assert.deepEqual(oct?.costModels, { 'deepseek-flash': 25.25 })
  assert.equal(oct?.currency, 'CNY')

  // 快照：金额与账户概览都到位
  const snap = await service.snapshot()
  assert.equal(snap.costComplete, true, '两个月都抓到金额 → 完整')
  assert.equal(snap.account?.balance, 12.5)
  assert.equal(snap.account?.totalCosts, 99.75)
  // 总金额 = 50.5 + 25.25
  const totalMoney = snap.compact.find((m) => m.unit === 'money')
  assert.equal(totalMoney?.value, 75.75)
  // token 口径不受金额影响：100+10 + 900+30
  assert.equal(snap.cards.find((c) => c.scope === 'total')?.stat.totalTokens, 1040)
})

test('金额端点失败不影响该月的 token 数据（少一列 ≠ 整月丢）', async () => {
  const history = new HistoryStore()
  const projectHistory = new ProjectHistoryStore()
  const routes: Record<string, unknown> = {
    '/usage/amount?year=2026&month=10': monthAmountPayload(500, 50, 4, '2026-10-07'),
    // cost 端点故意失败
    '/usage/cost?year=2026&month=10': { code: 50001, msg: 'boom' },
  }
  const service = new UsageService({
    config: resolveConfig({ startYear: 2026, startMonth: 10, requestIntervalMs: 0 }, () => undefined),
    history,
    projectHistory,
    resolveToken: async () => ({ token: 'fake-token', source: 'config' }),
    authState: async () => ({ status: 'ok', source: 'config' }),
    now: () => new Date(2026, 9, 7, 12, 0, 0),
    fetchImpl: fakeFetch(routes) as unknown as typeof fetch,
    sleep: async () => {},
    logger: undefined,
    projectProvider: { available: () => false, list: async () => [] },
  })

  await service.refresh('manual')

  const row = history.get(2026, 10)
  assert.equal(row?.error, undefined, '金额失败不应把整月标记为失败')
  assert.equal(row?.stat.PROMPT_CACHE_HIT_TOKEN, 500, 'token 数据必须保留')
  assert.equal(row?.cost, undefined, '金额确实没拿到')
  assert.equal(row?.costFetched, undefined, '没拿到就不能打标记，否则再也不会回补')
  // 下一次刷新必须重试金额
  assert.deepEqual(
    history.plan({ year: 2026, month: 10 }, { year: 2026, month: 10 }, false, true).months,
    [{ year: 2026, month: 10 }],
  )
  const snap = await service.snapshot()
  assert.equal(snap.costComplete, false, '有月份缺金额 → 不能宣称完整')
})

// ------------------------------------------------------------ 凭据租约生命周期
//
// 安全需求：账号会话凭据**只在刷新期间**被索取，拉取一结束立刻释放；刷新之外
// （尤其是客户端每 800ms 一次的 snapshot 轮询）绝不向宿主伸手。
//
// 这里刻意把 harness 造成「只有租约生效时才拿得到令牌」—— 若 service 不再持有
// 租约，拉取会因为拿不到令牌而失败，测试立刻可见；而不是悄悄退化成
// 「每次 snapshot 都去宿主要一次令牌」。

function leaseHarness() {
  const state = { active: false, depth: 0, begins: 0, ends: 0 }
  return {
    state,
    hooks: {
      beginCredentialLease: async () => {
        state.begins++
        state.depth++
        state.active = true
      },
      endCredentialLease: () => {
        state.ends++
        state.depth--
        state.active = state.depth > 0
      },
    },
    /** 模拟 TokenManager：租约之外取不到账号会话凭据。 */
    resolveToken: async () =>
      state.active ? { token: 'leased-token', source: 'platform-session' as const } : undefined,
  }
}

test('凭据租约：刷新期间才持有账号凭据，刷新一结束立刻释放', async () => {
  const history = new HistoryStore()
  const projectHistory = new ProjectHistoryStore()
  const lease = leaseHarness()
  let leaseDuringRequest: boolean[] = []
  const inner = fakeFetch({
    '/usage/amount?year=2026&month=10': monthAmountPayload(500, 50, 4, '2026-10-07'),
  })

  const service = new UsageService({
    config: resolveConfig({ startYear: 2026, startMonth: 10, requestIntervalMs: 0 }, () => undefined),
    history,
    projectHistory,
    resolveToken: lease.resolveToken,
    ...lease.hooks,
    authState: async () => ({ status: 'ok', source: 'platform-session' }),
    now: () => new Date(2026, 9, 7, 12, 0, 0),
    fetchImpl: (async (u: string | URL | Request) => {
      leaseDuringRequest.push(lease.state.active)
      return inner(u)
    }) as unknown as typeof fetch,
    sleep: async () => {},
    projectProvider: { available: () => false, list: async () => [] },
  })

  // 刷新之前：没有租约，凭据不可得。
  assert.equal(await lease.resolveToken(), undefined)
  assert.equal(lease.state.begins, 0)

  await service.refresh('manual')

  assert.equal(lease.state.begins, 1, '一次刷新只索取一次凭据')
  assert.equal(lease.state.ends, 1, '刷新结束必须释放')
  assert.equal(lease.state.active, false, '刷新结束后不得再持有凭据引用')
  assert.ok(leaseDuringRequest.length > 0, '确实发出过请求')
  assert.ok(
    leaseDuringRequest.every(Boolean),
    '网络阶段全程租约有效（否则会拿不到令牌）',
  )
  // 数据确实落库 → 证明租约在拉取期间真的生效，而不是「刚好没用到令牌」。
  assert.equal(history.get(2026, 10)?.stat.PROMPT_CACHE_HIT_TOKEN, 500)
  // 刷新之后凭据再次不可得。
  assert.equal(await lease.resolveToken(), undefined)
})

test('凭据租约：刷新抛错也必定释放（不把凭据漏在内存里）', async () => {
  const lease = leaseHarness()
  const service = new UsageService({
    config: resolveConfig({ startYear: 2026, startMonth: 10, requestIntervalMs: 0 }, () => undefined),
    history: new HistoryStore(),
    projectHistory: new ProjectHistoryStore(),
    // 解析凭据时直接抛错 —— 模拟账号服务异常，异常必须穿过 finally。
    resolveToken: async () => {
      throw new Error('account service exploded')
    },
    ...lease.hooks,
    authState: async () => ({ status: 'ok', source: 'platform-session' }),
    now: () => new Date(2026, 9, 7, 12, 0, 0),
    fetchImpl: fakeFetch({}) as unknown as typeof fetch,
    sleep: async () => {},
    projectProvider: { available: () => false, list: async () => [] },
  })

  await assert.rejects(() => service.refresh('manual'))

  assert.equal(lease.state.begins, 1)
  assert.equal(lease.state.ends, 1, '异常路径也必须释放租约')
  assert.equal(lease.state.active, false)
})

test('凭据租约：snapshot 轮询是热路径，绝不索取账号凭据', async () => {
  const lease = leaseHarness()
  const service = new UsageService({
    config: resolveConfig({ startYear: 2026, startMonth: 10, requestIntervalMs: 0 }, () => undefined),
    history: new HistoryStore(),
    projectHistory: new ProjectHistoryStore(),
    resolveToken: lease.resolveToken,
    ...lease.hooks,
    // 真实链路里 authState 会走 TokenManager.state()，它同样不得索取凭据；
    // 这里断言的是 service 侧：snapshot 不碰租约钩子。
    authState: async () => ({ status: 'ok', source: 'platform-session' }),
    now: () => new Date(2026, 9, 7, 12, 0, 0),
    fetchImpl: fakeFetch({}) as unknown as typeof fetch,
    sleep: async () => {},
    projectProvider: { available: () => false, list: async () => [] },
  })

  // 连续多轮轮询（模拟刷新期间的 800ms 轮询）。
  for (let i = 0; i < 8; i++) await service.snapshot()

  assert.equal(lease.state.begins, 0, 'snapshot 是热路径，绝不能在这里取凭据')
  assert.equal(lease.state.ends, 0)
})
