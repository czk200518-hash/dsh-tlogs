/**
 * tlogs — 用量服务（host 端编排层）。
 *
 * 职责：
 *  - 把 token 解析（auth）、按月拉取（api）、增量缓存（store）串成一次刷新
 *  - 维护全量报告与「今日/当周/当月」派生数据
 *  - 产出 client 端需要的快照与详细视图数据
 *
 * 与 Python 脚本的对齐点（验收 7.2）：
 *  - 月份区间：START = (startYear, startMonth)，END = 当前 UTC 月（py:141-143）
 *  - 总 Token / 输入 / 输出 / 请求的累加口径逐字段一致（py:169-174, 202-217）
 */
import { fetchMonth, isAuthError } from './api/usage-client.js';
import { addInto, isNonEmpty, parseBizData, parseDays, toScopeStat } from './api/parser.js';
import { HistoryStore, localYearMonth, monthIndex, monthKey, utcYearMonth } from './store/history.js';
import { publicProjectId } from './store/project.js';
import { inWindow, monthWindow, todayWindow, weekWindow } from './store/dates.js';
import { emptyStat, } from './types.js';
export class UsageService {
    opts;
    history;
    /** 全量报告最后成功刷新的时刻。 */
    lastTotalAt = 0;
    /** 当月（today/week/month 口径）最后成功刷新的时刻。 */
    lastCurrentAt = 0;
    /** 当前月的逐日明细，用于 today/week/month 切片。 */
    currentDays = [];
    /** 当前月所属的 `YYYY-MM`。 */
    currentMonthKey;
    /** 后台刷新任务，保证同一时刻只有一个在跑。 */
    inflight;
    /** 最近一次失败（用于「数据可能过期」角标）。 */
    lastError;
    /** 进度。 */
    progress;
    constructor(opts) {
        this.opts = opts;
        this.history = opts.history;
    }
    get config() {
        return this.opts.config;
    }
    now() {
        return this.opts.now ? this.opts.now() : new Date();
    }
    log(level, msg) {
        const l = this.opts.logger;
        if (!l)
            return;
        l[level]?.(msg);
    }
    /** 历史区间的起点（对应 Python START_YEAR / START_MONTH）。 */
    start() {
        return { year: this.config.startYear, month: this.config.startMonth };
    }
    /**
     * 历史区间的终点。
     *
     * Python 用 `datetime.now(timezone.utc)`（py:141）。这里取 UTC 月与本地月
     * 的**较后者**：跨月边界（本地已进入下月、UTC 还是上月）时保证「本月」卡片
     * 所需的数据也已拉取。非边界时刻两者相同，因此与 Python 的对拍不受影响；
     * 对拍测试显式固定区间，见 test/golden。
     */
    end() {
        const d = this.now();
        const u = utcYearMonth(d);
        const l = localYearMonth(d);
        return monthIndex(l.year, l.month) > monthIndex(u.year, u.month) ? l : u;
    }
    /** 全量报告（只读缓存，不触发网络）。 */
    report() {
        return this.history.toReport(this.start(), this.end());
    }
    /** 是否正在后台刷新。 */
    get loading() {
        return this.inflight !== undefined;
    }
    /** 是否有失败导致的陈旧数据。 */
    get stale() {
        return this.lastError !== undefined;
    }
    /**
     * 判断是否需要刷新。
     *  - manual/force：总是刷新
     *  - mount / expand / scheduled：按 TTL 判定（总消耗 30 分钟，当月 5 分钟）
     */
    needsRefresh(reason) {
        if (reason === 'manual')
            return { total: true, current: true };
        const now = this.now().getTime();
        const totalAge = now - this.lastTotalAt;
        const currentAge = now - this.lastCurrentAt;
        return {
            total: this.lastTotalAt === 0 || totalAge > this.config.cacheTTL.total,
            current: this.lastCurrentAt === 0 || currentAge > this.config.cacheTTL.current,
        };
    }
    /**
     * 后台启动一次刷新并立即返回。
     *
     * 全量首次拉取约 31 个月 × requestIntervalMs ≈ 40 秒（需求 3.5），
     * 因此不能阻塞 RPC/UI —— client 端靠轮询 `snapshot()` 拿进度。
     */
    startRefresh(reason, onProgress, signal) {
        if (this.inflight)
            return { started: false };
        const need = this.needsRefresh(reason);
        if (!need.total && !need.current)
            return { started: false };
        this.inflight = this.runRefresh(need, onProgress, signal)
            .catch((e) => {
            this.log('error', `tlogs: 刷新失败 ${e instanceof Error ? e.message : String(e)}`);
        })
            .finally(() => {
            this.inflight = undefined;
            this.progress = undefined;
        });
        return { started: true };
    }
    /** 同步等待一次刷新完成（供 tool 调用使用）。 */
    async refresh(reason, onProgress, signal) {
        if (this.inflight)
            return this.inflight;
        const need = this.needsRefresh(reason);
        if (!need.total && !need.current)
            return;
        this.inflight = this.runRefresh(need, onProgress, signal).finally(() => {
            this.inflight = undefined;
            this.progress = undefined;
        });
        return this.inflight;
    }
    /** 真正的拉取流程。 */
    async runRefresh(need, onProgress, signal) {
        const resolved = await this.opts.resolveToken();
        if (!resolved) {
            this.log('warn', 'tlogs: 未配置 userToken，跳过刷新');
            return;
        }
        const { token, headers, scheme } = resolved;
        const start = this.start();
        const end = this.end();
        // 需要拉取的月份集合：全量计划 ∪ 增量（当月+上月）
        const wanted = new Map();
        if (need.total) {
            for (const m of this.history.plan(start, end, false).months) {
                wanted.set(monthKey(m.year, m.month), m);
            }
        }
        if (need.current) {
            for (const m of this.history.plan(start, end, true).months) {
                wanted.set(monthKey(m.year, m.month), m);
            }
        }
        const months = [...wanted.values()].sort((a, b) => monthIndex(a.year, a.month) - monthIndex(b.year, b.month));
        if (months.length === 0)
            return;
        this.progress = { done: 0, total: months.length };
        onProgress?.(0, months.length);
        let anyError;
        let authFailed = false;
        const localEnd = localYearMonth(this.now());
        for (let i = 0; i < months.length; i++) {
            const m = months[i];
            const key = monthKey(m.year, m.month);
            // 工具调用可能带取消信号：一旦被取消就停止后续请求（不记为失败）。
            if (signal?.aborted) {
                this.log('info', 'tlogs: 刷新被调用方取消');
                break;
            }
            let result;
            try {
                result = await fetchMonth({
                    token,
                    year: m.year,
                    month: m.month,
                    fetchImpl: this.opts.fetchImpl,
                    signal,
                    extraHeaders: headers,
                    scheme,
                });
            }
            catch (e) {
                if (signal?.aborted) {
                    this.log('info', 'tlogs: 刷新被调用方取消');
                    break;
                }
                result = {
                    ok: false,
                    error: { kind: 'network', message: `请求异常：${e instanceof Error ? e.message : String(e)}` },
                };
            }
            if (result.ok) {
                const { agg, models } = parseBizData(result.bizData);
                const days = parseDays(result.bizData);
                this.history.set({
                    year: m.year,
                    month: m.month,
                    stat: agg,
                    models,
                    days,
                });
                // 记住「当前月」的逐日明细用于 today/week/month。
                if (m.year === localEnd.year && m.month === localEnd.month) {
                    this.currentDays = days;
                    this.currentMonthKey = key;
                }
                else if (m.year === end.year && m.month === end.month && this.currentMonthKey === undefined) {
                    this.currentDays = days;
                    this.currentMonthKey = key;
                }
            }
            else {
                const e = result.error;
                anyError = e;
                this.history.set({ year: m.year, month: m.month, stat: emptyStat(), models: {}, error: e });
                this.log('warn', `tlogs: ${key} 拉取失败 —— ${e.message}`);
                if (isAuthError(e)) {
                    // 需求 2.4 / 5.2：401 立即标记 token 失效并停止后续请求。
                    await this.opts.onAuthInvalid?.(token, e.message);
                    authFailed = true;
                    this.lastError = e;
                    break;
                }
            }
            this.progress = { done: i + 1, total: months.length };
            onProgress?.(i + 1, months.length);
            // py:189  time.sleep(REQUEST_INTERVAL)，仅在实际还有下一个请求时节流。
            if (i < months.length - 1 && this.config.requestIntervalMs > 0) {
                const sleeper = this.opts.sleep ?? defaultSleep;
                await sleeper(this.config.requestIntervalMs, signal);
            }
        }
        if (!authFailed) {
            if (need.total)
                this.lastTotalAt = this.now().getTime();
            if (need.current)
                this.lastCurrentAt = this.now().getTime();
        }
        this.lastError = anyError;
        this.opts.onChanged?.();
        const total = this.history.toReport(start, end).grand.totalTokens;
        this.log('info', `tlogs: 刷新完成（${months.length} 个月，总计 ${total} tokens${anyError ? `，存在失败：${anyError.message}` : ''}）`);
    }
    /** 由逐日明细切出某个窗口的合计。 */
    windowStat(days, w) {
        const acc = emptyStat();
        for (const d of days) {
            if (inWindow(d.date, w))
                addInto(acc, d.stat);
        }
        return acc;
    }
    /** 当前月 + 上月的逐日明细（用于 today/week 跨月兜底）。 */
    daysForCurrentWindow() {
        if (this.currentMonthKey === undefined)
            return [];
        const monthRow = this.history.get(Number(this.currentMonthKey.slice(0, 4)), Number(this.currentMonthKey.slice(5, 7)));
        return monthRow?.days ?? this.currentDays;
    }
    /** 组装卡片数据。 */
    async buildCards() {
        const report = this.report();
        const now = this.now();
        const days = this.daysForCurrentWindow();
        const cards = [];
        // 1) 总消耗（固定，无切换）
        cards.push({
            scope: 'total',
            label: '总消耗 Token',
            stat: report.grand,
            stale: this.stale,
        });
        // 2) 当前项目消耗（P2；不可用时降级为明确提示）
        if (this.config.enableProjectScope) {
            const p = this.opts.projectProvider;
            let options = [];
            if (p?.available()) {
                try {
                    // 下发给浏览器的 id 用哈希，绝不下发完整 cwd（见 publicProjectId 的说明）。
                    options = (await p.list()).map((o) => ({
                        id: publicProjectId(o.id),
                        label: o.label,
                        stat: toScopeStat(o.stat),
                    }));
                }
                catch (e) {
                    this.log('warn', `tlogs: 当前项目统计读取失败 ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            if (options.length > 0) {
                cards.push({
                    scope: 'total',
                    label: '当前项目消耗',
                    stat: options[0].stat,
                    options,
                    selectedOptionId: options[0].id,
                });
            }
            else {
                cards.push({
                    scope: 'total',
                    label: '当前项目消耗',
                    stat: toScopeStat(emptyStat()),
                    error: '当前项目统计不可用',
                });
            }
        }
        // 3) 今日
        cards.push({
            scope: 'today',
            label: '今日消耗',
            stat: toScopeStat(this.windowStat(days, todayWindow(now))),
            stale: this.stale,
        });
        // 4) 当周（周一至今）
        cards.push({
            scope: 'week',
            label: '当周消耗',
            stat: toScopeStat(this.windowStat(days, weekWindow(now))),
            stale: this.stale,
        });
        // 5) 当月（1 日至今）
        cards.push({
            scope: 'month',
            label: '当月消耗',
            stat: toScopeStat(this.windowStat(days, monthWindow(now))),
            stale: this.stale,
        });
        return cards;
    }
    /** 读取项目内某个对象的用量（供卡片切换；数据来自缓存的 options）。 */
    async projectStat(projectId) {
        const p = this.opts.projectProvider;
        if (!p?.available())
            return toScopeStat(emptyStat());
        try {
            const list = await p.list();
            const hit = list.find((o) => o.id === projectId);
            return toScopeStat(hit?.stat ?? emptyStat());
        }
        catch {
            return toScopeStat(emptyStat());
        }
    }
    /** 当前可用的「项目」选项列表（不可用时返回空数组）。 */
    async projectOptions() {
        const p = this.opts.projectProvider;
        if (!p?.available())
            return [];
        try {
            return (await p.list()).map((o) => ({ id: o.id, label: o.label, stat: toScopeStat(o.stat) }));
        }
        catch (e) {
            this.log('warn', `tlogs: 读取项目列表失败 ${e instanceof Error ? e.message : String(e)}`);
            return [];
        }
    }
    /**
     * 同步读取某个范围的统计（不触发网络、不触发项目查询）。
     * 供模型工具使用：数据的刷新由调用方先执行 `refresh()`。
     */
    statForScope(scope) {
        if (scope === 'total')
            return this.report().grand;
        const days = this.daysForCurrentWindow();
        const now = this.now();
        switch (scope) {
            case 'today':
                return toScopeStat(this.windowStat(days, todayWindow(now)));
            case 'week':
                return toScopeStat(this.windowStat(days, weekWindow(now)));
            case 'month':
                return toScopeStat(this.windowStat(days, monthWindow(now)));
            default:
                return toScopeStat(emptyStat());
        }
    }
    /** 当前快照（供 client 端渲染）。 */
    async snapshot() {
        const auth = await this.opts.authState();
        const cards = await this.buildCards();
        const report = this.report();
        const compact = this.config.compactMetrics.map((scope) => {
            switch (scope) {
                case 'total':
                    // 标签用「总」而不是 Σ：紧凑条上不再有任何 Σ 符号。
                    return { scope, label: '总', value: report.grand.totalTokens };
                case 'today':
                    return { scope, label: '今日', value: cards.find((c) => c.scope === 'today')?.stat.totalTokens ?? 0 };
                case 'week':
                    return { scope, label: '本周', value: cards.find((c) => c.scope === 'week')?.stat.totalTokens ?? 0 };
                case 'month':
                    return { scope, label: '本月', value: cards.find((c) => c.scope === 'month')?.stat.totalTokens ?? 0 };
                default:
                    return { scope, label: String(scope), value: 0 };
            }
        });
        return {
            auth,
            cards,
            compact,
            stale: this.stale,
            lastUpdatedAt: this.history.updatedAt,
            loading: this.loading,
            progress: this.progress ? this.progress.done / Math.max(1, this.progress.total) : undefined,
            error: this.lastError?.message,
            display: {
                numberFormat: this.config.numberFormat,
                enableDetailView: this.config.enableDetailView,
                defaultExpanded: this.config.defaultExpanded,
                loginAvailable: this.opts.loginAvailable?.() ?? false,
            },
        };
    }
    /** 详细视图数据：按模型 / 年 / 月 / 天。 */
    detail() {
        const report = this.report();
        const models = Object.entries(report.models)
            .map(([key, s]) => ({ key, label: key, stat: s }))
            // 与 Python 一致：零用量且零请求的模型不展示（py:229-230）
            .filter((r) => isNonEmpty(r.stat))
            .sort((a, b) => b.stat.totalTokens - a.stat.totalTokens); // py:227 降序
        const years = Object.entries(report.yearly)
            .map(([key, s]) => ({ key, label: `${key} 年`, stat: s }))
            .sort((a, b) => a.key.localeCompare(b.key)); // py:243 sorted(yearly.keys())
        const months = report.monthly
            .filter((r) => r.stat && !r.error)
            .map((r) => {
            const key = monthKey(r.year, r.month);
            return { key, label: key, stat: toScopeStat(r.stat) };
        });
        // 按天：当月明细
        const days = this.daysForCurrentWindow()
            .map((d) => ({ key: d.date, label: d.date, stat: toScopeStat(d.stat) }))
            .filter((r) => isNonEmpty(r.stat))
            .sort((a, b) => b.key.localeCompare(a.key));
        return { models, years, months, days };
    }
}
/** 默认可取消睡眠实现。 */
function defaultSleep(ms, signal) {
    return new Promise((resolve) => {
        const t = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(t);
            resolve();
        }, { once: true });
    });
}
//# sourceMappingURL=service.js.map