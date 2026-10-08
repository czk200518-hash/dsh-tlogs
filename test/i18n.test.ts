/**
 * 客户端文案与语言解析的单元测试。
 *
 * 这里钉住的是四条容易悄悄退化的不变量：
 *  1. 中英词典**键完全一致**（少翻一条在界面上就是露中文，typecheck 也会拦，但这里
 *     连 `lib/` 构建产物一起验，防止手改产物绕过类型检查）；
 *  2. 词典按 part 分文件，**不允许出现重复键**（重复的会被 spread 静默吃掉一条）；
 *  3. 英文词典里不得残留中日韩文字（语言自称除外——中文选项本来就写「中文」）；
 *  4. 「跟随系统」的解析顺序：宿主 `<html lang>` → 浏览器语言 → 中文。
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { zh } from '../lib/client/i18n/dict/zh.js'
import { en } from '../lib/client/i18n/dict/en.js'
import { zhApp } from '../lib/client/i18n/dict/zh-app.js'
import { zhUi } from '../lib/client/i18n/dict/zh-ui.js'
import { enApp } from '../lib/client/i18n/dict/en-app.js'
import { enUi } from '../lib/client/i18n/dict/en-ui.js'
import {
  LANG_PREFS,
  detectSystemLang,
  resolveLang,
  setLangPref,
  t,
  translate,
  type MessageKey,
} from '../lib/client/i18n/index.js'

const keysOf = (o: object): string[] => Object.keys(o).sort()

/** 语言自称这类值本来就该是中文，做「英文里不许有中文」检查时要放行。 */
const LANGUAGE_SELF_NAME_KEYS = new Set(['settings.option.zh'])
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/

test('中英词典键完全一致（两个方向都查）', () => {
  const zhKeys = keysOf(zh)
  const enKeys = keysOf(en)
  const missingInEn = zhKeys.filter((k) => !enKeys.includes(k))
  const extraInEn = enKeys.filter((k) => !zhKeys.includes(k))
  assert.deepEqual(missingInEn, [], `英文词典缺少这些键：${missingInEn.join(', ')}`)
  assert.deepEqual(extraInEn, [], `英文词典多出这些键：${extraInEn.join(', ')}`)
  assert.ok(zhKeys.length > 0, '词典不应为空')
})

test('词典 part 之间没有重复键（重复会被 spread 静默吞掉）', () => {
  assert.deepEqual(
    keysOf(zhApp).filter((k) => keysOf(zhUi).includes(k)),
    [],
    'zh-app.ts 与 zh-ui.ts 存在重复键',
  )
  assert.deepEqual(
    keysOf(enApp).filter((k) => keysOf(enUi).includes(k)),
    [],
    'en-app.ts 与 en-ui.ts 存在重复键',
  )
  assert.equal(
    keysOf(zh).length,
    keysOf(zhApp).length + keysOf(zhUi).length,
    '合并后的键数应等于两个 part 之和（否则说明有键被覆盖）',
  )
  assert.equal(keysOf(en).length, keysOf(enApp).length + keysOf(enUi).length)
})

test('键名遵循 <区域>.<名字>，且中英值都非空', () => {
  for (const key of keysOf(zh)) {
    assert.match(key, /^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/i, `键名不符合约定：${key}`)
    assert.ok(String((zh as Record<string, string>)[key]).trim().length > 0, `中文文案为空：${key}`)
    assert.ok(String((en as Record<string, string>)[key]).trim().length > 0, `英文文案为空：${key}`)
  }
})

test('英文词典里没有残留中文（语言自称除外）', () => {
  const leftovers = keysOf(en).filter(
    (key) => !LANGUAGE_SELF_NAME_KEYS.has(key) && CJK.test(String((en as Record<string, string>)[key])),
  )
  assert.deepEqual(leftovers, [], `这些键的英文文案里还有中文：${leftovers.join(', ')}`)
})

test('插值、回退与三种偏好的解析', () => {
  assert.equal(translate('zh', 'cal.monthTotal', { month: '2026-10' }), '2026-10 合计')
  assert.equal(translate('en', 'cal.monthTotal', { month: '2026-10' }), '2026-10 total')
  // 没有对应参数时保留占位符原文，而不是渲染成 undefined
  assert.equal(translate('zh', 'cal.monthTotal', {}), '{month} 合计')
  // 未知键回退成键名本身（便于在界面上直接看出漏了哪条）
  assert.equal(translate('zh', 'nope.missing' as MessageKey), 'nope.missing')

  assert.deepEqual([...LANG_PREFS], ['auto', 'zh', 'en'], '设置面板的三个选项顺序固定')
  assert.equal(resolveLang('zh'), 'zh')
  assert.equal(resolveLang('en'), 'en')

  setLangPref('en')
  assert.equal(t('tab.calendar'), 'Calendar', 'setLangPref 后 t() 必须立刻换语言')
  setLangPref('zh')
  assert.equal(t('tab.calendar'), '日历')
})

// ------------------------------------------------------------ 「跟随系统」解析

const realNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

/** 把 navigator 换成指定语言（Node 的 navigator 是只读 getter，必须 defineProperty）。 */
function stubNavigator(value: unknown): void {
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })
}

afterEach(() => {
  if (realNavigator) Object.defineProperty(globalThis, 'navigator', realNavigator)
  else delete (globalThis as Record<string, unknown>).navigator
})

test('跟随系统：读浏览器语言，识别不了就回退中文', () => {
  // Node 里没有 document，走的正是「没有宿主语言」这条分支。
  stubNavigator({ languages: ['zh-CN', 'zh'], language: 'zh-CN' })
  assert.equal(detectSystemLang(), 'zh')

  stubNavigator({ languages: ['en-US', 'en'], language: 'en-US' })
  assert.equal(detectSystemLang(), 'en')

  // 不支持的语种 → 回退中文（需求：无法识别时回退中文）
  stubNavigator({ languages: ['ja-JP', 'ja'], language: 'ja-JP' })
  assert.equal(detectSystemLang(), 'zh')

  // 连 navigator 都没有 → 同样回退中文
  stubNavigator(undefined)
  assert.equal(detectSystemLang(), 'zh')
})
