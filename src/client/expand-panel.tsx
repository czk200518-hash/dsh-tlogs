/**
 * tlogs — 形态 B：展开面板。
 *
 * 需求 1.3：五张数据卡片，每张同时显示输入 Token、输出 Token、请求次数。
 * 需求 1.2：底部一行「详细数据 >」+「刷新」+「退出登录」。
 * 需求 2.4 / 5.2：token 失效时在面板顶部显示「需要重新登录」。
 */

import * as React from 'react'
import { h, Fragment } from './h.js'
import { formatFull, formatMoney, formatMoneyFull, formatNumber, localReasonLabel } from './format.js'
import { useT, type MessageKey, type Translator } from './i18n/index.js'
import { moneyTotal } from '../types.js'
import type { AuthState, CardData, CardSourceInfo, UsageSnapshot } from '../types.js'

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

/** 凭据来源的文案键（对应 `AuthState.source`）。 */
const SOURCE_LABEL: Record<string, MessageKey> = {
  env: 'panel.source.env',
  config: 'panel.source.config',
  credentials: 'panel.source.credentials',
  'platform-session': 'panel.source.platformSession',
  'desktop-login': 'panel.source.desktopLogin',
}

/*
 * 平台接口的 `days[]` 按 **UTC 日**切桶，而用户在本地日历里理解「今天」，
 * 两者只有在 UTC±0 时才一致。这里把日界换算成本机时间写进 tooltip。
 *
 * 为什么必须解释：实测北京时间 2026-10-08 00:20 一直在跑对话，
 * 用量全部记进平台桶 `2026-10-07`，而「今日」读到的是还没开始的 `2026-10-08`
 * → 显示 0。用户不知道日界在哪，只会当成 bug。
 */
/**
 * 面板上那行时间口径的**固定文案**（用户指定的原文，逐字照抄，不要改写成动态拼接）。
 *
 * 写法上刻意把「时区」和「换日时刻」都点出来：只写时区（例如 `统计时区：UTC+08:00`）
 * 会被读成「北京 0 点换日」，而平台的日桶实际是 **UTC 00:00 = 北京 08:00** 换日 ——
 * 实测就是这样（北京 00:20 的调用全部记进平台桶 `2026-10-07`），凌晨看到「今日 0」
 * 的困惑正是这么来的。
 *
 * 平台桶的边界在**北京时区里是恒定值**（永远 08:00），所以中文那句是准确的：
 * 换到别的时区跑，变的是「本机几点换日」，那句在 tooltip 里按真实时区解释。
 * 文案已外置成键（原文一字未改），渲染时取，因此切语言会跟着更新。
 */
const TIME_BASIS_KEY: MessageKey = 'panel.timeBasis'

/**
 * 时间口径那行的 tooltip：按本机真实时区解释换日时刻。
 *
 * `t` 由调用方传入（组件里是 `useT()` 的返回值）—— tooltip 是渲染产物，
 * 用模块级 `t` 会让它停在旧语言上。
 */
function dayBasisTip(t: Translator): { tip: string } {
  /** getTimezoneOffset() 是「UTC − 本地」的分钟数，取反得到本地相对 UTC 的偏移。 */
  const offsetMin = -new Date().getTimezoneOffset()
  /** 把「相对 UTC 的分钟偏移」折成 `HH:MM`。 */
  const hhmm = (m: number): string => {
    const x = ((m % 1440) + 1440) % 1440
    return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
  }
  const start = hhmm(offsetMin)
  const end = hhmm(offsetMin + 1440)

  /**
   * 账单与用量接口的日界并不一致，这一点必须写出来，否则对账时一定会怀疑插件算错：
   * 官方**计费**按北京时间日（00:00 换日），而官方**用量接口**的日桶按 UTC
   * （北京 08:00 换日）。两者在跨日处最多差 8 小时的用量。
   */
  const billing = t('panel.dayBasis.billing')

  if (offsetMin === 0) {
    return { tip: t('panel.dayBasis.utc', { billing }) }
  }
  return { tip: t('panel.dayBasis.local', { start, end, billing }) }
}

