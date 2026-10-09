/**
 * tlogs — 内存 TTL 缓存。
 *
 * 总消耗缓存 30 分钟，今日/当周/当月 5 分钟；紧凑条上的数字只读缓存、不主动发请求；网络失败
 * 时用过期缓存兜底并标记「数据可能过期」；手动刷新绕过 TTL。时钟可注入，便于测试。这里不落盘
 * —— 只有历史月数据会落盘（见 `store/history.ts`）。
 */

import type { UsageScope } from '../types.js'

/** 缓存 TTL（毫秒）：总消耗 30 分钟，今日 / 当周 / 当月 5 分钟。 */
export const CACHE_TTL = {
  total: 30 * 60 * 1000,
  current: 5 * 60 * 1000,
} as const

/** TTL 缓存：`total` 用长 TTL，其余（窗口类）用短 TTL。 */
export function ttlForScope(scope: UsageScope): number {
  return scope === 'total' ? CACHE_TTL.total : CACHE_TTL.current
}

export interface CacheRecord<T> {
  value: T
  /** 写入时刻（ms epoch）。 */
  storedAt: number
}

/** `stale` 表示命中了但已超过 TTL。 */
export interface CacheRead<T> {
  value: T
  storedAt: number
  age: number
  stale: boolean
}

/**
 * 极简 TTL 缓存，键为字符串。与「紧凑条只显示缓存值、不触发请求」配合：组件读数字走
 * `peek()`，它不发请求，只有显式 refresh 才会走网络。
 */
export class TtlCache<V = unknown> {
  private readonly store = new Map<string, CacheRecord<V>>()
  private readonly now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  /**
   * 读取缓存，不存在返回 undefined。`ttlMs` 只用于判定 stale；传 0 表示任何记录都算 stale，
   * 用于兜底读取。
   */
  read(key: string, ttlMs: number): CacheRead<V> | undefined {
    const rec = this.store.get(key)
    if (!rec) return undefined
    const age = this.now() - rec.storedAt
    return { value: rec.value, storedAt: rec.storedAt, age, stale: age > ttlMs }
  }

  /** 只读快照，不判定新鲜度。 */
  peek(key: string): CacheRecord<V> | undefined {
    return this.store.get(key)
  }

  write(key: string, value: V): CacheRecord<V> {
    const rec: CacheRecord<V> = { value, storedAt: this.now() }
    this.store.set(key, rec)
    return rec
  }

  isFresh(key: string, ttlMs: number): boolean {
    const r = this.read(key, ttlMs)
    return r !== undefined && !r.stale
  }

  delete(key: string): boolean {
    return this.store.delete(key)
  }

  /** 退出登录时调用，避免把上一个人的数据留在进程里。 */
  clear(): void {
    this.store.clear()
  }

  /** 测试与诊断用。 */
  get size(): number {
    return this.store.size
  }
}

/** `getOrLoad` 的结果。 */
export interface LoadResult<V> {
  value: V
  /** 本次是否真的调用了 loader。 */
  loaded: boolean
  /** 是否用了过期缓存兜底。 */
  stale: boolean
  /** 加载失败时的错误（此时 value 可能来自过期缓存）。 */
  error?: unknown
}

/**
 * 缓存优先加载：命中且新鲜就直接返回；否则调用 loader；loader 抛错时有（过期）缓存就用缓存并
 * 标记 stale，没有则把错误抛出去。`force` 跳过第一步，对应手动点击刷新。
 */
export async function getOrLoad<V>(
  cache: TtlCache<V>,
  key: string,
  ttlMs: number,
  loader: () => Promise<V>,
  opts: { force?: boolean } = {},
): Promise<LoadResult<V>> {
  if (!opts.force) {
    const hit = cache.read(key, ttlMs)
    if (hit && !hit.stale) {
      return { value: hit.value, loaded: false, stale: false }
    }
  }

  const previous = cache.peek(key)
  try {
    const value = await loader()
    cache.write(key, value)
    return { value, loaded: true, stale: false }
  } catch (error) {
    if (previous) {
      return { value: previous.value, loaded: true, stale: true, error }
    }
    throw error
  }
}
