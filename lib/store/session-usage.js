/**
 * tlogs — **本机口径**：从 DSH 会话日志重建逐日真实用量。
 *
 * ## 为什么需要它
 *
 * 平台的 `/usage/amount` 是**账号 + 官方通道**的口径，且当天数据要等平台结算
 * 才出现（实测 2026-10-08 北京时间 12:07 平台该日桶仍为 0，而本机当天已用 980 万
 * token；12:16 补到 589 万、12:34 补到 3022 万，即滞后约 10~30 分钟）。另外
 * **非 DeepSeek 供应商**（火山方舟 / 小米 / GLM / GPT 等）平台完全看不到
 * （实测 2026-09-18、09-19 本机走火山方舟共用 1.16 亿 token，平台这两天都是 0）。
 *
 * 于是本插件走双路：
 *   - **平台口径**（`usage/amount`）：官方、跨设备，但当天滞后、只覆盖官方通道；
 *   - **本机口径**（本模块）：实时、覆盖本机所有供应商，但只看得到本机。
 *
 * 合并规则见 `usage-merge.ts`。
 *
 * ## 口径与语义（与 DSH 自己的 costUsage 投影逐条对齐）
 *
 *  - usage 事件有两种：`assistant/chunk`（`data.chunk.type === 'usage'`，流式样本）
 *    与 `assistant/message`（`data.usage`，最终样本）。**同一 `(turn, step)` 只记一次**
 *    —— 后到的最终样本替换先到的流式样本，否则一次调用会被记两遍。
 *  - **fork 种子事件必须剔除**：DSH 的 fork 会把父会话整段事件流拷进子会话日志，
 *    这些事件的 `time` 早于会话 header 的 `createdAt`。父会话已经计过，
 *    再计一次就是双倍（实测：不剔除时 2026-10-07 本机为 15.5 亿，
 *    剔除后 5.61 亿，与平台同日的 5.98 亿相差 6%）。
 *  - `provider` / `model` 取自 `request/header.data.header.config`，样本可用
 *    `assistant/message` 的 `message.source` 覆盖。
 *  - 日键一律用 **UTC 日**（与平台日桶同一口径，见 `store/dates.ts`），
 *    这样两路数据可以逐日直接比较、合并。
 *
 * ## 安全与资源边界
 *
 *  - **只读**：本模块只读 `$DSH_HOME/sessions/**` 下的会话日志，从不写入。
 *  - 只从日志里取 **usage 数字**（五个计数）与 provider/model 名，不读消息正文；
 *    超长打包行（text/reasoning/tool-call-chunks）在解析前就被探针跳过。
 *  - 内存与事件循环守卫：分块读 + 逐帧解压（任一时刻只持有一帧解压结果）、
 *    单文件解压预算、每 N 帧让出事件循环。
 *  - 落盘时**只存 file 路径的不可逆短哈希**与数字，不存路径本身
 *    （会话目录名里编码了工作区路径）。
 *  - 增量：只重新解析 size/mtime 变化的日志；超过窗口的老日志直接跳过。
 */
