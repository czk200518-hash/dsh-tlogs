/**
 * tlogs — 「当前项目消耗」数据来源（P2）。
 *
 * 实测来源（DSH 0.2.0-rc.2，仅用服务名获取，不 import 任何 @deepseek-ai/* 包）：
 *
 *  1. 累计用量不在 tokenMeter。`ctx.tokenMeter.measure()` 返回的是**上下文压力**，
 *     不是累计消耗，绝不能求和。
 *  2. 累计值来自 token-meter 注册的会话投影 `tokenUsage`，字段为
 *     `{ uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }`。
 *     读取路径：
 *       热会话  ctx.sessionProjections.stateOf(session, 'tokenUsage').totals
 *       冷会话  ctx.sessionProjectionCache.cachedSnapshot(header, ['tokenUsage']).values.tokenUsage
 *  3. 项目归属用 `session.header.cwd` 分组；`ctx.workspaceRegistry.list()` 只用来取项目标题。
 *  4. 会话枚举：`ctx.sessionQuery.filterSessions([{ kind: 'cwd', values: [dir] }])`
 *     返回 `{ header, live, persisted }`；`ctx.sessions.list()` 只含**活跃**会话。
 *
 * 口径映射（把宿主的四个字段映射到平台账单口径的五类计量项）：
 *   总 Token = uncachedInputTokens + cacheReadTokens + cacheWriteTokens + outputTokens
 *             = PROMPT_CACHE_MISS_TOKEN + PROMPT_CACHE_HIT_TOKEN + PROMPT_TOKEN + RESPONSE_TOKEN
 *   即：cacheRead → PROMPT_CACHE_HIT_TOKEN
 *       uncached + cacheWrite → PROMPT_CACHE_MISS_TOKEN
 *       output → RESPONSE_TOKEN
 *       PROMPT_TOKEN 恒为 0，REQUEST 该来源不提供（记为 0）
 *
 * 任何一步的环境缺失（服务不存在、字段改名、抛错）都会降级为「不可用」，
 * 绝不会影响另外四张卡片与全部数据功能。
 */

import { createHash } from 'node:crypto'

import type { Logger, ProjectUsageProvider } from '../service.js'
import { emptyStat, type Stat } from '../types.js'

/** 投影键。 */
const TOKEN_USAGE_PROJECTION = 'tokenUsage'

/**
 * 客户端可见的项目 id：对 cwd 做**不可逆短哈希**。
 *
 * 为什么需要：`buildCards()` 的结果会经 RPC 下发到浏览器，而项目 id 原本就是
 * `session.header.cwd` 归一化后的**完整绝对路径**。UI 只显示 `label`（末两级），
 * 因此完整路径没有任何用途，却会把本机目录结构暴露到浏览器层 —— 以及和它同处
 * 一个 JS realm 的其它插件的客户端代码。
 *
 * 哈希后 id 依旧稳定且唯一，客户端「点击切换项目」的逻辑完全不受影响。
 */
export function publicProjectId(cwd: string): string {
  return createHash('sha256').update(cwd).digest('hex').slice(0, 16)
}

/** 宿主 tokenUsage 投影的四个计数字段。 */
export interface HostTokenUsage {
  uncachedInputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/** 最小宿主服务形状（全部按「存在且是函数」惰性调用）。 */
interface SessionsLike {
  list?: () => unknown[]
  get?: (id: string) => unknown
}

interface ProjectionsLike {
  stateOf?: (session: unknown, key: string) => { totals?: unknown } | undefined
  snapshot?: (session: unknown, keys?: string[]) => { values?: Record<string, unknown> } | undefined
}

interface ProjectionCacheLike {
  cachedSnapshot?: (header: unknown, keys?: string[]) => { values?: Record<string, unknown> } | undefined
}

interface SessionQueryLike {
  filterSessions?: (filter: unknown[]) => unknown[]
}

interface WorkspaceRegistryLike {
  list?: () => Array<{ id?: string; path?: string; title?: string }>
}

interface HostContextLike {
  get?: (name: string) => unknown
}

/** 把任意形状的 tokenUsage 归一化成四元组；认不出来返回 undefined。 */
export function readUsageTotals(raw: unknown): Required<HostTokenUsage> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  // 允许外面再包一层 totals。
  const inner = (r.totals && typeof r.totals === 'object' ? r.totals : r) as Record<string, unknown>

