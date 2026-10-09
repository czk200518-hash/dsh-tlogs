/**
 * tlogs 两半侧共用的类型与常量：字段名与平台接口、本机会话投影的口径直接对应，不要在两端各起一套名字。
 */

/** 五种计量项，顺序与平台接口一致。 */
export const TOKEN_TYPES = [
  'PROMPT_TOKEN',
  'PROMPT_CACHE_HIT_TOKEN',
  'PROMPT_CACHE_MISS_TOKEN',
  'RESPONSE_TOKEN',
  'REQUEST',
] as const

export type TokenType = (typeof TOKEN_TYPES)[number]

export type Stat = Record<TokenType, number>

/**
 * 金额（CNY 元），按五类计量项拆分；与 `Stat` 同构但语义不同：每项是「该计量项花了多少钱」
 * 而不是 token 数，`REQUEST` 恒为 0（请求不计费）。金额必须保留小数 —— 接口给的是
 * `"12.1115392000000000"` 这样的 16 位小数字符串，用 `toAmount` 截断会全部变成 0。
 */
export type Money = Record<TokenType, number>

export function emptyMoney(): Money {
  return {
    PROMPT_TOKEN: 0,
    PROMPT_CACHE_HIT_TOKEN: 0,
    PROMPT_CACHE_MISS_TOKEN: 0,
    RESPONSE_TOKEN: 0,
    REQUEST: 0,
  }
}

/** 五类金额之和（元）。 */
export function moneyTotal(m: Money | undefined): number {
  if (!m) return 0
  let s = 0
  for (const t of TOKEN_TYPES) s += m[t]
  return s
}

const TOKEN_TYPE_SET: ReadonlySet<string> = new Set(TOKEN_TYPES)

/** 是否为已知计量项；未知 type 既不进合计也不进按模型明细。 */
export function isTokenType(t: unknown): t is TokenType {
  return typeof t === 'string' && TOKEN_TYPE_SET.has(t)
}

/** 空 Stat。调用方每次都要拿到新对象，不要共享实例。 */
export function emptyStat(): Stat {
  return {
    PROMPT_TOKEN: 0,
    PROMPT_CACHE_HIT_TOKEN: 0,
    PROMPT_CACHE_MISS_TOKEN: 0,
    RESPONSE_TOKEN: 0,
    REQUEST: 0,
  }
}

export interface UsageEntry {
  type?: string
  amount?: string | number | null
}

/** 接口返回的单个模型条目（`total[]` 与 `days[].data[]` 同构）。 */
export interface ModelUsage {
  model?: string | null
  usage?: UsageEntry[] | null
}

export interface DayUsage {
  date?: string | null
  data?: ModelUsage[] | null
}

/**
 * `data.biz_data` 的结构。
 *
 * 两个接口的形状不同：`/usage/amount` 给对象 `{ total, days }`，`/usage/cost` 给长度恒为 1 的
 * 数组 `[{ total, days, currency }]`。解析前必须先用 `unwrapBizData()` 归一化，否则会静默拿到全 0。
 */
export interface BizData {
  total?: ModelUsage[] | null
  days?: DayUsage[] | null
  /** `usage/cost` 独有；值为 `"CNY"`。 */
  currency?: string | null
}

export interface ParsedUsage {
  agg: Stat
  models: Record<string, Stat>
}

/**
 * 单个时间范围的统计结果（含输入/输出已拆分的派生量）：`raw` = 原始五类计量项，
 * `inputTokens` = PROMPT + CACHE_HIT + CACHE_MISS，`outputTokens` = RESPONSE_TOKEN，
 * `totalTokens` = 输入 + 输出（不含请求数），`requests` = REQUEST。`cost` 为 CNY 五类拆分、
 * 没抓到金额时缺省；`currency` 仅在有 `cost` 时有意义。
 */
export interface ScopeStat {
  raw: Stat
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requests: number
  cost?: Money
  currency?: string
}

export type UsageScope = 'total' | 'today' | 'week' | 'month' | 'last7' | 'last30'

/**
 * 紧凑条可展示的指标项：前六个与 `UsageScope` 同名、展示的是 token 值；`cost_*` 展示对应窗口的金额，
 * 因此不复用 scope 命名空间（`scope` 字段仍用于点击定位）。
 */
export type CompactMetric =
  | UsageScope
  | 'cost_total'
  | 'cost_today'
  | 'cost_last7'
  | 'cost_last30'

export const COMPACT_METRICS: readonly CompactMetric[] = [
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
]

/** 滚动窗口的天数（`last7` / `last30`）。 */
export const ROLLING_DAYS: Readonly<Record<'last7' | 'last30', number>> = {
  last7: 7,
  last30: 30,
}

