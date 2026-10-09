/**
 * tlogs — 凭据适配器：把 DSH 的 credentials seam 包装成本插件用的 SecretStore。
 *
 * seam 的方法签名：`resolve(ref) -> { value, source } | undefined`（缺失返回 undefined，不抛）、
 * `set(ref, value)`（value 为空串会抛）、`unset(ref)`（缺失时 no-op）。ref 语法是扁平的
 * `/^[A-Za-z_][A-Za-z0-9_]*$/`（与 POSIX 环境变量同名空间），冒号不被允许，所以本插件用
 * `TLOGS_USER_TOKEN`。
 *
 * 安全：这里从不打印、也不返回 token 到日志；`resolve` 失败一律降级为 undefined。
 */

import type { Logger } from '../service.js'
import { MemorySecretStore, type SecretStore } from './token-manager.js'

/** 凭据 ref（扁平命名，符合 credentials seam 的校验规则）。 */
export const TLOGS_TOKEN_REF = 'TLOGS_USER_TOKEN'

/** 候选 ref 列表，本插件自己的排在最前。 */
export const CANDIDATE_TOKEN_REFS = [
  TLOGS_TOKEN_REF,
  'DEEPSEEK_PLATFORM_USER_TOKEN',
  'DEEPSEEK_USER_TOKEN',
  'PLATFORM_USER_TOKEN',
] as const

/** 最小 credentials 服务接口。 */
export interface CredentialsLike {
  resolve?: (ref: string) => Promise<{ value?: string } | undefined> | { value?: string } | undefined
  set?: (ref: string, value: string) => Promise<void> | void
  unset?: (ref: string) => Promise<void> | void
  describe?: (ref: string) => Promise<unknown> | unknown
}

/**
 * 构造凭据存储。宿主未提供 credentials 服务时（例如极简 profile）降级为内存存储：
 * token 仍可用，但重启后需要重新填写，降级会写一条 warn 日志。
 */
export function createCredentialStore(
  getCredentials: () => CredentialsLike | undefined,
  logger?: Logger,
): SecretStore {
  const fallback = new MemorySecretStore()
  let warned = false

  const creds = (): CredentialsLike | undefined => {
    const c = getCredentials()
    if (!c || typeof c.resolve !== 'function') {
      if (!warned) {
        warned = true
        logger?.warn?.(
          'tlogs: 未检测到 credentials 服务，userToken 将只保存在内存中（重启后需重新填写）',
        )
      }
      return undefined
    }
    return c
  }

  return {
    async get(key: string): Promise<string | undefined> {
      const c = creds()
      if (!c) return fallback.get(key)
      try {
        const r = await c.resolve?.(key)
        const v = r?.value
        return typeof v === 'string' ? v : undefined
      } catch {
        // 凭据文件损坏、权限不足等情况不应让插件崩溃。
        return undefined
      }
    },

    async set(key: string, value: string): Promise<void> {
      const c = creds()
      if (!c) {
        fallback.set(key, value)
        return
      }
      try {
        await c.set?.(key, value)
      } catch (e) {
        // 典型原因：启动环境里存在同名环境变量（seam 拒绝覆盖），或 value 为空串。
        logger?.warn?.(`tlogs: 写入凭据失败（${e instanceof Error ? e.message : String(e)}），改为内存保存`)
        fallback.set(key, value)
      }
    },

    async delete(key: string): Promise<void> {
      const c = creds()
      fallback.delete(key)
      if (!c) return
      try {
        await c.unset?.(key)
      } catch (e) {
        logger?.warn?.(`tlogs: 清除凭据失败：${e instanceof Error ? e.message : String(e)}`)
      }
    },
  }
}
