/**
 * tlogs — form A: the compact bar, the default state in the sidebar footer.
 *
 * One row of numbers plus the refresh / expand buttons (which toggle it): it renders the cached
 * snapshot only and never triggers a request itself — requests come from mount, the expand
 * toggle and the refresh button. The digits are never allowed to shrink — the row wraps instead.
 */

import * as React from 'react'
import { h, Fragment } from './h.js'
import { formatFull, formatMoney, formatMoneyFull, formatNumber } from './format.js'
import { useT } from './i18n/index.js'
import type { UsageSnapshot } from '../types.js'

export interface CompactBarProps {
  snapshot: UsageSnapshot | null
  numberFormat: 'full' | 'short'
  /** Whether the sidebar is wide; collapsed shows the total only. */
  wide: boolean
  expanded: boolean
  busy: boolean
  onToggle: () => void
  /** Manual refresh: bypasses the cache TTL and refetches. */
  onRefresh: () => void
}

export function CompactBar(props: CompactBarProps): React.ReactElement {
  const { snapshot, numberFormat, wide, expanded, busy, onToggle, onRefresh } = props
  const t = useT()

  const metrics = snapshot?.compact ?? []
  const stale = snapshot?.stale === true
  const progress = snapshot?.loading ? (snapshot.progress ?? 0) : null

  const lead = metrics.find((m) => m.scope === 'total') ?? metrics[0]

  const fullTitle = (
    label: string,
    value: number,
    unit?: 'tokens' | 'requests' | 'money',
    source?: 'platform' | 'local' | 'merged',
  ): string => {
    // No room for a scope badge here, but hovering still has to say when the number is not
    // pure platform billing.
    const note =
      source === 'local'
        ? t('bar.noteLocal')
        : source === 'merged'
          ? t('bar.noteMerged')
          : ''
    if (unit === 'requests') return t('bar.titleRequests', { label, value: formatFull(value), note })
    if (unit === 'money') return t('bar.titleMoney', { label, value: formatMoneyFull(value) })
    return t('bar.titleTokens', { label, value: formatFull(value), note })
  }

  return (
    <Fragment>
      {/* The whole bar is clickable: a small triangle in the corner is too hard to discover. */}
      <div
        className={wide ? 'tlogs-compact' : 'tlogs-compact tlogs-collapsed'}
        onClick={onToggle}
        title={t('bar.title')}
      >
        {wide ? (
          <span className="tlogs-metrics">
            {/* No "·" separators: the metric row wraps (see .tlogs-metrics), which would leave
                a separator alone at the start of a line. The flex gap groups enough. */}
            {metrics.map((m, i) => (
              <span
                key={`${m.scope}-${m.label}-${i}`}
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
            ))}
            {metrics.length === 0 ? <span className="tlogs-metric-label">{t('common.noData')}</span> : null}
          </span>
        ) : (
          <span
            className="tlogs-collapsed-value"
            title={
              lead
                ? lead.unit === 'money'
                  ? t('bar.titleMoney', { label: lead.label, value: formatMoneyFull(lead.value) })
                  : t('bar.titleTokens', { label: lead.label, value: formatFull(lead.value), note: '' })
                : t('bar.title')
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
              title={snapshot?.error ?? t('bar.staleTip')}
            >
              ⚠
            </span>
          ) : null}
          {busy ? (
            <span className="tlogs-stale" title={t('bar.busyTip')}>
              ⟳
            </span>
          ) : null}
          {/* Manual refresh; CSS hides it in the collapsed rail. */}
          <button
            type="button"
            className="tlogs-iconbtn tlogs-refresh"
            disabled={busy}
            onClick={(e: React.MouseEvent) => {
              // Stop propagation to the bar, where onToggle would flip the state right back.
              e.stopPropagation()
              onRefresh()
            }}
            aria-label={t('bar.refreshLabel')}
            title={t('bar.refreshTitle')}
          >
            ↻
          </button>
          <button
            type="button"
            className="tlogs-iconbtn"
            onClick={(e: React.MouseEvent) => {
              // Stop propagation to the bar, where onToggle would flip the state right back.
              e.stopPropagation()
              onToggle()
            }}
            aria-expanded={expanded}
            aria-label={expanded ? t('bar.collapseLabel') : t('bar.expandLabel')}
            title={expanded ? t('bar.collapse') : t('bar.expand')}
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
