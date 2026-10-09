/**
 * 用量服务（host 端编排层）：把 token 解析、按月拉取、增量缓存串成一次刷新，维护全量报告与
 * 「今日 / 当周 / 当月 / 近 7 天 / 近 30 天」这些派生口径，最终产出客户端要的快照与详细视图。
 * 窗口口径的合并规则见 `store/usage-merge.ts`。
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
    /** 平台账户概览；取不到时 undefined。 */
    account;
    /** 由 `usage/cost` 带回。 */
    currencyCode = 'CNY';
    /** 同一时刻只允许一个刷新在跑。 */
    inflight;
    /** 最近一次失败，用于「数据可能过期」角标。 */
    lastError;
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
        this.opts.logger?.[level]?.(msg);
    }
    start() {
        return { year: this.config.startYear, month: this.config.startMonth };
    }
    /**
     * 历史区间的终点：取 UTC 月与本地月的较后者 —— 跨月边界（本地已进入下月、UTC 还是上月）时，
     * 保证「本月」卡片所需的数据也已拉取；非边界时刻两者相同。
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
    get loading() {
        return this.inflight !== undefined;
    }
    /** 是否有失败导致的陈旧数据。 */
    get stale() {
        return this.lastError !== undefined;
    }
    /** 判断这次刷新要更新哪些维度：manual 总是全刷，其余按 TTL（总量 30 分钟、当月 5 分钟）。 */
    needsRefresh(reason) {
        if (reason === 'manual')
            return { total: true, current: true };
        const now = this.now().getTime();
        return {
            total: this.lastTotalAt === 0 || now - this.lastTotalAt > this.config.cacheTTL.total,
            current: this.lastCurrentAt === 0 || now - this.lastCurrentAt > this.config.cacheTTL.current,
        };
    }
    /**
     * 后台启动一次刷新并立即返回：首次全量拉取约 31 个月、要几十秒，不能阻塞 RPC/UI，
     * 客户端靠轮询 `snapshot()` 拿进度。
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
     * 在账号会话凭据租约内执行一次刷新：全插件唯一索取该凭据的时机，刷新结束时（正常返回、
     * 提前返回、抛错都算）立刻释放引用，于是令牌不会常驻内存，客户端轮询 snapshot 的热路径也不碰它。
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
    async runRefresh(need, onProgress, signal) {
        // 项目快照读的是宿主会话投影，与平台账单无关，因此放在 token 解析之前：即便没配平台令牌，项目用量的历史也该照常积累。
        await this.recordProjectSnapshots();
        // 本机口径只读本地日志、不发网络请求，且在没有平台凭据时是唯一的数据来源，所以与平台拉取并行启动：
        // 首次扫描要读上百个日志，串行会把「今日/当月」这些最关心的卡片一起拖慢。平台部分结束后再汇合（见下面的 await localScan）。
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
        // 需要拉取的月份：全量计划（含金额一次性回补）∪ 当月+上月的增量计划。
        const wanted = new Map();
        if (need.total) {
            for (const m of this.history.plan(start, end, false, true).months)
                wanted.set(monthKey(m.year, m.month), m);
        }
        if (need.current) {
            for (const m of this.history.plan(start, end, true).months)
                wanted.set(monthKey(m.year, m.month), m);
        }
        if (wanted.size === 0)
            return;
        // 近月优先：首次全量（或金额回补）要打 31 个月，按升序的话「近 7 天/近 30 天/当月」这些卡片要等
        // 60 多个请求走完才出现数字。倒序让它们几秒内就填好，老月份在后台继续补。聚合与落盘都与顺序无关。
        const months = [...wanted.values()].sort((a, b) => monthIndex(b.year, b.month) - monthIndex(a.year, a.month));
        // 「当月 + 上月」的金额每次刷新都要重取（数据仍在增长），其余月份只在从未抓过时取。
        const alwaysRefresh = new Set(this.history.plan(start, end, true).months.map((m) => monthKey(m.year, m.month)));
        this.progress = { done: 0, total: months.length };
        onProgress?.(0, months.length);
        let anyError;
        let authFailed = false;
        for (let i = 0; i < months.length; i++) {
            const m = months[i];
            const key = monthKey(m.year, m.month);
            // 工具调用带取消信号：一旦被取消就停止后续请求（不记为失败）。
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
                // 金额紧跟同月用量之后请求，不额外节流：节流是为了避免平台限流，同月两端点连打不会触发，首次回补仍是约 30 次等待而不是 62 次。
                const row = this.history.get(m.year, m.month);
                const cost = alwaysRefresh.has(key) || row?.costFetched !== true
                    ? await this.fetchCostFor(token, m, headers, scheme, signal)
                    : undefined;
                this.history.set({
                    year: m.year,
                    month: m.month,
                    stat: agg,
                    models,
                    days: parseDays(result.bizData, cost ?? null),
                    // 即便接口这次没返回 days 也算抓过了，否则每次刷新都会重抓一遍。
                    daysFetched: true,
                    ...(cost
                        ? { cost: cost.total, costModels: cost.models, currency: cost.currency, costFetched: true }
                        : // 本次没抓或抓失败，但缓存里有旧金额：保留，别抹掉。
                            row?.cost
                                ? {
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
                    await this.opts.onAuthInvalid?.(token, e.message);
                    authFailed = true;
                    this.lastError = e;
                    break;
                }
            }
            this.progress = { done: i + 1, total: months.length };
            onProgress?.(i + 1, months.length);
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
            // 账户概览：一次请求，单独失败不影响用量。
            await this.refreshAccount(token, headers, scheme, signal);
        }
        // 与平台拉取并行的本机扫描在这里汇合，让本次刷新产出的快照里两路口径都已就绪（否则第一屏会显示平台口径的当天 0）。
        if (localScan)
            await localScan;
        this.lastError = anyError;
        this.opts.onChanged?.();
        const total = this.history.toReport(start, end).grand.totalTokens;
        this.log('info', `tlogs: 刷新完成（${months.length} 个月，总计 ${total} tokens${anyError ? `，存在失败：${anyError.message}` : ''}）`);
    }
    /** 拉取某月金额。失败不影响该月用量：金额缺失只让界面少一列，而把整月判失败会把已拿到的 token 数据一起丢掉。 */
    async fetchCostFor(token, m, headers, scheme, signal) {
        const label = monthKey(m.year, m.month);
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
                this.log('warn', `tlogs: ${label} 金额拉取失败 —— ${r.error.message}`);
                return undefined;
            }
            return parseCost(r.bizData);
        }
        catch (e) {
            if (signal?.aborted)
                return undefined;
            this.log('warn', `tlogs: ${label} 金额请求异常 —— ${e instanceof Error ? e.message : String(e)}`);
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
     * 取某个本地日历闭区间内的逐日明细：直接按月从历史缓存读，而不是只持有「当月」副本 ——
     * 近 30 天可能横跨两三个自然月，且重启后历史已由 `deserialize` 恢复，读缓存比内存副本更可靠。
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
     * 平台口径 + 本机口径合并后的窗口值（逐日取大后求和）；平台当天数据要等结算（通常滞后 10~30 分钟）、也看不到非
     * DeepSeek 供应商，合并规则与理由见 `store/usage-merge.ts`。
     */
    mergedWindow(w) {
        const localDays = this.config.localUsage ? (this.opts.localUsage?.current.days ?? []) : [];
        const platformDays = this.daysInRange(w.from, w.to).filter((d) => inWindow(d.date, w));
        return mergeWindow(platformDays, localDays, w);
    }
    /**
     * 总消耗：平台全部月份合计 + 本机补充（平台看不到的供应商 + 当天未结算的差额）；平台全量只等于
     * 「官方通道 + 已结算」，合并项不会与平台重复（见 `store/usage-merge.ts` 的 `mergeTotal`）。
     * 覆盖边界：本机日志只覆盖它能扫到的那些天（DSH 会清理旧日志），界面会标注区间。
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
            // 下发展示名（`xiaomi` → `小米`），tooltip 里直接可读。
            otherProviders: m.otherProviders.map((p) => ({ provider: providerLabel(p.provider), tokens: p.tokens })),
            costPending: m.costPending,
        };
    }
    windowCard(scope, label, w) {
        return { scope, label, stat: w.stat, stale: this.stale, source: this.sourceInfo(w) };
    }
    async buildCards() {
        const now = this.now();
        const cards = [
            this.windowCard('total', '总消耗 Token', this.mergedTotal()),
        ];
        if (this.config.enableProjectScope) {
            const provider = this.opts.projectProvider;
            let options = [];
            if (provider?.available()) {
                options = await this.readProjectOptions();
            }
            cards.push(options.length > 0
                ? { scope: 'total', label: '当前项目消耗', stat: options[0].stat, options, selectedOptionId: options[0].id }
                : {
                    scope: 'total',
                    label: '当前项目消耗',
                    stat: toScopeStat(emptyStat()),
                    error: '当前项目统计不可用',
                });
        }
        // 今日、当周、当月、近 7 天、近 30 天：滚动窗口与自然日历刻意并列，两者在月初/周一附近会明显不同，摆在一起才能解释「为什么数字不一样」。
        cards.push(this.windowCard('today', '今日消耗', this.mergedWindow(todayWindow(now))));
        cards.push(this.windowCard('week', '当周消耗', this.mergedWindow(weekWindow(now))));
        cards.push(this.windowCard('month', '当月消耗', this.mergedWindow(monthWindow(now))));
        cards.push(this.windowCard('last7', '近 7 天', this.mergedWindow(rollingWindow(ROLLING_DAYS.last7, now))));
        cards.push(this.windowCard('last30', '近 30 天', this.mergedWindow(rollingWindow(ROLLING_DAYS.last30, now))));
        return cards;
    }
    /** 读取项目内某个对象的用量（供卡片切换）。 */
    async projectStat(projectId) {
        const provider = this.opts.projectProvider;
        if (!provider?.available())
            return toScopeStat(emptyStat());
        try {
            const hit = (await provider.list()).find((o) => o.id === projectId);
            return toScopeStat(hit?.stat ?? emptyStat());
        }
        catch {
            return toScopeStat(emptyStat());
        }
    }
    /**
     * 当前可用的项目选项（不可用时为空数组）。id 一律是不可逆短哈希，绝不能给原始 cwd：这个列表会经
     * `query_token_usage` 工具返回，而工具返回值直接进模型上下文，本机绝对路径会因此被发给模型提供方；UI 只显示 label，路径对外没有任何用途。
     */
    async projectOptions() {
        const provider = this.opts.projectProvider;
        if (!provider?.available())
            return [];
        return this.readProjectOptions();
    }
    async readProjectOptions() {
        try {
            return (await this.opts.projectProvider.list()).map((o) => ({
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
     * 供图表使用的项目列表，id 与 `projectOptions()` 同一口径，与「当前项目消耗」卡片共用开关：
     * 关掉就彻底不遍历会话、不读 cwd，图表里也就没有项目可选、更不会记录任何快照。
     */
    async projectList() {
        if (!this.config.enableProjectScope)
            return [];
        const provider = this.opts.projectProvider;
        if (!provider?.available())
            return [];
        try {
            return (await provider.list()).map((o) => ({
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
     * 记录本机各项目的当日累计快照（一天一条，重复记录覆盖）；由 `runRefresh` 在每次真正刷新时调用，
     * 定时刷新保证一天之内必然留下快照。
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
     * 把图表范围解析成明确的本地日历日闭区间：归一化放在 host 侧（本地日历、周一为一周之始、
     * 不得晚于今天），客户端只传语义化的 range 或自定义起止日，免得两端各写一套。
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
                // RPC 已校验格式与 from <= to；这里再防御性裁剪，不给出空未来段。
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
     * 图表数据：范围 × 项目 × 指标所需的全部原始数字。只做聚合与范围裁剪，不做「取哪个指标」的选择 ——
     * 那是客户端的事。返回的 `stat` 始终是原始五类计量项，因此同一份响应可以画出总 Token / 输入 /
     * 输出 / 缓存命中 / 缓存未命中 / 请求数六种图，无需重新请求。
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
                // 该月没有成功数据，贡献 0，但要让 UI 知道这段是缺的，否则会被读成「当月没用量」。
                partial = true;
                costPartial = true;
                continue;
            }
            if (row.cost) {
                months.push({ key, stat: { ...row.stat }, cost: moneyTotal(row.cost) });
                addMoneyInto(rangeCost, row.cost);
            }
            else {
                // 金额还没回补到：标出「金额不完整」，否则曲线会静默地把缺的月份当 0。
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
        // 逐日：只有抓到过 days 的月份才有，缺天的月份由 partial 标出。
        const days = [];
        for (const u of usable) {
            if (u.days.length === 0) {
                partial = true;
                continue;
            }
            for (const d of u.days) {
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
            // 把最后一个点替换成当前实时值：快照最多一天一新，而项目卡片读的是实时投影，不覆盖曲线终点就会与卡片数字对不上。
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
    /** 同步读取某个范围的统计（不触发网络、不触发项目查询）；供模型工具使用，刷新由调用方先执行 `refresh()`。 */
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
        /** 紧凑条 tooltip 据此说明「这个数不是平台给的」。 */
        const sourceOf = (scope) => cards.find((c) => c.scope === scope)?.source?.kind;
        /** 尚未回补完时只是部分合计，由 `costComplete` 标注。 */
        const moneyOf = (scope) => scope === 'total' ? moneyTotal(report.grand.cost) : moneyTotal(cardOf(scope).cost);
        // 一个 scope 可能产出两项（今日 token 后面紧跟着今日请求数），所以用 flatMap。
        const compact = this.config.compactMetrics.flatMap((metric) => {
            const tokens = (scope, label) => ({
                scope,
                label,
                value: cardOf(scope).totalTokens,
                source: sourceOf(scope),
            });
            const money = (scope, label) => ({
                scope,
                label,
                value: moneyOf(scope),
                unit: 'money',
            });
            switch (metric) {
                // 金额不在这里顺带输出：需要金额就显式写 `cost_total`，否则 `[total, cost_total]` 会出现两个相同的值。
                case 'total':
                    return [tokens('total', '总')];
                case 'today':
                    return [
                        tokens('today', '今日'),
                        { scope: 'today', label: '请求', value: cardOf('today').requests, unit: 'requests', source: sourceOf('today') },
                    ];
                case 'week':
                    return [tokens('week', '本周')];
                case 'month':
                    return [tokens('month', '本月')];
                case 'last7':
                    return [tokens('last7', '近 7 天')];
                case 'last30':
                    return [tokens('last30', '近 30 天')];
                case 'cost_total':
                    return [money('total', '总 ¥')];
                case 'cost_today':
                    return [money('today', '今 ¥')];
                case 'cost_last7':
                    return [money('last7', '7日 ¥')];
                case 'cost_last30':
                    return [money('last30', '30日 ¥')];
            }
        });
        const local = this.opts.localUsage?.current;
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
                        available: local?.available ?? false,
                        ...(local?.reason ? { reason: local.reason } : {}),
                        days: local?.days.length ?? 0,
                        files: local?.totalFiles ?? 0,
                        updatedAt: local?.updatedAt ?? 0,
                        ...(local?.sourceLabel ? { sourceLabel: local.sourceLabel } : {}),
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
        // 平台口径的模型行：只含 DeepSeek 官方通道，带官方金额（模型维度只有总额，用 singleBucketMoney 承载，UI 一律走 moneyTotal 取值）。
        const platformModels = Object.entries(report.models)
            .map(([key, s]) => {
            const amount = report.modelCosts[key];
            const stat = amount === undefined ? s : { ...s, cost: singleBucketMoney(amount), currency: report.currency };
            return { key, label: key, stat, tag: OFFICIAL_BILLING_TAG, tagTitle: OFFICIAL_BILLING_TITLE };
        })
            .filter((r) => isNonEmpty(r.stat))
            .sort((a, b) => b.stat.totalTokens - a.stat.totalTokens);
        // 模型页签也要能看见别家平台的模型（火山方舟 / 小米 / GLM / GPT…）：平台账单里根本没有它们。只并非 DeepSeek 通道的行 —— 该通道平台已按模型计过。
        const localModels = this.localOtherModelRows();
        const models = [...platformModels, ...localModels];
        const years = Object.entries(report.yearly)
            .map(([key, s]) => ({ key, label: `${key} 年`, stat: s }))
            .sort((a, b) => a.key.localeCompare(b.key));
        const months = report.monthly
            .filter((r) => r.stat && !r.error)
            .map((r) => {
            const key = monthKey(r.year, r.month);
            return { key, label: key, stat: toScopeStat(r.stat, r.cost, r.currency ?? currency) };
        });
        const w = monthWindow(this.now());
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
     * 本机口径里非 DeepSeek 供应商的模型行（`provider · model`）：平台账单完全看不到这些模型，
     * 所以可以安全地并进「模型」页签。没有金额：本机会话日志不具备计价能力。
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
                for (const m of modelsOf(p)) {
                    accumulate(acc, p.provider, m.model, m.stat);
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
     * 本机口径的「供应商 · 模型」明细（详细数据页签用）：平台账单按模型给总量、且只覆盖 DeepSeek
     * 官方通道，这里回答另一半 —— 本机用过的每家供应商的每个模型用了多少。数据来自会话日志，所以只覆盖日志还在的那些天。
     */
    localDetail() {
        const local = this.opts.localUsage?.current;
        if (!this.config.localUsage)
            return { localUnavailable: { reason: 'disabled' } };
        if (!local || local.days.length === 0) {
            return { localUnavailable: { reason: local?.reason ?? 'no-session-logs' } };
        }
        const acc = new Map();
        for (const day of local.days) {
            for (const p of day.byProvider) {
                for (const m of modelsOf(p)) {
                    accumulate(acc, p.provider, m.model, m.stat);
                }
            }
        }
        const providers = [...acc.entries()]
            .map(([key, v]) => ({
            key,
            label: v.label,
            stat: toScopeStat(v.stat),
            // 官方 / 第三方按通道判定：火山方舟上的 deepseek-v4-flash 属于第三方。
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
     * 指定年月的明细（日历查询用）：逐日数据取自历史缓存（抓取月份时把 days 一并存了），
     * 所以日历能回溯任意已抓取月份的每一天。没有该月记录时返回空结构而不是错误，日历上表现为「该月无数据」。
     */
    monthDetail(year, month) {
        const row = this.history.get(year, month);
        const currency = row?.currency ?? this.currencyCode;
        const models = row
            ? Object.entries(row.models)
                .map(([key, s]) => {
                const amount = row.costModels?.[key];
                const stat = amount === undefined ? toScopeStat(s) : { ...toScopeStat(s), cost: singleBucketMoney(amount), currency };
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
/** 一个供应商下的模型拆分；日志没给模型名时按供应商本身计一行。 */
function modelsOf(p) {
    return p.models && p.models.length > 0 ? p.models : [{ model: '', stat: p.stat }];
}
/** key 用原始通道 id（稳定），label 用中文平台名（可读）。 */
function accumulate(acc, provider, model, stat) {
    const key = model ? `${provider} · ${model}` : provider;
    let cur = acc.get(key);
    if (!cur) {
        cur = { label: model ? `${providerLabel(provider)} · ${model}` : providerLabel(provider), provider, stat: emptyStat() };
        acc.set(key, cur);
    }
    addInto(cur.stat, stat);
}
/**
 * 把「一个总额」装进 `Money`：按模型或按接口返回的金额只有总额、没有五类拆分，用一个只填
 * `PROMPT_TOKEN` 的 `Money` 承载，配合 `moneyTotal()`（对五类求和）就等价于这个总额；
 * UI 侧一律用 `moneyTotal()` 取值，不要直接读某个桶。
 */
function singleBucketMoney(amount) {
    const m = emptyMoney();
    m.PROMPT_TOKEN = amount;
    return m;
}
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