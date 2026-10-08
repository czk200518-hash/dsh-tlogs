/**
 * tlogs — 历史数据存储与按月增量拉取。
 *
 * 对应需求 3.4「时间范围拉取」与需求零.5「历史全量拉取策略」：
 *  - 从 2024-04 起逐月拉到当前月（与 Python 的 START_YEAR / START_MONTH 一致）
 *  - 首次全量拉取后缓存，后续只拉增量月份（当月 + 上月，处理跨月边界）
 *  - 请求之间节流（对应 Python 的 time.sleep(REQUEST_INTERVAL)）
 *
 * 聚合口径与 Python main() 的 `grand` / `model_totals` / `yearly` 完全一致：
 *  - 只累加**拉取成功**的月份（失败月份在 Python 里 stat 为空 Stat，贡献为 0）
 *  - 总 Token = input + output，input = PROMPT + CACHE_HIT + CACHE_MISS
 */
import { emptyMoney, emptyStat, TOKEN_TYPES, } from '../types.js';
import { addInto, addMoneyInto, toScopeStat } from '../api/parser.js';
/** 一年 12 个月的常量。 */
const MONTHS_PER_YEAR = 12;
/**
 * 从任意输入读出一个 `Money`；非法/全空返回 undefined。
 *
 * 归一化策略与 `Stat` 一致（缺键补 0、非有限数补 0），但**额外要求至少有一个非 0 项**：
 * 旧缓存没有 `cost` 字段，如果这里容忍空对象，`plan()` 就会认为该月已抓到金额而
 * 永远不再回补（与当年 `days` 丢字段导致 29 个月日历空白是同一类 bug）。
 */
function readMoney(v) {
    if (!v || typeof v !== 'object')
        return undefined;
    const out = emptyMoney();
    let any = false;
    for (const t of TOKEN_TYPES) {
        const raw = v[t];
        const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
        out[t] = n;
        if (n !== 0)
            any = true;
    }
    return any ? out : undefined;
}
/** 由年、月构造键。 */
export function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}
/** 解析月份键。非法输入返回 undefined。 */
export function parseMonthKey(key) {
    const m = /^(\d{4})-(\d{2})$/.exec(key);
    if (!m)
        return undefined;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12)
        return undefined;
    return { year, month };
}
/** 前进一个月。等价于 Python `month += 1; if month > 12: month = 1; year += 1`（py:190-193）。 */
export function nextMonth(year, month) {
    return month >= MONTHS_PER_YEAR ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}
/** 后退一个月（用于「当月 + 上月」增量策略）。 */
export function prevMonth(year, month) {
    return month <= 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}
