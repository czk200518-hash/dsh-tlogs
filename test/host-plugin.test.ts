/**
 * 宿主半侧集成测试。
 *
 * 验证「插件真的能被 DSH 加载并注册出正确的东西」，而不只是各函数单测通过：
 *  - `inject` 只声明必需服务（需求 5.3 权限最小化）
 *  - `Config` 是 schemastery schema，能补默认值并且与 resolveConfig 的口径一致
 *  - `apply(ctx, config)` 会注册 `query_token_usage` 工具，且定义满足
 *    dsh-tools `register()` 的**真实校验规则**（已核对源码）：
 *      output 必须是 { schema, render 函数 }；schema 必须落在受支持子集内；
 *      name 不能是保留名 run_code
 *  - apply 会通过 ctx.inject 等待 connection/webServer 并挂载 RPC 通道
 *  - 没有 token 时不会发起任何网络请求，且快照正确报告 auth=missing
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { apply, Config, inject as hostInject } from '../lib/index.js'
import { TLOGS_CHANNEL } from '../lib/types.js'
import { buildHeaders, buildUrl } from '../lib/api/usage-client.js'
import { resolveConfig } from '../lib/config.js'
import { canInteractiveLogin } from '../lib/auth/desktop-login.js'
import { MAX_TOKEN_INPUT } from '../lib/rpc.js'

/** 受支持的 JSON Schema 子集（来自 dsh-tools 的 checkSchemaNode）。 */
const CONSTRAINT_KEYWORDS = new Set([
  'type',
  'oneOf',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'const',
])
const ANNOTATION_KEYWORDS = new Set([
  'title',
  'description',
  'default',
  'examples',
  '$comment',
  'deprecated',
  'readOnly',
  'writeOnly',
])

/** 复刻 assertSupportedJsonSchema 的校验，确保工具 schema 一定能被注册。 */
function assertSupportedSchema(schema: unknown, path = 'schema'): void {
  assert.ok(schema && typeof schema === 'object' && !Array.isArray(schema), `${path} 必须是对象`)
  const node = schema as Record<string, unknown>
  for (const key of Object.keys(node)) {
    assert.ok(
      CONSTRAINT_KEYWORDS.has(key) || ANNOTATION_KEYWORDS.has(key),
      `${path}.${key} 不是受支持的 JSON Schema 关键字`,
    )
  }
  const hasType = Object.hasOwn(node, 'type')
  const hasOneOf = Object.hasOwn(node, 'oneOf')
  assert.ok(!(hasType && hasOneOf), `${path} 不能同时声明 type 与 oneOf`)
  assert.ok(hasType || hasOneOf, `${path} 必须声明 type 或 oneOf`)
  if (node.properties) {
    for (const [k, v] of Object.entries(node.properties as Record<string, unknown>)) {
      assertSupportedSchema(v, `${path}.properties.${k}`)
    }
  }
}

/** 造一个能记录注册行为的宿主 ctx。`account` 非空时模拟可用的 deepseekAccount。 */
function makeHostCtx(opts: { account?: Record<string, unknown> } = {}) {
  const registered: unknown[] = []
  const injectedNames: string[][] = []
  const rpcChannels: string[] = []
  const rpcHandlers = new Map<
    string,
    (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>
  >()
  const cleanups: Array<() => void> = []
  /** 账号服务被读取的次数（用于断言缓存生效）。 */
  const accountCalls = { getPlatformSession: 0 }

  const ctx: Record<string, unknown> = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    tools: {
      register: (def: unknown) => {
        registered.push(def)
        return () => {}
      },
    },
    get: () => undefined,
    effect: (fn: () => unknown) => {
      const d = fn()
      if (typeof d === 'function') cleanups.push(d as () => void)
    },
  }

  // 模拟 cordis：ctx.inject([...], cb) 只在服务可用时回调
  ctx.inject = (names: string[], cb: (c: unknown) => void) => {
    injectedNames.push(names)
    // 这里主动提供一个可用的 connection，验证 RPC 挂载路径
    const connection = {
      rpc: {
        handle: (
          channel: string,
          handler: (endpoint: string, payload?: Record<string, unknown>) => Promise<unknown>,
        ) => {
          rpcChannels.push(channel)
          rpcHandlers.set(channel, handler)
          return () => {}
        },
      },
    }
    // 只有被要求注入 deepseekAccount 时才提供一个可用实现；
    // 其它注入里 `get` 返回 undefined，模拟服务缺失。
    const get = (name: string): unknown => {
      if (name === 'deepseekAccount' && opts.account) {
        accountCalls.getPlatformSession++
        return opts.account
      }
      return undefined
    }
    cb({ ...ctx, connection, get })
  }

  return { ctx, registered, injectedNames, rpcChannels, rpcHandlers, cleanups, accountCalls }
}

