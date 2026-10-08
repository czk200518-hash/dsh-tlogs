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

/**
 * 金额（**CNY 元**，可含小数），按五类计量项拆分。
 *
 * 结构与 `Stat` 完全相同，但语义不同，故单独取名字：
 *  - 来自 `/api/v0/usage/cost`（`amount` 的金额孪生接口），实测带 `currency: "CNY"`
 *  - 该项**不是** token 数，而是「该计量项花了多少钱」；`REQUEST` 恒为 0（请求不计费）
 *  - 实测：`days[]` 的金额之和与 `total[]` 的金额之和**完全相等**（Δ ≈ 0），
 *    且 `days[].date` 与 `amount` 接口的逐日日期**逐个相同**（可安全对齐）
 *
 * 与 `Stat` 不同，这里的值**必须保留小数**：`amount` 是 `"12.1115392000000000"`
 * 这样的 16 位小数字符串，用 `toAmount`（`Math.trunc`）解析会把钱全部吞成 0。
 */
export type Money = Record<TokenType, number>

/** 空金额。与 `emptyStat` 一样必须逐次返回新对象。 */
export function emptyMoney(): Money {
  return {
    PROMPT_TOKEN: 0,
    PROMPT_CACHE_HIT_TOKEN: 0,
    PROMPT_CACHE_MISS_TOKEN: 0,
    RESPONSE_TOKEN: 0,
    REQUEST: 0,
  }
}

/** 金额合计（元）。 */
export function moneyTotal(m: Money | undefined): number {
  if (!m) return 0
  let s = 0
  for (const t of TOKEN_TYPES) s += m[t]
  return s
}

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

/** `data.biz_data` 的真实结构。
 *
 * 实测两者形状**不同**：
 *  - `/usage/amount` → `biz_data` 是**对象** `{ total, days }`
 *  - `/usage/cost`   → `biz_data` 是**数组** `[{ total, days, currency }]`（长度恒为 1）
 *
 * 因此解析前必须先用 `unwrapBizData()` 归一化，否则会静默拿到全 0（这个坑实测踩过）。
 */
export interface BizData {
  total?: ModelUsage[] | null
  days?: DayUsage[] | null
  /** `usage/cost` 独有；实测值为 `"CNY"`。 */
  currency?: string | null
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
  /** 该范围的费用（CNY，五类拆分）。没有金额数据时缺省。 */
  cost?: Money
  /** 金额币种（实测 `CNY`）；仅在有 `cost` 时有意义。 */
  currency?: string
}

/** 查询范围。 */
export type UsageScope = 'total' | 'today' | 'week' | 'month' | 'last7' | 'last30'

/**
 * 紧凑条可展示的指标项。
 *
 * 前六个与 `UsageScope` 同名，展示的是 **token** 值；`cost_*` 是**金额**项，
 * 语义上是「对应窗口的 ¥」，因此不复用 scope 命名空间（`scope` 字段仍用于点击定位）。
 */
export type CompactMetric =
  | UsageScope
  | 'cost_total'
  | 'cost_today'
  | 'cost_last7'
  | 'cost_last30'

/** 全部合法的紧凑条指标。 */
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
}

/** 详细视图的完整数据。 */
export interface DetailData {
  /** 平台账单口径的按模型明细（只含 DeepSeek 官方通道）。 */
  models: StatRow[]
  years: StatRow[]
  months: StatRow[]
  days: StatRow[]
  /**
   * **本机口径**的「供应商 · 模型」明细（来自 DSH 会话日志）。
   *
   * 为什么单独一栏而不是并进 `models`：平台账单按模型给总量、且只覆盖 DeepSeek
   * 官方通道；本机口径按 `provider:model` 给量、覆盖所有供应商（火山方舟 / 小米 /
   * GLM / GPT…）。两者口径不同，混在一张表里会让人以为「平台的模型列表漏了」。
   * 取不到本机数据时缺省（旧宿主）。
   */
  providers?: StatRow[]
  /** 本机口径覆盖的日期区间与天数（用于在表头标注「这份数据只覆盖这段时间」）。 */
  localRange?: { from: string; to: string; days: number; files: number }
}

/**
 * 某个月的明细（日历查询用）。
 *
 * 逐日数据来自历史缓存 —— 每个抓取过的月份都把 `days` 一起存了下来，
 * 所以日历可以回溯查看任意月份的每一天，而不只是当月。
 */
export interface MonthDetail {
  year: number
  month: number
  /** 该月合计。 */
  stat: ScopeStat
  /** 该月按模型的明细（降序）。 */
  models: StatRow[]
  /** 该月逐日明细（升序）。 */
  days: StatRow[]
  /** 金额币种。 */
  currency?: string
  /** 该月是否已有金额数据（否则界面不显示 ¥ 列，避免显示一排 ¥0.00 误导）。 */
  costAvailable?: boolean
}