/** 按模型 / 按年 / 按月 / 按天 的统计行。 */
export interface StatRow {
  key: string
  label: string
  stat: ScopeStat
  /**
   * 平台层级徽标（`官方` / `第三方`）：按通道判定而不按模型名 —— 火山方舟上跑的也叫
   * `deepseek-v4-flash`，但平台账单里没有它（见 `store/provider-meta.ts`）；`tagTitle` 是它的 tooltip。
   */
  tag?: string
  tagTitle?: string
}

/** 详细视图的完整数据。 */
export interface DetailData {
  /**
   * 按模型明细，两路口径拼起来：平台账单的模型行（DeepSeek 官方通道，带金额）加上本机口径里
   * 非 DeepSeek 供应商的模型行（平台看不到，无金额）。DeepSeek 通道不并本机行 —— 平台已按模型计过，再并就是重复计数。
   */
  models: StatRow[]
  /** `models` 里是否混入了本机口径的模型行（界面据此加一句表头说明）。 */
  modelsIncludeLocal?: boolean
  years: StatRow[]
  months: StatRow[]
  days: StatRow[]
  /**
   * 本机口径的「供应商 · 模型」明细（来自会话日志，含 DeepSeek 通道）。与 `models` 的分工：
   * `models` 回答「哪个模型用了多少」，这里回答「这个模型走的是哪条通道」。取不到本机数据时缺省。
   */
  providers?: StatRow[]
  localRange?: { from: string; to: string; days: number; files: number; sourceLabel?: string }
  /**
   * 本机口径不可用时的原因。必须说出为什么（没找到会话日志、zstd 不可用、还是用户关了 `localUsage`），
   * 否则「供应商」页签只是一个空表格。
   */
  localUnavailable?: { reason?: string }
}

/** 月详情：`models` 按模型降序，`days` 逐日升序；没有金额数据时界面不显示 ¥ 列，避免一排 ¥0.00 误导。 */
export interface MonthDetail {
  year: number
  month: number
  stat: ScopeStat
  models: StatRow[]
  days: StatRow[]
  currency?: string
  costAvailable?: boolean
}

/**
 * 图表的时间范围：`last7` / `last30` 是滚动窗口（含今天），与 `week` / `month` 的自然日历口径不同，
 * 两者在月初与周一附近会明显不一致，界面上刻意并列展示。
 */
export type ChartRange = 'all' | 'custom' | 'today' | 'week' | 'month' | 'last7' | 'last30'

/** 图表的数据源：`platform` = 平台账单（账号维度，接口按天返回逐日明细）；`project` = 本机项目用量（DSH 会话投影，按插件每日快照积累）。 */
export type ChartSource =
  | 'platform'
  | 'project'

/** 图表里的一个时间桶（一天 / 一个月 / 一年）：`key` 是桶键（`YYYY-MM-DD` / `YYYY-MM` / `YYYY`），`cost` 是该桶费用合计（CNY 元），没抓到金额时为 0。 */
export interface SeriesPoint {
  key: string
  stat: Stat
  cost?: number
}

/** 图表数据源里可选的「项目」：`id` 是短哈希，绝不下发完整 cwd（见 store/project.ts 的 publicProjectId）；`stat` 是当前累计用量。 */
export interface SeriesProject {
  id: string
  label: string
  stat: Stat
}

/**
 * 项目维度的时间序列。数据来自插件自身的逐日快照：平台账单接口没有项目维度，而宿主投影只给
 * 「累计至今」一个数，所以历史曲线只能在本地一天天记。`points` 的最后一个点会被替换成当前实时值，
 * 保证曲线终点与「当前项目消耗」卡片一致。
 */
export interface ProjectSeries {
  id: string
  label: string
  /** false = 该项目已不在列表里，只剩历史快照。 */
  known: boolean
  /**
   * 范围内首点之前的最后一次快照（可能没有）。「每期新增」模式下第一个点的基线：没有它就只能
   * 把首点本身当作增量，会把该项目自启用以来的全部用量算进这一天。
   */
  prior?: { date: string; stat: Stat }
  /** 累计快照，按日期升序。 */
  points: Array<{ date: string; stat: Stat }>
}

/**
 * 图表页所需的全部数据（`tlogs.series` 的返回）。
 *
 * 逐日与逐月都下发：逐日明细只对抓到过 `days` 的月份存在，而月度合计始终完整。客户端按粒度取不同数组 ——
 * 月/年粒度走 `months`（不会因缺天而低估），天粒度走 `days`（缺的月份表现为断点，并由 `partial` 提示）。
 */
