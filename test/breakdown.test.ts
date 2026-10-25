/**
 * 「拆分」页签的数据：token 构成与花费构成必须同源（平台口径），否则占比的分母会打架。
 * 这里钉住三件事：总计读全量报告、当月/今日按逐日明细累加、缺金额的窗口要标 partial。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { emptyMoney, emptyStat } from '../lib/types.js'
import { HistoryStore } from '../lib/store/history.js'
import { ProjectHistoryStore } from '../lib/store/project-history.js'
import { resolveConfig } from '../lib/config.js'
import { UsageService } from '../lib/service.js'

const money = (hit: number, miss: number, out: number) => {
  const m = emptyMoney()
  m.PROMPT_CACHE_HIT_TOKEN = hit
  m.PROMPT_CACHE_MISS_TOKEN = miss
  m.RESPONSE_TOKEN = out
  return m
}

const dayStat = (hit: number, miss: number, out: number, requests: number) => {
  const s = emptyStat()
  s.PROMPT_CACHE_HIT_TOKEN = hit
  s.PROMPT_CACHE_MISS_TOKEN = miss
  s.RESPONSE_TOKEN = out
  s.REQUEST = requests
  return s
}

function makeService(history: HistoryStore, now: Date, startMonth = 10): UsageService {
  return new UsageService({
    config: resolveConfig({ startYear: 2026, startMonth, requestIntervalMs: 0 }, () => undefined),
    history,
    projectHistory: new ProjectHistoryStore(),
    resolveToken: async () => undefined,
    authState: async () => ({ status: 'ok', source: 'config' }),
    now: () => now,
    sleep: async () => {},
  })
}

test('拆分：总计读全量、当月/今日按逐日累加，且 token 与金额来自同一天桶', () => {
  const now = new Date(2026, 9, 15, 12, 0, 0)
  const history = new HistoryStore()

  // 9 月：整月 500/100/50，金额 0.5/0.1/0.05（没有逐日明细）
  history.set({
    year: 2026,
    month: 9,
    stat: dayStat(500, 100, 50, 6),
    models: {},
    cost: money(0.5, 0.1, 0.05),
    currency: 'CNY',
    costFetched: true,
    daysFetched: true,
  })

  // 10 月：两天，其中 10-14 缺金额 → 当月的 partial 必须为 true
  const total = dayStat(1500, 300, 150, 18)
  history.set({
    year: 2026,
    month: 10,
    stat: total,
    models: {},
    days: [
      { date: '2026-10-14', stat: dayStat(600, 200, 100, 9) },
      { date: '2026-10-15', stat: dayStat(900, 100, 50, 9), cost: money(0.9, 0.1, 0.05) },
    ],
    daysFetched: true,
    cost: money(0.9, 0.1, 0.05),
    costModels: {},
    currency: 'CNY',
    costFetched: true,
  })

  const detail = makeService(history, now, 9).detail()
  const bd = detail.breakdown!
  assert.ok(bd, '详细数据必须带 breakdown')

  // 总计：平台全量报告（9 月 + 10 月）
  assert.equal(bd.total.stat.raw.PROMPT_CACHE_HIT_TOKEN, 2000)
  assert.equal(bd.total.stat.raw.PROMPT_CACHE_MISS_TOKEN, 400)
  assert.equal(bd.total.stat.raw.RESPONSE_TOKEN, 200)
  assert.equal(bd.total.stat.raw.REQUEST, 24)
  assert.equal(bd.total.stat.cost?.PROMPT_CACHE_HIT_TOKEN, 1.4)
  assert.equal(bd.total.partial, false, '两个月的金额都抓过，总计不应标 partial')

  // 当月：只有 10 月的两天，10-14 没有金额 → partial
  assert.equal(bd.month.stat.raw.PROMPT_CACHE_HIT_TOKEN, 1500)
  assert.equal(bd.month.stat.cost?.PROMPT_CACHE_HIT_TOKEN, 0.9, '金额只累加拿到的那一天')
  assert.equal(bd.month.partial, true, '缺金额的那天要让界面标注出来')

  // 今日：只有 10-15 这一天，token 与金额同源
  assert.equal(bd.today.stat.raw.PROMPT_CACHE_HIT_TOKEN, 900)
  assert.equal(bd.today.stat.raw.RESPONSE_TOKEN, 50)
  assert.equal(bd.today.stat.cost?.RESPONSE_TOKEN, 0.05)
  assert.equal(bd.today.partial, false)

  // 命中率/输出占比是客户端算的，但分母必须从这个口径来：输入合计 = 命中 + 未命中（这里没有普通 prompt）
  assert.equal(bd.today.stat.inputTokens, 1000)
  assert.equal(bd.today.stat.totalTokens, 1050)
})

test('拆分：总计的 partial 跟着成本回补状态走', () => {
  const now = new Date(2026, 9, 15, 12, 0, 0)
  const history = new HistoryStore()
  history.set({
    year: 2026,
    month: 10,
    stat: dayStat(10, 5, 2, 1),
    models: {},
    days: [{ date: '2026-10-15', stat: dayStat(10, 5, 2, 1), cost: money(0.1, 0.05, 0.02) }],
    daysFetched: true,
    // 没有 cost / costFetched：金额还没回补
  })
  const bd = makeService(history, now).detail().breakdown!
  assert.equal(bd.total.partial, true, '金额未回补完成时总计要标 partial')
  assert.equal(bd.total.stat.cost, undefined, '没有金额就不能编一个 ¥0')
  assert.equal(bd.month.stat.cost?.PROMPT_CACHE_HIT_TOKEN, 0.1, '当月仍能拿到逐日金额')
})
