/**
 * tlogs — 「设置」页签（详细数据弹窗内）：插件界面语言。
 *
 * 为什么语言开关放在这里而不是宿主设置里：宿主（DSH）自己的「设置 → 常规 → 语言」
 * 管的是**整个 GUI** 的语言；本插件只需要管自己那几块 UI。放在插件自己的弹窗里，
 * 切换只影响本插件，不会动宿主的界面语言。
 *
 * 页面上只有**标题 + 三个选项**：解析顺序、持久化位置这些属于实现细节，写在
 * README 与 CHANGELOG 里，不占界面（用户明确要求删掉面板里的说明性文字）。
 * 「跟随系统」的解析顺序见 src/client/i18n/index.ts。
 */
import * as React from 'react';
import { h } from './h.js';
import { LANG_PREFS, useLangState, useT } from './i18n/index.js';
/** 三个选项的文案键（顺序由 LANG_PREFS 决定）。 */
const OPTION_KEY = {
    auto: 'settings.option.auto',
    zh: 'settings.option.zh',
    en: 'settings.option.en',
};
export function SettingsPanel() {
    const { pref, setPref } = useLangState();
    const t = useT();
    return (h("div", { className: "tlogs-settings" },
        h("div", { className: "tlogs-settings-title" }, t('settings.title')),
        h("div", { className: "tlogs-settings-options", role: "radiogroup", "aria-label": t('settings.title') }, LANG_PREFS.map((id) => (h("label", { key: id, className: id === pref ? 'tlogs-settings-option is-selected' : 'tlogs-settings-option' },
            h("input", { type: "radio", className: "tlogs-settings-radio", name: "tlogs-lang", value: id, checked: id === pref, onChange: () => setPref(id) }),
            h("span", null, t(OPTION_KEY[id]))))))));
}
//# sourceMappingURL=settings-panel.js.map