/**
 * tlogs — 详细数据的「性能」「工具」两个页签。
 *
 * 数据来自本机会话日志的过程指标（见 store/session-insights.ts）：只用了时间戳、工具名、
 * 参数字符串长度、isError 与后台任务状态，不读消息正文。窗口与「供应商」页签相同：
 * 会话日志还在的那些天，而不是账号全量。
 */

import * as React from 'react'
import { h } from './h.js'
import { formatMoney, formatNumber } from './format.js'
import { useT, type MessageKey, type Translator } from './i18n/index.js'
import type { InsightSummary, ToolInsightRow } from '../types.js'

export interface InsightsProps {
  insights?: InsightSummary
  unavailable?: { reason?: string }
  /** 本机口径不可用时的原因码翻译（复用日历/供应商页签的映射）。 */
  reasonLabel: (reason?: string) => string
  numberFormat: 'full' | 'short'
  /** 平台各类型的每 token 单价（元）；用来估算项目与对话的金额。 */
  unitPrices?: Record<string, number>
}

/** 按平台五类单价估算金额；缺单价或没有用量时返回 undefined（不编 0）。 */
export function estimateMoney(stat: { raw: Record<string, number> }, unitPrices?: Record<string, number>): number | undefined {
  if (!unitPrices) return undefined
  let sum = 0
  let any = false
  for (const [type, price] of Object.entries(unitPrices)) {
    const tokens = stat.raw[type] ?? 0
    if (tokens > 0 && price > 0) {
      sum += tokens * price
      any = true
    }
  }
  return any ? sum : undefined
}

/** 毫秒 → 人类可读；`0` 单独说「<1 ms」以外的 0，避免和「没有数据」混淆。 */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 ms'
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return `${m}m ${s}s`
}

/** 字节 → KB / MB（二进制约 1024），只用于「大小」这一栏。 */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function Kpi(props: { label: string; value: string; glyph?: string }): React.ReactElement {
  return (
    <div className="tlogs-bd-kpi">
      <span className="tlogs-bd-kpi-label">
        {props.glyph ? <i className="tlogs-bd-glyph">{props.glyph}</i> : null}
        {props.label}
      </span>
      <b className="tlogs-bd-kpi-value">{props.value}</b>
    </div>
  )
}

/** 过程指标不可用时的统一提示（原因码复用 `error.reason.*`）。 */
function Unavailable(props: { unavailable?: { reason?: string }; reasonLabel: (r?: string) => string; t: Translator }): React.ReactElement {
  return (
    <div className="tlogs-hint">
      {props.t('insights.unavailable', { reason: props.reasonLabel(props.unavailable?.reason) })}
    </div>
  )
}

/** 工具表最多画多少行（按调用次数排序后的前 N 个）。 */
const TOOL_ROWS = 40

const BUCKET_KEYS: MessageKey[] = [
  'insights.bucket.1',
  'insights.bucket.2',
  'insights.bucket.3',
  'insights.bucket.4',
  'insights.bucket.5',
  'insights.bucket.6',
]