/** 月份序数，用于比较与差值（等于 Python 的 `(y*12+m)` 口径）。 */
export function monthIndex(year, month) {
    return year * MONTHS_PER_YEAR + (month - 1);
}
/** 枚举闭区间 [start, end] 内的所有月份，按时间升序。 */
export function enumerateMonths(start, end) {
    const out = [];
    let cur = { ...start };
    const endIdx = monthIndex(end.year, end.month);
    // 上界防御：范围异常时不至于死循环。
    const startIdx = monthIndex(cur.year, cur.month);
    if (startIdx > endIdx)
        return out;
    while (monthIndex(cur.year, cur.month) <= endIdx) {
        out.push(cur);
        cur = nextMonth(cur.year, cur.month);
    }
    return out;
}
/** 由 Date 取出 UTC 的年月，对应 Python `datetime.now(timezone.utc)`（py:141）。 */
export function utcYearMonth(d) {
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
/** 由 Date 取出**本地**的年月，用于「今日/当周/当月」的本地日历切片。 */
export function localYearMonth(d) {
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
/**
 * 按月历史存储。
 *
 * 只保存成功月份的明细；失败月份记入 `failed` 集合，避免把它当成「0 用量」。
 * 这一点很关键：Python 会把失败月份当作空 Stat 参与按年统计（贡献 0），
 * 因此「总计」在存在失败月份时是**不完整**的，UI 必须能表达这个状态。
 */
export class HistoryStore {
    rows = new Map();
    /** 最近一次拉取失败的月份键。 */
    failed = new Set();
    /** 每个月份键的最后失败原因。 */
    failureReasons = new Map();
    lastUpdatedAt = null;
    /** 写入/覆盖一个月的结果。 */
    set(row) {
        const key = monthKey(row.year, row.month);
        this.rows.set(key, row);
        if (row.error) {
            this.failed.add(key);
            this.failureReasons.set(key, row.error);
        }
        else {
            this.failed.delete(key);
            this.failureReasons.delete(key);
        }
        this.lastUpdatedAt = Date.now();
    }
    /** 读取一个月。 */
    get(year, month) {
        return this.rows.get(monthKey(year, month));
    }
    /** 已成功保存的月份数量。 */
    get size() {
        return this.rows.size;
    }
    /** 是否存在任何失败月份。 */
    get hasFailures() {
        return this.failed.size > 0;
    }
    /** 失败月份列表（升序）。 */
    failedMonths() {
        return [...this.failed].sort();
    }
    /** 最后成功更新时间。 */
    get updatedAt() {
        return this.lastUpdatedAt;
    }
    /**
     * 规划待拉取月份。
     *
     * @param start  区间起点（默认 2024-04，与 Python 一致）
     * @param end    区间终点（当前月）
     * @param incremental true = 只拉「当月 + 上月」（后续刷新）；
     *                    false = 拉取区间内所有尚未成功缓存的月份（首次全量）
     * @param needCost 是否要求这些月份也带金额。true 时缺金额的月份会被一并挑出
     *                 （一次性回补，见 `costFetched`）。默认 false，保持与 Python 的对拍口径
     *                 只依赖 token 数据。
     */
    plan(start, end, incremental, needCost = false) {
        const all = enumerateMonths(start, end);
        if (all.length === 0)
            return { months: [], full: true };
        if (incremental) {
            const prev = prevMonth(end.year, end.month);
            // 「当月 + 上月」，裁剪到区间内并去重（避免 start 就是上个月时重复）。
            const startIdx = monthIndex(start.year, start.month);
            const picked = [];
            for (const m of [end, prev]) {
                if (monthIndex(m.year, m.month) < startIdx)
                    continue;
                if (picked.some((x) => x.year === m.year && x.month === m.month))
                    continue;
                picked.push(m);
            }
            picked.sort((a, b) => monthIndex(a.year, a.month) - monthIndex(b.year, b.month));
            return { months: picked, full: false };
        }
        // 全量：跳过已经成功缓存的月份。失败月份必须重试，因此不跳过。
        //
        // 另需**一次性回补**逐日明细：早期版本抓到的月份没存 `days`，这类行「有统计、
        // 无错误」，按旧逻辑会被永久跳过 —— 日历因此对 29 个月都只能显示「—」（实测）。
        // 把「缺少 daysFetched 标记」也视为不完整，让它们被重抓一次；抓完即打标记，
        // 即便接口当月没返回 days 也不会反复重抓。
        //
        // `costFetched` 是同一套机制的第二个用途：金额能力上线后，老的缓存行没有 `cost`，
        // 会被挑出来重抓一次（这一次要多打一遍 `usage/cost`）。
        const months = all.filter((m) => {
            const key = monthKey(m.year, m.month);
            if (this.failed.has(key))
                return true;
            const row = this.rows.get(key);
            if (!row)
                return true;
            // 已经抓过（有标记），或已经带着非空逐日明细 —— 都算完整，跳过。
            if (needCost && row.costFetched !== true)
                return true;
            if (row.daysFetched === true)
                return false;
            if (row.days && row.days.length > 0)
                return false;
            return true;
        });
        const full = months.length === all.length;
        return { months, full };
    }
    /**
     * 金额是否已覆盖区间内所有月份。
     *
     * 未覆盖时界面上的「总金额」只是**部分合计**（例如首次启用金额能力、历史还在回补），
     * 必须让 UI 能表达这一点，否则用户会以为总额就这么点。
     *
     * 三种状态的判定（很关键，写错任意一条都会静默给出错误的总额）：
     *  - 该月**从没抓到过**（没有行）→ 不完整。注意不能 `continue` 跳过：全新安装时
     *    一行都没有，跳过就会直接报「完整」，于是首次全量拉取期间界面显示
     *    「总 ¥0.00」并宣称完整（实测踩过）。
     *  - 该月**拉取失败** → 跳过。「金额缺失」与「这个月拉不到」是两回事，
     *    后者由 `stale` 角标表达；否则一个失败月份会让金额永远显示「统计中」。
     *  - 该月有行但没打过 `costFetched` → 不完整（待回补）。
     */
    costComplete(start, end) {
        for (const m of enumerateMonths(start, end)) {
            const key = monthKey(m.year, m.month);
            const row = this.rows.get(key);
            if (row?.error)
                continue;
            if (!row)
                return false;
            if (row.costFetched !== true)
                return false;
        }
        return true;
    }
    /** 区间内是否每月都有成功数据（用于判断「总计」是否完整）。 */
    isComplete(start, end) {
        for (const m of enumerateMonths(start, end)) {
            const key = monthKey(m.year, m.month);
            if (!this.rows.has(key) || this.failed.has(key))
                return false;
        }
        return true;
    }
    /**
     * 汇总为报告。聚合顺序与 Python main() 完全一致：
     * 逐月累加 grand 与 model_totals，按年归档 monthly_rows。
     */
    toReport(start, end) {
        const grand = emptyStat();
        const modelTotals = {};
        const monthly = [];
        const yearStats = {};
        // 金额侧与 token 侧并行累加，口径完全一致（只算成功的月份）。
        const grandCost = emptyMoney();
        const modelCosts = {};
        const yearCosts = {};
        let currency = 'CNY';
        let sawCost = false;
        for (const m of enumerateMonths(start, end)) {
            const key = monthKey(m.year, m.month);
            const row = this.rows.get(key);
            if (!row || row.error) {
                // 与 Python 一致：失败月份贡献空 Stat（全 0），但仍占位。
                monthly.push(row ?? { year: m.year, month: m.month, stat: emptyStat(), models: {}, error: this.failureReasons.get(key) });
                continue;
            }
            // py:169-171  grand[t] += agg[t]
            addInto(grand, row.stat);
            // py:172-174  model_totals
            for (const [model, s] of Object.entries(row.models)) {
                let mm = modelTotals[model];
                if (!mm) {
                    mm = emptyStat();
                    modelTotals[model] = mm;
                }
                for (const t of TOKEN_TYPES)
                    mm[t] += s[t];
            }
            const yKey = String(m.year);
            let yStat = yearStats[yKey];
            if (!yStat) {
                yStat = emptyStat();
                yearStats[yKey] = yStat;
            }
            // py:240-242
            addInto(yStat, row.stat);
            // 金额：月度五类拆分 → 总计 / 按年；按模型只累加总额（`costModels` 本身就只有总额）。
            if (row.cost) {
                sawCost = true;
                if (row.currency)
                    currency = row.currency;
                addMoneyInto(grandCost, row.cost);
                let yc = yearCosts[yKey];
                if (!yc) {
                    yc = emptyMoney();
                    yearCosts[yKey] = yc;
                }
                addMoneyInto(yc, row.cost);
            }
            for (const [model, amount] of Object.entries(row.costModels ?? {})) {
                modelCosts[model] = (modelCosts[model] ?? 0) + amount;
            }
            monthly.push(row);
        }
        const yearly = {};
        for (const [y, s] of Object.entries(yearStats)) {
            yearly[y] = toScopeStat(s, sawCost ? yearCosts[y] : undefined, currency);
        }
        const models = {};
        for (const [k, s] of Object.entries(modelTotals)) {
            // 模型维度只有总额，没有五类拆分；把总额塞进 `Money` 的某个桶（例如
            // PROMPT_TOKEN）会让「输入成本」显示成一个混合值。因此总额由 `modelCosts`
            // 单独携带，UI 取 `report.modelCosts[model]`。
            models[k] = toScopeStat(s);
        }
        return {
            generatedAt: new Date().toISOString(),
            range: { start: monthKey(start.year, start.month), end: monthKey(end.year, end.month) },
            grand: toScopeStat(grand, sawCost ? grandCost : undefined, currency),
            yearly,
            models,
            modelCosts,
            currency,
            costComplete: this.costComplete(start, end),
            monthly,
        };
    }
    /** 清空（退出登录时调用）。 */
    clear() {
        this.rows.clear();
        this.failed.clear();
        this.failureReasons.clear();
        this.lastUpdatedAt = null;
    }
    /**
     * 序列化为可持久化 JSON（不含任何凭据）。
     *
     * 刻意**不落盘 `error`**：那是平台响应体的截断回显（最多 200 字符），
     * 属于外部输入，写进本地文件没有收益、只有风险。错误信息在内存里保留，
     * 用于当次会话的 UI 展示；重启后由下一次刷新重新填充。
     */
    serialize() {
        const rows = [...this.rows.values()]
            .sort((a, b) => monthIndex(a.year, a.month) - monthIndex(b.year, b.month))
            .map((row) => ({
            year: row.year,
            month: row.month,
            stat: row.stat,
            models: row.models,
            days: row.days,
            // 必须一并持久化：否则每次重启都会把全部月份判为「需要回补」，白跑 31 个请求。
            daysFetched: row.daysFetched,
            cost: row.cost,
            costModels: row.costModels,
            currency: row.currency,
            // 同理：不持久化就会每次重启都重打一遍 usage/cost（31 次请求）。
            costFetched: row.costFetched,
        }));
        return { rows, savedAt: new Date().toISOString() };
    }
    /** 从持久化 JSON 恢复。非法输入静默忽略，保证插件不会因坏缓存起不来。 */
    static deserialize(data) {
        const store = new HistoryStore();
        if (!data || typeof data !== 'object')
            return store;
        const rows = data.rows;
        if (!Array.isArray(rows))
            return store;
        for (const row of rows) {
            if (!row || typeof row !== 'object')
                continue;
            const r = row;
            if (typeof r.year !== 'number' || typeof r.month !== 'number')
                continue;
            if (!r.stat || typeof r.stat !== 'object')
                continue;
            // 归一化：缺键一律补 0，防止旧版本缓存缺字段导致 NaN 扩散。
            const stat = emptyStat();
            for (const t of TOKEN_TYPES) {
                const v = r.stat[t];
                stat[t] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
            }
            const models = {};
            if (r.models && typeof r.models === 'object') {
                for (const [name, s] of Object.entries(r.models)) {
                    const ms = emptyStat();
                    for (const t of TOKEN_TYPES) {
                        const v = s?.[t];
                        ms[t] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
                    }
                    models[name] = ms;
                }
            }
            // 逐日明细必须一并恢复。
            //
            // 这里原先只重建了 stat/models，把 days 丢掉了 —— 后果是：每次重启后缓存里的
            // 逐日明细全部失效，日历只能显示当月/上月（那两个月会被增量刷新重抓），
            // 而其余月份因为 daysFetched 已为 true、计划器不会再回补，会**永久空白**。
            const days = [];
            if (Array.isArray(r.days)) {
                for (const d of r.days) {
                    if (!d || typeof d !== 'object')
                        continue;
                    const dd = d;
                    if (typeof dd.date !== 'string' || !dd.stat || typeof dd.stat !== 'object')
                        continue;
                    const ds = emptyStat();
                    for (const t of TOKEN_TYPES) {
                        const v = dd.stat[t];
                        ds[t] = typeof v === 'number' && Number.isFinite(v) ? v : 0;
                    }
                    const entry = { date: dd.date, stat: ds };
                    const dc = readMoney(dd.cost);
                    if (dc)
                        entry.cost = dc;
                    days.push(entry);
                }
            }
            // 金额：与 days 同理，不恢复就等于每次重启都重打一遍 usage/cost。
            const cost = readMoney(r.cost);
            let hasCost = false;
            if (cost) {
                for (const t of TOKEN_TYPES)
                    if (cost[t] !== 0)
                        hasCost = true;
            }
            const costModels = {};
            if (r.costModels && typeof r.costModels === 'object') {
                for (const [name, v] of Object.entries(r.costModels)) {
                    if (typeof v === 'number' && Number.isFinite(v))
                        costModels[name] = v;
                }
            }
            // daysFetched 只在明确为 true 时才带上：旧缓存没有该字段 → undefined →
            // 计划器会把该月判为「需要回补逐日明细」，这正是我们想要的一次性迁移。
            const stored = { year: r.year, month: r.month, stat, models };
            if (days.length > 0)
                stored.days = days;
            if (r.daysFetched === true)
                stored.daysFetched = true;
            if (hasCost && cost)
                stored.cost = cost;
            if (Object.keys(costModels).length > 0)
                stored.costModels = costModels;
            if (typeof r.currency === 'string' && r.currency)
                stored.currency = r.currency;
            // 与 daysFetched 同样只认明确的 true：旧缓存（无 cost）会被一次性回补。
            if (r.costFetched === true)
                stored.costFetched = true;
            store.rows.set(monthKey(r.year, r.month), stored);
        }
        return store;
    }
}
//# sourceMappingURL=history.js.map