/**
 * tlogs — 形态 B：展开面板。
 *
 * 需求 1.3：五张数据卡片，每张同时显示输入 Token、输出 Token、请求次数。
 * 需求 1.2：底部一行「详细数据 >」+「刷新」+「退出登录」。
 * 需求 2.4 / 5.2：token 失效时在面板顶部显示「需要重新登录」。
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatMoney, formatMoneyFull, formatNumber, localReasonLabel } from './format.js';
import { useT } from './i18n/index.js';
import { moneyTotal } from '../types.js';
/** 凭据来源的文案键（对应 `AuthState.source`）。 */
const SOURCE_LABEL = {
    env: 'panel.source.env',
    config: 'panel.source.config',
    credentials: 'panel.source.credentials',
    'platform-session': 'panel.source.platformSession',
    'desktop-login': 'panel.source.desktopLogin',
};
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
const TIME_BASIS_KEY = 'panel.timeBasis';
/**
 * 时间口径那行的 tooltip：按本机真实时区解释换日时刻。
 *
 * `t` 由调用方传入（组件里是 `useT()` 的返回值）—— tooltip 是渲染产物，
 * 用模块级 `t` 会让它停在旧语言上。
 */
function dayBasisTip(t) {
    /** getTimezoneOffset() 是「UTC − 本地」的分钟数，取反得到本地相对 UTC 的偏移。 */
    const offsetMin = -new Date().getTimezoneOffset();
    /** 把「相对 UTC 的分钟偏移」折成 `HH:MM`。 */
    const hhmm = (m) => {
        const x = ((m % 1440) + 1440) % 1440;
        return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
    };
    const start = hhmm(offsetMin);
    const end = hhmm(offsetMin + 1440);
    /**
     * 账单与用量接口的日界并不一致，这一点必须写出来，否则对账时一定会怀疑插件算错：
     * 官方**计费**按北京时间日（00:00 换日），而官方**用量接口**的日桶按 UTC
     * （北京 08:00 换日）。两者在跨日处最多差 8 小时的用量。
     */
    const billing = t('panel.dayBasis.billing');
    if (offsetMin === 0) {
        return { tip: t('panel.dayBasis.utc', { billing }) };
    }
    return { tip: t('panel.dayBasis.local', { start, end, billing }) };
}
/** 数据卡片：标题 + 总量（token 与 ¥）+ 输入/输出/请求拆分。 */
function Card(props) {
    const { card, numberFormat, selectedId, onCycle } = props;
    const t = useT();
    const clickable = typeof onCycle === 'function' && (card.options?.length ?? 0) > 1;
    const current = card.options?.find((o) => o.id === selectedId) ?? card.options?.[0];
    const stat = current?.stat ?? card.stat;
    // 金额：没有金额数据时**不显示 ¥0.00** —— 那会让人以为这段时间真的没花钱，
    // 而实际是「金额还没回补到」。宁可少一行。
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
/** 窗口的「输入」费用 = PROMPT + 缓存命中 + 缓存未命中。 */
function inputCost(stat) {
    const c = stat.cost;
    if (!c)
        return 0;
    return c.PROMPT_TOKEN + c.PROMPT_CACHE_HIT_TOKEN + c.PROMPT_CACHE_MISS_TOKEN;
}
/** 窗口的「输出」费用。 */
function outputCost(stat) {
    return stat.cost?.RESPONSE_TOKEN ?? 0;
}
/**
 * 卡片口径信息的 tooltip（挂在卡片标题上）。
 *
 * 为什么不常挂徽标：现在**大多数窗口都是两路合并**的结果（当天平台结算滞后、加上
 * 平台账单看不到的第三方供应商），常年挂徽标只会挤掉标题、制造噪声。卡面只在
 * 「这个窗口含平台账单看不到的第三方用量」时标一下，其余细节放这里。
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
/** 本机口径不可用的原因（英文枚举）转成一句人话；与详细数据「供应商」页签共用。 */
function reasonLabel(reason, t) {
    return localReasonLabel(reason, t);
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
     * 宿主是否真能开登录窗口。缺省按「可用」处理，兼容尚未下发该字段的旧宿主。
     */
    const loginAvailable = snapshot?.display.loginAvailable !== false;
    /** 平台日（UTC 日）在本机时区对应的时间段（tooltip 用）。 */
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
        // 变量名不叫 t：这个作用域里 t 是翻译函数。
        const trimmed = draft.trim();
        if (!trimmed)
            return;
        const ok = await onSetToken(trimmed);
        if (ok) {
            // 安全：提交后立即从组件状态里清掉明文。
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
            // 未知来源（旧宿主 / 以后新增的枚举）直接显示原始值，别伪造成某一种已知来源。
            source: SOURCE_LABEL[auth.source]
                ? t(SOURCE_LABEL[auth.source])
                : auth.source,
        }))) : null,
        h("div", { className: "tlogs-hint", title: basis.tip }, t(TIME_BASIS_KEY)),
        snapshot?.localUsage && !snapshot.localUsage.available ? (h("div", { className: "tlogs-hint" }, t('panel.localUnavailable', { reason: reasonLabel(snapshot.localUsage.reason, t) }))) : null,
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