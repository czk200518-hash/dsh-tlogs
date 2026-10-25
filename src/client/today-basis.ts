/**
 * tlogs — 自然日历卡的日界偏好：平台日（UTC，北京 08:00 换日）或本机日（本机 0 点换日）。
 * 影响今日 / 当周 / 当月这三张卡。
 *
 * 与界面语言同一套做法：存 localStorage、即时生效、重启保持，host 不参与决策 —— 客户端每次
 * 取快照时把口径带上去（`snapshot` / `balanceWatch` 的 `todayBasis`），换口径只需再取一次快照。
 *
 * 默认平台日，也就是这个开关出现之前的行为：那几张卡含别的设备、带金额，但跨过 08:00（以及
 * 周一 08:00 / 1 日 08:00）会重新开始 —— 平台账单只有 UTC 日粒度，切不到本机 0 点。本机日只
 * 统计本机日志，换来的是本机 0 点换日。
 */

import * as React from 'react'
import type { TodayBasis } from '../types.js'

/** localStorage 键，带插件前缀避免撞车。 */
export const TODAY_BASIS_STORAGE_KEY = 'tlogs.todayBasis'

/** 设置页里的两个选项，按显示顺序。 */
export const TODAY_BASES: readonly TodayBasis[] = ['platform', 'local']

let basis: TodayBasis = read()
const listeners = new Set<() => void>()

function read(): TodayBasis {
  try {
    const raw = globalThis.localStorage?.getItem(TODAY_BASIS_STORAGE_KEY)
    if (raw === 'platform' || raw === 'local') return raw
  } catch {
    // 隐私模式 / 存储被禁用：保持内存里的值，不抛。
  }
  return 'platform'
}

export function getTodayBasis(): TodayBasis {
  return basis
}

/** 切换口径：持久化后通知订阅者，由它们重新取快照。 */
export function setTodayBasis(next: TodayBasis): void {
  if (next === basis) return
  basis = next
  try {
    globalThis.localStorage?.setItem(TODAY_BASIS_STORAGE_KEY, next)
  } catch {
    // 同上：写失败不影响本次会话内切换。
  }
  for (const fn of [...listeners]) fn()
}

export function subscribeTodayBasis(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useTodayBasis(): { basis: TodayBasis; setBasis: (next: TodayBasis) => void } {
  const [current, setCurrent] = React.useState<TodayBasis>(basis)
  React.useEffect(() => {
    const sync = () => setCurrent(basis)
    sync()
    return subscribeTodayBasis(sync)
  }, [])
  return { basis: current, setBasis: setTodayBasis }
}
