/**
 * 插件配置的解析与默认值：配置由 profile 的 cordis.patch.yml 注入，用户手写 YAML 时很容易写出越界值或
 * 错类型，因此这里的每个字段都做防御式归一化，保证插件能带着合理默认值继续工作。
 */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { CACHE_TTL } from './store/cache.js';
import { COMPACT_METRICS } from './types.js';
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
function nonEmpty(v) {
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}
/** DSH 主目录：`$DSH_HOME`，缺省为当前工作目录。 */
export function dshHome(env = (n) => process.env[n]) {
    return nonEmpty(env('DSH_HOME')) ?? '.';
}
/** 默认缓存目录：`$TLOGS_CACHE_DIR` 优先，否则 `<DSH_HOME>/tlogs`。 */
export function defaultCacheDir(env = (n) => process.env[n]) {
    return nonEmpty(env('TLOGS_CACHE_DIR')) ?? `${dshHome(env).replace(/[\\/]+$/, '')}/tlogs`;
}
/** 会话日志根目录：`<DSH_HOME>/sessions`。只读，不写入。 */
export function defaultSessionsDir(env = (n) => process.env[n]) {
    return `${dshHome(env).replace(/[\\/]+$/, '')}/sessions`;
}
/**
 * 列出所有可能的会话日志根目录，按优先级排序。`DSH_HOME` 在不同宿主里含义不同：web / CLI 下它就是
 * DSH 主目录，会话在 `<DSH_HOME>/sessions`；桌面端下它被指到 `<主目录>/profiles/<profile>`，而会话
 * 日志仍在 `<主目录>/sessions`。只认 `<DSH_HOME>/sessions` 会让桌面端的「本机口径」永远拿不到数据，
 * 所以这里给出候选，由 `SessionUsageStore` 取第一个真能列出日志的。
 */
export function sessionDirCandidates(env = (n) => process.env[n], home = homedir()) {
    const out = [];
    const push = (label, dir) => {
        const given = nonEmpty(dir);
        if (!given)
            return;
        const abs = resolve(given);
        if (out.some((c) => c.dir === abs))
            return;
        out.push({ label, dir: abs });
    };
    // 显式覆盖优先。
    push('TLOGS_SESSIONS_DIR', env('TLOGS_SESSIONS_DIR'));
    const root = nonEmpty(env('DSH_HOME'));
    if (root) {
        push('DSH_HOME/sessions', join(root, 'sessions'));
        // 桌面端：DSH_HOME = <主目录>/profiles/<profile>，会话在主目录下。
        push('DSH_HOME 上两级/sessions', resolve(root, '..', '..', 'sessions'));
        push('DSH_HOME 上一级/sessions', resolve(root, '..', 'sessions'));
    }
    push('~/.dsh/sessions', join(home, '.dsh', 'sessions'));
    return out;
}
/**
 * 归一化配置。默认值与工作区权威 Python 脚本保持一致（起始 2024-04、请求间隔 1000ms），
 * 这样逐月对拍不需要额外改配置。
 */
export function resolveConfig(raw, env = (n) => process.env[n]) {
    const cfg = raw ?? {};
    const metrics = Array.isArray(cfg.compactMetrics)
        ? cfg.compactMetrics.filter((m) => COMPACT_METRICS.includes(m))
        : [];
    return {
        platformUserToken: nonEmpty(cfg.platformUserToken) ?? '',
        startYear: clampInt(cfg.startYear, 2024, 2100, 2024),
        startMonth: clampInt(cfg.startMonth, 1, 12, 4),
        // 下限 0 允许测试与特殊环境关闭节流；上限 60s 防止写出离谱值。
        requestIntervalMs: clampInt(cfg.requestIntervalMs, 0, 60_000, 1000),
        cacheTTL: {
            // 配置以秒书写，这里换算成毫秒；上限 24 小时。
            total: clampInt(cfg.cacheTTL?.total, 0, 24 * 3600, CACHE_TTL.total / 1000) * 1000,
            current: clampInt(cfg.cacheTTL?.current, 0, 24 * 3600, CACHE_TTL.current / 1000) * 1000,
        },
        defaultExpanded: cfg.defaultExpanded === true,
        // 缺省只放「总计 + 今日」：紧凑条只有侧边栏那么宽，指标一多标签就会被 flex
        // 挤成看不清的碎片。金额改在展开面板的卡片与「详细数据」里看。
        compactMetrics: metrics.length > 0 ? metrics : ['total', 'today'],
        enableDetailView: cfg.enableDetailView !== false,
        numberFormat: cfg.numberFormat === 'full' ? 'full' : 'short',
        cacheDir: nonEmpty(cfg.cacheDir) ?? defaultCacheDir(env),
        enableProjectScope: cfg.enableProjectScope !== false,
        persistHistory: cfg.persistHistory !== false,
        autoRefreshSeconds: clampInt(cfg.autoRefreshSeconds, 0, 24 * 3600, 300),
        maxToolRows: clampInt(cfg.maxToolRows, 1, 200, 20),
        // 默认关闭：工具的返回值就是模型上下文，不让用量数字自己离开本机。
        exposeUsageToModel: cfg.exposeUsageToModel === true,
        useAccountSession: cfg.useAccountSession !== false,
        localUsage: cfg.localUsage !== false,
        // 「近 30 天」窗口 + 2 天余量；上限一年，防止日志扫描过重。
        localUsageScanDays: clampInt(cfg.localUsageScanDays, 2, 366, 32),
    };
}
//# sourceMappingURL=config.js.map