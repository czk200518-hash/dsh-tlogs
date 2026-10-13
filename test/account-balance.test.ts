/**
 * 宿主侧「余额高频通道」的验证。
 *
 * 这条通道与用量刷新刻意分家：余额走 `deepseekAccount.getBalance()`（宿主自己投递授权令牌，
 * 本插件不接触凭据），所以它才能 5 秒一查；而「官方累计消费」只有 `get_user_summary` 给得出，
 * 仍旧跟着刷新周期走。这一组守的就是这个分工，以及轮询的开关语义。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readPlatformBalance, timezoneOffsetSeconds } from '../lib/auth/account-balance.js'
import { BALANCE_POLL_INTERVAL_MS } from '../lib/service.js'
import { apply } from '../lib/index.js'
import { TLOGS_CHANNEL } from '../lib/types.js'

/** 造一个「一被调用就抛错」的账号服务：异常原文必须能被折叠成单行，不能伪造多行日志。 */
function failingAccount(): { getBalance: () => Promise<unknown> } {
  return {
    getBalance() {
      throw new Error('账号服务炸了\nSECOND-LINE-INJECTION')
    },
  }
}

const wallet = (balance: string, currency = 'CNY') => ({ currency, balance })

/**
 * 宿主投影后的成功态。Platform 的 `normal_wallets` / `bonus_wallets` 到了 `getBalance()` 出参里已经改名成
 * `value` / `bonusWallets`（见 dsh-deepseek-account 的 AccountController 契约），这里必须按投影后的名字造。
 */
const ready = (value: unknown[], bonusWallets: unknown[] = []) => ({ status: 'ready', value, bonusWallets })

/**
 * 与 lib 里那份 `import.meta.url` 同一形态的入口地址：`lib/auth/account-balance.js`，包根上溯两级。
 * 模块相对路径依赖它解析，所以这里必须按真实布局构造，否则测的就不是真实解析路径。
 */
const entryUrl = new URL('../lib/auth/account-balance.js', import.meta.url).href

test('余额取数：请求体带上包版本 / 语言 / UTC 偏移，且令牌由宿主投递（本插件不传凭据）', async () => {
  const seenArgs: unknown[][] = []
  const service = {
    getBalance(...args: unknown[]) {
      seenArgs.push(args)
      return Promise.resolve(ready([wallet('20.51050378')], [wallet('5.0000000000000000')]))
    },
  }

  const balance = await readPlatformBalance({
    service,
    entryUrl,
    env: (n) => (n === 'LANG' ? 'zh_CN.UTF-8' : undefined),
  })

  assert.deepEqual(balance, { balance: 20.51050378, bonusBalance: 5, currency: 'CNY' })
  assert.equal(seenArgs.length, 1, '应恰好调用一次 getBalance')
  // 入参只有一个界面元数据对象：没有 token、没有 headers —— 凭据不在本插件这一侧。
  assert.equal(seenArgs[0]!.length, 1, 'getBalance 只接受界面元数据一个参数')
  const client = seenArgs[0]![0] as Record<string, unknown>
  assert.deepEqual(Object.keys(client).sort(), ['locale', 'timezoneOffsetSeconds', 'version'])
  assert.equal(client.version, '0.1.0', '版本应取自本插件 package.json（它进 x-client-version 头）')
  assert.equal(client.locale, 'zh_CN.UTF-8', '语言原样交给宿主，由宿主归约成 zh_CN / en_US')
  assert.equal(client.timezoneOffsetSeconds, timezoneOffsetSeconds())
  assert.equal(typeof client.timezoneOffsetSeconds, 'number')
})

test('UTC 偏移：东为正的整秒（北京 +08:00 → 28800）', () => {
  assert.equal(timezoneOffsetSeconds(new Date('2026-10-12T00:00:00Z')), -new Date().getTimezoneOffset() * 60)
  assert.equal(timezoneOffsetSeconds(), -new Date().getTimezoneOffset() * 60)
  assert.equal(Number.isInteger(timezoneOffsetSeconds()), true)
})

