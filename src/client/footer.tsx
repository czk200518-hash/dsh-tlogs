/**
 * tlogs — 内嵌容器（紧凑条 / 展开面板 / 详细视图 在同一容器内切换）。
 *
 * 需求 1.1：组件通过 DSH 的 slot 扩展点注册到侧边栏页脚，
 * 完全在文档流内，不使用 position: fixed / absolute 伪造悬浮。
 * 需求 1.2：展开时把上方内容顶上去（就地撑开），不覆盖。
 */

import * as React from 'react'
import { h } from './h.js'
import { CompactBar } from './compact-bar.js'
import { ExpandPanel } from './expand-panel.js'
import { DetailView } from './detail-view.js'
import { useTlogs } from './store.js'
import type { Rpc } from './api.js'

export interface TlogsFooterProps {
  /** 侧边栏是否为展开态（由 slot owner 传入，见 ui-sidebar 的 renderSlot 调用）。 */
  wide?: boolean
  /** 由 slot 的 inject share 注入。 */
  rpc?: Rpc
  numberFormat?: 'full' | 'short'
  enableDetailView?: boolean
  defaultExpanded?: boolean
}

type View = 'compact' | 'expanded' | 'detail'

export function TlogsFooter(props: TlogsFooterProps): React.ReactElement {
  const { wide = true, rpc, defaultExpanded = false } = props

  const store = useTlogs(rpc, 'mount')
  const [view, setView] = React.useState<View>(defaultExpanded ? 'expanded' : 'compact')

  /** 用户是否手动切换过形态；一旦切换就不再套用 host 下发的默认值。 */
  const userToggled = React.useRef(false)
  const defaultApplied = React.useRef(false)

  // 客户端读不到插件自身的 cordis 配置（DSH 的浏览器半侧 apply(ctx, config)
  // 拿到的 config 是 undefined），因此展示配置由 host 通过 snapshot.display 下发。
  React.useEffect(() => {
    if (defaultApplied.current || userToggled.current) return
    const d = store.snapshot?.display
    if (!d) return
    defaultApplied.current = true
    if (d.defaultExpanded) setView('expanded')
  }, [store.snapshot])

  const display = store.snapshot?.display
  const numberFormat = display?.numberFormat ?? props.numberFormat ?? 'short'
  const enableDetailView = display?.enableDetailView ?? props.enableDetailView !== false

  const openDetail = () => {
    userToggled.current = true
    setView('detail')
    void store.loadDetail()
  }

  const toggle = () => {
    userToggled.current = true
    if (view === 'compact') {
      setView('expanded')
      // 需求 1.5：展开面板时再刷新一次（受缓存 TTL 约束，不一定真的发请求）。
      void store.refresh(false)
    } else if (view === 'expanded') {
      setView('compact')
    } else {
      setView('expanded')
    }
  }

  const refresh = () => {
    void store.refresh(true)
    if (view === 'detail') void store.loadDetail()
  }

  return (
    <div className={wide ? 'tlogs tlogs-w-full' : 'tlogs'}>
      <CompactBar
        snapshot={store.snapshot}
        numberFormat={numberFormat}
        wide={wide}
        expanded={view !== 'compact'}
        busy={store.busy}
        onToggle={toggle}
      />

      {view === 'expanded' ? (
        <ExpandPanel
          snapshot={store.snapshot}
          error={store.error}
          busy={store.busy}
          numberFormat={numberFormat}
          enableDetailView={enableDetailView}
          onRefresh={refresh}
          onOpenDetail={openDetail}
          onLogin={() => void store.login()}
          onSetToken={store.setToken}
          onLogout={() => void store.logout()}
        />
      ) : null}

      {view === 'detail' ? (
        <DetailView
          detail={store.detail}
          loading={store.busy}
          busy={store.busy}
          onBack={() => setView('expanded')}
          onRefresh={refresh}
        />
      ) : null}
    </div>
  )
}
