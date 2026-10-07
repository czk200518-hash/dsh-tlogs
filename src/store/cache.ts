/**
 * tlogs — 缓存管理。
 *
 * 对应需求 1.5「数据刷新」与 5.4「错误处理」：
 *  - 总消耗缓存 30 分钟，今日/当周/当月缓存 5 分钟
 *  - 紧凑条数字只读缓存，不主动触发请求
 *  - 网络失败时用过期缓存兜底，并标记「数据可能过期」
 *  - 手动刷新强制绕过 TTL
 *
 * 缓存是纯内存 + 可注入时钟的实现，便于单元测试；持久化由 store/history.ts
 * 负责（它只持久化历史月数据，不持久化 token）。
 */

import type { UsageScope } from '../types.js'

/** 缓存 TTL（毫秒），对应需求 1.5。 */
export const CACHE_TTL = {
  /** 总消耗：30 分钟。 */
  total: 30 * 60 * 1000,
  /** 今日 / 当周 / 当月：5 分钟。 */
  current: 5 * 60 * 1000,
} as const

/** 取某个 scope 的 TTL。total 用长 TTL，其余用短 TTL。 */
export function ttlForScope(scope: UsageScope): number {
  return scope === 'total' ? CACHE_TTL.total : CACHE_TTL.current
}

/** 一条缓存记录。 */
export interface CacheRecord<T> {
  value: T
  /** 写入时刻（ms epoch）。 */
  storedAt: number
}

/** 读取结果：`stale` 表示命中了但已超过 TTL。 */
export interface CacheRead<T> {
  value: T
  storedAt: number
  age: number
  stale: boolean
}

/**
 * 极简 TTL 缓存。键为字符串，值为任意可序列化数据。
 *
 * 与需求「紧凑条上的数字使用缓存值，不主动触发请求」配合：组件读取时用
 * `peek()`，它永远不发请求；只有显式 `refresh` 才会走网络。
 */
export class TtlCache<V = unknown> {
  private readonly store = new Map<string, CacheRecord<V>>()
  private readonly now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
  }

  /**
   * 读取缓存。不存在返回 undefined。
   * @param ttlMs 用于判定 stale；传 0 表示任何记录都视为 stale（仅用于兜底读取）。
   */
  read(key: string, ttlMs: number): CacheRead<V> | undefined {
    const rec = this.store.get(key)
    if (!rec) return undefined
    const age = this.now() - rec.storedAt
    return { value: rec.value, storedAt: rec.storedAt, age, stale: age > ttlMs }
  }

  /** 只读快照，不判定新鲜度，供紧凑条使用。 */
  peek(key: string): CacheRecord<V> | undefined {
    return this.store.get(key)
  }

  /** 写入缓存。 */
  write(key: string, value: V): CacheRecord<V> {
    const rec: CacheRecord<V> = { value, storedAt: this.now() }
    this.store.set(key, rec)
    return rec
  }

  /** 是否命中且新鲜。 */
  isFresh(key: string, ttlMs: number): boolean {
    const r = this.read(key, ttlMs)
    return r !== undefined && !r.stale
  }

  /** 删除单键。 */
  delete(key: string): boolean {
    return this.store.delete(key)
  }

  /** 清空全部缓存（退出登录时调用，避免残留他人数据）。 */
  clear(): void {
    this.store.clear()
  }

  /** 键数量（测试与诊断用）。 */
  get size(): number {
    return this.store.size
  }
}

/** `getOrLoad` 的结果。 */
export interface LoadResult<V> {
  value: V
  /** 本次是否真的发起了加载。 */
  loaded: boolean
  /** 是否用了过期缓存兜底。 */
  stale: boolean
  /** 加载失败时的错误（此时 value 可能来自过期缓存）。 */
  error?: unknown
}

/**
 * 缓存优先加载：
 *  1. 命中且新鲜 → 直接返回，不发请求
 *  2. 命中但过期 / 未命中 → 调用 loader
 *  3. loader 抛错 → 若有（过期）缓存则返回缓存并标记 stale，否则抛出
 *
 * `force = true` 时跳过步骤 1，对应「手动点击刷新按钮强制刷新」。
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
      // 需求 5.4：网络请求失败时使用缓存数据。
      return { value: previous.value, loaded: true, stale: true, error }
    }
    throw error
  }
}
