/**
 * tlogs — 宿主端（Host half）插件入口。
 *
 * 本插件的双端结构（与 DSH 0.2.0-rc.2 的双面插件约定一致，已对照
 * 已发布的第三方双面插件核对）：
 *   - `exports "."` / `main`      → 本文件，跑在 DSH host（Node 进程）
 *   - `exports "./client"`        → 浏览器半侧，由 /plugins/<id>/client.js 提供
 *   - `dsh.bundle.patch`          → cordis.patch.yml，把插件行插入 profile roster
 *   - `dsh.client.inject`         → 浏览器半侧声明的客户端服务依赖
 *
 * 权限（需求 5.3 最小化）：
 *   只把 `tools` 声明为**必需**服务；`credentials` / `connection` / `webServer`
 *   都是**可选**能力，通过 `ctx.inject([...], cb)` 或 `ctx.get(name)` 惰性获取，
 *   缺失时优雅降级而不是让插件加载失败。
 *
 * 关于类型：这里使用本地最小接口 `TlogsHostContext` 而不是 import
 * `@deepseek-ai/cordis` 的 `Context`。原因是 profile 下的第三方插件无法保证
 * 能解析到 app.asar 内部的包；本地接口既保证构建可离线完成，也把本插件
 * 真正用到的 host 表面（surface）显式记录下来。
 */

import z from 'schemastery'
import { resolveConfig, type ResolvedConfig, type TlogsConfig } from './config.js'
import { HistoryStore } from './store/history.js'
import { JsonFileCache } from './store/persist.js'
import { TokenManager, redactToken } from './auth/token-manager.js'
import { createCredentialStore } from './auth/credentials-store.js'
import {
  canInteractiveLogin,
  interactiveLogin,
  readPlatformSessionToken,
} from './auth/desktop-login.js'
import { UsageService, type Logger, type ProjectUsageProvider } from './service.js'
import { makeRpcHandler } from './rpc.js'
import { makeUsageTool } from './tools.js'
import { TLOGS_CHANNEL } from './types.js'
import { createProjectProvider } from './store/project.js'

/** 插件名（诊断/展示用；Loader 行 id 由 cordis.patch.yml 指定为 `tlogs`）。 */
export const name = 'tlogs'

/**
 * 必需服务。只有 `tools` 是真正必需的（注册面向模型的工具）；
 * credentials / connection / webServer 都作为可选能力惰性获取。
 */
export const inject = ['tools']

/**
 * 插件配置 schema（schemastery）。
 *
 * DSH 的 Loader 会用 `Config` 校验 cordis.patch.yml 里该行传入的 config，
 * 默认值在激活时填充。为避免「客户端读不到插件配置」的问题
 * （浏览器半侧只能读 `settings` 里被 `.volatile()` 标记的字段），
 * 展示相关配置由 host 通过 `tlogs.snapshot` 的 `display` 字段下发。
 */
export const Config = z.object({
  /** 手动指定 userToken（不推荐；优先自动获取）。 */
  platformUserToken: z.string().default(''),
  /** 起始查询年（与权威 Python 脚本一致）。 */
  startYear: z.number().default(2024),
  /** 起始查询月（与权威 Python 脚本一致）。 */
  startMonth: z.number().default(4),
  /** 月度请求间隔（毫秒，对应 Python 的 time.sleep(REQUEST_INTERVAL)）。 */
  requestIntervalMs: z.number().default(1000),
  /** 缓存时长（**秒**）。 */
  cacheTTL: z
    .object({
      total: z.number().default(1800),
      current: z.number().default(300),
    })
    .default({ total: 1800, current: 300 }),
  /** 内嵌组件默认是否展开。 */
  defaultExpanded: z.boolean().default(false),
  /**
   * 紧凑条展示的指标。
   *
   * 默认只有「总计 + 今日」—— 本周/本月在展开面板里看。四项并排会把紧凑条挤爆，
   * 末尾数字被右边缘裁掉（实测）。
   */
  compactMetrics: z.array(z.union(['total', 'today', 'week', 'month'])).default(['total', 'today']),
  /** 是否启用详细面板。 */
  enableDetailView: z.boolean().default(true),
  /** 数字格式。 */
  numberFormat: z.union(['full', 'short']).default('short'),
  /** 缓存目录；留空则用 `<DSH_HOME>/tlogs`（或 TLOGS_CACHE_DIR）。 */
  cacheDir: z.string().default(''),
  /** 是否启用「当前项目消耗」卡片。 */
  enableProjectScope: z.boolean().default(true),
  /** 是否允许历史缓存落盘（false 时完全不访问文件系统）。 */
  persistHistory: z.boolean().default(true),
  /** 工具结果最多返回多少行。 */
  maxToolRows: z.number().default(20),
  /**
   * 是否把用量数字暴露给模型（注册 query_token_usage）。
   *
   * **默认 false。** 工具的返回值会进入模型上下文 —— 也就是把你的用量统计当作
   * 对话内容发给模型提供方。默认不注册，数字只走 host→浏览器 RPC 进侧边栏 UI。
   */
  exposeUsageToModel: z.boolean().default(false),
  /**
   * 是否复用 DSH 已登录账号的 Platform 会话凭据（方案 D）。
   *
   * **默认 true**（零配置取数）。设 false 后插件完全不接触 `deepseekAccount`：
   * 连可选注入都不会发起，只剩手工/环境变量/配置三条显式来源。
   */
  useAccountSession: z.boolean().default(true),
})

