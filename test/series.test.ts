/**
 * `UsageService.series()` 的聚合口径单测（图表页签的唯一数据来源）。
 *
 * 这里要钉住的几件事：
 *  - 范围解析（有史以来 / 今日 / 本周 / 本月 / 自定义）都落在**本地日历日**上
 *  - 月度合计来自**月度合计**（缺逐日明细的月份不能被低估），逐日来自 days
 *  - `prior` 是范围内首日之前的累计，`prior` 错了「累计」曲线就会从 0 跳变
 *  - 缺数据的月份必须由 `partial` 标出来，而不是安静地当成「没用过」
 *  - 项目序列的最后一点必须是**当前实时值**（否则曲线终点与项目卡片对不上）
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { resolveConfig } from '../lib/config.js'
import { makeRpcHandler } from '../lib/rpc.js'
import { publicProjectId } from '../lib/store/project.js'
import { ProjectHistoryStore } from '../lib/store/project-history.js'
import { HistoryStore } from '../lib/store/history.js'
import { UsageService } from '../lib/service.js'
import { emptyStat, type Stat } from '../lib/types.js'

/** 本地时间 2026-10-07（周三）12:00（Asia/Shanghai 由测试进程时区决定，见下）。 */
const NOW = new Date(2026, 9, 7, 12, 0, 0)

function stat(hit: number, miss: number, out: number, req = 0): Stat {
  const s = emptyStat()
  s.PROMPT_CACHE_HIT_TOKEN = hit
  s.PROMPT_CACHE_MISS_TOKEN = miss
  s.RESPONSE_TOKEN = out
  s.REQUEST = req
  return s
}

function makeService(
  projects: Array<{ id: string; label: string; stat: Stat }> = [],
  config: Record<string, unknown> = {},
) {
  const history = new HistoryStore()
  const projectHistory = new ProjectHistoryStore()
  const service = new UsageService({
    config: resolveConfig({ requestIntervalMs: 0, ...config }, () => undefined),
    history,
    projectHistory,
    resolveToken: async () => undefined,
    authState: async () => ({ status: 'missing' }),
    now: () => NOW,
    projectProvider: { available: () => true, list: async () => projects },
  })
  return { service, history, projectHistory }
}

const CID = 'D:/work/tlogs'
const PID = publicProjectId(CID)

test('范围解析：今日 / 本周 / 本月 / 有史以来 / 自定义', async () => {
  const { service } = makeService()

  const today = await service.series({ range: 'today' })
  assert.equal(today.from, '2026-10-07')
  assert.equal(today.to, '2026-10-07')

  // 2026-10-07 是周三 → 周一为 10-05
  const week = await service.series({ range: 'week' })
  assert.equal(week.from, '2026-10-05')
  assert.equal(week.to, '2026-10-07')

  const month = await service.series({ range: 'month' })
  assert.equal(month.from, '2026-10-01')

  const all = await service.series({ range: 'all' })
  assert.equal(all.from, '2024-04-01', '有史以来 = 配置起点（与 Python 一致）')
  assert.equal(all.to, '2026-10-07')

  const custom = await service.series({ range: 'custom', from: '2026-09-15', to: '2026-10-03' })
  assert.equal(custom.from, '2026-09-15')
  assert.equal(custom.to, '2026-10-03')

  // 未来日期必须被裁到今天（避免出现空未来段）
  const future = await service.series({ range: 'custom', from: '2026-10-01', to: '2027-01-01' })
  assert.equal(future.to, '2026-10-07')
})

