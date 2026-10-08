/**
 * tlogs — 「图表」页签（详细数据弹窗内）。
 *
 * 三张图共享同一套控制项，**切换任意控制项三张图一起变**：
 *   范围（有史以来 / 自定义 / 今日 / 本周 / 本月）× 数据源（平台账单 / 指定项目）
 *   × 指标（总 Token / 输入 / 输出 / 缓存命中 / 缓存未命中 / 请求数）× 粒度（自动/天/月/年）
 *
 * 数据来源的口径差异（重要，别混）：
 *  - **平台账单**：账号维度，接口按天返回逐日明细，可回溯到配置的历史起点。
 *  - **指定项目**：只存在于本机。宿主只给「累计至今」一个数，因此趋势依赖插件
 *    自己每天记的快照（`store/project-history.ts`），**无法回溯到启用之前**。
 *    这一点在选中项目时会明确写在界面上，而不是让用户对着一张空图猜。
 */

import * as React from 'react'
import { h, Fragment } from './h.js'
import { formatFull, formatMoneyFull, formatMoneyShort, formatShort } from './format.js'
import { LineChart, StackedBarChart, DonutChart } from './charts.js'
import { type Money } from '../types.js'
import {
  GRAINS,
  METRICS,
  bucketMetricValue,
  bucketValues,
  dayBuckets,
  metricSuffix,
  metricValue,
  monthBuckets,
  pieSlices,
  projectBuckets,
  resolveGrain,
  toPoints,
  yearBuckets,
  type Bucket,
  type ChartGrain,
  type ChartMetric,
} from './chart-utils.js'
import type { ChartRange, SeriesQuery, Stat, UsageSeries } from '../types.js'
import { useT, type MessageKey } from './i18n/index.js'

export interface ChartPanelProps {
  series: UsageSeries | null
  /** 是否正在请求新的图表数据。 */
  loading: boolean
  error?: string | null
  onLoad: (query: SeriesQuery) => void
}

/**
 * 下面几张控制项表里存的是**键**而不是文案：文案必须随语言实时变，
 * 只能在渲染时翻译（模块加载时定死的话，切语言后这一排按钮不会更新）。
 */
const RANGES: ReadonlyArray<{ id: ChartRange; labelKey: MessageKey }> = [
  { id: 'all', labelKey: 'chart.range.all' },
  { id: 'custom', labelKey: 'chart.range.custom' },
  { id: 'today', labelKey: 'chart.range.today' },
  { id: 'week', labelKey: 'chart.range.week' },
  { id: 'month', labelKey: 'chart.range.month' },
  // 与控制台「时间维度」一致的两个滚动窗口。做成图表的范围预设后，
  // 用户可以直接对着控制台把同一条曲线比出来。
  { id: 'last7', labelKey: 'chart.range.last7' },
  { id: 'last30', labelKey: 'chart.range.last30' },
]

type PieDim = 'model' | 'composition' | 'project'

const PIE_DIMS: ReadonlyArray<{ id: PieDim; labelKey: MessageKey }> = [
  { id: 'model', labelKey: 'chart.dim.model' },
  { id: 'composition', labelKey: 'chart.dim.composition' },
  { id: 'project', labelKey: 'chart.dim.project' },
]

type LineMode = 'perBucket' | 'cumulative'

/** 三张图作为「图表」页签下的**子标签**切换（同屏只画一张）。 */
type ChartKind = 'line' | 'pie' | 'bar'

const KINDS: ReadonlyArray<{ id: ChartKind; labelKey: MessageKey }> = [
  { id: 'line', labelKey: 'chart.kind.line' },
  { id: 'pie', labelKey: 'chart.kind.pie' },
  { id: 'bar', labelKey: 'chart.kind.bar' },
]

