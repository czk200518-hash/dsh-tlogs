/**
 * 认证链路测试 —— 方案 D（复用 DSH 已登录账号的 Platform 会话凭据）。
 *
 * 这些测试锁定的是「实测后」确立的三条不变量：
 *
 *  1. `readPlatformSessionToken()` 只读、只认 `getPlatformSession()`，
 *     并且**绝不**调用 `rejectToken()` —— 后者会移除本地登录态，用它处理
 *     用量接口的失败会把用户的 DSH 账号退出登录。
 *  2. 解析优先级：手工凭据（env/配置/credentials）永远优先于自动复用，
 *     这样用户显式粘贴的 token 不会被账号凭据悄悄抢走。
 *  3. `Authorization` 头始终由本插件决定，部署请求头不得覆盖它；
 *     且 40003 归为认证失败，使刷新循环提前终止而不是把 31 个月全打一遍。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readPlatformSessionToken } from '../lib/auth/desktop-login.js'
import { MemorySecretStore, TLOGS_TOKEN_KEY, TokenManager, normalizeUserToken, redactToken } from '../lib/auth/token-manager.js'
import { buildHeaders, fetchMonth } from '../lib/api/usage-client.js'
import type { ResolvedToken } from '../lib/auth/token-manager.js'

// ------------------------------------------------------ readPlatformSessionToken

/** 造一个假的 deepseekAccount 服务，并记录破坏性方法是否被调用。 */
function makeAccountService(session: unknown, opts: { throwOnRead?: boolean } = {}) {
  const calls = { getPlatformSession: 0, rejectToken: 0, signOut: 0 }
  const service = {
    async getPlatformSession(): Promise<unknown> {
      calls.getPlatformSession++
      if (opts.throwOnRead) throw new Error('signed out')
      return session
    },
    async rejectToken(): Promise<void> {
      calls.rejectToken++
    },
    async signOut(): Promise<void> {
      calls.signOut++
    },
  }
  return { service, calls }
}

test('读取 Platform 会话凭据：拿到 token / origin / 部署请求头', async () => {
  const { service, calls } = makeAccountService({
    origin: 'https://platform.deepseek.com',
    token: 'session-token-abc',
    userId: 'u-1',
    requestHeaders: { 'x-deployment': 'cn' },
  })

  const cred = await readPlatformSessionToken(service)
  assert.equal(cred?.token, 'session-token-abc')
  assert.equal(cred?.origin, 'https://platform.deepseek.com')
  assert.deepEqual(cred?.headers, { 'x-deployment': 'cn' })
  assert.equal(calls.rejectToken, 0, '绝不能调用 rejectToken：那会把用户的 DSH 账号退出登录')
  assert.equal(calls.signOut, 0, '绝不能调用 signOut：那会把用户的 DSH 账号退出登录')
})

test('收窄 facade 的用法：只暴露 getPlatformSession，破坏性方法结构上不可达', async () => {
  // 这是 index.ts 实际采用的用法：把服务收窄成一个只有一个方法的 facade。
  // 这样「不调用 signOut/rejectToken」就不是约定，而是拿不到那些方法。
  const { service, calls } = makeAccountService({ origin: 'o', token: 't' })
  const facade = { getPlatformSession: () => service.getPlatformSession() }

  // facade 上确实不存在破坏性方法
  assert.equal('signOut' in facade, false)
  assert.equal('rejectToken' in facade, false)

  const cred = await readPlatformSessionToken(facade)
  assert.equal(cred?.token, 't')
  assert.equal(calls.getPlatformSession, 1)
  assert.equal(calls.signOut + calls.rejectToken, 0)
})

test('没有部署请求头时只返回 token / origin', async () => {
  const { service } = makeAccountService({ origin: 'https://platform.deepseek.com', token: 't' })
  const cred = await readPlatformSessionToken(service)
  assert.equal(cred?.token, 't')
  assert.equal(cred?.headers, undefined)
})

