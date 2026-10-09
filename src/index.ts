/**
 * tlogs 宿主端入口（跑在 DSH 的 Node 进程里）。
 *
 * 双端结构：本文件是 `main` / `exports "."`；浏览器半侧由 `exports "./client"` 提供；`dsh.bundle.patch` 把插件行插入 profile roster。
 * 权限只声明 `tools` 为必需服务；credentials / connection / webServer / deepseekAccount 都是可选能力，用 `ctx.inject` 或
 * `ctx.get` 惰性获取，缺失时优雅降级而不是让插件加载失败。
 * 这里的 host 上下文用本地最小接口而不是 import `@deepseek-ai/cordis` 的 `Context`：profile 下的第三方插件无法保证能解析到
 * app.asar 内部的包，本地接口既保证离线可构建，也把本插件真正用到的宿主表面显式记录下来。
 */

import z from 'schemastery'
import { resolveConfig, sessionDirCandidates, type ResolvedConfig, type TlogsConfig } from './config.js'
import { HistoryStore } from './store/history.js'
import { ProjectHistoryStore } from './store/project-history.js'
import { SessionUsageStore } from './store/session-usage.js'
import { JsonFileCache } from './store/persist.js'
import { TokenManager, redactToken } from './auth/token-manager.js'
import { createCredentialStore } from './auth/credentials-store.js'
import { canInteractiveLogin, interactiveLogin, readPlatformSessionToken } from './auth/desktop-login.js'
import { UsageService, type Logger, type ProjectUsageProvider } from './service.js'
import { makeRpcHandler } from './rpc.js'
import { makeUsageTool } from './tools.js'
import { TLOGS_CHANNEL } from './types.js'
import { createProjectProvider } from './store/project.js'

/** 插件名（诊断/展示用；Loader 行 id 由 cordis.patch.yml 指定为 `tlogs`）。 */
export const name = 'tlogs'

/** 必需服务：只有注册面向模型的工具是硬需求。 */
export const inject = ['tools']

/**
 * 插件配置 schema（schemastery）。Loader 用 `Config` 校验 cordis.patch.yml 里该行传入的 config 并填默认值。
 * 展示相关配置由 host 通过 `tlogs.snapshot` 的 `display` 字段下发 —— 浏览器半侧读不到插件配置，
 * 只能读 `settings` 里被 `.volatile()` 标记的字段。
 */
export const Config = z.object({
  /** 不推荐手填；优先自动获取。 */
  platformUserToken: z.string().default(''),
  startYear: z.number().default(2024),
  startMonth: z.number().default(4),
  /** 月度请求之间的间隔，毫秒。 */
  requestIntervalMs: z.number().default(1000),
  /** 单位为秒，内部换算成毫秒。 */
  cacheTTL: z
    .object({
      total: z.number().default(1800),
      current: z.number().default(300),
    })
    .default({ total: 1800, current: 300 }),
  defaultExpanded: z.boolean().default(false),
  /**
   * 紧凑条展示的指标。默认只放「总计 + 今日」：侧边栏页脚很窄，指标一多四个标签就会被 flex 压成
   * 看不清的碎片。金额不进紧凑条，在展开面板的卡片与「详细数据」里看。
   * 可选 week / month / last7 / last30，以及对应的 cost_* 金额项。
   */
  compactMetrics: z
    .array(
      z.union([
        'total',
        'today',
        'week',
        'month',
        'last7',
        'last30',
        'cost_total',
        'cost_today',
        'cost_last7',
        'cost_last30',
      ]),
    )
    .default(['total', 'today']),
  enableDetailView: z.boolean().default(true),
  numberFormat: z.union(['full', 'short']).default('short'),
  /** 留空则用 `<DSH_HOME>/tlogs`（或 TLOGS_CACHE_DIR）。 */
  cacheDir: z.string().default(''),
  enableProjectScope: z.boolean().default(true),
  /** false 时完全不访问文件系统。 */
  persistHistory: z.boolean().default(true),
  /** 单位秒；0 = 关闭。 */
  autoRefreshSeconds: z.number().default(300),
  maxToolRows: z.number().default(20),
  /** 默认 false：工具返回值会进模型上下文。 */
  exposeUsageToModel: z.boolean().default(false),
  /** 是否复用 DSH 已登录账号的 Platform 会话凭据。默认 true（零配置取数）。 */
  useAccountSession: z.boolean().default(true),
  localUsage: z.boolean().default(true),
  /** 覆盖「近 30 天」窗口还留了 2 天余量。 */
  localUsageScanDays: z.number().default(32),
})

/** 本插件用到的那部分 host 上下文（与 `@deepseek-ai/cordis` 的 `Context` 兼容）。 */
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

/** 读取一个可选服务：cordis 访问未注入的服务会抛错，必须包住。 */
function optionalService(ctx: TlogsHostContext, name: string): unknown {
  try {
    return ctx.get?.(name)
  } catch {
    return undefined
  }
}