test('自定义范围：逐日裁到窗口内，月度合计保持完整，prior 正确', async () => {
  const { service, history } = makeService()

  history.set({
    year: 2026,
    month: 8,
    stat: stat(800, 80, 8, 8),
    models: { m1: stat(800, 80, 8, 8) },
    days: [
      { date: '2026-08-01', stat: stat(500, 50, 5, 5) },
      { date: '2026-08-15', stat: stat(300, 30, 3, 3) },
    ],
    daysFetched: true,
  })
  history.set({
    year: 2026,
    month: 9,
    stat: stat(900, 90, 9, 9),
    models: { m1: stat(600, 60, 6, 6), m2: stat(300, 30, 3, 3) },
    days: [
      { date: '2026-09-10', stat: stat(400, 40, 4, 4) },
      { date: '2026-09-15', stat: stat(300, 30, 3, 3) },
      { date: '2026-09-30', stat: stat(200, 20, 2, 2) },
    ],
    daysFetched: true,
  })
  history.set({
    year: 2026,
    month: 10,
    stat: stat(100, 10, 1, 1),
    models: { m2: stat(100, 10, 1, 1) },
    days: [
      { date: '2026-10-01', stat: stat(60, 6, 1, 1) },
      { date: '2026-10-03', stat: stat(40, 4, 0, 0) },
      { date: '2026-10-07', stat: stat(10, 1, 0, 0) },
    ],
    daysFetched: true,
  })

  const s = await service.series({ range: 'custom', from: '2026-09-15', to: '2026-10-03' })

  assert.deepEqual(
    s.months.map((m) => m.key),
    ['2026-09', '2026-10'],
    '月度合计必须完整（不因窗口裁剪而变小）',
  )
  assert.equal(s.months[0]!.stat.PROMPT_CACHE_HIT_TOKEN, 900)

  assert.deepEqual(
    s.days.map((d) => d.date),
    ['2026-09-15', '2026-09-30', '2026-10-01', '2026-10-03'],
    '逐日只保留窗口内的天',
  )

  // prior = 8 月整体 + 9 月里 15 日之前的那天
  assert.equal(s.prior.PROMPT_CACHE_HIT_TOKEN, 800 + 400)
  assert.equal(s.prior.RESPONSE_TOKEN, 8 + 4)

  assert.deepEqual(
    s.models.map((m) => m.key),
    ['m1', 'm2'],
    '模型按总 Token 降序',
  )
  assert.equal(s.models[0]!.stat.PROMPT_CACHE_HIT_TOKEN, 600)
  assert.equal(s.partial, false)
})

test('缺逐日明细 / 拉取失败的月份：partial 必须为 true', async () => {
  const { service, history } = makeService()
  history.set({ year: 2026, month: 8, stat: stat(10, 1, 1, 1), models: {}, daysFetched: true })
  history.set({
    year: 2026,
    month: 9,
    stat: stat(20, 2, 2, 2),
    models: {},
    days: [{ date: '2026-09-01', stat: stat(20, 2, 2, 2) }],
    daysFetched: true,
  })
  history.set({
    year: 2026,
    month: 10,
    stat: emptyStat(),
    models: {},
    error: { kind: 'http', message: 'HTTP 500', status: 500 },
  })

  const s = await service.series({ range: 'all' })
  assert.equal(s.partial, true, '缺天的 8 月与失败的 10 月都要被标出')
  // 失败月份不贡献合计（与 Python 口径一致：空 Stat）；缺天但有合计的月份仍在
  assert.deepEqual(
    s.months.map((m) => m.key),
    ['2026-08', '2026-09'],
  )
  assert.equal(s.months[1]!.stat.PROMPT_CACHE_HIT_TOKEN, 20)
})

test('项目序列：快照升序，末点替换为当前实时值，prior 为范围前的最后一次快照', async () => {
  const live = stat(1500, 100, 50, 0)
  const { service, projectHistory } = makeService([{ id: CID, label: 'tlogs', stat: live }])

  projectHistory.record(PID, '2026-10-01', stat(1000, 80, 40))
  projectHistory.record(PID, '2026-10-05', stat(1200, 90, 45))
  // 今天已有一条旧快照 → 必须被实时值覆盖，而不是再追加一个点
  projectHistory.record(PID, '2026-10-07', stat(1300, 95, 47))

  const s = await service.series({
    range: 'custom',
    from: '2026-10-05',
    to: '2026-10-07',
    projectId: PID,
  })

  assert.ok(s.project, '指定 projectId 时必须返回项目序列')
  assert.equal(s.project!.label, 'tlogs')
  assert.equal(s.project!.known, true)
  assert.deepEqual(
    s.project!.points.map((p) => p.date),
    ['2026-10-05', '2026-10-07'],
  )
  assert.deepEqual(s.project!.points[1]!.stat, live, '末点必须是当前实时值')
  assert.equal(s.project!.prior?.date, '2026-10-01', 'prior 是范围前最后一次快照')

  // 项目不在当前列表里（例如已从本机消失）→ 保留历史并给出兜底标签
  const gone = await service.series({
    range: 'custom',
    from: '2026-10-01',
    to: '2026-10-07',
    projectId: 'ffffffffffffffff',
  })
  assert.equal(gone.project!.known, false)
  assert.match(gone.project!.label, /^项目 /)
  assert.deepEqual(gone.project!.points, [])
})