test('服务缺失 / 方法缺失 / 未登录 / 抛错都返回 undefined，且不抛给调用方', async () => {
  assert.equal(await readPlatformSessionToken(undefined), undefined)
  assert.equal(await readPlatformSessionToken(null), undefined)
  assert.equal(await readPlatformSessionToken('not-an-object'), undefined)
  assert.equal(await readPlatformSessionToken({}), undefined)
  assert.equal(await readPlatformSessionToken({ getPlatformSession: 'nope' }), undefined)

  // 未登录 → null
  const nullCase = makeAccountService(null)
  assert.equal(await readPlatformSessionToken(nullCase.service), undefined)

  // 实现内部抛错 → 吞掉
  const throwing = makeAccountService({ token: 'x' }, { throwOnRead: true })
  assert.equal(await readPlatformSessionToken(throwing.service), undefined)

  // token 为空串 → 视为没有
  const empty = makeAccountService({ origin: 'o', token: '   ' })
  assert.equal(await readPlatformSessionToken(empty.service), undefined)

  // requestHeaders 非对象 / 值非字符串 → 忽略而不是崩
  const weird = makeAccountService({ token: 't', requestHeaders: { a: 1, b: 'ok' } })
  assert.deepEqual((await readPlatformSessionToken(weird.service))?.headers, { b: 'ok' })
})

// ---------------------------------------------------------------- 解析优先级

function makeManager(overrides: {
  readPlatformSession?: () => Promise<ResolvedToken | undefined>
  readConfigToken?: () => string | undefined
  now?: () => number
}) {
  const secrets = new MemorySecretStore()
  const tokens = new TokenManager({ secrets, env: () => undefined, ...overrides })
  return { secrets, tokens }
}

test('方案 D：没有手工凭据时复用账号会话凭据，并带回部署请求头', async () => {
  let probed = 0
  const { tokens } = makeManager({
    readPlatformSession: async () => {
      probed++
      return {
        token: 'session-abc',
        source: 'platform-session',
        scheme: 'x-dsh-auth-token',
        headers: { 'x-deployment': 'cn' },
      }
    },
  })

  // 刷新之外：**取不到**账号会话凭据，也绝不向账号服务伸手。
  assert.equal(await tokens.resolve(), undefined)
  assert.equal(probed, 0, '租约之外绝不能向账号服务索取凭据')

  // 刷新期间（租约内）才可取。
  await tokens.beginCredentialLease()
  const r = await tokens.resolve()
  assert.equal(r?.token, 'session-abc')
  assert.equal(r?.source, 'platform-session')
  assert.equal(r?.scheme, 'x-dsh-auth-token', '账号会话凭据必须带上正确的投递方式')
  assert.deepEqual(r?.headers, { 'x-deployment': 'cn' })
  assert.equal(probed, 1)

  // 刷新结束：引用被丢弃，且不再重新索取。
  tokens.endCredentialLease()
  assert.equal(await tokens.resolve(), undefined)
  assert.equal(probed, 1, '租约释放后不应再去取')
  // 状态汇报用的是探测元数据，因此释放后依然如实 —— 不必为了汇报再取一次凭据。
  assert.deepEqual(await tokens.state(), { status: 'ok', source: 'platform-session' })
})

test('凭据租约：状态汇报不会为了「看一眼」而索取账号凭据', async () => {
  let probed = 0
  const { tokens } = makeManager({
    readPlatformSession: async () => {
      probed++
      return { token: 'session-abc', source: 'platform-session' }
    },
  })

  // 还没探测过：如实报「未知」，而不是去取一次凭据来回答。
  assert.deepEqual(await tokens.state(), { status: 'unknown' })
  assert.equal(probed, 0, 'state() 不得成为索取凭据的入口')

  await tokens.beginCredentialLease()
  await tokens.resolve()
  tokens.endCredentialLease()

  // 探测过之后再汇报多少次都不再取数。
  for (let i = 0; i < 5; i++) assert.deepEqual(await tokens.state(), { status: 'ok', source: 'platform-session' })
  assert.equal(probed, 1, '五轮 snapshot 轮询只应产生最初那一次探测')
})

test('凭据租约可重入：并发刷新共享一份，最后一层退出才释放', async () => {
  let probed = 0
  const { tokens } = makeManager({
    readPlatformSession: async () => {
      probed++
      return { token: 'session-abc', source: 'platform-session' }
    },
  })

  await tokens.beginCredentialLease()
  await tokens.beginCredentialLease()
  assert.equal(probed, 1, '嵌套租约不应重复索取')

  tokens.endCredentialLease()
  assert.equal((await tokens.resolve())?.token, 'session-abc', '内层退出后租约仍然有效')

  tokens.endCredentialLease()
  assert.equal(await tokens.resolve(), undefined, '最后一层退出才丢弃引用')
})

