/**
 * tlogs 两半侧共用的类型与常量：字段名与平台接口、本机会话投影的口径直接对应，不要在两端各起一套名字。
 */
/** 五种计量项，顺序与平台接口一致。 */
export const TOKEN_TYPES = [
    'PROMPT_TOKEN',
    'PROMPT_CACHE_HIT_TOKEN',
    'PROMPT_CACHE_MISS_TOKEN',
    'RESPONSE_TOKEN',
    'REQUEST',
];
export function emptyMoney() {
    return {
        PROMPT_TOKEN: 0,
        PROMPT_CACHE_HIT_TOKEN: 0,
        PROMPT_CACHE_MISS_TOKEN: 0,
        RESPONSE_TOKEN: 0,
        REQUEST: 0,
    };
}
/** 五类金额之和（元）。 */
export function moneyTotal(m) {
    if (!m)
        return 0;
    let s = 0;
    for (const t of TOKEN_TYPES)
        s += m[t];
    return s;
}
const TOKEN_TYPE_SET = new Set(TOKEN_TYPES);
/** 是否为已知计量项；未知 type 既不进合计也不进按模型明细。 */
export function isTokenType(t) {
    return typeof t === 'string' && TOKEN_TYPE_SET.has(t);
}
/** 空 Stat。调用方每次都要拿到新对象，不要共享实例。 */
export function emptyStat() {
    return {
        PROMPT_TOKEN: 0,
        PROMPT_CACHE_HIT_TOKEN: 0,
        PROMPT_CACHE_MISS_TOKEN: 0,
        RESPONSE_TOKEN: 0,
        REQUEST: 0,
    };
}
export const COMPACT_METRICS = [
    'total',
    'today',
    'week',
    'month',
    'last7',
    'last30',
    'cost_total',
    'cost_today',
    'cost_last7',
    'cost_last30',
];
/** 滚动窗口的天数（`last7` / `last30`）。 */
export const ROLLING_DAYS = {
    last7: 7,
    last30: 30,
};
/** host 端 RPC 频道名。 */
export const TLOGS_CHANNEL = '/tlogs';
/** RPC 端点名。 */
export const RPC = {
    snapshot: 'tlogs.snapshot',
    refresh: 'tlogs.refresh',
    detail: 'tlogs.detail',
    /** 指定年月的明细（日历查询）。 */
    month: 'tlogs.month',
    /** 图表数据（范围 × 项目 × 指标，见 UsageSeries）。 */
    series: 'tlogs.series',
    login: 'tlogs.login',
    setToken: 'tlogs.setToken',
    logout: 'tlogs.logout',
    export: 'tlogs.export',
};
//# sourceMappingURL=types.js.map