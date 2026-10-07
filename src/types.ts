/**
 * tlogs — 共享类型定义（host / client 两端复用）。
 *
 * 本文件的字段名与语义直接对应工作区权威参考实现
 * `deepseek_python_20261007_a1f087.py` 中的 `TOKEN_TYPES` / `empty_stat()`，
 * 不做任何重命名，以便与 Python 输出逐字段对拍。
 */

/** 五种计量项，顺序与 Python 的 TOKEN_TYPES 完全一致。 */
export const TOKEN_TYPES = [
  'PROMPT_TOKEN',
  'PROMPT_CACHE_HIT_TOKEN',
  'PROMPT_CACHE_MISS_TOKEN',
  'RESPONSE_TOKEN',
  'REQUEST',
] as const

export type TokenType = (typeof TOKEN_TYPES)[number]

/** 五类计量项的计数（对应 Python 的 `empty_stat()` 返回的 dict）。 */
export type Stat = Record<TokenType, number>

/** Stat 的运行时键集合，供 `t in agg` 这类成员检查使用。 */
const TOKEN_TYPE_SET: ReadonlySet<string> = new Set(TOKEN_TYPES)

/** 判断任意字符串是否为已知计量项（等价于 Python 的 `t in agg`）。 */
export function isTokenType(t: unknown): t is TokenType {
  return typeof t === 'string' && TOKEN_TYPE_SET.has(t)
}

/**
 * 空 Stat。必须逐次返回新对象，语义等价于 Python 每次调用 `empty_stat()`。
 */
export function emptyStat(): Stat {
  return {
    PROMPT_TOKEN: 0,
    PROMPT_CACHE_HIT_TOKEN: 0,
    PROMPT_CACHE_MISS_TOKEN: 0,
    RESPONSE_TOKEN: 0,
    REQUEST: 0,
  }
}

/** 接口返回的单个使用明细项。 */
export interface UsageEntry {
  type?: string
  amount?: string | number | null
}

/** 接口返回的单个模型条目（同时用于 `total[]` 与 `days[].data[]`）。 */
export interface ModelUsage {
  model?: string | null
  usage?: UsageEntry[] | null
}

/** 按天分组的模型条目。 */
export interface DayUsage {
  date?: string | null
  data?: ModelUsage[] | null
}

/** `data.biz_data` 的真实结构（已实测：仅含 total 与 days 两个键）。 */
export interface BizData {
  total?: ModelUsage[] | null
  days?: DayUsage[] | null
}

/** `parseBizData` 的返回：整体合计 + 按模型合计。 */
export interface ParsedUsage {
  agg: Stat
  models: Record<string, Stat>
}

/** 单个时间范围的统计结果（含输入/输出已拆分的派生量）。 */
export interface ScopeStat {
  /** 原始五类计量项。 */
  raw: Stat
  /** 总输入 = PROMPT + CACHE_HIT + CACHE_MISS。 */
  inputTokens: number
  /** 总输出 = RESPONSE_TOKEN。 */
  outputTokens: number
  /** 总 Token = 输入 + 输出。 */
  totalTokens: number
  /** 请求次数 = REQUEST。 */
  requests: number
}

/** 查询范围。 */
export type UsageScope = 'total' | 'today' | 'week' | 'month'

/** 按模型 / 按年 / 按月 / 按天 的统计行。 */
export interface StatRow {
  key: string
  label: string
  stat: ScopeStat
}

/** 详细视图的完整数据。 */
export interface DetailData {
  models: StatRow[]
  years: StatRow[]
  months: StatRow[]
  days: StatRow[]
}

/** 数据来源的错误分类（对应 Python `fetch_month` 的各分支）。 */
export type UsageErrorKind =
  /** requests.RequestException —— 网络层异常。 */
  | 'network'
  /** HTTP 401 —— userToken 失效。 */
  | 'unauthorized'
  /** 其他非 200 状态码（含 422 / 403）。 */
  | 'http'
  /** resp.json() 抛 ValueError —— 返回非 JSON。 */
  | 'non-json'
  /** 外层 `code != 0`。 */
  | 'code'
  /** 内层 `data.biz_code != 0`。 */
  | 'biz_code'

export interface UsageError {
  kind: UsageErrorKind
  /** 与 Python 中同分支拼出的错误文案保持一致，便于人工比对。 */
  message: string
  /** 仅 kind === 'http' / 'unauthorized' 时有值。 */
  status?: number
}

/** `fetchMonth` 的结果，等价于 Python 的 `(biz_data, error_msg)` 二元组。 */
export type FetchResult =
  | { ok: true; bizData: BizData }
  | { ok: false; error: UsageError }

