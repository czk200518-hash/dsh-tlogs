/**
 * tlogs — form B: the expanded panel.
 *
 * Five usage cards (each with input / output tokens and request count), an optional
 * re-authentication notice at the top, and the footer row with detail / refresh / logout.
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatMoney, formatMoneyFull, formatNumber, localReasonLabel } from './format.js';
import { useT } from './i18n/index.js';
import { moneyTotal } from '../types.js';
/** Text keys for the credential source, keyed by `AuthState.source`. */
const SOURCE_LABEL = {
    env: 'panel.source.env',
    config: 'panel.source.config',
    credentials: 'panel.source.credentials',
    'platform-session': 'panel.source.platformSession',
    'desktop-login': 'panel.source.desktopLogin',
};
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
const TIME_BASIS_KEY = 'panel.timeBasis';
/** Tooltip for the time-basis line: the handover hour in the machine's real time zone. */
function dayBasisTip(t) {
    /** getTimezoneOffset() is UTC − local in minutes; negate it for the local offset from UTC. */
    const offsetMin = -new Date().getTimezoneOffset();
    const hhmm = (m) => {
        const x = ((m % 1440) + 1440) % 1440;
        return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
    };
    const start = hhmm(offsetMin);
    const end = hhmm(offsetMin + 1440);
    /**
     * Official billing settles by Beijing day (00:00) while the usage day buckets are UTC (08:00
     * Beijing), so the two differ by up to 8 hours of usage across a boundary — saying so keeps
     * reconciling against the bill from looking like an arithmetic error.
     */
    const billing = t('panel.dayBasis.billing');
    if (offsetMin === 0) {
        return { tip: t('panel.dayBasis.utc', { billing }) };
    }
    return { tip: t('panel.dayBasis.local', { start, end, billing }) };
}
/** One card: title, totals (tokens and ¥), then the input / output / request split. */
function Card(props) {
    const { card, numberFormat, selectedId, onCycle } = props;
    const t = useT();
    const clickable = typeof onCycle === 'function' && (card.options?.length ?? 0) > 1;
    const current = card.options?.find((o) => o.id === selectedId) ?? card.options?.[0];
    const stat = current?.stat ?? card.stat;
    // No cost data means no money line: ¥0.00 would claim the period cost nothing, when the
    // backfill simply has not reached it yet.
    const cost = stat.cost ? moneyTotal(stat.cost) : undefined;
    const moneyTip = cost === undefined
        ? ''
        : [
            t('panel.moneyTip.total', { label: card.label, money: formatMoneyFull(cost) }),
            t('panel.moneyTip.input', { money: formatMoneyFull(inputCost(stat)) }),
            t('panel.moneyTip.output', { money: formatMoneyFull(outputCost(stat)) }),
        ].join('\n');
    return (h("div", { className: clickable ? 'tlogs-card tlogs-card-clickable' : 'tlogs-card', onClick: clickable ? onCycle : undefined, role: clickable ? 'button' : undefined, tabIndex: clickable ? 0 : undefined, onKeyDown: clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCycle?.();
                }
            }
            : undefined, title: clickable ? t('panel.cycle.title') : undefined },
        h("div", { className: "tlogs-card-head" },
            h("span", { className: "tlogs-card-title", title: card.source ? sourceTip(card.source, t) : undefined },
                card.label,
                current && (card.options?.length ?? 0) > 1 ? ` · ${current.label}` : ''),
            card.source && card.source.otherProviders.length > 0 ? (h("span", { className: "tlogs-src", title: sourceTip(card.source, t) }, t('panel.thirdParty'))) : null,
            card.stale ? h("span", { className: "tlogs-stale" }, "\u26A0") : null),
        card.error ? (h("span", { className: "tlogs-card-total is-error" }, card.error)) : (h(Fragment, null,
            h("span", { className: "tlogs-card-line" },
                h("span", { className: "tlogs-card-total", title: `${formatFull(stat.totalTokens)} tokens` }, formatNumber(stat.totalTokens, numberFormat)),
                cost === undefined ? null : (h("span", { className: "tlogs-card-money", title: moneyTip }, formatMoney(cost)))),
            h("span", { className: "tlogs-card-split" },
                h("span", null,
                    h("span", { className: "tlogs-split-label" }, t('stat.input')),
                    h("b", { title: formatFull(stat.inputTokens) }, formatNumber(stat.inputTokens, numberFormat))),
                h("span", null,
                    h("span", { className: "tlogs-split-label" }, t('stat.output')),
                    h("b", { title: formatFull(stat.outputTokens) }, formatNumber(stat.outputTokens, numberFormat))),
                h("span", null,
                    h("span", { className: "tlogs-split-label" }, t('stat.requests')),
                    h("b", { title: formatFull(stat.requests) }, formatNumber(stat.requests, numberFormat))))))));
}
/** Input cost of a window: prompt + cache hit + cache miss. */
function inputCost(stat) {
    const c = stat.cost;
    if (!c)
        return 0;
    return c.PROMPT_TOKEN + c.PROMPT_CACHE_HIT_TOKEN + c.PROMPT_CACHE_MISS_TOKEN;
}
/** Output cost of a window. */
function outputCost(stat) {
    return stat.cost?.RESPONSE_TOKEN ?? 0;
}
/**
 * Tooltip for the card's scope information, attached to the card title.
 *
 * A standing badge would be noise: most windows are a merge of both sources, so the card marks
 * a window only when it includes usage the bill does not cover.
 */
