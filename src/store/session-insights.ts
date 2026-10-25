/**
 * tlogs — 会话日志的「过程指标」：延迟、吞吐、工具调用、步数与循环。
 *
 * 只读元数据：事件时间戳、工具名、参数与返回的字节数、isError、job 的状态与起止时间。
 * 不读消息正文（reasoning / text / tool 参数与结果的字符串内容都只取长度），也不落盘原文。
 *
 * 两套统计口径必须分开看：
 *  - 每次模型调用：`step/start` → `assistant/message.stream` 的首个 chunk = TTFT；首尾 chunk = 生成耗时。
 *  - 每次工具调用：`tool/call` → `tool/result` 的墙钟差（后台任务另记 `job/settled` 的起止）。
 * 两者都在本机口径里，只覆盖会话日志还在的那些天。
 */

import type { Stat } from '../types.js'

/** 单个工具的聚合。 */
export interface ToolAccum {
  name: string
  calls: number
  errors: number
  /** 拿到 tool/result 的次数：有些调用（例如直接改任务状态）日志里没有结果事件，耗时无从测量。 */
  measured: number
  totalMs: number
  paramBytes: number
  resultBytes: number
}

/** 单文件（一次会话）的过程指标，聚合后落内存，不落盘。 */
export interface PerFileInsights {
  /** 会话的短哈希（落盘不留路径，这里沿用文件的不可逆短键）。 */
  id?: string
  calls: number
  modelWallMs: number
  ttftMsSum: number
  ttftSamples: number
  genMsSum: number
  outputTokensSum: number
  tpsPeak: number
  /** `[分钟序号, token 数, 调用数]`，用于算 TPM / RPM 的平均与峰值。 */
  minutes: Array<[number, number, number]>
  turns: number
  steps: number
  stepsMaxTurn: number
  /** 每轮步数的分桶计数：1-2 / 3-5 / 6-10 / 11-20 / 21-40 / 41+。 */
  stepBuckets: number[]
  repeatedCalls: number
  maxRepeatRun: number
  editCalls: number
  /** 有结果事件且结果内容非空的工具调用数（「结果利用率」的分母与分子）。 */
  nonEmptyResults: number
  /** 该文件里模型调用的五类 token（用于会话表与金额估算）。 */
  stat: import('../types.js').Stat
  firstAt: number
  lastAt: number
  /** 步骤级缓存命中率的分桶：0-20% / 20-40% / 40-60% / 60-80% / 80-100%。 */
  hitBuckets: number[]
  jobs: { total: number; killed: number; failed: number; totalMs: number }
  tools: ToolAccum[]
}

export const STEP_BUCKET_LIMITS = [2, 5, 10, 20, 40] as const

const EDIT_TOOLS = new Set(['edit', 'write', 'multi_edit', 'apply_patch', 'str_replace_editor'])

function emptyFile(): PerFileInsights {
  return {
    calls: 0,
    modelWallMs: 0,
    ttftMsSum: 0,
    ttftSamples: 0,
    genMsSum: 0,
    outputTokensSum: 0,
    tpsPeak: 0,
    minutes: [],
    turns: 0,
    steps: 0,
    stepsMaxTurn: 0,
    stepBuckets: [0, 0, 0, 0, 0, 0],
    repeatedCalls: 0,
    maxRepeatRun: 0,
    editCalls: 0,
    nonEmptyResults: 0,
    jobs: { total: 0, killed: 0, failed: 0, totalMs: 0 },
    tools: [],
    stat: { PROMPT_TOKEN: 0, PROMPT_CACHE_HIT_TOKEN: 0, PROMPT_CACHE_MISS_TOKEN: 0, RESPONSE_TOKEN: 0, REQUEST: 0 },
    firstAt: 0,
    lastAt: 0,
    hitBuckets: [0, 0, 0, 0, 0],
  }
}

function stepBucketIndex(steps: number): number {
  for (let i = 0; i < STEP_BUCKET_LIMITS.length; i++) if (steps <= STEP_BUCKET_LIMITS[i]) return i
  return STEP_BUCKET_LIMITS.length
}