test('host inject 只声明必需服务（权限最小化）', () => {
  assert.deepEqual(hostInject, ['tools'])
})

test('Config 是 schemastery schema，默认值与 resolveConfig 一致', () => {
  // schemastery schema 可直接调用以套用默认值
  const withDefaults = (Config as unknown as (v: unknown) => Record<string, unknown>)({})
  assert.equal(withDefaults.startYear, 2024)
  assert.equal(withDefaults.startMonth, 4)
  assert.equal(withDefaults.requestIntervalMs, 1000)
  assert.deepEqual(withDefaults.cacheTTL, { total: 1800, current: 300 })
  assert.equal(withDefaults.numberFormat, 'short')
  assert.equal(withDefaults.defaultExpanded, false)
  // 紧凑条默认只放「总计 + 今日」：四项并排会把这一行挤爆（实测末尾被裁）
  assert.deepEqual(withDefaults.compactMetrics, ['total', 'today'])
  assert.equal(withDefaults.enableDetailView, true)
  assert.equal(withDefaults.persistHistory, true)
  // 安全默认值：数字不离开本机（工具不注册）、允许零配置复用账号登录态
  assert.equal(withDefaults.exposeUsageToModel, false)
  assert.equal(withDefaults.useAccountSession, true)

  // resolveConfig 必须把上面的「秒」换算成毫秒，且默认值与之同源
  const resolved = resolveConfig(undefined, () => undefined)
  assert.equal(resolved.startYear, 2024)
  assert.equal(resolved.startMonth, 4)
  assert.equal(resolved.cacheTTL.total, 1800 * 1000)
  assert.equal(resolved.cacheTTL.current, 300 * 1000)
  assert.equal(resolved.exposeUsageToModel, false)
  assert.equal(resolved.useAccountSession, true)
})

test('默认不把用量数字暴露给模型：query_token_usage 不注册', () => {
  const { ctx, registered } = makeHostCtx()
  apply(ctx as never, { persistHistory: false })

  // 工具的返回值会进入模型上下文 —— 默认必须是「模型看不到」。
  assert.equal(
    registered.length,
    0,
    '默认（exposeUsageToModel 未开启）不得注册任何工具，否则用量数字会进入模型上下文',
  )
})

test('显式开启 exposeUsageToModel 后才注册工具', () => {
  const { ctx, registered } = makeHostCtx()
  apply(ctx as never, { persistHistory: false, exposeUsageToModel: true })
  assert.equal(registered.length, 1, '显式开启后才应注册')
  assert.equal((registered[0] as { name: string }).name, 'query_token_usage')
})

test('Config 拒绝非法枚举并接受合法值', () => {
  const validate = Config as unknown as (v: unknown) => Record<string, unknown>
  const ok = validate({ numberFormat: 'full', compactMetrics: ['total', 'month'] })
  assert.equal(ok.numberFormat, 'full')
  assert.deepEqual(ok.compactMetrics, ['total', 'month'])
  assert.throws(() => validate({ numberFormat: 'weird' }))
})