test('项目列表：id 是哈希（绝不下发完整 cwd）', async () => {
  const { service } = makeService([{ id: CID, label: 'tlogs', stat: stat(1, 0, 1) }])
  const s = await service.series({ range: 'today' })
  assert.equal(s.projects.length, 1)
  assert.equal(s.projects[0]!.id, PID)
  assert.equal(s.projects[0]!.id.includes('/'), false)
  assert.equal(JSON.stringify(s.projects).includes('D:/work'), false, '不能外泄 cwd')
})

test('recordProjectSnapshots：按哈希 id 记录当天快照，缺来源时静默跳过', async () => {
  const { service, projectHistory } = makeService([
    { id: CID, label: 'tlogs', stat: stat(500, 10, 5) },
  ])
  await service.recordProjectSnapshots()
  const points = projectHistory.points(PID)
  assert.equal(points.length, 1)
  assert.equal(points[0]!.date, '2026-10-07')
  assert.equal(points[0]!.stat.PROMPT_CACHE_HIT_TOKEN, 500)

  // 没有项目来源时不能抛错
  const { service: empty, projectHistory: ph } = makeService([])
  await empty.recordProjectSnapshots()
  assert.equal(ph.size, 0)
})

test('enableProjectScope=false：图表里没有项目、也不记录任何快照', async () => {
  const src = { id: CID, label: 'tlogs', stat: stat(500, 10, 5) }
  const { service, projectHistory } = makeService([src], { enableProjectScope: false })

  const s = await service.series({ range: 'today' })
  assert.deepEqual(s.projects, [], '关掉项目范围后不应下发任何项目')

  await service.recordProjectSnapshots()
  assert.equal(projectHistory.size, 0, '关掉项目范围后不应记录快照')
})

// ---------------------------------------------------------------- RPC 入参校验

/** 取出失败信封里的 code（成功时返回 undefined）。 */
function failCode(res: unknown): string | undefined {
  const r = res as { ok: boolean; error?: { code?: string } }
  return r.ok ? undefined : r.error?.code
}

function rpcOf() {
  const { service } = makeService()
  return makeRpcHandler({
    service,
    // setToken/login/logout 在本组用例里不会被走到，给个空壳即可。
    tokens: {} as never,
    clearHistory: () => {},
  })
}

test('tlogs.series 入参校验：非法 range / 日期 / 顺序 / 跨度 / projectId 一律拒绝', async () => {
  const handle = rpcOf()

  assert.equal(failCode(await handle('tlogs.series', {})), 'invalid-input')
  assert.equal(failCode(await handle('tlogs.series', { range: 'last-year' })), 'invalid-input')
  assert.equal(failCode(await handle('tlogs.series', { range: 'custom' })), 'invalid-input')
  assert.equal(
    failCode(await handle('tlogs.series', { range: 'custom', from: '2026-13-01', to: '2026-10-07' })),
    'invalid-input',
    '不存在的月份必须被拒',
  )
  assert.equal(
    failCode(await handle('tlogs.series', { range: 'custom', from: '2026-02-30', to: '2026-10-07' })),
    'invalid-input',
    '2 月 30 日必须被拒',
  )
  assert.equal(
    failCode(await handle('tlogs.series', { range: 'custom', from: '2026-10-07', to: '2026-10-01' })),
    'invalid-input',
    '起始日期晚于结束日期必须被拒',
  )
  assert.equal(
    failCode(await handle('tlogs.series', { range: 'custom', from: '1900-01-01', to: '2026-10-07' })),
    'invalid-input',
    '跨度超过上限必须被拒（否则响应会被撑大）',
  )
  assert.equal(
    failCode(await handle('tlogs.series', { range: 'today', projectId: '../../etc/passwd' })),
    'invalid-input',
    'projectId 必须是 16 位小写十六进制',
  )

  // 合法入参
  const good = (await handle('tlogs.series', { range: 'custom', from: '2026-10-01', to: '2026-10-07' })) as {
    ok: boolean
    value?: { from: string }
  }
  assert.equal(good.ok, true)
  assert.equal(good.value?.from, '2026-10-01')

  // 未知端点的行为不受影响
  assert.equal(failCode(await handle('tlogs.nope', {})), 'bad-request')
})

