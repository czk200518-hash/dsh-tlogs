/**
 * 双路数据源合并规则单测。
 *
 * 钉住的是**不能错的三条语义**：
 *  1. 平台值与本机 DeepSeek 通道值是同一批调用的两种测量 —— 只能取大，绝不能相加
 *     （相加就是把本机自己打的请求算两遍）
 *  2. 本机非 DeepSeek 供应商（火山方舟/小米/GLM…）平台完全看不到 —— 必须相加
 *  3. 逐日取大，不是窗口整体取大：平台滞后只发生在当天，窗口整体取大会让
 *     昨天的多算掩盖今天的少算
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { isDeepseekProvider, mergeTotal, mergeWindow, toScopeStatFromStat } from '../lib/store/usage-merge.js'
import { emptyStat, type Stat } from '../lib/types.js'
import type { LocalDayUsage } from '../lib/store/session-usage.js'

/** 造一个 Stat：只写关心的字段，其余补 0。 */
function stat(miss = 0, hit = 0, out = 0, requests = 0): Stat {
  const s = emptyStat()
  s.PROMPT_CACHE_MISS_TOKEN = miss
  s.PROMPT_CACHE_HIT_TOKEN = hit
  s.RESPONSE_TOKEN = out
  s.REQUEST = requests
  return s
}

function platformDay(date: string, s: Stat) {
  return { date, stat: s }
}

function localDay(date: string, entries: Array<[string, Stat]>): LocalDayUsage {
  const day: LocalDayUsage = { date, stat: emptyStat(), byProvider: [] }
  for (const [provider, s] of entries) {
    day.byProvider.push({ provider, stat: s })
    for (const k of Object.keys(day.stat) as Array<keyof Stat>) day.stat[k] += s[k]
  }
  return day
}

const W = (from: string, to: string) => ({ from, to })

test('DeepSeek 通道判定：只认 deepseek / deepseek-*，别家供应商不算', () => {
  assert.equal(isDeepseekProvider('deepseek'), true)
  assert.equal(isDeepseekProvider('deepseek-official'), true)
  assert.equal(isDeepseekProvider('deepseek-account'), true)
  assert.equal(isDeepseekProvider('deepseekX'), false)
  assert.equal(isDeepseekProvider('huoshanfangzhou'), false)
  assert.equal(isDeepseekProvider('xiaomi'), false)
  assert.equal(isDeepseekProvider('zai'), false)
})

test('本机没有任何用量：直接采用平台口径', () => {
  const m = mergeWindow([platformDay('2026-10-08', stat(100, 900, 50, 3))], [], W('2026-10-08', '2026-10-08'))
  assert.equal(m.source, 'platform')
  assert.equal(m.stat.totalTokens, 1050)
  assert.equal(m.stat.requests, 3)
  assert.equal(m.costPending, false)
})

test('平台当天还没结算（给的比本机少）：当天用本机值，并标记金额待结算', () => {
  const m = mergeWindow(
    [platformDay('2026-10-08', stat(10, 90, 5, 1))],
    [localDay('2026-10-08', [['deepseek-account', stat(100, 400, 50, 20)]])],
    W('2026-10-08', '2026-10-08'),
  )
  assert.equal(m.source, 'local', '平台全面落后 → 本机口径')
  assert.equal(m.stat.totalTokens, 550, '取本机值，而不是平台+本机（那样等于把同一批请求算两遍）')
  assert.equal(m.stat.requests, 20)
  assert.equal(m.costPending, true)
  assert.deepEqual(m.pendingDays, ['2026-10-08'])
})

test('平台包含别的设备（给的比本机多）：用平台值', () => {
  const m = mergeWindow(
    [platformDay('2026-10-08', stat(100, 900, 50, 30))],
    [localDay('2026-10-08', [['deepseek-account', stat(100, 400, 50, 20)]])],
    W('2026-10-08', '2026-10-08'),
  )
  assert.equal(m.source, 'platform')
  assert.equal(m.stat.totalTokens, 1050)
  assert.equal(m.costPending, false)
})

test('本机用了平台看不到的供应商：那一部分必须相加', () => {
  const m = mergeWindow(
    [platformDay('2026-10-08', stat(100, 900, 50, 20))],
    [
      localDay('2026-10-08', [
        ['deepseek-official', stat(100, 900, 50, 20)],
        ['xiaomi', stat(5, 25, 10, 2)],
      ]),
    ],
    W('2026-10-08', '2026-10-08'),
  )
  assert.equal(m.source, 'merged')
  assert.equal(m.stat.totalTokens, 1050 + 40, 'DeepSeek 通道取大，小米另加')
  assert.equal(m.stat.requests, 22)
  assert.deepEqual(m.otherProviders, [{ provider: 'xiaomi', tokens: 40 }])
})