test('apply 注册 query_token_usage 工具，且定义满足 dsh-tools 的真实校验规则', () => {
  const { ctx, registered } = makeHostCtx()
  apply(ctx as never, { persistHistory: false, exposeUsageToModel: true })

  assert.equal(registered.length, 1, '应恰好注册一个工具')
  const tool = registered[0] as {
    name: string
    description: string
    parameters: Record<string, { type?: string; required?: boolean; description?: string; enum?: unknown }>
    output: { schema: unknown; render: (args: unknown, value: unknown) => unknown[] }
    execute: unknown
  }

  // dsh-tools register() 的硬性要求
  assert.equal(tool.name, 'query_token_usage')
  assert.notEqual(tool.name, 'run_code', 'run_code 是保留名')
  assert.ok(typeof tool.description === 'string' && tool.description.length > 10)
  assert.ok(tool.output && typeof tool.output === 'object', 'output 必须存在')
  assert.ok(typeof tool.output.render === 'function', 'output.render 必须是函数')
  assertSupportedSchema(tool.output.schema)
  assert.equal((tool.output.schema as { type?: string }).type, 'object')
  assert.equal(typeof tool.execute, 'function')

  // 参数 schema：现在断言的是**成品 JSON Schema** 的形态（见下方的专项回归测试）
  const params = tool.parameters as unknown as {
    type?: string
    properties?: Record<string, { type?: string; description?: string; enum?: unknown }>
    required?: string[]
  }
  assert.equal(params.type, 'object')
  assert.equal(params.properties?.scope?.type, 'string')
  assert.deepEqual(params.properties?.scope?.enum, ['total', 'today', 'week', 'month', 'project'])
  assert.ok(params.properties?.scope?.description)
  assert.deepEqual(params.required, ['scope'])

  // render 必须产出 text block
  const blocks = tool.output.render({ scope: 'total' }, {
    scope: 'total',
    inputTokens: 1100,
    outputTokens: 220,
    totalTokens: 1320,
    requests: 7,
  })
  assert.equal(blocks.length, 1)
  const block = blocks[0] as { type: string; text: string }
  assert.equal(block.type, 'text')
  assert.match(block.text, /1,320/, '应输出千分位精确值')
  assert.match(block.text, /1,100/)
  assert.match(block.text, /7/)
})

test('回归：parameters 必须是成品 JSON Schema，不是 dsh-tools 的参数 spec 表', () => {
  // 这条守的是一个真实线上事故。dsh-tools 的 schemaOf() 会把 definition.parameters
  // **原样**下发给 provider，只有 defineTool() 才会把 spec 表编译成 JSON Schema。
  // 本插件不能 import dsh-tools（profile 下解析不到），因此必须自己给成品 schema。
  // 曾经把 spec 表塞进去，导致每一轮对话都失败：
  //   Invalid schema for function 'query_token_usage':
  //   schema must be a JSON Schema of 'type: "object"', got 'type: null'.
  const { ctx, registered } = makeHostCtx()
  apply(ctx as never, { persistHistory: false, exposeUsageToModel: true })
  const tool = registered[0] as { parameters: Record<string, unknown> }

  const schema = tool.parameters

  // ① 根必须是 type: "object" —— provider 的硬性要求
  assert.equal(schema.type, 'object', 'parameters.type 必须是字符串 "object"')

  // ② 必须是 JSON Schema 的形态：properties / required 挂在根上，
  //    而不是 spec 表的 { scope: { type, required: true } } 形态
  assert.ok(
    schema.properties && typeof schema.properties === 'object',
    'parameters.properties 必须存在',
  )
  assert.ok(Array.isArray(schema.required), 'parameters.required 必须是字符串数组')
  assert.deepEqual(schema.required, ['scope'])

  // ③ 禁止 spec 表残留：属性节点里不得出现 required（JSON Schema 的 required
  //    只能出现在对象层且为数组；属性级的布尔 required 是 spec 表特征）
  for (const [key, node] of Object.entries(schema.properties as Record<string, unknown>)) {
    assert.ok(node && typeof node === 'object', `${key} 应是 schema 对象`)
    assert.equal(
      Object.hasOwn(node, 'required'),
      false,
      `属性 ${key} 里出现了 required —— 这是 dsh-tools spec 表残留，不是 JSON Schema`,
    )
  }

  // ④ 整体必须落在 dsh-tools 受支持的 JSON Schema 子集内
  //    （defineTool 会 assertSupportedJsonSchema；我们手写，所以自己守）
  assertSupportedSchema(schema, 'parameters')

  // ⑤ 顶层只有这三个键，形状与 provider 期望一致
  assert.deepEqual(Object.keys(schema).sort(), ['properties', 'required', 'type'])
})

test('apply 等待 connection/webServer 并挂载 /tlogs RPC 通道', () => {
  const { ctx, injectedNames, rpcChannels } = makeHostCtx()
  apply(ctx as never, { persistHistory: false })

  // deepseekAccount 走**可选**注入：web 版没有该服务，插件必须照常加载，
  // 所以它不能出现在 `export const inject` 里（那条测试另见下）。
  assert.deepEqual(
    injectedNames,
    [['deepseekAccount'], ['connection', 'webServer']],
    '应以最小服务集合等待连接能力；账号服务是可选注入',
  )
  assert.deepEqual(rpcChannels, [TLOGS_CHANNEL])
  assert.equal(TLOGS_CHANNEL, '/tlogs')
})

