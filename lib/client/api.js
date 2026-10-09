/**
 * tlogs — client-side RPC wrapper. The client calls `ctx.connection.rpc.call(CHANNEL, endpoint,
 * payload)`; the host registers handlers with `connection.rpc.handle(...)`. Envelopes match DSH's
 * rpcErrorSchema: `{ ok: true, value }` on success, `{ ok: false, error }` on failure.
 */
import { TLOGS_CHANNEL } from '../types.js';
import { t } from './i18n/index.js';
/** Bind an RPC handle to the tlogs channel; undefined when ctx has no connection. */
export function makeRpc(ctx) {
    const call = ctx?.connection?.rpc?.call;
    if (typeof call !== 'function')
        return undefined;
    return {
        call: (endpoint, payload) => call(TLOGS_CHANNEL, endpoint, payload ?? {}),
    };
}
/** Call an endpoint and unwrap the envelope; a failed envelope throws an Error carrying `code`. */
export async function callRpc(rpc, endpoint, payload) {
    if (!rpc) {
        const err = new Error(t('error.noConnection'));
        err.code = 'no-connection';
        throw err;
    }
    const res = (await rpc.call(endpoint, payload ?? {}));
    if (!res?.ok) {
        const err = new Error(res?.error?.message ?? t('error.rpcFailed', { endpoint }));
        err.code = res?.error?.code;
        throw err;
    }
    return res.value;
}
//# sourceMappingURL=api.js.map