/** 数据卡片：标题 + 总量（token 与 ¥）+ 输入/输出/请求拆分。 */
function Card(props: {
  card: CardData
  numberFormat: 'full' | 'short'
  selectedId?: string
  onCycle?: () => void
}): React.ReactElement {
  const { card, numberFormat, selectedId, onCycle } = props
  const t = useT()
  const clickable = typeof onCycle === 'function' && (card.options?.length ?? 0) > 1
  const current = card.options?.find((o) => o.id === selectedId) ?? card.options?.[0]
  const stat = current?.stat ?? card.stat

  // 金额：没有金额数据时**不显示 ¥0.00** —— 那会让人以为这段时间真的没花钱，
  // 而实际是「金额还没回补到」。宁可少一行。
  const cost = stat.cost ? moneyTotal(stat.cost) : undefined
  const moneyTip =
    cost === undefined
      ? ''
      : [
          t('panel.moneyTip.total', { label: card.label, money: formatMoneyFull(cost) }),
          t('panel.moneyTip.input', { money: formatMoneyFull(inputCost(stat)) }),
          t('panel.moneyTip.output', { money: formatMoneyFull(outputCost(stat)) }),
        ].join('\n')

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
      title={clickable ? t('panel.cycle.title') : undefined}
    >
      <div className="tlogs-card-head">
        {/* 口径细节走 tooltip：两路合并是常态，卡面只在「含平台看不到的第三方用量」时标一下。 */}
        <span className="tlogs-card-title" title={card.source ? sourceTip(card.source, t) : undefined}>
          {card.label}
          {current && (card.options?.length ?? 0) > 1 ? ` · ${current.label}` : ''}
        </span>
        {card.source && card.source.otherProviders.length > 0 ? (
          <span className="tlogs-src" title={sourceTip(card.source, t)}>
            {t('panel.thirdParty')}
          </span>
        ) : null}
        {card.stale ? <span className="tlogs-stale">⚠</span> : null}
      </div>

      {card.error ? (
        <span className="tlogs-card-total is-error">{card.error}</span>
      ) : (
        <Fragment>
          <span className="tlogs-card-line">
            <span className="tlogs-card-total" title={`${formatFull(stat.totalTokens)} tokens`}>
              {formatNumber(stat.totalTokens, numberFormat)}
            </span>
            {cost === undefined ? null : (
              <span className="tlogs-card-money" title={moneyTip}>
                {formatMoney(cost)}
              </span>
            )}
          </span>
          <span className="tlogs-card-split">
            <span>
              <span className="tlogs-split-label">{t('stat.input')}</span>
              <b title={formatFull(stat.inputTokens)}>{formatNumber(stat.inputTokens, numberFormat)}</b>
            </span>
            <span>
              <span className="tlogs-split-label">{t('stat.output')}</span>
              <b title={formatFull(stat.outputTokens)}>{formatNumber(stat.outputTokens, numberFormat)}</b>
            </span>
            <span>
              <span className="tlogs-split-label">{t('stat.requests')}</span>
              <b title={formatFull(stat.requests)}>{formatNumber(stat.requests, numberFormat)}</b>
            </span>
          </span>
        </Fragment>
      )}
    </div>
  )
}

/** 窗口的「输入」费用 = PROMPT + 缓存命中 + 缓存未命中。 */
function inputCost(stat: CardData['stat']): number {
  const c = stat.cost
  if (!c) return 0
  return c.PROMPT_TOKEN + c.PROMPT_CACHE_HIT_TOKEN + c.PROMPT_CACHE_MISS_TOKEN
}

/** 窗口的「输出」费用。 */
function outputCost(stat: CardData['stat']): number {
  return stat.cost?.RESPONSE_TOKEN ?? 0
}

