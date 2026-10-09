/**
 * tlogs — userToken 的获取、归一化、存储与生命周期管理。
 * 安全约束：token 绝不写入源码或打包产物，只经 DSH 的 credentials seam（见 `SecretStore`）
 * 持久化，不进日志/错误文案/UI，且只发往 platform.deepseek.com。
 */

import { createHash } from 'node:crypto'

import type { AuthState, CredentialScheme, TokenSource } from '../types.js'

/** 凭据系统中使用的键名。 */
export const TLOGS_TOKEN_KEY = 'tlogs:userToken'

/** 环境变量名（开发调试用）。 */
export const TOKEN_ENV_VAR = 'DEEPSEEK_PLATFORM_USER_TOKEN'

/**
 * 凭据存储抽象：host 入口传入基于 DSH `ctx.credentials` 的实现，测试传入内存实现 ——
 * 这样 token 的来源与存储方式都能在不启动 DSH 运行时的情况下单测。
 */
export interface SecretStore {
  get(key: string): Promise<string | undefined> | string | undefined
  set(key: string, value: string): Promise<void> | void
  delete(key: string): Promise<void> | void
}

/** 内存实现，用于测试与降级（进程重启即丢失，不落盘）。 */
export class MemorySecretStore implements SecretStore {
  private readonly map = new Map<string, string>()

  get(key: string): string | undefined {
    return this.map.get(key)
  }

  set(key: string, value: string): void {
    this.map.set(key, value)
  }

  delete(key: string): void {
    this.map.delete(key)
  }
}

/**
 * 归一化外部拿到的 userToken 原始值。
 *
 * platform.deepseek.com 把 token 以 JSON 字符串存在 localStorage，形如
 * `{"value":"...","__version":"0"}` —— 整个对象不是 token，只有 `value` 字段才是。
 * 接受的输入：这种 JSON、被序列化过的裸串（`"Vc8..."`）、裸串、误带 `Bearer ` 前缀的串；
 * 返回 undefined 表示拿不到有效 token。
 */
export function normalizeUserToken(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  let s = raw.trim()
  if (s.length === 0) return undefined

  // JSON 两种形态；解析失败就按裸串处理。
  if (s.startsWith('{')) {
    try {
      const parsed = JSON.parse(s) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const v = (parsed as { value?: unknown }).value
        if (typeof v === 'string') s = v.trim()
      }
    } catch {
      // 保持原样，继续按裸串处理
    }
  } else if (s.startsWith('"')) {
    try {
      const parsed = JSON.parse(s) as unknown
      if (typeof parsed === 'string') s = parsed.trim()
    } catch {
      // 保持原样
    }
  }

  s = s.replace(/^Bearer\s+/i, '').trim()

  if (s.length === 0) return undefined

  // 只接受可打印 ASCII（无空格、无控制字符）：平台令牌是 base64 风格字母表，绝不含空白；
  // 而带换行的值会让运行时构造请求头时抛错，那条消息会把头的值原样回显 —— 令牌因此进了
  // 宿主日志与面板错误文案。在这里挡掉，用户看到的是「格式无效」而非含令牌的报错。
  if (!/^[\x21-\x7e]+$/.test(s)) return undefined

  return s
}

/**
 * token 的脱敏展示，仅用于日志/诊断：只暴露长度。长度够区分「拿到了/没拿到」，
 * 暴露前缀只会让日志变成可用于交叉比对、确认猜测的材料。
 */
export function redactToken(token: string | undefined): string {
  if (!token) return '<none>'
  return `<redacted:len=${token.length}>`
}

/**
 * 令牌的 SHA-256 摘要。用途只有一个：判断某个候选令牌是不是那个已知失效的值 ——
 * 等值比较不需要原文，「记住一个坏令牌」不该让它在内存里长驻。
 */
function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

/** 一次成功解析的结果。 */
export interface ResolvedToken {
  token: string
  source: TokenSource
  /** 凭据投递方式。默认 `bearer`；账号会话凭据必须用 `x-dsh-auth-token`。 */
  scheme?: CredentialScheme
  /** 仅当来源附带部署请求头时存在（账号会话凭据）。 */
  headers?: Record<string, string>
}