function sourceTip(s, t) {
    const head = s.kind === 'local'
        ? t('panel.sourceTip.local')
        : s.kind === 'merged'
            ? t('panel.sourceTip.merged')
            : t('panel.sourceTip.platform');
    const lines = [
        head,
        t('panel.sourceTip.platformTokens', { n: formatFull(s.platformTokens) }),
        t('panel.sourceTip.localTokens', {
            n: formatFull(s.localTokens),
            deepseek: formatFull(s.localDeepseekTokens),
        }),
    ];
    if (s.otherProviders.length > 0) {
        lines.push(t('panel.sourceTip.other', {
            list: s.otherProviders
                .slice(0, 4)
                .map((p) => `${p.provider} ${formatFull(p.tokens)}`)
                .join(t('list.separator')),
        }));
    }
    if (s.costPending)
        lines.push(t('panel.sourceTip.costPending'));
    return lines.join('\n');
}
export function ExpandPanel(props) {
    const { snapshot, error, busy, numberFormat, enableDetailView, onRefresh, onOpenDetail, onLogin, onSetToken, onLogout, } = props;
    const t = useT();
    const [showTokenInput, setShowTokenInput] = React.useState(false);
    const [draft, setDraft] = React.useState('');
    const [selections, setSelections] = React.useState({});
    const auth = snapshot?.auth ?? { status: 'unknown' };
    const needsAuth = auth.status === 'invalid' || auth.status === 'missing';
    /**
     * Whether the host can really open a login window. Defaults to available so that hosts not
     * sending the field keep working.
     */
    const loginAvailable = snapshot?.display.loginAvailable !== false;
    /** The platform day (UTC) mapped onto the local time zone, for the tooltip. */
    const basis = dayBasisTip(t);
    const cycle = (index, card) => {
        const opts = card.options ?? [];
        if (opts.length < 2)
            return;
        const currentId = selections[index] ?? card.selectedOptionId ?? opts[0].id;
        const pos = opts.findIndex((o) => o.id === currentId);
        const next = opts[(pos + 1) % opts.length];
        setSelections((prev) => ({ ...prev, [index]: next.id }));
    };
    const submitToken = async () => {
        // Deliberately not named `t`: `t` is the translator in this scope.
        const trimmed = draft.trim();
        if (!trimmed)
            return;
        const ok = await onSetToken(trimmed);
        if (ok) {
            // Security: drop the plaintext from component state as soon as it is submitted.
            setDraft('');
            setShowTokenInput(false);
        }
    };
    return (h("div", { className: "tlogs-panel" },
        needsAuth ? (h("div", { className: "tlogs-notice tlogs-notice-danger" },
            h("span", null,
                auth.status === 'invalid' ? t('panel.auth.invalid') : t('panel.auth.missing'),
                auth.status === 'invalid' && auth.message ? (h("span", { className: "tlogs-hint" },
                    " \u2014\u2014 ",
                    auth.message)) : null),
            h("span", { className: "tlogs-actions" },
                h("button", { type: "button", className: "tlogs-btn tlogs-btn-primary", onClick: onLogin, disabled: !loginAvailable, title: loginAvailable ? t('panel.login.title') : t('panel.login.titleDisabled') }, t('panel.login')),
                h("button", { type: "button", className: "tlogs-btn", onClick: () => setShowTokenInput((v) => !v), title: t('panel.manual.title') }, t('panel.manual'))))) : null,
        needsAuth && !loginAvailable ? (h("div", { className: "tlogs-hint" }, t('panel.login.unavailable'))) : null,
        showTokenInput ? (h("div", { className: "tlogs-notice" },
            h("input", { className: "tlogs-input", type: "password", autoComplete: "off", spellCheck: false, placeholder: t('panel.token.placeholder'), value: draft, onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => {
                    if (e.key === 'Enter')
                        void submitToken();
                } }),
            h("span", { className: "tlogs-actions" },
                h("button", { type: "button", className: "tlogs-btn tlogs-btn-primary", onClick: () => void submitToken() }, t('panel.save')),
                h("button", { type: "button", className: "tlogs-btn", onClick: () => {
                        setDraft('');
                        setShowTokenInput(false);
                    } }, t('panel.cancel'))))) : null,
        error ? h("div", { className: "tlogs-error" }, error) : null,
        auth.status === 'ok' ? (h("div", { className: "tlogs-hint" }, t('panel.credentialsSource', {
            source: SOURCE_LABEL[auth.source]
                ? t(SOURCE_LABEL[auth.source])
                : auth.source,
        }))) : null,
        h("div", { className: "tlogs-hint", title: basis.tip }, t(TIME_BASIS_KEY)),
        snapshot?.localUsage && !snapshot.localUsage.available ? (h("div", { className: "tlogs-hint" }, t('panel.localUnavailable', { reason: localReasonLabel(snapshot.localUsage.reason, t) }))) : null,
        snapshot && !snapshot.costComplete && snapshot.loading ? (h("div", { className: "tlogs-hint" }, t('panel.costBackfill'))) : null,
        h("div", { className: "tlogs-cards" },
            (snapshot?.cards ?? []).map((card, i) => (h(Card, { key: `${card.scope}-${card.label}-${i}`, card: card, numberFormat: numberFormat, selectedId: selections[i] ?? card.selectedOptionId, onCycle: card.options && card.options.length > 1 ? () => cycle(i, card) : undefined }))),
            snapshot === null ? h("div", { className: "tlogs-empty" }, t('common.loading')) : null),
        snapshot?.account ? (h("div", { className: "tlogs-account" },
            h("span", { title: t('panel.account.balanceTip') },
                t('panel.account.balance'),
                h("b", null, formatMoneyFull(snapshot.account.balance))),
            h("span", { title: t('panel.account.totalCostsTip') },
                t('panel.account.totalCosts'),
                h("b", null, formatMoneyFull(snapshot.account.totalCosts))),
            snapshot.account.bonusBalance > 0 ? (h("span", { title: t('panel.account.bonusTip') },
                t('panel.account.bonus'),
                h("b", null, formatMoneyFull(snapshot.account.bonusBalance)))) : null)) : null,
        h("div", { className: "tlogs-footer-actions" },
            enableDetailView ? (h("button", { type: "button", className: "tlogs-btn", onClick: onOpenDetail }, t('panel.detail'))) : (h("span", null)),
            h("span", { className: "tlogs-actions" },
                h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? t('common.refreshing') : t('common.refresh')),
                h("button", { type: "button", className: "tlogs-btn", onClick: onLogout, title: t('panel.logout.title') }, t('panel.logout'))))));
}
//# sourceMappingURL=expand-panel.js.map