export function PerformanceView(props: InsightsProps): React.ReactElement {
  const { insights, unavailable, reasonLabel, numberFormat } = props
  const t = useT()
  if (!insights) return <Unavailable unavailable={unavailable} reasonLabel={reasonLabel} t={t} />

  const steps = insights.steps
  const bucketMax = Math.max(1, ...steps.buckets)

  return (
    <div className="tlogs-bd">
      <div className="tlogs-hint">
        {t('insights.scope', { from: insights.window.from, to: insights.window.to, files: formatNumber(insights.window.files, numberFormat) })}
      </div>

      <div className="tlogs-bd-kpis">
        <Kpi label={t('insights.ttft')} value={formatMs(insights.ttft.avgMs)} glyph="⏱" />
        <Kpi label={t('insights.tpot')} value={formatMs(insights.tpot.avgMs)} glyph="⁄" />
        <Kpi label={t('insights.tpsAvg')} value={insights.tps.avg.toFixed(1)} glyph="▲" />
        <Kpi label={t('insights.tpsPeak')} value={insights.tps.peak.toFixed(1)} glyph="⇗" />
      </div>

      <div className="tlogs-bd-kpis">
        <Kpi label={t('insights.tpmAvg')} value={formatNumber(Math.round(insights.tpm.avg), numberFormat)} glyph="◷" />
        <Kpi label={t('insights.tpmPeak')} value={formatNumber(Math.round(insights.tpm.peak), numberFormat)} glyph="⇗" />
        <Kpi label={t('insights.rpmAvg')} value={insights.rpm.avg.toFixed(1)} glyph="↻" />
        <Kpi label={t('insights.rpmPeak')} value={formatNumber(insights.rpm.peak, numberFormat)} glyph="⇗" />
      </div>

      <div className="tlogs-bd-kpis">
        <Kpi label={t('insights.calls')} value={formatNumber(insights.calls, numberFormat)} />
        <Kpi label={t('insights.steps')} value={formatNumber(steps.total, numberFormat)} />
        <Kpi label={t('insights.stepsPerTurn')} value={steps.avgPerTurn.toFixed(1)} />
        <Kpi label={t('insights.maxSteps')} value={formatNumber(steps.maxPerTurn, numberFormat)} />
        <Kpi label={t('insights.loops')} value={formatNumber(insights.loops.repeatedCalls, numberFormat)} />
        <Kpi label={t('insights.loopMax')} value={formatNumber(insights.loops.maxRepeatRun, numberFormat)} />
        <Kpi label={t('insights.edits')} value={formatNumber(insights.edits.calls, numberFormat)} />
        <Kpi label={t('insights.toolShare')} value={`${(insights.toolTimeShare * 100).toFixed(1)}%`} />
        <Kpi label={t('insights.efficiency')} value={`${(insights.tokenEfficiency * 100).toFixed(1)}%`} />
      </div>

      <div className="tlogs-bd-title">{t('insights.stepsTitle')}</div>
      <div className="tlogs-bd-rows">
        {steps.buckets.map((n, i) => (
          <div className="tlogs-bd-row" key={BUCKET_KEYS[i]}>
            <i className="tlogs-bd-dot" style={{ background: 'var(--tlogs-c1)' }} />
            <span className="tlogs-bd-label">{t(BUCKET_KEYS[i]!)}</span>
            <span className="tlogs-bd-bar">
              <i style={{ width: `${Math.min(100, (n / bucketMax) * 100)}%`, background: 'var(--tlogs-c1)' }} />
            </span>
            <span className="tlogs-bd-value">{formatNumber(n, numberFormat)}</span>
            <span className="tlogs-bd-pct">{steps.turns > 0 ? `${((n / steps.turns) * 100).toFixed(1)}%` : '—'}</span>
          </div>
        ))}
      </div>
      <div className="tlogs-hint">{t('insights.stepsHint')}</div>
    </div>
  )
}

function ToolRow(props: { row: ToolInsightRow; numberFormat: 'full' | 'short' }): React.ReactElement {
  const { row, numberFormat } = props
  return (
    <tr>
      <td className="tlogs-strong">{row.name}</td>
      <td>{formatNumber(row.calls, numberFormat)}</td>
      <td>{row.errors > 0 ? formatNumber(row.errors, numberFormat) : '—'}</td>
      <td>{row.measured > 0 ? formatMs(row.avgMs) : '—'}</td>
      <td>{row.measured > 0 ? formatMs(row.totalMs) : '—'}</td>
      <td>{formatBytes(row.paramBytes)}</td>
      <td>{formatBytes(row.resultBytes)}</td>
    </tr>
  )
}

