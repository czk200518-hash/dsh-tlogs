/**
 * tlogs — 详细数据弹窗（含日历查询）。
 *
 * 取代原先「在侧边栏页脚内就地切换」的详细视图：侧边栏太窄，表格与日历都需要
 * 横向空间，所以改成浮层弹窗（同一容器内不再切换视图）。
 *
 * 日历查询的数据来源：host 侧每个已抓取的月份都把**逐日明细**存进了历史缓存，
 * 因此这里可以回溯任意月份的每一天，而不是只有当月。
 *
 * 关于 `position: fixed`：需求 1.1 要求内嵌组件留在文档流内、不得用 fixed 伪造悬浮；
 * 那一条针对的是**侧边栏页脚里的组件**（紧凑条与展开面板，至今仍然遵守）。
 * 弹窗本质上就该是浮层，因此它的遮罩/对话框使用 fixed。
 */

import * as React from 'react'
import { h, Fragment } from './h.js'
import { formatFull, formatMoneyFull, formatMoneyShort, formatNumber, localReasonLabel } from './format.js'
import { moneyTotal } from '../types.js'
import { StatTable } from './detail-view.js'
import { ChartPanel } from './chart-panel.js'
import type { DetailData, MonthDetail, SeriesQuery, ScopeStat, StatRow, UsageSeries } from '../types.js'

export interface DetailModalProps {
  detail: DetailData | null
  monthDetail: MonthDetail | null
  /** 图表数据（图表页签用）。 */
  series: UsageSeries | null
  /** 图表数据是否正在请求。 */
  seriesLoading: boolean
  /** 详细数据是否仍在加载。 */
  loading: boolean
  busy: boolean
  error?: string | null
  onClose: () => void
  onRefresh: () => void
  /** 请求切换日历显示的月份（host 侧按需拉取该月逐日明细）。 */
  onSelectMonth: (year: number, month: number) => void
  /** 请求图表数据（范围 × 项目）。 */
  onLoadSeries: (query: SeriesQuery) => void
}

type Tab = 'calendar' | 'charts' | 'models' | 'providers' | 'years' | 'months' | 'days'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'calendar', label: '日历' },
  { id: 'charts', label: '图表' },
  { id: 'models', label: '模型' },
  // 「供应商」表来自本机会话日志（含平台账单看不到的火山方舟/小米/GLM…），
  // 紧跟在平台口径的「模型」表后面，两张表的口径差异在表头上写明。
  { id: 'providers', label: '供应商' },
  { id: 'years', label: '年' },
  { id: 'months', label: '月' },
  { id: 'days', label: '当月按天' },
]

/** 周一起始的星期标题（与插件「本周 = 周一至今」的口径一致）。 */
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const pad2 = (n: number): string => String(n).padStart(2, '0')
const ymKey = (y: number, m: number): string => `${y}-${pad2(m)}`

/** 解析 `YYYY-MM`。非法返回 undefined。 */
function parseYm(key: string): { year: number; month: number } | undefined {
  const m = /^(\d{4})-(\d{1,2})$/.exec(key)
  if (!m) return undefined
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return undefined
  return { year, month }
}

/** 某年某月的天数。 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** 该月 1 日是周几（0=周日），偏移到「周一起始」的 0..6。 */
function leadingBlanks(year: number, month: number): number {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  return (dow + 6) % 7
}

/** 只取展示需要的四个计数（ScopeStat 结构上兼容它）。 */
type Counters = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requests: number
  cost?: ScopeStat['cost']
}

const ZERO_COUNTERS: Counters = { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 }

/**
 * 汇总行：输入 / 输出 / 总 Token / 请求（+ 有金额时的 ¥）。
 *
 * 金额项**只在真的有金额数据时出现**：没有金额而硬显示 ¥0.00 会让人以为真没花钱，
 * 而实际是那一段还没回补到金额。
 */
