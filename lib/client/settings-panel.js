/**
 * tlogs — 「设置」页签（详细数据弹窗内）：插件界面语言。
 *
 * 为什么语言开关放在这里而不是宿主设置里：宿主（DSH）自己的「设置 → 常规 → 语言」
 * 管的是**整个 GUI** 的语言；本插件只需要管自己那几块 UI。放在插件自己的弹窗里，
 * 切换只影响本插件，不会动宿主的界面语言。
 *
 * 「跟随系统」解析顺序见 src/client/i18n/index.ts（`<html lang>` → 浏览器语言 → 中文）。
 * 偏好存 localStorage，插件重启后保持上次选择。
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
/** 生效语言的显示名，用各自语言自称（中文就写「中文」，英文就写 English）。 */
const LANG_NAME_KEY = { zh: 'settings.lang.zh', en: 'settings.lang.en' };
export function SettingsPanel() {
    const { pref, lang, setPref } = useLangState();
    const t = useT();
    return (h("div", { className: "tlogs-settings" },
        h("div", { className: "tlogs-settings-title" }, t('settings.title')),
        h("div", { className: "tlogs-hint tlogs-settings-desc" }, t('settings.desc')),
        h("div", { className: "tlogs-settings-options", role: "radiogroup", "aria-label": t('settings.title') }, LANG_PREFS.map((id) => (h("label", { key: id, className: id === pref ? 'tlogs-settings-option is-selected' : 'tlogs-settings-option' },
            h("input", { type: "radio", className: "tlogs-settings-radio", name: "tlogs-lang", value: id, checked: id === pref, onChange: () => setPref(id) }),
            h("span", null, t(OPTION_KEY[id])))))),
        h("div", { className: "tlogs-hint" }, t('settings.active', { lang: t(LANG_NAME_KEY[lang]) })),
        h("div", { className: "tlogs-hint" }, t('settings.storage'))));
}
//# sourceMappingURL=settings-panel.js.map