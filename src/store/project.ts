/**
 * tlogs — 「当前项目消耗」数据源。
 *
 * 累计用量不能从 `ctx.tokenMeter.measure()` 取，它返回的是上下文压力而非累计消耗；真正的
 * 累计值在 token-meter 注册的 `tokenUsage` 会话投影里，字段为 `{ uncachedInputTokens,
 * outputTokens, cacheReadTokens, cacheWriteTokens }`：热会话走
 * `ctx.sessionProjections.stateOf(session, 'tokenUsage').totals`，冷会话走
 * `ctx.sessionProjectionCache.cachedSnapshot(header, ['tokenUsage']).values.tokenUsage`。
 *
 * 项目归属按 `session.header.cwd` 分组（`ctx.workspaceRegistry.list()` 只用来取标题）；会话用
 * `ctx.sessionQuery.filterSessions([...])` 枚举，它同时覆盖热与冷会话，而
 * `ctx.sessions.list()` 只有活跃会话，作为 sessionQuery 不可用时的补充。
 *
 * 宿主的四个字段映射到平台账单的五类计量项：cacheRead 记 PROMPT_CACHE_HIT_TOKEN，
 * uncached + cacheWrite 记 PROMPT_CACHE_MISS_TOKEN，output 记 RESPONSE_TOKEN，
 * PROMPT_TOKEN 恒为 0，REQUEST 这个来源不提供（同样记 0）。服务不存在、字段改名或抛错都只
 * 降级为「不可用」，不影响其余卡片与数据功能。
 */

import { createHash } from 'node:crypto'

import type { Logger, ProjectUsageProvider } from '../service.js'
import { emptyStat, TOKEN_TYPES, type Stat } from '../types.js'

/** 投影键。 */
const TOKEN_USAGE_PROJECTION = 'tokenUsage'

/**
 * 客户端可见的项目 id：对 cwd 做不可逆短哈希。
 *
 * `buildCards()` 的结果会经 RPC 下发到浏览器，而项目 id 原本就是 `session.header.cwd`
 * 归一化后的完整绝对路径；UI 只显示 `label`（末两级），完整路径没有用途，却会把本机目录
 * 结构暴露给浏览器层，以及和它同处一个 JS realm 的其它插件的客户端代码。哈希后的 id
 * 依旧稳定唯一，客户端「点击切换项目」的逻辑不受影响。
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

/** 宿主服务的最小形状，全部按「存在且是函数」惰性调用，字段缺失就降级。 */
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

/** 归一化任意形状的 tokenUsage（宿主字段有 camelCase 与 snake_case 两种拼法，有的还在外层多包一层 totals）；认不出来返回 undefined。 */
export function readUsageTotals(raw: unknown): Required<HostTokenUsage> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
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

/** 把宿主的四个计数字段映射成平台账单的五类计量项；该来源不提供请求次数（REQUEST 记 0）。 */
export function toStat(u: Required<HostTokenUsage>): Stat {
  const s = emptyStat()
  s.PROMPT_TOKEN = 0
  s.PROMPT_CACHE_HIT_TOKEN = u.cacheReadTokens
  s.PROMPT_CACHE_MISS_TOKEN = u.uncachedInputTokens + u.cacheWriteTokens
  s.RESPONSE_TOKEN = u.outputTokens
  s.REQUEST = 0
  return s
}

/** cwd 可能挂在会话本身上，也可能在 header 里。 */
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
 * 构造「当前项目消耗」数据源：至少要能枚举会话、且至少能读到一种累计用量
 * （热投影或冷缓存），否则返回降级实现。
 */
export function createProjectProvider(ctx: unknown, logger?: Logger): ProjectUsageProvider {
  const host = ctx as HostContextLike | undefined
  if (typeof host?.get !== 'function') return unavailable()

  const sessions = optionalService<SessionsLike>(host, 'sessions')
  const projections = optionalService<ProjectionsLike>(host, 'sessionProjections')
  const projectionCache = optionalService<ProjectionCacheLike>(host, 'sessionProjectionCache')
  const sessionQuery = optionalService<SessionQueryLike>(host, 'sessionQuery')
  const workspaces = optionalService<WorkspaceRegistryLike>(host, 'workspaceRegistry')

  const canLive = typeof sessions?.list === 'function' && typeof projections?.stateOf === 'function'
  const canCold = typeof projectionCache?.cachedSnapshot === 'function'
  // sessionQuery 覆盖热+冷会话，sessions.list 只有活跃会话，仅作补充。
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

  // 读单个会话的累计用量：热投影优先，其次冷缓存（冷缓存要 header 才有得读）；
  // 返回 undefined 表示未知。
  const totalsOfSession = (session: unknown, header?: unknown): Stat | undefined => {
    // 热投影优先，其次冷缓存（冷缓存要 header 才有得读）。
    if (canLive) {
      try {
        const state = projections!.stateOf!(session, TOKEN_USAGE_PROJECTION)
        const totals = readUsageTotals(state?.totals ?? state)
        if (totals) return toStat(totals)
      } catch {
        /* 热读失败就落到冷缓存 */
      }
    }
    if (canCold && header !== undefined) {
      try {
        const snap = projectionCache!.cachedSnapshot!(header, [TOKEN_USAGE_PROJECTION])
        const totals = readUsageTotals(snap?.values?.[TOKEN_USAGE_PROJECTION])
        if (totals) return toStat(totals)
      } catch {
        /* 冷读也没有，当作未知 */
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
      /* 标题只影响展示，读不到就算了 */
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
        if (!acc) {
          perProject.set(key, { ...stat })
          return
        }
        for (const t of TOKEN_TYPES) acc[t] += stat[t]
      }

      const seen = new Set<unknown>()

      if (typeof sessionQuery?.filterSessions === 'function') {
        try {
          const records = sessionQuery.filterSessions([]) ?? []
          for (const rec of records) {
            const r = rec as { header?: unknown; live?: unknown; session?: unknown }
            const cwd = cwdOf({ header: r.header })
            if (!cwd) continue
            if (r.session) seen.add(r.session)
            const stat = totalsOfSession(r.live === true ? r.session ?? r.header : undefined, r.header)
            if (stat) add(cwd, stat)
          }
        } catch (e) {
          logger?.warn?.(`tlogs: sessionQuery 枚举失败：${e instanceof Error ? e.message : String(e)}`)
        }
      }

      if (typeof sessions?.list === 'function') {
        try {
          for (const session of sessions.list() ?? []) {
            if (seen.has(session)) continue
            const cwd = cwdOf(session)
            if (!cwd) continue
            const stat = totalsOfSession(session)
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

/** 取某个可选宿主服务；cordis 里访问未注入的服务会抛错，所以这里吞掉。 */
function optionalService<T>(host: HostContextLike, name: string): T | undefined {
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