import { open, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import * as zlib from 'node:zlib';
import { addInto } from '../api/parser.js';
import { dateKey } from './dates.js';
import { emptyStat, TOKEN_TYPES } from '../types.js';
/** Zstandard frame 魔数（小端读出的 0xFD2FB528）。 */
const ZSTD_MAGIC = 0xfd2fb528;
/** 打包行类型：体积主体，且不含 header/usage，回放时一律跳过。 */
const PACKED_ROW_TYPES = new Set(['text-chunks', 'reasoning-chunks', 'tool-call-chunks']);
const PACKED_ROW_PROBE = /"(?:text|reasoning|tool-call)-chunks"/;
const PACKED_ROW_PROBE_HEAD = 512;
const PACKED_ROW_PROBE_MIN_LINE = 4096;
/** 单文件解压上限（防解压炸弹；正常会话日志解压后数百 MB）。 */
export const DEFAULT_MAX_DECOMPRESSED_PER_FILE = 2 * 1024 * 1024 * 1024;
/** 流式读文件的分块大小。 */
const READ_CHUNK_BYTES = 8 * 1024 * 1024;
/** 每 N 帧让出一次事件循环，避免卡住宿主。 */
const YIELD_EVERY_FRAMES = 256;
/** 默认保留的最近天数（近 30 天窗口 + 1 天余量）。 */
export const DEFAULT_MAX_DAYS = 32;
/** 单个供应商名字符数上限（防日志里出现畸形超长字符串）。 */
const MAX_PROVIDER_LEN = 64;
/** 会话日志文件名：`session[.vN].jsonl[.zstd]`。 */
const SESSION_LOG_RE = /^session(?:\.v([1-9]\d*))?\.jsonl(\.zstd)?$/;
/** 路径的不可逆短哈希（与 `publicProjectId` 同一手法：落盘不留路径）。 */
export function fileKey(path) {
    return createHash('sha256').update(path).digest('hex').slice(0, 16);
}
/**
 * 结构化扫描拼接的 Zstandard frame 边界（不解压内容）。
 *
 * 与宿主 `dsh-session-persistence-jsonl` 的容器一致：每个追加批次一个独立带
 * 校验和的 frame。残缺尾帧（崩溃截断）或结构非法处直接停止。
 */
export function scanZstdFrames(buffer) {
    const frames = [];
    let offset = 0;
    while (offset < buffer.length) {
        const start = offset;
        if (buffer.length - offset < 4)
            return frames;
        if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC)
            return frames;
        offset += 4;
        if (offset === buffer.length)
            return frames;
        const descriptor = buffer.readUInt8(offset);
        offset += 1;
        if ((descriptor & 24) !== 0)
            return frames; // 保留位：结构非法
        const contentSizeFlag = descriptor >>> 6;
        const singleSegment = (descriptor & 32) !== 0;
        const checksum = (descriptor & 4) !== 0;
        const dictionaryFlag = descriptor & 3;
        const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
        const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
        const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
        if (buffer.length - offset < remainingHeaderBytes)
            return frames;
        offset += remainingHeaderBytes;
        for (;;) {
            if (buffer.length - offset < 3)
                return frames;
            const blockHeader = buffer.readUIntLE(offset, 3);
            offset += 3;
            const lastBlock = (blockHeader & 1) !== 0;
            const blockType = (blockHeader >>> 1) & 3;
            const blockSize = blockHeader >>> 3;
            if (blockType === 3)
                return frames; // 保留块类型：结构非法
            const payloadBytes = blockType === 1 ? 1 : blockSize;
            if (buffer.length - offset < payloadBytes)
                return frames;
            offset += payloadBytes;
            if (lastBlock)
                break;
        }
        if (checksum) {
            if (buffer.length - offset < 4)
                return frames;
            offset += 4;
        }
        frames.push({ start, end: offset });
    }
    return frames;
}
/** 解析单行日志；空行 / 打包行 / 坏行返回 null。 */
export function parseRecordLine(line) {
    if (line.length === 0)
        return null;
    if (line.length > PACKED_ROW_PROBE_MIN_LINE && PACKED_ROW_PROBE.test(line.slice(0, PACKED_ROW_PROBE_HEAD))) {
        return null;
    }
    try {
        const rec = JSON.parse(line);
        if (rec !== null && typeof rec === 'object' && !PACKED_ROW_TYPES.has(String(rec.type)))
            return rec;
        return null;
    }
    catch {
        return null;
    }
}
/** zstd 解压在本运行时是否可用（Node 22.15+ / 24）。 */
export function zstdAvailable() {
    return typeof zlib.zstdDecompressSync === 'function';
}
/**
 * 流式逐行读取一份会话日志。
 *
 * `zstd` 容器按帧边界增量扫描：分块读入原始字节，已确认完整的帧立即解压并逐行
 * 产出、随后释放引用；跨块/跨帧的行缓冲与压缩尾部单独保留。明文 `.jsonl`
 * 直接按行切。
 */
