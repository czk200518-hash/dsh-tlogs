/**
 * tlogs — 详细视图。
 *
 * 需求 1.4：点击「详细数据 >」后在同一内嵌容器内切换（不新开窗口、不弹 Modal），
 * 顶部有「‹ 返回」回到展开面板；四张表格（模型 / 年 / 月 / 当月按天），
 * 支持列排序、数字右对齐。
 */

import * as React from 'react'
import { h } from './h.js'
import { formatFull } from './format.js'
import type { DetailData, StatRow } from '../types.js'

export interface DetailViewProps {
  detail: DetailData | null
  loading: boolean
  onBack: () => void
  onRefresh: () => void
  busy: boolean
}

/** 表格可排序的列。 */
type SortKey = 'label' | 'inputTokens' | 'outputTokens' | 'totalTokens' | 'requests'

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: 'label', label: '名称' },
  { key: 'inputTokens', label: '输入' },
  { key: 'outputTokens', label: '输出' },
  { key: 'totalTokens', label: '总 Token' },
  { key: 'requests', label: '请求' },
]

const TABS: Array<{ id: string; label: string; pick: (d: DetailData) => StatRow[] }> = [
  { id: 'models', label: '模型', pick: (d) => d.models },
  { id: 'years', label: '年', pick: (d) => d.years },
  { id: 'months', label: '月', pick: (d) => d.months },
  { id: 'days', label: '当月按天', pick: (d) => d.days },
]

function sortRows(rows: StatRow[], key: SortKey, dir: 'asc' | 'desc'): StatRow[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === 'label') return sign * a.label.localeCompare(b.label)
    return sign * (a.stat[key] - b.stat[key])
  })
}

export function DetailView(props: DetailViewProps): React.ReactElement {
  const { detail, loading, onBack, onRefresh, busy } = props
  const [tab, setTab] = React.useState<string>('models')
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'totalTokens',
    dir: 'desc',
  })

  const active = TABS.find((t) => t.id === tab) ?? TABS[0]
  const rows = detail ? sortRows(active.pick(detail), sort.key, sort.dir) : []

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
  }

  return (
    <div className="tlogs-panel tlogs-detail">
      <div className="tlogs-detail-head">
        <button type="button" className="tlogs-btn" onClick={onBack}>
          ‹ 返回
        </button>
        <button type="button" className="tlogs-btn" onClick={onRefresh} disabled={busy}>
          {busy ? '刷新中…' : '刷新'}
        </button>
      </div>

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
      ) : rows.length === 0 ? (
        <div className="tlogs-empty">暂无数据</div>
      ) : (
        <div className="tlogs-scroll">
          <table className="tlogs-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
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
              {rows.map((r) => (
                <tr key={r.key}>
                  <td title={r.label}>{r.label}</td>
                  <td title={formatFull(r.stat.inputTokens)}>{formatFull(r.stat.inputTokens)}</td>
                  <td title={formatFull(r.stat.outputTokens)}>{formatFull(r.stat.outputTokens)}</td>
                  <td title={formatFull(r.stat.totalTokens)}>{formatFull(r.stat.totalTokens)}</td>
                  <td title={formatFull(r.stat.requests)}>{formatFull(r.stat.requests)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