/** 会话表：一条会话 = 一个日志文件。没有标题（那属于正文），标签用短哈希 + 日期区间。 */
export function ConversationsView(props: InsightsProps): React.ReactElement {
  const { insights, unavailable, reasonLabel, numberFormat, unitPrices } = props
  const t = useT()
  if (!insights) return <Unavailable unavailable={unavailable} reasonLabel={reasonLabel} t={t} />
  const rows = insights.sessions ?? []
  if (rows.length === 0) return <div className="tlogs-empty">{t('common.noData')}</div>

  return (
    <div className="tlogs-bd">
      <div className="tlogs-hint">{t('conv.hint')}</div>
      <div className="tlogs-table-wrap">
        <table className="tlogs-table">
          <thead>
            <tr>
              <th>{t('conv.col.id')}</th>
              <th>{t('conv.col.range')}</th>
              <th>{t('conv.col.calls')}</th>
              <th>{t('conv.col.steps')}</th>
              <th>{t('conv.col.tools')}</th>
              <th>{t('conv.col.tokens')}</th>
              <th>{t('conv.col.estimate')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const estimate = estimateMoney({ raw: row.stat }, unitPrices)
              return (
                <tr key={row.id}>
                  <td className="tlogs-strong">{row.id}</td>
                  <td>{row.from === row.to ? row.from : `${row.from} ~ ${row.to}`}</td>
                  <td>{formatNumber(row.calls, numberFormat)}</td>
                  <td>{formatNumber(row.steps, numberFormat)}</td>
                  <td>{formatNumber(row.toolCalls, numberFormat)}</td>
                  <td>{formatNumber(row.stat.PROMPT_CACHE_HIT_TOKEN + row.stat.PROMPT_CACHE_MISS_TOKEN + row.stat.PROMPT_TOKEN + row.stat.RESPONSE_TOKEN, numberFormat)}</td>
                  <td>{estimate === undefined ? '—' : `≈ ${formatMoney(estimate)}`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="tlogs-hint">{t('conv.estimateHint')}</div>
    </div>
  )
}

export function ToolsView(props: InsightsProps): React.ReactElement {
  const { insights, unavailable, reasonLabel, numberFormat } = props
  const t = useT()
  if (!insights) return <Unavailable unavailable={unavailable} reasonLabel={reasonLabel} t={t} />

  return (
    <div className="tlogs-bd">
      <div className="tlogs-hint">
        {t('insights.scope', { from: insights.window.from, to: insights.window.to, files: formatNumber(insights.window.files, numberFormat) })}
      </div>

      <div className="tlogs-bd-kpis">
        <Kpi label={t('tools.totalCalls')} value={formatNumber(insights.toolCalls, numberFormat)} glyph="⚙" />
        <Kpi label={t('tools.errorRate')} value={`${(insights.toolErrorRate * 100).toFixed(2)}%`} />
        <Kpi label={t('tools.avgMs')} value={insights.toolMeasured > 0 ? formatMs(insights.toolWallMs / insights.toolMeasured) : '—'} />
        <Kpi label={t('insights.toolShare')} value={`${(insights.toolTimeShare * 100).toFixed(1)}%`} />
        <Kpi label={t('tools.jobs')} value={formatNumber(insights.jobs.total, numberFormat)} glyph="▤" />
        <Kpi label={t('tools.killed')} value={formatNumber(insights.jobs.killed + insights.jobs.failed, numberFormat)} />
        <Kpi label={t('tools.jobMs')} value={formatMs(insights.jobs.totalMs)} />
        <Kpi label={t('tools.nonEmpty')} value={insights.toolMeasured > 0 ? `${(insights.resultNonEmptyRate * 100).toFixed(1)}%` : '—'} />
      </div>

      <div className="tlogs-bd-title">{t('tools.title')}</div>
      <div className="tlogs-table-wrap">
        <table className="tlogs-table">
          <thead>
            <tr>
              <th>{t('tools.col.name')}</th>
              <th>{t('tools.col.calls')}</th>
              <th>{t('tools.col.errors')}</th>
              <th>{t('tools.col.avg')}</th>
              <th>{t('tools.col.total')}</th>
              <th>{t('tools.col.param')}</th>
              <th>{t('tools.col.result')}</th>
            </tr>
          </thead>
          <tbody>
            {insights.tools.slice(0, TOOL_ROWS).map((row) => (
              <ToolRow key={row.name} row={row} numberFormat={numberFormat} />
            ))}
          </tbody>
        </table>
      </div>
      {insights.tools.length > TOOL_ROWS ? (
        <div className="tlogs-hint">{t('tools.truncated', { shown: TOOL_ROWS, total: insights.tools.length })}</div>
      ) : null}
      <div className="tlogs-hint">{t('tools.hint')}</div>
    </div>
  )
}
