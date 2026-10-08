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
import { fetchAccountSummary, fetchMonth, isAuthError } from './api/usage-client.js';
import { addInto, addMoneyInto, isNonEmpty, parseBizData, parseCost, parseDays, toScopeStat, } from './api/parser.js';
import { HistoryStore, enumerateMonths, localYearMonth, monthIndex, monthKey, utcYearMonth, } from './store/history.js';
import { publicProjectId } from './store/project.js';
import { isDateKey } from './store/project-history.js';
import { dateKey, inWindow, monthWindow, rollingWindow, todayWindow, weekWindow } from './store/dates.js';
import { tokenTotal } from './store/session-usage.js';
import { isDeepseekProvider, mergeTotal, mergeWindow } from './store/usage-merge.js';
import { OFFICIAL_BILLING_TAG, OFFICIAL_BILLING_TITLE, TIER_LABEL, providerLabel, providerTier, providerTierTitle, } from './store/provider-meta.js';
import { emptyMoney, emptyStat, moneyTotal, ROLLING_DAYS, } from './types.js';
export class UsageService {
    opts;
    history;
    projectHistory;
    /** 全量报告最后成功刷新的时刻。 */
    lastTotalAt = 0;
    /** 当月（today/week/month 口径）最后成功刷新的时刻。 */
    lastCurrentAt = 0;
    /** 平台账户概览（余额 / 官方累计消费）；取不到时 undefined。 */
    account;
    /** 金额币种（由 `usage/cost` 的 `currency` 字段带回，默认 CNY）。 */
    currencyCode = 'CNY';
    /** 后台刷新任务，保证同一时刻只有一个在跑。 */
    inflight;
    /** 最近一次失败（用于「数据可能过期」角标）。 */
    lastError;
    /** 进度。 */
    progress;
    constructor(opts) {
        this.opts = opts;
        this.history = opts.history;
        this.projectHistory = opts.projectHistory;
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
        this.inflight = this.withCredentialLease(() => this.runRefresh(need, onProgress, signal))
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
        this.inflight = this.withCredentialLease(() => this.runRefresh(need, onProgress, signal)).finally(() => {
            this.inflight = undefined;
            this.progress = undefined;
        });
        return this.inflight;
    }
    /**
     * 在**账号会话凭据租约**内执行一次刷新。
     *
     * 这是全插件唯一索取账号会话凭据的时机：刷新开始时取来，刷新结束时（正常返回、
     * 提前返回、抛错都算）立刻释放引用。于是令牌既不会常驻内存，客户端轮询
     * `snapshot` 的那条热路径也完全不碰它。
     */
    async withCredentialLease(fn) {
        await this.opts.beginCredentialLease?.();
        try {
            return await fn();
        }
        finally {
            this.opts.endCredentialLease?.();
        }
    }
    /** 真正的拉取流程。 */
    async runRefresh(need, onProgress, signal) {
        // 项目快照与平台账单无关（它读的是宿主会话投影），因此放在 token 解析**之前**：
        // 即便没配平台令牌，项目用量的历史也该照常积累。
        await this.recordProjectSnapshots();
        // 本机口径（会话日志）：**与平台拉取并行**启动，绝不拖慢平台数据的到达。
        //
        // 放在这里（而不是等平台拉完）有两个原因：
        //  - 它只读本地日志、不发网络请求，**没有平台凭据时它仍是唯一的数据来源**
        //    （用户可能完全不用 DeepSeek 模型）；
        //  - 首次扫描要读 100+ 个日志（实测约 7 秒），若是串行会把「当月/今日」这些
        //    最关心的卡片一起拖到 7 秒后。
        // 平台部分结束后再汇合（见下面的 `await localScan`），这样一次刷新产出的快照
        // 里两路口径都已经是最新的。
        const localScan = this.config.localUsage && this.opts.localUsage
            ? this.opts.localUsage.refresh().catch((e) => {
                this.log('warn', `tlogs: 本机口径扫描失败 —— ${e instanceof Error ? e.message : String(e)}`);
            })
            : undefined;
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
            // needCost=true：把「还没抓到金额」的月份也一并挑出来（一次性回补）。
            for (const m of this.history.plan(start, end, false, true).months) {
                wanted.set(monthKey(m.year, m.month), m);
            }
        }
        if (need.current) {
            for (const m of this.history.plan(start, end, true).months) {
                wanted.set(monthKey(m.year, m.month), m);
            }
        }
        // **近月优先**。
        //
        // 首次全量（或金额一次性回补）要打 31 个月，按升序的话「近 7 天/近 30 天/当月」
        // 这些用户最关心的卡片要等 60 多个请求走完才出现数字。倒序抓取让它们在几秒内
        // 就填好，老月份在后台继续补。聚合与落盘的顺序无关（MemoryStore 按 key 存，
        // report 按区间枚举），因此这只影响观感，不影响任何口径。
        const months = [...wanted.values()].sort((a, b) => monthIndex(b.year, b.month) - monthIndex(a.year, a.month));
        if (months.length === 0)
            return;
        // 「当月 + 上月」这些月份的金额每次刷新都要重取（数据仍在增长）；
        // 其余月份只在从未抓过金额时取一次。
        const alwaysRefresh = new Set(this.history.plan(start, end, true).months.map((m) => monthKey(m.year, m.month)));
        this.progress = { done: 0, total: months.length };
        onProgress?.(0, months.length);
        let anyError;
        let authFailed = false;
        for (let i = 0; i < months.length; i++) {
            const m = months[i];
            const key = monthKey(m.year, m.month);
            // 工具调用可能带取消信号：一旦被取消就停止后续请求（不记为失败）。
            if (signal?.aborted) {
                this.log('info', 'tlogs: 刷新被调用方取消');
                break;
            }
            const row = this.history.get(m.year, m.month);
            const wantCost = alwaysRefresh.has(key) || row?.costFetched !== true;
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
                // 金额：紧跟同月用量之后请求，**不额外节流**（节流是为了避免平台限流，
                // 同月两个端点连打不会触发；这样 31 个月的首次回补仍是约 30 次等待，
                // 而不是 62 次）。
                let cost;
                if (wantCost) {
                    cost = await this.fetchCostFor(token, m, headers, scheme, signal);
                }
                const days = parseDays(result.bizData, cost ?? null);
                this.history.set({
                    year: m.year,
                    month: m.month,
                    stat: agg,
                    models,
                    days,
                    // 标记「逐日明细已抓取」：计划器据此避免把该月反复判为需要回补。
                    // 即便接口这次没返回 days，也算抓过了 —— 否则每次刷新都会重抓一遍。
                    daysFetched: true,
                    // 同上：金额抓成功才打标记，失败则下次重试。
                    ...(cost
                        ? {
                            cost: cost.total,
                            costModels: cost.models,
                            currency: cost.currency,
                            costFetched: true,
                        }
                        : row?.cost
                            ? {
                                // 本次没抓（或抓失败）但缓存里有旧金额：保留，别把它抹掉。
                                cost: row.cost,
                                costModels: row.costModels,
                                currency: row.currency,
                                costFetched: row.costFetched,
                            }
                            : {}),
                });
                if (cost)
                    this.currencyCode = cost.currency;
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
            // 账户概览（余额 / 官方累计消费）：一次请求，单独失败不影响用量。
            // 注：面板上的展示项已按要求移除，这里保留取数链路，便于以后再加回。
            await this.refreshAccount(token, headers, scheme, signal);
        }
        // 与平台拉取并行的本机口径扫描在这里汇合：平台那 31 个月通常要几秒，
        // 所以这一步绝大多数情况下是「已经完成」。等它是为了让**本次**刷新产出的
        // 快照里两路口径都已就绪（否则第一屏会显示平台口径的当天 0）。
        if (localScan)
            await localScan;
        this.lastError = anyError;
        this.opts.onChanged?.();
        const total = this.history.toReport(start, end).grand.totalTokens;
        this.log('info', `tlogs: 刷新完成（${months.length} 个月，总计 ${total} tokens${anyError ? `，存在失败：${anyError.message}` : ''}）`);
    }
    /**
     * 拉取某月金额。失败**不影响**该月的用量数据：金额缺失只会让界面上少一列，
     * 而把整月判失败会把已经拿到的 token 数据一起丢掉。
     */
    async fetchCostFor(token, m, headers, scheme, signal) {
        try {
            const r = await fetchMonth({
                token,
                year: m.year,
                month: m.month,
                kind: 'cost',
                fetchImpl: this.opts.fetchImpl,
                signal,
                extraHeaders: headers,
                scheme,
            });
            if (!r.ok) {
                this.log('warn', `tlogs: ${monthKey(m.year, m.month)} 金额拉取失败 —— ${r.error.message}`);
                return undefined;
            }
            return parseCost(r.bizData);
        }
        catch (e) {
            if (signal?.aborted)
                return undefined;
            this.log('warn', `tlogs: ${monthKey(m.year, m.month)} 金额请求异常 —— ${e instanceof Error ? e.message : String(e)}`);
            return undefined;
        }
    }
    /** 刷新平台账户概览（余额 / 官方累计消费）。失败静默降级。 */
    async refreshAccount(token, headers, scheme, signal) {
        try {
            const r = await fetchAccountSummary({
                token,
                fetchImpl: this.opts.fetchImpl,
                signal,
                extraHeaders: headers,
                scheme,
            });
            if (r.ok)
                this.account = r.summary;
            else
                this.log('warn', `tlogs: 账户概览拉取失败 —— ${r.error.message}`);
        }
        catch (e) {
            if (signal?.aborted)
                return;
            this.log('warn', `tlogs: 账户概览请求异常 —— ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    /**
     * 取某个本地日历闭区间内的逐日明细。
     *
     * 直接按月从**历史缓存**读，而不是只持有「当月」副本，原因有二：
     *  - 近 30 天可能横跨两到三个自然月（例如 3 月 1 日的「近 30 天」落到 1 月 31 日）
     *  - 重启后历史已由 `deserialize` 恢复，读缓存比依赖内存里的当月副本更可靠
     *    （旧实现只缓存「当月」，重启后首次刷新前 today/week 会算成 0）
     */
    daysInRange(from, to) {
        if (!isDateKey(from) || !isDateKey(to))
            return [];
        const startM = { year: Number(from.slice(0, 4)), month: Number(from.slice(5, 7)) };
        const endM = { year: Number(to.slice(0, 4)), month: Number(to.slice(5, 7)) };
        const out = [];
        for (const m of enumerateMonths(startM, endM)) {
            const row = this.history.get(m.year, m.month);
            if (row?.days && !row.error)
                out.push(...row.days);
        }
        return out;
    }
    /**
     * 平台口径 + 本机口径合并后的窗口值（**逐日**取大后求和）。
     *
     * 为什么窗口卡片不能只用平台口径：平台只覆盖 DeepSeek 官方通道，且当天数据要等
     * 平台结算（实测 2026-10-08 北京时间 12:07 该日桶仍为 0；12:16 补到 5.89M、
     * 12:34 补到 30.2M，即滞后约 10~30 分钟），而非 DeepSeek 供应商平台完全看不到。
     * 合并规则与理由见 `store/usage-merge.ts` 的文件头。
     */
    mergedWindow(w) {
        const days = this.config.localUsage ? (this.opts.localUsage?.current.days ?? []) : [];
        const platformDays = this.daysInRange(w.from, w.to).filter((d) => inWindow(d.date, w));
        return mergeWindow(platformDays, days, w);
    }
    /**
     * **总消耗**：平台全部月份合计 + 本机补充（平台看不到的供应商 + 当天未结算的差额）。
     *
     * 为什么总消耗也要合并：平台全量只等于「官方通道 + 已结算」，用户用别家平台的模型
     * （火山方舟/小米/GLM…）时那部分**永远不进这个数**。合并项不会与平台重复（见
     * `store/usage-merge.ts` 的 `mergeTotal`）。
     *
     * 覆盖边界：本机日志只覆盖它能扫到的那些天（DSH 会清理旧日志），界面上会标注区间。
     */
    mergedTotal() {
        const report = this.report();
        if (!this.config.localUsage || !this.opts.localUsage)
            return mergeTotal(report.grand, [], []);
        const start = this.start();
        const end = this.end();
        const platformDays = this.daysInRange(dateKey(new Date(Date.UTC(start.year, start.month - 1, 1))), dateKey(new Date(Date.UTC(end.year, end.month, 0))));
        return mergeTotal(report.grand, platformDays, this.opts.localUsage.current.days);
    }
    /** 把合并结果里的「这份数字是谁给的」转成下发给浏览器的形状。 */
    sourceInfo(m) {
        return {
            kind: m.source,
            platformTokens: tokenTotal(m.platform.raw),
            localTokens: m.local.totalTokens,
            localDeepseekTokens: m.localDeepseekTokens,
            // 下发给浏览器的是**展示名**（`xiaomi` → `小米`），tooltip 里直接可读。
            otherProviders: m.otherProviders.map((p) => ({ provider: providerLabel(p.provider), tokens: p.tokens })),
            costPending: m.costPending,
        };
    }
    /** 组装卡片数据。 */
    async buildCards() {
        const now = this.now();
        const cards = [];
        // 1) 总消耗（无切换对象；含本机补充，见 mergedTotal 的说明）
        const total = this.mergedTotal();
        cards.push({
            scope: 'total',
            label: '总消耗 Token',
            stat: total.stat,
            stale: this.stale,
            source: this.sourceInfo(total),
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
        const today = this.mergedWindow(todayWindow(now));
        cards.push({
            scope: 'today',
            label: '今日消耗',
            stat: today.stat,
            stale: this.stale,
            source: this.sourceInfo(today),
        });
        // 4) 当周（周一至今）
        const week = this.mergedWindow(weekWindow(now));
        cards.push({
            scope: 'week',
            label: '当周消耗',
            stat: week.stat,
            stale: this.stale,
            source: this.sourceInfo(week),
        });
        // 5) 当月（1 日至今）
        const month = this.mergedWindow(monthWindow(now));
        cards.push({
            scope: 'month',
            label: '当月消耗',
            stat: month.stat,
            stale: this.stale,
            source: this.sourceInfo(month),
        });
        // 6) 近 7 天 / 7) 近 30 天（滚动窗口，与控制台「时间维度」口径一致）。
        //    刻意与「当周/当月」并列而不是替换：前者对齐自然日历，后者对齐控制台，
        //    两者在月初/周一附近会明显不同，摆在一起才能解释「为什么数字不一样」。
        const last7 = this.mergedWindow(rollingWindow(ROLLING_DAYS.last7, now));
        cards.push({
            scope: 'last7',
            label: '近 7 天',
            stat: last7.stat,
            stale: this.stale,
            source: this.sourceInfo(last7),
        });
        const last30 = this.mergedWindow(rollingWindow(ROLLING_DAYS.last30, now));
        cards.push({
            scope: 'last30',
            label: '近 30 天',
            stat: last30.stat,
            stale: this.stale,
            source: this.sourceInfo(last30),
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
    /**
     * 当前可用的「项目」选项列表（不可用时返回空数组）。
     *
     * **id 一律是不可逆短哈希**（与下发给浏览器、以及图表用的那份完全同源）。
     *
     * 为什么必须哈希、不能给原始 cwd：这个列表会经 `query_token_usage` 工具返回，
     * 而**工具返回值直接进模型上下文** —— 也就是本机绝对路径会被当作对话内容发给
     * 模型提供方。UI 只显示 `label`（末两级），完整路径对外没有任何用途。
     *
     * 这里曾刻意区分成「工具用原始 cwd、浏览器用哈希」两套语义（工具入参按 cwd 寻址），
     * 但那等于把一个「本机目录结构外泄」的通道挂在 `exposeUsageToModel` 这个开关上：
     * 一旦用户打开它，路径就随工具输出离开本机。现在两条路径统一走哈希，
     * 出参里再也不会出现绝对路径。（`projectId` 入参因此也必须是哈希值。）
     */
    async projectOptions() {
        const p = this.opts.projectProvider;
        if (!p?.available())
            return [];
        try {
            return (await p.list()).map((o) => ({
                id: publicProjectId(o.id),
                label: o.label,
                stat: toScopeStat(o.stat),
            }));
        }
        catch (e) {
            this.log('warn', `tlogs: 读取项目列表失败 ${e instanceof Error ? e.message : String(e)}`);
            return [];
        }
    }
    /**
     * 供图表使用的项目列表：id 是不可逆短哈希（与 `projectOptions()` 同一口径）。
     */
    async projectList() {
        // 与「当前项目消耗」卡片同一个开关：关掉就彻底不遍历会话、不读 cwd，
        // 图表里也就没有项目可选、更不会记录任何快照。
        if (!this.config.enableProjectScope)
            return [];
        const p = this.opts.projectProvider;
        if (!p?.available())
            return [];
        try {
            return (await p.list()).map((o) => ({
                id: publicProjectId(o.id),
                label: o.label,
                stat: o.stat,
            }));
        }
        catch (e) {
            this.log('warn', `tlogs: 读取项目列表失败 ${e instanceof Error ? e.message : String(e)}`);
            return [];
        }
    }
    /**
     * 记录本机各项目的**当日累计快照**（一天一条，重复记录覆盖）。
     *
     * 由 `runRefresh` 在每次真正刷新时调用；宿主定时刷新（默认 5 分钟一轮，
     * 受 TTL 约束实际至少每 30 分钟落一次）保证一天之内必然留下快照。
     */
    async recordProjectSnapshots() {
        const list = await this.projectList();
        if (list.length === 0)
            return;
        const date = dateKey(this.now());
        let changed = false;
        for (const p of list) {
            if (this.projectHistory.record(p.id, date, p.stat))
                changed = true;
        }
        if (changed)
            this.opts.onChanged?.();
    }
    /**
     * 把图表范围解析成明确的本地日历日闭区间。
     *
     * 归一化放在 host 侧：客户端只传语义化的 `range`（all/today/week/month）或
     * 自定义的起止日，解析口径（本地日历、周一为一周之始、不得晚于今天）统一在这里，
     * 免得两端各写一套。
     */
    resolveRange(range, from, to) {
        const now = this.now();
        const today = dateKey(now);
        const start = this.start();
        const allFrom = `${monthKey(start.year, start.month)}-01`;
        switch (range) {
            case 'today':
                return { from: today, to: today };
            case 'week': {
                const w = weekWindow(now);
                return { from: w.from, to: w.to };
            }
            case 'month': {
                const w = monthWindow(now);
                return { from: w.from, to: w.to };
            }
            case 'last7':
            case 'last30': {
                const w = rollingWindow(ROLLING_DAYS[range], now);
                return { from: w.from, to: w.to };
            }
            case 'custom': {
                // RPC 已校验格式与 from <= to；这里再防御性裁剪（不得晚于今天，以免出现空未来段）。
                const f = isDateKey(from) ? from : allFrom;
                const rawTo = isDateKey(to) ? to : today;
                const t = rawTo > today ? today : rawTo;
                return { from: f > t ? t : f, to: t };
            }
            default:
                return { from: allFrom, to: today };
        }
    }
    /**
     * 图表数据：`范围 × 项目 × 指标` 所需的全部原始数字。
     *
     * 只做聚合与范围裁剪，不做任何「取哪个指标」的选择 —— 那是客户端的事。
     * 返回的 `stat` 始终是**原始五类计量项**，因此同一份响应可以画出总 Token /
     * 输入 / 输出 / 缓存命中 / 缓存未命中 / 请求数 六种图，无需重新请求。
     */
    async series(query) {
        const { from, to } = this.resolveRange(query.range, query.from, query.to);
        const start = this.start();
        const end = this.end();
        const fromMonth = from.slice(0, 7);
        const toMonth = to.slice(0, 7);
        const months = [];
        const usable = [];
        const modelTotals = {};
        const modelCosts = {};
        const prior = emptyStat();
        const rangeCost = emptyMoney();
        let priorCost = 0;
        let partial = false;
        let costPartial = false;
        for (const m of enumerateMonths(start, end)) {
            const key = monthKey(m.year, m.month);
            const row = this.history.get(m.year, m.month);
            const ok = row !== undefined && !row.error;
            // 范围之前的月份：整体计入「累计」基线。
            if (key < fromMonth) {
                if (ok) {
                    addInto(prior, row.stat);
                    if (row.cost)
                        priorCost += moneyTotal(row.cost);
                    else
                        costPartial = true;
                }
                continue;
            }
            if (key > toMonth)
                break;
            if (!ok) {
                // 该月没有成功数据（未拉到 / 拉取失败）。按 Python 口径贡献 0，
                // 但必须让 UI 知道「这段是缺的」，否则用户会以为当月真的没用量。
                partial = true;
                costPartial = true;
                continue;
            }
            // 金额还没回补到时把「金额不完整」标出来：否则曲线会静默地把缺的月份当 0。
            if (row.cost) {
                months.push({ key, stat: { ...row.stat }, cost: moneyTotal(row.cost) });
                addMoneyInto(rangeCost, row.cost);
            }
            else {
                months.push({ key, stat: { ...row.stat } });
                costPartial = true;
            }
            for (const [name, s] of Object.entries(row.models)) {
                let acc = modelTotals[name];
                if (!acc) {
                    acc = emptyStat();
                    modelTotals[name] = acc;
                }
                addInto(acc, s);
            }
            for (const [name, amount] of Object.entries(row.costModels ?? {})) {
                modelCosts[name] = (modelCosts[name] ?? 0) + amount;
            }
            usable.push({ key, days: row.days ?? [] });
        }
        // 逐日：只有抓到过 days 的月份才有。缺天的月份由 partial 标出。
        const days = [];
        for (const u of usable) {
            const list = u.days;
            if (list.length === 0) {
                partial = true;
                continue;
            }
            for (const d of list) {
                if (u.key === fromMonth && d.date < from) {
                    // 范围内首月中、起始日之前的天 → 计入累计基线。
                    addInto(prior, d.stat);
                    priorCost += moneyTotal(d.cost);
                    continue;
                }
                if (d.date > to)
                    continue;
                const entry = { date: d.date, stat: { ...d.stat } };
                if (d.cost)
                    entry.cost = moneyTotal(d.cost);
                days.push(entry);
            }
        }
        const models = Object.entries(modelTotals)
            .map(([key, stat]) => {
            const c = modelCosts[key];
            return c === undefined ? { key, stat } : { key, stat, cost: c };
        })
            .filter((p) => isNonEmpty(toScopeStat(p.stat)))
            .sort((a, b) => toScopeStat(b.stat).totalTokens - toScopeStat(a.stat).totalTokens);
        const projects = await this.projectList();
        let project;
        if (query.projectId !== undefined) {
            const id = query.projectId;
            const hit = projects.find((p) => p.id === id);
            const points = this.projectHistory.pointsBetween(id, from, to);
            // 「每期新增」的第一个点需要基线：范围内首日之前的那次快照。
            const priorPoint = this.projectHistory.lastBefore(id, from);
            // 把最后一个点替换成**当前实时值**：
            // 快照最多一天一新，而项目卡片读的是实时投影 —— 若不覆盖，曲线终点会与
            // 卡片上的数字对不上。今天落在范围内时直接落一个今天的点。
            const today = dateKey(this.now());
            if (hit && today >= from && today <= to) {
                const last = points[points.length - 1];
                if (last && last.date === today)
                    last.stat = hit.stat;
                else
                    points.push({ date: today, stat: hit.stat });
            }
            project = {
                id,
                label: hit?.label ?? `项目 ${id.slice(0, 8)}`,
                known: hit !== undefined,
                ...(priorPoint ? { prior: priorPoint } : {}),
                points,
            };
        }
        return {
            from,
            to,
            days,
            months,
            prior,
            priorCost,
            models,
            projects,
            partial,
            costPartial,
            costByType: rangeCost,
            currency: this.currencyCode,
            ...(project ? { project } : {}),
        };
    }
    /**
     * 同步读取某个范围的统计（不触发网络、不触发项目查询）。
     * 供模型工具使用：数据的刷新由调用方先执行 `refresh()`。
     */
    statForScope(scope) {
        if (scope === 'total')
            return this.mergedTotal().stat;
        const now = this.now();
        switch (scope) {
            case 'today':
                return this.mergedWindow(todayWindow(now)).stat;
            case 'week':
                return this.mergedWindow(weekWindow(now)).stat;
            case 'month':
                return this.mergedWindow(monthWindow(now)).stat;
            case 'last7':
                return this.mergedWindow(rollingWindow(ROLLING_DAYS.last7, now)).stat;
            case 'last30':
                return this.mergedWindow(rollingWindow(ROLLING_DAYS.last30, now)).stat;
            default:
                return toScopeStat(emptyStat());
        }
    }
    /** 当前快照（供 client 端渲染）。 */
    async snapshot() {
        const auth = await this.opts.authState();
        const cards = await this.buildCards();
        const report = this.report();
        const cardOf = (scope) => cards.find((c) => c.scope === scope)?.stat ?? toScopeStat(emptyStat());
        /**
         * 该 scope 的数字来自哪一路（双路数据源）。用于紧凑条 tooltip：
         * 侧边栏太窄放不下徽标，但鼠标悬停要能说明「这个数不是平台给的」。
         */
        const sourceOf = (scope) => cards.find((c) => c.scope === scope)?.source?.kind;
        /** 金额合计（元）。金额尚未回补完时它只是部分合计，由 `costComplete` 标注。 */
        const moneyOf = (scope) => scope === 'total' ? moneyTotal(report.grand.cost) : moneyTotal(cardOf(scope).cost);
        const compact = this.config.compactMetrics.flatMap((scope) => {
            switch (scope) {
                case 'total':
                    // 紧凑条上不使用任何求和符号；总计的标签就是「总」。
                    // 金额**不在这里顺带输出**：需要金额就显式写 `cost_total`，
                    // 否则 `[total, cost_total]` 会重复出现两个一模一样的 ¥ 值。
                    return [{ scope, label: '总', value: cardOf('total').totalTokens, source: sourceOf('total') }];
                case 'today':
                    return [
                        { scope, label: '今日', value: cardOf('today').totalTokens, source: sourceOf('today') },
                        // 今日请求数：紧跟在今日 token 右侧（用户明确要求的位置）
                        {
                            scope,
                            label: '请求',
                            value: cardOf('today').requests,
                            unit: 'requests',
                            source: sourceOf('today'),
                        },
                    ];
                case 'week':
                    return [{ scope, label: '本周', value: cardOf('week').totalTokens, source: sourceOf('week') }];
                case 'month':
                    return [{ scope, label: '本月', value: cardOf('month').totalTokens, source: sourceOf('month') }];
                case 'last7':
                    return [{ scope, label: '近 7 天', value: cardOf('last7').totalTokens, source: sourceOf('last7') }];
                case 'last30':
                    return [{ scope, label: '近 30 天', value: cardOf('last30').totalTokens, source: sourceOf('last30') }];
                // 金额专用项：`scope` 复用对应窗口，靠 label 与 unit 区分。
                case 'cost_total':
                    return [{ scope: 'total', label: '总 ¥', value: moneyOf('total'), unit: 'money' }];
                case 'cost_today':
                    return [{ scope: 'today', label: '今 ¥', value: moneyOf('today'), unit: 'money' }];
                case 'cost_last7':
                    return [{ scope: 'last7', label: '7日 ¥', value: moneyOf('last7'), unit: 'money' }];
                case 'cost_last30':
                    return [{ scope: 'last30', label: '30日 ¥', value: moneyOf('last30'), unit: 'money' }];
                default:
                    return [{ scope, label: String(scope), value: 0 }];
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
            costComplete: report.costComplete,
            currency: this.currencyCode,
            ...(this.account ? { account: this.account } : {}),
            ...(this.config.localUsage
                ? {
                    localUsage: {
                        available: this.opts.localUsage?.current.available ?? false,
                        ...(this.opts.localUsage?.current.reason
                            ? { reason: this.opts.localUsage.current.reason }
                            : {}),
                        days: this.opts.localUsage?.current.days.length ?? 0,
                        files: this.opts.localUsage?.current.totalFiles ?? 0,
                        updatedAt: this.opts.localUsage?.current.updatedAt ?? 0,
                        ...(this.opts.localUsage?.current.sourceLabel
                            ? { sourceLabel: this.opts.localUsage.current.sourceLabel }
                            : {}),
                    },
                }
                : {}),
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
        const currency = this.currencyCode;
        // 平台口径的模型行（只含 DeepSeek 官方通道，带官方金额）。
        const platformModels = Object.entries(report.models)
            .map(([key, s]) => {
            // 模型维度只有金额总额，没有五类拆分 —— 用 `singleBucketMoney` 承载，
            // UI 一律走 `moneyTotal()`（对五类求和，等于这个总额）。
            const amount = report.modelCosts[key];
            const stat = amount === undefined
                ? s
                : { ...s, cost: singleBucketMoney(amount), currency: report.currency };
            // 平台账单行 = 官方平台（DeepSeek 开放平台）口径。
            return { key, label: key, stat, tag: OFFICIAL_BILLING_TAG, tagTitle: OFFICIAL_BILLING_TITLE };
        })
            // 与 Python 一致：零用量且零请求的模型不展示（py:229-230）
            .filter((r) => isNonEmpty(r.stat))
            .sort((a, b) => b.stat.totalTokens - a.stat.totalTokens); // py:227 降序
        /*
         * 模型页签也要能看见**别家平台的模型**（火山方舟 / 小米 / GLM / GPT…）——
         * 平台账单里根本没有它们，只列平台口径会让人以为「我就用了这几个模型」。
         *
         * 只并**非 DeepSeek 供应 商**的行：DeepSeek 通道的调用平台已经按模型计过，
         * 再把本机同名行加进来就是重复计数（与卡片/总消耗同一条合并规则）。
         */
        const localModels = this.localOtherModelRows();
        const models = [...platformModels, ...localModels];
        const years = Object.entries(report.yearly)
            .map(([key, s]) => ({ key, label: `${key} 年`, stat: s }))
            .sort((a, b) => a.key.localeCompare(b.key)); // py:243 sorted(yearly.keys())
        const months = report.monthly
            .filter((r) => r.stat && !r.error)
            .map((r) => {
            const key = monthKey(r.year, r.month);
            return { key, label: key, stat: toScopeStat(r.stat, r.cost, r.currency ?? currency) };
        });
        // 按天：**当月**明细（详细视图的「当月按天」页签）。
        const now = this.now();
        const w = monthWindow(now);
        const days = this.daysInRange(w.from, w.to)
            .filter((d) => inWindow(d.date, w))
            .map((d) => ({ key: d.date, label: d.date, stat: toScopeStat(d.stat, d.cost, currency) }))
            .filter((r) => isNonEmpty(r.stat))
            .sort((a, b) => b.key.localeCompare(a.key));
        return {
            models,
            years,
            months,
            days,
            ...(localModels.length > 0 ? { modelsIncludeLocal: true } : {}),
            ...this.localDetail(),
        };
    }
    /**
     * 本机口径里**非 DeepSeek 供应商**的模型行（`provider · model`）。
     *
     * 这些是平台账单完全看不到的模型（火山方舟 / 小米 / GLM / GPT…），因此可以安全地
     * 并进「模型」页签；DeepSeek 通道的模型**不并**——平台已按模型计过，再并就是重复。
     * 这些行没有金额（本机日志没有计价能力），表里显示 `—`。
     */
    localOtherModelRows() {
        const local = this.opts.localUsage?.current;
        if (!this.config.localUsage || !local || local.days.length === 0)
            return [];
        const acc = new Map();
        for (const day of local.days) {
            for (const p of day.byProvider) {
                if (isDeepseekProvider(p.provider))
                    continue;
                const models = p.models && p.models.length > 0 ? p.models : [{ model: '', stat: p.stat }];
                for (const m of models) {
                    // key 保持原始通道 id（稳定），label 用中文平台名（可读）。
                    const key = m.model ? `${p.provider} · ${m.model}` : p.provider;
                    const label = m.model ? `${providerLabel(p.provider)} · ${m.model}` : providerLabel(p.provider);
                    let cur = acc.get(key);
                    if (!cur) {
                        cur = { label, provider: p.provider, stat: emptyStat() };
                        acc.set(key, cur);
                    }
                    addInto(cur.stat, m.stat);
                }
            }
        }
        return [...acc.entries()]
            .map(([key, v]) => ({
            key,
            label: v.label,
            stat: toScopeStat(v.stat),
            tag: TIER_LABEL[providerTier(v.provider)],
            tagTitle: providerTierTitle(v.provider),
        }))
            .filter((r) => isNonEmpty(r.stat))
            .sort((a, b) => b.stat.totalTokens - a.stat.totalTokens);
    }
    /**
     * 本机口径的「供应商 · 模型」明细（详细数据页签用）。
     *
     * 平台账单按模型给总量、且只覆盖 DeepSeek 官方通道；这里回答的是另一半：
     * **本机在 DSH 里用过的每一家供应商的每一个模型用了多少**，包括平台完全看不到的
     * 火山方舟 / 小米 / GLM / GPT。数据来自会话日志，因此只覆盖日志还在的那些天。
     */
    localDetail() {
        const local = this.opts.localUsage?.current;
        if (!this.config.localUsage)
            return { localUnavailable: { reason: 'disabled' } };
        if (!local || local.days.length === 0) {
            return { localUnavailable: { reason: local?.reason ?? 'no-session-logs' } };
        }
        /** key 用 `provider · model`（原始通道 id，稳定）；label 用中文平台名（可读）。 */
        const acc = new Map();
        for (const day of local.days) {
            for (const p of day.byProvider) {
                const models = p.models && p.models.length > 0 ? p.models : [{ model: '', stat: p.stat }];
                for (const m of models) {
                    const key = m.model ? `${p.provider} · ${m.model}` : p.provider;
                    const label = m.model ? `${providerLabel(p.provider)} · ${m.model}` : providerLabel(p.provider);
                    let cur = acc.get(key);
                    if (!cur) {
                        cur = { label, provider: p.provider, stat: emptyStat() };
                        acc.set(key, cur);
                    }
                    addInto(cur.stat, m.stat);
                }
            }
        }
        const providers = [...acc.entries()]
            .map(([key, v]) => ({
            key,
            label: v.label,
            stat: toScopeStat(v.stat),
            // 官方 / 第三方按**通道**判定：火山方舟上的 deepseek-v4-flash 属于第三方。
            tag: TIER_LABEL[providerTier(v.provider)],
            tagTitle: providerTierTitle(v.provider),
        }))
            .filter((r) => isNonEmpty(r.stat))
            .sort((a, b) => b.stat.totalTokens - a.stat.totalTokens);
        return {
            providers,
            localRange: {
                from: local.days[0].date,
                to: local.days[local.days.length - 1].date,
                days: local.days.length,
                files: local.totalFiles,
                ...(local.sourceLabel ? { sourceLabel: local.sourceLabel } : {}),
            },
        };
    }
    /**
     * 指定年月的明细（日历查询用）。
     *
     * 逐日数据直接取自历史缓存：每次抓取月份时都把 `days` 一并存了，因此日历能回溯
     * 任意已抓取月份的每一天，而不只是当月。没有该月记录时返回空结构（不是错误）——
     * 日历上表现为「该月无数据」。
     */
    monthDetail(year, month) {
        const row = this.history.get(year, month);
        const currency = row?.currency ?? this.currencyCode;
        const models = row
            ? Object.entries(row.models)
                .map(([key, s]) => {
                const amount = row.costModels?.[key];
                const stat = amount === undefined
                    ? toScopeStat(s)
                    : { ...toScopeStat(s), cost: singleBucketMoney(amount), currency };
                return { key, label: key, stat };
            })
                .filter((r) => isNonEmpty(r.stat))
                .sort((a, b) => b.stat.totalTokens - a.stat.totalTokens)
            : [];
        const days = (row?.days ?? [])
            .map((d) => ({ key: d.date, label: d.date, stat: toScopeStat(d.stat, d.cost, currency) }))
            .sort((a, b) => a.key.localeCompare(b.key));
        return {
            year,
            month,
            stat: row ? toScopeStat(row.stat, row.cost, currency) : toScopeStat(emptyStat()),
            models,
            days,
            currency,
            costAvailable: row?.cost !== undefined,
        };
    }
}
/**
 * 把「一个总额」装进 `Money`。
 *
 * 按模型 / 按接口返回的金额只有总额、没有五类拆分。用一个只填 `PROMPT_TOKEN`
 * 的 `Money` 承载，配合 `moneyTotal()`（对五类求和）就等价于这个总额；
 * UI 侧一律用 `moneyTotal()` 取值，不要直接读某个桶。
 */
function singleBucketMoney(amount) {
    const m = emptyMoney();
    m.PROMPT_TOKEN = amount;
    return m;
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