/* ------------------------------------------------------------------ *
 * 滚动窗口（近 7 / 近 30 天）与金额
 * ------------------------------------------------------------------ */

/** 造一个月度行（含可选金额）。 */
function monthRow(
  year: number,
  month: number,
  s: Stat,
  cost?: Partial<Record<keyof Stat, number>>,
  days?: Array<{ date: string; stat: Stat; cost?: Partial<Record<keyof Stat, number>> }>,
) {
  const row: Record<string, unknown> = { year, month, stat: s, models: {}, daysFetched: true }
  if (cost) {
    row.cost = { ...zeroMoney(), ...cost }
    row.currency = 'CNY'
    row.costFetched = true
  }
  if (days) {
    row.days = days.map((d) => ({
      date: d.date,
      stat: d.stat,
      ...(d.cost ? { cost: { ...zeroMoney(), ...d.cost } } : {}),
    }))
  }
  return row
}

function zeroMoney(): Record<string, number> {
  return {
    PROMPT_TOKEN: 0,
    PROMPT_CACHE_HIT_TOKEN: 0,
    PROMPT_CACHE_MISS_TOKEN: 0,
    RESPONSE_TOKEN: 0,
    REQUEST: 0,
  }
}

test('范围解析：近 7 天 / 近 30 天是与控制台同口径的滚动窗口', async () => {
  const { service } = makeService()
  // NOW = 2026-10-07
  const l7 = await service.series({ range: 'last7' })
  assert.equal(l7.from, '2026-10-01', '近 7 天 = 今天往前 6 天')
  assert.equal(l7.to, '2026-10-07')

  const l30 = await service.series({ range: 'last30' })
  assert.equal(l30.from, '2026-09-08', '近 30 天会跨到 9 月')
  assert.equal(l30.to, '2026-10-07')

  // 与「本月」明显不同：这正是用户此前「插件和控制台对不上」的原因
  const month = await service.series({ range: 'month' })
  assert.notEqual(month.from, l30.from)
})

test('近 30 天窗口横跨两个自然月，逐日必须从两个月里取', async () => {
  const { service, history } = makeService()
  // 9 月：只有 09-08 之后的天在窗口内
  history.set(
    monthRow(
      2026,
      9,
      stat(300, 30, 3, 3),
      undefined,
      [
        { date: '2026-09-01', stat: stat(1, 0, 0, 1) }, // 窗口外
        { date: '2026-09-08', stat: stat(10, 1, 1, 1) },
        { date: '2026-09-30', stat: stat(20, 2, 2, 1) },
      ],
    ) as never,
  )
  history.set(
    monthRow(2026, 10, stat(100, 10, 1, 1), undefined, [
      { date: '2026-10-01', stat: stat(5, 0, 0, 1) },
      { date: '2026-10-07', stat: stat(50, 5, 5, 1) },
    ]) as never,
  )

  const l30 = await service.series({ range: 'last30' })
  // 窗口内：9-08(10+1+1) + 9-30(20+2+2) + 10-01(5) + 10-07(60) = 12+24+5+60
  assert.equal(l30.days.length, 4, '窗口外的 09-01 必须被排除')
  assert.deepEqual(l30.days.map((d) => d.date), ['2026-09-08', '2026-09-30', '2026-10-01', '2026-10-07'])
  assert.equal(l30.days.reduce((s, d) => s + d.stat.PROMPT_CACHE_HIT_TOKEN, 0), 10 + 20 + 5 + 50)
})

