/**
 * tlogs — 插件配置的解析与默认值。
 *
 * 对应需求第六章「配置」。配置通过 profile 的 cordis.patch.yml 注入，
 * 因此这里对每个字段都做防御式归一化：用户手写 YAML 时很容易写出
 * 越界值或错类型，插件必须能带着合理默认值继续工作。
 */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { CACHE_TTL } from './store/cache.js';
import { COMPACT_METRICS } from './types.js';
/** 合法的 scope 值集合。 */
const SCOPES = COMPACT_METRICS;
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
    const base = dshHome(env);
    return `${base.replace(/[\\/]+$/, '')}/tlogs`;
}
/** DSH 主目录：`$DSH_HOME`，缺省为当前工作目录（与上面同一约定）。 */
export function dshHome(env = (n) => process.env[n]) {
    const home = env('DSH_HOME');
    return home && home.trim().length > 0 ? home.trim() : '.';
}
/**
 * 会话日志根目录：`<DSH_HOME>/sessions`。
 *
 * 本机口径的数据源就在这个目录下（`<项目>/<会话>/session[.vN].jsonl[.zstd]`），
 * 与 DSH 自己写日志的位置一致；只读，不写入。
 */
export function defaultSessionsDir(env = (n) => process.env[n]) {
    return `${dshHome(env).replace(/[\\/]+$/, '')}/sessions`;
}
/**
 * 列出**所有可能**的会话日志根目录，按优先级排序。
 *
 * 为什么需要候选列表（实测踩过）：`DSH_HOME` 在不同宿主里含义不同 ——
 *  - web / CLI：`DSH_HOME` 就是 DSH 主目录，会话在 `<DSH_HOME>/sessions`；
 *  - **桌面端（Electron）**：`DSH_HOME` 被指到 `<主目录>/profiles/<profile>`，
 *    而会话日志仍在 `<主目录>/sessions`（实测：`~/.dsh/profiles/desktop/sessions`
 *    不存在，`~/.dsh/sessions` 才有 121 个日志）。
 *
 * 于是只认 `<DSH_HOME>/sessions` 会让桌面端「本机口径」永远拿不到数据。
 * 这里给出候选列表，由 `SessionUsageStore` 取第一个真的能列出日志的目录。
 */
export function sessionDirCandidates(env = (n) => process.env[n], home = homedir()) {
    const out = [];
    const push = (label, dir) => {
        if (!dir || dir.trim().length === 0)
            return;
        const abs = resolve(dir.trim());
        if (out.some((c) => c.dir === abs))
            return;
        out.push({ label, dir: abs });
    };
    // 1) 显式覆盖优先。
    push('TLOGS_SESSIONS_DIR', env('TLOGS_SESSIONS_DIR'));
    const dshHome = env('DSH_HOME');
    if (dshHome && dshHome.trim().length > 0) {
        const root = dshHome.trim();
        // 2) web / CLI 形态。
        push('DSH_HOME/sessions', join(root, 'sessions'));
        // 3) 桌面端形态：DSH_HOME = <主目录>/profiles/<profile>。
        push('DSH_HOME 上两级/sessions', resolve(root, '..', '..', 'sessions'));
        push('DSH_HOME 上一级/sessions', resolve(root, '..', 'sessions'));
    }
    // 4) 兜底：DSH 主目录的默认位置。
    push('~/.dsh/sessions', join(home, '.dsh', 'sessions'));
    return out;
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
        // 缺省放「总计 + 今日」。
        //
        // 为什么金额**不在**默认值里：紧凑条只有侧边栏那么宽，四个指标（总/金额/今日/
        // 请求）会把标签挤成碎片（实测截图：标签全部消失，只剩「8.9B · ¥678.87 ·
        // ↖561M · ⚡2.4K」）。金额改在展开面板的卡片与「详细数据」里看。
        compactMetrics: metrics.length > 0 ? metrics : ['total', 'today'],
        enableDetailView: cfg.enableDetailView !== false,
        numberFormat: cfg.numberFormat === 'full' ? 'full' : 'short',
        cacheDir: typeof cfg.cacheDir === 'string' && cfg.cacheDir.trim().length > 0 ? cfg.cacheDir.trim() : defaultCacheDir(env),
        enableProjectScope: cfg.enableProjectScope !== false,
        persistHistory: cfg.persistHistory !== false,
        // 默认 5 分钟；下限 0（关闭），上限 24 小时。
        autoRefreshSeconds: clampInt(cfg.autoRefreshSeconds, 0, 24 * 3600, 300),
        maxToolRows: clampInt(cfg.maxToolRows, 1, 200, 20),
        // 默认关闭：工具的返回值就是模型上下文，默认不让用量数字离开本机。
        exposeUsageToModel: cfg.exposeUsageToModel === true,
        // 默认开启：保持零配置取数；设 false 则连可选注入都不发起。
        useAccountSession: cfg.useAccountSession !== false,
        // 默认开启：平台口径当天滞后且只覆盖 DeepSeek 通道，本机口径补上这两块。
        localUsage: cfg.localUsage !== false,
        // 「近 30 天」窗口 + 2 天余量；上限一年，防止日志扫描过重。
        localUsageScanDays: clampInt(cfg.localUsageScanDays, 2, 366, 32),
    };
}
//# sourceMappingURL=config.js.map