/**
 * 平台层级判定单测：**按通道判，不按模型名判**。
 *
 * 这一条是用户实测提出的疑问点：火山方舟（huoshanfangzhou）上跑的就是
 * `deepseek-v4-flash`。如果按模型名判断，这些调用会被误标成「官方」，
 * 而平台账单里根本没有它们 —— 归属就会错。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  OFFICIAL_BILLING_TAG,
  TIER_LABEL,
  providerLabel,
  providerTier,
  providerTierTitle,
} from '../lib/store/provider-meta.js'

test('官方通道：deepseek / deepseek-official / deepseek-account', () => {
  assert.equal(providerTier('deepseek'), 'official')
  assert.equal(providerTier('deepseek-official'), 'official')
  assert.equal(providerTier('deepseek-account'), 'official')
  assert.equal(providerTier('DeepSeek-Official'), 'official', '大小写不敏感')
})

test('第三方通道：火山方舟 / 小米 / 智谱 / Kimi / 通义千问…', () => {
  for (const p of [
    'huoshanfangzhou',
    'volcengine',
    'xiaomi',
    'zai',
    'moonshot',
    'kimi',
    'qwen',
    'dashscope',
    'openrouter',
  ]) {
    assert.equal(providerTier(p), 'third-party', `${p} 应判为第三方`)
  }
  // 别把 `deepseekX` 这种畸形 id 也算进官方（与 usage-merge 的 isDeepseekProvider 同口径）
  assert.equal(providerTier('deepseekX'), 'third-party')
})

test('关键一条：第三方平台上的 DeepSeek 模型仍属第三方', () => {
  // 判定只看通道，不看模型名 —— 火山方舟的 deepseek-v4-flash 就是第三方用量，
  // 平台账单里看不到它。
  assert.equal(providerTier('huoshanfangzhou'), 'third-party')
  assert.equal(providerLabel('huoshanfangzhou'), '火山方舟')
})

test('已知通道给中文名，未知通道原样返回（不瞎猜）', () => {
  assert.equal(providerLabel('xiaomi'), '小米')
  assert.equal(providerLabel('zai'), '智谱')
  assert.equal(providerLabel('moonshot'), 'Kimi')
  assert.equal(providerLabel('qwen'), '通义千问')
  assert.equal(providerLabel('deepseek-official'), 'DeepSeek 开放平台')
  assert.equal(providerLabel('some-new-gateway'), 'some-new-gateway')
})

test('tooltip 说明「哪家平台、数据从哪来」', () => {
  assert.match(providerTierTitle('deepseek-account'), /^官方平台：.*账单/)
  assert.match(providerTierTitle('xiaomi'), /^第三方平台：小米/)
  assert.equal(TIER_LABEL.official, '官方')
  assert.equal(TIER_LABEL['third-party'], '第三方')
  assert.equal(OFFICIAL_BILLING_TAG, '官方')
})
