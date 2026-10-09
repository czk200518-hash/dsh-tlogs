/**
 * tlogs — DeepSeek 开放平台用量接口客户端。负责构造请求（URL / 请求头）与逐层校验响应，把归一化后的
 * `biz_data` 交给 `parser.ts`。三个端点共用同一套错误语义与凭据投递策略。
 *
 * 接口侧的硬约束（都由 WAF 与签名策略决定，不能改）：
 *  - 唯一可用端点：`GET /api/v0/usage/amount?year=YYYY&month=MM`；`/usage/by_api_key/amount` 会 422，
 *    `start_time` / `end_time` 同样 422，所以只能按自然月拉取；
 *  - 必须带 Origin / Referer / x-client-platform，否则被 WAF 拦截或返回空数据；令牌一律不出本文件：错误文本先抹令牌再单行化。
 */

import { unwrapBizData } from './parser.js'
import type {
  AccountSummary,
  BizData,
  CredentialScheme,
  FetchResult,
  UsageError,
  UsageErrorKind,
} from '../types.js'

export const BASE_URL = 'https://platform.deepseek.com/api/v0'
export const USAGE_PATH = '/usage/amount'
/**
 * 金额接口。与 `USAGE_PATH` 入参相同（year/month）、返回结构同构（`total[]` + `days[]`），
 * 只是 `amount` 的含义从 token 数变成 CNY 金额。
 */
export const COST_PATH = '/usage/cost'
/** 账户概览（余额 / 赠送余额 / 官方累计消费）。 */
export const ACCOUNT_SUMMARY_PATH = '/users/get_user_summary'

/** 单次请求超时。 */
export const DEFAULT_TIMEOUT_MS = 30_000

/** 与 Python 的 `str(None)` 对齐，让错误文案里的空值写作 `None`。 */
function toText(v: unknown): string {
  if (v === null || v === undefined) return 'None'
  if (typeof v === 'string') return v
  return String(v)
}

function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * 把任何文本压成单行安全文本：去掉控制字符、折叠空白、截断。必须做：这些文本会进入日志、快照 `error`
 * 与界面，而 `fetch` 在请求头非法时抛出的消息会把头的值原样回显，平台响应体也可能含换行 ——
 * 直接透传等于日志注入（伪造多行日志）加敏感值回显。
 */
function singleLine(s: string, max = 200): string {
  return s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

/**
 * 从文本里抹掉令牌本体。单行化只解决换行污染日志，不解决令牌回显：`fetch` 抛出的消息形如
 * `Headers.append: "Bearer <token>" is an invalid header value.`，头值是原样带出来的；
 * 既然我们手里就有这个令牌，直接替换比指望上游不回显可靠。
 */
function scrubToken(s: string, token: string): string {
  if (!token) return s
  return s.split(token).join('<redacted>')
}

/** 组装一条可读、不含令牌、且必然单行的错误文本。 */
function safeMsg(raw: string, token: string, max = 200): string {
  // 先抹令牌再单行化。反过来的话换行会先被换成空格，令牌字符串就匹配不上了。
  return singleLine(scrubToken(raw, token), max)
}

/**
 * 构造请求头。extraHeaders 是签发方要求的环境头（`getPlatformSession()` 返回的 `requestHeaders`），
 * 可以覆盖同名基础头，但凭据头与来源伪造类头一律不覆盖。令牌只在内存里拼进凭据头，不写日志。
 */
export function buildHeaders(
  token: string,
  extraHeaders?: Record<string, string>,
  scheme: CredentialScheme = 'bearer',
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-client-platform': 'web',
    Origin: 'https://platform.deepseek.com',
    Referer: 'https://platform.deepseek.com/usage',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/120.0.0.0 Safari/537.36',
  }

  // 由本插件独占的头，部署头不得覆盖。
  const protectedHeaders = new Set(['authorization', 'x-dsh-auth-token', 'host'])

  /** 带 `x-` 前缀也要拒绝：来源伪造类，可用来绕过平台侧限流。 */
  const deniedExtraHeaders = new Set([
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-real-ip',
    'x-client-ip',
  ])

  if (scheme === 'x-dsh-auth-token') headers['x-dsh-auth-token'] = token
  else headers.Authorization = `Bearer ${token}`

  if (extraHeaders) {
    // 只接受 `x-` 前缀的扩展头。extraHeaders 面向的是嵌入式 Platform 文档，不是用量接口；放它盖掉
    // 写死的 Origin / Referer 会破坏免遭 WAF 拦截的伪装，而 Cookie / x-forwarded-* 这类头又会原样到达
    // 服务器（Host 会被运行时丢弃）。白名单一次排除全部这些，且不必枚举黑名单。
    const existingKey = new Map(Object.keys(headers).map((k) => [k.toLowerCase(), k]))
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (k.length === 0 || typeof v !== 'string') continue
      const lower = k.toLowerCase()
      if (!lower.startsWith('x-')) continue
      if (protectedHeaders.has(lower) || deniedExtraHeaders.has(lower)) continue
      const target = existingKey.get(lower)
      if (target) headers[target] = v
      else headers[k] = v
    }
  }
  return headers
}