export interface UsageSeries {
  /** 解析后的范围（本地日历日，含两端）。 */
  from: string
  to: string
  /** 范围内逐日，只含接口真的返回了数据的天。 */
  days: Array<{ date: string; stat: Stat; cost?: number }>
  /** 范围内按月，始终完整（月粒度改用它，不会因缺天而低估）。 */
  months: SeriesPoint[]
  /** `from` 之前的累计，给「累计」曲线提供基线。 */
  prior: Stat
  priorCost?: number
  models: SeriesPoint[]
  projects: SeriesProject[]
  /** 范围内是否有月份缺逐日明细。 */
  partial: boolean
  /** 范围内是否有月份缺金额（金额还没回补完）。 */
  costPartial?: boolean
  /** 「消费金额」构成饼图的五类拆分。 */
  costByType?: Money
  currency?: string
  project?: ProjectSeries
}

/** 图表数据请求（`tlogs.series` 的入参）。 */
export interface SeriesQuery {
  range: ChartRange
  /** 仅 `range === 'custom'` 时有意义（`YYYY-MM-DD`）。 */
  from?: string
  to?: string
  /** `publicProjectId` 的短哈希；缺省表示看平台账单。 */
  projectId?: string
}

/** 数据来源的错误分类，逐层对应平台的响应结构：`non-json` = 响应不是 JSON；`code` = 外层 `code != 0`；`biz_code` = 内层 `data.biz_code != 0`。 */
export type UsageErrorKind =
  | 'network'
  | 'unauthorized'
  | 'http'
  | 'non-json'
  | 'code'
  | 'biz_code'

export interface UsageError {
  kind: UsageErrorKind
  message: string
  /** 仅 'http' / 'unauthorized' 时有值。 */
  status?: number
}

/** `fetchMonth` 的结果。 */
export type FetchResult =
  | { ok: true; bizData: BizData }
  | { ok: false; error: UsageError }

export interface MonthRow {
  year: number
  month: number
  stat: Stat
  models: Record<string, Stat>
  /** 该月逐日明细（用于详细视图的「按天统计」表）。 */
  days?: Array<{
    date: string
    stat: Stat
    /** 该日费用（CNY，五类拆分）；缺省表示没抓到金额。 */
    cost?: Money
  }>
  /**
   * 该月是否已经抓取过逐日明细。老缓存里的月份没有 `days`，而计划器按「有统计、无错误」判定完成，
   * 这些月份会被永久跳过、日历只剩「—」。这个标记用于一次性回补：无标记的旧行重抓一次，抓完即打标记 ——
   * 即便接口当月未返回 days 也不会反复重抓。
   */
  daysFetched?: boolean
  /** 该月费用（CNY，五类拆分）。来自 `usage/cost`。 */
  cost?: Money
  /** 该月按模型的费用（CNY，仅总额，不拆五类）。 */
  costModels?: Record<string, number>
  currency?: string
  /** 该月是否已经抓取过金额（与 `daysFetched` 同一套一次性回补机制）。 */
  costFetched?: boolean
  /** 该月拉取失败时的错误；成功时为 undefined。 */
  error?: UsageError
}

export interface HistoryReport {
  /** 数据生成时间（ISO 字符串）。 */
  generatedAt: string
  range: { start: string; end: string }
  grand: ScopeStat
  /** 按年合计（键为年份字符串）。 */
  yearly: Record<string, ScopeStat>
  models: Record<string, ScopeStat>
  /**
   * 按模型的费用合计（CNY 元）。单独一份而不并进 `models[].cost`：接口的按模型金额只有总额、
   * 没有五类拆分，硬塞进 `Money` 的某个桶会污染「输入/输出成本」的展示。
   */
  modelCosts: Record<string, number>
  currency: string
  /** 区间内所有月份是否都已抓到金额。false 时 `grand.cost` 只是部分合计。 */
  costComplete: boolean
  monthly: MonthRow[]
}

/**
 * 卡片数字的来源与拆分（双路数据源）。
 *
 * 平台口径只覆盖 DeepSeek 通道且当天要等结算；本机口径实时、覆盖本机所有供应商但看不到别的设备。
 * 两路按 `store/usage-merge.ts` 的规则合并，这里把「这份数字是谁给的」一并下发，供界面标注与 tooltip 解释。
 */
export interface CardSourceInfo {
  kind: 'platform' | 'local' | 'merged'
  /** 平台口径的 token 合计（该窗口）。 */
  platformTokens: number
  /** 本机口径的 token 合计（该窗口，含所有供应商）。 */
  localTokens: number
  /** 本机口径里 DeepSeek 通道的部分（与平台同源，故不与平台相加）。 */
  localDeepseekTokens: number
  /** 本机口径里平台看不到的供应商拆分（按 token 降序）。 */
  otherProviders: Array<{ provider: string; tokens: number }>
  /** 金额仍是平台口径；true = 平台该窗口尚未结算完，金额偏小。 */
  costPending: boolean
}