test('读不到包版本就不查余额（宁可这一格不更新，也不编一个版本号去冒充构建）', async () => {
  let called = 0
  const balance = await readPlatformBalance({
    service: {
      getBalance: () => {
        called++
        return ready([wallet('1')])
      },
    },
    entryUrl: new URL('file:///definitely/missing/package.json').href,
  })
  assert.equal(balance, undefined)
  assert.equal(called, 0, '版本拿不到时不该发出请求')
})

test('失败一律降级为 undefined，日志压成单行（异常原文不得伪造多行日志）', async () => {
  const warns: string[] = []
  const logger = { warn: (m: string) => warns.push(m) }

  const missing = await readPlatformBalance({ service: undefined })
  assert.equal(missing, undefined, '没接入账号服务时应静默降级')
  assert.equal(warns.length, 0, '没接入是正常状态，不该报警')

  const thrown = await readPlatformBalance({
    service: failingAccount(),
    logger,
  })
  assert.equal(thrown, undefined)
  assert.equal(warns.length, 1)
  assert.match(warns[0]!, /账号服务炸了/, '异常原因仍需可见，否则排查不了')
  assert.equal(/[\r\n]/.test(warns[0]!), false, '日志必须压成单行：宿主异常里的换行不能伪造多行日志')
  assert.ok(warns[0]!.length <= 240, '异常原文要截断，不能让一条日志无限长')

  // 未登录（null）与结构不认识：都只是「这次没有结果」。
  assert.equal(await readPlatformBalance({ service: { getBalance: () => Promise.resolve(null) } }), undefined)
  assert.equal(await readPlatformBalance({ service: { getBalance: () => Promise.resolve('nope') } }), undefined)
  assert.equal(await readPlatformBalance({ service: { getBalance: () => Promise.resolve([]) } }), undefined)
})

test('钱包结构：缺字段按 0、非法值不产生 NaN、赠送余额独立于充值余额', async () => {
  const onlyNormal = await readPlatformBalance({
    service: { getBalance: () => ready([{ currency: 'USD', balance: '1.5' }]) },
  })
  assert.deepEqual(onlyNormal, { balance: 1.5, bonusBalance: 0, currency: 'USD' })

  const junk = await readPlatformBalance({
    service: { getBalance: () => ready([{ balance: 'abc' }], [{ balance: '0E-16' }]) },
  })
  assert.deepEqual(junk, { balance: 0, bonusBalance: 0, currency: 'CNY' })

  // 成功态但钱包为空是真实的 0（比如余额刚好花光），不是「读不懂」。
  const empty = await readPlatformBalance({
    service: { getBalance: () => ready([], []) },
  })
  assert.deepEqual(empty, { balance: 0, bonusBalance: 0, currency: 'CNY' })
})

test('宿主出参必须先认投影：Platform 原始字段名（normal_wallets）在这里不再成立', async () => {
  // 这条守的是一个真实事故：宿主把 normal_wallets / bonus_wallets 投影成 value / bonusWallets，
  // 插件按 Platform 的原始名字读，两条数组都读成空 —— 界面上「明明有余额却永远显示 ¥0」，且不报错。
  const projected = await readPlatformBalance({
    service: { getBalance: () => ready([wallet('12.1893149')], [wallet('0E-16')]) },
  })
  assert.deepEqual(projected, { balance: 12.1893149, bonusBalance: 0, currency: 'CNY' })

  // 宿主的失败态（未登录 / 平台拒绝）是正常留空，连带不出日志。
  const warns: string[] = []
  const logger = { warn: (m: string) => warns.push(m) }
  assert.equal(await readPlatformBalance({ service: { getBalance: () => ({ status: 'failed' }) }, logger }), undefined)
  assert.deepEqual(warns, [])

  // 其余形状（没有 status、有 status 却没钱包、钱包不是数组）都是契约漂移：留空，但必须留下能排查的字段名 ——
  // 这个事故当初之所以难查，正是因为旧代码不报错、只是把余额写成 0。
  assert.equal(await readPlatformBalance({ service: { getBalance: () => ({}) }, logger }), undefined)
  assert.equal(await readPlatformBalance({ service: { getBalance: () => ({ status: 'ready' }) }, logger }), undefined)
  assert.equal(
    await readPlatformBalance({ service: { getBalance: () => ready(undefined as never) }, logger }),
    undefined,
  )
  assert.equal(warns.length, 3)
  assert.match(warns[0]!, /结构不认识/)
  assert.match(warns[1]!, /status/, '日志要带上收到的字段名，否则排查无从下手')
  assert.equal(/[\r\n]/.test(warns.join('')), false, '日志仍需压成单行')
})

