/**
 * 缓存与历史存储单测。
 *
 * 覆盖需求 1.5（TTL：总消耗 30 分钟 / 当前 5 分钟）、
 * 需求 5.4（失败时用过期缓存兜底）、
 * 需求零.5（首次全量 + 后续只拉增量月份）。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { CACHE_TTL, TtlCache, getOrLoad, ttlForScope } from '../lib/store/cache.js'
import {
  HistoryStore,
  enumerateMonths,
  localYearMonth,
  monthIndex,
  monthKey,
  nextMonth,
  parseMonthKey,
  prevMonth,
  utcYearMonth,
} from '../lib/store/history.js'
import { emptyStat } from '../lib/types.js'

// ---------------------------------------------------------------- TTL 缓存

test('ttlForScope：total 用 30 分钟，其余用 5 分钟', () => {
  assert.equal(ttlForScope('total'), CACHE_TTL.total)
  assert.equal(CACHE_TTL.total, 30 * 60 * 1000)
  assert.equal(CACHE_TTL.current, 5 * 60 * 1000)
  for (const scope of ['today', 'week', 'month'] as const) {
    assert.equal(ttlForScope(scope), CACHE_TTL.current)
  }
})

test('TtlCache：新鲜命中标记 stale=false，超时后 stale=true', () => {
  let now = 1000
  const cache = new TtlCache<number>(() => now)
  cache.write('k', 1)

  let read = cache.read('k', 5000)
  assert.equal(read?.value, 1)
  assert.equal(read?.stale, false)

  now = 1000 + 5000
  read = cache.read('k', 5000)
  assert.equal(read?.stale, false, '恰好等于 TTL 时仍算新鲜（age > ttl 才 stale）')

  now = 1000 + 5001
  read = cache.read('k', 5000)
  assert.equal(read?.stale, true)
  assert.equal(read?.age, 5001)
})

test('TtlCache：peek 不判定新鲜度（紧凑条只读缓存）', () => {
  let now = 0
  const cache = new TtlCache<string>(() => now)
  cache.write('k', 'v')
  now = 10 ** 9
  assert.equal(cache.peek('k')?.value, 'v')
  assert.equal(cache.peek('missing'), undefined)
})

test('TtlCache：isFresh / delete / clear / size', () => {
  let now = 0
  const cache = new TtlCache<number>(() => now)
  cache.write('a', 1)
  cache.write('b', 2)
  assert.equal(cache.size, 2)
  assert.equal(cache.isFresh('a', 100), true)
  now = 101
  assert.equal(cache.isFresh('a', 100), false)
  assert.equal(cache.delete('a'), true)
  assert.equal(cache.delete('a'), false)
  cache.clear()
  assert.equal(cache.size, 0)
})

test('getOrLoad：命中新鲜缓存时不调用 loader', async () => {
  const cache = new TtlCache<number>(() => 0)
  cache.write('k', 7)
  let calls = 0
  const r = await getOrLoad(cache, 'k', 1000, async () => {
    calls++
    return 99
  })
  assert.equal(r.value, 7)
  assert.equal(r.loaded, false)
  assert.equal(r.stale, false)
  assert.equal(calls, 0, '紧凑条数字必须只读缓存，不主动触发请求')
})

test('getOrLoad：过期时调用 loader 并写回', async () => {
  let now = 0
  const cache = new TtlCache<number>(() => now)
  cache.write('k', 1)
  now = 10_000
  const r = await getOrLoad(cache, 'k', 1000, async () => 2)
  assert.equal(r.value, 2)
  assert.equal(r.loaded, true)
  assert.equal(r.stale, false)
})

test('getOrLoad：force 绕过新鲜缓存（手动刷新）', async () => {
  const cache = new TtlCache<number>(() => 0)
  cache.write('k', 1)
  const r = await getOrLoad(cache, 'k', 10 ** 9, async () => 2, { force: true })
  assert.equal(r.value, 2)
  assert.equal(r.loaded, true)
})

test('getOrLoad：loader 失败时回退到过期缓存并标记 stale（需求 5.4）', async () => {
  let now = 0
  const cache = new TtlCache<number>(() => now)
  cache.write('k', 42)
  now = 10_000
  const r = await getOrLoad(cache, 'k', 1000, async () => {
    throw new Error('network down')
  })
  assert.equal(r.value, 42)
  assert.equal(r.stale, true)
  assert.ok(r.error instanceof Error)
})

test('getOrLoad：无缓存且 loader 失败时抛出', async () => {
  const cache = new TtlCache<number>(() => 0)
  await assert.rejects(
    () =>
      getOrLoad(cache, 'k', 1000, async () => {
        throw new Error('boom')
      }),
    /boom/,
  )
})

// ---------------------------------------------------------------- 月份工具

test('monthKey / parseMonthKey 往返，非法输入返回 undefined', () => {
  assert.equal(monthKey(2026, 10), '2026-10')
  assert.deepEqual(parseMonthKey('2026-10'), { year: 2026, month: 10 })
  assert.equal(parseMonthKey('2026-13'), undefined)
  assert.equal(parseMonthKey('2026-00'), undefined)
  assert.equal(parseMonthKey('26-1'), undefined)
  assert.equal(parseMonthKey('nope'), undefined)
})

test('nextMonth / prevMonth 跨年滚动（对应 Python py:190-193）', () => {
  assert.deepEqual(nextMonth(2026, 11), { year: 2026, month: 12 })
  assert.deepEqual(nextMonth(2026, 12), { year: 2027, month: 1 })
  assert.deepEqual(prevMonth(2026, 1), { year: 2025, month: 12 })
  assert.deepEqual(prevMonth(2026, 5), { year: 2026, month: 4 })
})

test('enumerateMonths：闭区间、升序、跨年正确', () => {
  const months = enumerateMonths({ year: 2024, month: 11 }, { year: 2025, month: 2 })
  assert.deepEqual(
    months.map((m) => monthKey(m.year, m.month)),
    ['2024-11', '2024-12', '2025-01', '2025-02'],
  )
  assert.deepEqual(enumerateMonths({ year: 2025, month: 1 }, { year: 2024, month: 1 }), [])
})

test('utcYearMonth / localYearMonth 使用各自日历时区', () => {
  // 2026-01-01T00:30+08:00 === 2025-12-31T16:30Z —— 跨月边界
  const d = new Date('2025-12-31T16:30:00Z')
  assert.deepEqual(utcYearMonth(d), { year: 2025, month: 12 })
  // 本地时区在 CI 上可能不同，因此只断言「本地」口径与 Date 自身一致。
  assert.deepEqual(localYearMonth(d), { year: d.getFullYear(), month: d.getMonth() + 1 })
})

test('monthIndex 单调递增，可用于排序与比较', () => {
  assert.ok(monthIndex(2024, 12) < monthIndex(2025, 1))
  assert.equal(monthIndex(2025, 1) - monthIndex(2024, 1), 12)
})

// ---------------------------------------------------------------- 历史计划

test('plan(full)：首次拉取区间内全部月份', () => {
  const h = new HistoryStore()
  const plan = h.plan({ year: 2024, month: 4 }, { year: 2024, month: 6 }, false)
  assert.deepEqual(plan.months.map((m) => monthKey(m.year, m.month)), ['2024-04', '2024-05', '2024-06'])
  assert.equal(plan.full, true)
})

test('plan(full)：跳过已成功缓存**且逐日明细已抓取**的月份', () => {
  const h = new HistoryStore()
  h.set({ year: 2024, month: 4, stat: emptyStat(), models: {}, daysFetched: true })
  const plan = h.plan({ year: 2024, month: 4 }, { year: 2024, month: 6 }, false)
  assert.deepEqual(plan.months.map((m) => monthKey(m.year, m.month)), ['2024-05', '2024-06'])
  assert.equal(plan.full, false)
})

test('plan(full)：旧缓存缺 daysFetched 时一次性回补逐日明细，且只回补一次', () => {
  const h = new HistoryStore()
  // 模拟早期版本写入的行：有统计、能显示合计，但没有逐日明细标记
  h.set({ year: 2024, month: 4, stat: emptyStat(), models: {} })

  const first = h.plan({ year: 2024, month: 4 }, { year: 2024, month: 4 }, false)
  assert.deepEqual(
    first.months.map((m) => monthKey(m.year, m.month)),
    ['2024-04'],
    '缺少 daysFetched 的旧行必须被重抓一次（否则日历对这些月份永久空白）',
  )

  // 抓取完成后打上标记 → 不应再被判为需要回补，否则每次刷新都白跑全量请求
  h.set({ year: 2024, month: 4, stat: emptyStat(), models: {}, daysFetched: true })
  const second = h.plan({ year: 2024, month: 4 }, { year: 2024, month: 4 }, false)
  assert.deepEqual(second.months, [], '回补过一次后必须跳过')
})

test('serialize/deserialize 必须保留 days 与 daysFetched（否则重启后日历永久空白）', () => {
  const h = new HistoryStore()
  const dayStat = emptyStat()
  dayStat.REQUEST = 9
  h.set({
    year: 2025,
    month: 3,
    stat: emptyStat(),
    models: {},
    days: [
      { date: '2025-03-01', stat: dayStat },
      { date: '2025-03-02', stat: emptyStat() },
    ],
    daysFetched: true,
  })

  const restored = HistoryStore.deserialize(JSON.parse(JSON.stringify(h.serialize())))
  const row = restored.get(2025, 3)
  assert.equal(row?.days?.length, 2, '逐日明细必须被恢复')
  assert.equal(row?.days?.[0]?.date, '2025-03-01')
  assert.equal(row?.days?.[0]?.stat.REQUEST, 9)
  assert.equal(row?.daysFetched, true, 'daysFetched 必须被恢复，否则每次重启都会白跑一轮全量回补')
})

test('plan(full)：失败的月份必须重试', () => {
  const h = new HistoryStore()
  h.set({
    year: 2024,
    month: 5,
    stat: emptyStat(),
    models: {},
    error: { kind: 'network', message: 'boom' },
  })
  assert.equal(h.hasFailures, true)
  const plan = h.plan({ year: 2024, month: 5 }, { year: 2024, month: 5 }, false)
  assert.deepEqual(plan.months.map((m) => monthKey(m.year, m.month)), ['2024-05'])
})

test('plan(incremental)：只拉当月 + 上月', () => {
  const h = new HistoryStore()
  const plan = h.plan({ year: 2024, month: 4 }, { year: 2026, month: 1 }, true)
  assert.deepEqual(plan.months.map((m) => monthKey(m.year, m.month)), ['2025-12', '2026-01'])
  assert.equal(plan.full, false)
})

test('plan(incremental)：上月早于区间起点时被裁剪', () => {
  const h = new HistoryStore()
  const plan = h.plan({ year: 2024, month: 4 }, { year: 2024, month: 4 }, true)
  assert.deepEqual(plan.months.map((m) => monthKey(m.year, m.month)), ['2024-04'])
})

test('isComplete：缺月或有失败月都不算完整', () => {
  const h = new HistoryStore()
  const start = { year: 2024, month: 4 }
  const end = { year: 2024, month: 5 }
  assert.equal(h.isComplete(start, end), false)
  h.set({ year: 2024, month: 4, stat: emptyStat(), models: {} })
  assert.equal(h.isComplete(start, end), false)
  h.set({ year: 2024, month: 5, stat: emptyStat(), models: {} })
  assert.equal(h.isComplete(start, end), true)
  h.set({ year: 2024, month: 5, stat: emptyStat(), models: {}, error: { kind: 'http', message: 'x' } })
  assert.equal(h.isComplete(start, end), false)
})

test('toReport：grand / yearly / models 的累加口径与 Python main() 一致', () => {
  const h = new HistoryStore()

  const apr = emptyStat()
  apr.PROMPT_TOKEN = 100
  apr.RESPONSE_TOKEN = 50
  apr.REQUEST = 5
  h.set({ year: 2024, month: 4, stat: apr, models: { alpha: { ...apr } } })

  const may = emptyStat()
  may.PROMPT_CACHE_HIT_TOKEN = 10
  may.RESPONSE_TOKEN = 20
  may.REQUEST = 7
  h.set({ year: 2024, month: 5, stat: may, models: { alpha: { ...may }, beta: { ...may } } })

  const report = h.toReport({ year: 2024, month: 4 }, { year: 2024, month: 5 })

  // 总计：输入 = 100 + 10 = 110，输出 = 70
  assert.equal(report.grand.inputTokens, 110)
  assert.equal(report.grand.outputTokens, 70)
  assert.equal(report.grand.totalTokens, 180)
  assert.equal(report.grand.requests, 12)
  assert.equal(report.range.start, '2024-04')
  assert.equal(report.range.end, '2024-05')

  // 按年（只覆盖 2024，且两年都为空时也不该凭空出现）
  assert.deepEqual(Object.keys(report.yearly), ['2024'])
  assert.equal(report.yearly['2024']!.totalTokens, 180)

  // 按模型：alpha 出现在两个月，累加 150 + 30 = 180；beta 只有 5 月 = 30
  assert.equal(report.models['alpha']!.totalTokens, 180)
  assert.equal(report.models['beta']!.totalTokens, 30)

  // 逐月行按升序
  assert.deepEqual(
    report.monthly.map((r) => monthKey(r.year, r.month)),
    ['2024-04', '2024-05'],
  )
})

test('toReport：失败月份贡献 0 但保留占位行', () => {
  const h = new HistoryStore()
  h.set({ year: 2024, month: 4, stat: emptyStat(), models: {} })
  h.set({
    year: 2024,
    month: 5,
    stat: emptyStat(),
    models: {},
    error: { kind: 'http', message: 'HTTP 500' },
  })
  const report = h.toReport({ year: 2024, month: 4 }, { year: 2024, month: 5 })
  assert.equal(report.monthly.length, 2)
  assert.equal(report.monthly[1]!.error?.message, 'HTTP 500')
  assert.equal(report.grand.totalTokens, 0)
})

test('serialize 不落盘 error：平台响应体的截断回显不该写进本地文件', () => {
  const h = new HistoryStore()
  const stat = emptyStat()
  stat.REQUEST = 7
  h.set({
    year: 2026,
    month: 4,
    stat,
    models: {},
    // 模拟「HTTP 500: <平台响应体前 200 字符>」这类外部文本
    error: { kind: 'http', message: 'HTTP 500: 平台返回的原始文本 <script>alert(1)</script>', status: 500 },
  })

  const json = JSON.stringify(h.serialize())
  assert.equal(json.includes('平台返回的原始文本'), false, 'error 文本不得进入持久化 JSON')
  assert.equal(json.includes('<script>'), false)
  assert.equal(json.includes('"error"'), false, '序列化结果里不应出现 error 字段')

  // 但用量计数必须完整保留
  const restored = HistoryStore.deserialize(JSON.parse(json))
  assert.equal(restored.get(2026, 4)?.stat.REQUEST, 7)
})

test('serialize / deserialize 往返，且对坏数据健壮', () => {
  const h = new HistoryStore()
  const stat = emptyStat()
  stat.REQUEST = 11
  stat.PROMPT_TOKEN = 3
  h.set({ year: 2025, month: 7, stat, models: { m: { ...stat } } })

  const restored = HistoryStore.deserialize(JSON.parse(JSON.stringify(h.serialize())))
  assert.equal(restored.size, 1)
  const row = restored.get(2025, 7)
  assert.equal(row?.stat.REQUEST, 11)
  assert.equal(row?.models['m']?.PROMPT_TOKEN, 3)

  // 坏数据不应抛错
  for (const bad of [null, undefined, 42, 'x', {}, { rows: 'nope' }, { rows: [null, 1, {}] }]) {
    const s = HistoryStore.deserialize(bad)
    assert.equal(s.size, 0)
  }

  // 缺字段的旧缓存应补 0，而不是把 undefined 扩散成 NaN
  const partial = HistoryStore.deserialize({ rows: [{ year: 2025, month: 1, stat: { REQUEST: 5 }, models: { m: { REQUEST: 2 } } }] })
  const r = partial.get(2025, 1)
  assert.equal(r?.stat.REQUEST, 5)
  assert.equal(r?.stat.PROMPT_TOKEN, 0)
  assert.equal(r?.models['m']?.REQUEST, 2)
  assert.equal(r?.models['m']?.RESPONSE_TOKEN, 0)
})

test('clear 清空全部状态（退出登录路径）', () => {
  const h = new HistoryStore()
  h.set({ year: 2024, month: 4, stat: emptyStat(), models: {} })
  h.clear()
  assert.equal(h.size, 0)
  assert.equal(h.updatedAt, null)
  assert.equal(h.hasFailures, false)
})
