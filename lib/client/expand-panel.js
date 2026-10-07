/**
 * tlogs — 形态 B：展开面板。
 *
 * 需求 1.3：五张数据卡片，每张同时显示输入 Token、输出 Token、请求次数。
 * 需求 1.2：底部一行「详细数据 >」+「刷新」+「退出登录」。
 * 需求 2.4 / 5.2：token 失效时在面板顶部显示「需要重新登录」。
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatNumber } from './format.js';
/** 凭据来源的中文名（对应 `AuthState.source`）。 */
const SOURCE_LABEL = {
    env: '环境变量',
    config: '插件配置',
    credentials: '本机凭据（手动填写 / 登录）',
    'platform-session': 'DSH 账号登录态（自动复用）',
    'desktop-login': '内置登录窗口',
};
/** 数据卡片：标题 + 总量 + 输入/输出/请求拆分。 */
function Card(props) {
    const { card, numberFormat, selectedId, onCycle } = props;
    const clickable = typeof onCycle === 'function' && (card.options?.length ?? 0) > 1;
    const current = card.options?.find((o) => o.id === selectedId) ?? card.options?.[0];
    const stat = current?.stat ?? card.stat;
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
            card.stale ? h("span", { className: "tlogs-stale" }, "\u26A0") : null),
        card.error ? (h("span", { className: "tlogs-card-total is-error" }, card.error)) : (h(Fragment, null,
            h("span", { className: "tlogs-card-total", title: `${formatFull(stat.totalTokens)} tokens` }, formatNumber(stat.totalTokens, numberFormat)),
            h("span", { className: "tlogs-card-split" },
                h("span", null,
                    "\u8F93\u5165 ",
                    h("b", { title: formatFull(stat.inputTokens) }, formatNumber(stat.inputTokens, numberFormat))),
                h("span", null,
                    "\u8F93\u51FA ",
                    h("b", { title: formatFull(stat.outputTokens) }, formatNumber(stat.outputTokens, numberFormat))),
                h("span", null,
                    "\u8BF7\u6C42 ",
                    h("b", { title: formatFull(stat.requests) }, formatNumber(stat.requests, numberFormat))))))));
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
        h("div", { className: "tlogs-cards" },
            (snapshot?.cards ?? []).map((card, i) => (h(Card, { key: `${card.scope}-${card.label}-${i}`, card: card, numberFormat: numberFormat, selectedId: selections[i] ?? card.selectedOptionId, onCycle: card.options && card.options.length > 1 ? () => cycle(i, card) : undefined }))),
            snapshot === null ? h("div", { className: "tlogs-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : null),
        h("div", { className: "tlogs-footer-actions" },
            enableDetailView ? (h("button", { type: "button", className: "tlogs-btn", onClick: onOpenDetail }, "\u8BE6\u7EC6\u6570\u636E \u203A")) : (h("span", null)),
            h("span", { className: "tlogs-actions" },
                h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? '刷新中…' : '刷新'),
                h("button", { type: "button", className: "tlogs-btn", onClick: onLogout, title: "\u6E05\u9664\u672C\u673A\u4FDD\u5B58\u7684 userToken" }, "\u9000\u51FA\u767B\u5F55")))));
}
//# sourceMappingURL=expand-panel.js.map