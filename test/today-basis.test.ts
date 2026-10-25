/**
 * 「今日」口径与刷新失败的两条硬约束。
 *
 *  1. 某个月拉取失败时，**不能**把这个月的历史换成空 —— 否则「今日」「当月」会读成 0 并落盘，
 *     一次冷启动时的网络抖动就足以让用户看到「今天的数据没了」（实测：总消耗 124.8 亿 → 88.5 亿）。
 *  2. 「今日」有两种日界：平台日（UTC，北京 08:00 换日，含别的设备、带金额）与本机日（本机
 *     00:00 起，只有本机日志、没有金额）。凌晨用量属于哪个「今天」，取决于选了哪一种。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { emptyMoney, emptyStat } from '../lib/types.js'
import { HistoryStore } from '../lib/store/history.js'
import { ProjectHistoryStore } from '../lib/store/project-history.js'
import { SessionUsageStore } from '../lib/store/session-usage.js'
import { resolveConfig } from '../lib/config.js'
import { UsageService } from '../lib/service.js'

/** 固定成 UTC+8 的「本机日」键：测试不能依赖运行机器的时区。 */
const shanghaiDay = (d: Date): string => new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10)

/** 平台接口一个月的响应：总计 + 某一天的逐日明细。 */
function monthResponse(days: Array<{ date: string; hit: number }>, totalHit: number): Response {
  const bucket = (hit: number) => [{ model: 'deepseek-flash', usage: [{ type: 'PROMPT_CACHE_HIT_TOKEN', amount: String(hit) }] }]
  return new Response(
    JSON.stringify({
      code: 0,
      data: {
        biz_code: 0,
        biz_data: { total: bucket(totalHit), days: days.map((d) => ({ date: d.date, data: bucket(d.hit) })) },
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

const config = (env: (n: string) => string | undefined = () => undefined) =>
  resolveConfig({ startYear: 2026, startMonth: 10, requestIntervalMs: 0 }, env)

test('月拉取失败保留已缓存的数据：今日/总消耗不再被一次抖动清空', async () => {
  const now = new Date(2026, 9, 15, 12, 0, 0)
  const history = new HistoryStore()
  // 上一次成功拉取的结果：10-15 有 300 tokens，整月 900。
  const stat = emptyStat()
  stat.PROMPT_CACHE_HIT_TOKEN = 900
  stat.REQUEST = 3
  const day15 = emptyStat()
  day15.PROMPT_CACHE_HIT_TOKEN = 300
  day15.REQUEST = 1
  const cost = emptyMoney()
  cost.PROMPT_CACHE_HIT_TOKEN = 1.5
  history.set({
    year: 2026,
    month: 10,
    stat,
    models: {},
    days: [{ date: '2026-10-15', stat: day15, cost }],
    daysFetched: true,
    cost,
    costModels: {},
    currency: 'CNY',
    costFetched: true,
  })

  const service = new UsageService({
    config: config(),
    history,
    projectHistory: new ProjectHistoryStore(),
    resolveToken: async () => ({ token: 't', source: 'config' }),
    authState: async () => ({ status: 'ok', source: 'config' }),
    now: () => now,
    localDayKey: shanghaiDay,
    // 冷启动时网络还没就绪的等价场景：每个月的请求都抛异常。
    fetchImpl: (async () => {
      throw new Error('simulated offline')
    }) as unknown as typeof fetch,
    sleep: async () => {},
  })

  await service.refresh('manual')

  const row = history.get(2026, 10)
  assert.ok(row, '失败的月份仍要保留这一行')
  assert.ok(row!.error, '失败要留下错误标记，供界面显示 ⚠')
  assert.equal(row!.stat.PROMPT_CACHE_HIT_TOKEN, 900, '失败不得把月度统计抹成 0')
  assert.equal(row!.days?.[0]?.stat.PROMPT_CACHE_HIT_TOKEN, 300, '逐日明细也不得被抹掉')
  assert.equal(row!.cost?.PROMPT_CACHE_HIT_TOKEN, 1.5, '金额同属缓存数据，不得丢')

  // 读到界面上的数字必须还是旧的那一份。窗口卡片按逐日明细求和（当月只有 10-15 这一天），
  // 总消耗读的是月度合计。
  assert.equal(service.statForScope('today').totalTokens, 300, '「今日」不能因为一次失败变 0')
  assert.equal(service.statForScope('month').totalTokens, 300)
  assert.equal(service.report().grand.totalTokens, 900, '总消耗不能因为一次失败缩水')
})

test('今日两种口径：平台日含别的设备与金额，本机日按本机 0 点切且只有本机', async () => {
  const root = mkdtempSync(join(tmpdir(), 'tlogs-basis-'))
  try {
    // 本机日志：北京 10-10 02:00 的一次调用（UTC 日仍是 10-09）→ 只应计入「本机日 10-10」。
    const dir = join(root, 'ws', 's1')
    mkdirSync(dir, { recursive: true })
    const at = Date.UTC(2026, 9, 9, 18, 0, 0)
    const lines = [
      { type: 'session', version: 4, id: 's1', createdAt: Date.UTC(2026, 9, 9, 17, 0, 0), cwd: 'C:/x' },
      { type: 'request/header', time: at, data: { header: { config: { provider: 'xiaomi', model: 'mimo' } } } },
      { type: 'assistant/message', time: at + 1000, data: { turn: 1, step: 1, usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 100 } } },
    ]
    writeFileSync(join(dir, 'session.v4.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n')

    const localUsage = new SessionUsageStore({ root, maxDays: 32, localDayKey: shanghaiDay })
    await localUsage.refresh()

    const now = new Date(2026, 9, 10, 3, 0, 0) // 北京 10-10 03:00：UTC 日 = 10-09
    // 平台账单：10-09 这天 700（含别的设备），整月 700。
    const service = new UsageService({
      config: config(),
      history: new HistoryStore(),
      projectHistory: new ProjectHistoryStore(),
      resolveToken: async () => ({ token: 't', source: 'config' }),
      authState: async () => ({ status: 'ok', source: 'config' }),
      now: () => now,
      localDayKey: shanghaiDay,
      localUsage,
      fetchImpl: (async () => monthResponse([{ date: '2026-10-09', hit: 700 }], 700)) as unknown as typeof fetch,
      sleep: async () => {},
    })
    await service.refresh('manual')

    const platformDay = await service.snapshot({ todayBasis: 'platform' })
    const platformCard = platformDay.cards.find((c) => c.scope === 'today')!
    assert.equal(platformDay.basis?.kind, 'platform')
    // 平台日：10-09 桶里平台记 700（含别的设备）；本机凌晨那 115 走的是平台看不到的供应商，
    // 按合并规则无条件相加 → 815。金额仍来自平台。
    assert.equal(platformCard.stat.totalTokens, 815)
    assert.ok(platformCard.stat.cost, '平台日口径带金额')
    assert.equal(platformDay.compact.find((m) => m.scope === 'today')!.label, '今日')

    const localDay = await service.snapshot({ todayBasis: 'local' })
    const localCard = localDay.cards.find((c) => c.scope === 'today')!
    assert.equal(localDay.basis?.kind, 'local')
    assert.equal(localCard.label, '今日消耗 · 本机')
    assert.equal(localCard.stat.totalTokens, 115, '本机日只算本机 0 点之后的样本')
    assert.equal(localCard.stat.requests, 1)
    assert.equal(localCard.stat.cost, undefined, '本机口径没有金额，不能伪造 ¥0')
    assert.equal(localCard.source?.kind, 'local')
    assert.deepEqual(
      localCard.source?.otherProviders.map((p) => p.provider),
      ['小米'],
      '平台看不到的供应商要在这张卡上标出来',
    )
    assert.equal(localDay.compact.find((m) => m.scope === 'today')!.label, '本日')

    // 当周（本机周一 10-05 起）与当月（本机 10-01 起）也跟同一口径：只有本机那 115。
    const localWeek = localDay.cards.find((c) => c.scope === 'week')!
    const localMonth = localDay.cards.find((c) => c.scope === 'month')!
    assert.equal(localWeek.label, '当周消耗 · 本机')
    assert.equal(localWeek.stat.totalTokens, 115)
    assert.equal(localMonth.label, '当月消耗 · 本机')
    assert.equal(localMonth.stat.totalTokens, 115)
    assert.equal(localWeek.stat.cost, undefined, '本机口径的周/月同样没有金额')
    // 平台日口径下周/月仍是平台账单那一份（10-09 的 700）。
    assert.equal(platformDay.cards.find((c) => c.scope === 'week')!.stat.totalTokens, 815)
    assert.equal(platformDay.cards.find((c) => c.scope === 'month')!.stat.totalTokens, 815)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('本机口径不可用时回退平台日，并在快照里说明（不静默换口径）', async () => {
  const now = new Date(2026, 9, 10, 3, 0, 0)
  const service = new UsageService({
    config: config(),
    history: new HistoryStore(),
    projectHistory: new ProjectHistoryStore(),
    resolveToken: async () => ({ token: 't', source: 'config' }),
    authState: async () => ({ status: 'ok', source: 'config' }),
    now: () => now,
    localDayKey: shanghaiDay,
    fetchImpl: (async () => monthResponse([{ date: '2026-10-09', hit: 700 }], 700)) as unknown as typeof fetch,
    sleep: async () => {},
  })
  await service.refresh('manual')

  const snap = await service.snapshot({ todayBasis: 'local' })
  const card = snap.cards.find((c) => c.scope === 'today')!
  assert.equal(snap.basis?.kind, 'platform', '回退后如实报平台日')
  assert.equal(snap.basis?.fellBack, true)
  assert.equal(card.label, '今日消耗')
  assert.equal(snap.compact.find((m) => m.scope === 'today')!.label, '今日')
})
