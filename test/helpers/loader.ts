/**
 * 测试辅助：加载已构建的客户端 bundle。
 *
 * 复刻 DSH 浏览器侧的真实加载约定：
 *   - 外壳注入 `window.__ModuleLoader__`
 *   - bundle 的**模块体**只调用一次 `load({ id, factory })`，仅注册 factory
 *   - 之后每次「物化」才执行 `factory(require)`，require 只能解析平台种子表
 *
 * 这一点很重要：Node 对 ESM 模块体只执行一次，所以这里也把「注册」缓存起来，
 * 每次调用只重新物化 factory —— 与真实模块系统的语义完全一致。
 *
 * 由此可以断言两件关键事实：
 *  1. bundle 注册的 id 必须等于包名（否则 DSH 会报 "loaded without registering <id>"）
 *  2. bundle 是自包含的：除 `react` 外不得 require 任何模块
 */

import { createRequire } from 'node:module'
import * as React from 'react'

/** 必须与 package.json 的 name 一致。 */
export const PKG_NAME = 'dsh-tlogs'

interface BundleDef {
  id?: string
  factory?: (require: (spec: string) => unknown) => unknown
}

export interface LoadedClient {
  id: string
  inject: unknown
  apply: (ctx: unknown) => void
  /** 本次物化中 factory 实际发生过的 require 请求，用于断言自包含性。 */
  requiredSpecs: string[]
}

/** 已注册的 bundle 定义（模块体只执行一次）。 */
let registered: BundleDef | undefined

/** 执行 bundle 模块体一次，捕获它注册的 factory。 */
function registerBundleOnce(): BundleDef {
  if (registered) return registered

  const req = createRequire(import.meta.url)
  const g = globalThis as unknown as Record<string, unknown>

  let captured: BundleDef | undefined
  const previousWindow = g.window

  g.window = {
    ...((previousWindow as Record<string, unknown>) ?? {}),
    __ModuleLoader__: {
      load: (def: BundleDef) => {
        captured = def
      },
    },
  }

  try {
    req('../../lib/client.js')
  } finally {
    if (previousWindow === undefined) delete g.window
    else g.window = previousWindow
  }

  if (!captured) throw new Error('bundle 没有调用 window.__ModuleLoader__.load')
  const def = captured as BundleDef
  if (typeof def.factory !== 'function') throw new Error('bundle 没有提供 factory')
  registered = def
  return def
}

/** 物化 factory，得到 `{ inject, apply }`。 */
export function loadClientBundle(): LoadedClient {
  const def = registerBundleOnce()

  const requiredSpecs: string[] = []
  const seed: Record<string, unknown> = { react: React }

  const exports = def.factory!((spec: string) => {
    requiredSpecs.push(spec)
    if (spec in seed) return seed[spec]
    throw new Error(`bundle require 了平台种子表之外的模块：${spec}（客户端 bundle 必须自包含）`)
  }) as { inject?: unknown; apply?: (ctx: unknown) => void }

  if (typeof exports.apply !== 'function') throw new Error('bundle 未导出 apply')

  return { id: def.id ?? '', inject: exports.inject, apply: exports.apply, requiredSpecs }
}

/** 仅供测试隔离：清掉已注册的 bundle。 */
export function resetBundleRegistration(): void {
  registered = undefined
}