/**
 * 边解析边聚合：一份日志只扫一遍，usage 与过程指标共用同一次读取。
 *
 * `push` 接受原始事件；它只按 `type` 分派，其余字段都是可选的 —— 坏了就当没见过，
 * 绝不因为过程指标让整趟扫描失败。
 */
export class InsightsAccumulator {
  private readonly out = emptyFile()
  private readonly stepStart = new Map<string, number>()
  private readonly toolStart = new Map<string, { name: string; at: number; paramBytes: number }>()
  private readonly jobStart = new Map<string, number>()
  private readonly turnSteps = new Map<number, number>()
  private readonly minutes = new Map<number, [number, number, number]>()
  private readonly tools = new Map<string, ToolAccum>()
  /** 同一轮里连续重复的调用（同名 + 同参数长度）计数与最长连击。 */
  private lastSignature = ''
  private runLength = 0

  push(rec: Record<string, unknown>): void {
    const type = rec.type
    if (typeof type !== 'string') return
    const data = rec.data as Record<string, unknown> | undefined
    if (!data) return
    const time = Number(rec.time)

    switch (type) {
      case 'step/start': {
        const turn = Number(data.turn)
        const step = Number(data.step)
        if (Number.isFinite(time)) this.stepStart.set(`${turn}:${step}`, time)
        if (Number.isFinite(turn)) {
          const n = (this.turnSteps.get(turn) ?? 0) + 1
          this.turnSteps.set(turn, n)
          if (n > this.out.stepsMaxTurn) this.out.stepsMaxTurn = n
        }
        return
      }
      case 'assistant/message': {
        this.onMessage(data, time)
        return
      }
      case 'tool/call': {
        this.onToolCall(data, time)
        return
      }
      case 'tool/result': {
        this.onToolResult(data, time)
        return
      }
      case 'job/registered': {
        const id = typeof data.jobId === 'string' ? data.jobId : ''
        const startedAt = Number(data.startedAt)
        if (id && Number.isFinite(startedAt)) this.jobStart.set(id, startedAt)
        return
      }
      case 'job/settled': {
        this.onJobSettled(data)
        return
      }
      default:
        return
    }
  }

  private onMessage(data: Record<string, unknown>, time: number): void {
    const usage = data.usage as Record<string, unknown> | undefined
    const stream = data.stream
    if (!usage || !Array.isArray(stream)) return
    const turn = Number(data.turn)
    const step = Number(data.step)
    const start = this.stepStart.get(`${turn}:${step}`)
    if (!Number.isFinite(time) || start === undefined) return

    // 流式时间线：`chunk` 带 time，`*-chunks` 带 time0 + dt 增量；首尾时间戳即首 token / 最后一 token。
    let first = Number.POSITIVE_INFINITY
    let last = Number.NEGATIVE_INFINITY
    for (const ev of stream) {
      if (!ev || typeof ev !== 'object') continue
      const e = ev as { time?: unknown; time0?: unknown; dt?: unknown }
      const t = Number(e.time)
      if (Number.isFinite(t)) {
        if (t < first) first = t
        if (t > last) last = t
      }
      if (Array.isArray(e.dt) && Number.isFinite(Number(e.time0))) {
        let cursor = Number(e.time0)
        for (const dt of e.dt) {
          cursor += Number(dt) || 0
          if (cursor < first) first = cursor
          if (cursor > last) last = cursor
        }
      }
    }
    if (!Number.isFinite(first) || !Number.isFinite(last)) return

    const output = Number(usage.outputTokens) || 0
    const tokens = Number(usage.totalTokens) || 0
    const hit = Number(usage.cacheReadTokens) || 0
    const miss = Number(usage.inputTokens) || 0
    const write = Number(usage.cacheWriteTokens) || 0
    this.out.calls += 1
    this.out.stat.PROMPT_CACHE_HIT_TOKEN += hit
    this.out.stat.PROMPT_CACHE_MISS_TOKEN += miss
    this.out.stat.PROMPT_TOKEN += write
    this.out.stat.RESPONSE_TOKEN += output
    this.out.stat.REQUEST += 1
    if (this.out.firstAt === 0 || time < this.out.firstAt) this.out.firstAt = time
    if (time > this.out.lastAt) this.out.lastAt = time
    const inputTokens = hit + miss + write
    if (inputTokens > 0) {
      const idx = Math.min(4, Math.floor((hit / inputTokens) * 5))
      this.out.hitBuckets[idx] += 1
    }
    this.out.modelWallMs += Math.max(0, time - start)
    this.out.ttftMsSum += Math.max(0, first - start)
    this.out.ttftSamples += 1
    this.out.genMsSum += Math.max(0, last - first)
    this.out.outputTokensSum += output
    // 峰值只认「真的生成了一段」的调用：窗口太短（<250ms）或输出太少时，一个几十毫秒的
    // 首尾差就能把瞬时速度放大到十万级，那不是吞吐，是测量噪声。
    const genMs = last - first
    if (output >= 20 && genMs >= 250) {
      const tps = output / (genMs / 1000)
      if (tps > this.out.tpsPeak) this.out.tpsPeak = tps
    }

    const minute = Math.floor(time / 60_000)
    const bucket = this.minutes.get(minute)
    if (bucket) {
      bucket[1] += tokens
      bucket[2] += 1
    } else {
      this.minutes.set(minute, [minute, tokens, 1])
    }
  }

