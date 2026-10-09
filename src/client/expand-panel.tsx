/**
 * tlogs — form B: the expanded panel.
 *
 * Five usage cards (each with input / output tokens and request count), an optional
 * re-authentication notice at the top, and the footer row with detail / refresh / logout.
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

/** Text keys for the credential source, keyed by `AuthState.source`. */
const SOURCE_LABEL: Record<string, MessageKey> = {
  env: 'panel.source.env',
  config: 'panel.source.config',
  credentials: 'panel.source.credentials',
  'platform-session': 'panel.source.platformSession',
  'desktop-login': 'panel.source.desktopLogin',
}

/*
 * Fixed wording for the panel's time-basis line: the value stays verbatim and must not become a
 * dynamic string.
 *
 * The platform buckets `days[]` by UTC day while the user reads "today" on a local calendar, so
 * the tooltip under the cards has to spell out the local handover hour; without it a session at
 * 00:20 Beijing counts into the previous UTC day and "today" reads 0, which looks like a bug
 * rather than a time-zone boundary. Naming both the zone and the handover hour matters: a bare
 * "UTC+08:00" reads as midnight in Beijing, while the bucket turns over at UTC 00:00 = 08:00
 * Beijing. That boundary is a constant, hence the fixed wording; on another machine the tooltip
 * says which local hour it is.
 */
const TIME_BASIS_KEY: MessageKey = 'panel.timeBasis'

/** Tooltip for the time-basis line: the handover hour in the machine's real time zone. */
function dayBasisTip(t: Translator): { tip: string } {
  /** getTimezoneOffset() is UTC − local in minutes; negate it for the local offset from UTC. */
  const offsetMin = -new Date().getTimezoneOffset()
  const hhmm = (m: number): string => {
    const x = ((m % 1440) + 1440) % 1440
    return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
  }
  const start = hhmm(offsetMin)
  const end = hhmm(offsetMin + 1440)

  /**
   * Official billing settles by Beijing day (00:00) while the usage day buckets are UTC (08:00
   * Beijing), so the two differ by up to 8 hours of usage across a boundary — saying so keeps
   * reconciling against the bill from looking like an arithmetic error.
   */
  const billing = t('panel.dayBasis.billing')

  if (offsetMin === 0) {
    return { tip: t('panel.dayBasis.utc', { billing }) }
  }
  return { tip: t('panel.dayBasis.local', { start, end, billing }) }
}

/** One card: title, totals (tokens and ¥), then the input / output / request split. */
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

  // No cost data means no money line: ¥0.00 would claim the period cost nothing, when the
  // backfill simply has not reached it yet.
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

/** Input cost of a window: prompt + cache hit + cache miss. */
function inputCost(stat: CardData['stat']): number {
  const c = stat.cost
  if (!c) return 0
  return c.PROMPT_TOKEN + c.PROMPT_CACHE_HIT_TOKEN + c.PROMPT_CACHE_MISS_TOKEN
}

/** Output cost of a window. */
function outputCost(stat: CardData['stat']): number {
  return stat.cost?.RESPONSE_TOKEN ?? 0
}

/**
 * Tooltip for the card's scope information, attached to the card title.
 *
 * A standing badge would be noise: most windows are a merge of both sources, so the card marks
 * a window only when it includes usage the bill does not cover.
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
   * Whether the host can really open a login window. Defaults to available so that hosts not
   * sending the field keep working.
   */
  const loginAvailable = snapshot?.display.loginAvailable !== false
  /** The platform day (UTC) mapped onto the local time zone, for the tooltip. */
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
    // Deliberately not named `t`: `t` is the translator in this scope.
    const trimmed = draft.trim()
    if (!trimmed) return
    const ok = await onSetToken(trimmed)
    if (ok) {
      // Security: drop the plaintext from component state as soon as it is submitted.
      setDraft('')
      setShowTokenInput(false)
    }
  }

  return (
    <div className="tlogs-panel">
      {needsAuth ? (
        <div className="tlogs-notice tlogs-notice-danger">
          <span>
            {auth.status === 'invalid' ? t('panel.auth.invalid') : t('panel.auth.missing')}
            {/* The real reason is appended: automatic reuse also fails into this state, and there
                is no login entry to retry with when the host cannot open one. */}
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

      {/* Errors stay visible in every auth state. Gating this on `!needsAuth` would hide
          exactly the "login attempt failed" message, because a missing token makes needsAuth
          true — the click then looks like it did nothing. */}
      {error ? <div className="tlogs-error">{error}</div> : null}

      {/* Credential source, so it is obvious whether reusing the DSH account session hit:
          working numbers alone do not tell automatic reuse apart from a leftover manual token. */}
      {auth.status === 'ok' ? (
        <div className="tlogs-hint">
          {t('panel.credentialsSource', {
            source: SOURCE_LABEL[auth.source]
              ? t(SOURCE_LABEL[auth.source] as MessageKey)
              : auth.source,
          })}
        </div>
      ) : null}

      {/* Sits right below the credential source: the tooltip explains the handover hour. */}
      <div className="tlogs-hint" title={basis.tip}>
        {t(TIME_BASIS_KEY)}
      </div>

      {/* Unavailable local usage has to be stated: the cards then fall back to the platform
          bill, whose current day waits for settlement, so "today 0" would appear silently. */}
      {snapshot?.localUsage && !snapshot.localUsage.available ? (
        <div className="tlogs-hint">
          {t('panel.localUnavailable', { reason: localReasonLabel(snapshot.localUsage.reason, t) })}
        </div>
      ) : null}

      {/* Say so while cost does not cover every month, or the total ¥ reads as complete. */}
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

      {/* Platform account overview: balance and the official bill's cumulative spend. The card
          ¥ is recomputed from `usage/cost`, so it differs from the official number by a rounding
          hair; showing both lets the user tell a real miscalculation from a precision difference. */}
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