export async function* iterateSessionRecords(path, options = {}) {
    const isZstd = path.endsWith('.zstd');
    const budget = options.maxDecompressBytesPerFile ?? DEFAULT_MAX_DECOMPRESSED_PER_FILE;
    if (isZstd && !zstdAvailable())
        throw new Error('zstd-unavailable');
    const decompress = zlib.zstdDecompressSync;
    const handle = await open(path, 'r');
    let pending = '';
    let tail = Buffer.alloc(0);
    let decompressed = 0;
    let framesSinceYield = 0;
    const buffer = Buffer.allocUnsafe(READ_CHUNK_BYTES);
    const drainText = (text) => {
        const out = [];
        if (text.length === 0)
            return out;
        const lines = text.split('\n');
        lines[0] = pending + lines[0];
        pending = lines[lines.length - 1];
        for (let i = 0; i < lines.length - 1; i++) {
            const rec = parseRecordLine(lines[i]);
            if (rec !== null)
                out.push(rec);
        }
        return out;
    };
    try {
        for (;;) {
            const chunk = await handle.read(buffer, 0, READ_CHUNK_BYTES, null);
            if (chunk.bytesRead === 0)
                break;
            const data = tail.length > 0
                ? Buffer.concat([tail, buffer.subarray(0, chunk.bytesRead)])
                : Buffer.from(buffer.subarray(0, chunk.bytesRead));
            tail = Buffer.alloc(0);
            if (!isZstd) {
                for (const rec of drainText(data.toString('utf8')))
                    yield rec;
                continue;
            }
            let offset = 0;
            while (offset < data.length) {
                const frames = scanZstdFrames(data.subarray(offset));
                if (frames.length === 0) {
                    // 剩余字节连不出完整帧：未满一个分块 = 尾部截断，留待下一块；
                    // 已满一个分块仍无帧 = 结构损坏，忽略文件后续内容。
                    if (data.length - offset >= READ_CHUNK_BYTES)
                        return;
                    tail = data.subarray(offset);
                    break;
                }
                for (const f of frames) {
                    const bytes = f.end - f.start;
                    decompressed += bytes;
                    if (decompressed > budget)
                        throw new Error('decompress-budget-exceeded');
                    for (const rec of drainText(decompress(data.subarray(offset + f.start, offset + f.end)).toString('utf8'))) {
                        yield rec;
                    }
                    framesSinceYield += 1;
                }
                offset += frames[frames.length - 1].end;
            }
            if (framesSinceYield >= YIELD_EVERY_FRAMES) {
                framesSinceYield = 0;
                await new Promise((r) => setImmediate(r));
            }
        }
        if (pending.length > 0) {
            const rec = parseRecordLine(pending);
            if (rec !== null)
                yield rec;
        }
    }
    finally {
        await handle.close();
    }
}
/** 把任意数字归一化为非负整数（与平台解析同语义：非法/负值归 0）。 */
function amount(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0)
        return 0;
    return Math.trunc(n);
}
function providerName(v) {
    if (typeof v !== 'string')
        return undefined;
    const s = v.trim();
    if (s.length === 0)
        return undefined;
    return s.slice(0, MAX_PROVIDER_LEN);
}
/**
 * 回放一份会话日志，得到 `UTC 日 → provider → Stat`。
 *
 * 状态机与 DSH 的 costUsage 投影对齐：`request/header` 切换当前 provider/model；
 * usage 样本按 `(turn, step)` 去重（后者替换前者）；`time < createdAt` 的 fork
 * 种子事件整体剔除。
 */