/** 单月聚合结果（对应 Python main() 里 monthly_rows 的一行）。 */
export interface MonthRow {
  year: number
  month: number
  stat: Stat
  models: Record<string, Stat>
  /** 该月逐日明细（用于详细视图的「按天统计」表）。 */
  days?: Array<{ date: string; stat: Stat }>
  /** 该月拉取失败时的错误；成功时为 undefined。 */
  error?: UsageError
}

/** 完整历史聚合结果，等价于 Python 脚本的 report 结构。 */
export interface HistoryReport {
  /** 数据生成时间（ISO 字符串）。 */
  generatedAt: string
  /** 实际覆盖的月份范围。 */
  range: { start: string; end: string }
  /** 全量合计（对应 Python 的 grand_total）。 */
  grand: ScopeStat
  /** 按年合计（键为年份字符串）。 */
  yearly: Record<string, ScopeStat>
  /** 按模型合计。 */
  models: Record<string, ScopeStat>
  /** 逐月明细。 */
  monthly: MonthRow[]
}

/** 组件对外暴露的单个卡片数据。 */
export interface CardData {
  scope: UsageScope
  label: string
  stat: ScopeStat
  /** 该卡片可切换的对象列表（当前仅「当前项目」有多项）。 */
  options?: Array<{ id: string; label: string; stat: ScopeStat }>
  selectedOptionId?: string
  /** 数据是否来自过期缓存。 */
  stale?: boolean
  /** 该卡片的错误信息（如有）。 */
  error?: string
}

/** 认证状态。 */
export type AuthState =
  | { status: 'unknown' }
  | { status: 'ok'; source: TokenSource }
  | { status: 'missing' }
  | { status: 'invalid'; message: string }

/**
 * 凭据的**投递方式**。
 *
 * 实测（2026-10，直接打 `platform.deepseek.com/api/v0/usage/amount`）：
 * 同一个 Platform 会话令牌，换头就决定成败 ——
 *   - `Authorization: Bearer <t>`     → `40003 Authorization Failed (invalid token)`
 *   - `x-dsh-auth-token: <t>`          → `200 code:0` ✅ 返回真实用量
 *
 * `x-dsh-auth-token` 正是 DSH 自己的账号包
 * （`@deepseek-ai/dsh-llm-deepseek-account`）投递该凭据用的头。
 * 网页登录态拿到的 userToken 则走 `bearer`。
 */
export type CredentialScheme = 'bearer' | 'x-dsh-auth-token'

/** userToken 的来源。 */
export type TokenSource =
  /** 环境变量 DEEPSEEK_PLATFORM_USER_TOKEN。 */
  | 'env'
  /** 插件配置 platformUserToken。 */
  | 'config'
  /** DSH 凭据系统（credentials seam）。 */
  | 'credentials'
  /** 桌面端内置登录窗口抓取。 */
  | 'desktop-login'
  /** 复用 DSH 已登录账号的 Platform 会话凭据（`deepseekAccount.getPlatformSession`）。 */
  | 'platform-session'

/** 客户端向 host 请求的完整快照。 */
export interface UsageSnapshot {
  auth: AuthState
  cards: CardData[]
  /** 紧凑条使用的精简指标。 */
  compact: Array<{ scope: UsageScope; label: string; value: number }>
  /** 是否有任一卡片使用过期缓存。 */
  stale: boolean
  /** 最近一次成功刷新的时间戳（ms）。 */
  lastUpdatedAt: number | null
  /** 是否仍在后台拉取全量历史。 */
  loading: boolean
  /** 全量拉取进度 0..1，仅 loading 时有意义。 */
  progress?: number
  /** 顶层错误提示（如 token 失效）。 */
  error?: string
  /**
   * 展示相关配置。host 端读取 cordis 配置后下发，
   * 这样客户端半侧无需自行读取插件配置（避免依赖未验证的客户端配置 API）。
   */
  display: {
    numberFormat: 'full' | 'short'
    enableDetailView: boolean
    defaultExpanded: boolean
    /**
     * 宿主是否真的能创建 Electron 登录窗口。
     *
     * 实测桌面端的插件宿主（Electron 以 Node 模式运行的子进程）做不到，
     * 客户端据此把「登录」按钮置灰并提示改用手动填写，避免点了没反应。
     */
    loginAvailable: boolean
  }
}

/** host 端 RPC 频道名。 */
export const TLOGS_CHANNEL = '/tlogs'

/** RPC 端点名。 */
export const RPC = {
  snapshot: 'tlogs.snapshot',
  refresh: 'tlogs.refresh',
  detail: 'tlogs.detail',
  login: 'tlogs.login',
  setToken: 'tlogs.setToken',
  logout: 'tlogs.logout',
  export: 'tlogs.export',
} as const
