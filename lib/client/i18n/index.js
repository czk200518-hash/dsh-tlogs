/**
 * tlogs — client strings and language preference (Chinese / English / follow system).
 *
 * The plugin carries its own dictionaries rather than using the host locale service:
 * dsh-client-locale switches the language of the whole GUI, and changing a plugin's language must
 * not rewrite the rest of the window.
 *
 * "Follow system" resolves in this order: `<html lang>` (the DSH locale service writes the active
 * language there, i.e. whatever was picked under Settings → General) → `navigator.languages` /
 * `navigator.language` → Chinese. The read happens on every translation, so the plugin UI follows a
 * host language change on the next re-render — hence no MutationObserver: it would fire React updates
 * outside rendering and keep jsdom test processes alive after the tests end.
 *
 * The preference is persisted in localStorage, so a switch applies immediately and survives a
 * restart; "follow system" is the default and the fallback when storage is unavailable. Rendering
 * must use `useT()` (or that part of the UI does not re-render); `t()` serves module-scope and
 * event-handler callers.
 */
import * as React from 'react';
import { zh } from './dict/zh.js';
import { en } from './dict/en.js';
/** The three options of the settings panel, in display order. */
export const LANG_PREFS = ['auto', 'zh', 'en'];
/** localStorage key, prefixed with the plugin name to avoid clashes. */
export const LANG_STORAGE_KEY = 'tlogs.lang';
const DICTS = { zh, en };
let pref = readPref();
const listeners = new Set();
function notify() {
    for (const fn of [...listeners])
        fn();
}
/** Read the stored preference; when there is none (first run, storage disabled) fall back to "follow system". */
function readPref() {
    try {
        const raw = globalThis.localStorage?.getItem(LANG_STORAGE_KEY);
        if (raw === 'auto' || raw === 'zh' || raw === 'en')
            return raw;
    }
    catch {
        // Private mode or storage disabled: do not throw, keep the preference in memory.
    }
    return 'auto';
}
function writePref(next) {
    try {
        globalThis.localStorage?.setItem(LANG_STORAGE_KEY, next);
    }
    catch {
        // As above: a failed write does not affect switching within this session.
    }
}
/** Normalize any language tag to a supported language; undefined when unknown. */
function normalizeLang(tag) {
    if (!tag)
        return undefined;
    const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
    if (primary === 'zh')
        return 'zh';
    if (primary === 'en')
        return 'en';
    return undefined;
}
/** Detect the current system/host language, falling back to Chinese: explicit host choice, then the
 * first supported browser/desktop language, then Chinese. */
export function detectSystemLang() {
    const htmlLang = typeof document !== 'undefined' ? document.documentElement?.lang : undefined;
    const fromHtml = normalizeLang(htmlLang);
    if (fromHtml)
        return fromHtml;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    for (const tag of nav?.languages ?? []) {
        const hit = normalizeLang(tag);
        if (hit)
            return hit;
    }
    return normalizeLang(nav?.language) ?? 'zh';
}
/** Resolve a preference into the language actually in effect. */
export function resolveLang(next) {
    return next === 'auto' ? detectSystemLang() : next;
}
export function getLangPref() {
    return pref;
}
/** Language in effect; computed on every call so a host language change is picked up. */
export function getLang() {
    return resolveLang(pref);
}
/** Switch the preference: persist it and notify subscribers, which re-renders the UI. */
export function setLangPref(next) {
    if (next === pref)
        return;
    pref = next;
    writePref(next);
    notify();
}
/** Subscribe to preference changes; returns the unsubscribe function. */
export function subscribeLang(fn) {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
}
/** Translate a key in the given language; a missing key falls back to Chinese, then to the key itself. */
export function translate(target, key, params) {
    const table = DICTS[target];
    const template = table[key] ?? DICTS.zh[key] ?? key;
    if (!params)
        return template;
    return template.replace(/\{(\w+)\}/g, (whole, name) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole);
}
/** Translate with the current language (module-level callers; render paths use `useT()`). */
export function t(key, params) {
    return translate(getLang(), key, params);
}
export function useLangState() {
    const [current, setCurrent] = React.useState(pref);
    React.useEffect(() => {
        const sync = () => setCurrent(pref);
        sync();
        return subscribeLang(sync);
    }, []);
    // The language in effect is computed during render instead of being stored:
    // nothing notifies about a host language change, and computing it keeps "the
    // next render already uses the new language" true.
    return { pref: current, lang: resolveLang(current), setPref: setLangPref };
}
/** Translator bound to the current language (a new function on a language change, so components re-render). */
export function useT() {
    const { lang: current } = useLangState();
    return React.useCallback((key, params) => translate(current, key, params), [current]);
}
/** Translator for non-component callers (event handlers, on-demand use inside pure functions). */
export function bindT() {
    return (key, params) => translate(getLang(), key, params);
}
//# sourceMappingURL=index.js.map