export async function replaySessionUsage(path, options = {}) {
    /** `turn:step` → 该步最终样本。 */
    const samples = new Map();
    let createdAt = 0;
    let provider = 'unknown';
    let model = 'unknown';
    for await (const rec of iterateSessionRecords(path, options)) {
        const type = rec.type;
        if (type === 'session') {
            const created = Number(rec.createdAt);
            if (Number.isFinite(created) && created > 0)
                createdAt = created;
            continue;
        }
        if (type === 'request/header') {
            const data = rec.data;
            provider = providerName(data?.header?.config?.provider) ?? provider;
            model = providerName(data?.header?.config?.model) ?? model;
            continue;
        }
        let usage;
        let turn = 0;
        let step = 0;
        const data = rec.data;
        if (type === 'assistant/chunk' && data?.chunk?.type === 'usage' && data.chunk.usage) {
            usage = data.chunk.usage;
            turn = amount(data.turn);
            step = amount(data.step);
        }
        else if (type === 'assistant/message' && data?.usage) {
            usage = data.usage;
            turn = amount(data.turn);
            step = amount(data.step);
        }
        else {
            continue;
        }
        const at = Number(rec.time);
        if (!Number.isFinite(at) || at <= 0)
            continue;
        // fork 种子：时间早于会话创建时刻 = 从父会话拷来的历史，父会话已计过。
        if (createdAt > 0 && at < createdAt)
            continue;
        const src = data?.message?.source ?? data?.source;
        const sampleProvider = providerName(src?.provider) ?? provider;
        const stat = emptyStat();
        stat.PROMPT_CACHE_MISS_TOKEN = amount(usage.inputTokens);
        stat.PROMPT_CACHE_HIT_TOKEN = amount(usage.cacheReadTokens);
        // 平台五类里没有 cache-write 的位置，且本机实测恒为 0；归到 PROMPT_TOKEN
        // 只是为了「总输入 = PROMPT + HIT + MISS」这条恒等式仍然成立。
        stat.PROMPT_TOKEN = amount(usage.cacheWriteTokens);
        stat.RESPONSE_TOKEN = amount(usage.outputTokens);
        stat.REQUEST = 1;
        samples.set(`${turn}:${step}`, {
            day: dateKey(new Date(at)),
            provider: sampleProvider,
            model: providerName(src?.model) ?? model,
            stat,
        });
    }
    const days = new Map();
    for (const s of samples.values()) {
        let byProvider = days.get(s.day);
        if (!byProvider) {
            byProvider = new Map();
            days.set(s.day, byProvider);
        }
        let agg = byProvider.get(s.provider);
        if (!agg) {
            agg = { stat: emptyStat(), models: new Map() };
            byProvider.set(s.provider, agg);
        }
        addInto(agg.stat, s.stat);
        let mstat = agg.models.get(s.model);
        if (!mstat) {
            mstat = emptyStat();
            agg.models.set(s.model, mstat);
        }
        addInto(mstat, s.stat);
    }
    return days;
}
/** 列出会话根目录下所有日志文件（每个会话目录取最高代际）。 */
export async function listSessionLogs(root) {
    const out = [];
    let workspaces;
    try {
        workspaces = await readdir(root);
    }
    catch {
        return out;
    }
    for (const ws of workspaces) {
        const wsDir = join(root, ws);
        let sessions;
        try {
            sessions = await readdir(wsDir);
        }
        catch {
            continue;
        }
        for (const session of sessions) {
            const sDir = join(wsDir, session);
            let entries;
            try {
                entries = await readdir(sDir);
            }
            catch {
                continue;
            }
            let best;
            for (const name of entries) {
                const m = SESSION_LOG_RE.exec(name);
                if (!m)
                    continue;
                const generation = m[1] ? Number(m[1]) : 0;
                if (!best || generation > best.generation)
                    best = { path: join(sDir, name), generation };
            }
            if (!best)
                continue;
            try {
                const st = await stat(best.path);
                if (st.isFile())
                    out.push({ path: best.path, size: st.size, mtimeMs: st.mtimeMs });
            }
            catch {
                /* 文件刚被清理：跳过 */
            }
        }
    }
    return out;
}
/**
 * 本机口径存储。
 *
 * 增量策略：按文件记录 `(size, mtimeMs)` 与其逐日贡献；只有变化的文件重新解析，
 * 白天反复刷新时通常只重解析当前活跃的 1–3 个日志。老于窗口的文件直接跳过
 * （它们不可能含窗口内的样本）。
 */