/** 图表的时间范围预设。 */
export type ChartRange =
  /** 有史以来（配置起点 → 今天）。 */
  | 'all'
  /** 自定义起止日期（含两端）。 */
  | 'custom'
  | 'today'
  /** 本周一至今。 */
  | 'week'
  /** 本月 1 日至今。 */
  | 'month'
  /** 滚动最近 7 天（含今天）。 */
  | 'last7'
  /** 滚动最近 30 天（含今天）。 */
  | 'last30'

/** 图表的数据源。 */
export type ChartSource =
  /** 平台账单（账号维度，接口按天返回逐日明细）。 */
  | 'platform'
  /** 本机项目用量（DSH 会话投影，按插件每日快照积累）。 */
  | 'project'

/** 图表里的一个时间桶（一天 / 一个月 / 一年）。 */
export interface SeriesPoint {
  /** 桶键：`YYYY-MM-DD` / `YYYY-MM` / `YYYY`。 */
  key: string
  /** 该桶的原始五类计量项合计。 */
  stat: Stat
  /** 该桶的费用合计（CNY 元）。没有金额数据时为 0。 */
  cost?: number
}

/** 图表数据源里可选的「项目」。 */
export interface SeriesProject {
  /** 不可逆短哈希，绝不下发完整 cwd（见 store/project.ts 的 publicProjectId）。 */
  id: string
  label: string
  /** 当前累计用量。 */
  stat: Stat
}

/**
 * 项目维度的时间序列。
 *
 * 数据来自插件自身的**逐日快照**：平台账单接口没有项目维度，而宿主投影只给
 * 「累计至今」一个数，所以历史曲线只能在本地一天天记。`points` 的最后一个点
 * 会被替换成**当前实时值**，保证曲线终点与「当前项目消耗」卡片完全一致。
 */
export interface ProjectSeries {
  id: string
  label: string
  /** 该项目当前是否仍在项目列表中（false = 只剩历史快照）。 */
  known: boolean
  /**
   * 范围内首点**之前**的最后一次快照（可能没有）。
   *
   * 「每期新增」模式下第一个点的基线：没有它就只能把首点本身当作增量，
   * 会把该项目自启用以来的全部用量算进这一天。
   */
  prior?: { date: string; stat: Stat }
  /** 累计快照（按日期升序）。 */
  points: Array<{ date: string; stat: Stat }>
}

/**
 * 图表页所需的全部数据（`tlogs.series` 的返回）。
 *
 * 为什么逐日与逐月**都**下发：逐日明细只对「抓到过 days 的月份」存在，而月度合计
 * 始终完整。客户端按粒度取不同的数组 —— 月/年粒度走 `months`（不会因缺天而低估），
 * 天粒度走 `days`（缺的月份表现为断点，并由 `partial` 提示）。
 */
export interface UsageSeries {
  /** 解析后的范围（本地日历日，含两端）。 */
  from: string
  to: string
  /** 范围内的逐日明细（升序，只含接口真的返回了数据的天）。 */
  days: Array<{ date: string; stat: Stat; cost?: number }>  /** 范围内按月的合计（升序，始终完整）。 */
  months: SeriesPoint[]
  /** `from` 之前的累计（「累计」曲线需要正确基线，否则起点会从 0 跳变）。 */
  prior: Stat
  /** `from` 之前的累计费用（CNY 元）。 */
  priorCost?: number
  /** 范围内按模型的合计（降序）。 */
  models: SeriesPoint[]
  /** 可选项目（含累计用量）。 */
  projects: SeriesProject[]
  /** 范围内是否存在缺少逐日明细的月份。 */
  partial: boolean
  /** 范围内是否存在缺少**金额**的月份（金额尚未回补完时提示用）。 */
  costPartial?: boolean
  /** 范围内金额的五类拆分（用于「消费金额」指标的构成饼图）。 */
  costByType?: Money
  /** 金额币种（实测 `CNY`）。 */
  currency?: string
  /** 指定 `projectId` 时的项目序列。 */
  project?: ProjectSeries
}

