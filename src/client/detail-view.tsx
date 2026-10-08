/**
 * tlogs — 可排序的统计表格。
 *
 * 从原「内嵌详细视图」中抽出，现在作为详细数据弹窗（detail-modal.tsx）的表格页复用。
 * 本组件**不带**弹窗外壳，只负责表格本身（列可点排序、数字右对齐、完整值走 tooltip）。
 *
 * 金额列（¥）是**按需出现**的：只有当这批行里有任意一行带金额时才渲染该列。
 * 理由：日历/历史里有大量「当期没花钱」的行，若无脑显示一列 ¥0.00，用户会以为
 * 插件算错了；而整列消失只说明「这批数据还没抓到金额」。
 */

import * as React from 'react'
import { h } from './h.js'
import { formatFull, formatMoneyFull } from './format.js'
import { moneyTotal } from '../types.js'
import type { StatRow } from '../types.js'

/** 表格可排序的列。 */
type SortKey = 'label' | 'inputTokens' | 'outputTokens' | 'totalTokens' | 'requests' | 'cost'

/** 每行的金额（元）；没有金额数据时返回 undefined。 */
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
  /** 空数据时的提示文案。 */
  emptyText?: string
}

export function StatTable(props: StatTableProps): React.ReactElement {
  const { rows, emptyText = '暂无数据' } = props
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'totalTokens',
    dir: 'desc',
  })

  const hasCost = rows.some((r) => rowCost(r) !== undefined)
  const columns: Array<{ key: SortKey; label: string }> = React.useMemo(() => {
    const base: Array<{ key: SortKey; label: string }> = [
      { key: 'label', label: '名称' },
      { key: 'inputTokens', label: '输入' },
      { key: 'outputTokens', label: '输出' },
      { key: 'totalTokens', label: '总 Token' },
      { key: 'requests', label: '请求' },
    ]
    // 金额放最后一列：它是「补充信息」，指标列应保持原有的阅读顺序。
    if (hasCost) base.push({ key: 'cost', label: '金额' })
    return base
  }, [hasCost])

  const sorted = sortRows(rows, sort.key, sort.dir)

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' },
    )
  }

  if (rows.length === 0) return <div className="tlogs-empty">{emptyText}</div>

  return (
    <div className="tlogs-table-wrap">
      <table className="tlogs-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggleSort(c.key)}
                title={`按${c.label}排序`}
                aria-sort={
                  sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                }
              >
                {c.label}
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
                  {/* 平台层级徽标：官方 / 第三方。火山方舟上跑的也是 deepseek-* 模型，
                      所以必须按**通道**标注，不能靠模型名判断。 */}
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
