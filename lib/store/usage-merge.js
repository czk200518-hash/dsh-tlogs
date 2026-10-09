/**
 * tlogs — 双路数据源的合并规则。
 *
 * 平台口径（`usage/amount`）：覆盖该账号全部设备；只有 DeepSeek 通道（火山方舟 / 小米 / GLM 等第三方通道的量平台恒为 0）；当天要等平台结算才出现；有官方计价。
 * 本机口径（会话日志）：只有本机；覆盖本机用过的所有供应商；实时；没有金额。
 *
 * 合并规则（逐日取大，再对窗口求和）：
 *   某日合并值 = max(平台该日, 本机该日 DeepSeek 通道值) + 本机该日非 DeepSeek 供应商值
 *   窗口合并值 = Σ 逐日合并值
 *
 * 取 max 是因为平台值与本机 DeepSeek 通道值是同一批调用的两种测量（本机自己打的请求平台也会记），直接相加会重复计数：
 * 平台滞后时本机更大，用户在别的设备或脚本上用时平台更大。逐日取大而不是窗口整体取大，因为平台滞后通常只发生在当天，
 * 窗口层面取大会让昨天的多算掩盖今天的少算。本机非 DeepSeek 供应商的用量平台完全看不到，所以无条件相加、不存在重叠；
 * 请求数同理（本机用自己的调用数，平台用官方请求数）。
 */
import { emptyMoney, emptyStat, TOKEN_TYPES } from '../types.js';
import { tokenTotal } from './session-usage.js';
import { inWindow } from './dates.js';
/** 供应商是否属于 DeepSeek 官方通道（平台账单能覆盖的那一类）。 */
export function isDeepseekProvider(provider) {
    return /^deepseek([-_.].*)?$/i.test(provider.trim());
}
/** 把本机逐日用量按窗口切开，并拆成「DeepSeek 通道 / 其它供应商」。 */
export function collectLocalWindow(days, w) {
    const stat = emptyStat();
    const deepseek = emptyStat();
    const other = emptyStat();
    const others = new Map();
    let present = false;
    for (const day of days) {
        if (!inWindow(day.date, w))
            continue;
        present = true;
        for (const { provider, stat: pstat } of day.byProvider) {
            for (const t of TOKEN_TYPES)
                stat[t] += pstat[t];
            if (isDeepseekProvider(provider)) {
                for (const t of TOKEN_TYPES)
                    deepseek[t] += pstat[t];
            }
            else {
                for (const t of TOKEN_TYPES)
                    other[t] += pstat[t];
                let cur = others.get(provider);
                if (!cur) {
                    cur = emptyStat();
                    others.set(provider, cur);
                }
                for (const t of TOKEN_TYPES)
                    cur[t] += pstat[t];
            }
        }
    }
    const otherProviders = [...others.entries()]
        .map(([provider, s]) => ({ provider, tokens: tokenTotal(s) }))
        .filter((p) => p.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens);
    return { stat, deepseek, other, otherProviders, present };
}
/**
 * 合并总消耗（全部月份的平台合计 + 本机补充）。
 *
 * 平台全量合计只包含「官方通道 + 已结算」的部分，缺两块：平台永远看不到的供应商（火山方舟/小米/GLM/GPT…，
 * 平台对这些通道恒为 0）；当天尚未结算的部分（平台当前日的桶要滞后约 10~30 分钟才补齐）。所以：
 *
 *   总消耗 = 平台全量 + Σ_本机窗口内 ( max(0, 本机DeepSeek日 − 平台该日) + 本机非DeepSeek日 )
 *
 * 两项都不会与平台全量重复：第 1 项平台本来就没有，第 2 项是「平台已计入的那部分」之外的差额。
 * 边界：本机日志只覆盖它能扫到的那些天（DSH 会清理旧日志），因此这份「补充」不是有史以来的完整补充，
 * 界面必须写明覆盖区间，否则会被读成「总量已经完整」。
 */
