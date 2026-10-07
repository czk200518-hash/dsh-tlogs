/**
 * tlogs — 形态 B：展开面板。
 *
 * 需求 1.3：五张数据卡片，每张同时显示输入 Token、输出 Token、请求次数。
 * 需求 1.2：底部一行「详细数据 >」+「刷新」+「退出登录」。
 * 需求 2.4 / 5.2：token 失效时在面板顶部显示「需要重新登录」。
 */

import * as React from 'react'
import { h, Fragment } from './h.js'
import { formatFull, formatNumber } from './format.js'
import type { AuthState, CardData, UsageSnapshot } from '../types.js'

export interface ExpandPanelProps {
  snapshot: UsageSnapshot | null
  error: string | null
  busy: boolean
  numberFormat: 'full' | 'short'
  enableDetailView: boolean
  onRefresh: () => void
  onOpenDetail: () => void
  onLogin: () => void
  onSetToken: (token: string) => Promise<boolean>
  onLogout: () => void
}

/** 凭据来源的中文名（对应 `AuthState.source`）。 */
const SOURCE_LABEL: Record<string, string> = {
  env: '环境变量',
  config: '插件配置',
  credentials: '本机凭据（手动填写 / 登录）',
  'platform-session': 'DSH 账号登录态（自动复用）',
  'desktop-login': '内置登录窗口',
}

/** 数据卡片：标题 + 总量 + 输入/输出/请求拆分。 */
function Card(props: {
  card: CardData
  numberFormat: 'full' | 'short'
  selectedId?: string
  onCycle?: () => void
}): React.ReactElement {
  const { card, numberFormat, selectedId, onCycle } = props
  const clickable = typeof onCycle === 'function' && (card.options?.length ?? 0) > 1
  const current = card.options?.find((o) => o.id === selectedId) ?? card.options?.[0]
  const stat = current?.stat ?? card.stat

  return (
    <div
      className={clickable ? 'tlogs-card tlogs-card-clickable' : 'tlogs-card'}
      onClick={clickable ? onCycle : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onCycle?.()
              }
            }
          : undefined
      }
      title={clickable ? '点击切换项目' : undefined}
    >
      <div className="tlogs-card-head">
        <span className="tlogs-card-title">
          {card.label}
          {current && (card.options?.length ?? 0) > 1 ? ` · ${current.label}` : ''}
        </span>
        {card.stale ? <span className="tlogs-stale">⚠</span> : null}
      </div>

      {card.error ? (
        <span className="tlogs-card-total is-error">{card.error}</span>
      ) : (
        <Fragment>
          <span className="tlogs-card-total" title={`${formatFull(stat.totalTokens)} tokens`}>
            {formatNumber(stat.totalTokens, numberFormat)}
          </span>
          <span className="tlogs-card-split">
            <span>
              输入 <b title={formatFull(stat.inputTokens)}>{formatNumber(stat.inputTokens, numberFormat)}</b>
            </span>
            <span>
              输出 <b title={formatFull(stat.outputTokens)}>{formatNumber(stat.outputTokens, numberFormat)}</b>
            </span>
            <span>
              请求 <b title={formatFull(stat.requests)}>{formatNumber(stat.requests, numberFormat)}</b>
            </span>
          </span>
        </Fragment>
      )}
    </div>
  )
}

