/**
 * tlogs — 历史数据存储与按月增量拉取。从 2024-04 起逐月拉到当前月，请求之间做节流；首次全量拉完就缓存下来，
 * 之后每次只拉「当月 + 上月」这两个月，以覆盖跨月边界。
 *
 * 聚合口径：只累加拉取成功的月份（失败月份在 Python 参考实现里是空 Stat，贡献为 0），
 * 总 Token = input + output，其中 input = PROMPT + CACHE_HIT + CACHE_MISS。
 */
import { emptyMoney, emptyStat, TOKEN_TYPES, } from '../types.js';
import { addInto, addMoneyInto, toScopeStat } from '../api/parser.js';
const MONTHS_PER_YEAR = 12;
/**
 * 从任意输入读出一个 `Money`；缺键补 0、非有限数补 0，但要求至少有一个非 0 项，全空返回 undefined。
 * 那个「至少一个非 0」不能放宽：没有 `cost` 字段的缓存行如果在这里被认成合法金额，
 * `plan()` 会认为该月金额已抓到而永不回补。
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
export function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}
/** 解析月份键，非法输入返回 undefined。 */
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
export function nextMonth(year, month) {
    return month >= MONTHS_PER_YEAR ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}
/** 用于「当月 + 上月」的增量策略。 */
export function prevMonth(year, month) {
    return month <= 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}
/** 月份序数，用于比较与求差。 */
export function monthIndex(year, month) {
    return year * MONTHS_PER_YEAR + (month - 1);
}
/** 闭区间 `[start, end]` 内的所有月份，升序。 */
export function enumerateMonths(start, end) {
    const out = [];
    let cur = { ...start };
    const endIdx = monthIndex(end.year, end.month);
    const startIdx = monthIndex(cur.year, cur.month);
    // 起点晚于终点直接返回空，省得下面死循环。
    if (startIdx > endIdx)
        return out;
    while (monthIndex(cur.year, cur.month) <= endIdx) {
        out.push(cur);
        cur = nextMonth(cur.year, cur.month);
    }
    return out;
}
export function utcYearMonth(d) {
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
/** 用于本地日历切片（窗口卡片走平台日口径，见 dates.ts）。 */
export function localYearMonth(d) {
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
/**
 * 按月历史存储。只保存成功月份的明细；失败月份记进 `failed`，不能当成「0 用量」。失败月份会以
 * 空 Stat 参与按年统计（贡献 0），所以存在失败月份时「总计」是不完整的，UI 必须能把状态表达出来。
 */
export class HistoryStore {
    rows = new Map();
    failed = new Set();
    /** 每个月份键的最后失败原因。 */
    failureReasons = new Map();
    lastUpdatedAt = null;
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
    get(year, month) {
        return this.rows.get(monthKey(year, month));
    }
    /** 含失败月份的行。 */
    get size() {
        return this.rows.size;
    }
    get hasFailures() {
        return this.failed.size > 0;
    }
    /** 失败月份列表，升序。 */
    failedMonths() {
        return [...this.failed].sort();
    }
    get updatedAt() {
        return this.lastUpdatedAt;
    }
    /**
     * 规划待拉取的月份。`incremental` 为 true 时只返回「当月 + 上月」（后续刷新用）；为 false 时返回区间内
     * 所有尚未成功缓存的月份（首次全量）。`needCost` 为 true 时，缺少金额的月份也会被挑出来补一次。
     */
    plan(start, end, incremental, needCost = false) {
        const all = enumerateMonths(start, end);
        if (all.length === 0)
            return { months: [], full: true };
        if (incremental) {
            const prev = prevMonth(end.year, end.month);
            // 「当月 + 上月」，裁到区间内并去重（start 恰好是上月时会出现重复）。
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
        // 全量模式：跳过已经成功缓存的月份，失败月份不跳（必须重试）。`daysFetched` / `costFetched` 是逐日明细与
        // 金额各自的「已抓过」凭据：没有凭据的行不该算完整 —— 它有统计、无错误，一旦被跳过就再也不会重抓，
        // 逐日与金额都补不回来；抓到之后打上凭据，即便接口该月没返回 days 也不会反复重抓。
        const months = all.filter((m) => {
            const key = monthKey(m.year, m.month);
            if (this.failed.has(key))
                return true;
            const row = this.rows.get(key);
            if (!row)
                return true;
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
     * 金额是否已覆盖区间内所有月份。未覆盖时界面上的「总金额」只是部分合计，需要让 UI 说出来，
     * 否则用户会以为总额就这么点。逐个判断，三条都不能写错：
     *  - 没有行 → 不完整。这里不能 `continue` 跳过：全新安装时一行都没有，跳过就直接报「完整」，
     *    首次全量拉取期间会显示「总 ¥0.00」还宣称完整。
     *  - 拉取失败的行 → 跳过。「金额缺失」与「这个月拉不到」是两回事，后者由 `stale` 角标表达；否则一个失败月份会让金额永远停在「统计中」。
     *  - 有行但没打过 `costFetched` → 不完整，等待回补。
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
    /** 汇总为报告：逐月累加总计与按模型合计，按月归档，再到按年归集。 */
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
                // 失败月份贡献空 Stat（全 0），但仍在 monthly 里占位。
                monthly.push(row ?? { year: m.year, month: m.month, stat: emptyStat(), models: {}, error: this.failureReasons.get(key) });
                continue;
            }
            addInto(grand, row.stat);
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
            addInto(yStat, row.stat);
            // 月度金额带五类拆分，按模型只有总额（`costModels` 本身就不拆）。
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
            // 模型维度只有金额总额，没有五类拆分；塞进 `Money` 的某个桶会让「输入成本」
            // 变成一个混合值。所以总额由 `modelCosts` 单独携带，UI 读 `report.modelCosts`。
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
     * 序列化为可持久化 JSON，不含任何凭据。不落盘 `error`：那是平台响应体的截断回显（最多 200 字符），
     * 属于外部输入，写进本地文件没有收益。错误信息留在内存里供当次会话展示，重启后由下一次刷新填回。
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
            // 这两个标记必须落盘：否则每次重启都会把全部月份判成「待回补」，白跑一轮请求。
            daysFetched: row.daysFetched,
            cost: row.cost,
            costModels: row.costModels,
            currency: row.currency,
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
            // 缺键补 0，否则缺字段的缓存行会把 NaN 带进后续所有合计。
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
            // 逐日明细必须一并恢复：days 得不到重建时，日历只剩当月与上月（会被增量刷新重抓），其余月份的 daysFetched 已是 true，计划器不会再回补。
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
            // 金额不恢复也一样：每次重启都得多打一遍 usage/cost。
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
            // daysFetched 只认明确的 true：字段缺失就留成 undefined，此时计划器会把该月当作「还没抓过逐日明细」补一次；补完自然会带上这个标记。
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
            // costFetched 同理：字段缺失时该月会被补抓一次金额。
            if (r.costFetched === true)
                stored.costFetched = true;
            store.rows.set(monthKey(r.year, r.month), stored);
        }
        return store;
    }
}
//# sourceMappingURL=history.js.map