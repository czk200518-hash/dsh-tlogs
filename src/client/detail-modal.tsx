/**
 * tlogs — the detail modal, calendar included.
 *
 * A real overlay (the one place using position: fixed) rather than an in-place view switch:
 * the sidebar is too narrow for the tables and the calendar, while the compact bar and the
 * expanded panel stay in document flow. The host keeps per-day detail for every month it has
 * fetched, so any month in history can be shown, not just the current one.
 */

import * as React from 'react'
import { h, Fragment } from './h.js'
import { formatFull, formatMoneyFull, formatMoneyShort, formatNumber, localReasonLabel } from './format.js'
import { moneyTotal } from '../types.js'
import { StatTable } from './detail-view.js'
import { ChartPanel } from './chart-panel.js'
import { SettingsPanel } from './settings-panel.js'
import { useT, type MessageKey, type Translator } from './i18n/index.js'
import type { DetailData, MonthDetail, SeriesQuery, ScopeStat, StatRow, UsageSeries } from '../types.js'

export interface DetailModalProps {
  detail: DetailData | null
  monthDetail: MonthDetail | null
  series: UsageSeries | null
  seriesLoading: boolean
  loading: boolean
  busy: boolean
  error?: string | null
  onClose: () => void
  onRefresh: () => void
  /** Ask for the month the calendar should show; the host fetches that month's daily detail. */
  onSelectMonth: (year: number, month: number) => void
  /** Ask for chart data (range × project). */
  onLoadSeries: (query: SeriesQuery) => void
}

type Tab = 'calendar' | 'charts' | 'models' | 'providers' | 'years' | 'months' | 'days' | 'settings'

/**
 * The tab table holds keys, not text: labels have to follow the language, so they are resolved
 * at render time rather than frozen at module load. Settings sits last, set apart from the data
 * tabs. The providers table follows the platform-scoped models table although its rows come
 * from the local session logs (including Volcengine / Xiaomi / GLM usage the platform bill
 * never sees); each header explains the difference in scope.
 */
const TABS: Array<{ id: Tab; labelKey: MessageKey }> = [
  { id: 'calendar', labelKey: 'tab.calendar' },
  { id: 'charts', labelKey: 'tab.charts' },
  { id: 'models', labelKey: 'tab.models' },
  { id: 'providers', labelKey: 'tab.providers' },
  { id: 'years', labelKey: 'tab.years' },
  { id: 'months', labelKey: 'tab.months' },
  { id: 'days', labelKey: 'tab.days' },
  { id: 'settings', labelKey: 'tab.settings' },
]

/** Weekday headers in Monday-first order, matching the plugin's "this week = Monday to now". */
const WEEKDAY_KEYS: MessageKey[] = [
  'weekday.1',
  'weekday.2',
  'weekday.3',
  'weekday.4',
  'weekday.5',
  'weekday.6',
  'weekday.7',
]

const pad2 = (n: number): string => String(n).padStart(2, '0')
const ymKey = (y: number, m: number): string => `${y}-${pad2(m)}`

/** Parse `YYYY-MM`; undefined when the key is malformed. */
function parseYm(key: string): { year: number; month: number } | undefined {
  const m = /^(\d{4})-(\d{1,2})$/.exec(key)
  if (!m) return undefined
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return undefined
  return { year, month }
}

/** Number of days in a month. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Weekday of the 1st (0 = Sunday) shifted to a Monday-first 0..6. */
function leadingBlanks(year: number, month: number): number {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  return (dow + 6) % 7
}

/** The four counters the display needs; ScopeStat is structurally compatible with it. */
type Counters = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requests: number
  cost?: ScopeStat['cost']
}

const ZERO_COUNTERS: Counters = { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 }

/**
 * Summary row: input / output / total tokens / requests, plus ¥ when there is cost data.
 *
 * The money entry appears only when there really is cost data: a hard ¥0.00 would claim the
 * period spent nothing, when the backfill simply has not reached it.
 */
