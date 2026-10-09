/**
 * tlogs — 历史数据落盘：首次全量拉取后缓存下来、之后只拉增量月份，这就要求历史数据重启后还在。
 * 写入一律「临时文件 + rename」原子替换，避免进程中途退出留下半个 JSON。
 *
 * 文件在 `config.cacheDir`（默认 `<DSH_HOME>/tlogs`，可由 `TLOGS_CACHE_DIR` 覆盖），内容只有
 * 用量计数，不含 userToken 与任何对话内容。本模块只碰该目录下的这一个文件 —— 另一路数据源对
 * 会话日志的只读访问在 `store/session-usage.ts`，且可由 `localUsage: false` 完全关闭；本模块
 * 自身可由 `persistHistory=false` 完全关闭。
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Logger } from '../service.js'

export const CACHE_FILENAME = 'history.json'

export interface PersistOptions {
  /** 缓存目录。 */
  dir: string
  logger?: Logger
  /** false 时所有方法都是 no-op。 */
  enabled?: boolean
  /** 文件名覆盖（测试用）。 */
  filename?: string
}

/**
 * 单文件 JSON 缓存。目录不可写、JSON 损坏之类的失败一律只记日志、降级成「无缓存」，绝不抛出
 * —— 缓存坏掉不该让插件起不来。
 */
export class JsonFileCache {
  private readonly file: string
  private readonly logger?: Logger
  private readonly enabled: boolean

  constructor(opts: PersistOptions) {
    this.file = join(opts.dir, opts.filename ?? CACHE_FILENAME)
    this.logger = opts.logger
    this.enabled = opts.enabled !== false
  }

  /** 缓存文件绝对路径，供 README 与诊断展示。 */
  get path(): string {
    return this.file
  }

  /** 无缓存或不可读时返回 undefined。 */
  async load(): Promise<unknown> {
    if (!this.enabled) return undefined
    try {
      const text = await readFile(this.file, 'utf8')
      return JSON.parse(text) as unknown
    } catch (e) {
      // 首次运行时文件还不存在，属正常情况，不记错误。
      if (!isNotFound(e)) {
        this.logger?.warn?.(`tlogs: 读取缓存失败（${e instanceof Error ? e.message : String(e)}）`)
      }
      return undefined
    }
  }

  async save(data: unknown): Promise<boolean> {
    if (!this.enabled) return false
    const tmp = `${this.file}.tmp-${process.pid}-${Date.now()}`
    try {
      await mkdir(dirname(this.file), { recursive: true })
      await writeFile(tmp, JSON.stringify(data), 'utf8')
      await rename(tmp, this.file)
      return true
    } catch (e) {
      this.logger?.warn?.(`tlogs: 写入缓存失败（${e instanceof Error ? e.message : String(e)}）`)
      // 尽力删掉临时文件，删不掉也无所谓。
      try {
        const { unlink } = await import('node:fs/promises')
        await unlink(tmp)
      } catch {
        /* ignore */
      }
      return false
    }
  }
}

function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'ENOENT'
}
