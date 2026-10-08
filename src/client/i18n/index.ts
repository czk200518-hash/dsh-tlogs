/**
 * tlogs — 客户端文案与语言偏好（中文 / English / 跟随系统）。
 *
 * 设计要点：
 *  - **自带字典，不依赖宿主 locale 服务**。DSH 的 `dsh-client-locale` 提供的是
 *    「整个 GUI 一种语言」，而本插件要的是「插件自己的语言」——用宿主服务的话，
 *    在插件里切语言会把整个 DSH 的界面语言一起改掉，那是越权。
 *  - 「跟随系统」读的是**宿主已经定好的语言环境**，优先级：
 *      `<html lang>`（DSH locale 服务会把生效语言写在这里，即「设置 → 常规」里选的语言）
 *      → `navigator.languages` / `navigator.language`（浏览器/桌面壳）
 *      → 中文（无法识别时的回退，符合需求）。
 *    这一读取发生在**每次翻译时**（`getLang()` 现算），因此宿主语言变了之后，
 *    插件界面在下一次重渲染就会跟上——不需要 MutationObserver 常驻监听。
 *    （早先用过 `<html lang>` 的 observer：它会在渲染之外触发 React 更新，
 *    既多余，又让 jsdom 里的测试进程跑完不退出。现算更简单也更安全。）
 *  - 偏好存 localStorage：切换即时生效、插件重启后保持上次选择。
 *    「跟随系统」是默认值，也是存储不可用时的回退。
 *  - `t()` 既可以直接调用（模块级、事件回调里），也可以经 `useT()` 在组件里调用；
 *    **组件的渲染必须走 `useT()`**，否则切语言时那部分文案不会重渲染。
 */

import * as React from 'react'
import { zh } from './dict/zh.js'
import { en } from './dict/en.js'

/** 插件界面支持的语言。 */
export type Lang = 'zh' | 'en'

/** 用户偏好：`auto` = 跟随系统。 */
export type LangPref = 'auto' | Lang

/** 全部文案键（中文词典是唯一事实来源，英文词典被强制要求键齐全）。 */
export type MessageKey = keyof typeof zh

/** 文案插值参数：`t('a.b', { n: 3 })` 替换 `{n}`。 */
export type MessageParams = Record<string, string | number>

/**
 * 翻译函数类型：`useT()` / `bindT()` 的返回类型，也是把翻译函数当参数
 * 往下传（纯函数里生成文案）时的形参类型。
 */
export type Translator = (key: MessageKey, params?: MessageParams) => string

/** 设置面板里的三个选项（顺序即展示顺序）。 */
export const LANG_PREFS: readonly LangPref[] = ['auto', 'zh', 'en']

/** localStorage 键名（带插件前缀，避免与宿主/其它插件撞车）。 */
export const LANG_STORAGE_KEY = 'tlogs.lang'

const DICTS: Record<Lang, typeof zh> = { zh, en }

let pref: LangPref = readPref()
const listeners = new Set<() => void>()

function notify(): void {
  for (const fn of [...listeners]) fn()
}

/** 读取已保存的偏好；读不到（首次运行/存储被禁）时回到「跟随系统」。 */
function readPref(): LangPref {
  try {
    const raw = globalThis.localStorage?.getItem(LANG_STORAGE_KEY)
    if (raw === 'auto' || raw === 'zh' || raw === 'en') return raw
  } catch {
    // 隐私模式或存储被禁：不抛错，退化为内存偏好。
  }
  return 'auto'
}

function writePref(next: LangPref): void {
  try {
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, next)
  } catch {
    // 同上：存不下也不影响本次会话内的切换。
  }
}

/** 把任意语言标签归一化成支持的语言；不认识就返回 undefined。 */
function normalizeLang(tag: string | undefined | null): Lang | undefined {
  if (!tag) return undefined
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0]
  if (primary === 'zh') return 'zh'
  if (primary === 'en') return 'en'
  return undefined
}

/**
 * 识别当前系统/宿主语言，无法识别时回退中文。
 *
 * 顺序即优先级：宿主显式选择 > 浏览器/桌面壳的第一个受支持语言 > 中文。
 */
export function detectSystemLang(): Lang {
  const htmlLang = typeof document !== 'undefined' ? document.documentElement?.lang : undefined
  const fromHtml = normalizeLang(htmlLang)
  if (fromHtml) return fromHtml

  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  for (const tag of nav?.languages ?? []) {
    const hit = normalizeLang(tag)
    if (hit) return hit
  }
  return normalizeLang(nav?.language) ?? 'zh'
}

/** 把一个偏好解析成实际生效的语言。 */
export function resolveLang(next: LangPref): Lang {
  return next === 'auto' ? detectSystemLang() : next
}

/** 当前偏好（`auto` / `zh` / `en`）。 */
export function getLangPref(): LangPref {
  return pref
}

/** 当前生效的语言（「跟随系统」时现算，因此宿主语言一变就会跟上）。 */
export function getLang(): Lang {
  return resolveLang(pref)
}

/** 切换偏好：写入存储并通知所有订阅者，界面随即重渲染。 */
export function setLangPref(next: LangPref): void {
  if (next === pref) return
  pref = next
  writePref(next)
  notify()
}

/** 订阅语言偏好变化，返回取消订阅函数。 */
export function subscribeLang(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** 用指定语言翻译一个键；缺键时按中文 → 键名兜底（正常不会发生，类型已保证齐全）。 */
export function translate(target: Lang, key: MessageKey, params?: MessageParams): string {
  const table = DICTS[target] as Record<string, string | undefined>
  const template = table[key] ?? (DICTS.zh as Record<string, string | undefined>)[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  )
}

/** 按当前语言翻译（模块级调用；渲染路径请用 `useT()`）。 */
export function t(key: MessageKey, params?: MessageParams): string {
  return translate(getLang(), key, params)
}

/** 语言偏好 + 生效语言 + 切换函数（组件用）。 */
export function useLangState(): { pref: LangPref; lang: Lang; setPref: (next: LangPref) => void } {
  const [current, setCurrent] = React.useState<LangPref>(pref)

  React.useEffect(() => {
    const sync = () => setCurrent(pref)
    sync()
    return subscribeLang(sync)
  }, [])

  // 生效语言在渲染时现算（而不是存进 state）：宿主语言变化没有专门的通知源，
  // 现算能保证「下一次重渲染就是新语言」。
  return { pref: current, lang: resolveLang(current), setPref: setLangPref }
}

/** 绑定当前语言的翻译函数（语言变化时返回新函数，组件随之重渲染）。 */
export function useT(): Translator {
  const { lang: current } = useLangState()
  return React.useCallback(
    (key: MessageKey, params?: MessageParams) => translate(current, key, params),
    [current],
  )
}

/** 当前语言下的翻译函数（非组件场景：事件回调、纯函数内部按需取用）。 */
export function bindT(): Translator {
  return (key: MessageKey, params?: MessageParams) => translate(getLang(), key, params)
}
