/**
 * tlogs — 插件配置的解析与默认值。
 *
 * 对应需求第六章「配置」。配置通过 profile 的 cordis.patch.yml 注入，
 * 因此这里对每个字段都做防御式归一化：用户手写 YAML 时很容易写出
 * 越界值或错类型，插件必须能带着合理默认值继续工作。
 */
import { CACHE_TTL } from './store/cache.js';
/** 合法的 scope 值集合。 */
const SCOPES = ['total', 'today', 'week', 'month'];
/** 把任意输入夹到整数区间内。 */
function clampInt(v, min, max, fallback) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n))
        return fallback;
    const i = Math.trunc(n);
    if (i < min)
        return min;
    if (i > max)
        return max;
    return i;
}
/** 默认缓存目录：`$TLOGS_CACHE_DIR` 优先，否则 `<DSH_HOME>/tlogs`。 */
export function defaultCacheDir(env = (n) => process.env[n]) {
    const explicit = env('TLOGS_CACHE_DIR');
    if (explicit && explicit.trim().length > 0)
        return explicit.trim();
    const home = env('DSH_HOME');
    const base = home && home.trim().length > 0 ? home.trim() : '.';
    return `${base.replace(/[\\/]+$/, '')}/tlogs`;
}
/**
 * 归一化配置。
 *
 * 默认值刻意与 Python 脚本保持一致：
 *  - startYear=2024 / startMonth=4（py:25-26）
 *  - requestIntervalMs=1000（py:29 REQUEST_INTERVAL = 1.0；需求建议 1–1.2s）
 */
export function resolveConfig(raw, env = (n) => process.env[n]) {
    const cfg = raw ?? {};
    const metrics = Array.isArray(cfg.compactMetrics)
        ? cfg.compactMetrics.filter((m) => SCOPES.includes(m))
        : [];
    return {
        platformUserToken: typeof cfg.platformUserToken === 'string' ? cfg.platformUserToken.trim() : '',
        startYear: clampInt(cfg.startYear, 2024, 2100, 2024),
        startMonth: clampInt(cfg.startMonth, 1, 12, 4),
        // 下限 0 允许测试/特殊环境关闭节流；上限 60s 防止用户写出离谱值。
        requestIntervalMs: clampInt(cfg.requestIntervalMs, 0, 60_000, 1000),
        cacheTTL: {
            // 配置以「秒」书写（需求 6.1），这里换算成毫秒；上限 24 小时。
            total: clampInt(cfg.cacheTTL?.total, 0, 24 * 3600, CACHE_TTL.total / 1000) * 1000,
            current: clampInt(cfg.cacheTTL?.current, 0, 24 * 3600, CACHE_TTL.current / 1000) * 1000,
        },
        defaultExpanded: cfg.defaultExpanded === true,
        // 缺省只放「总计 + 今日」：本周/本月改由展开面板呈现。
        // 原先默认 4 项会把紧凑条挤爆，末尾数字被右边缘裁掉（实测）。
        compactMetrics: metrics.length > 0 ? metrics : ['total', 'today'],
        enableDetailView: cfg.enableDetailView !== false,
        numberFormat: cfg.numberFormat === 'full' ? 'full' : 'short',
        cacheDir: typeof cfg.cacheDir === 'string' && cfg.cacheDir.trim().length > 0 ? cfg.cacheDir.trim() : defaultCacheDir(env),
        enableProjectScope: cfg.enableProjectScope !== false,
        persistHistory: cfg.persistHistory !== false,
        maxToolRows: clampInt(cfg.maxToolRows, 1, 200, 20),
        // 默认关闭：工具的返回值就是模型上下文，默认不让用量数字离开本机。
        exposeUsageToModel: cfg.exposeUsageToModel === true,
        // 默认开启：保持零配置取数；设 false 则连可选注入都不发起。
        useAccountSession: cfg.useAccountSession !== false,
    };
}
//# sourceMappingURL=config.js.map