test('statForScope：近 7 / 近 30 天能穿透到上月，且与当周/当月互相独立', () => {
  const { service, history } = makeService()
  history.set(
    monthRow(2026, 9, stat(0, 0, 0, 0), undefined, [
      { date: '2026-09-29', stat: stat(7, 0, 0, 1) }, // 近 30 天内、当周外、上月
      { date: '2026-09-30', stat: stat(11, 0, 0, 1) },
    ]) as never,
  )
  history.set(
    monthRow(2026, 10, stat(0, 0, 0, 0), undefined, [
      { date: '2026-10-01', stat: stat(2, 0, 0, 1) },
      { date: '2026-10-07', stat: stat(3, 0, 0, 1) },
    ]) as never,
  )

  assert.equal(service.statForScope('today').totalTokens, 3)
  assert.equal(service.statForScope('week').totalTokens, 3, '本周 = 10-05（周一）起 → 只有 10-07')
  assert.equal(service.statForScope('month').totalTokens, 5, '本月 = 10-01 起 → 2 + 3')
  assert.equal(service.statForScope('last7').totalTokens, 5, '近 7 天 = 10-01 起 → 与本月在今天就相同')
  assert.equal(service.statForScope('last30').totalTokens, 2 + 3 + 11 + 7, '近 30 天要带上 9 月末两天')
})

test('金额随范围下发：月份合计、逐日、priorCost 与 costByType', async () => {
  const { service, history } = makeService()
  history.set(
    monthRow(
      2026,
      9,
      stat(100, 10, 1, 1),
      { PROMPT_CACHE_HIT_TOKEN: 50.5, RESPONSE_TOKEN: 1.25 },
      [
        { date: '2026-09-01', stat: stat(1, 0, 0, 1), cost: { PROMPT_CACHE_HIT_TOKEN: 1.5 } },
        { date: '2026-09-20', stat: stat(2, 0, 0, 1), cost: { PROMPT_CACHE_HIT_TOKEN: 49 } },
      ],
    ) as never,
  )
  history.set(
    monthRow(2026, 10, stat(10, 1, 1, 1), { RESPONSE_TOKEN: 7.75 }, [
      { date: '2026-10-07', stat: stat(10, 1, 1, 1), cost: { RESPONSE_TOKEN: 7.75 } },
    ]) as never,
  )

  const l30 = await service.series({ range: 'last30' })
  // 逐日金额只覆盖窗口内的天
  const dayCost = l30.days.reduce((s, d) => s + (d.cost ?? 0), 0)
  // 窗口内：09-20(49) + 10-07(7.75)；09-01 在窗口外
  assert.equal(dayCost, 56.75)
  // 月度合计按「整月」给（与 token 侧的 months 口径一致）
  assert.equal(l30.months.reduce((s, m) => s + (m.cost ?? 0), 0), 51.75 + 7.75)
  // costByType 是范围内的五类拆分
  assert.ok(l30.costByType, '必须带 costByType 供饼图用')
  assert.equal(l30.costByType!.PROMPT_CACHE_HIT_TOKEN, 50.5)
  assert.equal(l30.costByType!.RESPONSE_TOKEN, 1.25 + 7.75)
  // priorCost：范围内首月里、起始日之前的那些天要计入累计基线（与 token 侧 prior 同口径）
  // 窗口是 09-08..10-07，而 09-01 在窗口之前 → 它的 1.5 元进 priorCost
  assert.equal(l30.priorCost, 1.5)
  assert.equal(l30.costPartial, false)

  // priorCost：范围起点之前的金额要计入累计基线
  const custom = await service.series({ range: 'custom', from: '2026-10-01', to: '2026-10-07' })
  assert.equal(custom.priorCost, 50.5 + 1.25, '首月起点之前的天...以及更早的月份应进 priorCost')
})

test('缺金额的月份把 costPartial 置真（曲线不能把缺的当 0）', async () => {
  const { service, history } = makeService()
  // 只有 token、没有金额
  history.set(monthRow(2026, 10, stat(10, 0, 0, 1), undefined, [
    { date: '2026-10-07', stat: stat(10, 0, 0, 1) },
  ]) as never)

  const s = await service.series({ range: 'month' })
  assert.equal(s.costPartial, true, '没有金额数据时必须标出「金额不完整」')
  assert.equal(s.months[0]!.cost, undefined, '缺金额时不该伪造 0')
})

