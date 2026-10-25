/**
 * 本机口径（会话日志）单测。
 *
 * 钉住的都是**实测踩过的坑**，不是实现细节：
 *  1. 会话日志是「一行一个 zstd frame」的追加式容器，单次 `zstdDecompressSync`
 *     只解出第一帧 —— 不按帧边界扫描就只看到会话开头的几条事件
 *  2. 一次调用会有两个 usage 事件（流式 `assistant/chunk` + 最终 `assistant/message`），
 *     必须按 `(turn, step)` 去重，否则一次调用记两遍
 *  3. fork 会把父会话整段事件流拷进子会话日志（时间戳早于会话 `createdAt`），
 *     不剔除就是双倍（实测：10-07 从 15.5 亿「降」到 5.61 亿，与平台 5.98 亿对齐）
 *  4. 增量：size/mtime 没变的日志不得重解析（120 个日志全量约 7 秒，
 *     每次刷新都重解析会把宿主卡住）
 *  5. 落盘不留会话日志路径（目录名里编码了工作区路径），只留不可逆短哈希
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as zlib from 'node:zlib'

import {
  SessionUsageStore,
  fileKey,
  parseRecordLine,
  replaySessionUsage,
  scanZstdFrames,
  tokenTotal,
  zstdAvailable,
} from '../lib/store/session-usage.js'

const T0 = Date.UTC(2026, 9, 8, 1, 0, 0) // 2026-10-08T01:00:00Z

/**
 * 固定成 UTC+8 的「本机日」键：测试不能依赖机器时区，否则同一份断言在 CI 上会因为日界不同而红。
 * 用固定偏移而不是 `localDateKey`，被测的正是「日界按本地 0 点切」这件事本身。
 */
const shanghaiDay = (d: Date): string => new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 10)

function jsonl(records: unknown[]): string {
  return records.map((r) => JSON.stringify(r)).join('\n') + '\n'
}

function makeTempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'tlogs-session-'))
}

function writeSession(root: string, ws: string, id: string, content: string, ext: '' | '.zstd' = ''): string {
  const dir = join(root, ws, id)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `session.v4.jsonl${ext}`)
  writeFileSync(file, content)
  return file
}

const session = (id: string, createdAt: number) => ({
  type: 'session',
  version: 4,
  id,
  createdAt,
  cwd: 'C:/x',
})

const header = (provider: string, model: string, time: number) => ({
  type: 'request/header',
  time,
  data: { header: { config: { provider, model } } },
})

const chunk = (turn: number, step: number, usage: unknown, time: number) => ({
  type: 'assistant/chunk',
  time,
  data: { turn, step, chunk: { type: 'usage', usage } },
})

const message = (
  turn: number,
  step: number,
  usage: unknown,
  time: number,
  provider?: string,
  model = 'deepseek-flash',
) => ({
  type: 'assistant/message',
  time,
  data: { turn, step, usage, message: provider ? { source: { provider, model } } : {} },
})

