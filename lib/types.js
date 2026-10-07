/**
 * tlogs — 共享类型定义（host / client 两端复用）。
 *
 * 本文件的字段名与语义直接对应工作区权威参考实现
 * `deepseek_python_20261007_a1f087.py` 中的 `TOKEN_TYPES` / `empty_stat()`，
 * 不做任何重命名，以便与 Python 输出逐字段对拍。
 */
/** 五种计量项，顺序与 Python 的 TOKEN_TYPES 完全一致。 */
export const TOKEN_TYPES = [
    'PROMPT_TOKEN',
    'PROMPT_CACHE_HIT_TOKEN',
    'PROMPT_CACHE_MISS_TOKEN',
    'RESPONSE_TOKEN',
    'REQUEST',
];
/** Stat 的运行时键集合，供 `t in agg` 这类成员检查使用。 */
const TOKEN_TYPE_SET = new Set(TOKEN_TYPES);
/** 判断任意字符串是否为已知计量项（等价于 Python 的 `t in agg`）。 */
export function isTokenType(t) {
    return typeof t === 'string' && TOKEN_TYPE_SET.has(t);
}
/**
 * 空 Stat。必须逐次返回新对象，语义等价于 Python 每次调用 `empty_stat()`。
 */
export function emptyStat() {
    return {
        PROMPT_TOKEN: 0,
        PROMPT_CACHE_HIT_TOKEN: 0,
        PROMPT_CACHE_MISS_TOKEN: 0,
        RESPONSE_TOKEN: 0,
        REQUEST: 0,
    };
}
/** host 端 RPC 频道名。 */
export const TLOGS_CHANNEL = '/tlogs';
/** RPC 端点名。 */
export const RPC = {
    snapshot: 'tlogs.snapshot',
    refresh: 'tlogs.refresh',
    detail: 'tlogs.detail',
    login: 'tlogs.login',
    setToken: 'tlogs.setToken',
    logout: 'tlogs.logout',
    export: 'tlogs.export',
};
//# sourceMappingURL=types.js.map