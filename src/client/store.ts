/**
 * tlogs — 客户端状态管理（快照轮询 + 详细视图懒加载）。
 *
 * 为什么需要轮询：首次全量拉取约 31 个月（需求 3.5 说明约 40 秒），
 * 宿主端因此把刷新放到后台执行并立即返回，客户端靠轮询 `snapshot`
 * 观察 `loading` 与 `progress`，避免 RPC 长时间挂起或阻塞 UI。
 */

import * as React from 'react'
import { callRpc, type Rpc } from './api.js'
// 这里只在事件回调/异步链里拼错误文案（不是渲染路径），直接用模块级 t 即可：
// 错误字符串一旦生成就与当时的语言绑定，这与「界面文案随语言实时变」并不冲突 ——
// 报错是**已经发生过的事实**，不需要（也无法）事后改写。
import { t } from './i18n/index.js'
import {
  RPC,
  type DetailData,
  type MonthDetail,
  type SeriesQuery,
  type UsageSeries,
  type UsageSnapshot,
} from '../types.js'

/** 轮询间隔（毫秒）。 */
const POLL_MS = 800
/** 轮询上限，防止宿主异常时无限轮询（约 4 分钟）。 */
const MAX_POLLS = 300
/**
 * 空闲时重新读取快照的间隔（毫秒）。
 *
 * 比 host 侧的自动刷新间隔（默认 5 分钟）密，这样后台刷新完成后最多 1 分钟
 * 就会反映到界面上；而它只是本地 RPC，开销可忽略。
 */
const IDLE_RELOAD_MS = 60_000

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export interface TlogsStore {
  snapshot: UsageSnapshot | null
  detail: DetailData | null
  /** 日历查询：当前选中年月的逐日明细。 */
  monthDetail: MonthDetail | null
  /** 图表数据（最近一次请求的结果）。 */
  series: UsageSeries | null
  /** 图表数据是否正在请求。 */
  seriesLoading: boolean
  error: string | null
  busy: boolean
  /** 拉取一次快照（不触发刷新）。 */
  reload: () => Promise<UsageSnapshot | null>
  /** 请求刷新；force=true 时绕过缓存 TTL。 */
  refresh: (force: boolean) => Promise<void>
  /** 加载详细视图数据。 */
  loadDetail: () => Promise<void>
  /** 加载指定年月的逐日明细（日历查询）。 */
  loadMonth: (year: number, month: number) => Promise<void>
  /** 加载图表数据（范围 × 项目）。 */
  loadSeries: (query: SeriesQuery) => Promise<void>
  /** 用**上一次的查询**重新加载图表数据（刷新按钮/空闲轮询用）。 */
  reloadSeries: () => Promise<void>
  /** 提交手动输入的 userToken。 */
  setToken: (token: string) => Promise<boolean>
  /** 退出登录。 */
  logout: () => Promise<void>
  /** 打开内置登录窗口（方案 B）。 */
  login: () => Promise<boolean>
}

/**
 * 建立 tlogs 客户端状态。
 *
 * @param reason 首次挂载时的刷新原因（需求 1.5：挂载自动刷新一次）
 */