test('逐日取大：昨天的多算不能掩盖今天的少算', () => {
  const days = ['2026-10-07', '2026-10-08']
  const m = mergeWindow(
    [platformDay(days[0]!, stat(0, 590, 8, 2400)), platformDay(days[1]!, stat(0, 9, 0, 100))],
    [
      localDay(days[0]!, [['deepseek-account', stat(0, 555, 6, 2300)]]),
      localDay(days[1]!, [['deepseek-account', stat(0, 25, 1, 150)]]),
    ],
    W('2026-10-07', '2026-10-08'),
  )
  // 10-07 用平台 598，10-08 用本机 26
  assert.equal(m.stat.totalTokens, 598 + 26)
  assert.equal(m.source, 'merged', '不同天由不同来源取胜 → 合并口径')
  assert.equal(m.costPending, true, '窗口最后一天（平台当前日）还没结算')
})

test('老日子的差异不算「结算中」：只看窗口最后一天', () => {
  const m = mergeWindow(
    [platformDay('2026-10-02', stat(1, 10, 1, 1)), platformDay('2026-10-06', stat(1, 10, 1, 1))],
    [
      localDay('2026-10-02', [['deepseek-official', stat(1, 90, 1, 5)]]), // 平台这天偏低
      localDay('2026-10-06', [['deepseek-official', stat(1, 10, 1, 1)]]),
    ],
    W('2026-10-02', '2026-10-06'),
  )
  assert.equal(m.pendingDays.includes('2026-10-02'), true, '差异日仍应记录（诊断用）')
  assert.equal(m.costPending, false, '但窗口末日没落后 → 不标注结算中')
})

test('请求数同规则：取大而不是相加', () => {
  const m = mergeWindow(
    [platformDay('2026-10-08', stat(0, 0, 0, 2487))],
    [localDay('2026-10-08', [['deepseek-account', stat(0, 0, 0, 2373)]])],
    W('2026-10-08', '2026-10-08'),
  )
  assert.equal(m.stat.requests, 2487)
})

test('toScopeStatFromStat：总 Token = 输入 + 输出，且不含请求数', () => {
  const s = toScopeStatFromStat(stat(100, 900, 50, 7))
  assert.equal(s.inputTokens, 1000)
  assert.equal(s.outputTokens, 50)
  assert.equal(s.totalTokens, 1050)
  assert.equal(s.requests, 7)
  assert.equal(s.cost, undefined)
})

/* ------------------------------------------------------------------ *
 * 总消耗：平台全量 + 本机补充
 * ------------------------------------------------------------------ */

const DAY = '2026-10-08'

test('总消耗：平台看不到的供应商全额补上，DeepSeek 通道只补差额（不重复计数）', () => {
  const platformTotal = toScopeStatFromStat(stat(1000, 9000, 500, 30))
  const m = mergeTotal(
    platformTotal,
    [platformDay(DAY, stat(100, 900, 50, 3))],
    [
      localDay(DAY, [
        // 比平台多 50（平台当天没结算完）
        ['deepseek-official', stat(150, 900, 50, 8)],
        // 平台永远看不到：全额补
        ['xiaomi', stat(5, 25, 10, 2)],
      ]),
    ],
  )
  assert.equal(m.stat.totalTokens, 10500 + 50 + 40, '平台全量 + 差额 50 + 小米 40')
  assert.equal(m.stat.requests, 30 + 5 + 2)
  assert.equal(m.source, 'merged')
  assert.deepEqual(m.otherProviders, [{ provider: 'xiaomi', tokens: 40 }])
})

test('总消耗：平台更全（别的设备在用）时只加平台看不到的那部分', () => {
  const platformTotal = toScopeStatFromStat(stat(1000, 9000, 500, 30))
  const m = mergeTotal(
    platformTotal,
    [platformDay(DAY, stat(200, 900, 50, 20))],
    [
      localDay(DAY, [
        ['deepseek-official', stat(100, 900, 50, 8)],
        ['huoshanfangzhou', stat(1, 1, 1, 1)],
      ]),
    ],
  )
  assert.equal(m.stat.totalTokens, 10500 + 3, 'DeepSeek 通道取平台的（更大），火山方舟 3 全额补')
  assert.equal(m.stat.requests, 30 + 1)
})

test('总消耗：本机没有任何数据时原样返回平台值', () => {
  const platformTotal = toScopeStatFromStat(stat(1000, 9000, 500, 30))
  const m = mergeTotal(platformTotal, [platformDay(DAY, stat(100, 900, 50, 3))], [])
  assert.equal(m.stat.totalTokens, 10500)
  assert.equal(m.source, 'platform')
  assert.deepEqual(m.otherProviders, [])
  assert.equal(m.costPending, false)
})

test('总消耗：当天平台还是 0 时把本机已用量补进去，并标记金额待结算', () => {
  const platformTotal = toScopeStatFromStat(stat(1000, 9000, 500, 30))
  const m = mergeTotal(
    platformTotal,
    [platformDay(DAY, stat(0, 0, 0, 0))],
    [localDay(DAY, [['deepseek-account', stat(10, 100, 5, 4)]])],
  )
  assert.equal(m.stat.totalTokens, 10500 + 115)
  assert.equal(m.stat.requests, 34)
  assert.equal(m.costPending, true)
  assert.deepEqual(m.pendingDays, [DAY])
})
