/**
 * tlogs — host 端 RPC 端点。
 *
 * 通道：`/tlogs`（client 用 `ctx.connection.rpc.call(CHANNEL, endpoint, payload)`）。
 *
 * 信封与 workspace-mover 一致，兼容 DSH 的 rpcErrorSchema：
 *   成功 `{ ok: true, value }`
 *   失败 `{ ok: false, error: { code, message, details } }`
 *
 * 权限：0.2.0-rc.2 的 RPC 没有方法级的 loopback 分级，保护来自连接本身
 * —— 所有 RPC 都要求浏览器会话 Cookie（否则 401）并经过 Host/Origin 围栏
 * （否则 403），因此非本机来源无法通过该通道读写凭据。
 */

import { RPC } from './types.js'
import { TLOGS_TOKEN_REF } from './auth/credentials-store.js'
import { isDateKey, isProjectId } from './store/project-history.js'
import type { Logger, UsageService } from './service.js'
import type { TokenManager } from './auth/token-manager.js'

/** 成功信封。 */
export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value }
}

/** 失败信封（与 dsh rpcErrorSchema 形状兼容）。 */
export function fail(code: string, message: string, details: Record<string, unknown> = {}) {
  return { ok: false as const, error: { code, message, details: { issues: [{ message }], ...details } } }
}

export interface RpcDeps {
  service: UsageService
  tokens: TokenManager
  /** 清除历史缓存（退出登录时）。 */
  clearHistory: () => void
  logger?: Logger
}

/**
 * 手动提交 userToken 的长度上限。
 *
 * 该 endpoint 会把入参**持久化并在后续请求里当请求头送出**，所以不能接受任意
 * 长度的字符串。平台令牌是 64 字符，即便带 `{"value":...}` 包装也远小于此上限。
 */
export const MAX_TOKEN_INPUT = 4096

/**
 * 两次「强制刷新」之间的最小间隔（毫秒）。
 *
 * 强制刷新绕开全部 TTL 与节流，单次最多 31 个外发请求；任何已持有本机 DSH
 * 会话的页面代码都能调用该端点，因此必须设下限。
 */
export const MIN_FORCED_REFRESH_MS = 5000

/**
 * 图表自定义范围的最大跨度（天）。
 *
 * 范围越大，`tlogs.series` 的响应里逐日数组越长（每年约 365 条）。上限设成 10 年，
 * 既覆盖本机全部历史，又不给「构造一个超大范围把响应撑爆」留口子。
 */
export const MAX_SERIES_DAYS = 3660

/** 允许的图表范围预设。`last7` / `last30` 是滚动窗口（含今天）。 */
const CHART_RANGES = ['all', 'custom', 'today', 'week', 'month', 'last7', 'last30'] as const

/** 把任何文本压成**单行**安全文本：去控制字符，防止日志注入与多行伪造。 */
function oneLine(s: string, max = 200): string {
  return s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** 把异常映射为稳定错误码。 */
function mapError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  const code = (e as { code?: string })?.code
  if (code) return fail(code, oneLine(msg))
  if (/未配置|需要重新登录|401/.test(msg)) return fail('unauthorized', oneLine(msg))
  if (/请求异常|fetch failed|ENOTFOUND|ETIMEDOUT|network/i.test(msg)) return fail('network', oneLine(msg))
  return fail('internal-error', oneLine(msg))
}