  private onToolCall(data: Record<string, unknown>, time: number): void {
    const callId = typeof data.callId === 'string' ? data.callId : ''
    const name = typeof data.name === 'string' ? data.name : ''
    if (!callId || !name || !Number.isFinite(time)) return
    const args = typeof data.arguments === 'string' ? data.arguments : ''
    const paramBytes = Buffer.byteLength(args, 'utf8')
    this.toolStart.set(callId, { name, at: time, paramBytes })
    const tool = this.tool(name)
    tool.calls += 1
    tool.paramBytes += paramBytes
    if (EDIT_TOOLS.has(name.toLowerCase())) this.out.editCalls += 1

    // 循环检测：同一轮里连续两次「同名 + 同参数长度」的调用，多半是在原地重试。
    const signature = `${name}:${paramBytes}`
    if (signature === this.lastSignature) {
      this.runLength += 1
      this.out.repeatedCalls += 1
      if (this.runLength > this.out.maxRepeatRun) this.out.maxRepeatRun = this.runLength
    } else {
      this.lastSignature = signature
      this.runLength = 1
    }
  }

  private onToolResult(data: Record<string, unknown>, time: number): void {
    const message = data.message as Record<string, unknown> | undefined
    const callId =
      (typeof message?.toolCallId === 'string' && message.toolCallId) ||
      (typeof data.toolCallId === 'string' && data.toolCallId) ||
      ''
    const started = this.toolStart.get(callId)
    if (!started) return
    this.toolStart.delete(callId)
    const tool = this.tool(started.name)
    tool.measured += 1
    if (Number.isFinite(time) && time >= started.at) tool.totalMs += time - started.at
    void 0
    const content = message?.content
    if (Array.isArray(content)) {
      let bytes = 0
      for (const part of content) {
        const text = (part as { text?: unknown } | undefined)?.text
        if (typeof text === 'string') bytes += Buffer.byteLength(text, 'utf8')
      }
      this.tool(started.name).resultBytes += bytes
      if (bytes > 0) this.out.nonEmptyResults += 1
    }
    if (message?.isError === true) this.tool(started.name).errors += 1
  }

