/**
 * tlogs — 插件配置的解析与默认值。
 *
 * 对应需求第六章「配置」。配置通过 profile 的 cordis.patch.yml 注入，
 * 因此这里对每个字段都做防御式归一化：用户手写 YAML 时很容易写出
 * 越界值或错类型，插件必须能带着合理默认值继续工作。
 */

import { CACHE_TTL } from './store/cache.js'
import { COMPACT_METRICS, type CompactMetric } from './types.js'

/** 用户在 cordis.patch.yml 里可写的原始配置。 */
export interface TlogsConfig {
  /** 手动指定 userToken（不推荐；优先使用自动获取）。 */
  platformUserToken?: string
  /** 起始查询年（与 Python 默认一致：2024）。 */
  startYear?: number
  /** 起始查询月（与 Python 默认一致：4）。 */
  startMonth?: number
  /** 每次月度请求间隔（毫秒，对应 Python 的 time.sleep）。 */
  requestIntervalMs?: number
  /**
   * 缓存时长，单位**秒**（与需求 6.1 的示例一致：`total: 1800   # 30 分钟`）。
   * 内部统一换算为毫秒。
   */
  cacheTTL?: { total?: number; current?: number }
  /** 内嵌组件默认是否展开。 */
  defaultExpanded?: boolean
  /** 紧凑条展示哪些指标。 */
  compactMetrics?: CompactMetric[]
  /** 是否启用详细面板。 */
  enableDetailView?: boolean
  /** 数字格式：full（千分位）| short（K/M/B 缩写）。 */
  numberFormat?: 'full' | 'short'
  /** 缓存目录（对应 TLOGS_CACHE_DIR 环境变量）。 */
  cacheDir?: string
  /** 是否启用「当前项目消耗」卡片（P2，默认开启，不可用时自动降级）。 */
  enableProjectScope?: boolean
  /** 是否允许把历史缓存落盘（默认开启；false 时完全不访问文件系统）。 */
  persistHistory?: boolean
  /**
   * 定时自动刷新的间隔，单位**秒**（默认 300 = 5 分钟，0 = 关闭）。
   *
   * 注意它只决定「多久触发一次刷新」；单次刷新真正会打哪些月份仍由 `cacheTTL`
   * 判定（当前范围 5 分钟、全量历史 30 分钟），因此不会每 5 分钟就把 31 个月全拉一遍。
   */
  autoRefreshSeconds?: number
  /** 单个 tool 结果里最多返回多少行（防止把上下文塞爆）。 */
  maxToolRows?: number
  /**
   * 是否把用量数字暴露给模型（注册 `query_token_usage` 工具）。
   *
   * **默认 false**：工具的返回值会进入模型上下文，也就是把你的用量统计作为
   * 对话内容发送给模型提供方。默认不注册工具，数字只经 host→浏览器 RPC 进入
   * 侧边栏 UI，模型完全看不到。需要「在对话里问用量」时才显式打开。
   */
  exposeUsageToModel?: boolean
  /**
   * 是否允许复用 DSH 已登录账号的 Platform 会话凭据（方案 D）。
   *
   * 默认 true（零配置即可取数）。设为 false 后插件**完全不接触**
   * `deepseekAccount` 服务：连可选注入都不会发起，只剩手工/环境变量/配置三条
   * 显式来源。适合「只接受显式凭据」的最小权限诉求。
   */
  useAccountSession?: boolean
  /**
   * 是否读取本机会话日志作为**第二路数据源**（默认 true）。
   *
   * 平台接口只覆盖 DeepSeek 官方通道，且当天数据要等平台结算（实测当天
   * 北京时间 12:07 仍为 0）；非 DeepSeek 供应商（火山方舟/小米/GLM 等）平台
   * 完全看不到。本机口径直接从 `$DSH_HOME/sessions/**` 的会话日志重建逐日用量，
   * 实时且覆盖所有供应商，但只看得到本机。
   *
   * 设为 false 后插件**完全不读会话日志**（只在平台口径上工作），
   * 适合「最小文件访问」的诉求 —— 代价是当天与非 DeepSeek 用量会缺失。
   */
  localUsage?: boolean
  /** 本机口径向前回溯的天数（默认 32，覆盖「近 30 天」窗口）。 */
  localUsageScanDays?: number
}

/** 归一化后的配置，所有字段必填（缓存时长为毫秒）。 */
export interface ResolvedConfig {
  platformUserToken: string
  startYear: number
  startMonth: number
  requestIntervalMs: number
  /** 已换算为毫秒。 */
  cacheTTL: { total: number; current: number }
  defaultExpanded: boolean
  compactMetrics: CompactMetric[]
  enableDetailView: boolean
  numberFormat: 'full' | 'short'
  cacheDir: string
  enableProjectScope: boolean
  persistHistory: boolean
  /** 定时自动刷新间隔（秒）；0 = 关闭。 */
  autoRefreshSeconds: number
  maxToolRows: number
  /** 是否把用量数字暴露给模型（默认 false，见 TlogsConfig）。 */
  exposeUsageToModel: boolean
  /** 是否复用 DSH 账号会话凭据（默认 true，见 TlogsConfig）。 */
  useAccountSession: boolean
  /** 是否读取本机会话日志作为第二路数据源（默认 true，见 TlogsConfig）。 */
  localUsage: boolean
  /** 本机口径回溯天数（默认 32，见 TlogsConfig）。 */
  localUsageScanDays: number
}