export interface TokenManagerOptions {
  secrets: SecretStore
  env?: (name: string) => string | undefined
  readConfigToken?: () => string | undefined
  /**
   * 复用 DSH 已登录账号的 Platform 会话凭据：与其它来源不同，它可能附带签发方要求的
   * 请求头，因此返回值多一个 `headers`。
   */
  readPlatformSession?: () => Promise<ResolvedToken | undefined>
  interactiveLogin?: () => Promise<string | undefined>
  /** 毫秒；用于测试失效态恢复探测的限速行为。 */
  now?: () => number
}

/**
 * 失效态下自动恢复探测的最小间隔（毫秒）。
 *
 * 只有「已知凭据失效」这一种状态才会发起探测，所以它不是常态开销。但失效期间客户端仍在
 * 每 800ms 拉一次 snapshot，没有这个下限就会退化成每秒一次的账号服务调用。
 */
export const RECOVERY_PROBE_INTERVAL_MS = 30_000

/**
 * token 解析优先级，自上而下先命中者胜（表格见 README「凭据」）：
 *   1. 环境变量 DEEPSEEK_PLATFORM_USER_TOKEN —— 显式覆盖，开发调试用
 *   2. 插件配置 platformUserToken —— 显式配置
 *   3. credentials seam 中的 `tlogs:userToken` —— 手动输入或桌面登录后持久化
 *   4. 账号会话凭据 —— 复用 DSH 已登录账号，零配置，仅在刷新租约内可用（见 `beginCredentialLease`）
 *   5. 交互式登录 —— 仅在显式调用 `login()` 时触发
 *
 * 4 排在 1/2/3 之后：用户显式配置或粘贴的 token 永远优先于自动复用；排在交互式登录之前：
 * 前者拿的是真正面向 Platform 的凭据，而后者要用户动手。
 *
 * 注意 1/2 是静态配置，「退出登录」清不掉它们；要彻底退出得同时移除配置项与环境变量
 * （README 里也写了，免得出现「点了退出登录却还在用旧 token」的误解）。
 */
export class TokenManager {
  private readonly opts: TokenManagerOptions
  /** 上次解析出的 token 及其来源，供 UI 展示与诊断。 */
  private cached: { token: string; source: TokenSource } | undefined
  /**
   * 被显式标记为失效的 token 的 SHA-256 摘要（收到 401 后）。只存摘要不存原文：
   * 唯一需要的语义是「某个候选值是不是那个已知坏值」，摘要足够做等值比较。
   */
  private invalidTokenHash: string | undefined
  private invalidMessage: string | undefined
  /** 手动输入但不想落盘时使用。 */
  private transient: string | undefined
  /** 账号会话凭据的租约；只在一个刷新周期内持有（见 `beginCredentialLease`）。 */
  private sessionLease: ResolvedToken | undefined
  /** 并发刷新共享同一份租约，最后一层退出时才真正释放。 */
  private sessionLeaseDepth = 0
  /**
   * 最近一次真实探测账号会话凭据的结果：只留元数据（探到没有、是不是那个已知坏值），
   * 不留 token —— 供 `state()` 在租约之外如实汇报认证状态，而不必为了汇报再取一次凭据。
   */
  private sessionProbe: { has: boolean; invalid: boolean } | undefined
  /** 毫秒；undefined = 尚未探测过。 */
  private lastRecoveryProbeAt: number | undefined
  /** 进行中的恢复探测：并发的 snapshot 共享同一次，不重复向宿主索取。 */
  private recoveryInFlight: Promise<boolean> | undefined

  constructor(opts: TokenManagerOptions) {
    this.opts = opts
  }

  /**
   * 解析当前应使用的 token，不触发交互式登录（那是 `login()` 的职责）；返回 undefined
   * 表示没有可用 token。
   */
  async resolve(): Promise<ResolvedToken | undefined> {
    if (this.transient) return { token: this.transient, source: 'credentials' }

    const envGetter = this.opts.env ?? ((n: string) => process.env[n])
    const fromEnv = normalizeUserToken(envGetter(TOKEN_ENV_VAR))
    if (fromEnv && !this.isKnownInvalid(fromEnv)) return { token: fromEnv, source: 'env' }

    const fromConfig = normalizeUserToken(this.opts.readConfigToken?.())
    if (fromConfig && !this.isKnownInvalid(fromConfig)) return { token: fromConfig, source: 'config' }

    const stored = normalizeUserToken(await this.opts.secrets.get(TLOGS_TOKEN_KEY))
    if (stored && !this.isKnownInvalid(stored)) return { token: stored, source: 'credentials' }

    // 令牌由 `beginCredentialLease()` 取来暂存，`endCredentialLease()` 一释放这里就再也
    // 拿不到；客户端刷新期间每 800ms 一次的 snapshot → authState 走的正是这条分支。
    const lease = this.sessionLease
    const sessionToken = normalizeUserToken(lease?.token)
    if (sessionToken && !this.isKnownInvalid(sessionToken)) {
      return {
        token: sessionToken,
        source: lease?.source ?? 'platform-session',
        scheme: lease?.scheme,
        headers: lease?.headers,
      }
    }

    return undefined
  }

