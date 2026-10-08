/**
 * tlogs — 形态 A：紧凑条（默认）。
 *
 * 需求 1.2：高约 28–32px，横向排列核心数字，右侧展开/收起按钮。
 * 需求 1.5：紧凑条上的数字只使用缓存值，自身不主动触发请求。
 *
 * 布局原则（实测修正）：
 *   - **不再有求和符号标识**。原先左侧有一个徽标、总计的标签又是同一个符号，
 *     两个符号加上 4 个指标会把这一行挤爆，末尾指标被右边缘裁掉（实测：最后一项
 *     显示成「本月 359」而不是完整的「359M」）。总计的标签现在是「总」。
 *   - 紧凑条默认只放 **总计 + 今日**；本周/本月只在展开面板里看。
 *   - CSS 侧保证**数字优先**：空间不足时先压缩/省略标签，数字永不截断。
 */

import * as React from 'react'
import { h, Fragment } from './h.js'
import { formatFull, formatMoney, formatMoneyFull, formatNumber } from './format.js'
import type { UsageSnapshot } from '../types.js'

export interface CompactBarProps {
  snapshot: UsageSnapshot | null
  numberFormat: 'full' | 'short'
  /** 侧边栏是否处于展开态；收起时只显示总计数字。 */
  wide: boolean
  expanded: boolean
  busy: boolean
  onToggle: () => void
  /** 手动刷新（绕过缓存 TTL，强制重新拉取）。 */
  onRefresh: () => void
}

export function CompactBar(props: CompactBarProps): React.ReactElement {
  const { snapshot, numberFormat, wide, expanded, busy, onToggle, onRefresh } = props

  const metrics = snapshot?.compact ?? []
  const stale = snapshot?.stale === true
  const progress = snapshot?.loading ? (snapshot.progress ?? 0) : null

  // 收起态（图标栏）显示总计：优先取 scope==='total' 的那一项，
  // 万一用户把 total 从 compactMetrics 里去掉就退回第一项。
  const lead = metrics.find((m) => m.scope === 'total') ?? metrics[0]

  /** 指标的完整 tooltip：请求数用「次请求」，金额用「元」，其余按 token 计。 */
  const fullTitle = (
    label: string,
    value: number,
    unit?: 'tokens' | 'requests' | 'money',
    source?: 'platform' | 'local' | 'merged',
  ): string => {
    // 侧边栏太窄放不下口径徽标，但悬停必须能说明「这个数不是平台账单给的」。
    const note =
      source === 'local'
        ? '（本机口径：DSH 会话日志）'
        : source === 'merged'
          ? '（平台 + 本机合并口径）'
          : ''
    if (unit === 'requests') return `${label} ${formatFull(value)} 次请求${note}`
    if (unit === 'money') return `${label} ${formatMoneyFull(value)} 元`
    return `${label} ${formatFull(value)} tokens${note}`
  }

  return (
    <Fragment>
      {/* 整条紧凑条都可点：只靠右下角那个小三角，可发现性太差。 */}
      <div
        className={wide ? 'tlogs-compact' : 'tlogs-compact tlogs-collapsed'}
        onClick={onToggle}
        title="tlogs — DeepSeek 用量"
      >
        {wide ? (
          <span className="tlogs-metrics">
            {metrics.map((m, i) => (
              <Fragment key={`${m.scope}-${m.label}-${i}`}>
                {/* 不再用「·」分隔：指标行现在允许换行（见 styles.ts 的 .tlogs-metrics），
                    分隔符会留在行首变成孤立的一个点。8px 的 flex gap 已经足够分组。 */}
                <span
                  className="tlogs-metric"
                  title={fullTitle(m.label, m.value, m.unit, m.source)}
                >
                  <span className="tlogs-metric-label">{m.label}</span>
                  <span
                    className={
                      m.unit === 'money'
                        ? 'tlogs-metric-value tlogs-metric-money'
                        : 'tlogs-metric-value'
                    }
                  >
                    {m.unit === 'money'
                      ? formatMoney(m.value)
                      : formatNumber(m.value, numberFormat)}
                  </span>
                </span>
              </Fragment>
            ))}
            {metrics.length === 0 ? <span className="tlogs-metric-label">暂无数据</span> : null}
          </span>
        ) : (
          <span
            className="tlogs-collapsed-value"
            title={
              lead
                ? lead.unit === 'money'
                  ? `${lead.label} ${formatMoneyFull(lead.value)} 元`
                  : `${lead.label} ${formatFull(lead.value)} tokens`
                : 'tlogs — DeepSeek 用量'
            }
          >
            {lead
              ? lead.unit === 'money'
                ? formatMoney(lead.value)
                : formatNumber(lead.value, numberFormat)
              : '—'}
          </span>
        )}

        <span className="tlogs-actions">
          {stale ? (
            <span
              className="tlogs-stale"
              title={snapshot?.error ?? '数据可能过期：最近一次刷新失败，当前显示缓存值'}
            >
              ⚠
            </span>
          ) : null}
          {busy ? (
            <span className="tlogs-stale" title="正在刷新…">
              ⟳
            </span>
          ) : null}
          {/* 手动刷新。收起态（图标栏）空间不够，用 CSS 隐藏。 */}
          <button
            type="button"
            className="tlogs-iconbtn tlogs-refresh"
            disabled={busy}
            onClick={(e: React.MouseEvent) => {
              // 阻止冒泡：否则点刷新会连带把面板展开/收起。
              e.stopPropagation()
              onRefresh()
            }}
            aria-label="刷新用量数据"
            title="刷新用量"
          >
            ↻
          </button>
          <button
            type="button"
            className="tlogs-iconbtn"
            onClick={(e: React.MouseEvent) => {
              // 阻止冒泡到紧凑条，否则会被父级的 onToggle 再切一次（等于没反应）。
              e.stopPropagation()
              onToggle()
            }}
            aria-expanded={expanded}
            aria-label={expanded ? '收起 tlogs 面板' : '展开 tlogs 面板'}
            title={expanded ? '收起' : '展开'}
          >
            {expanded ? '▴' : '▾'}
          </button>
        </span>
      </div>

      {progress !== null ? (
        <span className="tlogs-progress" aria-hidden="true">
          <i style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
        </span>
      ) : null}
    </Fragment>
  )
}
