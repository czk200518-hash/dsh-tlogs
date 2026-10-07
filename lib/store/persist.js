/**
 * tlogs — 历史数据落盘（增量缓存）。
 *
 * 需求零.5：首次全量拉取后缓存，后续只拉增量月份。这要求历史数据在重启后仍在，
 * 因此需要落盘。
 *
 * 落盘位置：`config.cacheDir`（默认 `<DSH_HOME>/tlogs`，可由 `TLOGS_CACHE_DIR` 覆盖）。
 * 写入采用「临时文件 + rename」的原子替换，避免进程中途退出留下半个 JSON。
 *
 * 安全（需求 5.3 权限最小化）：
 *  - 只读写该缓存目录下的**一个**文件，不触碰 session 日志或任何其他路径
 *  - 缓存内容只有用量计数，**不含 userToken 与任何对话内容**
 *  - 可由 config.persistHistory=false 完全关闭文件系统访问
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
/** 缓存文件名。 */
export const CACHE_FILENAME = 'history.json';
/**
 * 单文件 JSON 缓存。
 *
 * 所有失败（目录不可写、JSON 损坏等）都只记录日志并降级为「无缓存」，
 * 绝不抛出 —— 缓存坏掉不该让插件起不来。
 */
export class JsonFileCache {
    file;
    logger;
    enabled;
    constructor(opts) {
        this.file = join(opts.dir, opts.filename ?? CACHE_FILENAME);
        this.logger = opts.logger;
        this.enabled = opts.enabled !== false;
    }
    /** 缓存文件的绝对路径（便于 README/诊断展示）。 */
    get path() {
        return this.file;
    }
    /** 读取缓存。返回 undefined 表示无缓存或不可读。 */
    async load() {
        if (!this.enabled)
            return undefined;
        try {
            const text = await readFile(this.file, 'utf8');
            return JSON.parse(text);
        }
        catch (e) {
            // ENOENT 是首次运行的正常情况，不记为错误。
            if (!isNotFound(e)) {
                this.logger?.warn?.(`tlogs: 读取缓存失败（${e instanceof Error ? e.message : String(e)}）`);
            }
            return undefined;
        }
    }
    /** 原子写入缓存。 */
    async save(data) {
        if (!this.enabled)
            return false;
        const tmp = `${this.file}.tmp-${process.pid}-${Date.now()}`;
        try {
            await mkdir(dirname(this.file), { recursive: true });
            await writeFile(tmp, JSON.stringify(data), 'utf8');
            await rename(tmp, this.file);
            return true;
        }
        catch (e) {
            this.logger?.warn?.(`tlogs: 写入缓存失败（${e instanceof Error ? e.message : String(e)}）`);
            // 尽力清理临时文件，失败无所谓。
            try {
                const { unlink } = await import('node:fs/promises');
                await unlink(tmp);
            }
            catch {
                /* ignore */
            }
            return false;
        }
    }
}
function isNotFound(e) {
    return typeof e === 'object' && e !== null && e.code === 'ENOENT';
}
//# sourceMappingURL=persist.js.map