  private isKnownInvalid(token: string): boolean {
    // 绝大多数时候没有失效标记，短路掉哈希计算。
    if (this.invalidTokenHash === undefined) return false
    return sha256(token) === this.invalidTokenHash
  }

  /**
   * 取用账号会话凭据的租约：只在一次刷新开始时调用 —— 这是全插件唯一会向宿主索取账号
   * 会话凭据的地方（`readPlatformSession`）。刷新结束时必须配对调用 `endCredentialLease()`
   * （`service.ts` 用 try/finally 保证异常路径也会释放）。
   */
  async beginCredentialLease(): Promise<void> {
    this.sessionLeaseDepth++
    // 并发刷新共享同一份租约，不重复取。
    if (this.sessionLeaseDepth > 1) return

    const session = await safeCallResult(this.opts.readPlatformSession)
    const token = normalizeUserToken(session?.token)
    // 只记录「有没有 / 是不是坏值」，不记录令牌本身。
    this.sessionProbe = { has: token !== undefined, invalid: token !== undefined && this.isKnownInvalid(token) }
    this.sessionLease = token !== undefined ? session : undefined
  }

  /**
   * 释放账号会话凭据租约：丢弃引用，交给 GC。JS 字符串不可变，没有任何办法就地擦除
   * 它的字节，这里能做的是尽快断开可达引用 —— 比长期挂在缓存里窄得多，但不等于物理擦除。
   */
  endCredentialLease(): void {
    this.sessionLeaseDepth = Math.max(0, this.sessionLeaseDepth - 1)
    if (this.sessionLeaseDepth === 0) this.sessionLease = undefined
  }

  /**
   * 当前认证状态（供 UI 展示）。
   *
   * 常规路径上绝不为了汇报状态去取账号会话凭据：`snapshot → authState → state()` 每 800ms 就被
   * 客户端拉一次，凭据是否可用用上一次真实探测留下的 `sessionProbe` 回答即可。唯一例外是已处于
   * 失效态：那时做一次限速的恢复探测，让用户重新登录后不必苦等下一次刷新。
   */
  async state(): Promise<AuthState> {
    const resolved = await this.resolve()
    if (resolved) return { status: 'ok', source: resolved.source }

    // 账号会话凭据已知可用、且不是那个已知坏值：视为可用（下次刷新会采用它）。
    if (this.sessionProbe?.has && !this.sessionProbe.invalid) {
      return { status: 'ok', source: 'platform-session' }
    }

    // 显式来源被 401 标失效且没有任何可用来源 → 需要重新登录；先探一次以自动恢复，
    // 探测是限速的，取到的凭据只用于等值比较、随即丢弃。
    if (this.invalidTokenHash !== undefined && this.invalidMessage !== undefined) {
      if (await this.maybeProbeForRecovery()) {
        return { status: 'ok', source: 'platform-session' }
      }
      return { status: 'invalid', message: this.invalidMessage }
    }

    // 配了账号会话通道但还没探测过：不猜，如实报「未知」（UI 不会因此催登录）。
    if (this.sessionProbe === undefined && this.opts.readPlatformSession) {
      return { status: 'unknown' }
    }

    return { status: 'missing' }
  }

  /** 限速 + 去重地执行一次恢复探测；返回是否已恢复。 */
  private async maybeProbeForRecovery(): Promise<boolean> {
    if (!this.opts.readPlatformSession) return false
    if (this.recoveryInFlight) return this.recoveryInFlight
    const now = this.opts.now?.() ?? Date.now()
    if (
      this.lastRecoveryProbeAt !== undefined &&
      now - this.lastRecoveryProbeAt < RECOVERY_PROBE_INTERVAL_MS
    ) {
      return false
    }

    this.recoveryInFlight = this.probeForRecovery().finally(() => {
      this.recoveryInFlight = undefined
    })
    return this.recoveryInFlight
  }