/** 合法的 scope 值集合。 */
const SCOPES: readonly string[] = COMPACT_METRICS

/** 把任意输入夹到整数区间内。 */
function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  const i = Math.trunc(n)
  if (i < min) return min
  if (i > max) return max
  return i
}

/** 默认缓存目录：`$TLOGS_CACHE_DIR` 优先，否则 `<DSH_HOME>/tlogs`。 */
export function defaultCacheDir(env: (n: string) => string | undefined = (n) => process.env[n]): string {
  const explicit = env('TLOGS_CACHE_DIR')
  if (explicit && explicit.trim().length > 0) return explicit.trim()
  const base = dshHome(env)
  return `${base.replace(/[\\/]+$/, '')}/tlogs`
}

/** DSH 主目录：`$DSH_HOME`，缺省为当前工作目录（与上面同一约定）。 */
export function dshHome(env: (n: string) => string | undefined = (n) => process.env[n]): string {
  const home = env('DSH_HOME')
  return home && home.trim().length > 0 ? home.trim() : '.'
}

/**
 * 会话日志根目录：`<DSH_HOME>/sessions`。
 *
 * 本机口径的数据源就在这个目录下（`<项目>/<会话>/session[.vN].jsonl[.zstd]`），
 * 与 DSH 自己写日志的位置一致；只读，不写入。
 */
export function defaultSessionsDir(env: (n: string) => string | undefined = (n) => process.env[n]): string {
  return `${dshHome(env).replace(/[\\/]+$/, '')}/sessions`
}

/**
 * 归一化配置。
 *
 * 默认值刻意与 Python 脚本保持一致：
 *  - startYear=2024 / startMonth=4（py:25-26）
 *  - requestIntervalMs=1000（py:29 REQUEST_INTERVAL = 1.0；需求建议 1–1.2s）
 */
export function resolveConfig(
  raw: TlogsConfig | undefined,
  env: (n: string) => string | undefined = (n) => process.env[n],
): ResolvedConfig {
  const cfg = raw ?? {}

  const metrics = Array.isArray(cfg.compactMetrics)
    ? cfg.compactMetrics.filter((m): m is CompactMetric => SCOPES.includes(m as string))
    : []

  return {
    platformUserToken: typeof cfg.platformUserToken === 'string' ? cfg.platformUserToken.trim() : '',
    startYear: clampInt(cfg.startYear, 2024, 2100, 2024),
    startMonth: clampInt(cfg.startMonth, 1, 12, 4),
    // 下限 0 允许测试/特殊环境关闭节流；上限 60s 防止用户写出离谱值。
    requestIntervalMs: clampInt(cfg.requestIntervalMs, 0, 60_000, 1000),
    cacheTTL: {
      // 配置以「秒」书写（需求 6.1），这里换算成毫秒；上限 24 小时。
      total: clampInt(cfg.cacheTTL?.total, 0, 24 * 3600, CACHE_TTL.total / 1000) * 1000,
      current: clampInt(cfg.cacheTTL?.current, 0, 24 * 3600, CACHE_TTL.current / 1000) * 1000,
    },
    defaultExpanded: cfg.defaultExpanded === true,
    // 缺省放「总计 + 今日」。
    //
    // 为什么金额**不在**默认值里：紧凑条只有侧边栏那么宽，四个指标（总/金额/今日/
    // 请求）会把标签挤成碎片（实测截图：标签全部消失，只剩「8.9B · ¥678.87 ·
    // ↖561M · ⚡2.4K」）。金额改在展开面板的卡片与「详细数据」里看。
    compactMetrics: metrics.length > 0 ? metrics : ['total', 'today'],
    enableDetailView: cfg.enableDetailView !== false,
    numberFormat: cfg.numberFormat === 'full' ? 'full' : 'short',
    cacheDir: typeof cfg.cacheDir === 'string' && cfg.cacheDir.trim().length > 0 ? cfg.cacheDir.trim() : defaultCacheDir(env),
    enableProjectScope: cfg.enableProjectScope !== false,
    persistHistory: cfg.persistHistory !== false,
    // 默认 5 分钟；下限 0（关闭），上限 24 小时。
    autoRefreshSeconds: clampInt(cfg.autoRefreshSeconds, 0, 24 * 3600, 300),
    maxToolRows: clampInt(cfg.maxToolRows, 1, 200, 20),
    // 默认关闭：工具的返回值就是模型上下文，默认不让用量数字离开本机。
    exposeUsageToModel: cfg.exposeUsageToModel === true,
    // 默认开启：保持零配置取数；设 false 则连可选注入都不发起。
    useAccountSession: cfg.useAccountSession !== false,
    // 默认开启：平台口径当天滞后且只覆盖 DeepSeek 通道，本机口径补上这两块。
    localUsage: cfg.localUsage !== false,
    // 「近 30 天」窗口 + 2 天余量；上限一年，防止日志扫描过重。
    localUsageScanDays: clampInt(cfg.localUsageScanDays, 2, 366, 32),
  }
}