/** 本地今天（`YYYY-MM-DD`）。 */
function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 本地 N 天前。 */
function daysAgoKey(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 空的五类计量项（用于「构成」聚合）。 */
function zeroStat(): Stat {
  return {
    PROMPT_TOKEN: 0,
    PROMPT_CACHE_HIT_TOKEN: 0,
    PROMPT_CACHE_MISS_TOKEN: 0,
    RESPONSE_TOKEN: 0,
    REQUEST: 0,
  }
}

/** 空的金额五类。 */
function zeroMoney(): Money {
  return zeroStat()
}

/**
 * 累计模式的起点值。
 *
 * 金额不在 `Stat` 里，必须单独取 `priorCost`；否则切到「累计 + 消费金额」时
 * 曲线会从 0 起跳（与 token 侧的行为不一致）。
 */
function priorValue(stat: Stat, cost: number | undefined, metric: ChartMetric): number {
  return metric === 'cost' ? (cost ?? 0) : metricValue(stat, metric)
}

/** 把若干 Stat 相加。 */
function sumStats(list: Stat[]): Stat {
  const acc = zeroStat()
  for (const s of list) {
    acc.PROMPT_TOKEN += s.PROMPT_TOKEN
    acc.PROMPT_CACHE_HIT_TOKEN += s.PROMPT_CACHE_HIT_TOKEN
    acc.PROMPT_CACHE_MISS_TOKEN += s.PROMPT_CACHE_MISS_TOKEN
    acc.RESPONSE_TOKEN += s.RESPONSE_TOKEN
    acc.REQUEST += s.REQUEST
  }
  return acc
}

export function ChartPanel(props: ChartPanelProps): React.ReactElement {
  const { series, loading, error, onLoad } = props
  const t = useT()

  const [range, setRange] = React.useState<ChartRange>('all')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [projectId, setProjectId] = React.useState('')
  const [metric, setMetric] = React.useState<ChartMetric>('total')
  const [grain, setGrain] = React.useState<ChartGrain>('auto')
  const [mode, setMode] = React.useState<LineMode>('perBucket')
  const [pieDim, setPieDim] = React.useState<PieDim>('model')
  /** 当前显示哪张图（子标签）。切它**不发请求**，只换渲染。 */
  const [kind, setKind] = React.useState<ChartKind>('line')

  /**
   * 只在「查询参数真的变了」时发请求。
   *
   * 用签名字符串（而不是把 series 放进依赖）是为了避免「请求 → 新 series →
   * 触发 effect → 再请求」的循环：series 变化不改变签名，因此不会重发。
   */
  const lastSig = React.useRef('')
  React.useEffect(() => {
    if (range === 'custom' && (!from || !to)) return
    const query: SeriesQuery = { range }
    if (range === 'custom') {
      query.from = from
      query.to = to
    }
    if (projectId) query.projectId = projectId
    const sig = JSON.stringify(query)
    if (lastSig.current === sig) return
    lastSig.current = sig
    onLoad(query)
  }, [range, from, to, projectId, onLoad])

  const projectSource = projectId !== ''
  const selectedProject = series?.projects.find((p) => p.id === projectId)

  /**
   * 选中的项目从列表里消失时（宿主重启后会话被清理、项目被删）把选择清掉。
   *
   * 否则 `<select value>` 会指向一个不存在的 option：浏览器显示第一项、而 state
   * 仍是旧 id，界面与实际查询的数据源对不上。
   */
  React.useEffect(() => {
    if (!projectId || !series) return
    if (series.projects.length === 0) return
    if (series.projects.some((p) => p.id === projectId)) return
    setProjectId('')
  }, [projectId, series])

  const resolvedGrain = series ? resolveGrain(grain, series.from, series.to) : 'day'

  /** 时间桶：项目维度走快照，平台维度按粒度取逐日 / 逐月 / 逐年。 */
  const buckets: Bucket[] = React.useMemo(() => {
    if (!series) return []
    if (projectSource) {
      const points = series.project?.points ?? []
      return projectBuckets(points, series.project?.prior?.stat, mode)
    }
    if (resolvedGrain === 'day') return dayBuckets(series.days, series.from, series.to)
    if (resolvedGrain === 'year') return yearBuckets(series.months)
    return monthBuckets(series.months)
  }, [series, projectSource, resolvedGrain, mode])

  /** 折线图的数值：平台维度可在「每期」与「累计」之间切；项目维度的桶已内含口径。 */
  const values = React.useMemo(() => {
    if (projectSource) return buckets.map((b) => bucketMetricValue(b, metric))
    const prior = mode === 'cumulative' && series ? priorValue(series.prior, series.priorCost, metric) : 0
    return bucketValues(buckets, metric, mode, prior)
  }, [buckets, metric, mode, projectSource, series])

  const points = React.useMemo(() => toPoints(buckets, values), [buckets, values])

  const metricDef = METRICS.find((m) => m.id === metric)!
  const unit = metricDef.unit

  /** 范围内的合计（用于环形中心与说明）：只累加**月度合计**，因此不会因缺天而低估。 */
  const rangeStat = React.useMemo(
    () => (series ? sumStats(series.months.map((m) => m.stat)) : zeroStat()),
    [series],
  )

  /** 范围内的金额合计（元）。金额不在 `Stat` 里，因此单独累加。 */
  const rangeCost = React.useMemo(
    () => (series ? series.months.reduce((s, m) => s + (m.cost ?? 0), 0) : 0),
    [series],
  )

  /** 范围内的金额构成（输入命中 / 未命中 / 输出），由 host 一次算好下发。 */
  const rangeMoney: Money = series?.costByType ?? zeroMoney()

  /** 环形图的维度：选中项目时不再有「按模型」——平台模型与该项目无关，会误导。 */
  const effectiveDim: PieDim = projectSource && pieDim === 'model' ? 'composition' : pieDim
  const dims = projectSource ? PIE_DIMS.filter((d) => d.id !== 'model') : PIE_DIMS

  const pieItems = React.useMemo(() => {
    if (!series) return []
    if (effectiveDim === 'model') {
      return series.models.map((m) => ({
        key: m.key,
        label: m.key,
        // 模型金额只有总额（`SeriesPoint.cost`），没有五类拆分。
        value: metric === 'cost' ? (m.cost ?? 0) : metricValue(m.stat, metric),
      }))
    }
    if (effectiveDim === 'project') {
      // 项目用量来自本机会话投影，平台账单里没有它的金额 —— 明确返回空，
      // 由饼图的 emptyText 说明，而不是画一张全 0 的图。
      if (metric === 'cost') return []
      return series.projects.map((p) => ({ key: p.id, label: p.label, value: metricValue(p.stat, metric) }))
    }
    // 构成维度：金额走 Money 的五类拆分，其余走 Stat。
    if (metric === 'cost') {
      return [
        { key: 'hit', label: t('chart.legend.hit'), value: rangeMoney.PROMPT_CACHE_HIT_TOKEN },
        {
          key: 'miss',
          label: t('chart.legend.miss'),
          value: rangeMoney.PROMPT_CACHE_MISS_TOKEN + rangeMoney.PROMPT_TOKEN,
        },
        { key: 'out', label: t('stat.output'), value: rangeMoney.RESPONSE_TOKEN },
      ]
    }
    const s = projectSource ? sumStats((series.project?.points ?? []).map((p) => p.stat)) : rangeStat
    return [
      { key: 'hit', label: t('chart.legend.hit'), value: s.PROMPT_CACHE_HIT_TOKEN },
      { key: 'miss', label: t('chart.legend.miss'), value: s.PROMPT_CACHE_MISS_TOKEN + s.PROMPT_TOKEN },
      { key: 'out', label: t('stat.output'), value: s.RESPONSE_TOKEN },
    ]
  }, [series, effectiveDim, metric, projectSource, rangeStat, rangeMoney, t])

  // 合并项（「其他」）在渲染时才翻译，因此把 t 的当前结果传进去并随 t 重算。
  const slices = React.useMemo(() => pieSlices(pieItems, 8, t('chart.other')), [pieItems, t])

  const pickRange = (r: ChartRange) => {
    if (r === 'custom' && (!from || !to)) {
      // 首次进入自定义：用当前范围当默认值，用户改起来才有对照。
      setFrom(series?.from ?? daysAgoKey(30))
      setTo(series?.to ?? todayKey())
    }
    setRange(r)
  }

  const projectPoints = series?.project?.points.length ?? 0

  return (
    <Fragment>
      {/*
        图形子标签：紧贴主页签下面。
        右侧的「构成维度」只在饼图时出现 —— 它和图形按钮同高，因此出现/消失
        不会撑动这一行，也就不会推动下面的内容。
      */}
      <div className="tlogs-subtabs">
        <span className="tlogs-ctl-group" role="group" aria-label={t('chart.aria.kind')}>
          <span className="tlogs-ctl-label">{t('chart.label.kind')}</span>
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={k.id === kind ? 'tlogs-tab is-active' : 'tlogs-tab'}
              onClick={() => setKind(k.id)}
              aria-pressed={k.id === kind}
              data-kind={k.id}
            >
              {t(k.labelKey)}
            </button>
          ))}
        </span>

        <span className="tlogs-ctl-group">
          {kind === 'pie' ? (
            <Fragment>
              <span className="tlogs-ctl-label">{t('chart.label.composition')}</span>
              {dims.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={d.id === effectiveDim ? 'tlogs-tab is-active' : 'tlogs-tab'}
                  onClick={() => setPieDim(d.id)}
                  aria-pressed={d.id === effectiveDim}
                >
                  {t(d.labelKey)}
                </button>
              ))}
            </Fragment>
          ) : null}
        </span>
      </div>

      <div className="tlogs-chart-controls">
        <span className="tlogs-ctl-group" role="group" aria-label={t('chart.aria.range')}>
          <span className="tlogs-ctl-label">{t('chart.label.range')}</span>
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === range ? 'tlogs-tab is-active' : 'tlogs-tab'}
              onClick={() => pickRange(r.id)}
              aria-pressed={r.id === range}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </span>

        <span className="tlogs-ctl-group">
          <span className="tlogs-ctl-label">{t('chart.label.source')}</span>
          <select
            className="tlogs-input tlogs-chart-select"
            value={projectId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProjectId(e.target.value)}
            aria-label={t('chart.aria.source')}
          >
            <option value="">{t('chart.source.platform')}</option>
            {(series?.projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="tlogs-chart-controls">
        <span className="tlogs-ctl-group">
          <span className="tlogs-ctl-label">{t('chart.label.metric')}</span>
          <select
            className="tlogs-input tlogs-chart-select"
            value={metric}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMetric(e.target.value as ChartMetric)}
            aria-label={t('chart.aria.metric')}
          >
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {t(m.labelKey)}
              </option>
            ))}
          </select>
        </span>

        <span className="tlogs-ctl-group">
          <span className="tlogs-ctl-label">{t('chart.label.grain')}</span>
          <select
            className="tlogs-input tlogs-chart-select"
            value={grain}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGrain(e.target.value as ChartGrain)}
            aria-label={t('chart.aria.grain')}
            disabled={projectSource}
          >
            {GRAINS.map((g) => (
              <option key={g.id} value={g.id}>
                {t(g.labelKey)}
              </option>
            ))}
          </select>
        </span>

        <span className="tlogs-ctl-group">
          <span className="tlogs-ctl-label">{t('chart.label.basis')}</span>
          <button
            type="button"
            className={mode === 'perBucket' ? 'tlogs-tab is-active' : 'tlogs-tab'}
            onClick={() => setMode('perBucket')}
            aria-pressed={mode === 'perBucket'}
          >
            {t('chart.mode.perBucket')}
          </button>
          <button
            type="button"
            className={mode === 'cumulative' ? 'tlogs-tab is-active' : 'tlogs-tab'}
            onClick={() => setMode('cumulative')}
            aria-pressed={mode === 'cumulative'}
          >
            {t('chart.mode.cumulative')}
          </button>
        </span>
      </div>

      {range === 'custom' ? (
        <div className="tlogs-chart-controls">
          <span className="tlogs-ctl-group">
            <span className="tlogs-ctl-label">{t('chart.label.from')}</span>
            <input
              type="date"
              className="tlogs-input tlogs-chart-date"
              value={from}
              max={to || todayKey()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)}
              aria-label={t('chart.aria.from')}
            />
            <span className="tlogs-ctl-label">{t('chart.label.to')}</span>
            <input
              type="date"
              className="tlogs-input tlogs-chart-date"
              value={to}
              min={from || undefined}
              max={todayKey()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTo(e.target.value)}
              aria-label={t('chart.aria.to')}
            />
          </span>
        </div>
      ) : null}

      {series ? (
        <div className="tlogs-chart-scope">
          <span className="tlogs-chart-scope-range">
            {series.from} ~ {series.to}
          </span>
          <span
            className="tlogs-metric"
            title={
              metric === 'cost'
                ? `${formatMoneyFull(rangeCost)}${t('chart.unit.money')}`
                : formatFull(metricValue(rangeStat, metric))
            }
          >
            <span className="tlogs-metric-label">{t('chart.rangeTotal')}</span>
            <span className="tlogs-metric-value">
              {metric === 'cost'
                ? formatMoneyShort(rangeCost)
                : formatShort(metricValue(rangeStat, metric))}
              {metricSuffix(unit, t)}
            </span>
          </span>
          <span className="tlogs-metric">
            <span className="tlogs-metric-label">{t('stat.requests')}</span>
            <span className="tlogs-metric-value">
              {formatFull(rangeStat.REQUEST)}
              {t('chart.unit.requests')}
            </span>
          </span>
          {/* 金额回补未完成时曲线会把缺的月份当 0 画，必须说明。 */}
          {metric === 'cost' && series.costPartial ? (
            <span className="tlogs-chart-scope-note">{t('chart.costPartial')}</span>
          ) : null}
          <span className="tlogs-chart-scope-note">
            {projectSource
              ? t('chart.scope.snapshots', { n: projectPoints })
              : t(
                  resolvedGrain === 'day'
                    ? 'chart.scope.bucketsDay'
                    : resolvedGrain === 'month'
                      ? 'chart.scope.bucketsMonth'
                      : 'chart.scope.bucketsYear',
                  { n: buckets.length },
                )}
          </span>
          {loading ? <span className="tlogs-chart-busy">{t('chart.updating')}</span> : null}
        </div>
      ) : null}

      {error ? <div className="tlogs-error">{error}</div> : null}

      {!series ? (
        <div className="tlogs-empty">{loading ? t('common.loading') : t('chart.noData')}</div>
      ) : (
        <Fragment>
          {series.partial && !projectSource ? (
            <div className="tlogs-hint">
              {t('chart.partialNote.lead')}
              <b>{t('chart.partialNote.bold')}</b>
              {t('chart.partialNote.tail')}
            </div>
          ) : null}

          {projectSource && projectPoints < 2 ? (
            <div className="tlogs-hint">{t('chart.projectSnapshots', { n: projectPoints })}</div>
          ) : null}

          {/*
            固定高度的「舞台」里只放当前选中的那张图。
            三张图高度不同（折线 220 / 堆叠柱 236 / 环形 170），舞台给统一下界 + 卡片撑满，
            因此切子标签时下面的内容不会上下跳，弹窗外框更是一个像素都不动。
          */}
          <div className="tlogs-chart-stage">
            {kind === 'line' ? (
              <div className="tlogs-chart-card">
                <div className="tlogs-chart-head">
                  <span className="tlogs-chart-title">
                    {t('chart.title.line')}
                    <span className="tlogs-chart-sub">
                      {t(metricDef.labelKey)}
                      {mode === 'cumulative' ? t('chart.sub.cumulative') : t('chart.sub.perBucket')}
                    </span>
                  </span>
                </div>
                <LineChart points={points} unit={unit} cumulative={mode === 'cumulative'} />
              </div>
            ) : kind === 'pie' ? (
              <div className="tlogs-chart-card">
                <div className="tlogs-chart-head">
                  <span className="tlogs-chart-title">
                    {t('chart.title.pie')}
                    <span className="tlogs-chart-sub">
                      {effectiveDim === 'model'
                        ? t('chart.dim.model')
                        : effectiveDim === 'project'
                          ? t('chart.dim.project')
                          : t('chart.sub.composition')}
                    </span>
                  </span>
                </div>
                <DonutChart
                  slices={slices}
                  centerLabel={
                    effectiveDim === 'model'
                      ? t('chart.dim.model')
                      : effectiveDim === 'project'
                        ? t('chart.dim.project')
                        : projectSource
                          ? (selectedProject?.label ?? t('chart.selectedProject'))
                          : t('chart.rangeTotal')
                  }
                  centerValue={
                    metric === 'cost'
                      ? formatMoneyShort(slices.reduce((s, x) => s + x.value, 0))
                      : formatShort(slices.reduce((s, x) => s + x.value, 0))
                  }
                  unit={unit}
                  emptyText={
                    effectiveDim === 'project'
                      ? metric === 'cost'
                        ? t('chart.empty.projectCost')
                        : t('chart.empty.project')
                      : t('chart.empty.composition')
                  }
                />
              </div>
            ) : (
              <div className="tlogs-chart-card">
                <div className="tlogs-chart-head">
                  <span className="tlogs-chart-title">
                    {t('chart.title.bar')}
                    <span className="tlogs-chart-sub">{t('chart.sub.bar')}</span>
                  </span>
                </div>
                <StackedBarChart points={points} />
              </div>
            )}
          </div>
        </Fragment>
      )}
    </Fragment>
  )
}