/** 记录注册行为的最小宿主 ctx（与 host-plugin.test.ts 同款，但账号服务可注入 getBalance）。 */
function makeHostCtx(account?: Record<string, unknown>) {
  const injectedNames: string[][] = []
  const rpcHandlers = new Map<string, (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>>()
  const ctx: Record<string, unknown> = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    tools: { register: () => () => {} },
    get: () => undefined,
    effect: (fn: () => unknown) => {
      const d = fn()
      return d
    },
  }
  ctx.inject = (names: string[], cb: (c: unknown) => void) => {
    injectedNames.push(names)
    const connection = {
      rpc: {
        handle: (
          channel: string,
          handler: (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>,
        ) => {
          rpcHandlers.set(channel, handler)
          return () => {}
        },
      },
    }
    const get = (name: string): unknown => (name === 'deepseekAccount' ? account : undefined)
    cb({ ...ctx, connection, get })
  }
  return { ctx, injectedNames, rpcHandlers }
}

/** 逐帧可控的假定时器：记录节奏，并让「停」可断言。 */
function makeFakeTimers() {
  const timers = new Map<number, () => void>()
  let seq = 0
  const intervals: number[] = []
  const cleared: number[] = []
  return {
    intervals,
    cleared,
    setInterval(fn: () => void, ms: number): unknown {
      const id = ++seq
      intervals.push(ms)
      timers.set(id, fn)
      return id
    },
    clearInterval(handle: unknown): void {
      const id = handle as number
      cleared.push(id)
      timers.delete(id)
    },
    /** 触发所有仍在跑的定时器一次。 */
    tick(): void {
      for (const fn of [...timers.values()]) fn()
    },
    get running(): number {
      return timers.size
    },
  }
}

const flush = () => new Promise((r) => setTimeout(r, 30))

test('端到端：balanceWatch 让余额按 5 秒节奏查，收起即停且不产生请求', async () => {
  const saved = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  delete process.env.DEEPSEEK_PLATFORM_USER_TOKEN

  const fake = makeFakeTimers()
  let balanceReads = 0
  let sessionReads = 0
  const account = {
    async getPlatformSession() {
      sessionReads++
      return undefined
    },
    async getBalance() {
      balanceReads++
      return ready([wallet('20.51050378')], [wallet('3.5')])
    },
  }

  try {
    const { ctx, rpcHandlers } = makeHostCtx(account)
    apply(ctx as never, {
      persistHistory: false,
      localUsage: false,
      requestIntervalMs: 0,
      setInterval: fake.setInterval,
      clearInterval: fake.clearInterval,
    } as never)
    const handler = rpcHandlers.get(TLOGS_CHANNEL)
    assert.ok(handler, `应挂载 ${TLOGS_CHANNEL} 通道`)
    await flush()

    const sessionsBefore = sessionReads

    // ---- 打开：立刻查一次，并起一个 5 秒定时器 ----
    const opened = (await handler('tlogs.balanceWatch', { on: true })) as {
      ok: boolean
      value: { account?: { balance: number; bonusBalance: number } }
    }
    assert.equal(opened.ok, true)
    assert.equal(balanceReads, 1, '打开面板必须立刻查一次（不能等满 5 秒才显示）')
    assert.deepEqual(fake.intervals, [BALANCE_POLL_INTERVAL_MS])
    assert.equal(BALANCE_POLL_INTERVAL_MS, 5000)
    assert.equal(fake.running, 1)
    assert.ok(
      opened.value.account && opened.value.account.balance === 20.51050378,
      '返回值应已带上刚查回的余额',
    )

    // ---- 间隔到点：再查一次 ----
    fake.tick()
    await flush()
    assert.equal(balanceReads, 2, '每个 5 秒周期应查一次余额')

    // ---- 重复打开不叠加定时器 ----
    await handler('tlogs.balanceWatch', { on: true })
    await flush()
    assert.equal(fake.running, 1, '重复打开不得叠加第二个定时器')
    assert.equal(fake.intervals.length, 1)
    assert.equal(balanceReads, 3, '重复打开补一次查询即可，不得在原有节奏上叠加多发')

    // ---- 收起：立刻停，且此后不再产生任何请求 ----
    const closed = (await handler('tlogs.balanceWatch', { on: false })) as { ok: boolean }
    assert.equal(closed.ok, true)
    assert.equal(fake.running, 0, '收起后不得还有定时器在跑')
    assert.deepEqual(fake.cleared, [1])
    const readsAfterClose = balanceReads
    fake.tick()
    await flush()
    assert.equal(balanceReads, readsAfterClose, '收起后 tick 不该再查（面板没人看着就不该有请求）')

    // 余额走的是账号服务，全程不产生用量请求，也不去索取会话凭据。
    assert.equal(sessionReads, sessionsBefore, '余额通道不得顺带索取会话凭据（每个周期都不许）')
  } finally {
    if (saved !== undefined) process.env.DEEPSEEK_PLATFORM_USER_TOKEN = saved
  }
})

test('余额通道超时/失败只是不更新：不抛给客户端，也不动已有余额', async () => {
  const saved = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  delete process.env.DEEPSEEK_PLATFORM_USER_TOKEN

  const fake = makeFakeTimers()
  let fail = false
  const account = {
    async getPlatformSession() {
      return undefined
    },
    async getBalance() {
      if (fail) throw new Error('network down')
      return ready([wallet('7.25')])
    },
  }

  try {
    const { ctx, rpcHandlers } = makeHostCtx(account)
    apply(ctx as never, {
      persistHistory: false,
      localUsage: false,
      requestIntervalMs: 0,
      setInterval: fake.setInterval,
      clearInterval: fake.clearInterval,
    } as never)
    const handler = rpcHandlers.get(TLOGS_CHANNEL)!
    await flush()

    const first = (await handler('tlogs.balanceWatch', { on: true })) as { value: { account?: { balance: number } } }
    assert.equal(first.value.account?.balance, 7.25)

    fail = true
    fake.tick()
    await flush()
    const afterFailure = (await handler('tlogs.snapshot')) as { ok: boolean; value: { account?: { balance: number } } }
    assert.equal(afterFailure.ok, true, '余额查询失败不得让 snapshot 变成错误')
    assert.equal(afterFailure.value.account?.balance, 7.25, '失败应保留上一次的余额，而不是清成 0 或 NaN')
  } finally {
    if (saved !== undefined) process.env.DEEPSEEK_PLATFORM_USER_TOKEN = saved
  }
})

test('useAccountSession:false 时余额通道不存在（不该从另一条路碰账号服务）', async () => {
  const saved = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  delete process.env.DEEPSEEK_PLATFORM_USER_TOKEN

  const fake = makeFakeTimers()
  let balanceReads = 0
  const account = {
    async getPlatformSession() {
      return undefined
    },
    async getBalance() {
      balanceReads++
      return ready([wallet('1')])
    },
  }

  try {
    const { ctx, injectedNames, rpcHandlers } = makeHostCtx(account)
    apply(ctx as never, {
      persistHistory: false,
      localUsage: false,
      requestIntervalMs: 0,
      useAccountSession: false,
      setInterval: fake.setInterval,
      clearInterval: fake.clearInterval,
    } as never)
    const handler = rpcHandlers.get(TLOGS_CHANNEL)!
    await flush()

    assert.equal(
      injectedNames.some((n) => n.includes('deepseekAccount')),
      false,
      '彻底关掉账号路径后，连余额也不该从这条服务走',
    )
    const res = (await handler('tlogs.balanceWatch', { on: true })) as {
      ok: boolean
      value: { account?: unknown }
    }
    assert.equal(res.ok, true, '开关本身仍应成功，只是没有余额可查')
    assert.equal(balanceReads, 0, '关掉账号路径后，余额通道一次都不该碰账号服务')
    await flush()
    assert.equal(balanceReads, 0, '定时器周期到了也只应空转（没有账号服务可查），绝不发请求')
    // 收起时定时器照旧要停：空转也不该留着。
    await handler('tlogs.balanceWatch', { on: false })
    assert.equal(fake.running, 0)
  } finally {
    if (saved !== undefined) process.env.DEEPSEEK_PLATFORM_USER_TOKEN = saved
  }
})

test('余额与官方累计消费合并成一行：余额来自高频通道，累计消费仍由刷新带回', async () => {
  const saved = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  delete process.env.DEEPSEEK_PLATFORM_USER_TOKEN

  const fake = makeFakeTimers()
  const account = {
    async getPlatformSession() {
      return {
        origin: 'https://platform.deepseek.com',
        token: 'SESSION',
        requestHeaders: { 'x-client-version': '9.9.9' },
      }
    },
    async getBalance() {
      return ready([wallet('20.51050378')], [wallet('1.25')])
    },
  }

  const originalFetch = globalThis.fetch
  // 刷新周期里只有 get_user_summary 给得出 total_costs。
  globalThis.fetch = (async (url: string) => {
    const body = String(url).includes('get_user_summary')
      ? {
          code: 0,
          data: {
            biz_code: 0,
            biz_data: {
              normal_wallets: [wallet('11.11')],
              bonus_wallets: [],
              total_costs: [{ currency: 'CNY', amount: '726.6813341' }],
            },
          },
        }
      : { code: 0, data: { biz_code: 0, biz_data: { total: [], days: [] } } }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch

  try {
    const { ctx, rpcHandlers } = makeHostCtx(account)
    apply(ctx as never, {
      persistHistory: false,
      localUsage: false,
      requestIntervalMs: 0,
      startYear: 2026,
      startMonth: 10,
      setInterval: fake.setInterval,
      clearInterval: fake.clearInterval,
    } as never)
    const handler = rpcHandlers.get(TLOGS_CHANNEL)!
    await flush()
    await handler('tlogs.refresh', { force: true })
    await flush()

    const snap = (await handler('tlogs.snapshot')) as {
      value: { account?: { balance: number; bonusBalance: number; totalCosts?: number } }
    }
    // 刷新先带回 11.11（get_user_summary 的余额），随后高频通道把它压成 20.51…
    // 累计消费两个来源都只有刷新给得出，必须留在同一行里。
    assert.equal(snap.value.account?.totalCosts, 726.6813341, '官方累计消费来自刷新周期')

    const opened = (await handler('tlogs.balanceWatch', { on: true })) as {
      value: { account?: { balance: number; bonusBalance: number; totalCosts?: number } }
    }
    assert.equal(opened.value.account?.balance, 20.51050378, '余额必须取高频通道那一次')
    assert.equal(opened.value.account?.bonusBalance, 1.25)
    assert.equal(
      opened.value.account?.totalCosts,
      726.6813341,
      '余额被高频通道更新后，累计消费不能被一起抹掉',
    )
  } finally {
    globalThis.fetch = originalFetch
    if (saved !== undefined) process.env.DEEPSEEK_PLATFORM_USER_TOKEN = saved
  }
})
