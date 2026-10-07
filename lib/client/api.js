/**
 * tlogs — 客户端 RPC 封装。
 *
 * 通道约定与 workspace-mover 一致（已在 0.2.0-rc.2 实测可用）：
 *   客户端：`ctx.connection.rpc.call(CHANNEL, endpoint, payload)`
 *   宿主端：`connection.rpc.handle(CHANNEL, handler, { authority: 'loopback' })`
 *
 * 信封形状与 DSH 的 rpcErrorSchema 兼容：
 *   成功 `{ ok: true, value }`，失败 `{ ok: false, error: { code, message, details } }`
 */
import { TLOGS_CHANNEL } from '../types.js';
/** 从客户端 ctx 构造 RPC 句柄。缺失连接能力时返回 undefined。 */
export function makeRpc(ctx) {
    const call = ctx?.connection?.rpc?.call;
    if (typeof call !== 'function')
        return undefined;
    return {
        call: (endpoint, payload) => call(TLOGS_CHANNEL, endpoint, payload ?? {}),
    };
}
/** 调用并解开信封；失败时抛出带 `code` 的 Error。 */
export async function callRpc(rpc, endpoint, payload) {
    if (!rpc) {
        const err = new Error('tlogs: 当前连接不支持 RPC（缺少 connection 服务）');
        err.code = 'no-connection';
        throw err;
    }
    const res = (await rpc.call(endpoint, payload ?? {}));
    if (!res?.ok) {
        const err = new Error(res?.error?.message ?? `tlogs: ${endpoint} 调用失败`);
        err.code = res?.error?.code;
        throw err;
    }
    return res.value;
}
//# sourceMappingURL=api.js.map