test('失效标记只留摘要：不保留已失效令牌的原文', async () => {
  const { tokens } = makeManager({})

  await tokens.markInvalid('bad-token-value', '401 unauthorized')

  // 行为正确：坏令牌不会被解析回来。
  assert.equal(await tokens.resolve(), undefined)
  assert.deepEqual(await tokens.state(), { status: 'invalid', message: '401 unauthorized' })
  assert.equal(tokens.needsLogin, true)

  // 安全性质：实例内部（含私有字段）不得残留令牌原文。
  const dump = JSON.stringify(tokens, (_k, v) => v)
  assert.equal(dump.includes('bad-token-value'), false, '失效令牌的原文不得留驻内存')
})

// ------------------------------------------------- 失效态的自动恢复（重新登录）

test('失效后重新登录：自动恢复一次，随即回到常规路径且不留凭据引用', async () => {
  let current = 'stale-token'
  let probed = 0
  let clock = 0
  const { tokens } = makeManager({
    readPlatformSession: async () => {
      probed++
      return { token: current, source: 'platform-session' }
    },
    now: () => clock,
  })

  await tokens.markInvalid('stale-token', '401 unauthorized')

  // 刚失效时先探一次（用户可能还没登录，探不到就维持失效）。
  assert.deepEqual(await tokens.state(), { status: 'invalid', message: '401 unauthorized' })
  assert.equal(probed, 1, '每次新失效都先给一次立即探测的机会')

  // 用户重新登录：账号服务换发了新凭据。
  current = 'fresh-token'
  clock += 30_000
  assert.deepEqual(await tokens.state(), { status: 'ok', source: 'platform-session' })
  assert.equal(probed, 2)

  // 恢复之后回到常规路径：继续轮询不再向账号服务索取任何东西。
  for (let i = 0; i < 6; i++) {
    clock += 800
    assert.deepEqual(await tokens.state(), { status: 'ok', source: 'platform-session' })
  }
  assert.equal(probed, 2, '恢复之后不再探测')

  // 安全性质：恢复探测取到的凭据原文没有留在实例里。
  assert.equal(JSON.stringify(tokens).includes('fresh-token'), false, '探测用的凭据不得留存')
})

test('失效态恢复探测有限速：轮询不会变成每秒一次的账号服务调用', async () => {
  let probed = 0
  let clock = 0
  const { tokens } = makeManager({
    readPlatformSession: async () => {
      probed++
      // 一直是那个坏值（用户还没重新登录）
      return { token: 'stale-token', source: 'platform-session' }
    },
    now: () => clock,
  })

  await tokens.markInvalid('stale-token', '401 unauthorized')
  await tokens.state()
  assert.equal(probed, 1)

  // 客户端在失效期间的密集轮询：800ms 一次，共 30 次（= 24 秒 < 30 秒限速）
  for (let i = 0; i < 30; i++) {
    clock += 800
    assert.deepEqual(await tokens.state(), { status: 'invalid', message: '401 unauthorized' })
  }
  assert.equal(probed, 1, '限速窗口内绝不再探')

  // 越过限速窗口后才再探一次。
  clock += 10_000
  await tokens.state()
  assert.equal(probed, 2)
})

test('失效态：账号服务始终是同一个坏值 / 没有凭据时，维持失效而不是误报已恢复', async () => {
  let mode: 'same-bad' | 'none' = 'same-bad'
  let clock = 0
  const { tokens } = makeManager({
    readPlatformSession: async () =>
      mode === 'none' ? undefined : { token: 'stale-token', source: 'platform-session' },
    now: () => clock,
  })

  await tokens.markInvalid('stale-token', '401 unauthorized')
  assert.deepEqual(await tokens.state(), { status: 'invalid', message: '401 unauthorized' })

  mode = 'none'
  clock += 60_000
  assert.deepEqual(
    await tokens.state(),
    { status: 'invalid', message: '401 unauthorized' },
    '探测不到凭据不等于已恢复',
  )
})

