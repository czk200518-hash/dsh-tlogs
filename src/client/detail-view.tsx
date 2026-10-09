/**
 * tlogs — the sortable statistics table.
 *
 * Shared by every table tab of the detail modal; it carries no modal shell of its own, just
 * clickable column headers, right-aligned numbers and the exact value in a tooltip.
 *
 * The money column appears on demand, only when at least one row in the batch has a cost: an
 * all-¥0.00 column would read as a bug, while a missing column only means the money has not
 * been fetched yet.
 */

import * as React from 'react'
import { h } from './h.js'
import { formatFull, formatMoneyFull } from './format.js'
import { useT, type MessageKey } from './i18n/index.js'
import { moneyTotal } from '../types.js'
import type { StatRow } from '../types.js'

type SortKey = 'label' | 'inputTokens' | 'outputTokens' | 'totalTokens' | 'requests' | 'cost'

/** Row cost in CNY, or undefined when the row has no cost data. */
function rowCost(r: StatRow): number | undefined {
  return r.stat.cost ? moneyTotal(r.stat.cost) : undefined
}

function sortRows(rows: StatRow[], key: SortKey, dir: 'asc' | 'desc'): StatRow[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === 'label') return sign * a.label.localeCompare(b.label)
    if (key === 'cost') return sign * ((rowCost(a) ?? 0) - (rowCost(b) ?? 0))
    return sign * (a.stat[key] - b.stat[key])
  })
}

export interface StatTableProps {
  rows: StatRow[]
  /** Text shown when there are no rows. */
  emptyText?: string
}

export function StatTable(props: StatTableProps): React.ReactElement {
  const { rows, emptyText } = props
  const t = useT()
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'totalTokens',
    dir: 'desc',
  })

  const hasCost = rows.some((r) => rowCost(r) !== undefined)
  const columns: Array<{ key: SortKey; labelKey: MessageKey }> = React.useMemo(() => {
    // Part A's `stat.*` keys are reused, the same wording as the calendar summary and the
    // selected-day detail, so no sentence lands in the dictionary twice.
    const base: Array<{ key: SortKey; labelKey: MessageKey }> = [
      { key: 'label', labelKey: 'table.name' },
      { key: 'inputTokens', labelKey: 'stat.input' },
      { key: 'outputTokens', labelKey: 'stat.output' },
      { key: 'totalTokens', labelKey: 'stat.totalTokens' },
      { key: 'requests', labelKey: 'stat.requests' },
    ]
    // Money goes last: it is supplementary, and the metric columns keep their reading order.
    if (hasCost) base.push({ key: 'cost', labelKey: 'stat.cost' })
    return base
  }, [hasCost])

  const sorted = sortRows(rows, sort.key, sort.dir)

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' },
    )
  }

  if (rows.length === 0) return <div className="tlogs-empty">{emptyText ?? t('common.noData')}</div>

  return (
    <div className="tlogs-table-wrap">
      <table className="tlogs-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                title={t('table.sortBy', { column: t(c.labelKey) })}
                aria-sort={
                  sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                }
              >
                {t(c.labelKey)}
                {sort.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const c = rowCost(r)
            return (
              <tr key={r.key}>
                <td title={r.label}>
                  {/* Platform badge (official / third party). The channel decides this, not the
                      model name: Volcengine runs deepseek-* models too. */}
                  {r.tag ? (
                    <span className="tlogs-src tlogs-src-inline" title={r.tagTitle ?? r.tag}>
                      {r.tag}
                    </span>
                  ) : null}
                  {r.label}
                </td>
                <td title={formatFull(r.stat.inputTokens)}>{formatFull(r.stat.inputTokens)}</td>
                <td title={formatFull(r.stat.outputTokens)}>{formatFull(r.stat.outputTokens)}</td>
                <td title={formatFull(r.stat.totalTokens)}>{formatFull(r.stat.totalTokens)}</td>
                <td title={formatFull(r.stat.requests)}>{formatFull(r.stat.requests)}</td>
                {hasCost ? (
                  <td className="tlogs-td-money" title={c === undefined ? '' : formatMoneyFull(c)}>
                    {c === undefined ? '—' : formatMoneyFull(c)}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