  const pick = (...names: string[]): number | undefined => {
    for (const n of names) {
      const v = inner[n]
      if (typeof v === 'number' && Number.isFinite(v)) return v
    }
    return undefined
  }

  const uncached = pick('uncachedInputTokens', 'uncached_input_tokens')
  const output = pick('outputTokens', 'output_tokens')
  const cacheRead = pick('cacheReadTokens', 'cache_read_tokens')
  const cacheWrite = pick('cacheWriteTokens', 'cache_write_tokens')

  if (uncached === undefined && output === undefined && cacheRead === undefined && cacheWrite === undefined) {
    return undefined
  }
  return {
    uncachedInputTokens: uncached ?? 0,
    outputTokens: output ?? 0,
    cacheReadTokens: cacheRead ?? 0,
    cacheWriteTokens: cacheWrite ?? 0,
  }
}

/** 把宿主四元组映射成平台的五类计量项。 */
export function toStat(u: Required<HostTokenUsage>): Stat {
  const s = emptyStat()
  s.PROMPT_TOKEN = 0
  s.PROMPT_CACHE_HIT_TOKEN = u.cacheReadTokens
  // 平台把「未命中缓存」作为计费输入项；缓存写入同样属于未命中侧。
  s.PROMPT_CACHE_MISS_TOKEN = u.uncachedInputTokens + u.cacheWriteTokens
  s.RESPONSE_TOKEN = u.outputTokens
  // 该来源不提供请求次数。
  s.REQUEST = 0
  return s
}

/** 从会话对象里取 cwd。 */
function cwdOf(session: unknown): string | undefined {
  const s = session as { header?: { cwd?: unknown }; cwd?: unknown } | undefined
  const direct = s?.cwd
  if (typeof direct === 'string' && direct.length > 0) return direct
  const h = s?.header?.cwd
  if (typeof h === 'string' && h.length > 0) return h
  return undefined
}

/** 取项目显示名：优先工作区标题，退化为末两级路径。 */
function labelFor(cwd: string, titles: Map<string, string>): string {
  const norm = cwd.replace(/[\\/]+$/, '')
  const hit = titles.get(norm) ?? titles.get(cwd)
  if (hit) return hit
  const parts = norm.split(/[\\/]/).filter(Boolean)
  if (parts.length === 0) return norm
  // 始终只显示末两级，避免长绝对路径把卡片撑破。
  return parts.slice(-2).join('/')
}

/**
 * 构造「当前项目消耗」数据源。
 *
 * 可用条件：至少能枚举会话，且至少能读到一种累计用量
 * （热投影 或 冷缓存）。否则返回降级实现。
 */