function statLine(
  stat: Counters,
  t: Translator,
): Array<{ key: MessageKey; label: string; text: string; full: string }> {
  const out = [
    { key: 'stat.input', label: t('stat.input'), text: formatNumber(stat.inputTokens, 'short'), full: formatFull(stat.inputTokens) },
    { key: 'stat.output', label: t('stat.output'), text: formatNumber(stat.outputTokens, 'short'), full: formatFull(stat.outputTokens) },
    { key: 'stat.totalTokens', label: t('stat.totalTokens'), text: formatNumber(stat.totalTokens, 'short'), full: formatFull(stat.totalTokens) },
    { key: 'stat.requests', label: t('stat.requests'), text: formatNumber(stat.requests, 'short'), full: formatFull(stat.requests) },
  ] as Array<{ key: MessageKey; label: string; text: string; full: string }>
  if (stat.cost) {
    const m = moneyTotal(stat.cost)
    out.push({
      key: 'stat.cost',
      label: t('stat.cost'),
      text: formatMoneyShort(m),
      full: formatMoneyFull(m),
    })
  }
  return out
}

/** Calendar panel. */
function Calendar(props: {
  months: StatRow[]
  monthDetail: MonthDetail | null
  onSelectMonth: (year: number, month: number) => void
}): React.ReactElement {
  const { months, monthDetail, onSelectMonth } = props
  const t = useT()

  /**
   * Months are always handled in ascending `YYYY-MM` order and never in the host's delivery
   * order: defaulting to the last entry would land on an earlier month whenever the host sends
   * them descending.
   */
  const sorted = React.useMemo(
    () => [...months].sort((a, b) => a.key.localeCompare(b.key)),
    [months],
  )

  const [sel, setSel] = React.useState<{ year: number; month: number } | null>(null)
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (sel || sorted.length === 0) return
    const last = sorted[sorted.length - 1]!
    const ym = parseYm(last.key)
    if (!ym) return
    setSel(ym)
    onSelectMonth(ym.year, ym.month)
  }, [sorted, sel, onSelectMonth])

  if (sorted.length === 0) return <div className="tlogs-empty">{t('common.noData')}</div>

  const pick = (ym: { year: number; month: number }) => {
    setSel(ym)
    setSelectedDate(null)
    onSelectMonth(ym.year, ym.month)
  }

  const idx = sel ? sorted.findIndex((r) => r.key === ymKey(sel.year, sel.month)) : -1
  const step = (delta: number) => {
    if (idx < 0) return
    const next = sorted[idx + delta]
    if (!next) return
    const ym = parseYm(next.key)
    if (ym) pick(ym)
  }

  const current = sel ?? (() => {
    const ym = parseYm(sorted[sorted.length - 1]!.key)
    return ym ?? { year: 0, month: 0 }
  })()

  const byDate = new Map<string, Counters>()
  for (const d of monthDetail?.days ?? []) byDate.set(d.key, d.stat)
  const maxDay = Math.max(1, ...[...byDate.values()].map((s) => s.totalTokens))
  const maxCost = Math.max(0, ...[...byDate.values()].map((s) => (s.cost ? moneyTotal(s.cost) : 0)))
  const hasCost = maxCost > 0

  const total = daysInMonth(current.year, current.month)
  const blanks = leadingBlanks(current.year, current.month)

  /**
   * The calendar always renders 6 rows (42 cells), padded with blanks; 31 days plus up to 6
   * leading blanks is the worst case. Rendering only what a month needs would make the dialog
   * height jump between a 5-row and a 6-row month. The money line is rendered unconditionally
   * for the same reason, empty when there is no data, so cells keep a single height.
   */
  const CAL_CELLS = 42
  const cells: Array<React.ReactElement> = []
  for (let i = 0; i < blanks; i++) {
    cells.push(<div key={`blank-${i}`} className="tlogs-cal-cell is-empty" />)
  }
  for (let day = 1; day <= total; day++) {
    const date = `${ymKey(current.year, current.month)}-${pad2(day)}`
    const stat = byDate.get(date)
    const value = stat?.totalTokens ?? 0
    // Heat takes the larger of the token and cost ratios, so an expensive day with few tokens
    // does not stay invisible.
    const heatToken = stat ? value / maxDay : 0
    const dayCost = stat?.cost ? moneyTotal(stat.cost) : 0
    const heatCost = maxCost > 0 ? dayCost / maxCost : 0
    const heat = stat ? Math.round(Math.max(heatToken, heatCost) * 55) : 0
    const title = stat
      ? t('cal.cell', {
          date,
          tokens: formatFull(value),
          requests: formatFull(stat.requests),
          cost: stat.cost ? t('cal.cellCost', { money: formatMoneyFull(dayCost) }) : '',
        })
      : t('cal.cellNoData', { date })
    cells.push(
      <button
        key={date}
        type="button"
        className={selectedDate === date ? 'tlogs-cal-cell is-selected' : 'tlogs-cal-cell'}
        style={heat > 0 ? { background: `color-mix(in srgb, var(--tlogs-accent) ${heat}%, transparent)` } : undefined}
        title={title}
        onClick={() => setSelectedDate(date)}
        data-date={date}
      >
        <span className="tlogs-cal-day">{day}</span>
        <span className="tlogs-cal-val">{stat ? formatNumber(value, 'short') : '—'}</span>
        <span className="tlogs-cal-money">
          {stat?.cost && hasCost ? formatMoneyShort(moneyTotal(stat.cost)) : ''}
        </span>
      </button>,
    )
  }
  for (let i = cells.length; i < CAL_CELLS; i++) {
    cells.push(<div key={`tail-${i}`} className="tlogs-cal-cell is-empty" />)
  }

  const selected = selectedDate ? byDate.get(selectedDate) : undefined

  return (
    <Fragment>
      <div className="tlogs-cal-nav">
        <button
          type="button"
          className="tlogs-btn"
          onClick={() => step(-1)}
          disabled={idx <= 0}
          aria-label={t('cal.prevMonth')}
        >
          ‹
        </button>
        <select
          className="tlogs-input tlogs-cal-select"
          value={ymKey(current.year, current.month)}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const ym = parseYm(e.target.value)
            if (ym) pick(ym)
          }}
          aria-label={t('cal.selectMonth')}
        >
          {sorted.map((r) => (
            <option key={r.key} value={r.key}>
              {t('cal.option', {
                key: r.key,
                tokens: formatNumber(r.stat.totalTokens, 'short'),
                cost: r.stat.cost
                  ? t('cal.optionCost', { money: formatMoneyShort(moneyTotal(r.stat.cost)) })
                  : '',
              })}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="tlogs-btn"
          onClick={() => step(1)}
          disabled={idx < 0 || idx >= sorted.length - 1}
          aria-label={t('cal.nextMonth')}
        >
          ›
        </button>
      </div>

      <div className="tlogs-cal-summary">
        <span className="tlogs-cal-summary-title">
          {t('cal.monthTotal', { month: ymKey(current.year, current.month) })}
        </span>
        {statLine(monthDetail?.stat ?? ZERO_COUNTERS, t).map((s) => (
          <span key={s.key} className="tlogs-metric" title={s.full}>
            <span className="tlogs-metric-label">{s.label}</span>
            <span className="tlogs-metric-value">{s.text}</span>
          </span>
        ))}
      </div>

      {byDate.size === 0 ? (
        // Fallback: say the daily detail is unavailable rather than render a grid of dashes.
        // The plugin normally backfills missing days (history.plan).
        <div className="tlogs-empty">{t('cal.noDaily')}</div>
      ) : (
        <Fragment>
          <div className="tlogs-cal" role="grid">
            {WEEKDAY_KEYS.map((w) => (
              <div key={w} className="tlogs-cal-head">
                {t(w)}
              </div>
            ))}
            {cells}
          </div>

          <div className="tlogs-cal-detail">
            {selectedDate && selected ? (
              <Fragment>
                <span className="tlogs-cal-summary-title">{selectedDate}</span>
                {statLine(selected, t).map((s) => (
                  <span key={s.key} className="tlogs-metric" title={s.full}>
                    <span className="tlogs-metric-label">{s.label}</span>
                    <span className="tlogs-metric-value">{s.text}</span>
                  </span>
                ))}
              </Fragment>
            ) : (
              <span className="tlogs-hint">{t('cal.pickDay')}</span>
            )}
          </div>
        </Fragment>
      )}
    </Fragment>
  )
}

export function DetailModal(props: DetailModalProps): React.ReactElement {
  const { detail, monthDetail, series, seriesLoading, loading, busy, error, onClose, onRefresh, onSelectMonth, onLoadSeries } = props
  const [tab, setTab] = React.useState<Tab>('calendar')
  const t = useT()

  // Escape closes the dialog.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="tlogs-modal-mask"
      role="presentation"
      onClick={(e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="tlogs-modal" role="dialog" aria-modal="true" aria-label={t('modal.label')}>
        <div className="tlogs-modal-head">
          <span className="tlogs-modal-title">{t('modal.title')}</span>
          <span className="tlogs-actions">
            <button type="button" className="tlogs-btn" onClick={onRefresh} disabled={busy}>
              {busy ? t('common.refreshing') : t('common.refresh')}
            </button>
            <button
              type="button"
              className="tlogs-btn"
              onClick={onClose}
              aria-label={t('modal.close')}
              title={t('modal.closeTitle')}
            >
              ✕
            </button>
          </span>
        </div>

        <div className="tlogs-modal-body">
          <div className="tlogs-tabs" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === tab}
                className={item.id === tab ? 'tlogs-tab is-active' : 'tlogs-tab'}
                onClick={() => setTab(item.id)}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>

          {tab === 'settings' ? (
            // Settings renders before the loading branch: the language switch must not be
            // blocked while usage is still loading.
            <SettingsPanel />
          ) : loading && !detail ? (
            <div className="tlogs-empty">{t('common.loading')}</div>
          ) : tab === 'calendar' ? (
            <Calendar
              months={detail?.months ?? []}
              monthDetail={monthDetail}
              onSelectMonth={onSelectMonth}
            />
          ) : tab === 'charts' ? (
            <ChartPanel
              series={series}
              loading={seriesLoading}
              error={error}
              onLoad={onLoadSeries}
            />
          ) : tab === 'providers' ? (
            <div>
              {/* Scope and coverage belong in the header: local usage comes from session logs,
                  which DSH prunes, so it is not "all time" and its scope differs from the
                  platform models table above. */}
              <div className="tlogs-hint">
                {detail?.localRange
                  ? t('providers.localRange', {
                      source: detail.localRange.sourceLabel
                        ? t('providers.localRangeSource', { source: detail.localRange.sourceLabel })
                        : '',
                      range: `${detail.localRange.from} ~ ${detail.localRange.to}`,
                      days: detail.localRange.days,
                      files: detail.localRange.files,
                    })
                  : t('providers.unavailable', {
                      reason: localReasonLabel(detail?.localUnavailable?.reason),
                    })}
                {t('providers.coverage')}
              </div>
              <StatTable
                rows={detail?.providers ?? []}
                emptyText={
                  detail?.localUnavailable
                    ? t('providers.unavailableLong', {
                        reason: localReasonLabel(detail.localUnavailable.reason),
                      })
                    : t('providers.empty')
                }
              />
            </div>
          ) : tab === 'models' && detail?.modelsIncludeLocal ? (
            <div>
              {/* The models table mixes two scopes: platform rows carry an official cost, local
                  rows (models from other platforms) have none and cover only the days whose
                  session logs still exist. */}
              <div className="tlogs-hint">{t('providers.modelsNote')}</div>
              <StatTable rows={detail?.models ?? []} />
            </div>
          ) : (
            <StatTable
              rows={
                tab === 'models'
                  ? (detail?.models ?? [])
                  : tab === 'years'
                    ? (detail?.years ?? [])
                    : tab === 'months'
                      ? (detail?.months ?? [])
                      : (monthDetail?.days ?? detail?.days ?? [])
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