export function ExpandPanel(props: ExpandPanelProps): React.ReactElement {
  const {
    snapshot,
    error,
    busy,
    numberFormat,
    enableDetailView,
    onRefresh,
    onOpenDetail,
    onLogin,
    onSetToken,
    onLogout,
  } = props

  const [showTokenInput, setShowTokenInput] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const [selections, setSelections] = React.useState<Record<number, string>>({})

  const auth: AuthState = snapshot?.auth ?? { status: 'unknown' }
  const needsAuth = auth.status === 'invalid' || auth.status === 'missing'
  /**
   * 宿主是否真能开登录窗口。缺省按「可用」处理，兼容尚未下发该字段的旧宿主。
   */
  const loginAvailable = snapshot?.display.loginAvailable !== false

  const cycle = (index: number, card: CardData) => {
    const opts = card.options ?? []
    if (opts.length < 2) return
    const currentId = selections[index] ?? card.selectedOptionId ?? opts[0].id
    const pos = opts.findIndex((o) => o.id === currentId)
    const next = opts[(pos + 1) % opts.length]
    setSelections((prev) => ({ ...prev, [index]: next.id }))
  }

  const submitToken = async () => {
    const t = draft.trim()
    if (!t) return
    const ok = await onSetToken(t)
    if (ok) {
      // 安全：提交后立即从组件状态里清掉明文。
      setDraft('')
      setShowTokenInput(false)
    }
  }

  return (
    <div className="tlogs-panel">
      {/* 认证提示（需求 2.4 / 5.2） */}
      {needsAuth ? (
        <div className="tlogs-notice tlogs-notice-danger">
          <span>
            {auth.status === 'invalid'
              ? 'userToken 已失效，需要重新登录'
              : '未配置 userToken，无法获取用量'}
            {/* 附上真实原因：否则自动复用失败时也会显示「需要重新登录」，
                而用户根本没有可重新登录的入口（内置登录在桌面端不可用）。 */}
            {auth.status === 'invalid' && auth.message ? (
              <span className="tlogs-hint"> —— {auth.message}</span>
            ) : null}
          </span>
          <span className="tlogs-actions">
            <button
              type="button"
              className="tlogs-btn tlogs-btn-primary"
              onClick={onLogin}
              disabled={!loginAvailable}
              title={
                loginAvailable
                  ? '打开内置登录窗口'
                  : '当前宿主无法创建登录窗口，请用「手动填写」粘贴 platform userToken'
              }
            >
              登录
            </button>
            <button
              type="button"
              className="tlogs-btn"
              onClick={() => setShowTokenInput((v) => !v)}
              title="手动粘贴 userToken（方案 C）"
            >
              手动填写
            </button>
          </span>
        </div>
      ) : null}

      {/* 登录窗口不可用时必须写明原因：按钮置灰若不给解释，用户只会觉得是坏了。 */}
      {needsAuth && !loginAvailable ? (
        <div className="tlogs-hint">
          内置登录在当前宿主不可用：插件运行在 Electron 的 Node 子进程里，创建不了登录窗口。
          请点「手动填写」粘贴 platform userToken（形如浏览器 localStorage 里的 userToken 值）。
        </div>
      ) : null}

      {showTokenInput ? (
        <div className="tlogs-notice">
          <input
            className="tlogs-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="粘贴 userToken"
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') void submitToken()
            }}
          />
          <span className="tlogs-actions">
            <button type="button" className="tlogs-btn tlogs-btn-primary" onClick={() => void submitToken()}>
              保存
            </button>
            <button
              type="button"
              className="tlogs-btn"
              onClick={() => {
                setDraft('')
                setShowTokenInput(false)
              }}
            >
              取消
            </button>
          </span>
        </div>
      ) : null}

      {/* 错误必须在任何认证状态下都可见。
          此前这里是 `error && !needsAuth`，而 token 缺失时 needsAuth 恰好为 true，
          于是「点登录失败」的提示被自己这道门挡掉 —— 表现就是点了没反应。 */}
      {error ? <div className="tlogs-error">{error}</div> : null}

      {/* 凭据来源：让「方案 D（复用 DSH 账号登录态）到底有没有命中」一眼可辨。
          否则「数字出现了」无法区分是自动复用成功还是残留的手工 token。 */}
      {auth.status === 'ok' ? (
        <div className="tlogs-hint">凭据来源：{SOURCE_LABEL[auth.source] ?? auth.source}</div>
      ) : null}

      <div className="tlogs-cards">
        {(snapshot?.cards ?? []).map((card, i) => (
          <Card
            key={`${card.scope}-${card.label}-${i}`}
            card={card}
            numberFormat={numberFormat}
            selectedId={selections[i] ?? card.selectedOptionId}
            onCycle={card.options && card.options.length > 1 ? () => cycle(i, card) : undefined}
          />
        ))}
        {snapshot === null ? <div className="tlogs-empty">加载中…</div> : null}
      </div>

      <div className="tlogs-footer-actions">
        {enableDetailView ? (
          <button type="button" className="tlogs-btn" onClick={onOpenDetail}>
            详细数据 ›
          </button>
        ) : (
          <span />
        )}
        <span className="tlogs-actions">
          <button type="button" className="tlogs-btn" onClick={onRefresh} disabled={busy}>
            {busy ? '刷新中…' : '刷新'}
          </button>
          <button type="button" className="tlogs-btn" onClick={onLogout} title="清除本机保存的 userToken">
            退出登录
          </button>
        </span>
      </div>
    </div>
  )
}
