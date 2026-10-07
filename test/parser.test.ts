/**
 * 解析层单测 —— 逐条锁定 `deepseek_python_20261007_a1f087.py` 的语义。
 *
 * 这些用例的目的不是「测试实现」，而是把参考脚本里那些容易翻译错的细节
 * （字符串 amount、向零截断、未知 type、非字典条目、全 0 模型仍建键）
 * 固定成可执行契约，防止后续重构悄悄改变口径。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  addInto,
  inputTokens,
  isNonEmpty,
  mergeStats,
  outputTokens,
  parseBizData,
  parseDays,
  sumStats,
  toAmount,
  toScopeStat,
} from '../lib/api/parser.js'
import { TOKEN_TYPES, emptyStat, isTokenType } from '../lib/types.js'

test('TOKEN_TYPES 的五项与参考脚本顺序一致', () => {
  assert.deepEqual([...TOKEN_TYPES], [
    'PROMPT_TOKEN',
    'PROMPT_CACHE_HIT_TOKEN',
    'PROMPT_CACHE_MISS_TOKEN',
    'RESPONSE_TOKEN',
    'REQUEST',
  ])
})

test('emptyStat 返回五项全 0 且每次都是新对象', () => {
  const a = emptyStat()
  assert.deepEqual(Object.keys(a).sort(), [...TOKEN_TYPES].sort())
  assert.equal(a.PROMPT_TOKEN, 0)
  const b = emptyStat()
  b.REQUEST = 5
  assert.equal(a.REQUEST, 0, 'emptyStat 必须返回新对象，不能共享引用')
})

test('isTokenType 等价于 Python 的 `t in agg`', () => {
  assert.equal(isTokenType('PROMPT_TOKEN'), true)
  assert.equal(isTokenType('REQUEST'), true)
  assert.equal(isTokenType('BOGUS'), false)
  assert.equal(isTokenType(undefined), false)
  assert.equal(isTokenType(3), false)
})

test('toAmount 等价于 int(float(u.get("amount") or 0))，异常归 0', () => {
  // 正常整数字符串
  assert.equal(toAmount('0'), 0)
  assert.equal(toAmount('165304064'), 165304064)
  assert.equal(toAmount(42), 42)

  // int(float(x)) 是**向零截断**，不是四舍五入
  assert.equal(toAmount('12.9'), 12)
  assert.equal(toAmount('-3.7'), -3)
  assert.equal(toAmount('1e3'), 1000)

  // `or 0` 语义：空串 / null / undefined / false 都变 0
  assert.equal(toAmount(''), 0)
  assert.equal(toAmount(null), 0)
  assert.equal(toAmount(undefined), 0)
  assert.equal(toAmount(false), 0)

  // except (ValueError, TypeError) → 0
  assert.equal(toAmount('abc'), 0)
  assert.equal(toAmount({}), 0)

  // 非有限数：Python 会抛 OverflowError（脚本会崩），这里防御性归 0
  assert.equal(toAmount('Infinity'), 0)
  assert.equal(toAmount(NaN), 0)
})

test('input_tokens / output_tokens 口径：缓存命中与未命中都算输入', () => {
  const stat = emptyStat()
  stat.PROMPT_TOKEN = 1
  stat.PROMPT_CACHE_HIT_TOKEN = 165304064
  stat.PROMPT_CACHE_MISS_TOKEN = 2662452
  stat.RESPONSE_TOKEN = 399575
  stat.REQUEST = 533

  assert.equal(inputTokens(stat), 1 + 165304064 + 2662452)
  assert.equal(outputTokens(stat), 399575)
})

test('toScopeStat：总 Token = 输入 + 输出，请求次数取 REQUEST', () => {
  const stat = emptyStat()
  stat.PROMPT_CACHE_HIT_TOKEN = 100
  stat.RESPONSE_TOKEN = 30
  stat.REQUEST = 2
  const s = toScopeStat(stat)
  assert.equal(s.inputTokens, 100)
  assert.equal(s.outputTokens, 30)
  assert.equal(s.totalTokens, 130)
  assert.equal(s.requests, 2)
})

test('isNonEmpty 等价于 Python 汇总区的零用量过滤', () => {
  assert.equal(isNonEmpty(toScopeStat(emptyStat())), false)
  const onlyRequests = emptyStat()
  onlyRequests.REQUEST = 3
  assert.equal(isNonEmpty(toScopeStat(onlyRequests)), true)
})

test('parseBizData 累加五类计量项，并保留全 0 模型键', () => {
  const { agg, models } = parseBizData({
    total: [
      {
        model: 'deepseek-flash',
        usage: [
          { type: 'PROMPT_TOKEN', amount: '0' },
          { type: 'PROMPT_CACHE_HIT_TOKEN', amount: '165304064' },
          { type: 'PROMPT_CACHE_MISS_TOKEN', amount: '2662452' },
          { type: 'RESPONSE_TOKEN', amount: '399575' },
          { type: 'REQUEST', amount: '533' },
        ],
      },
      {
        // 实测接口会返回全 0 模型：必须仍然建立键（与 setdefault 一致）
        model: 'deepseek-v4-pro',
        usage: [
          { type: 'PROMPT_TOKEN', amount: '0' },
          { type: 'RESPONSE_TOKEN', amount: '0' },
        ],
      },
    ],
  })

  assert.equal(agg.PROMPT_CACHE_HIT_TOKEN, 165304064)
  assert.equal(agg.PROMPT_CACHE_MISS_TOKEN, 2662452)
  assert.equal(agg.RESPONSE_TOKEN, 399575)
  assert.equal(agg.REQUEST, 533)
  assert.equal(inputTokens(agg), 165304064 + 2662452)

  assert.deepEqual(Object.keys(models).sort(), ['deepseek-flash', 'deepseek-v4-pro'])
  assert.equal(models['deepseek-v4-pro']!.RESPONSE_TOKEN, 0)
})

test('parseBizData：未知 type 既不进 agg 也不进 models', () => {
  const { agg, models } = parseBizData({
    total: [{ model: 'm', usage: [{ type: 'NOT_A_TYPE', amount: '999' }, { type: 'REQUEST', amount: '1' }] }],
  })
  assert.equal(agg.REQUEST, 1)
  assert.equal(Object.values(agg).reduce((a, b) => a + b, 0), 1)
  assert.equal(models['m']!.REQUEST, 1)
})

test('parseBizData：模型名为空/缺失时归入 unknown', () => {
  const r1 = parseBizData({ total: [{ usage: [{ type: 'REQUEST', amount: '2' }] }] })
  assert.equal(r1.models['unknown']!.REQUEST, 2)
  const r2 = parseBizData({ total: [{ model: '', usage: [{ type: 'REQUEST', amount: '3' }] }] })
  assert.equal(r2.models['unknown']!.REQUEST, 3)
})

test('parseBizData：非字典条目整条跳过（等价 isinstance(item, dict)）', () => {
  const { agg, models } = parseBizData({
    total: [
      null,
      'not-an-object',
      123,
      ['array'],
      { model: 'ok', usage: [{ type: 'REQUEST', amount: '4' }] },
    ] as never,
  })
  assert.equal(agg.REQUEST, 4)
  assert.deepEqual(Object.keys(models), ['ok'])
})

test('parseBizData：usage 里的非字典项跳过', () => {
  const { agg } = parseBizData({
    total: [{ model: 'm', usage: [null, 'x', 7, { type: 'REQUEST', amount: '9' }] as never }],
  })
  assert.equal(agg.REQUEST, 9)
})

test('parseBizData：模型存在但 usage 缺失/为空时仍建立全 0 键', () => {
  const a = parseBizData({ total: [{ model: 'empty' }] })
  assert.deepEqual(a.models['empty'], emptyStat())
  const b = parseBizData({ total: [{ model: 'nullusage', usage: null }] })
  assert.deepEqual(b.models['nullusage'], emptyStat())
})

test('parseBizData：bizData 为 null/undefined/缺 total 都安全返回空结果', () => {
  for (const input of [null, undefined, {}, { total: null }, { total: [] }]) {
    const { agg, models } = parseBizData(input as never)
    assert.deepEqual(agg, emptyStat())
    assert.deepEqual(models, {})
  }
})

test('parseBizData：同一模型跨多个条目累加（不覆盖）', () => {
  const { models } = parseBizData({
    total: [
      { model: 'm', usage: [{ type: 'REQUEST', amount: '1' }] },
      { model: 'm', usage: [{ type: 'REQUEST', amount: '2' }] },
    ],
  })
  assert.equal(models['m']!.REQUEST, 3)
})

test('parseDays：按天解析，结构与 total 一致，跳过无日期项', () => {
  const days = parseDays({
    days: [
      { date: '2026-10-01', data: [{ model: 'm', usage: [{ type: 'REQUEST', amount: '5' }] }] },
      { date: null, data: [{ model: 'm', usage: [{ type: 'REQUEST', amount: '99' }] }] },
      { data: [{ model: 'm', usage: [{ type: 'REQUEST', amount: '99' }] }] },
      { date: '2026-10-03', data: [] },
    ] as never,
  })
  assert.deepEqual(days.map((d) => d.date), ['2026-10-01', '2026-10-03'])
  assert.equal(days[0]!.stat.REQUEST, 5)
  assert.equal(days[1]!.stat.REQUEST, 0)
})

test('addInto / mergeStats / sumStats 不修改入参以外的对象', () => {
  const a = emptyStat()
  a.REQUEST = 1
  const b = emptyStat()
  b.REQUEST = 2
  const merged = mergeStats(a, b)
  assert.equal(merged.REQUEST, 3)
  assert.equal(a.REQUEST, 1, 'mergeStats 不应修改入参')

  const target = emptyStat()
  addInto(target, merged)
  assert.equal(target.REQUEST, 3)

  assert.equal(sumStats([a, b, merged]).REQUEST, 6)
})