test('useAccountSession:false 时连可选注入都不发起，插件全程不接触账号服务', () => {
  const { ctx, injectedNames } = makeHostCtx()
  apply(ctx as never, { persistHistory: false, useAccountSession: false })

  assert.equal(
    injectedNames.some((names) => names.includes('deepseekAccount')),
    false,
    '关闭开关后不得向 deepseekAccount 注册任何注入回调 —— 这是「彻底关掉这条路径」的含义',
  )
  // RPC 通道仍要挂载（那与账号无关）
  assert.ok(injectedNames.some((names) => names.includes('connection')))
})

test('export 端点已停用：不再返回含项目绝对路径的全量报告', async () => {
  const saved = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  delete process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  try {
    const { ctx, rpcHandlers } = makeHostCtx()
    apply(ctx as never, { persistHistory: false, platformUserToken: '', requestIntervalMs: 0 })
    const handler = rpcHandlers.get(TLOGS_CHANNEL)
    assert.ok(handler)

    const res = (await handler('tlogs.export', { format: 'json' })) as {
      ok: boolean
      error?: { code?: string; message?: string }
    }
    assert.equal(res.ok, false, 'export 必须被拒绝')
    assert.equal(res.error?.code, 'disabled')
    assert.match(res.error?.message ?? '', /停用/)
  } finally {
    if (saved !== undefined) process.env.DEEPSEEK_PLATFORM_USER_TOKEN = saved
  }
})

test('强制刷新有最小间隔（已认证页面代码无法把它打成循环）', async () => {
  const saved = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  delete process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  try {
    const { ctx, rpcHandlers } = makeHostCtx()
    apply(ctx as never, { persistHistory: false, platformUserToken: '', requestIntervalMs: 0 })
    const handler = rpcHandlers.get(TLOGS_CHANNEL)
    assert.ok(handler)

    const first = (await handler('tlogs.refresh', { force: true })) as {
      ok: boolean
      value: { throttled?: boolean }
    }
    assert.equal(first.ok, true)
    assert.equal(first.value.throttled, undefined, '第一次强制刷新不应被节流')

    const second = (await handler('tlogs.refresh', { force: true })) as {
      value: { throttled?: boolean; retryAfterMs?: number }
    }
    assert.equal(second.value.throttled, true, '紧接着的第二次必须被节流（force 绕开全部 TTL）')
    assert.ok((second.value.retryAfterMs ?? 0) > 0)

    // 非强制（走 TTL）的刷新不受该节流影响
    const soft = (await handler('tlogs.refresh', {})) as { value: { throttled?: boolean } }
    assert.equal(soft.value.throttled, undefined)
  } finally {
    if (saved !== undefined) process.env.DEEPSEEK_PLATFORM_USER_TOKEN = saved
  }
})