/** cordis 连接服务的最小形状（用于注册 RPC 通道）。 */
interface ConnectionLike {
  rpc?: {
    handle?: (channel: string, handler: unknown, opts?: unknown) => () => void
  }
}

export function apply(ctx: TlogsHostContext, rawConfig?: TlogsConfig): void {
  const logger: Logger = ctx.logger ?? console
  const resolved: ResolvedConfig = resolveConfig(rawConfig)

  const secrets = createCredentialStore(() => optionalService(ctx, 'credentials') as never, logger)

  // 复用 DSH 已登录账号的 Platform 会话凭据（零配置）。deepseekAccount 必须用可选注入拿：web 版没有该服务，
  // 写进 `export const inject` 会变成加载前置条件。拿到服务后立刻收窄成只暴露一个方法的 facade：那个服务上
  // 还有 signOut() / rejectToken() 这类会移除本地登录态的破坏性方法，只留 getPlatformSession 才能把
  // 「本插件不会调用它们」从口头约定变成结构上的不可能。
  let accountSession: { getPlatformSession: () => Promise<unknown> } | undefined
  if (!resolved.useAccountSession) {
    logger.info?.(
      'tlogs: 已按配置禁用账号会话凭据（useAccountSession: false）；' +
        '只使用环境变量 / 配置 / 本机凭据 / 手动填写',
    )
  } else if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['deepseekAccount'], (acctCtx) => {
        accountSession = {
          getPlatformSession: () => {
            const svc = optionalService(acctCtx, 'deepseekAccount') as Record<string, unknown> | undefined
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
   * 账号会话凭据的原始取数口径（无缓存）。它只在一次刷新开始时被 `beginCredentialLease()` 调用一次，
   * 刷新结束即释放引用，因此令牌不会常驻宿主内存；客户端每 800ms 一次的 snapshot → authState 轮询
   * 完全走不到这里。
   */
  const tokens = new TokenManager({
    secrets,
    readConfigToken: () => resolved.platformUserToken,
    readPlatformSession: async () => {
      const account = accountSession
      if (!account) return undefined

      const session = await readPlatformSessionToken(account)
      if (!session) {
        // 「没拿到」是正常状态（未登录），不是错误。
        logger.info?.('tlogs: 账号会话凭据不可用（未登录或未签发），本轮刷新改用其它来源')
        return undefined
      }

      // 账号会话凭据必须用 `x-dsh-auth-token` 投递：同一个令牌按 Authorization: Bearer
      // 送会被接口回 40003，换成这个头才返回真实用量。日志只记 origin 与脱敏长度。
      logger.info?.(
        `tlogs: 本轮刷新持有账号会话凭据 origin=${session.origin ?? '<unknown>'} token=${redactToken(session.token)}`,
      )
      return {
        token: session.token,
        source: 'platform-session' as const,
        scheme: 'x-dsh-auth-token' as const,
        headers: session.headers,
      }
    },
    // 不做「按名字盲猜宿主服务的 token getter」：那会无参调用任何名字恰好匹配的
    // 宿主方法（可能有副作用），还可能把推理令牌或 API Key 当作平台会话令牌发出去。
    // 上面这条有契约的 Host-only 接口已经把自动获取做对了。
    interactiveLogin: () => interactiveLogin({ logger }),
  })

  const history = new HistoryStore()
  /** 项目用量的逐日快照：与 `history` 同存一个 JSON 的两个顶层键下但语义独立，它读宿主会话投影、与平台账单无关，退出登录时一并清除。 */
  const projectHistory = new ProjectHistoryStore()
  /**
   * 本机口径（第二路数据源）：从会话日志重建逐日用量。平台接口只覆盖官方通道且当天要等结算；本机口径
   * 实时、覆盖本机所有供应商。只读日志，`localUsage: false` 时连目录都不列。
   */
  const localUsage = resolved.localUsage
    ? new SessionUsageStore({
        roots: sessionDirCandidates(),
        logger,
        maxDays: resolved.localUsageScanDays,
      })
    : undefined
  const cache = new JsonFileCache({
    dir: resolved.cacheDir,
    logger,
    enabled: resolved.persistHistory,
  })

  /**
   * 落盘内容：历史月份 + 项目快照 + 本机逐日用量，都只有数字，没有任何凭据或文本；本机口径的会话日志路径只落不可逆短哈希（见 store/session-usage.ts）。
   */
  const snapshotForDisk = (): unknown => ({
    ...history.serialize(),
    projects: projectHistory.serialize().projects,
    ...(localUsage ? { localUsage: localUsage.serialize() } : {}),
  })

  const projectProvider: ProjectUsageProvider = createProjectProvider(ctx, logger)

  const service = new UsageService({
    config: resolved,
    history,
    projectHistory,
    resolveToken: () => tokens.resolve(),
    onAuthInvalid: (token, message) => tokens.markInvalid(token, message),
    authState: () => tokens.state(),
    // 凭据租约：刷新开始时取来，刷新结束（含异常）立刻释放。这是唯一会向宿主索取
    // 凭据的时机，其余时间它不在本插件内存里。
    beginCredentialLease: () => tokens.beginCredentialLease(),
    endCredentialLease: () => tokens.endCredentialLease(),
    logger,
    projectProvider,
    ...(localUsage ? { localUsage } : {}),
    onChanged: () => scheduleSave(),
    // 客户端据此把「登录」按钮置灰：桌面端的插件宿主创建不了 BrowserWindow，
    // 登录窗口从来就打不开。
    loginAvailable: () => canInteractiveLogin(),
  })

  // 落盘去抖动：逐月请求期间不写盘，安静 2 秒后才写一次。
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const scheduleSave = () => {
    if (!resolved.persistHistory) return
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void cache.save(snapshotForDisk())
    }, 2000)
    // Node 的定时器不该拖住进程退出。
    ;(saveTimer as unknown as { unref?: () => void }).unref?.()
  }

  // 启动：恢复缓存 → 首次刷新。放后台，不阻塞插件加载。
  void (async () => {
    try {
      const saved = await cache.load()
      if (saved) {
        const restored = HistoryStore.deserialize(saved)
        for (const row of restored.serialize().rows) history.set(row)
        const projects = projectHistory.load(saved)
        const localFiles = localUsage?.load((saved as { localUsage?: unknown }).localUsage) ?? 0
        logger.info?.(
          `tlogs: 已从缓存恢复 ${restored.size} 个月的历史数据` +
            `${projects > 0 ? `与 ${projects} 个项目的用量快照` : ''}` +
            `${localFiles > 0 ? `（本机口径 ${localFiles} 个会话日志的聚合）` : ''}（${cache.path}）`,
        )
      }
    } catch (e) {
      logger.warn?.(`tlogs: 恢复缓存失败：${e instanceof Error ? e.message : String(e)}`)
    }
    service.startRefresh('mount')
  })()

  // 定时自动刷新：它只决定多久触发一次，真正打哪些月份仍由 cacheTTL 判定
  // （当月 5 分钟、全量历史 30 分钟），所以不会每 5 分钟就把 31 个月全拉一遍。
  if (resolved.autoRefreshSeconds > 0) {
    const timer = setInterval(() => {
      try {
        service.startRefresh('scheduled')
      } catch (e) {
        logger.warn?.(`tlogs: 定时刷新失败：${e instanceof Error ? e.message : String(e)}`)
      }
    }, resolved.autoRefreshSeconds * 1000)
    // Node 的定时器不该拖住进程退出。
    ;(timer as unknown as { unref?: () => void }).unref?.()
    if (typeof ctx.effect === 'function') {
      ctx.effect(() => () => clearInterval(timer), 'tlogs: auto refresh dispose')
    }
    logger.info?.(`tlogs: 已启用定时自动刷新，间隔 ${resolved.autoRefreshSeconds}s`)
  }

  const handle = makeRpcHandler({
    service,
    tokens,
    clearHistory: () => {
      history.clear()
      projectHistory.clear()
      localUsage?.clear()
      void cache.save(snapshotForDisk())
    },
    logger,
  })

  const mountRpc = (owner: TlogsHostContext): void => {
    const connection = owner.connection as ConnectionLike | undefined
    if (typeof connection?.rpc?.handle !== 'function') {
      logger.warn?.('tlogs: connection.rpc 不可用，客户端 UI 将无法读取数据')
      return
    }

    // cordis 的 rpc getter 把句柄绑在原始服务上下文上，这里需要重新绑定到本次注入的
    // web 上下文，`rpc.handle()` 才能注册到 webServer 上（与已发布的
    // dsh-workspace-mover 在 0.2.x 上的做法一致）。
    const rawConnection =
      ((connection as unknown as Record<symbol, unknown>)[Symbol.for('cordis.original')] as
        | ConnectionLike
        | undefined) ?? connection
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

    // 0.2.x 的 rpc.handle 只接受 (channel, handler)；旧文档里的 loopback 选项在现行
    // DSH 里是 no-op，真正的保护来自连接本身：所有 RPC 都要求浏览器会话 Cookie
    // （否则 401）并经过 Host/Origin 围栏（否则 403），非本机来源进不来。
    const dispose = scopedConnection.rpc.handle(TLOGS_CHANNEL, async (endpoint: string, payload: Record<string, unknown> = {}) =>
      handle(endpoint, payload ?? {}),
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
    // 包住：某些宿主里 inject 对未注册服务会直接抛错。RPC 挂不上只是 UI 拿不到数据，
    // 绝不能让整个插件（连同 query_token_usage 工具）加载失败。
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

  // 面向模型的工具默认不注册：工具的返回值就是模型上下文，注册即意味着用量数字会
  // 离开本机。只有显式打开 `exposeUsageToModel` 才暴露。
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
