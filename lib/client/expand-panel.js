/**
 * tlogs — 形态 B：展开面板。
 *
 * 需求 1.3：五张数据卡片，每张同时显示输入 Token、输出 Token、请求次数。
 * 需求 1.2：底部一行「详细数据 >」+「刷新」+「退出登录」。
 * 需求 2.4 / 5.2：token 失效时在面板顶部显示「需要重新登录」。
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatMoney, formatMoneyFull, formatNumber } from './format.js';
import { moneyTotal } from '../types.js';
/** 凭据来源的中文名（对应 `AuthState.source`）。 */
const SOURCE_LABEL = {
    env: '环境变量',
    config: '插件配置',
    credentials: '本机凭据（手动填写 / 登录）',
    'platform-session': 'DSH 账号登录态（自动复用）',
    'desktop-login': '内置登录窗口',
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
 * 平台桶的边界在**北京时区里是恒定值**（永远 08:00），所以这句写死是准确的：
 * 换到别的时区跑，变的是「本机几点换日」，那句话在 tooltip 里按真实时区解释。
 */
const TIME_BASIS_LABEL = '统计口径：平台日（UTC）· 北京 08:00 换日';
/** 时间口径那行的 tooltip：按本机真实时区解释换日时刻。 */
function dayBasisTip() {
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
    const billing = '官方账单按北京时间日（0 点）结算，本插件的日桶按接口口径（UTC 日）—— ' +
        '两者在跨日处最多差 8 小时的用量。';
    if (offsetMin === 0) {
        return {
            tip: `平台接口的 days[] 按 UTC 日切桶；本机时区就是 UTC，所以本机 00:00 换日。${billing}`,
        };
    }
    return {
        tip: `平台接口的 days[] 按 UTC 日切桶：本机 ${start} 换日，` +
            `「今日」= ${start} ～ 次日 ${end}（不是本机 00:00 换日）。` +
            `当周/当月同理（周一 00:00 / 1 日 00:00 均按 UTC 计）。${billing}`,
    };
}
/** 数据卡片：标题 + 总量（token 与 ¥）+ 输入/输出/请求拆分。 */
function Card(props) {
    const { card, numberFormat, selectedId, onCycle } = props;
    const clickable = typeof onCycle === 'function' && (card.options?.length ?? 0) > 1;
    const current = card.options?.find((o) => o.id === selectedId) ?? card.options?.[0];
    const stat = current?.stat ?? card.stat;
    // 金额：没有金额数据时**不显示 ¥0.00** —— 那会让人以为这段时间真的没花钱，
    // 而实际是「金额还没回补到」。宁可少一行。
    const cost = stat.cost ? moneyTotal(stat.cost) : undefined;
    const moneyTip = cost === undefined
        ? ''
        : [
            `${card.label} 合计 ${formatMoneyFull(cost)} 元`,
            `输入 ${formatMoneyFull(inputCost(stat))} 元`,
            `输出 ${formatMoneyFull(outputCost(stat))} 元`,
        ].join('\n');
    return (h("div", { className: clickable ? 'tlogs-card tlogs-card-clickable' : 'tlogs-card', onClick: clickable ? onCycle : undefined, role: clickable ? 'button' : undefined, tabIndex: clickable ? 0 : undefined, onKeyDown: clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCycle?.();
                }
            }
            : undefined, title: clickable ? '点击切换项目' : undefined },
        h("div", { className: "tlogs-card-head" },
            h("span", { className: "tlogs-card-title" },
                card.label,
                current && (card.options?.length ?? 0) > 1 ? ` · ${current.label}` : ''),
            card.source && card.source.kind !== 'platform' ? (h("span", { className: "tlogs-src", title: sourceTip(card.source) }, card.source.kind === 'local' ? '本机' : '合并')) : null,
            card.source?.costPending ? (h("span", { className: "tlogs-src tlogs-src-pending", title: "\u91D1\u989D\u662F\u5E73\u53F0\u8D26\u5355\u53E3\u5F84\uFF1B\u8BE5\u7A97\u53E3\u5E73\u53F0\u5C1A\u672A\u7ED3\u7B97\u5B8C\uFF0C\u91D1\u989D\u4F1A\u504F\u5C0F\uFF08token \u6570\u5DF2\u7528\u672C\u673A\u53E3\u5F84\uFF09" }, "\u00A5\u7ED3\u7B97\u4E2D")) : null,
            card.stale ? h("span", { className: "tlogs-stale" }, "\u26A0") : null),
        card.error ? (h("span", { className: "tlogs-card-total is-error" }, card.error)) : (h(Fragment, null,
            h("span", { className: "tlogs-card-line" },
                h("span", { className: "tlogs-card-total", title: `${formatFull(stat.totalTokens)} tokens` }, formatNumber(stat.totalTokens, numberFormat)),
                cost === undefined ? null : (h("span", { className: "tlogs-card-money", title: moneyTip }, formatMoney(cost)))),
            h("span", { className: "tlogs-card-split" },
                h("span", null,
                    h("span", { className: "tlogs-split-label" }, "\u8F93\u5165"),
                    h("b", { title: formatFull(stat.inputTokens) }, formatNumber(stat.inputTokens, numberFormat))),
                h("span", null,
                    h("span", { className: "tlogs-split-label" }, "\u8F93\u51FA"),
                    h("b", { title: formatFull(stat.outputTokens) }, formatNumber(stat.outputTokens, numberFormat))),
                h("span", null,
                    h("span", { className: "tlogs-split-label" }, "\u8BF7\u6C42"),
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
 * 卡片右上角口径徽标的 tooltip。
 *
 * 双路数据源下「这个数字是谁给的」必须能一眼追查：平台口径只覆盖 DeepSeek
 * 官方通道且当天要等结算，本机口径（会话日志）实时、含所有供应商但不含别的设备。
 */
function sourceTip(s) {
    const head = s.kind === 'local'
        ? '本机口径（DSH 会话日志）：实时，覆盖本机所有供应商'
        : s.kind === 'merged'
            ? '平台 + 本机合并口径'
            : '平台账单口径';
    const lines = [
        head,
        `平台 ${formatFull(s.platformTokens)} tokens`,
        `本机 ${formatFull(s.localTokens)} tokens（其中 DeepSeek 通道 ${formatFull(s.localDeepseekTokens)}）`,
    ];
    if (s.otherProviders.length > 0) {
        lines.push('平台看不到的供应商：' +
            s.otherProviders
                .slice(0, 4)
                .map((p) => `${p.provider} ${formatFull(p.tokens)}`)
                .join('、'));
    }
    if (s.costPending)
        lines.push('金额仍是平台账单：该窗口平台尚未结算完，会偏小');
    return lines.join('\n');
}
/** 本机口径不可用的原因（英文枚举）转成一句人话。 */
function reasonLabel(reason) {
    switch (reason) {
        case 'no-session-logs':
            return '未找到会话日志';
        case 'zstd-unavailable':
            return '当前运行时不支持 zstd（需要 Node 22.15+ / 24）';
        case 'not-scanned':
            return '尚未扫描';
        case 'restored-empty':
            return '缓存里没有可用数据';
        default:
            return reason && reason.startsWith('sessions-dir-unreadable')
                ? '会话目录不可读'
                : '读取失败';
    }
}
export function ExpandPanel(props) {
    const { snapshot, error, busy, numberFormat, enableDetailView, onRefresh, onOpenDetail, onLogin, onSetToken, onLogout, } = props;
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
    const basis = dayBasisTip();
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
        const t = draft.trim();
        if (!t)
            return;
        const ok = await onSetToken(t);
        if (ok) {
            // 安全：提交后立即从组件状态里清掉明文。
            setDraft('');
            setShowTokenInput(false);
        }
    };
    return (h("div", { className: "tlogs-panel" },
        needsAuth ? (h("div", { className: "tlogs-notice tlogs-notice-danger" },
            h("span", null,
                auth.status === 'invalid'
                    ? 'userToken 已失效，需要重新登录'
                    : '未配置 userToken，无法获取用量',
                auth.status === 'invalid' && auth.message ? (h("span", { className: "tlogs-hint" },
                    " \u2014\u2014 ",
                    auth.message)) : null),
            h("span", { className: "tlogs-actions" },
                h("button", { type: "button", className: "tlogs-btn tlogs-btn-primary", onClick: onLogin, disabled: !loginAvailable, title: loginAvailable
                        ? '打开内置登录窗口'
                        : '当前宿主无法创建登录窗口，请用「手动填写」粘贴 platform userToken' }, "\u767B\u5F55"),
                h("button", { type: "button", className: "tlogs-btn", onClick: () => setShowTokenInput((v) => !v), title: "\u624B\u52A8\u7C98\u8D34 userToken\uFF08\u65B9\u6848 C\uFF09" }, "\u624B\u52A8\u586B\u5199")))) : null,
        needsAuth && !loginAvailable ? (h("div", { className: "tlogs-hint" }, "\u5185\u7F6E\u767B\u5F55\u5728\u5F53\u524D\u5BBF\u4E3B\u4E0D\u53EF\u7528\uFF1A\u63D2\u4EF6\u8FD0\u884C\u5728 Electron \u7684 Node \u5B50\u8FDB\u7A0B\u91CC\uFF0C\u521B\u5EFA\u4E0D\u4E86\u767B\u5F55\u7A97\u53E3\u3002 \u8BF7\u70B9\u300C\u624B\u52A8\u586B\u5199\u300D\u7C98\u8D34 platform userToken\uFF08\u5F62\u5982\u6D4F\u89C8\u5668 localStorage \u91CC\u7684 userToken \u503C\uFF09\u3002")) : null,
        showTokenInput ? (h("div", { className: "tlogs-notice" },
            h("input", { className: "tlogs-input", type: "password", autoComplete: "off", spellCheck: false, placeholder: "\u7C98\u8D34 userToken", value: draft, onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => {
                    if (e.key === 'Enter')
                        void submitToken();
                } }),
            h("span", { className: "tlogs-actions" },
                h("button", { type: "button", className: "tlogs-btn tlogs-btn-primary", onClick: () => void submitToken() }, "\u4FDD\u5B58"),
                h("button", { type: "button", className: "tlogs-btn", onClick: () => {
                        setDraft('');
                        setShowTokenInput(false);
                    } }, "\u53D6\u6D88")))) : null,
        error ? h("div", { className: "tlogs-error" }, error) : null,
        auth.status === 'ok' ? (h("div", { className: "tlogs-hint" },
            "\u51ED\u636E\u6765\u6E90\uFF1A",
            SOURCE_LABEL[auth.source] ?? auth.source)) : null,
        h("div", { className: "tlogs-hint", title: basis.tip }, TIME_BASIS_LABEL),
        snapshot?.localUsage && !snapshot.localUsage.available ? (h("div", { className: "tlogs-hint" },
            "\u672C\u673A\u53E3\u5F84\u4E0D\u53EF\u7528\uFF08",
            reasonLabel(snapshot.localUsage.reason),
            "\uFF09\uFF1A\u7A97\u53E3\u5361\u7247\u53EA\u7528\u5E73\u53F0\u8D26\u5355\uFF0C \u5F53\u5929\u4E0E\u300C\u975E DeepSeek \u4F9B\u5E94\u5546\u300D\u7684\u7528\u91CF\u53EF\u80FD\u7F3A\u5931\u6216\u663E\u793A 0")) : null,
        snapshot && !snapshot.costComplete && snapshot.loading ? (h("div", { className: "tlogs-hint" }, "\u6B63\u5728\u56DE\u8865\u5386\u53F2\u91D1\u989D\uFF0C\u5361\u7247\u4E0A\u7684 \u00A5 \u6682\u4E3A\u90E8\u5206\u5408\u8BA1\u2026")) : null,
        h("div", { className: "tlogs-cards" },
            (snapshot?.cards ?? []).map((card, i) => (h(Card, { key: `${card.scope}-${card.label}-${i}`, card: card, numberFormat: numberFormat, selectedId: selections[i] ?? card.selectedOptionId, onCycle: card.options && card.options.length > 1 ? () => cycle(i, card) : undefined }))),
            snapshot === null ? h("div", { className: "tlogs-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : null),
        snapshot?.account ? (h("div", { className: "tlogs-account" },
            h("span", { title: "\u5E73\u53F0\u5145\u503C\u4F59\u989D\uFF08get_user_summary.normal_wallets\uFF09" },
                "\u4F59\u989D ",
                h("b", null, formatMoneyFull(snapshot.account.balance))),
            h("span", { title: "\u5E73\u53F0\u8D26\u5355\u7684\u7D2F\u8BA1\u6D88\u8D39\uFF08get_user_summary.total_costs\uFF09\uFF0C\u5373\u63A7\u5236\u53F0\u53E3\u5F84" },
                "\u5B98\u65B9\u7D2F\u8BA1\u6D88\u8D39 ",
                h("b", null, formatMoneyFull(snapshot.account.totalCosts))),
            snapshot.account.bonusBalance > 0 ? (h("span", { title: "\u8D60\u9001\u4F59\u989D" },
                "\u8D60\u9001 ",
                h("b", null, formatMoneyFull(snapshot.account.bonusBalance)))) : null)) : null,
        h("div", { className: "tlogs-footer-actions" },
            enableDetailView ? (h("button", { type: "button", className: "tlogs-btn", onClick: onOpenDetail }, "\u8BE6\u7EC6\u6570\u636E \u203A")) : (h("span", null)),
            h("span", { className: "tlogs-actions" },
                h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? '刷新中…' : '刷新'),
                h("button", { type: "button", className: "tlogs-btn", onClick: onLogout, title: "\u6E05\u9664\u672C\u673A\u4FDD\u5B58\u7684 userToken" }, "\u9000\u51FA\u767B\u5F55")))));
}
//# sourceMappingURL=expand-panel.js.map