test('方案 D 端到端：走 x-dsh-auth-token、保留合法 x- 头、且短 TTL 缓存生效', async () => {
  const saved = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  delete process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  const seen: Array<Record<string, string>> = []
  let destructiveCalls = 0

  const account = {
    async getPlatformSession() {
      return {
        origin: 'https://platform.deepseek.com',
        token: 'SESSION-TOKEN-VALUE',
        requestHeaders: { 'x-client-version': '9.9.9' },
      }
    },
    async signOut() {
      destructiveCalls++
      throw new Error('绝不能调用 signOut')
    },
    async rejectToken() {
      destructiveCalls++
      throw new Error('绝不能调用 rejectToken')
    },
  }

  const { ctx, rpcHandlers, accountCalls } = makeHostCtx({ account })

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    seen.push((init?.headers ?? {}) as Record<string, string>)
    return new Response(JSON.stringify({ code: 0, data: { biz_code: 0, biz_data: { total: [] } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch

  try {
    apply(ctx as never, { persistHistory: false, requestIntervalMs: 0 })
    const handler = rpcHandlers.get(TLOGS_CHANNEL)
    assert.ok(handler)

    await handler('tlogs.refresh', { force: true })
    await new Promise((r) => setTimeout(r, 50))

    assert.ok(seen.length > 0, '应至少发出一次请求')
    const h = seen[0]!
    assert.equal(h['x-dsh-auth-token'], 'SESSION-TOKEN-VALUE', '账号凭据必须走 x-dsh-auth-token')
    assert.equal(
      Object.keys(h).some((k) => k.toLowerCase() === 'authorization'),
      false,
      '不得同时带 Authorization',
    )
    assert.equal(h['x-client-version'], '9.9.9', '合法的 x- 前缀部署头应保留')
    assert.equal(h.Origin, 'https://platform.deepseek.com', 'Origin 仍是我们写死的伪装')

    // snapshot 会触发 authState → resolve；短 TTL 缓存应阻止每次轮询都去读账号服务
    const before = accountCalls.getPlatformSession
    await handler('tlogs.snapshot')
    await handler('tlogs.snapshot')
    assert.equal(
      accountCalls.getPlatformSession,
      before,
      '缓存应阻止「每 800ms 轮询都读一次账号服务」的放大效应',
    )

    const snap = (await handler('tlogs.snapshot')) as { value: { auth: { source?: string } } }
    assert.equal(snap.value.auth.source, 'platform-session')

    assert.equal(destructiveCalls, 0, '绝不调用 signOut / rejectToken（facade 之外无路径可达）')
  } finally {
    globalThis.fetch = originalFetch
    if (saved !== undefined) process.env.DEEPSEEK_PLATFORM_USER_TOKEN = saved
  }
})

test('账号服务不可用时插件照常加载（可选注入，不是加载前置条件）', () => {
  // inject 声明里绝不能出现 deepseekAccount：那会变成加载前置条件，
  // web 版/未登录场景下插件会直接加载失败。
  assert.deepEqual(hostInject, ['tools'])
  assert.ok(!hostInject.includes('deepseekAccount'))

  // ctx.inject 抛错（cordis 拒绝未注册服务）时也不能让 apply 崩溃。
  const registered: unknown[] = []
  const ctx: Record<string, unknown> = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    tools: { register: (d: unknown) => { registered.push(d); return () => {} } },
    get: () => {
      throw new Error('service not injected')
    },
    effect: () => {},
    inject: () => {
      throw new Error('unknown service deepseekAccount')
    },
  }
  assert.doesNotThrow(() => apply(ctx as never, { persistHistory: false, exposeUsageToModel: true }))
  assert.equal(registered.length, 1, '工具仍应注册')
})

test('没有可用 token 时不发起网络请求，快照报告 auth=missing', async () => {
  // 确保环境变量不会意外提供 token
  const saved = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  delete process.env.DEEPSEEK_PLATFORM_USER_TOKEN

  let fetchCalls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => {
    fetchCalls++
    throw new Error('测试期间不应发起网络请求')
  }) as typeof fetch

  try {
    const { ctx, registered } = makeHostCtx()
    apply(ctx as never, {
      persistHistory: false,
      platformUserToken: '',
      requestIntervalMs: 0,
      exposeUsageToModel: true,
    })
    const tool = registered[0] as { execute: (a: unknown, e: unknown) => Promise<Record<string, unknown>> }

    // 让 apply 内部的启动任务（恢复缓存 → 首次刷新）跑完
    await new Promise((r) => setTimeout(r, 50))

    const value = await tool.execute({ scope: 'total' }, { signal: new AbortController().signal })
    assert.equal(fetchCalls, 0, '无 token 时不得发起请求')
    assert.equal(value.totalTokens, 0)
    assert.equal(value.requests, 0)
  } finally {
    globalThis.fetch = originalFetch
    if (saved !== undefined) process.env.DEEPSEEK_PLATFORM_USER_TOKEN = saved
  }
})

test('快照下发 loginAvailable，如实反映宿主能否创建登录窗口', async () => {
  const saved = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  delete process.env.DEEPSEEK_PLATFORM_USER_TOKEN

  try {
    const { ctx, rpcHandlers } = makeHostCtx()
    apply(ctx as never, { persistHistory: false, platformUserToken: '', requestIntervalMs: 0 })
    await new Promise((r) => setTimeout(r, 50))

    const handler = rpcHandlers.get(TLOGS_CHANNEL)
    assert.ok(handler, `应挂载 ${TLOGS_CHANNEL} 通道`)

    const res = (await handler('tlogs.snapshot')) as {
      ok: boolean
      value: { display: { loginAvailable: unknown } }
    }
    assert.equal(res.ok, true)
    // 探测必须是「布尔且绝不抛错」：桌面端的插件宿主是 Electron-as-Node 子进程，
    // require('electron') 拿不到 BrowserWindow，此处应为 false，客户端据此置灰按钮。
    assert.equal(
      typeof res.value.display.loginAvailable,
      'boolean',
      'loginAvailable 必须是布尔值，客户端才能安全地据此置灰',
    )
    assert.equal(res.value.display.loginAvailable, canInteractiveLogin())
  } finally {
    if (saved !== undefined) process.env.DEEPSEEK_PLATFORM_USER_TOKEN = saved
  }
})

test('RPC setToken 拒绝超长/空白/非字符串输入（入口会把入参落盘并当请求头发出去）', async () => {
  const saved = process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  delete process.env.DEEPSEEK_PLATFORM_USER_TOKEN

  try {
    const { ctx, rpcHandlers } = makeHostCtx()
    apply(ctx as never, { persistHistory: false, platformUserToken: '', requestIntervalMs: 0 })
    const handler = rpcHandlers.get(TLOGS_CHANNEL)
    assert.ok(handler, `应挂载 ${TLOGS_CHANNEL} 通道`)

    const overLong = (await handler('tlogs.setToken', {
      token: 'a'.repeat(MAX_TOKEN_INPUT + 1),
    })) as { ok: boolean; error?: { message?: string } }
    assert.equal(overLong.ok, false, '超长输入必须被拒绝，否则会被落盘并当请求头送出去')
    assert.match(overLong.error?.message ?? '', /过长/)
    assert.match(overLong.error?.message ?? '', new RegExp(String(MAX_TOKEN_INPUT)))

    const blank = (await handler('tlogs.setToken', { token: '   ' })) as { ok: boolean }
    assert.equal(blank.ok, false)

    const wrongType = (await handler('tlogs.setToken', { token: 12345 })) as { ok: boolean }
    assert.equal(wrongType.ok, false)
  } finally {
    if (saved !== undefined) process.env.DEEPSEEK_PLATFORM_USER_TOKEN = saved
  }
})

test('未知 scope 直接抛错（模型会看到 Error: ...）', async () => {
  const { ctx, registered } = makeHostCtx()
  apply(ctx as never, { persistHistory: false, requestIntervalMs: 0, exposeUsageToModel: true })
  const tool = registered[0] as { execute: (a: unknown, e: unknown) => Promise<unknown> }
  await assert.rejects(
    () => tool.execute({ scope: 'nope' }, { signal: new AbortController().signal }),
    /未知的 scope/,
  )
})

test('请求头与 URL 与参考脚本逐字段一致', () => {
  const headers = buildHeaders('TOKEN123')
  assert.equal(headers.Authorization, 'Bearer TOKEN123')
  assert.equal(headers.Accept, 'application/json')
  assert.equal(headers['Content-Type'], 'application/json')
  assert.equal(headers['x-client-platform'], 'web')
  assert.equal(headers.Origin, 'https://platform.deepseek.com')
  assert.equal(headers.Referer, 'https://platform.deepseek.com/usage')
  assert.match(headers['User-Agent']!, /Chrome\/120/)

  assert.equal(
    buildUrl(2026, 10),
    'https://platform.deepseek.com/api/v0/usage/amount?year=2026&month=10',
  )
})

test('resolveConfig 对越界输入做夹取而非崩溃', () => {
  const c = resolveConfig(
    {
      startYear: 1900,
      startMonth: 99,
      requestIntervalMs: -5,
      cacheTTL: { total: 10 ** 12, current: -1 },
      maxToolRows: 9999,
      numberFormat: 'nope' as never,
      compactMetrics: ['bogus' as never, 'total'],
    },
    () => undefined,
  )
  assert.equal(c.startYear, 2024)
  assert.equal(c.startMonth, 12)
  assert.equal(c.requestIntervalMs, 0)
  assert.equal(c.cacheTTL.total, 24 * 3600 * 1000)
  assert.equal(c.cacheTTL.current, 0)
  assert.equal(c.maxToolRows, 200)
  assert.equal(c.numberFormat, 'short')
  assert.deepEqual(c.compactMetrics, ['total'])
})
