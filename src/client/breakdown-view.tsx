/**
 * tlogs — the "breakdown" tab of the detail modal: token composition, cost composition and the
 * per-project token table.
 *
 * Everything here is derived from data the plugin already holds: the platform bill's five token
 * counters and five money buckets per day. Both sides of a percentage therefore come from the same
 * calls — mixing in the local log would make token and money denominators disagree, since local
 * usage has no prices.
 */

import * as React from 'react'
import { h, Fragment } from './h.js'
import { formatMoneyFull, formatMoney, formatNumber } from './format.js'
import { StatTable } from './detail-view.js'
import { useT, type MessageKey, type Translator } from './i18n/index.js'
import { moneyTotal, type BreakdownWindow, type InsightSummary, type MonthDetail, type ScopeStat, type StatRow, type UsageBreakdown } from '../types.js'

/** The four billable parts of one call; the platform reports tokens and money under the same keys. */
type PartId = 'hit' | 'miss' | 'plain' | 'out'

const PARTS: Array<{ id: PartId; labelKey: MessageKey; key: 'PROMPT_CACHE_HIT_TOKEN' | 'PROMPT_CACHE_MISS_TOKEN' | 'PROMPT_TOKEN' | 'RESPONSE_TOKEN'; color: string }> = [
  { id: 'hit', labelKey: 'breakdown.hit', key: 'PROMPT_CACHE_HIT_TOKEN', color: 'var(--tlogs-c1)' },
  { id: 'miss', labelKey: 'breakdown.miss', key: 'PROMPT_CACHE_MISS_TOKEN', color: 'var(--tlogs-c3)' },
  { id: 'plain', labelKey: 'breakdown.plain', key: 'PROMPT_TOKEN', color: 'var(--tlogs-c6)' },
  { id: 'out', labelKey: 'breakdown.output', key: 'RESPONSE_TOKEN', color: 'var(--tlogs-c4)' },
]

type ScopeId = 'total' | 'month' | 'today' | 'custom'

const SCOPES: Array<{ id: ScopeId; labelKey: MessageKey }> = [
  { id: 'total', labelKey: 'breakdown.scope.total' },
  { id: 'month', labelKey: 'breakdown.scope.month' },
  { id: 'today', labelKey: 'breakdown.scope.today' },
  { id: 'custom', labelKey: 'breakdown.scope.custom' },
]

/** `YYYY-MM` → 年月；格式不认识返回 undefined。 */
function parseYm(key: string): { year: number; month: number } | undefined {
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return undefined
  const year = Number(m[1])
  const month = Number(m[2])
  return month >= 1 && month <= 12 ? { year, month } : undefined
}

export interface BreakdownViewProps {
  breakdown?: UsageBreakdown
  /** 项目行来自快照的「当前项目消耗」卡片：本机投影，没有金额。 */
  projects: Array<{ id: string; label: string; stat: ScopeStat }>
  /** 已抓到的月份（日历页签用同一份），供「指定月份」下拉。 */
  months: StatRow[]
  /** 当前选中的月明细：切到「指定」时直接用它，不再发请求。 */
  monthDetail?: MonthDetail | null
  onSelectMonth: (year: number, month: number) => void
  currency: string
  numberFormat: 'full' | 'short'
  /** 平台各类型单价，用来估算项目金额（本机口径没有账单）。 */
  unitPrices?: Record<string, number>
  /** 过程指标：只取步骤级命中率分布。 */
  insights?: InsightSummary
}

/** 把金额塞进单个桶：表格只按总额展示，桶名保持 Money 的形状。 */
function singleBucket(amount: number): NonNullable<ScopeStat['cost']> {
  return {
    PROMPT_TOKEN: amount,
    PROMPT_CACHE_HIT_TOKEN: 0,
    PROMPT_CACHE_MISS_TOKEN: 0,
    RESPONSE_TOKEN: 0,
    REQUEST: 0,
  }
}

const pct = (part: number, whole: number): number => (whole > 0 ? part / whole : 0)
const pctText = (v: number): string => `${(v * 100).toFixed(v > 0 && v < 0.001 ? 3 : 1)}%`

/**
 * 一行构成：色标 + 名称 + 占比条 + 主数值 + 占比。
 *
 * token 与金额各用一遍：金额那一路不该再显示 token 数（同一个数看两遍只会读错），
 * 所以主数值与条宽都由调用方给，组件本身不认识 token 或金额。
 */
function CompositionRow(props: {
  label: string
  color: string
  barShare: number
  value: string
  valueTip?: string
  share: string
}): React.ReactElement {
  const { label, color, barShare, value, valueTip, share } = props
  return (
    <div className="tlogs-bd-row">
      <i className="tlogs-bd-dot" style={{ background: color }} />
      <span className="tlogs-bd-label">{label}</span>
      <span className="tlogs-bd-bar">
        <i style={{ width: `${Math.min(100, barShare * 100)}%`, background: color }} />
      </span>
      <span className="tlogs-bd-value" title={valueTip}>
        {value}
      </span>
      <span className="tlogs-bd-pct">{share}</span>
    </div>
  )
}