test('失效态恢复探测可并发去重：同一次探测被多个 snapshot 共享', async () => {
  let probed = 0
  let resolveProbe: ((v: ResolvedToken | undefined) => void) | undefined
  const { tokens } = makeManager({
    readPlatformSession: () => {
      probed++
      return new Promise<ResolvedToken | undefined>((res) => {
        resolveProbe = res
      })
    },
    now: () => 0,
  })

  await tokens.markInvalid('stale-token', '401 unauthorized')

  // 三个并发的 state()（模拟重叠的 snapshot 请求）只应发起一次探测。
  const all = Promise.all([tokens.state(), tokens.state(), tokens.state()])
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(probed, 1, '并发轮询必须共享同一次探测')

  resolveProbe?.({ token: 'fresh-token', source: 'platform-session' })
  const states = await all
  for (const s of states) assert.deepEqual(s, { status: 'ok', source: 'platform-session' })
})

test('手工粘贴的凭据优先于账号自动复用（不打扰账号服务）', async () => {
  let probed = 0
  const { secrets, tokens } = makeManager({
    readPlatformSession: async () => {
      probed++
      return { token: 'session-abc', source: 'platform-session' }
    },
  })
  await secrets.set(TLOGS_TOKEN_KEY, 'manual-token')

  const r = await tokens.resolve()
  assert.equal(r?.token, 'manual-token')
  assert.equal(r?.source, 'credentials')
  assert.equal(probed, 0, '已有手工凭据时不应再去读账号服务')
})

test('配置里的 token 也优先于账号自动复用', async () => {
  const { tokens } = makeManager({
    readConfigToken: () => 'config-token',
    readPlatformSession: async () => ({ token: 'session-abc', source: 'platform-session' }),
  })
  const r = await tokens.resolve()
  assert.equal(r?.token, 'config-token')
  assert.equal(r?.source, 'config')
})

test('账号凭据读取抛错时安全降级，不影响插件', async () => {
  const { tokens } = makeManager({
    readPlatformSession: async () => {
      throw new Error('account service exploded')
    },
  })
  // 取数只发生在租约内，所以异常路径也要在租约内验证：必须被吞掉，不得冒泡。
  await tokens.beginCredentialLease()
  assert.equal(await tokens.resolve(), undefined)
  tokens.endCredentialLease()
  assert.deepEqual(await tokens.state(), { status: 'missing' })
})

test('方案 A（按名字盲猜宿主服务 getter）已被移除，解析链里不再有它', async () => {
  // 这一条是**回归保护**：confused deputy 的代码不该被重新加回来。
  // 若将来有人恢复 readDesktopAuth，TokenManager 会接受该选项并优先返回它，
  // 这条断言就会失败。
  const { tokens } = makeManager({
    readPlatformSession: async () => ({ token: 'session-abc', source: 'platform-session' }),
    // 故意塞一个「看起来像猜出来的值」的无关选项，它必须被忽略。
    readDesktopAuth: async () => 'guessed-token',
  } as never)
  await tokens.beginCredentialLease()
  const r = await tokens.resolve()
  assert.equal(r?.token, 'session-abc')
  assert.notEqual(r?.source, 'desktop-auth')
  tokens.endCredentialLease()
})

// ------------------------------------------------------------------ 请求头合并

test('部署请求头可以覆盖同名头，但绝不能覆盖凭据头（两种方式都是）', () => {
  const headers = buildHeaders('real-token', {
    'x-deployment': 'cn',
    Authorization: 'Bearer attacker',
    origin: 'https://deployment.example',
  })

  // 白名单：`x-` 前缀的扩展头放行（同名替换，不产生大小写重复）
  assert.equal(headers['x-deployment'], 'cn')
  assert.equal(headers.Authorization, 'Bearer real-token', 'Authorization 必须仍是本插件选定的凭据')
  assert.equal(headers.Origin, 'https://platform.deepseek.com', 'Origin 是我们写死的伪装，不得被部署头改掉')
  assert.equal(Object.keys(headers).some((k) => k === 'origin'), false, '不应产生大小写不同的重复头')

  // x-dsh-auth-token 方式：同样是凭据头，不得被部署头或 Authorization 挤掉
  const alt = buildHeaders(
    'session-token',
    { 'x-dsh-auth-token': 'attacker', Authorization: 'Bearer attacker' },
    'x-dsh-auth-token',
  )
  assert.equal(alt['x-dsh-auth-token'], 'session-token')
  assert.equal(
    Object.keys(alt).some((k) => k.toLowerCase() === 'authorization'),
    false,
    'x-dsh-auth-token 方式下不应再带 Authorization',
  )
})