  /**
   * 失效态下的一次性自动恢复探测。
   *
   * 场景：凭据被 401 打掉后用户重新登录了 DSH，此时应自动恢复，而不是让面板一直挂着
   * 「需要重新登录」等到下一次刷新（默认最长 5 分钟）。拿到不是那个已知坏值的凭据就认为
   * 已恢复：清掉失效标记并返回 true，这次取到的凭据只用于等值比较，函数返回即不可达、
   * 不留引用、不入租约；仍是同一个坏值或压根没有凭据，则维持失效态。
   */
  private async probeForRecovery(): Promise<boolean> {
    this.lastRecoveryProbeAt = this.opts.now?.() ?? Date.now()

    const session = await safeCallResult(this.opts.readPlatformSession)
    const token = normalizeUserToken(session?.token)
    // 只留元数据；token（以及 session）随本函数返回即不可达。
    this.sessionProbe = {
      has: token !== undefined,
      invalid: token !== undefined && this.isKnownInvalid(token),
    }
    if (token === undefined || this.isKnownInvalid(token)) return false

    // 换了新凭据：失效标记作废，恢复正常。
    this.invalidTokenHash = undefined
    this.invalidMessage = undefined
    return true
  }

  /** 持久化一个 token（手动输入或桌面登录成功后调用）。 */
  async save(token: string, source: TokenSource = 'credentials'): Promise<boolean> {
    const normalized = normalizeUserToken(token)
    if (!normalized) return false
    await this.opts.secrets.set(TLOGS_TOKEN_KEY, normalized)
    this.cached = { token: normalized, source }
    // 新 token 覆盖旧的失效标记。
    this.invalidTokenHash = undefined
    this.invalidMessage = undefined
    return true
  }

  /** 记录一个进程内临时 token（不落盘）。 */
  useTransient(token: string): boolean {
    const normalized = normalizeUserToken(token)
    if (!normalized) return false
    this.transient = normalized
    this.invalidTokenHash = undefined
    this.invalidMessage = undefined
    return true
  }

  /**
   * 标记当前 token 失效（收到 HTTP 401 时调用）：只记摘要，避免 `resolve()` 又把同一个
   * 坏 token 取回来。
   */
  async markInvalid(token: string, message: string): Promise<void> {
    this.invalidTokenHash = sha256(token)
    this.invalidMessage = message
    this.transient = undefined
    // 每次新失效都重新给一次立即探测的机会，否则可能被上一轮的限速挡住 30 秒。
    this.lastRecoveryProbeAt = undefined
  }

  /** 是否处于「需要重新登录」状态。 */
  get needsLogin(): boolean {
    return this.invalidTokenHash !== undefined
  }

  /** 当前失效提示（若有）。 */
  get invalidReason(): string | undefined {
    return this.invalidMessage
  }

  /**
   * 退出登录：清除持久化凭据、临时 token 与失效标记；环境变量与插件配置里的 token
   * 不受影响（见类注释）。
   */
  async logout(): Promise<void> {
    await this.opts.secrets.delete(TLOGS_TOKEN_KEY)
    this.transient = undefined
    this.cached = undefined
    this.invalidTokenHash = undefined
    this.invalidMessage = undefined
  }

  /** 交互式登录：打开内置窗口让用户登录并抓取 localStorage，成功后自动持久化。 */
  async login(): Promise<{ ok: boolean; error?: string }> {
    if (!this.opts.interactiveLogin) {
      return { ok: false, error: '当前环境不支持内置登录，请手动填写 userToken' }
    }
    try {
      const raw = await this.opts.interactiveLogin()
      const token = normalizeUserToken(raw)
      if (!token) return { ok: false, error: '登录窗口未取到有效 userToken' }
      await this.save(token, 'desktop-login')
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  /** 诊断用：当前解析结果的脱敏描述。 */
  describe(): string {
    if (!this.cached) return 'token=<unresolved>'
    return `token=${redactToken(this.cached.token)} source=${this.cached.source}`
  }
}

/** 调用可选钩子，吞掉异常并返回 undefined（认证探测失败不应让插件崩溃）。 */
async function safeCallResult(
  fn?: () => Promise<ResolvedToken | undefined>,
): Promise<ResolvedToken | undefined> {
  if (!fn) return undefined
  try {
    return await fn()
  } catch {
    return undefined
  }
}