export class SessionUsageStore {
    root;
    logger;
    maxDays;
    budget;
    now;
    files = new Map();
    inflight;
    report = {
        available: false,
        reason: 'not-scanned',
        days: [],
        totalFiles: 0,
        parsedFiles: 0,
        updatedAt: 0,
    };
    constructor(opts) {
        this.root = opts.root;
        this.logger = opts.logger;
        this.maxDays = Math.max(2, Math.trunc(opts.maxDays ?? DEFAULT_MAX_DAYS));
        this.budget = opts.maxDecompressBytesPerFile ?? DEFAULT_MAX_DECOMPRESSED_PER_FILE;
        this.now = opts.now ?? (() => Date.now());
    }
    /** 最近一次扫描结果（同步读取，供 snapshot 使用）。 */
    get current() {
        return this.report;
    }
    /** 是否已经成功扫过一次（用于判断能否作为数据源）。 */
    get usable() {
        return this.report.available;
    }
    /** 会话根目录。 */
    get sessionsRoot() {
        return this.root;
    }
    /** 增量刷新。并发调用共享同一次扫描。 */
    async refresh() {
        if (this.inflight)
            return this.inflight;
        this.inflight = this.scan().finally(() => {
            this.inflight = undefined;
        });
        return this.inflight;
    }
    async scan() {
        const started = this.now();
        const cutoff = started - (this.maxDays + 1) * 86_400_000;
        let listed;
        try {
            listed = await listSessionLogs(this.root);
        }
        catch (e) {
            this.report = {
                ...this.report,
                available: false,
                reason: `sessions-dir-unreadable: ${e instanceof Error ? e.message : String(e)}`,
                days: [],
                updatedAt: started,
            };
            return this.report;
        }
        if (listed.length === 0) {
            this.report = {
                ...this.report,
                available: false,
                reason: 'no-session-logs',
                days: [],
                totalFiles: 0,
                parsedFiles: 0,
                updatedAt: started,
            };
            return this.report;
        }
        const candidates = listed.filter((f) => f.mtimeMs >= cutoff);
        const seen = new Set();
        let parsedFiles = 0;
        let failures = 0;
        let zstdFailures = 0;
        for (const f of candidates) {
            const key = fileKey(f.path);
            seen.add(key);
            const known = this.files.get(key);
            if (known && known.size === f.size && known.mtimeMs === f.mtimeMs && known.path === f.path)
                continue;
            try {
                const days = await replaySessionUsage(f.path, { maxDecompressBytesPerFile: this.budget });
                this.files.set(key, { key, size: f.size, mtimeMs: f.mtimeMs, days, path: f.path });
                parsedFiles += 1;
            }
            catch (e) {
                failures += 1;
                const msg = e instanceof Error ? e.message : String(e);
                if (msg === 'zstd-unavailable')
                    zstdFailures += 1;
                // 保底：这个文件读不了（超预算 / 结构损坏 / zstd 不可用）时保留上一次的
                // 贡献，没有旧记录就跳过该文件 —— 单个坏日志不该让整个来源变不可用。
            }
        }
        // 已经不在候选集里的文件（被清理 / 超出窗口）丢弃其贡献。
        for (const key of [...this.files.keys()])
            if (!seen.has(key))
                this.files.delete(key);
        const days = this.aggregate();
        const anyData = days.length > 0;
        const available = anyData || failures < candidates.length;
        let reason;
        if (!available) {
            reason =
                zstdFailures > 0
                    ? 'zstd-unavailable'
                    : failures > 0
                        ? 'session-log-read-failed'
                        : 'no-usage-in-window';
        }
        else if (failures > 0) {
            reason = `partial: ${failures}/${candidates.length} 个日志读取失败`;
        }
        this.report = {
            available,
            ...(reason ? { reason } : {}),
            days,
            totalFiles: candidates.length,
            parsedFiles,
            updatedAt: started,
        };
        if (parsedFiles > 0) {
            this.logger?.info?.(`tlogs: 本机口径已扫描 ${candidates.length} 个会话日志（本次重解析 ${parsedFiles} 个），` +
                `得到 ${days.length} 天、${days.at(-1)?.date ?? '-'} 为最新`);
        }
        return this.report;
    }
    /** 把各文件的逐日贡献汇总成逐日用量（供应商 + 供应商下的模型，均按 token 降序）。 */
    aggregate() {
        const byDate = new Map();
        const cutoff = dateKey(new Date(this.now() - (this.maxDays - 1) * 86_400_000));
        for (const rec of this.files.values()) {
            for (const [date, byProvider] of rec.days) {
                if (date < cutoff)
                    continue;
                let target = byDate.get(date);
                if (!target) {
                    target = new Map();
                    byDate.set(date, target);
                }
                for (const [provider, agg] of byProvider) {
                    let cur = target.get(provider);
                    if (!cur) {
                        cur = { stat: emptyStat(), models: new Map() };
                        target.set(provider, cur);
                    }
                    addInto(cur.stat, agg.stat);
                    for (const [model, mstat] of agg.models) {
                        let m = cur.models.get(model);
                        if (!m) {
                            m = emptyStat();
                            cur.models.set(model, m);
                        }
                        addInto(m, mstat);
                    }
                }
            }
        }
        const out = [];
        for (const date of [...byDate.keys()].sort()) {
            const byProvider = byDate.get(date);
            const total = emptyStat();
            const providers = [];
            for (const [provider, agg] of byProvider) {
                addInto(total, agg.stat);
                const models = [...agg.models.entries()]
                    .map(([model, stat]) => ({ model, stat: { ...stat } }))
                    .filter((m) => tokenTotal(m.stat) > 0)
                    .sort((a, b) => tokenTotal(b.stat) - tokenTotal(a.stat));
                providers.push({ provider, stat: { ...agg.stat }, ...(models.length ? { models } : {}) });
            }
            providers.sort((a, b) => tokenTotal(b.stat) - tokenTotal(a.stat));
            out.push({ date, stat: total, byProvider: providers });
        }
        return out;
    }
    /** 落盘形态（只含短哈希与数字，不含任何路径/文本）。 */
    serialize() {
        return {
            files: [...this.files.values()].map((r) => ({
                key: r.key,
                size: r.size,
                mtimeMs: r.mtimeMs,
                days: [...r.days.entries()].map(([date, byProvider]) => [
                    date,
                    [...byProvider.entries()].map(([provider, agg]) => [provider, { stat: agg.stat, models: [...agg.models.entries()] }]),
                ]),
            })),
        };
    }
    /**
     * 从落盘 JSON 恢复。返回恢复的文件条数。
     *
     * 只接受合法形状；坏缓存不该让插件起不来（与项目其它缓存同一约定）。
     * 兼容没有 `models` 的旧缓存（那时只按供应商存）。
     */
    load(data) {
        const files = data?.files;
        if (!Array.isArray(files))
            return 0;
        let restored = 0;
        for (const raw of files) {
            if (!raw || typeof raw !== 'object')
                continue;
            const r = raw;
            const key = typeof r.key === 'string' ? r.key : '';
            if (!/^[0-9a-f]{16}$/.test(key))
                continue;
            const size = Number(r.size);
            const mtimeMs = Number(r.mtimeMs);
            if (!Number.isFinite(size) || !Number.isFinite(mtimeMs))
                continue;
            const days = new Map();
            if (Array.isArray(r.days)) {
                for (const entry of r.days) {
                    if (!Array.isArray(entry) || entry.length !== 2)
                        continue;
                    const date = typeof entry[0] === 'string' ? entry[0] : '';
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
                        continue;
                    const byProvider = new Map();
                    if (Array.isArray(entry[1])) {
                        for (const p of entry[1]) {
                            if (!Array.isArray(p) || p.length !== 2)
                                continue;
                            const provider = typeof p[0] === 'string' ? p[0] : '';
                            const payload = p[1];
                            // 旧缓存：直接是 Stat；新缓存：{ stat, models }。
                            const statRaw = payload && typeof payload === 'object' && 'stat' in payload
                                ? payload.stat
                                : payload;
                            const stat = normalizeStat(statRaw);
                            if (provider.length === 0 || !stat)
                                continue;
                            const models = new Map();
                            const modelsRaw = payload?.models;
                            if (Array.isArray(modelsRaw)) {
                                for (const m of modelsRaw) {
                                    if (!Array.isArray(m) || m.length !== 2)
                                        continue;
                                    const model = typeof m[0] === 'string' ? m[0] : '';
                                    const mstat = normalizeStat(m[1]);
                                    if (model.length === 0 || !mstat)
                                        continue;
                                    models.set(model, mstat);
                                }
                            }
                            byProvider.set(provider, { stat, models });
                        }
                    }
                    if (byProvider.size > 0)
                        days.set(date, byProvider);
                }
            }
            // path 未知（落盘不留路径）：size/mtime 命中时才会被复用，否则会重新解析。
            this.files.set(key, { key, size, mtimeMs, days });
            restored += 1;
        }
        if (restored > 0) {
            const days = this.aggregate();
            this.report = {
                available: days.length > 0,
                ...(days.length > 0 ? {} : { reason: 'restored-empty' }),
                days,
                totalFiles: restored,
                parsedFiles: 0,
                updatedAt: this.now(),
            };
        }
        return restored;
    }
    clear() {
        this.files.clear();
        this.report = { available: false, reason: 'not-scanned', days: [], totalFiles: 0, parsedFiles: 0, updatedAt: 0 };
    }
}
/**
 * token 合计（**不含** `REQUEST`）。
 *
 * `TOKEN_TYPES` 里包含请求数，但「总 Token」在这份代码里一贯等于
 * 输入 + 输出（见 `parser.toScopeStat`），所以这里必须把 `REQUEST` 排除，
 * 否则用量比较/排序会被请求数污染。
 */
export function tokenTotal(stat) {
    return (stat.PROMPT_TOKEN + stat.PROMPT_CACHE_HIT_TOKEN + stat.PROMPT_CACHE_MISS_TOKEN + stat.RESPONSE_TOKEN);
}
/** 从任意 JSON 归一化出 Stat（缺键补 0，非有限数归 0）。 */
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
//# sourceMappingURL=session-usage.js.map