test('部署头白名单：非 x- 前缀与来源伪造类一律丢弃', () => {
  // 实测（本机回显服务器）：不做白名单时这些头会**原样到达服务器**
  const hostile = buildHeaders('real-token', {
    Cookie: 'session=attacker',
    Origin: 'https://attacker.example',
    Referer: 'https://attacker.example/',
    Host: 'evil.example',
    'X-Forwarded-For': '10.0.0.1',
    'x-forwarded-host': 'evil.example',
    'x-real-ip': '10.0.0.1',
    'User-Agent': 'attacker/1.0',
    'Content-Type': 'text/html',
  })

  for (const bad of ['Cookie', 'Host', 'X-Forwarded-For', 'x-forwarded-host', 'x-real-ip']) {
    assert.equal(
      Object.keys(hostile).some((k) => k.toLowerCase() === bad.toLowerCase()),
      false,
      `${bad} 必须被丢弃（Cookie 会带上别人的会话；转发类头可绕过平台限流）`,
    )
  }
  // Origin / Referer 保留我们写死的值：它们是免遭 WAF 拦截的伪装
  assert.equal(hostile.Origin, 'https://platform.deepseek.com')
  assert.equal(hostile.Referer, 'https://platform.deepseek.com/usage')
  assert.equal(hostile['Content-Type'], 'application/json')
  assert.match(hostile['User-Agent'], /Mozilla/)

  // 合法的客户端身份头（账号包实际下发的就是这一类）必须保留
  const good = buildHeaders('t', {
    'x-client-version': '1.2.3',
    'x-client-locale': 'zh_CN',
    'x-deployment': 'cn',
  })
  assert.equal(good['x-client-version'], '1.2.3')
  assert.equal(good['x-client-locale'], 'zh_CN')
  assert.equal(good['x-deployment'], 'cn')
})

// ------------------------------------------- 投递方式（实测：换头即成败）

test('x-dsh-auth-token 方式：令牌走自定义头，不带 Authorization', () => {
  const h = buildHeaders('session-abc', undefined, 'x-dsh-auth-token')
  assert.equal(h['x-dsh-auth-token'], 'session-abc')
  assert.equal(
    Object.keys(h).some((k) => k.toLowerCase() === 'authorization'),
    false,
    '账号会话凭据按 Bearer 送会被回 40003，必须只走 x-dsh-auth-token',
  )
  // 既有的网页 userToken 路径不变
  assert.equal(buildHeaders('web-token').Authorization, 'Bearer web-token')
})

