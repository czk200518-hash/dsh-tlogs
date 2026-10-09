/**
 * tlogs — client-side RPC wrapper. The client calls `ctx.connection.rpc.call(CHANNEL, endpoint,
 * payload)`; the host registers handlers with `connection.rpc.handle(...)`. Envelopes match DSH's
 * rpcErrorSchema: `{ ok: true, value }` on success, `{ ok: false, error }` on failure.
 */

import { TLOGS_CHANNEL } from '../types.js'
import { t } from './i18n/index.js'

/** Carries the host's error code so callers can branch on it. */
export interface RpcFailure extends Error {
  code?: string
}

export interface Rpc {
  call(endpoint: string, payload?: unknown): Promise<unknown>
}

/** Bind an RPC handle to the tlogs channel; undefined when ctx has no connection. */
export function makeRpc(ctx: {
  connection?: { rpc?: { call?: (channel: string, endpoint: string, payload: unknown) => Promise<unknown> } }
}): Rpc | undefined {
  const call = ctx?.connection?.rpc?.call
  if (typeof call !== 'function') return undefined
  return {
    call: (endpoint: string, payload?: unknown) => call(TLOGS_CHANNEL, endpoint, payload ?? {}),
  }
}

/** Call an endpoint and unwrap the envelope; a failed envelope throws an Error carrying `code`. */
export async function callRpc<T>(rpc: Rpc | undefined, endpoint: string, payload?: unknown): Promise<T> {
  if (!rpc) {
    const err = new Error(t('error.noConnection')) as RpcFailure
    err.code = 'no-connection'
    throw err
  }
  const res = (await rpc.call(endpoint, payload ?? {})) as
    | { ok: true; value: T }
    | { ok: false; error?: { code?: string; message?: string } }
    | undefined

  if (!res?.ok) {
    const err = new Error(res?.error?.message ?? t('error.rpcFailed', { endpoint })) as RpcFailure
    err.code = res?.error?.code
    throw err
  }
  return res.value
}