test('快照下发 costComplete / currency / 紧凑条金额项', async () => {
  const { service, history } = makeService({}, { compactMetrics: ['total', 'cost_total', 'last7', 'cost_last7'] })
  history.set(monthRow(2026, 10, stat(10, 0, 0, 1), { RESPONSE_TOKEN: 7.75 }, [
    { date: '2026-10-07', stat: stat(10, 0, 0, 1), cost: { RESPONSE_TOKEN: 7.75 } },
  ]) as never)

  const snap = await service.snapshot()
  assert.equal(snap.currency, 'CNY')
  // 配置的历史起点是 2024-04，只有 2026-10 有金额 → 不完整
  assert.equal(snap.costComplete, false, '历史还有月份没金额 → costComplete=false')
  assert.equal(snap.account, undefined, '没有刷新过就不该有账户概览')

  const labels = snap.compact.map((m) => m.label)
  assert.deepEqual(labels, ['总', '总 ¥', '近 7 天', '7日 ¥'])
  const moneyItem = snap.compact.find((m) => m.unit === 'money')
  assert.ok(moneyItem, '金额项必须带 unit=money（否则会被按 token 缩写格式化）')
  assert.equal(moneyItem!.value, 7.75)
  // 近 7 天的金额项取的是 last7 窗口
  assert.equal(snap.compact[3]!.value, 7.75)

  // 卡片上也必须带金额
  const monthCard = snap.cards.find((c) => c.scope === 'month')
  assert.equal(monthCard?.stat.cost?.RESPONSE_TOKEN, 7.75)
  // 近 7 / 近 30 天卡片存在
  assert.ok(snap.cards.some((c) => c.scope === 'last7'))
  assert.ok(snap.cards.some((c) => c.scope === 'last30'))
})

test('monthDetail 带上逐日金额与 costAvailable', () => {
  const { service, history } = makeService()
  history.set(
    monthRow(2026, 10, stat(10, 1, 1, 1), { RESPONSE_TOKEN: 7.75 }, [
      { date: '2026-10-01', stat: stat(1, 0, 0, 1), cost: { PROMPT_CACHE_HIT_TOKEN: 2.5 } },
      { date: '2026-10-07', stat: stat(9, 1, 1, 1), cost: { RESPONSE_TOKEN: 7.75 } },
    ]) as never,
  )

  const md = service.monthDetail(2026, 10)
  assert.equal(md.currency, 'CNY')
  assert.equal(md.costAvailable, true)
  assert.equal(md.stat.cost?.RESPONSE_TOKEN, 7.75)
  assert.equal(md.days.length, 2)
  assert.equal(md.days[0]!.stat.cost?.PROMPT_CACHE_HIT_TOKEN, 2.5)
  assert.equal(md.days[1]!.stat.cost?.RESPONSE_TOKEN, 7.75)

  // 没有该月记录时：不是错误，costAvailable=false
  const empty = service.monthDetail(2020, 1)
  assert.equal(empty.costAvailable, false)
  assert.deepEqual(empty.days, [])
})

test('detail() 的金额：模型走 modelCosts、按月/按天带 cost，且不改变 token 口径', () => {
  const { service, history } = makeService()
  history.set(
    monthRow(2026, 10, stat(10, 1, 1, 1), { RESPONSE_TOKEN: 7.75 }, [
      { date: '2026-10-07', stat: stat(10, 1, 1, 1), cost: { RESPONSE_TOKEN: 7.75 } },
    ]) as never,
  )
  // 手动补上按模型金额与模型 token（makeService 的 monthRow 不建 models）
  const row = history.get(2026, 10)!
  row.models = { 'deepseek-flash': stat(10, 1, 1, 1) }
  row.costModels = { 'deepseek-flash': 7.75 }

  const d = service.detail()
  const model = d.models.find((m) => m.label === 'deepseek-flash')
  assert.ok(model, '模型行必须存在')
  assert.equal(model!.stat.cost?.PROMPT_TOKEN, 7.75, '按模型只有总额，承载在单一桶里')
  assert.equal(model!.stat.totalTokens, 12, 'token 口径不受金额影响')

  const month = d.months.find((m) => m.key === '2026-10')
  assert.equal(month?.stat.cost?.RESPONSE_TOKEN, 7.75)

  const day = d.days.find((m) => m.key === '2026-10-07')
  assert.equal(day?.stat.cost?.RESPONSE_TOKEN, 7.75)
})