export function buildUrl(year: number, month: number, kind: UsageKind = 'amount'): string {
  const path = kind === 'cost' ? COST_PATH : USAGE_PATH
  return `${BASE_URL}${path}?year=${encodeURIComponent(String(year))}&month=${encodeURIComponent(String(month))}`
}

/** 走哪个月度接口：token 用量还是金额。 */
export type UsageKind = 'amount' | 'cost'

function err(kind: UsageErrorKind, message: string, status?: number): { ok: false; error: UsageError } {
  return { ok: false, error: status === undefined ? { kind, message } : { kind, message, status } }
}

export interface FetchMonthOptions {
  token: string
  year: number
  month: number
  /** 走哪个接口：`amount`（token，默认）或 `cost`（金额 CNY）。 */
  kind?: UsageKind
  /** 外部取消信号（DSH 工具调用会传入）。 */
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /** 签发方要求的额外请求头（见 buildHeaders）。 */
  extraHeaders?: Record<string, string>
  /** 凭据投递方式。默认 `bearer`。 */
  scheme?: CredentialScheme
}

interface PlatformOptions {
  token: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  timeoutMs?: number
  extraHeaders?: Record<string, string>
  scheme?: CredentialScheme
}

/** 合并外部取消信号与超时信号，保证取消与超时都能真正中断请求。 */
function mergeSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal | undefined {
  const signals: AbortSignal[] = []
  if (signal) signals.push(signal)
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    signals.push(AbortSignal.timeout(timeoutMs))
  }
  if (signals.length === 0) return undefined
  if (signals.length === 1) return signals[0]
  return (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any(signals)
}

/**
 * 平台请求公共层：发出请求、逐层校验 `code` / `biz_code`，成功后把归一化过的 `biz_data` 交给调用方解析。
 * `label` 只出现在错误文案里，用于指明是哪个接口。金额接口与账户概览的错误语义、重定向策略、防令牌回显
 * 处理与用量接口完全一致，所以三者共用这一层。
 */