export function createProjectProvider(ctx: unknown, logger?: Logger): ProjectUsageProvider {
  const host = ctx as HostContextLike | undefined
  if (typeof host?.get !== 'function') return unavailable()

  const sessions = safeService<SessionsLike>(host, 'sessions')
  const projections = safeService<ProjectionsLike>(host, 'sessionProjections')
  const projectionCache = safeService<ProjectionCacheLike>(host, 'sessionProjectionCache')
  const sessionQuery = safeService<SessionQueryLike>(host, 'sessionQuery')
  const workspaces = safeService<WorkspaceRegistryLike>(host, 'workspaceRegistry')

  const canLive = typeof sessions?.list === 'function' && typeof projections?.stateOf === 'function'
  const canCold = typeof projectionCache?.cachedSnapshot === 'function'
  const canEnumerate = typeof sessions?.list === 'function' || typeof sessionQuery?.filterSessions === 'function'

  if (!canEnumerate || (!canLive && !canCold)) {
    logger?.info?.(
      'tlogs: 未找到会话用量表面（sessions/sessionProjections/sessionProjectionCache），「当前项目消耗」卡片将显示不可用',
    )
    return unavailable()
  }

  logger?.info?.(
    `tlogs: 启用「当前项目消耗」（热投影=${canLive ? '可用' : '不可用'}，冷缓存=${canCold ? '可用' : '不可用'}）`,
  )

  /** 读取单个会话的累计用量：热投影优先，其次冷缓存。 */
  const statOfSession = (session: unknown, header?: unknown): Stat | undefined => {
    if (canLive) {
      try {
        const state = projections!.stateOf!(session, TOKEN_USAGE_PROJECTION)
        const totals = readUsageTotals(state?.totals ?? state)
        if (totals) return toStat(totals)
      } catch {
        /* 落到冷缓存 */
      }
    }
    if (canCold && header !== undefined) {
      try {
        const snap = projectionCache!.cachedSnapshot!(header, [TOKEN_USAGE_PROJECTION])
        const totals = readUsageTotals(snap?.values?.[TOKEN_USAGE_PROJECTION])
        if (totals) return toStat(totals)
      } catch {
        /* 忽略 */
      }
    }
    return undefined
  }

  const workspaceTitles = (): Map<string, string> => {
    const map = new Map<string, string>()
    try {
      for (const w of workspaces?.list?.() ?? []) {
        const path = typeof w?.path === 'string' ? w.path.replace(/[\\/]+$/, '') : undefined
        const title = typeof w?.title === 'string' && w.title.length > 0 ? w.title : undefined
        if (path && title) map.set(path, title)
      }
    } catch {
      /* 标题只是展示用，失败无所谓 */
    }
    return map
  }

  return {
    available: () => true,
    async list() {
      const titles = workspaceTitles()
      const perProject = new Map<string, Stat>()

      const add = (cwd: string, stat: Stat) => {
        const key = cwd.replace(/[\\/]+$/, '')
        const acc = perProject.get(key)
        if (acc) {
          acc.PROMPT_TOKEN += stat.PROMPT_TOKEN
          acc.PROMPT_CACHE_HIT_TOKEN += stat.PROMPT_CACHE_HIT_TOKEN
          acc.PROMPT_CACHE_MISS_TOKEN += stat.PROMPT_CACHE_MISS_TOKEN
          acc.RESPONSE_TOKEN += stat.RESPONSE_TOKEN
          acc.REQUEST += stat.REQUEST
        } else {
          perProject.set(key, { ...stat })
        }
      }

      const seen = new Set<unknown>()

      // ---- ① 通过 sessionQuery 枚举（同时覆盖热与冷会话）----
      if (typeof sessionQuery?.filterSessions === 'function') {
        try {
          const records = sessionQuery.filterSessions([]) ?? []
          for (const rec of records) {
            const r = rec as { header?: unknown; live?: unknown; session?: unknown }
            const cwd = cwdOf({ header: r.header })
            if (!cwd) continue
            if (r.session) seen.add(r.session)
            const stat = statOfSession(r.live === true ? r.session ?? r.header : undefined, r.header)
            if (stat) add(cwd, stat)
          }
        } catch (e) {
          logger?.warn?.(`tlogs: sessionQuery 枚举失败：${e instanceof Error ? e.message : String(e)}`)
        }
      }

      // ---- ② 补充活跃会话（避免 sessionQuery 不可用时完全没有数据）----
      if (typeof sessions?.list === 'function') {
        try {
          for (const session of sessions.list() ?? []) {
            if (seen.has(session)) continue
            const cwd = cwdOf(session)
            if (!cwd) continue
            const stat = statOfSession(session)
            if (stat) add(cwd, stat)
          }
        } catch (e) {
          logger?.warn?.(`tlogs: 枚举活跃会话失败：${e instanceof Error ? e.message : String(e)}`)
        }
      }

      const out = [...perProject.entries()].map(([id, stat]) => ({
        id,
        label: labelFor(id, titles),
        stat,
      }))
      out.sort((a, b) => totalOf(b.stat) - totalOf(a.stat))
      return out
    },
  }
}

/** 安全获取可选服务（cordis 访问未注入服务会抛错）。 */
function safeService<T>(host: HostContextLike, name: string): T | undefined {
  try {
    const v = host.get?.(name)
    return v && typeof v === 'object' ? (v as T) : undefined
  } catch {
    return undefined
  }
}

function totalOf(stat: Stat): number {
  return (
    stat.PROMPT_TOKEN +
    stat.PROMPT_CACHE_HIT_TOKEN +
    stat.PROMPT_CACHE_MISS_TOKEN +
    stat.RESPONSE_TOKEN
  )
}

/** 降级实现。 */
export function unavailable(): ProjectUsageProvider {
  return {
    available: () => false,
    list: async () => [],
  }
}
