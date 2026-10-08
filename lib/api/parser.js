/**
 * tlogs — 响应解析与聚合。
 *
 * 本文件是工作区权威参考实现 `deepseek_python_20261007_a1f087.py` 中
 * `parse_biz_data` / `input_tokens` / `output_tokens` / `empty_stat` 的逐行翻译。
 * 注释里的 `py:NN` 指向该 Python 文件的行号，便于逐条对拍。
 *
 * 翻译过程中刻意保留的 Python 语义：
 *  - `u.get("amount") or 0`   → `entry.amount || 0`（0 / "" / null 均归零）
 *  - `int(float(x))`          → `Number(x)` 后 `Math.trunc`（向零截断，非四舍五入）
 *  - `except (ValueError, TypeError)` → 非有限数一律归 0
 *  - `if t not in agg: continue` → 未知 type 既不进 agg 也不进 models
 *  - `if not isinstance(item, dict): continue` → 非字典条目整条跳过
 */
import { emptyMoney, emptyStat, isTokenType, moneyTotal, TOKEN_TYPES, } from '../types.js';
/** Python `isinstance(x, dict)` 的等价判断（排除 null 与数组）。 */
function isDict(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/**
 * 把接口里的 `amount` 转成整数，等价于 Python：
 *   `int(float(u.get("amount") or 0))`，异常时取 0。
 *
 * 唯一有意的偏差：Python 的 `int(float("inf"))` 会抛 OverflowError 且**不在**
 * `except (ValueError, TypeError)` 覆盖范围内（脚本会整体崩溃）；这里对非有限数
 * 一律返回 0。真实接口的 amount 始终是整数字符串，不会触发该分支。
 *
 * **只用于 token 计数**（`usage/amount`）。金额必须走 `toMoneyAmount`，
 * 否则会被 `Math.trunc` 截成 0（实测金额形如 `"12.1115392000000000"`）。
 */
export function toAmount(value) {
    const raw = value || 0;
    const n = Number(raw);
    if (!Number.isFinite(n))
        return 0;
    return Math.trunc(n);
}
/**
 * 把**金额**字符串转成数值（CNY 元），保留小数。
 *
 * 与 `toAmount` 的唯一区别就是**不截断** —— 实测 `usage/cost` 返回
 * `"12.1115392000000000"`，用 `Math.trunc` 会得到 0（这个坑实测踩过）。
 *
 * 精度：接口给 16 位小数，`Number()` 取最近 double，逐项累加的误差量级约 1e-11 元，
 * 而展示只到分（1e-2）甚至厘（1e-4），因此无需引入定点数。这里对单个值做 1e-8
 * 圆整，只为去掉 double 表示噪声、让持久化的 JSON 更短更稳定。
 */
export function toMoneyAmount(value) {
    const raw = value || 0;
    const n = Number(raw);
    if (!Number.isFinite(n))
        return 0;
    return Math.round(n * 1e8) / 1e8;
}
/**
 * 归一化 `biz_data`：`usage/amount` 给**对象**，`usage/cost` 给**长度 1 的数组**。
 *
 * 不做这一步就会静默拿到 `undefined.total` ⇒ 全 0（实测：`usage/cost` 的月度金额
 * 会全部显示成 ¥0.00，且不报任何错）。
 */
export function unwrapBizData(raw) {
    if (Array.isArray(raw)) {
        const first = raw[0];
        return isDict(first) ? first : {};
    }
    return isDict(raw) ? raw : {};
}
/**
 * 把一个模型条目数组按五类计量项聚合。等价于 Python `parse_biz_data` 内层循环。
 *
 * 注意：即使某个模型的 `usage` 为空或缺省，该模型键也会被创建（全部为 0），
 * 这与 Python `models.setdefault(model, empty_stat())` 的行为一致 —— 实测接口
 * 的 `total[]` 会返回若干全 0 模型，UI 侧再按需求过滤。
 */
function aggregateModels(items, onModel) {
    const agg = emptyStat(); // py:97
    const models = {}; // py:98
    const list = Array.isArray(items) ? items : []; // py:100 `biz_data.get("total") or []`
    for (const item of list) {
        if (!isDict(item))
            continue; // py:102
        const model = item.model || 'unknown'; // py:104 `item.get("model") or "unknown"`
        let m = models[model];
        if (!m) {
            m = emptyStat();
            models[model] = m; // py:105 setdefault
        }
        const usage = item.usage;
        const usageList = Array.isArray(usage) ? usage : []; // py:107
        for (const u of usageList) {
            if (!isDict(u))
                continue; // py:108
            const t = u.type;
            if (!isTokenType(t))
                continue; // py:110-111 `if t not in agg: continue`
            const a = toAmount(u.amount); // py:113-117
            agg[t] += a; // py:118
            m[t] += a; // py:119
        }
        onModel?.(model, m);
    }
    return { agg, models };
}
/**
 * 解析 `biz_data`，返回整体合计与按模型合计。
 * 等价于 Python `parse_biz_data(biz_data) -> (agg, models)`（py:91-120）。
 */
export function parseBizData(bizData) {
    return aggregateModels(bizData?.total);
}
/**
 * 解析 `biz_data.days[]`，得到每一天的合计。
 *
 * 结构上 `days[].data[]` 与 `total[]` 同构，因此复用同一套聚合逻辑。
 * 实测接口会返回**当月完整天数**（含尚未到来的日期，全为 0），
 * 所以按日期过滤 today / week / month 无需额外处理缺失日期。
 */
export function parseDays(bizData, cost) {
    const days = bizData?.days;
    const list = Array.isArray(days) ? days : [];
    const out = [];
    // 实测金额与 token 的逐日日期**逐个相同**，因此可以直接按 date 建索引对齐，
    // 而不必假设两边顺序一致（顺序一致只是当前实现的巧合，不是契约）。
    const costByDate = new Map();
    for (const c of cost?.days ?? [])
        costByDate.set(c.date, c.cost);
    for (const day of list) {
        if (!isDict(day))
            continue;
        const date = day.date;
        if (typeof date !== 'string' || date.length === 0)
            continue;
        const { agg } = aggregateModels(day.data);
        const entry = { date, stat: agg };
        const c = costByDate.get(date);
        if (c)
            entry.cost = c;
        out.push(entry);
    }
    return out;
}
/** 总输入 = PROMPT + CACHE_HIT + CACHE_MISS。等价于 Python `input_tokens`（py:123-128）。 */
export function inputTokens(stat) {
    return (stat.PROMPT_TOKEN + // py:125
        stat.PROMPT_CACHE_HIT_TOKEN + // py:126
        stat.PROMPT_CACHE_MISS_TOKEN // py:127
    );
}
/** 总输出 = RESPONSE_TOKEN。等价于 Python `output_tokens`（py:131-132）。 */
export function outputTokens(stat) {
    return stat.RESPONSE_TOKEN;
}
/** 由原始 Stat 派生 ScopeStat（拆分输入/输出/总计/请求）。 */
export function toScopeStat(stat, cost, currency) {
    const input = inputTokens(stat);
    const output = outputTokens(stat);
    const base = {
        raw: stat,
        inputTokens: input,
        outputTokens: output,
        totalTokens: input + output, // py:204 `g_total = g_in + g_out`
        requests: stat.REQUEST,
    };
    if (cost) {
        base.cost = cost;
        base.currency = currency ?? 'CNY';
    }
    return base;
}
/** 过滤掉「零用量」的行 —— 对应屏幕表格里的可见性规则。 */
export function isNonEmpty(stat) {
    // 等价于 Python 汇总区的 `if t == 0 and s["REQUEST"] == 0: continue`（py:229-230）
    return stat.totalTokens !== 0 || stat.requests !== 0;
}
/** 把 src 累加进 target（就地修改 target 并返回）。等价于 py:169-174 的双层循环。 */
export function addInto(target, src) {
    for (const t of TOKEN_TYPES)
        target[t] += src[t];
    return target;
}
/** 累加两个 Stat，返回新对象。 */
export function mergeStats(a, b) {
    return addInto(addInto(emptyStat(), a), b);
}
/** 全部归零的 Stat 之和。 */
export function sumStats(list) {
    const acc = emptyStat();
    for (const s of list)
        addInto(acc, s);
    return acc;
}
/**
 * 由 Stat 构造 StatRow，用于详细视图的表格。
 * `label` 仅作展示，`key` 用于排序与 stable key。
 */
export function toRow(key, label, stat) {
    return { key, label, stat: toScopeStat(stat) };
}
/* ------------------------------------------------------------------ *
 * 金额（usage/cost）
 * ------------------------------------------------------------------ */
/**
 * 按五类计量项聚合**金额**。与 `aggregateModels` 同构，唯一区别是用
 * `toMoneyAmount`（保留小数）而不是 `toAmount`（截断）。
 */
function aggregateMoney(items, onModel) {
    const total = emptyMoney();
    const models = {};
    const list = Array.isArray(items) ? items : [];
    for (const item of list) {
        if (!isDict(item))
            continue;
        const model = item.model || 'unknown';
        let sum = 0;
        const usage = item.usage;
        for (const u of Array.isArray(usage) ? usage : []) {
            if (!isDict(u))
                continue;
            const t = u.type;
            if (!isTokenType(t))
                continue;
            const a = toMoneyAmount(u.amount);
            total[t] += a;
            sum += a;
        }
        // 只登记真的花了钱的模型：接口会给一堆全 0 模型，登记进去只会让界面出现空行。
        if (sum > 0)
            models[model] = Math.round(sum * 1e8) / 1e8;
        onModel?.(model, sum);
    }
    return { total, models };
}
/**
 * 解析 `usage/cost` 的 `biz_data`。
 *
 * 实测事实（2026-10 直接对拍）：
 *  - `biz_data` 是**数组** `[{ total, days, currency }]`，必须先 `unwrapBizData`
 *  - `days[].data[]` 与 `total[]` 同构，逐日金额之和与月度金额之和**完全相等**
 *  - `days[].date` 与 `usage/amount` 的 `days[].date` **逐个相同** ⇒ 可与 token 逐日对齐
 *  - `REQUEST` 的金额恒为 0（请求不计费）
 *
 * 逐日保存**五类拆分**而不是一个总额：today/week/month/last7/last30 这些窗口是按天
 * 切片出来的，只留总额就没法给出「输入花了多少钱 / 输出花了多少钱」。
 */
export function parseCost(bizData) {
    const { total, models } = aggregateMoney(bizData?.total);
    const days = [];
    for (const day of Array.isArray(bizData?.days) ? bizData.days : []) {
        if (!isDict(day))
            continue;
        const date = day.date;
        if (typeof date !== 'string' || date.length === 0)
            continue;
        const { total: dTotal } = aggregateMoney(day.data);
        days.push({ date, cost: dTotal });
    }
    const currency = typeof bizData?.currency === 'string' && bizData.currency ? bizData.currency : 'CNY';
    return {
        total,
        amount: round8(moneyTotal(total)),
        models,
        days,
        currency,
    };
}
/** 圆整到 1e-8（元），去掉 double 表示噪声。 */
function round8(n) {
    return Math.round(n * 1e8) / 1e8;
}
/** 把 src 的金额累加进 target（就地）。 */
export function addMoneyInto(target, src) {
    if (!src)
        return target;
    for (const t of TOKEN_TYPES)
        target[t] += src[t];
    return target;
}
//# sourceMappingURL=parser.js.map