export function useTlogs(rpc: Rpc | undefined, initialReason: 'mount' | 'expand' = 'mount'): TlogsStore {
  const [snapshot, setSnapshot] = React.useState<UsageSnapshot | null>(null)
  const [detail, setDetail] = React.useState<DetailData | null>(null)
  const [monthDetail, setMonthDetail] = React.useState<MonthDetail | null>(null)
  const [series, setSeries] = React.useState<UsageSeries | null>(null)
  const [seriesLoading, setSeriesLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const alive = React.useRef(true)
  const inflight = React.useRef(false)
  const started = React.useRef(false)
  /** 图表请求的序号：只接受最后一次请求的结果（快速切范围时不会串数据）。 */
  const seriesSeq = React.useRef(0)
  /** 最近一次的图表查询（供「刷新」与空闲轮询重放）。 */
  const lastSeriesQuery = React.useRef<SeriesQuery | null>(null)

  React.useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const reload = React.useCallback(async (): Promise<UsageSnapshot | null> => {
    try {
      const s = await callRpc<UsageSnapshot>(rpc, RPC.snapshot)
      if (alive.current) {
        setSnapshot(s)
        setError(null)
      }
      return s
    } catch (e) {
      if (alive.current) setError(messageOf(e))
      return null
    }
  }, [rpc])

  const refresh = React.useCallback(
    async (force: boolean): Promise<void> => {
      if (inflight.current) return
      inflight.current = true
      if (alive.current) setBusy(true)
      try {
        await callRpc<{ started: boolean }>(rpc, RPC.refresh, { force })
        // 轮询直到宿主报告 loading 结束。
        for (let i = 0; i < MAX_POLLS; i++) {
          const s = await reload()
          if (!alive.current) return
          if (!s?.loading) return
          await delay(POLL_MS)
        }
      } catch (e) {
        if (alive.current) setError(messageOf(e))
      } finally {
        inflight.current = false
        if (alive.current) setBusy(false)
      }
    },
    [rpc, reload],
  )

  // 首次挂载自动刷新一次（需求 1.5）。
  React.useEffect(() => {
    if (started.current) return
    started.current = true
    void refresh(false)
  }, [refresh])

  const loadDetail = React.useCallback(async (): Promise<void> => {
    try {
      const d = await callRpc<DetailData>(rpc, RPC.detail)
      if (alive.current) setDetail(d)
    } catch (e) {
      if (alive.current) setError(messageOf(e))
    }
  }, [rpc])

  const loadMonth = React.useCallback(
    async (year: number, month: number): Promise<void> => {
      try {
        const d = await callRpc<MonthDetail>(rpc, RPC.month, { year, month })
        if (alive.current) setMonthDetail(d)
      } catch (e) {
        if (alive.current) setError(messageOf(e))
      }
    },
    [rpc],
  )

  const loadSeries = React.useCallback(
    async (query: SeriesQuery): Promise<void> => {
      lastSeriesQuery.current = query
      const seq = ++seriesSeq.current
      if (alive.current) setSeriesLoading(true)
      try {
        const s = await callRpc<UsageSeries>(rpc, RPC.series, query)
        // 序号校验：连点范围切换时，先发的请求可能后返回，直接丢弃。
        if (alive.current && seq === seriesSeq.current) {
          setSeries(s)
          setError(null)
        }
      } catch (e) {
        if (alive.current && seq === seriesSeq.current) setError(messageOf(e))
      } finally {
        if (alive.current && seq === seriesSeq.current) setSeriesLoading(false)
      }
    },
    [rpc],
  )

  const reloadSeries = React.useCallback(async (): Promise<void> => {
    const q = lastSeriesQuery.current
    if (!q) return
    await loadSeries(q)
  }, [loadSeries])

  /**
   * 空闲时定期把快照取回来。
   *
   * host 侧每 `autoRefreshSeconds`（默认 5 分钟）自动刷新一次，但那只是更新 host
   * 内存里的数据；客户端不主动取就看不到新数字。这里每 60 秒拉一次 snapshot ——
   * 一次**本地** RPC，不产生任何外部请求（TTL 与账号凭据探测都另有缓存）。
   *
   * 放在 `reloadSeries` 之后定义：effect 里要用到它（在它之前引用会触发 TDZ）。
   */
  React.useEffect(() => {
    const timer = setInterval(() => {
      void reload()
      // 图表数据也一起刷新：弹窗可能开着很久，图不该一直停在旧数字上。
      // 没打开过图表页时 lastSeriesQuery 为空，这里是 no-op。
      void reloadSeries()
    }, IDLE_RELOAD_MS)
    return () => clearInterval(timer)
  }, [reload, reloadSeries])

  const setToken = React.useCallback(
    async (token: string): Promise<boolean> => {
      try {
        const r = await callRpc<{ ok: boolean; error?: string }>(rpc, RPC.setToken, { token })
        if (r.ok) await refresh(true)
        else if (alive.current) setError(r.error ?? t('error.saveFailed'))
        return r.ok
      } catch (e) {
        if (alive.current) setError(messageOf(e))
        return false
      }
    },
    [rpc, refresh],
  )

  const logout = React.useCallback(async (): Promise<void> => {
    try {
      await callRpc<{ ok: boolean }>(rpc, RPC.logout)
      if (alive.current) {
        setDetail(null)
        setSeries(null)
        lastSeriesQuery.current = null
        await reload()
      }
    } catch (e) {
      if (alive.current) setError(messageOf(e))
    }
  }, [rpc, reload])

  const login = React.useCallback(async (): Promise<boolean> => {
    try {
      const r = await callRpc<{ ok: boolean; error?: string }>(rpc, RPC.login)
      if (r.ok) await refresh(true)
      else if (alive.current) setError(r.error ?? t('error.loginFailed'))
      return r.ok
    } catch (e) {
      if (alive.current) setError(messageOf(e))
      return false
    }
  }, [rpc, refresh])

  void initialReason
  return {
    snapshot,
    detail,
    monthDetail,
    series,
    seriesLoading,
    error,
    busy,
    reload,
    refresh,
    loadDetail,
    loadMonth,
    loadSeries,
    reloadSeries,
    setToken,
    logout,
    login,
  }
}