function statLine(stat: Counters): Array<{ label: string; text: string; full: string }> {
  const out = [
    { label: '输入', text: formatNumber(stat.inputTokens, 'short'), full: formatFull(stat.inputTokens) },
    { label: '输出', text: formatNumber(stat.outputTokens, 'short'), full: formatFull(stat.outputTokens) },
    { label: '总 Token', text: formatNumber(stat.totalTokens, 'short'), full: formatFull(stat.totalTokens) },
    { label: '请求', text: formatNumber(stat.requests, 'short'), full: formatFull(stat.requests) },
  ]
  if (stat.cost) {
    const m = moneyTotal(stat.cost)
    out.push({ label: '金额', text: formatMoneyShort(m), full: formatMoneyFull(m) })
  }
  return out
}

/** 日历面板。 */
function Calendar(props: {
  months: StatRow[]
  monthDetail: MonthDetail | null
  onSelectMonth: (year: number, month: number) => void
}): React.ReactElement {
  const { months, monthDetail, onSelectMonth } = props

  /**
   * 月份一律按 `YYYY-MM` 升序处理，**不依赖 host 的下发顺序**。
   *
   * （原先直接用传入数组的末项当默认月份，一旦顺序是降序就会默认到更早的月份 ——
   * 实测就踩到了：默认落在 8 月而不是 9 月。）
   */
  const sorted = React.useMemo(
    () => [...months].sort((a, b) => a.key.localeCompare(b.key)),
    [months],
  )

  /** 已选月份：初始为最新一个有数据的月份。 */
  const [sel, setSel] = React.useState<{ year: number; month: number } | null>(null)
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)

  // 月份列表就绪后补上默认选中项（只在还没选过时）。
  React.useEffect(() => {
    if (sel || sorted.length === 0) return
    const last = sorted[sorted.length - 1]!
    const ym = parseYm(last.key)
    if (!ym) return
    setSel(ym)
    onSelectMonth(ym.year, ym.month)
  }, [sorted, sel, onSelectMonth])

  if (sorted.length === 0) return <div className="tlogs-empty">暂无数据</div>

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

  // 该月逐日统计：date -> 计数（含金额）
  const byDate = new Map<string, Counters>()
  for (const d of monthDetail?.days ?? []) byDate.set(d.key, d.stat)
  const maxDay = Math.max(1, ...[...byDate.values()].map((s) => s.totalTokens))
  const maxCost = Math.max(0, ...[...byDate.values()].map((s) => (s.cost ? moneyTotal(s.cost) : 0)))
  const hasCost = maxCost > 0

  const total = daysInMonth(current.year, current.month)
  const blanks = leadingBlanks(current.year, current.month)

  /**
   * 日历**固定 6 行（42 格）**，不足的部分补空格。
   *
   * 为什么：一次最多需要 6 行（31 天 + 最多 6 个前置空格）。如果按实际需要渲染，
   * 7 月只要 5 行、8 月要 6 行，切月时弹窗高度就会跳一下（用户实测反馈）。补满 42 格
   * 后无论怎么切月，网格高度恒定。
   *
   * 同理：金额那一行**无条件渲染**（无金额时留空占位），否则有/无金额的月份之间
   * 单元格高度会差一行，切月时高度又跳 —— 这正是网格高度恒定要避免的事。
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
    // 热度按 token 与金额的较大者着色：否则「token 少但很贵」的日子会看不出来。
    const heatToken = stat ? value / maxDay : 0
    const dayCost = stat?.cost ? moneyTotal(stat.cost) : 0
    const heatCost = maxCost > 0 ? dayCost / maxCost : 0
    const heat = stat ? Math.round(Math.max(heatToken, heatCost) * 55) : 0
    const title = stat
      ? `${date} · ${formatFull(value)} tokens · ${formatFull(stat.requests)} 次请求` +
        (stat.cost ? ` · ${formatMoneyFull(dayCost)} 元` : '')
      : `${date} · 无数据`
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
  // 尾部补齐到固定格数，保证 6 行恒定
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
          aria-label="上一个月"
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
          aria-label="选择月份"
        >
          {sorted.map((r) => (
            <option key={r.key} value={r.key}>
              {r.key}（{formatNumber(r.stat.totalTokens, 'short')} tokens
              {r.stat.cost ? ` · ${formatMoneyShort(moneyTotal(r.stat.cost))}` : ''}）
            </option>
          ))}
        </select>
        <button
          type="button"
          className="tlogs-btn"
          onClick={() => step(1)}
          disabled={idx < 0 || idx >= sorted.length - 1}
          aria-label="下一个月"
        >
          ›
        </button>
      </div>

      <div className="tlogs-cal-summary">
        <span className="tlogs-cal-summary-title">{ymKey(current.year, current.month)} 合计</span>
        {statLine(monthDetail?.stat ?? ZERO_COUNTERS).map((s) => (
          <span key={s.label} className="tlogs-metric" title={s.full}>
            <span className="tlogs-metric-label">{s.label}</span>
            <span className="tlogs-metric-value">{s.text}</span>
          </span>
        ))}
      </div>

      {byDate.size === 0 ? (
        // 兜底：确实拿不到该月逐日明细时，明确说明而不是渲染一片「—」。
        // （正常情况下插件会自动回补缺失的逐日明细，见 history.plan 的说明。）
        <div className="tlogs-empty">
          该月暂无逐日明细，仅显示上方月度合计。下一次自动刷新会尝试回补。
        </div>
      ) : (
        <Fragment>
          <div className="tlogs-cal" role="grid">
            {WEEKDAYS.map((w) => (
              <div key={w} className="tlogs-cal-head">
                {w}
              </div>
            ))}
            {cells}
          </div>

          <div className="tlogs-cal-detail">
            {selectedDate && selected ? (
              <Fragment>
                <span className="tlogs-cal-summary-title">{selectedDate}</span>
                {statLine(selected).map((s) => (
                  <span key={s.label} className="tlogs-metric" title={s.full}>
                    <span className="tlogs-metric-label">{s.label}</span>
                    <span className="tlogs-metric-value">{s.text}</span>
                  </span>
                ))}
              </Fragment>
            ) : (
              <span className="tlogs-hint">点击日历中的某一天查看当天明细。</span>
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

  // Esc 关闭：弹窗的基本可用性要求。
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
        // 只有点遮罩本身才关闭；点对话框内部不关闭。
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="tlogs-modal" role="dialog" aria-modal="true" aria-label="tlogs 用量详细数据">
        <div className="tlogs-modal-head">
          <span className="tlogs-modal-title">用量详细数据</span>
          <span className="tlogs-actions">
            <button type="button" className="tlogs-btn" onClick={onRefresh} disabled={busy}>
              {busy ? '刷新中…' : '刷新'}
            </button>
            <button
              type="button"
              className="tlogs-btn"
              onClick={onClose}
              aria-label="关闭详细数据"
              title="关闭（Esc）"
            >
              ✕
            </button>
          </span>
        </div>

        <div className="tlogs-modal-body">
          <div className="tlogs-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab}
                className={t.id === tab ? 'tlogs-tab is-active' : 'tlogs-tab'}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading && !detail ? (
            <div className="tlogs-empty">加载中…</div>
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
              {/* 口径与覆盖区间必须写在表头上：本机口径来自会话日志，DSH 会清理旧日志，
                  所以它不是「有史以来」，而且它与上面那张平台「模型」表口径不同。 */}
              <div className="tlogs-hint">
                {detail?.localRange
                  ? `本机口径（DSH 会话日志${detail.localRange.sourceLabel ? ` · ${detail.localRange.sourceLabel}` : ''}）：` +
                    `${detail.localRange.from} ~ ${detail.localRange.to} · ` +
                    `${detail.localRange.days} 天 · ${detail.localRange.files} 个会话日志`
                  : `本机口径不可用（${localReasonLabel(detail?.localUnavailable?.reason)}）`}
                {'；含平台账单看不到的供应商（火山方舟 / 小米 / GLM / GPT…）'}
              </div>
              <StatTable
                rows={detail?.providers ?? []}
                emptyText={
                  detail?.localUnavailable
                    ? `本机口径不可用：${localReasonLabel(detail.localUnavailable.reason)}`
                    : '本机口径暂无数据'
                }
              />
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