function Kpi(props: { label: string; value: string; tip?: string; glyph?: string }): React.ReactElement {
  return (
    <div className="tlogs-bd-kpi" title={props.tip}>
      <span className="tlogs-bd-kpi-label">
        {props.glyph ? <i className="tlogs-bd-glyph">{props.glyph}</i> : null}
        {props.label}
      </span>
      <b className="tlogs-bd-kpi-value">{props.value}</b>
    </div>
  )
}

function WindowView(props: { w: BreakdownWindow; numberFormat: 'full' | 'short'; t: Translator }): React.ReactElement {
  const { w, numberFormat, t } = props
  const raw = w.stat.raw
  const input = raw.PROMPT_TOKEN + raw.PROMPT_CACHE_HIT_TOKEN + raw.PROMPT_CACHE_MISS_TOKEN
  const total = w.stat.totalTokens
  const cost = w.stat.cost
  const money = cost ? moneyTotal(cost) : undefined
  /** 分母为 0（例如选了没有用量的未来日期）时给「—」：0.0% 会被读成「一次都没命中」。 */
  const pctOrDash = (part: number, whole: number): string => (whole > 0 ? pctText(pct(part, whole)) : '—')

  return (
    <>
      <div className="tlogs-bd-kpis">
        <Kpi
          label={t('breakdown.hitRate')}
          value={pctOrDash(raw.PROMPT_CACHE_HIT_TOKEN, input)}
          tip={t('breakdown.hitRateTip')}
          glyph="◉"
        />
        <Kpi
          label={t('breakdown.outputShare')}
          value={pctOrDash(raw.RESPONSE_TOKEN, total)}
          tip={t('breakdown.outputShareTip')}
          glyph="▲"
        />
        <Kpi label={t('breakdown.requests')} value={formatNumber(raw.REQUEST, numberFormat)} glyph="↺" />
        <Kpi
          label={t('breakdown.cost')}
          value={money === undefined ? '—' : formatMoney(money)}
          tip={money === undefined ? t('breakdown.costTip') : `${t('breakdown.costTip')} ${formatMoneyFull(money)}`}
          glyph="¥"
        />
      </div>

      <div className="tlogs-bd-title">{t('breakdown.tokenTitle')}</div>
      <div className="tlogs-bd-rows">
        {PARTS.map((p) => (
          <CompositionRow
            key={p.id}
            label={t(p.labelKey)}
            color={p.color}
            barShare={pct(raw[p.key], total)}
            value={formatNumber(raw[p.key], numberFormat)}
            valueTip={`${formatNumber(raw[p.key], 'full')} tokens`}
            share={pctText(pct(raw[p.key], total))}
          />
        ))}
      </div>

      <div className="tlogs-bd-title">{t('breakdown.moneyTitle')}</div>
      {cost ? (
        <div className="tlogs-bd-rows">
          {PARTS.map((p) => (
            <CompositionRow
              key={p.id}
              label={t(p.labelKey)}
              color={p.color}
              barShare={pct(cost[p.key], moneyTotal(cost))}
              value={formatMoney(cost[p.key])}
              valueTip={formatMoneyFull(cost[p.key])}
              share={pctText(pct(cost[p.key], moneyTotal(cost)))}
            />
          ))}
        </div>
      ) : (
        <div className="tlogs-hint">{t('breakdown.noCost')}</div>
      )}

      {w.partial ? <div className="tlogs-hint">{t('breakdown.partial')}</div> : null}
    </>
  )
}

const BUCKET_HIT_KEYS: MessageKey[] = [
  'breakdown.hitBucket.1',
  'breakdown.hitBucket.2',
  'breakdown.hitBucket.3',
  'breakdown.hitBucket.4',
  'breakdown.hitBucket.5',
]