test('同一步的两个 usage 事件只记一次，且以最终样本为准（流式样本被替换）', async () => {
  const root = makeTempRoot()
  try {
    writeSession(
      root,
      'ws',
      's1',
      jsonl([
        session('s1', T0),
        header('deepseek-official', 'deepseek-flash', T0),
        // 流式样本（先到）
        chunk(1, 1, { inputTokens: 10, outputTokens: 5, cacheReadTokens: 100, cacheWriteTokens: 0 }, T0 + 1000),
        // 最终样本（后到，数值更大）：必须替换而不是叠加
        message(1, 1, { inputTokens: 12, outputTokens: 6, cacheReadTokens: 200 }, T0 + 2000),
      ]),
    )
    const { days } = await replaySessionUsage(join(root, 'ws', 's1', 'session.v4.jsonl'))
    const day = days.get('2026-10-08')
    assert.ok(day, '应产生 2026-10-08 这一天的聚合')
    const agg = day!.get('deepseek-official')
    assert.ok(agg)
    const stat = agg!.stat
    assert.equal(stat.PROMPT_CACHE_MISS_TOKEN, 12, '最终样本应替换流式样本（12 而不是 10/22）')
    assert.equal(stat.PROMPT_CACHE_HIT_TOKEN, 200)
    assert.equal(stat.RESPONSE_TOKEN, 6)
    assert.equal(stat.REQUEST, 1, '一步只算一次请求')
    // 供应商下再按模型拆分（详细数据的「供应商」页签要用）
    assert.deepEqual([...agg!.models.keys()], ['deepseek-flash'])
    assert.equal(agg!.models.get('deepseek-flash')!.PROMPT_CACHE_HIT_TOKEN, 200)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('fork 种子事件（time < 会话 createdAt）不计入，父会话已经计过', async () => {
  const root = makeTempRoot()
  try {
    writeSession(
      root,
      'ws',
      's1',
      jsonl([
        session('s1', T0),
        header('deepseek-account', 'deepseek-flash', T0),
        // 从父会话拷来的历史：时间戳早于 createdAt
        message(1, 1, { inputTokens: 900, outputTokens: 900, cacheReadTokens: 900 }, T0 - 60_000, 'deepseek-account'),
        // 本会话自己的调用
        message(2, 1, { inputTokens: 10, outputTokens: 1, cacheReadTokens: 100 }, T0 + 1000, 'deepseek-account'),
      ]),
    )
    const { days } = await replaySessionUsage(join(root, 'ws', 's1', 'session.v4.jsonl'))
    const stat = days.get('2026-10-08')!.get('deepseek-account')!.stat
    assert.equal(stat.PROMPT_CACHE_MISS_TOKEN + stat.PROMPT_CACHE_HIT_TOKEN, 110, '种子用量必须被剔除')
    assert.equal(stat.REQUEST, 1)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('非 DeepSeek 供应商按样本来源拆分，不混进 DeepSeek 通道', async () => {
  const root = makeTempRoot()
  try {
    writeSession(
      root,
      'ws',
      's1',
      jsonl([
        session('s1', T0),
        header('deepseek-official', 'deepseek-flash', T0),
        message(1, 1, { inputTokens: 10, outputTokens: 1, cacheReadTokens: 100 }, T0 + 1000),
        // 样本自带的 provider 覆盖 header
        message(1, 2, { inputTokens: 1, outputTokens: 1, cacheReadTokens: 1 }, T0 + 2000, 'xiaomi', 'mimo'),
      ]),
    )
    const { days } = await replaySessionUsage(join(root, 'ws', 's1', 'session.v4.jsonl'))
    const day = days.get('2026-10-08')!
    assert.deepEqual([...day.keys()].sort(), ['deepseek-official', 'xiaomi'])
    assert.equal(tokenTotal(day.get('xiaomi')!.stat), 3)
    assert.deepEqual([...day.get('xiaomi')!.models.keys()], ['mimo'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('zstd 容器按帧边界解压：多帧日志必须全部读到', async (t) => {
  if (!zstdAvailable() || typeof zlib.zstdCompressSync !== 'function') {
    t.skip('当前 Node 不支持 zstd（需要 22.15+ / 24）')
    return
  }
  const root = makeTempRoot()
  try {
    const frame1 = jsonl([session('s1', T0), header('deepseek-official', 'deepseek-flash', T0)])
    const frame2 = jsonl([
      message(1, 1, { inputTokens: 7, outputTokens: 3, cacheReadTokens: 70 }, T0 + 1000),
    ])
    // 模拟宿主：每个追加批次一个独立 frame
    const bytes = Buffer.concat([zlib.zstdCompressSync(Buffer.from(frame1)), zlib.zstdCompressSync(Buffer.from(frame2))])
    const file = writeSession(root, 'ws', 's1', '', '.zstd')
    writeFileSync(file, bytes)

    assert.equal(scanZstdFrames(bytes).length, 2, '两个 frame 都要被识别')
    const { days } = await replaySessionUsage(file)
    const stat = days.get('2026-10-08')!.get('deepseek-official')!.stat
    assert.equal(stat.PROMPT_CACHE_MISS_TOKEN, 7)
    assert.equal(stat.PROMPT_CACHE_HIT_TOKEN, 70)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('本机日桶与 UTC 日桶分开：北京 02:00 的样本算「本机今天」、不算「平台昨天」', async () => {
  const root = makeTempRoot()
  try {
    // 2026-10-09T18:00Z = 北京 2026-10-10 02:00：UTC 日仍是 10-09，本机日已经是 10-10。
    // 「今日」按本机 0 点起算时，这类样本必须落在本机日桶里 —— 否则凌晨用量会凭空消失。
    const at = Date.UTC(2026, 9, 9, 18, 0, 0)
    writeSession(
      root,
      'ws',
      's1',
      jsonl([
        session('s1', Date.UTC(2026, 9, 9, 17, 0, 0)),
        header('deepseek-official', 'deepseek-flash', at),
        message(1, 1, { inputTokens: 10, outputTokens: 5, cacheReadTokens: 100 }, at + 1000),
      ]),
    )
    const { days, localDays } = await replaySessionUsage(join(root, 'ws', 's1', 'session.v4.jsonl'), {
      localDayKey: shanghaiDay,
    })
    assert.deepEqual([...days.keys()], ['2026-10-09'], 'UTC 桶按接口口径切')
    assert.deepEqual([...localDays.keys()], ['2026-10-10'], '本机日桶按本地日历日切')
    assert.equal(tokenTotal(localDays.get('2026-10-10')!.get('deepseek-official')!.stat), 115)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('过程指标：TTFT/生成耗时/工具耗时/失败/中断/循环/编辑次数都按元数据聚合', async () => {
  const root = makeTempRoot()
  try {
    const at = Date.UTC(2026, 9, 8, 10, 0, 0) // 2026-10-08T10:00:00Z
    // 输出 200：足够长的一段生成，TPS 峰值才不会被「几十毫秒的首尾差」放大成噪声
    const usage = { inputTokens: 10, outputTokens: 200, cacheReadTokens: 100, cacheWriteTokens: 0, totalTokens: 310 }
    const call = (id: string, name: string, args: string, time: number) => ({
      type: 'tool/call',
      time,
      data: { turn: 1, step: 2, callId: id, name, arguments: args },
    })
    const result = (id: string, time: number, text: string, isError = false) => ({
      type: 'tool/result',
      time,
      data: {
        turn: 1,
        step: 2,
        message: { role: 'tool', toolCallId: id, isError, content: [{ type: 'text', text }] },
      },
    })
    writeSession(
      root,
      'ws',
      's1',
      jsonl([
        session('s1', at),
        { type: 'step/start', time: at + 1000, data: { turn: 1, step: 1 } },
        {
          type: 'assistant/message',
          time: at + 3000,
          data: {
            turn: 1,
            step: 1,
            usage,
            // 首 token 在 step/start 之后 500ms；最后一 token 在 message 时刻（+3000）
            stream: [
              { type: 'chunk', time: at + 1500, chunk: { type: 'block-start', index: 0 } },
              { type: 'reasoning-chunks', time0: at + 1500, index: 0, dt: [100, 100, 100] },
              { type: 'chunk', time: at + 3000, chunk: { type: 'block-end', index: 0 } },
            ],
          },
        },
        { type: 'step/start', time: at + 3050, data: { turn: 1, step: 2 } },
        call('c1', 'read', '{"path":"/x"}', at + 3100),
        result('c1', at + 3300, 'hello'),
        call('c2', 'read', '{"path":"/x"}', at + 3400),
        result('c2', at + 3500, 'oops', true),
        call('c3', 'edit', '{}', at + 3600),
        result('c3', at + 3700, 'ok'),
        { type: 'job/registered', time: at + 4000, data: { jobId: 'j1', kind: 'bash', startedAt: at + 4000 } },
        {
          type: 'job/settled',
          time: at + 4600,
          data: { jobId: 'j1', startedAt: at + 4000, finishedAt: at + 4600, status: 'killed' },
        },
      ]),
    )

    const { insights } = await replaySessionUsage(join(root, 'ws', 's1', 'session.v4.jsonl'))
    assert.equal(insights.calls, 1)
    assert.equal(insights.ttftMsSum, 500, 'TTFT = 首个 stream 事件 − step/start')
    assert.equal(insights.genMsSum, 1500, '生成耗时 = 首尾 stream 事件之差')
    assert.equal(insights.outputTokensSum, 200)
    assert.equal(insights.tpsPeak, 200 / 1.5, 'TPS 峰值按单次调用算（输出 ≥20 且生成 ≥250ms 才计入）')
    // 步数与轮次：一轮两步
    assert.equal(insights.steps, 2)
    assert.equal(insights.turns, 1)
    assert.equal(insights.stepsMaxTurn, 2)
    assert.deepEqual(insights.stepBuckets, [1, 0, 0, 0, 0, 0])
    // 工具：read 两次（200ms + 100ms）、edit 一次；失败 1 次；循环 1 次（同名同参数长度）
    const read = insights.tools.find((t) => t.name === 'read')!
    assert.equal(read.calls, 2)
    assert.equal(read.errors, 1)
    assert.equal(read.measured, 2, '两条 result 都匹配上了')
    assert.equal(read.totalMs, 300)
    assert.equal(read.resultBytes, 5 + 4, '返回内容只量字节数')
    assert.equal(insights.tools.find((t) => t.name === 'edit')!.calls, 1)
    assert.equal(insights.repeatedCalls, 1)
    assert.equal(insights.maxRepeatRun, 2)
    assert.equal(insights.editCalls, 1)
    // 后台任务：被 kill 的算中断，并计入后台耗时
    assert.equal(insights.jobs.total, 1)
    assert.equal(insights.jobs.killed, 1)
    assert.equal(insights.jobs.totalMs, 600)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('存储：增量扫描只重解析变化的日志，且能落盘/恢复', async () => {
  const root = makeTempRoot()
  try {
    writeSession(
      root,
      'ws',
      's1',
      jsonl([
        session('s1', T0),
        header('deepseek-official', 'deepseek-flash', T0),
        message(1, 1, { inputTokens: 5, outputTokens: 5, cacheReadTokens: 50 }, T0 + 1000),
      ]),
    )
    const store = new SessionUsageStore({ root, maxDays: 32, localDayKey: shanghaiDay })
    const first = await store.refresh()
    assert.equal(first.available, true)
    assert.equal(first.parsedFiles, 1)
    assert.equal(first.days.length, 1)
    assert.equal(first.days[0]!.date, '2026-10-08')
    assert.equal(first.localDays[0]!.date, '2026-10-08')

    const second = await store.refresh()
    assert.equal(second.parsedFiles, 0, 'size/mtime 未变的日志不得重解析')

    // 落盘 → 恢复：只有短哈希与数字，不含路径
    const disk = JSON.parse(JSON.stringify(store.serialize())) as {
      files: Array<{ key: string; localDays: unknown[] }>
    }
    assert.equal(JSON.stringify(disk).includes('sessions'), false, '落盘内容不得包含路径')
    assert.equal(disk.files[0]!.key, fileKey(join(root, 'ws', 's1', 'session.v4.jsonl')))
    assert.equal(disk.files[0]!.localDays.length, 1, '本机日桶必须一起落盘，否则重启后「今日（本机日）」要等重扫')

    const restored = new SessionUsageStore({ root, maxDays: 32, localDayKey: shanghaiDay })
    const n = restored.load(disk)
    assert.equal(n, 1)
    assert.equal(restored.current.available, true, '恢复后应立刻可用（无需等一次扫描）')
    assert.equal(restored.current.days[0]!.date, '2026-10-08')
    assert.equal(restored.current.localDays[0]!.date, '2026-10-08')
    // 「供应商 → 模型」这一层必须一起往返，否则重启后详细数据里只剩供应商
    const prov = restored.current.days[0]!.byProvider[0]!
    assert.equal(prov.provider, 'deepseek-official')
    assert.deepEqual(
      prov.models?.map((m) => m.model),
      ['deepseek-flash'],
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('日志目录不存在时优雅降级：available=false 且给出原因', async () => {
  const root = join(tmpdir(), `tlogs-missing-${Date.now()}`)
  const store = new SessionUsageStore({ root })
  const r = await store.refresh()
  assert.equal(r.available, false)
  assert.equal(r.reason, 'no-session-logs')
  assert.deepEqual(r.days, [])
})

test('候选目录：取第一个能列出日志的（桌面端 DSH_HOME 指向 profile 的真实情形）', async () => {
  const base = mkdtempSync(join(tmpdir(), 'tlogs-roots-'))
  try {
    // 桌面端：DSH_HOME = <主目录>/profiles/desktop，而会话日志在 <主目录>/sessions
    const profileSessions = join(base, 'profiles', 'desktop', 'sessions')
    const realSessions = join(base, 'sessions')
    writeSession(
      realSessions,
      'ws',
      's1',
      jsonl([
        session('s1', T0),
        header('deepseek-account', 'deepseek-flash', T0),
        message(1, 1, { inputTokens: 3, outputTokens: 2, cacheReadTokens: 30 }, T0 + 1000),
      ]),
    )
    const store = new SessionUsageStore({
      roots: [
        { label: 'DSH_HOME/sessions', dir: profileSessions },
        { label: 'DSH_HOME 上两级/sessions', dir: realSessions },
        { label: '~/.dsh/sessions', dir: join(base, 'nope') },
      ],
    })
    const r = await store.refresh()
    assert.equal(r.available, true, '必须回退到候选目录里真正存在日志的那个')
    assert.equal(r.sourceLabel, 'DSH_HOME 上两级/sessions')
    assert.equal(store.sessionsRoot, realSessions)
    assert.equal(r.days[0]!.date, '2026-10-08')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('候选目录全都列不出日志：reason=no-session-logs，且不下发绝对路径', async () => {
  const base = join(tmpdir(), `tlogs-none-${Date.now()}`)
  const store = new SessionUsageStore({
    roots: [
      { label: 'DSH_HOME/sessions', dir: join(base, 'a') },
      { label: '~/.dsh/sessions', dir: join(base, 'b') },
    ],
  })
  const r = await store.refresh()
  assert.equal(r.available, false)
  assert.equal(r.reason, 'no-session-logs')
  assert.equal(r.reason!.includes(base), false, '原因码里不得带候选目录的绝对路径')
})

test('坏行与打包行（text/reasoning/tool-call-chunks）直接跳过，不抛错', () => {
  assert.equal(parseRecordLine(''), null)
  assert.equal(parseRecordLine('{ not json'), null)
  assert.equal(parseRecordLine(JSON.stringify({ type: 'text-chunks', data: { text: 'x' } })), null)
  assert.ok(parseRecordLine(JSON.stringify({ type: 'assistant/message', data: {} })))
  // 结构化扫描遇到非法结构立即停止（不猜）
  assert.deepEqual(scanZstdFrames(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])), [])
})