export interface CardData {
  scope: UsageScope
  label: string
  stat: ScopeStat
  /** 该卡片可切换的对象列表（当前仅「当前项目」有多项）。 */
  options?: Array<{ id: string; label: string; stat: ScopeStat }>
  selectedOptionId?: string
  /** 数据是否来自过期缓存。 */
  stale?: boolean
  error?: string
  /** 数字来源与拆分（「当前项目」卡没有这一项）。 */
  source?: CardSourceInfo
}

export type AuthState =
  | { status: 'unknown' }
  | { status: 'ok'; source: TokenSource }
  | { status: 'missing' }
  | { status: 'invalid'; message: string }

/**
 * 凭据的投递方式。
 *
 * 同一个平台会话令牌换个头就决定成败：走 `Authorization: Bearer` 会被接口回 `40003 Authorization Failed`，
 * 改成 `x-dsh-auth-token` 才返回真实用量 —— 后者正是 DSH 账号包投递该凭据用的头。网页登录态拿到的 userToken 走 bearer。
 */
export type CredentialScheme = 'bearer' | 'x-dsh-auth-token'

/**
 * userToken 的来源，对应 TokenManager 的解析优先级：`env` = 环境变量 DEEPSEEK_PLATFORM_USER_TOKEN，
 * `config` = 插件配置 platformUserToken，`credentials` = DSH 凭据系统，
 * `desktop-login` = 桌面端内置登录窗口抓取，`platform-session` = 复用 DSH 已登录账号的 Platform 会话凭据。
 */
export type TokenSource =
  | 'env'
  | 'config'
  | 'credentials'
  | 'desktop-login'
  | 'platform-session'

export interface AccountSummary {
  balance: number
  bonusBalance: number
  /** 官方账单的累计消费，元。 */
  totalCosts: number
  currency: string
}

/** 客户端向 host 请求的完整快照。 */
export interface UsageSnapshot {
  auth: AuthState
  cards: CardData[]
  /**
   * 紧凑条使用的精简指标。`unit` 决定单位与 tooltip 文案：默认 `tokens`；`requests` 是紧随「今日」
   * 之后的今日请求数（与今日 token 同一个 scope，因此不能靠 scope 区分）；`money` 是金额。
   */
  compact: Array<{
    scope: UsageScope
    label: string
    value: number
    unit?: 'tokens' | 'requests' | 'money'
    /** 金额项不适用时缺省。 */
    source?: CardSourceInfo['kind']
  }>
  /** 是否有任一卡片使用过期缓存。 */
  stale: boolean
  /** 最近一次成功刷新的时间戳（ms）。 */
  lastUpdatedAt: number | null
  /**
   * 本机口径的可用性与扫描结果。不可用时窗口卡片完全依赖平台口径 —— 那正是「当天显示 0」的成因，
   * 所以界面要能把原因说出来，而不是安静地显示 0。
   */
  localUsage?: {
    available: boolean
    reason?: string
    days: number
    files: number
    updatedAt: number
    /**
     * 实际命中的候选目录标签（例如 `DSH_HOME 上两级/sessions`）。用它而不是绝对路径：出问题时
     * 需要能一眼看出「插件到底读了哪儿」，但没必要把用户主目录下发给浏览器。
     */
    sourceLabel?: string
  }
  /** 是否仍在后台拉取全量历史。 */
  loading: boolean
  /** 拉取进度 0..1，仅 loading 时有意义。 */
  progress?: number
  /** 顶层错误提示，如 token 失效。 */
  error?: string
  /** false 时界面上的金额只是部分合计（还有月份没抓到）。 */
  costComplete: boolean
  currency: string
  account?: AccountSummary
  /** 展示相关配置。host 端读插件配置后下发，客户端半侧因此无需自己读配置。 */
  display: {
    numberFormat: 'full' | 'short'
    enableDetailView: boolean
    defaultExpanded: boolean
    /**
     * 宿主是否真的能创建 Electron 登录窗口。桌面端的插件宿主创建不了 BrowserWindow，客户端据此
     * 把「登录」按钮置灰并提示改用手动填写，避免点了没反应。
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
  /** 指定年月的明细（日历查询）。 */
  month: 'tlogs.month',
  /** 图表数据（范围 × 项目 × 指标，见 UsageSeries）。 */
  series: 'tlogs.series',
  login: 'tlogs.login',
  setToken: 'tlogs.setToken',
  logout: 'tlogs.logout',
  export: 'tlogs.export',
} as const