  private onJobSettled(data: Record<string, unknown>): void {
    const id = typeof data.jobId === 'string' ? data.jobId : ''
    const startedAt = Number(data.startedAt) || this.jobStart.get(id) || 0
    const finishedAt = Number(data.finishedAt)
    const status = typeof data.status === 'string' ? data.status : ''
    this.jobStart.delete(id)
    this.out.jobs.total += 1
    if (status === 'killed') this.out.jobs.killed += 1
    if (status === 'failed') this.out.jobs.failed += 1
    if (startedAt > 0 && Number.isFinite(finishedAt) && finishedAt >= startedAt) {
      this.out.jobs.totalMs += finishedAt - startedAt
    }
  }

  private tool(name: string): ToolAccum {
    let t = this.tools.get(name)
    if (!t) {
      t = { name, calls: 0, errors: 0, measured: 0, totalMs: 0, paramBytes: 0, resultBytes: 0 }
      this.tools.set(name, t)
    }
    return t
  }

  /** 收尾：把轮次与分钟表摊平，产出可合并的单文件结果。 */
  build(): PerFileInsights {
    const out = this.out
    out.turns = this.turnSteps.size
    out.steps = [...this.turnSteps.values()].reduce((a, b) => a + b, 0)
    for (const n of this.turnSteps.values()) out.stepBuckets[stepBucketIndex(n)] += 1
    out.minutes = [...this.minutes.values()].sort((a, b) => a[0] - b[0])
    out.tools = [...this.tools.values()].sort((a, b) => b.calls - a.calls)
    return out
  }
}

