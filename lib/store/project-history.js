/**
 * tlogs — 项目用量的逐日快照（图表「指定项目」的时间序列来源）。
 *
 * 平台账单接口是账号维度的，没有项目信息；宿主暴露的项目用量只有「累计至今」一个数，没有
 * 时间轴。所以这里在本地按天记录每个项目的累计值 —— 有相邻两天的快照就能算出当天新增，也能
 * 画出增长曲线。边界：快照值是「当时观测到的累计用量」，不是当日新增（差值才是）；快照只能从
 * 插件开始运行之后累积，无法回溯历史，这一点由 UI 明示；同一天重复记录会覆盖（留当天最后一次
 * 观测值），因此一天最多一个点；只存 id（`publicProjectId` 的不可逆短哈希）与纯数字用量，
 * 不存标签、不存 cwd、不存任何会话内容。
 */
import { addInto } from '../api/parser.js';
import { emptyStat, TOKEN_TYPES } from '../types.js';
/**
 * 每个项目保留的最大快照天数：一天一条，1500 天约四年；单条只有 5 个整数，所以这个上限只是
 * 防止缓存文件无限增长。
 */
export const MAX_POINTS_PER_PROJECT = 1500;
/** 项目数量上限，防止异常宿主返回海量项目把文件撑爆。 */
export const MAX_PROJECTS = 500;
/** 校验 `YYYY-MM-DD`，并确认月份/日期真实存在。 */
function isValidDateKey(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!m)
        return false;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12)
        return false;
    if (day < 1 || day > 31)
        return false;
    // 用 UTC 回环校验真实天数（2026-02-30 会被归一到 3 月，于是对不上）。
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}
/** `publicProjectId` 的形状：16 位小写十六进制。 */
const PROJECT_ID_RE = /^[0-9a-f]{16}$/;
/** 从任意 JSON 里归一化出一个 Stat；一个合法字段都没有时返回 undefined。 */
function normalizeStat(raw) {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const r = raw;
    const stat = emptyStat();
    let seen = false;
    for (const t of TOKEN_TYPES) {
        const v = r[t];
        if (typeof v === 'number' && Number.isFinite(v)) {
            stat[t] = v;
            seen = true;
        }
    }
    return seen ? stat : undefined;
}
/** 项目逐日快照存储。 */
export class ProjectHistoryStore {
    byId = new Map();
    /**
     * 记录或覆盖某项目在某天的累计用量；id / date 非法或 stat 全零时返回 false。
     */
    record(id, date, stat) {
        if (!PROJECT_ID_RE.test(id) || !isValidDateKey(date))
            return false;
        let entry = this.byId.get(id);
        if (!entry) {
            // 新项目超上限就直接拒绝：快照是历史，淘汰旧项目等于永久丢数据。
            if (this.byId.size >= MAX_PROJECTS)
                return false;
            entry = { points: new Map() };
            this.byId.set(id, entry);
        }
        entry.points.set(date, { ...stat });
        // 超上限就丢最旧的若干天（日期键定长，可直接字符串排序）。
        if (entry.points.size > MAX_POINTS_PER_PROJECT) {
            const keys = [...entry.points.keys()].sort();
            for (const k of keys.slice(0, entry.points.size - MAX_POINTS_PER_PROJECT)) {
                entry.points.delete(k);
            }
        }
        return true;
    }
    /** 某项目的全部快照，按日期升序。 */
    points(id) {
        const entry = this.byId.get(id);
        if (!entry)
            return [];
        return [...entry.points.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, stat]) => ({ date, stat: { ...stat } }));
    }
    /** 某项目在闭区间 `[from, to]` 内的快照，升序。 */
    pointsBetween(id, from, to) {
        return this.points(id).filter((p) => p.date >= from && p.date <= to);
    }
    /** 某项目在 `date` 之前的最后一次快照。 */
    lastBefore(id, date) {
        let found;
        for (const p of this.points(id)) {
            if (p.date >= date)
                break;
            found = p;
        }
        return found;
    }
    /** 已记录过快照的项目 id。 */
    ids() {
        return [...this.byId.keys()];
    }
    get size() {
        return this.byId.size;
    }
    /** 某个 id 的快照总条数，诊断与测试用。 */
    count(id) {
        return this.byId.get(id)?.points.size ?? 0;
    }
    /**
     * 各日期的累计合计（用于「所有项目」的走势与对比）：只返回有快照的日期，
     * 同一天把所有项目相加。
     */
    dailyTotals() {
        const acc = new Map();
        for (const entry of this.byId.values()) {
            for (const [date, stat] of entry.points) {
                let target = acc.get(date);
                if (!target) {
                    target = emptyStat();
                    acc.set(date, target);
                }
                addInto(target, stat);
            }
        }
        return [...acc.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, stat]) => ({ date, stat }));
    }
    clear() {
        this.byId.clear();
    }
    /** 序列化时不含 label：标签可能含目录名，落盘只留哈希 id 与数字。 */
    serialize() {
        return {
            projects: [...this.byId.keys()].map((id) => ({ id, points: this.points(id) })),
        };
    }
    /**
     * 从持久化 JSON 就地恢复，非法条目静默跳过（坏缓存不该让插件起不来）。
     * 返回恢复成功的项目条数。
     */
    load(data) {
        if (!data || typeof data !== 'object')
            return 0;
        const projects = data.projects;
        if (!Array.isArray(projects))
            return 0;
        let restored = 0;
        for (const raw of projects) {
            if (!raw || typeof raw !== 'object')
                continue;
            const r = raw;
            if (typeof r.id !== 'string' || !PROJECT_ID_RE.test(r.id))
                continue;
            if (!Array.isArray(r.points))
                continue;
            let any = false;
            for (const p of r.points) {
                if (!p || typeof p !== 'object')
                    continue;
                const pp = p;
                if (typeof pp.date !== 'string')
                    continue;
                const stat = normalizeStat(pp.stat);
                if (!stat)
                    continue;
                if (this.record(r.id, pp.date, stat))
                    any = true;
            }
            if (any)
                restored++;
        }
        return restored;
    }
}
/** 是否是合法的项目 id（RPC 入参校验复用）。 */
export function isProjectId(value) {
    return typeof value === 'string' && PROJECT_ID_RE.test(value);
}
/** 是否是合法的日期键（RPC 入参校验复用）。 */
export function isDateKey(value) {
    return typeof value === 'string' && isValidDateKey(value);
}
//# sourceMappingURL=project-history.js.map