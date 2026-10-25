/**
 * tlogs — the "settings" tab inside the detail modal: the plugin's UI language and the day basis
 * of the 「今日」 card.
 *
 * Both switches live here rather than in the host settings because DSH's own Settings → General →
 * Language governs the whole GUI while these only affect tlogs. The tabs are a heading plus the
 * options, and nothing else — the resolution order, where each choice is persisted and why the
 * platform day turns over at 08:00 Beijing live in the README (and in the option tooltips).
 */
import * as React from 'react';
import { h } from './h.js';
import { LANG_PREFS, useLangState, useT } from './i18n/index.js';
import { TODAY_BASES, useTodayBasis } from './today-basis.js';
const OPTION_KEY = {
    auto: 'settings.option.auto',
    zh: 'settings.option.zh',
    en: 'settings.option.en',
};
const BASIS_KEY = {
    platform: 'settings.basis.platform',
    local: 'settings.basis.local',
};
const BASIS_TIP_KEY = {
    platform: 'settings.basis.platformTip',
    local: 'settings.basis.localTip',
};
export function SettingsPanel() {
    const { pref, setPref } = useLangState();
    const { basis, setBasis } = useTodayBasis();
    const t = useT();
    return (h("div", { className: "tlogs-settings" },
        h("div", { className: "tlogs-settings-title" }, t('settings.title')),
        h("div", { className: "tlogs-settings-options", role: "radiogroup", "aria-label": t('settings.title') }, LANG_PREFS.map((id) => (h("label", { key: id, className: id === pref ? 'tlogs-settings-option is-selected' : 'tlogs-settings-option' },
            h("input", { type: "radio", className: "tlogs-settings-radio", name: "tlogs-lang", value: id, checked: id === pref, onChange: () => setPref(id) }),
            h("span", null, t(OPTION_KEY[id])))))),
        h("div", { className: "tlogs-settings-title" }, t('settings.basis')),
        h("div", { className: "tlogs-settings-options", role: "radiogroup", "aria-label": t('settings.basis') }, TODAY_BASES.map((id) => (h("label", { key: id, className: id === basis ? 'tlogs-settings-option is-selected' : 'tlogs-settings-option', title: t(BASIS_TIP_KEY[id]) },
            h("input", { type: "radio", className: "tlogs-settings-radio", name: "tlogs-today-basis", value: id, checked: id === basis, onChange: () => setBasis(id) }),
            h("span", null, t(BASIS_KEY[id]))))))));
}
//# sourceMappingURL=settings-panel.js.map