test('scheme 从解析结果一路传到请求头', async () => {
  const { tokens } = makeManager({
    readPlatformSession: async () => ({
      token: 'session-abc',
      source: 'platform-session',
      scheme: 'x-dsh-auth-token',
    }),
  })
  await tokens.beginCredentialLease()
  const r = await tokens.resolve()
  assert.equal(r?.scheme, 'x-dsh-auth-token')
  tokens.endCredentialLease()

  let seen: Record<string, string> | undefined
  const fakeFetch = (async (_url: string | URL, init?: RequestInit) => {
    seen = init?.headers as Record<string, string>
    return new Response(JSON.stringify({ code: 0, data: { biz_code: 0, biz_data: {} } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch

  await fetchMonth({
    token: r!.token,
    scheme: r!.scheme,
    year: 2026,
    month: 8,
    fetchImpl: fakeFetch,
  })
  assert.equal(seen?.['x-dsh-auth-token'], 'session-abc')
  assert.equal(
    Object.keys(seen ?? {}).some((k) => k.toLowerCase() === 'authorization'),
    false,
    '实际请求里也不能出现 Authorization',
  )
})

// --------------------------------------------------------------- 40003 分类

test('40003（Authorization Failed）归为认证失败，使刷新循环提前终止', async () => {
  const calls: string[] = []
  const fakeFetch = (async (input: string | URL) => {
    calls.push(String(input))
    return new Response(
      JSON.stringify({ code: 40003, msg: 'Authorization Failed (invalid token)', data: null }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }) as unknown as typeof fetch

  const r = await fetchMonth({ token: 'bad', year: 2026, month: 8, fetchImpl: fakeFetch })
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.error.kind, 'unauthorized', '必须归类为认证失败，否则会把 31 个月全打一遍')
  assert.match(r.error.message, /40003/)
  assert.match(r.error.message, /Authorization Failed/)
  assert.equal(calls.length, 1)
})

test('安全：绝不跟随重定向，且报错里不含令牌', async () => {
  let seenInit: RequestInit | undefined
  const fakeFetch = (async (_url: string | URL, init?: RequestInit) => {
    seenInit = init
    return new Response('', {
      status: 302,
      headers: { location: 'https://evil.example/steal-the-token' },
    })
  }) as unknown as typeof fetch

  const SECRET = 'SUPER-SECRET-TOKEN-0123456789'
  const r = await fetchMonth({
    token: SECRET,
    scheme: 'x-dsh-auth-token',
    year: 2026,
    month: 8,
    fetchImpl: fakeFetch,
  })

  // 实测：运行时跨域重定向会剥掉 Authorization，但**不会**剥掉自定义头
  // （x-dsh-auth-token 会被原样转发）。所以必须显式禁止跟随。
  assert.equal(
    seenInit?.redirect,
    'manual',
    '必须显式禁止跟随重定向，否则账号令牌会被转发到重定向目标',
  )

  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.error.kind, 'http')
  assert.match(r.error.message, /重定向/)
  assert.match(r.error.message, /evil\.example/, '回显目标 origin 便于诊断')
  assert.equal(r.error.message.includes('steal-the-token'), false, '不回显整条 Location 路径')
  assert.equal(r.error.message.includes(SECRET), false, '错误信息绝不能包含令牌')
})

test('redactToken 只暴露长度，不暴露任何字符', () => {
  assert.equal(redactToken(undefined), '<none>')
  assert.equal(redactToken('short'), '<redacted:len=5>')
  assert.equal(redactToken('SUPERSECRETVALUE'), '<redacted:len=16>')
  assert.equal(
    redactToken('SUPERSECRETVALUE').includes('SUPE'),
    false,
    '早前会带前 4 位，那没有任何诊断价值却可用于交叉比对',
  )
})

test('normalizeUserToken 只接受可打印 ASCII：挡住「多行粘贴」这条令牌回显路径', () => {
  // 合法形态照旧接受
  assert.equal(normalizeUserToken('TESTONLY-fake-token-DO-NOT-USE0000000000000000000000000000000000'), 'TESTONLY-fake-token-DO-NOT-USE0000000000000000000000000000000000')
  assert.equal(normalizeUserToken('{"value":"abcDEF123+/=","__version":"0"}'), 'abcDEF123+/=')
  assert.equal(normalizeUserToken('Bearer abcDEF123'), 'abcDEF123')

  // 含空白/控制字符一律拒绝 —— 否则 undici 报错会把令牌原样回显进日志
  for (const bad of [
    'PART1\nPART2',
    'PART1\r\nPART2',
    'has space',
    'tab\tinside',
    '中文令牌',
    'null\u0000byte',
  ]) {
    assert.equal(normalizeUserToken(bad), undefined, `必须拒绝: ${JSON.stringify(bad)}`)
  }
  assert.equal(normalizeUserToken(''), undefined)
  assert.equal(normalizeUserToken(undefined), undefined)
})

test('安全：非法令牌导致的网络错误不得回显令牌、不得含换行', async () => {
  // 实测：undici 在请求头非法时的报错形如
  //   Headers.append: "Bearer <token>" is an invalid header value.
  // 即**原样回显头值**。若不做单行化，令牌会进日志、换行会污染日志行。
  const FAKE = 'FAKETOKENPART1\nFAKETOKENPART2'
  const r = await fetchMonth({ token: FAKE, scheme: 'bearer', year: 2026, month: 8 })

  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.error.message.includes('FAKETOKENPART1'), false, '错误文案绝不能包含令牌片段')
  assert.equal(/[\r\n]/.test(r.error.message), false, '错误文案必须是单行，否则可伪造日志行')
})

test('其它非零 code 仍按普通错误处理（不误判为认证失败）', async () => {
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ code: 50001, msg: 'server busy', data: null }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch

  const r = await fetchMonth({ token: 'x', year: 2026, month: 8, fetchImpl: fakeFetch })
  assert.equal(r.ok, false)
  if (r.ok) return
  assert.equal(r.error.kind, 'code')
})