/** 把多份单文件结果合并成一个摘要；`window` 由调用方按会话日志的覆盖区间填。 */
export function summarizeInsights(
  files: PerFileInsights[],
  window: { from: string; to: string; files: number },
): import('../types.js').InsightSummary {
  const minutes = new Map<number, [number, number, number]>()
  const tools = new Map<string, ToolAccum>()
  const stepBuckets = [0, 0, 0, 0, 0, 0]
  let calls = 0
  let modelWallMs = 0
  let ttftMsSum = 0
  let ttftSamples = 0
  let genMsSum = 0
  let outputTokensSum = 0
  let tpsPeak = 0
  let turns = 0
  let steps = 0
  let stepsMaxTurn = 0
  let repeatedCalls = 0
  let maxRepeatRun = 0
  let editCalls = 0
  let nonEmptyResults = 0
  let inputTokensSum = 0
  let outputTokensTotal = 0
  const stepHitBuckets = [0, 0, 0, 0, 0]
  const sessions: import('../types.js').LocalSessionRow[] = []
  let jobTotal = 0
  let jobKilled = 0
  let jobFailed = 0
  let jobMs = 0
  const jobCount = files.length

  for (const f of files) {
    calls += f.calls
    modelWallMs += f.modelWallMs
    ttftMsSum += f.ttftMsSum
    ttftSamples += f.ttftSamples
    genMsSum += f.genMsSum
    outputTokensSum += f.outputTokensSum
    tpsPeak = Math.max(tpsPeak, f.tpsPeak)
    turns += f.turns
    steps += f.steps
    stepsMaxTurn = Math.max(stepsMaxTurn, f.stepsMaxTurn)
    repeatedCalls += f.repeatedCalls
    maxRepeatRun = Math.max(maxRepeatRun, f.maxRepeatRun)
    editCalls += f.editCalls
    nonEmptyResults += f.nonEmptyResults
    inputTokensSum += f.stat.PROMPT_TOKEN + f.stat.PROMPT_CACHE_HIT_TOKEN + f.stat.PROMPT_CACHE_MISS_TOKEN
    outputTokensTotal += f.stat.RESPONSE_TOKEN
    jobTotal += f.jobs.total
    jobKilled += f.jobs.killed
    jobFailed += f.jobs.failed
    jobMs += f.jobs.totalMs
    for (let i = 0; i < stepBuckets.length; i++) stepBuckets[i] += f.stepBuckets[i] ?? 0
    for (let i = 0; i < stepHitBuckets.length; i++) stepHitBuckets[i] += f.hitBuckets[i] ?? 0
    if (f.calls > 0) {
      sessions.push({
        id: f.id ?? '',
        from: new Date(f.firstAt).toISOString().slice(0, 10),
        to: new Date(f.lastAt).toISOString().slice(0, 10),
        calls: f.calls,
        steps: f.steps,
        turns: f.turns,
        toolCalls: f.tools.reduce((a, t) => a + t.calls, 0),
        stat: f.stat,
      })
    }
    for (const [m, tokens, n] of f.minutes) {
      const cur = minutes.get(m)
      if (cur) {
        cur[1] += tokens
        cur[2] += n
      } else {
        minutes.set(m, [m, tokens, n])
      }
    }
    for (const t of f.tools) {
      const cur =
        tools.get(t.name) ?? { name: t.name, calls: 0, errors: 0, measured: 0, totalMs: 0, paramBytes: 0, resultBytes: 0 }
      cur.calls += t.calls
      cur.errors += t.errors
      cur.measured += t.measured
      cur.totalMs += t.totalMs
      cur.paramBytes += t.paramBytes
      cur.resultBytes += t.resultBytes
      tools.set(t.name, cur)
    }
  }

  let tokensSum = 0
  let minuteCalls = 0
  let tokensPeak = 0
  let callsPeak = 0
  for (const [, tokens, n] of minutes.values()) {
    tokensSum += tokens
    minuteCalls += n
    if (tokens > tokensPeak) tokensPeak = tokens
    if (n > callsPeak) callsPeak = n
  }
  const activeMinutes = minutes.size
  const toolList = [...tools.values()].sort((a, b) => b.calls - a.calls)
  const toolCalls = toolList.reduce((a, t) => a + t.calls, 0)
  const toolErrors = toolList.reduce((a, t) => a + t.errors, 0)
  const toolMeasured = toolList.reduce((a, t) => a + t.measured, 0)
  const toolMs = toolList.reduce((a, t) => a + t.totalMs, 0)
  const busyMs = toolMs + jobMs + modelWallMs

  void jobCount
  return {
    window,
    calls,
    ttft: { avgMs: ttftSamples > 0 ? ttftMsSum / ttftSamples : 0, samples: ttftSamples },
    tpot: { avgMs: outputTokensSum > 0 ? genMsSum / outputTokensSum : 0 },
    tps: { avg: genMsSum > 0 ? outputTokensSum / (genMsSum / 1000) : 0, peak: tpsPeak },
    tpm: { avg: activeMinutes > 0 ? tokensSum / activeMinutes : 0, peak: tokensPeak, minutes: activeMinutes },
    rpm: { avg: activeMinutes > 0 ? minuteCalls / activeMinutes : 0, peak: callsPeak },
    steps: { total: steps, turns, avgPerTurn: turns > 0 ? steps / turns : 0, maxPerTurn: stepsMaxTurn, buckets: stepBuckets },
    loops: { repeatedCalls, maxRepeatRun },
    edits: { calls: editCalls },
    toolWallMs: toolMs,
    toolTimeMs: toolMs + jobMs,
    toolTimeShare: busyMs > 0 ? (toolMs + jobMs) / busyMs : 0,
    jobs: { total: jobTotal, killed: jobKilled, failed: jobFailed, totalMs: jobMs },
    stepHitBuckets,
    nonEmptyResults,
    resultNonEmptyRate: toolMeasured > 0 ? nonEmptyResults / toolMeasured : 0,
    tokenEfficiency: inputTokensSum > 0 ? outputTokensTotal / inputTokensSum : 0,
    sessions,
    tools: toolList.map((t) => ({
      name: t.name,
      calls: t.calls,
      errors: t.errors,
      measured: t.measured,
      totalMs: t.totalMs,
      avgMs: t.measured > 0 ? t.totalMs / t.measured : 0,
      paramBytes: t.paramBytes,
      resultBytes: t.resultBytes,
    })),
    toolCalls,
    toolMeasured,
    toolErrorRate: toolCalls > 0 ? toolErrors / toolCalls : 0,
  }
}

/** 取会话日志里出现过的 token 类型，供类型检查通过（Stat 只用于文档性引用）。 */
export type InsightTokenStat = Stat