/** 构造 RPC 处理器。 */
export function makeRpcHandler(deps: RpcDeps) {
  const { service, tokens, clearHistory, logger } = deps

  /** 上一次强制刷新的时刻（端点级节流状态）。 */
  let lastForcedRefreshAt = 0

  return async function handle(
    endpoint: string,
    payload: Record<string, unknown> = {},
  ): Promise<unknown> {
    try {
      switch (endpoint) {
        case RPC.snapshot:
          return ok(await service.snapshot())

        case RPC.refresh: {
          // force=true 对应「手动点击刷新按钮强制刷新」，绕开 TTL；
          // 否则按 TTL 判定（挂载 / 展开 / 定时都走这条）。
          const force = payload.force === true

          // 强制刷新的最小间隔。
          //
          // `force` 会绕开全部 TTL 与节流，单次最多发起 31 个外发请求。而任何
          // 已持有本机 DSH 会话的页面代码都能调用这个端点 —— 不设下限就等于把
          // 「打爆你账号的平台侧限流」这个能力开放出去了。5 秒既不影响手动点
          // 「刷新」的手感，又把放大倍数压到可接受范围。
          if (force) {
            const since = Date.now() - lastForcedRefreshAt
            if (since < MIN_FORCED_REFRESH_MS) {
              return ok({ started: false, throttled: true, retryAfterMs: MIN_FORCED_REFRESH_MS - since })
            }
            lastForcedRefreshAt = Date.now()
          }

          const started = service.startRefresh(force ? 'manual' : 'scheduled')
          return ok(started)
        }

        case RPC.detail:
          return ok(service.detail())

        case RPC.month: {
          // 日历查询：拉取指定年月的逐日明细。入参必须严格校验（客户端可传任意值）。
          const year = Number(payload.year)
          const month = Number(payload.month)
          if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            return fail('invalid-input', 'year 无效')
          }
          if (!Number.isInteger(month) || month < 1 || month > 12) {
            return fail('invalid-input', 'month 无效')
          }
          return ok(service.monthDetail(year, month))
        }

        case RPC.series: {
          // 图表数据。入参全部来自客户端，**一律严格校验**后再交给 service。
          const range = payload.range
          if (typeof range !== 'string' || !(CHART_RANGES as readonly string[]).includes(range)) {
            return fail('invalid-input', `range 无效（可选：${CHART_RANGES.join(' | ')}）`)
          }

          let from: string | undefined
          let to: string | undefined
          if (range === 'custom') {
            if (!isDateKey(payload.from) || !isDateKey(payload.to)) {
              return fail('invalid-input', '日期格式应为 YYYY-MM-DD')
            }
            if (payload.from > payload.to) {
              return fail('invalid-input', '起始日期不能晚于结束日期')
            }
            const span =
              (Date.parse(`${payload.to}T00:00:00Z`) - Date.parse(`${payload.from}T00:00:00Z`)) /
              86_400_000
            if (!Number.isFinite(span) || span > MAX_SERIES_DAYS) {
              return fail('invalid-input', `范围过大（上限 ${MAX_SERIES_DAYS} 天）`)
            }
            from = payload.from
            to = payload.to
          }

          let projectId: string | undefined
          if (payload.projectId !== undefined && payload.projectId !== '') {
            if (!isProjectId(payload.projectId)) return fail('invalid-input', 'projectId 无效')
            projectId = payload.projectId
          }

          return ok(
            await service.series({
              range: range as (typeof CHART_RANGES)[number],
              ...(from !== undefined ? { from } : {}),
              ...(to !== undefined ? { to } : {}),
              ...(projectId !== undefined ? { projectId } : {}),
            }),
          )
        }

        case RPC.setToken: {
          const token = typeof payload.token === 'string' ? payload.token : ''
          if (token.trim().length === 0) return fail('invalid-input', 'userToken 不能为空')
          // 上限校验：入口会把入参落盘并当作请求头发出去，不能收任意长度。
          if (token.length > MAX_TOKEN_INPUT) {
            return fail('invalid-input', `userToken 过长（上限 ${MAX_TOKEN_INPUT} 字符）`)
          }
          const saved = await tokens.save(token)
          if (!saved) return fail('invalid-input', 'userToken 格式无效')
          logger?.info?.(`tlogs: 已保存 userToken 到凭据（${TLOGS_TOKEN_REF}）`)
          return ok({ ok: true })
        }

        case RPC.login: {
          const r = await tokens.login()
          if (!r.ok) return fail('login-failed', r.error ?? '登录失败')
          return ok({ ok: true })
        }

        case RPC.logout: {
          await tokens.logout()
          clearHistory()
          logger?.info?.('tlogs: 已退出登录并清除本地缓存')
          return ok({ ok: true })
        }

        case RPC.export: {
          // 已**停用**（端点保留以免旧客户端拿到 404 语义变化，但一律拒绝）。
          //
          // 原因：客户端半侧从未调用它（全仓零引用），而它会一次性返回
          // `service.report()` —— 其中「当前项目」条目的 key 是
          // `session.header.cwd` 归一化后的**完整绝对路径**（UI 只显示末两级，
          // 导出却原样外泄）。一个没人用的端点不该有这种能力。
          //
          // 若将来要做导出功能，请改为：显式字段白名单、不含 `cwd`，
          // 且只允许 `snapshot` 已经下发的数据。
          logger?.warn?.('tlogs: export 端点已停用（无客户端调用方，且会外泄项目绝对路径）')
          return fail('disabled', '导出端点已停用')
        }

        default:
          return fail('bad-request', `unknown endpoint '${endpoint}'`)
      }
    } catch (e) {
      logger?.warn?.(`tlogs: RPC ${endpoint} 失败：${e instanceof Error ? e.message : String(e)}`)
      return mapError(e)
    }
  }
}