/**
 * 本插件真正用到的 host 上下文表面。
 * 与 `@deepseek-ai/cordis` 的 `Context` 兼容；只列出用到的方法。
 */
export interface TlogsHostContext {
  logger?: Logger
  tools?: { register: (definition: unknown) => unknown }
  inject?: (names: string[], cb: (ctx: TlogsHostContext) => void) => unknown
  get?: (name: string) => unknown
  effect?: (fn: () => unknown, label?: string) => unknown
  credentials?: unknown
  connection?: unknown
  webServer?: unknown
  [key: string]: unknown
}

/** 安全读取一个可选服务（未注入时会被 cordis 拒绝，必须包住）。 */
function peek(ctx: TlogsHostContext, name: string): unknown {
  try {
    return ctx.get?.(name)
  } catch {
    return undefined
  }
}

/** cordis 连接服务的最小形状（用于 RPC 通道注册）。 */
interface ConnectionLike {
  rpc?: {
    handle?: (channel: string, handler: unknown, opts?: unknown) => () => void
  }
}

/** 插件入口。 */
export function apply(ctx: TlogsHostContext, rawConfig?: TlogsConfig): void {
  const logger: Logger = ctx.logger ?? console
  const resolved: ResolvedConfig = resolveConfig(rawConfig)

  // ---------- 凭据 ----------
  const secrets = createCredentialStore(() => peek(ctx, 'credentials') as never, logger)

  // 方案 D：复用 DSH 已登录账号的 Platform 会话凭据（零配置）。
  //
  // 用**可选**注入拿 deepseekAccount：web 版没有该服务，插件必须照常加载，
  // 因此不能写进 `export const inject`（那会变成加载前置条件）。
  //
  // 安全：拿到服务后立刻**收窄成只暴露一个方法的 facade**。deepseekAccount 上
  // 还有 `signOut()` / `rejectToken()` 这类会移除本地登录态的破坏性方法；只留
  // `getPlatformSession`，才能把「本插件不会调用它们」从口头约定变成**结构上的
  // 不可能** —— 令牌路径根本拿不到那些方法。
  let accountSession: { getPlatformSession: () => Promise<unknown> } | undefined
  if (!resolved.useAccountSession) {
    // 彻底关掉这条路径：**连可选注入都不发起**，插件全程不接触账号服务。
    logger.info?.(
      'tlogs: 已按配置禁用账号会话凭据（useAccountSession: false）；' +
        '只使用环境变量 / 配置 / 本机凭据 / 手动填写',
    )
  } else if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['deepseekAccount'], (acctCtx) => {
        accountSession = {
          getPlatformSession: () => {
            const svc = peek(acctCtx, 'deepseekAccount') as Record<string, unknown> | undefined
            const fn = svc?.['getPlatformSession']
            if (typeof fn !== 'function') return Promise.resolve(undefined)
            return (fn as (this: unknown) => Promise<unknown>).call(svc)
          },
        }
        logger.info?.('tlogs: 已接入 deepseekAccount（已收窄为只读的 getPlatformSession）')
      })
    } catch (e) {
      logger.warn?.(`tlogs: 接入 deepseekAccount 失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  /**
   * 账号会话凭据的短 TTL 缓存。
   *
   * 为什么需要：客户端在刷新期间每 800ms 拉一次 `snapshot`，而
   * `snapshot → authState → resolve()` 在「没有手工凭据」时**每次都会调用
   * `getPlatformSession()`**。不缓存就是每秒 1~2 次账号服务调用（可能涉及凭据读取）
   * 外加同频率的日志行 —— 一个纯属浪费的放大效应。
   *
   * 缓存时长刻意很短：既消除放大效应，又让凭据在内存里的驻留时间保持在分钟级以内。
   * 拿到令牌缓存久一点（60s），「没拿到」缓存短一点（15s），这样用户刚登录完不至于
   * 干等一分钟。
   */
  const SESSION_TOKEN_TTL_MS = 60_000
  const SESSION_MISS_TTL_MS = 15_000
  type SessionCredential = {
    token: string
    source: 'platform-session'
    scheme: 'x-dsh-auth-token'
    headers?: Record<string, string>
  }
  let sessionCache: { at: number; value: SessionCredential | undefined } | undefined

  const tokens = new TokenManager({
    secrets,
    readConfigToken: () => resolved.platformUserToken,
    readPlatformSession: async () => {
      const account = accountSession
      if (!account) return undefined

      const now = Date.now()
      if (sessionCache) {
        const ttl = sessionCache.value ? SESSION_TOKEN_TTL_MS : SESSION_MISS_TTL_MS
        if (now - sessionCache.at < ttl) return sessionCache.value
      }

      const session = await readPlatformSessionToken(account)
      // 关键：账号会话凭据必须用 `x-dsh-auth-token` 投递。
      // 实测同一个令牌按 `Authorization: Bearer` 送会被接口回 `40003`，
      // 换成这个头就返回 `code:0` 的真实用量 —— 头错了而已，凭据本身是好的。
      const value: SessionCredential | undefined = session
        ? {
            token: session.token,
            source: 'platform-session',
            scheme: 'x-dsh-auth-token',
            headers: session.headers,
          }
        : undefined
      sessionCache = { at: now, value }

      if (session) {
        // 只在真正重新读取时记一行（不是每次 resolve），且只记 origin 与脱敏长度。
        logger.info?.(
          `tlogs: 复用账号会话凭据 origin=${session.origin ?? '<unknown>'} token=${redactToken(session.token)}（缓存 ${SESSION_TOKEN_TTL_MS / 1000}s）`,
        )
      }
      return value
    },
    // 方案 A（按名字盲猜宿主服务的 token getter）已**移除**。
    //
    // 它是 confused deputy：插件主动调用自己没有契约的宿主方法，任何名字恰好匹配
    // 的函数都会被无参调用（可能有副作用）；若返回的是推理令牌或 API Key，还会被
    // 当作平台会话令牌发往 platform.deepseek.com。方案 D 已经用**有契约的**
    // Host-only 接口把自动获取做对了，这条猜测路径纯属多余的攻击面。
    interactiveLogin: () => interactiveLogin({ logger }),
  })

  // ---------- 历史缓存 ----------
  const history = new HistoryStore()
  const cache = new JsonFileCache({
    dir: resolved.cacheDir,
    logger,
    enabled: resolved.persistHistory,
  })

  // ---------- 项目用量来源（P2，不可用时优雅降级） ----------
  const projectProvider: ProjectUsageProvider = createProjectProvider(ctx, logger)

  // ---------- 服务 ----------
  const service = new UsageService({
    config: resolved,
    history,
    resolveToken: () => tokens.resolve(),
    onAuthInvalid: (token, message) => tokens.markInvalid(token, message),
    authState: () => tokens.state(),
    logger,
    projectProvider,
    onChanged: () => scheduleSave(),
    // 客户端据此把「登录」按钮置灰：桌面端的插件宿主是 Electron-as-Node
    // 子进程，创建不了 BrowserWindow，登录窗口从来就打不开。
    loginAvailable: () => canInteractiveLogin(),
  })

  // ---------- 缓存落盘（去抖动，避免逐月请求每次都写盘） ----------
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const scheduleSave = () => {
    if (!resolved.persistHistory) return
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void cache.save(history.serialize())
    }, 2000)
    // Node 的定时器不该拖住进程退出。
    ;(saveTimer as unknown as { unref?: () => void }).unref?.()
  }

  // ---------- 启动：恢复缓存 → 首次刷新 ----------
  void (async () => {
    try {
      const saved = await cache.load()
      if (saved) {
        const restored = HistoryStore.deserialize(saved)
        for (const row of restored.serialize().rows) history.set(row)
        logger.info?.(`tlogs: 已从缓存恢复 ${restored.size} 个月的历史数据（${cache.path}）`)
      }
    } catch (e) {
      logger.warn?.(`tlogs: 恢复缓存失败：${e instanceof Error ? e.message : String(e)}`)
    }
    // 首次挂载自动刷新一次（需求 1.5）。放在后台，不阻塞插件加载。
    service.startRefresh('mount')
  })()

  // ---------- RPC 通道（需求 4.1：host 端负责数据获取） ----------
  const handle = makeRpcHandler({
    service,
    tokens,
    clearHistory: () => {
      history.clear()
      void cache.save(history.serialize())
    },
    logger,
  })

  const mountRpc = (owner: TlogsHostContext): void => {
    const connection = owner.connection as ConnectionLike | undefined
    if (typeof connection?.rpc?.handle !== 'function') {
      logger.warn?.('tlogs: connection.rpc 不可用，客户端 UI 将无法读取数据')
      return
    }

    // cordis 的 rpc getter 会把句柄绑在原始服务上下文上；这里按以下步骤把它
    // 重新绑定到本次注入的 web 上下文，`rpc.handle()` 才能注册到 webServer 上。
    // 该处理与已发布的 dsh-workspace-mover 在 0.1.5+/0.2.x 上的做法逐行一致。
    const rawConnection =
      ((connection as unknown as Record<symbol, unknown>)[Symbol.for('cordis.original')] as ConnectionLike | undefined) ??
      connection
    const extend = (rawConnection as unknown as Record<symbol, unknown>)[Symbol.for('cordis.extend')]
    const scopedConnection =
      typeof extend === 'function'
        ? ((extend as (o: { ctx: TlogsHostContext }) => ConnectionLike).call(rawConnection, { ctx: owner }) ??
          connection)
        : connection

    if (typeof scopedConnection?.rpc?.handle !== 'function') {
      logger.warn?.('tlogs: 无法在本上下文注册 RPC 通道')
      return
    }

    // 注意：0.2.0-rc.2 的 `rpc.handle` 只接受 (channel, handler)。
    // 旧版本文档里的 `{ authority: 'loopback' }` 在现代 DSH 里是 no-op
    // （已核对源码：没有方法级的 loopback 分级），因此这里不再传入。
    // 真正的保护来自连接本身：所有 RPC 都要求浏览器会话 Cookie（否则 401），
    // 并且经过 Host/Origin 围栏（否则 403），所以非本机来源无法访问该通道。
    const dispose = scopedConnection.rpc.handle(
      TLOGS_CHANNEL,
      async (endpoint: string, payload: Record<string, unknown> = {}) => handle(endpoint, payload ?? {}),
    )

    ctx.effect?.(() => () => {
      try {
        dispose?.()
      } catch {
        /* ignore */
      }
    }, 'tlogs: rpc dispose')
  }

  if (typeof ctx.inject === 'function') {
    // 包住：某些宿主里 `inject` 对未注册服务会直接抛错。RPC 挂不上只是 UI
    // 拿不到数据，绝不能让整个插件（连同 query_token_usage 工具）加载失败。
    try {
      ctx.inject(['connection', 'webServer'], (webCtx) => mountRpc(webCtx))
    } catch (e) {
      logger.warn?.(
        `tlogs: 等待 connection/webServer 失败，RPC 通道未挂载：${e instanceof Error ? e.message : String(e)}`,
      )
    }
  } else {
    mountRpc(ctx)
  }

  // ---------- 面向模型的工具（需求 4.3） ----------
  //
  // 默认**不注册**：工具的返回值就是模型上下文，注册即意味着用量数字会离开
  // 本机。只有显式打开 `exposeUsageToModel` 才暴露给模型。
  if (!resolved.exposeUsageToModel) {
    logger.info?.(
      'tlogs: 用量数字不暴露给模型（query_token_usage 未注册）；' +
        '如需在对话中查询，请设置 exposeUsageToModel: true',
    )
  } else if (typeof ctx.tools?.register === 'function') {
    try {
      ctx.tools.register(makeUsageTool(service))
    } catch (e) {
      logger.warn?.(`tlogs: 注册 query_token_usage 工具失败：${e instanceof Error ? e.message : String(e)}`)
    }
  } else {
    logger.warn?.('tlogs: tools 服务不可用，query_token_usage 工具未注册')
  }
}