export function mergeTotal(platformTotal, platformDays, localDays) {
    const platformByDate = new Map();
    for (const d of platformDays)
        platformByDate.set(d.date, d.stat);
    const merged = emptyStat();
    for (const t of TOKEN_TYPES)
        merged[t] = platformTotal.raw[t];
    const localAgg = emptyStat();
    const localDeepseekAgg = emptyStat();
    const otherAgg = emptyStat();
    const others = new Map();
    const pendingDays = [];
    let added = 0;
    for (const day of localDays) {
        const plat = platformByDate.get(day.date);
        const platStat = plat ?? emptyStat();
        const ds = emptyStat();
        const rest = emptyStat();
        for (const { provider, stat: pstat } of day.byProvider) {
            const target = isDeepseekProvider(provider) ? ds : rest;
            for (const t of TOKEN_TYPES)
                target[t] += pstat[t];
            if (target === rest) {
                let cur = others.get(provider);
                if (!cur) {
                    cur = emptyStat();
                    others.set(provider, cur);
                }
                for (const t of TOKEN_TYPES)
                    cur[t] += pstat[t];
            }
        }
        for (const t of TOKEN_TYPES) {
            localAgg[t] += ds[t] + rest[t];
            localDeepseekAgg[t] += ds[t];
            otherAgg[t] += rest[t];
        }
        let dayAdded = false;
        for (const t of TOKEN_TYPES) {
            if (t === 'REQUEST')
                continue;
            // 平台当天还没结算（本机更多）→ 补差额；非 DeepSeek 供应商 → 全额补。
            const gap = Math.max(0, ds[t] - (platStat[t] ?? 0));
            if (gap > 0 || rest[t] > 0) {
                merged[t] += gap + rest[t];
                dayAdded = true;
                if (gap > 0)
                    added += gap;
            }
        }
        const reqGap = Math.max(0, ds.REQUEST - (platStat.REQUEST ?? 0));
        if (reqGap > 0 || rest.REQUEST > 0) {
            merged.REQUEST += reqGap + rest.REQUEST;
            dayAdded = true;
        }
        void dayAdded;
        if (ds.REQUEST > 0 && tokenTotal(ds) > tokenTotal(platStat))
            pendingDays.push(day.date);
    }
    const localTokens = tokenTotal(localAgg);
    const otherTokens = tokenTotal(otherAgg);
    const platformTokens = tokenTotal(platformTotal.raw);
    const source = localTokens === 0
        ? 'platform'
        : platformTokens === 0
            ? 'local' // 平台一个数都没有（没凭据）：这份总量全部来自本机
            : otherTokens > 0 || added > 0
                ? 'merged'
                : 'platform';
    return {
        stat: toScopeStatFromStat(merged, platformTotal.cost, platformTotal.currency),
        source,
        platform: platformTotal,
        local: toScopeStatFromStat(localAgg),
        localDeepseekTokens: tokenTotal(localDeepseekAgg),
        otherProviders: [...others.entries()]
            .map(([provider, s]) => ({ provider, tokens: tokenTotal(s) }))
            .filter((p) => p.tokens > 0)
            .sort((a, b) => b.tokens - a.tokens),
        costPending: pendingDays.length > 0,
        pendingDays: pendingDays.sort(),
    };
}
/**
 * 合并一个窗口（逐日取大）。`platformDays` 是平台口径的逐日明细（通常来自 `usage/amount` 的 `days[]`），
 * `localDays` 是本机逐日用量，`w` 是窗口（UTC 日，与平台日桶同一口径）。
 */