/**
 * 卡片口径信息的 tooltip（挂在卡片标题上）。
 *
 * 为什么不常挂徽标：现在**大多数窗口都是两路合并**的结果（当天平台结算滞后、加上
 * 平台账单看不到的第三方供应商），常年挂徽标只会挤掉标题、制造噪声。卡面只在
 * 「这个窗口含平台账单看不到的第三方用量」时标一下，其余细节放这里。
 */
function sourceTip(s: CardSourceInfo, t: Translator): string {
  const head =
    s.kind === 'local'
      ? t('panel.sourceTip.local')
      : s.kind === 'merged'
        ? t('panel.sourceTip.merged')
        : t('panel.sourceTip.platform')
  const lines = [
    head,
    t('panel.sourceTip.platformTokens', { n: formatFull(s.platformTokens) }),
    t('panel.sourceTip.localTokens', {
      n: formatFull(s.localTokens),
      deepseek: formatFull(s.localDeepseekTokens),
    }),
  ]
  if (s.otherProviders.length > 0) {
    lines.push(
      t('panel.sourceTip.other', {
        list: s.otherProviders
          .slice(0, 4)
          .map((p) => `${p.provider} ${formatFull(p.tokens)}`)
          .join(t('list.separator')),
      }),
    )
  }
  if (s.costPending) lines.push(t('panel.sourceTip.costPending'))
  return lines.join('\n')
}

