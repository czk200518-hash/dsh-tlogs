/**
 * tlogs — 客户端状态管理（快照轮询 + 详细视图懒加载）。
 *
 * 为什么需要轮询：首次全量拉取约 31 个月（需求 3.5 说明约 40 秒），
 * 宿主端因此把刷新放到后台执行并立即返回，客户端靠轮询 `snapshot`
 * 观察 `loading` 与 `progress`，避免 RPC 长时间挂起或阻塞 UI。
 */

import * as React from 'react'
import { callRpc, type Rpc } from './api.js'
import { RPC, type DetailData, type UsageSnapshot } from '../types.js'

/** 轮询间隔（毫秒）。 */
const POLL_MS = 800
/** 轮询上限，防止宿主异常时无限轮询（约 4 分钟）。 */
const MAX_POLLS = 300

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export interface TlogsStore {
  snapshot: UsageSnapshot | null
  detail: DetailData | null
  error: string | null
  busy: boolean
  /** 拉取一次快照（不触发刷新）。 */
  reload: () => Promise<UsageSnapshot | null>
  /** 请求刷新；force=true 时绕过缓存 TTL。 */
  refresh: (force: boolean) => Promise<void>
  /** 加载详细视图数据。 */
  loadDetail: () => Promise<void>
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
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const alive = React.useRef(true)
  const inflight = React.useRef(false)
  const started = React.useRef(false)

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

  const setToken = React.useCallback(
    async (token: string): Promise<boolean> => {
      try {
        const r = await callRpc<{ ok: boolean; error?: string }>(rpc, RPC.setToken, { token })
        if (r.ok) await refresh(true)
        else if (alive.current) setError(r.error ?? '保存失败')
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
      else if (alive.current) setError(r.error ?? '登录失败')
      return r.ok
    } catch (e) {
      if (alive.current) setError(messageOf(e))
      return false
    }
  }, [rpc, refresh])

  void initialReason
  return { snapshot, detail, error, busy, reload, refresh, loadDetail, setToken, logout, login }
}