export function mergeWindow(platformDays, localDays, w) {
    const platByDate = new Map();
    const platformAgg = emptyStat();
    const platformCost = emptyMoney();
    let hasCost = false;
    for (const d of platformDays) {
        if (!inWindow(d.date, w))
            continue;
        platByDate.set(d.date, d);
        for (const t of TOKEN_TYPES)
            platformAgg[t] += d.stat[t] ?? 0;
        if (d.cost) {
            hasCost = true;
            for (const t of TOKEN_TYPES)
                platformCost[t] += d.cost[t] ?? 0;
        }
    }
    const localAgg = emptyStat();
    const localDeepseekAgg = emptyStat();
    const otherAgg = emptyStat();
    const others = new Map();
    const localByDate = new Map();
    for (const day of localDays) {
        if (!inWindow(day.date, w))
            continue;
        const ds = emptyStat();
        const rest = emptyStat();
        for (const { provider, stat: pstat } of day.byProvider) {
            const target = isDeepseekProvider(provider) ? ds : rest;
            for (const t of TOKEN_TYPES)
                target[t] += pstat[t];
            if (target === rest) {
                let cur = others.get(provider);
                if (!cur) {
                    cur = emptyStat();
                    others.set(provider, cur);
                }
                for (const t of TOKEN_TYPES)
                    cur[t] += pstat[t];
            }
        }
        localByDate.set(day.date, { deepseek: ds, other: rest });
        for (const t of TOKEN_TYPES) {
            localAgg[t] += ds[t] + rest[t];
            localDeepseekAgg[t] += ds[t];
            otherAgg[t] += rest[t];
        }
    }
    // 逐日取大：平台与本机的 DeepSeek 通道值是同一批调用的两种测量，取大不重复计数。
    const merged = emptyStat();
    const pendingDays = [];
    let platformWins = 0;
    let localWins = 0;
    const dates = new Set([...platByDate.keys(), ...localByDate.keys()]);
    for (const date of dates) {
        const plat = platByDate.get(date)?.stat;
        const loc = localByDate.get(date) ?? { deepseek: emptyStat(), other: emptyStat() };
        const dsTokens = tokenTotal(loc.deepseek);
        const platTokens = plat ? tokenTotal(plat) : 0;
        if (dsTokens > 0 && platTokens < dsTokens) {
            pendingDays.push(date);
            localWins += 1;
        }
        else if (platTokens > 0) {
            platformWins += 1;
        }
        // 注意 `TOKEN_TYPES` 里含 `REQUEST`，所以循环里必须把它排掉、单独处理一次，否则请求数会被加两遍（这个坑单测钉着）。
        for (const t of TOKEN_TYPES) {
            if (t === 'REQUEST')
                continue;
            merged[t] += Math.max(plat?.[t] ?? 0, loc.deepseek[t]) + loc.other[t];
        }
        merged.REQUEST += Math.max(plat?.REQUEST ?? 0, loc.deepseek.REQUEST) + loc.other.REQUEST;
    }
    pendingDays.sort();
    const localTokens = tokenTotal(localAgg);
    const dsTokensTotal = tokenTotal(localDeepseekAgg);
    const otherTokens = tokenTotal(otherAgg);
    const platformTokens = tokenTotal(platformAgg);
    // 来源判定：本机窗口内无用量 → 平台（可能是别的设备）；平台无数据（没凭据 / 当天完全没结算）→ 本机；
    // 有平台看不到的供应商、或窗口内不同天由不同来源取胜 → 这张卡是拼出来的；平台全面落后（典型：当天未结算）→ 本机。
    let source;
    if (localTokens === 0) {
        source = 'platform';
    }
    else if (platformTokens === 0) {
        source = 'local';
    }
    else if (otherTokens > 0 || (platformWins > 0 && localWins > 0)) {
        source = 'merged';
    }
    else if (localWins > 0) {
        source = 'local';
    }
    else {
        source = 'platform';
    }
    const stat = toScopeStatFromStat(merged, hasCost ? platformCost : undefined);
    return {
        stat,
        source,
        platform: toScopeStatFromStat(platformAgg, hasCost ? platformCost : undefined),
        local: toScopeStatFromStat(localAgg),
        localDeepseekTokens: dsTokensTotal,
        otherProviders: [...others.entries()]
            .map(([provider, s]) => ({ provider, tokens: tokenTotal(s) }))
            .filter((p) => p.tokens > 0)
            .sort((a, b) => b.tokens - a.tokens),
        costPending: pendingDays.includes(w.to),
        pendingDays,
    };
}
/**
 * 由原始 Stat 构造 ScopeStat，金额沿用平台口径（本机没有计价能力）。与 `parser.toScopeStat` 的唯一区别是
 * 金额可以缺省（平台尚未结算时就没有金额），且不做 `cost` 的伪造。
 */
export function toScopeStatFromStat(stat, cost, currency) {
    const input = stat.PROMPT_TOKEN + stat.PROMPT_CACHE_HIT_TOKEN + stat.PROMPT_CACHE_MISS_TOKEN;
    const output = stat.RESPONSE_TOKEN;
    const base = {
        raw: { ...stat },
        inputTokens: input,
        outputTokens: output,
        totalTokens: input + output,
        requests: stat.REQUEST,
    };
    if (cost) {
        base.cost = { ...cost };
        base.currency = currency ?? 'CNY';
    }
    return base;
}
//# sourceMappingURL=usage-merge.js.map