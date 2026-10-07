/**
 * tlogs — 凭据适配器：把 DSH 的 credentials seam 包装成本插件用的 SecretStore。
 *
 * 实测（0.2.0-rc.2，dsh-credentials-local）确认的方法签名：
 *   ctx.credentials.resolve(ref) -> Promise<{ value, source } | undefined>   // 缺失返回 undefined，不抛
 *   ctx.credentials.set(ref, value) -> Promise<void>                          // value 为空串会抛
 *   ctx.credentials.unset(ref) -> Promise<void>                              // 缺失时 no-op
 *
 * 重要：ref 语法是**扁平**的 `/^[A-Za-z_][A-Za-z0-9_]*$/`（与 POSIX 环境变量同名空间），
 * 因此需求文档里写的 `tlogs:userToken` 是**非法**的（冒号不被允许）。
 * 本插件使用 `TLOGS_USER_TOKEN`。
 *
 * 安全：这里从不打印/返回 token 到日志；`resolve` 失败一律降级为 undefined。
 */
import { MemorySecretStore } from './token-manager.js';
/** 凭据 ref（扁平命名，符合 credentials seam 的校验规则）。 */
export const TLOGS_TOKEN_REF = 'TLOGS_USER_TOKEN';
/** 候选 ref 列表：用于方案 A 从桌面端已有认证状态里探测 token。 */
export const CANDIDATE_TOKEN_REFS = [
    TLOGS_TOKEN_REF,
    'DEEPSEEK_PLATFORM_USER_TOKEN',
    'DEEPSEEK_USER_TOKEN',
    'PLATFORM_USER_TOKEN',
];
/**
 * 构造凭据存储。
 *
 * 若宿主未提供 credentials 服务（例如极简 profile），降级为内存存储：
 * token 仍可使用，但重启后需要重新填写。降级会写一条 warn 日志。
 */
export function createCredentialStore(getCredentials, logger) {
    const fallback = new MemorySecretStore();
    let warned = false;
    const creds = () => {
        const c = getCredentials();
        if (!c || typeof c.resolve !== 'function') {
            if (!warned) {
                warned = true;
                logger?.warn?.('tlogs: 未检测到 credentials 服务，userToken 将只保存在内存中（重启后需重新填写）');
            }
            return undefined;
        }
        return c;
    };
    return {
        async get(key) {
            const c = creds();
            if (!c)
                return fallback.get(key);
            try {
                const r = await c.resolve?.(key);
                const v = r?.value;
                return typeof v === 'string' ? v : undefined;
            }
            catch {
                // 凭据文件损坏/权限不足等情况不应让插件崩溃。
                return undefined;
            }
        },
        async set(key, value) {
            const c = creds();
            if (!c) {
                fallback.set(key, value);
                return;
            }
            try {
                await c.set?.(key, value);
            }
            catch (e) {
                // 典型原因：启动环境里存在同名环境变量（seam 会拒绝覆盖），或 value 为空串。
                logger?.warn?.(`tlogs: 写入凭据失败（${e instanceof Error ? e.message : String(e)}），改为内存保存`);
                fallback.set(key, value);
            }
        },
        async delete(key) {
            const c = creds();
            fallback.delete(key);
            if (!c)
                return;
            try {
                await c.unset?.(key);
            }
            catch (e) {
                logger?.warn?.(`tlogs: 清除凭据失败：${e instanceof Error ? e.message : String(e)}`);
            }
        },
    };
}
//# sourceMappingURL=credentials-store.js.map