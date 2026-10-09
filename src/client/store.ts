/**
 * tlogs — client state (snapshot polling + lazy detail loading). The first full fetch walks about
 * 31 months, so the host refreshes in the background and returns immediately; the client polls
 * `snapshot` to watch `loading` / `progress` instead of holding one long RPC open.
 */

import * as React from 'react'
import { callRpc, type Rpc } from './api.js'
// Errors are assembled in event handlers and async chains, never during render, so the module-level
// `t` is fine here: a failure is a fact that already happened, tied to the language it was made in.
import { t } from './i18n/index.js'
import {
  RPC,
  type DetailData,
  type MonthDetail,
  type SeriesQuery,
  type UsageSeries,
  type UsageSnapshot,
} from '../types.js'

const POLL_MS = 800
/** Poll ceiling, so a stuck host cannot be polled forever (about four minutes). */
const MAX_POLLS = 300
/**
 * How often the snapshot is re-read while idle (ms). Denser than the host's own auto-refresh (5
 * minutes by default), so a background refresh shows up within a minute; it is a local RPC and
 * costs nothing externally.
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
  /** Daily detail of the month currently selected in the calendar. */
  monthDetail: MonthDetail | null
  series: UsageSeries | null
  seriesLoading: boolean
  error: string | null
  busy: boolean
  /** Read the snapshot without asking the host to refresh. */
  reload: () => Promise<UsageSnapshot | null>
  /** Ask for a refresh; `force` bypasses the cache TTL. */
  refresh: (force: boolean) => Promise<void>
  loadDetail: () => Promise<void>
  loadMonth: (year: number, month: number) => Promise<void>
  loadSeries: (query: SeriesQuery) => Promise<void>
  /** Replay the last chart query (refresh button, idle polling). */
  reloadSeries: () => Promise<void>
  setToken: (token: string) => Promise<boolean>
  logout: () => Promise<void>
  login: () => Promise<boolean>
}

/**
 * Build the tlogs client state. `initialReason` is part of the caller's contract but does not
 * change behaviour: mounting always triggers exactly one refresh.
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
  /** Sequence of chart requests; only the newest result is accepted, so fast range switches cannot mix data. */
  const seriesSeq = React.useRef(0)
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
        // Poll until the host reports that loading finished.
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
        // Sequence check: when ranges are clicked in quick succession an earlier
        // request can land last, and its result has to be dropped.
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
   * Re-read the snapshot periodically while idle: the host auto-refreshes every `autoRefreshSeconds`
   * (5 minutes by default), but that only updates its in-memory data, so without a read the client
   * keeps showing the old numbers. A local RPC that makes no external request (TTL and credential
   * probing are cached separately).
   *
   * Defined after `reloadSeries` because the effect uses it; earlier would hit the temporal dead zone.
   */
  React.useEffect(() => {
    const timer = setInterval(() => {
      void reload()
      // Refresh the chart too: the modal can stay open for a long time and the
      // curves should not sit on stale numbers. No-op until a chart was opened.
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