export function BreakdownView(props: BreakdownViewProps): React.ReactElement {
  const { breakdown, projects, months, monthDetail, onSelectMonth, currency, numberFormat, unitPrices, insights } = props
  const t = useT()
  const [scope, setScope] = React.useState<ScopeId>('total')
  /** 指定口径：选中的月份（`YYYY-MM`）与日期；日期留空表示整月。 */
  const [month, setMonth] = React.useState<string>(() => months[months.length - 1]?.key ?? '')
  const [day, setDay] = React.useState<string>('')

  /*
   * 「指定」用的是弹窗已经加载过的月明细：换月份只是让 host 拉那一个月的逐日表，
   * 逐日表本身已经带 token 与金额，所以这里不需要新的取数端点。
   */
  const picked = parseYm(month)
  const loaded = monthDetail && picked && monthDetail.year === picked.year && monthDetail.month === picked.month

  React.useEffect(() => {
    if (scope !== 'custom' || !picked || loaded) return
    onSelectMonth(picked.year, picked.month)
  }, [scope, picked, loaded, onSelectMonth])

  if (!breakdown) return <div className="tlogs-empty">{t('breakdown.empty')}</div>

  /** 指定窗口：选到日期就只看那一天，否则整月。 */
  const customWindow = ((): BreakdownWindow | undefined => {
    if (!monthDetail || !loaded) return undefined
    if (day) {
      const row = monthDetail.days.find((d) => d.key === day)
      if (!row) return undefined
      // 零用量的一天没有金额条目，那不是「缺失」——只有当天真有调用才算没拿到钱。
      const used = row.stat.totalTokens > 0 || row.stat.requests > 0
      return { stat: row.stat, currency: monthDetail.currency ?? currency, partial: used && !row.stat.cost }
    }
    return {
      stat: monthDetail.stat,
      currency: monthDetail.currency ?? currency,
      partial: monthDetail.costAvailable === false,
    }
  })()

  const window = scope === 'custom' ? customWindow : breakdown[scope]

  return (
    <div className="tlogs-bd">
      <div className="tlogs-chart-controls">
        <span className="tlogs-ctl-group" role="group" aria-label={t('breakdown.scope')}>
          <span className="tlogs-ctl-label">{t('breakdown.scope')}</span>
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === scope ? 'tlogs-tab is-active' : 'tlogs-tab'}
              onClick={() => setScope(s.id)}
              aria-pressed={s.id === scope}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </span>

        {scope === 'custom' ? (
          <>
            <span className="tlogs-ctl-group">
              <span className="tlogs-ctl-label">{t('breakdown.pickMonth')}</span>
              <select
                className="tlogs-input tlogs-chart-select"
                value={month}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setMonth(e.target.value)
                  setDay('')
                }}
                aria-label={t('breakdown.pickMonth')}
              >
                {months.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.key}
                  </option>
                ))}
              </select>
            </span>
            <span className="tlogs-ctl-group">
              <span className="tlogs-ctl-label">{t('breakdown.pickDay')}</span>
              <select
                className="tlogs-input tlogs-chart-select"
                value={day}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDay(e.target.value)}
                aria-label={t('breakdown.pickDay')}
                disabled={!loaded}
              >
                <option value="">{t('breakdown.wholeMonth')}</option>
                {(monthDetail?.days ?? []).map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.key}
                  </option>
                ))}
              </select>
            </span>
          </>
        ) : null}
      </div>

      {window ? (
        <WindowView w={window} numberFormat={numberFormat} t={t} />
      ) : (
        <div className="tlogs-empty">{t('breakdown.loadingMonth')}</div>
      )}

      {insights ? (
        <>
          <div className="tlogs-bd-title">{t('breakdown.stepHitTitle')}</div>
          <div className="tlogs-bd-rows">
            {insights.stepHitBuckets.map((n, i) => {
              const total = insights.stepHitBuckets.reduce((a, b) => a + b, 0)
              const max = Math.max(1, ...insights.stepHitBuckets)
              return (
                <div className="tlogs-bd-row" key={i}>
                  <i className="tlogs-bd-dot" style={{ background: 'var(--tlogs-c1)' }} />
                  <span className="tlogs-bd-label">{t(BUCKET_HIT_KEYS[i]!)}</span>
                  <span className="tlogs-bd-bar">
                    <i style={{ width: `${Math.min(100, (n / max) * 100)}%`, background: 'var(--tlogs-c1)' }} />
                  </span>
                  <span className="tlogs-bd-value">{formatNumber(n, numberFormat)}</span>
                  <span className="tlogs-bd-pct">{total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—'}</span>
                </div>
              )
            })}
          </div>
          <div className="tlogs-hint">{t('breakdown.stepHitHint')}</div>
        </>
      ) : null}

      <div className="tlogs-bd-title">{t('breakdown.projects')}</div>
      <div className="tlogs-hint">{t('breakdown.projectsHint')}</div>
      {unitPrices ? <div className="tlogs-hint">{t('breakdown.estimatedHint')}</div> : null}
      <StatTable
        rows={projects.map((p) => {
          const raw = p.stat.raw as unknown as Record<string, number>
          let estimate = 0
          let any = false
          for (const [type, price] of Object.entries(unitPrices ?? {})) {
            const tokens = raw[type] ?? 0
            if (tokens > 0 && price > 0) {
              estimate += tokens * price
              any = true
            }
          }
          return {
            key: p.id,
            label: p.label,
            stat: any ? { ...p.stat, cost: singleBucket(estimate), currency } : p.stat,
          }
        })}
      />
    </div>
  )
}