async function platformBizData(
  opts: PlatformOptions,
  url: string,
  label: string,
): Promise<{ ok: true; bizData: BizData } | { ok: false; error: UsageError }> {
  const { token } = opts
  const doFetch = opts.fetchImpl ?? fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const signal = mergeSignals(opts.signal, timeoutMs)

  let resp: Response
  try {
    resp = await doFetch(url, {
      headers: buildHeaders(token, opts.extraHeaders, opts.scheme),
      signal,
      // 绝不跟随重定向：运行时在跨域重定向时会剥掉 `Authorization` / `Cookie` 这类标准头，却不会剥掉
      // 自定义头，而账号会话凭据用的正是自定义头 `x-dsh-auth-token`。掐断重定向，凭据就不会离开
      // platform.deepseek.com；`manual` 下 3xx 按非 200 处理（见下）。
      redirect: 'manual',
    })
  } catch (e) {
    // 外部取消要原样抛出，交给调用方区分「用户取消」与「网络失败」。
    if (opts.signal?.aborted) throw e
    return err('network', `请求异常：${safeMsg(e instanceof Error ? e.message : String(e), token)}`)
  }

  if (resp.status === 401) return err('unauthorized', '401 认证失败（userToken 失效）', 401)
  if (resp.status !== 200) {
    // 3xx：我们主动不跟随。只说目标 origin，不把整条 Location 回显出去（它是外部输入，没必要原样带进日志/UI）。
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers?.get?.('location') ?? ''
      let where = ''
      try {
        where = location ? ` → ${singleLine(new URL(location).origin, 120)}` : ''
      } catch {
        where = location ? ' → (无效 Location)' : ''
      }
      return err(
        'http',
        `HTTP ${resp.status} 意外重定向${where}；已拒绝跟随，凭据未转发到其它源`,
        resp.status,
      )
    }
    const text = await safeText(resp)
    return err('http', `HTTP ${resp.status}: ${safeMsg(text, token)}`, resp.status)
  }

  let data: unknown
  try {
    data = await resp.json()
  } catch {
    return err('non-json', '返回非 JSON')
  }

  if (!isDict(data)) return err('non-json', '返回结构非 JSON 对象')

  if (data.code !== 0) {
    // 40003 = "Authorization Failed (invalid token)"，HTTP 状态码仍是 200。把 API Key 或推理令牌当 Bearer 打进来就是它。
    // 必须归为认证失败：否则刷新循环不会提前终止，会把 31 个月全打一遍（约 31 次请求 / 30 秒）才罢休，
    // 用户只看到一个迟迟不动的进度条。
    if (data.code === 40003) {
      return err(
        'unauthorized',
        `40003 认证失败：该令牌不被${label}接受（msg=${safeMsg(toText(data.msg), token)}）`,
      )
    }
    return err(
      'code',
      `code=${safeMsg(toText(data.code), token, 32)} msg=${safeMsg(toText(data.msg), token)}`,
    )
  }

  const inner = (data.data as unknown) || {}
  if (!isDict(inner) || inner.biz_code !== 0) {
    const bizCode = isDict(inner) ? inner.biz_code : undefined
    const bizMsg = isDict(inner) ? inner.biz_msg : undefined
    return err(
      'biz_code',
      `biz_code=${safeMsg(toText(bizCode), token, 32)} biz_msg=${safeMsg(toText(bizMsg), token)}`,
    )
  }

  // `usage/amount` 的 biz_data 是对象、`usage/cost` 是数组，由 `unwrapBizData` 抹平。
  return { ok: true, bizData: unwrapBizData(inner.biz_data) }
}

/** 拉取某月用量（或金额）。返回判别式联合而非 `(data, err)` 二元组，避免「空错误串被当成失败」这类隐式 bug。 */
export async function fetchMonth(opts: FetchMonthOptions): Promise<FetchResult> {
  return platformBizData(
    opts,
    buildUrl(opts.year, opts.month, opts.kind ?? 'amount'),
    opts.kind === 'cost' ? '金额接口' : '用量接口',
  )
}

/**
 * 读取平台账户概览：充值余额 / 赠送余额 / 官方累计消费。用途是给出「官方口径」的参照：`usage/cost` 是按月
 * 归集的金额，逐月相加与官方账单会有微小差异（按请求四舍五入所致），把账单数一并显示出来，用户就能一眼
 * 看出卡片上的数是插件按接口重算的还是官方的。
 * 失败一律降级为 `undefined`：余额不是核心功能，不该因为它失败就让整个刷新报错。
 */
export async function fetchAccountSummary(
  opts: PlatformOptions,
): Promise<{ ok: true; summary: AccountSummary } | { ok: false; error: UsageError }> {
  const r = await platformBizData(opts, `${BASE_URL}${ACCOUNT_SUMMARY_PATH}`, '账户接口')
  if (!r.ok) return r

  const raw = r.bizData as unknown as {
    normal_wallets?: Array<{ currency?: string; balance?: string }>
    bonus_wallets?: Array<{ currency?: string; balance?: string }>
    total_costs?: Array<{ currency?: string; amount?: string }>
  }
  const normal = Array.isArray(raw.normal_wallets) ? raw.normal_wallets : []
  const bonus = Array.isArray(raw.bonus_wallets) ? raw.bonus_wallets : []
  const costs = Array.isArray(raw.total_costs) ? raw.total_costs : []
  const amount = (v: unknown): number => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.round(n * 1e8) / 1e8 : 0
  }
  return {
    ok: true,
    summary: {
      balance: amount(normal[0]?.balance),
      bonusBalance: amount(bonus[0]?.balance),
      totalCosts: amount(costs[0]?.amount),
      currency: costs[0]?.currency ?? normal[0]?.currency ?? 'CNY',
    },
  }
}

/** 读取响应体文本，失败时返回空串（仅用于错误文案，不影响判定）。 */
async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text()
  } catch {
    return ''
  }
}

/** 判断错误是否为认证失效（HTTP 401）。 */
export function isAuthError(e: UsageError): boolean {
  return e.kind === 'unauthorized'
}

/** 可取消的睡眠，用于月度请求节流。 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal) {
      if (signal.aborted) {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}