/** 本机口径不可用的原因（英文枚举）转成一句人话；与详细数据「供应商」页签共用。 */
function reasonLabel(reason: string | undefined, t: Translator): string {
  return localReasonLabel(reason, t)
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

  const t = useT()
  const [showTokenInput, setShowTokenInput] = React.useState(false)
  const [draft, setDraft] = React.useState('')
  const [selections, setSelections] = React.useState<Record<number, string>>({})

  const auth: AuthState = snapshot?.auth ?? { status: 'unknown' }
  const needsAuth = auth.status === 'invalid' || auth.status === 'missing'
  /**
   * 宿主是否真能开登录窗口。缺省按「可用」处理，兼容尚未下发该字段的旧宿主。
   */
  const loginAvailable = snapshot?.display.loginAvailable !== false
  /** 平台日（UTC 日）在本机时区对应的时间段（tooltip 用）。 */
  const basis = dayBasisTip(t)

  const cycle = (index: number, card: CardData) => {
    const opts = card.options ?? []
    if (opts.length < 2) return
    const currentId = selections[index] ?? card.selectedOptionId ?? opts[0].id
    const pos = opts.findIndex((o) => o.id === currentId)
    const next = opts[(pos + 1) % opts.length]
    setSelections((prev) => ({ ...prev, [index]: next.id }))
  }

  const submitToken = async () => {
    // 变量名不叫 t：这个作用域里 t 是翻译函数。
    const trimmed = draft.trim()
    if (!trimmed) return
    const ok = await onSetToken(trimmed)
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
            {auth.status === 'invalid' ? t('panel.auth.invalid') : t('panel.auth.missing')}
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
              title={loginAvailable ? t('panel.login.title') : t('panel.login.titleDisabled')}
            >
              {t('panel.login')}
            </button>
            <button
              type="button"
              className="tlogs-btn"
              onClick={() => setShowTokenInput((v) => !v)}
              title={t('panel.manual.title')}
            >
              {t('panel.manual')}
            </button>
          </span>
        </div>
      ) : null}

      {/* 登录窗口不可用时必须写明原因：按钮置灰若不给解释，用户只会觉得是坏了。 */}
      {needsAuth && !loginAvailable ? (
        <div className="tlogs-hint">{t('panel.login.unavailable')}</div>
      ) : null}

      {showTokenInput ? (
        <div className="tlogs-notice">
          <input
            className="tlogs-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('panel.token.placeholder')}
            value={draft}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter') void submitToken()
            }}
          />
          <span className="tlogs-actions">
            <button type="button" className="tlogs-btn tlogs-btn-primary" onClick={() => void submitToken()}>
              {t('panel.save')}
            </button>
            <button
              type="button"
              className="tlogs-btn"
              onClick={() => {
                setDraft('')
                setShowTokenInput(false)
              }}
            >
              {t('panel.cancel')}
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
        <div className="tlogs-hint">
          {t('panel.credentialsSource', {
            // 未知来源（旧宿主 / 以后新增的枚举）直接显示原始值，别伪造成某一种已知来源。
            source: SOURCE_LABEL[auth.source]
              ? t(SOURCE_LABEL[auth.source] as MessageKey)
              : auth.source,
          })}
        </div>
      ) : null}

      {/* 时间口径必须写在凭据来源下面：平台按 UTC 日切桶，而用户按本机日历理解
          「今日/当周/当月」。不写清楚，凌晨 00:00–08:00（GMT+8）看到「今日」不是从
          本机 0 点算起就会以为是 bug —— 实测正是这样（详见 dayBasisTip 的注释）。
          文案是用户指定的固定原文，逐字照抄；具体换日时刻在 tooltip 里解释。 */}
      <div className="tlogs-hint" title={basis.tip}>
        {t(TIME_BASIS_KEY)}
      </div>

      {/* 本机口径不可用必须说出来：那种情况下窗口卡片退回纯平台账单，
          而平台当天数据要等结算 —— 「今日 0」就是这么来的，不能安静地显示 0。 */}
      {snapshot?.localUsage && !snapshot.localUsage.available ? (
        <div className="tlogs-hint">
          {t('panel.localUnavailable', { reason: reasonLabel(snapshot.localUsage.reason, t) })}
        </div>
      ) : null}

      {/* 金额尚未覆盖全部月份时必须说明，否则「总 ¥」会被当成完整总额。 */}
      {snapshot && !snapshot.costComplete && snapshot.loading ? (
        <div className="tlogs-hint">{t('panel.costBackfill')}</div>
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
        {snapshot === null ? <div className="tlogs-empty">{t('common.loading')}</div> : null}
      </div>

      {/* 平台账户概览：余额与**官方账单**累计消费。
          为什么单列一行：卡片上的 ¥ 是本插件按 `usage/cost` 逐月重算的，与官方账单
          存在极小差异（实测 31 个月 ¥676.07 vs 账单 ¥675.74，来自按请求四舍五入）。
          把官方数字摆出来，用户才能判断「插件算错了」还是「口径/精度差异」。 */}
      {snapshot?.account ? (
        <div className="tlogs-account">
          <span title={t('panel.account.balanceTip')}>
            {t('panel.account.balance')}
            <b>{formatMoneyFull(snapshot.account.balance)}</b>
          </span>
          <span title={t('panel.account.totalCostsTip')}>
            {t('panel.account.totalCosts')}
            <b>{formatMoneyFull(snapshot.account.totalCosts)}</b>
          </span>
          {snapshot.account.bonusBalance > 0 ? (
            <span title={t('panel.account.bonusTip')}>
              {t('panel.account.bonus')}
              <b>{formatMoneyFull(snapshot.account.bonusBalance)}</b>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="tlogs-footer-actions">
        {enableDetailView ? (
          <button type="button" className="tlogs-btn" onClick={onOpenDetail}>
            {t('panel.detail')}
          </button>
        ) : (
          <span />
        )}
        <span className="tlogs-actions">
          <button type="button" className="tlogs-btn" onClick={onRefresh} disabled={busy}>
            {busy ? t('common.refreshing') : t('common.refresh')}
          </button>
          <button type="button" className="tlogs-btn" onClick={onLogout} title={t('panel.logout.title')}>
            {t('panel.logout')}
          </button>
        </span>
      </div>
    </div>
  )
}