/** 图表数据请求（`tlogs.series` 的入参）。 */
export interface SeriesQuery {
  range: ChartRange
  /** 仅 `range === 'custom'` 时有意义（`YYYY-MM-DD`）。 */
  from?: string
  to?: string
  /** 指定项目（`publicProjectId` 的短哈希）；缺省表示看平台账单。 */
  projectId?: string
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
  days?: Array<{
    date: string
    stat: Stat
    /** 该日费用（CNY，五类拆分）。来自 `usage/cost` 的同一天；缺省表示没抓到金额。 */
    cost?: Money
  }>
  /**
   * 该月**是否已经抓取过**逐日明细。
   *
   * 早期版本抓到的月份没有存 `days`，而计划器按「有统计、无错误」判定完成，这些月份
   * 因此被永久跳过、日历只能显示一片「—」（实测：31 个月里 29 个为空）。这个标记用于
   * **一次性回补**：无标记的旧行会被重抓一次；抓完即打标记，即便接口当月未返回 days
   * 也不会反复重抓。
   */
  daysFetched?: boolean
  /** 该月费用（CNY，五类拆分）。来自 `usage/cost`。 */
  cost?: Money
  /** 该月按模型的费用（CNY，仅总额，不拆五类）。 */
  costModels?: Record<string, number>
  /** 该月金额的币种（实测 `CNY`）。 */
  currency?: string
  /**
   * 该月**是否已经抓取过**金额。
   *
   * 与 `daysFetched` 同一套一次性回补机制：新增金额能力时，老的缓存行没有 `cost`，
   * 会被计划器挑出来重抓一次（这一次要多打一遍 `usage/cost`，31 个月约 30 秒）。
   */
  costFetched?: boolean
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
  /**
   * 按模型的**费用合计**（CNY 元）。
   *
   * 单独一份而不并进 `models[].cost`：接口的按模型金额只有总额，没有五类拆分，
   * 硬塞进 `Money` 的某个桶会污染「输入/输出成本」的展示。
   */
  modelCosts: Record<string, number>
  /** 金额币种。 */
  currency: string
  /** 区间内所有月份是否都已抓到金额。false 时 `grand.cost` 只是部分合计。 */
  costComplete: boolean
  /** 逐月明细。 */
  monthly: MonthRow[]
}

/**
 * 卡片数字的**来源与拆分**（双路数据源）。
 *
 * 平台口径只覆盖 DeepSeek 通道且当天要等结算；本机口径（会话日志）实时、覆盖
 * 本机所有供应商但看不到别的设备。两路按 `store/usage-merge.ts` 的规则合并，
 * 这里把「这份数字是谁给的」一并下发，供界面标注与 tooltip 解释。
 */
export interface CardSourceInfo {
  /** 最终采用的来源。 */
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
  /** 数字来源与拆分（双路数据源；「当前项目」卡没有这一项）。 */
  source?: CardSourceInfo
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

/**
 * 平台账户概览（来自 `/api/v0/users/get_user_summary`，实测字段）。
 *
 * 与用量接口是**两回事**：这里是「钱包 + 官方账单累计」，不是按月的用量归集。
 * 它正是控制台右上角/账单页那个「消费金额」，因此拿它做「官方口径」的参照。
 *
 * 注：面板上的展示项已按要求移除，数据链路保留。
 */
export interface AccountSummary {
  /** 充值余额。 */
  balance: number
  /** 赠送余额。 */
  bonusBalance: number
  /** 官方账单的**累计消费**（元）。 */
  totalCosts: number
  /** 币种（实测 `CNY`）。 */
  currency: string
}

/** 客户端向 host 请求的完整快照。 */
export interface UsageSnapshot {
  auth: AuthState
  cards: CardData[]
  /**
   * 紧凑条使用的精简指标。
   *
   * `unit` 决定单位与 tooltip 文案：默认 `tokens`；`requests` 用于紧随「今日」
   * 之后的今日请求数（同一个 scope，因此不能靠 scope 区分两者）；`money` 用于金额。
   */
  compact: Array<{
    scope: UsageScope
    label: string
    value: number
    unit?: 'tokens' | 'requests' | 'money'
    /** 该数字的来源（双路数据源）；金额项不适用时缺省。 */
    source?: CardSourceInfo['kind']
  }>
  /** 是否有任一卡片使用过期缓存。 */
  stale: boolean
  /** 最近一次成功刷新的时间戳（ms）。 */
  lastUpdatedAt: number | null
  /**
   * 本机口径（会话日志）的可用性与扫描结果。
   *
   * 不可用时窗口卡片完全依赖平台口径 —— 那正是「当天显示 0」的成因，
   * 所以界面要能把原因说出来，而不是安静地显示 0。
   */
  localUsage?: {
    available: boolean
    /** 不可用/降级原因（英文枚举或简短说明）。 */
    reason?: string
    /** 参与聚合的天数。 */
    days: number
    /** 扫描到的会话日志数。 */
    files: number
    /** 最近一次扫描时间（ms）。 */
    updatedAt: number
  }
  /** 是否仍在后台拉取全量历史。 */
  loading: boolean
  /** 全量拉取进度 0..1，仅 loading 时有意义。 */
  progress?: number
  /** 顶层错误提示（如 token 失效）。 */
  error?: string
  /** 金额信息是否已覆盖全部月份；false 时界面上的金额是**部分合计**。 */
  costComplete: boolean
  /** 金额币种。 */
  currency: string
  /** 平台账户概览；取不到时缺省（不影响其余功能）。 */
  account?: AccountSummary
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
  /** 指定年月的明细（日历查询）。 */
  month: 'tlogs.month',
  /** 图表数据（范围 × 项目 × 指标，见 UsageSeries）。 */
  series: 'tlogs.series',
  login: 'tlogs.login',
  setToken: 'tlogs.setToken',
  logout: 'tlogs.logout',
  export: 'tlogs.export',
} as const
