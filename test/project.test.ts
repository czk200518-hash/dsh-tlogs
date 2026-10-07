/**
 * 「当前项目消耗」来源的映射口径单测。
 *
 * 这是 P2 卡片的数据正确性护栏：宿主投影给出四个字段，必须按固定公式映射到
 * 平台的五类计量项，且总 Token 恰好等于
 *   uncachedInputTokens + cacheReadTokens + cacheWriteTokens + outputTokens
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readUsageTotals, toStat, unavailable, createProjectProvider, publicProjectId } from '../lib/store/project.js'
import { inputTokens, outputTokens } from '../lib/api/parser.js'
import { emptyStat } from '../lib/types.js'

test('publicProjectId：客户端拿到的项目 id 不是原始绝对路径', () => {
  const cwd = 'D:/work/acme-secret-project'
  const id = publicProjectId(cwd)
  assert.notEqual(id, cwd, '绝不能把完整 cwd 下发到浏览器')
  assert.equal(id.includes('/'), false, 'id 不应含路径分隔符')
  assert.equal(id.includes('acme-secret-project'), false, 'id 不应含路径片段')
  assert.match(id, /^[0-9a-f]{16}$/)

  // 稳定 + 唯一：客户端的「点击切换项目」逻辑依赖这两点
  assert.equal(publicProjectId(cwd), id, '同一路径必须得到同一 id')
  assert.notEqual(publicProjectId('D:/work/other'), id, '不同路径必须得到不同 id')
})

test('readUsageTotals 读取宿主 tokenUsage 四元组', () => {
  const t = readUsageTotals({
    uncachedInputTokens: 11,
    outputTokens: 22,
    cacheReadTokens: 33,
    cacheWriteTokens: 44,
  })
  assert.deepEqual(t, {
    uncachedInputTokens: 11,
    outputTokens: 22,
    cacheReadTokens: 33,
    cacheWriteTokens: 44,
  })
})

test('readUsageTotals 兼容 totals 包裹与缺字段（缺省补 0）', () => {
  const wrapped = readUsageTotals({ totals: { outputTokens: 5 } })
  assert.deepEqual(wrapped, {
    uncachedInputTokens: 0,
    outputTokens: 5,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  })
  // 一个字段都没有 → undefined（调用方据此跳过该会话，而不是记 0 把分母做大）
  assert.equal(readUsageTotals({}), undefined)
  assert.equal(readUsageTotals(null), undefined)
  assert.equal(readUsageTotals(42), undefined)
  assert.equal(readUsageTotals({ outputTokens: 'x' }), undefined)
})

test('toStat：cacheRead 计入缓存命中，uncached + cacheWrite 计入未命中', () => {
  const stat = toStat({
    uncachedInputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 1000,
    cacheWriteTokens: 7,
  })
  assert.equal(stat.PROMPT_CACHE_HIT_TOKEN, 1000)
  assert.equal(stat.PROMPT_CACHE_MISS_TOKEN, 107)
  assert.equal(stat.PROMPT_TOKEN, 0)
  assert.equal(stat.RESPONSE_TOKEN, 50)
  assert.equal(stat.REQUEST, 0, '该来源不提供请求次数')
})

test('总 Token 等于宿主四字段之和（与官方 UI 公式一致）', () => {
  const u = {
    uncachedInputTokens: 1234,
    outputTokens: 567,
    cacheReadTokens: 89_000,
    cacheWriteTokens: 12,
  }
  const stat = toStat(u)
  const total = inputTokens(stat) + outputTokens(stat)
  assert.equal(
    total,
    u.uncachedInputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens,
  )
})

test('降级实现：available=false 且 list 返回空', async () => {
  const p = unavailable()
  assert.equal(p.available(), false)
  assert.deepEqual(await p.list(), [])
})

test('缺少宿主服务时 createProjectProvider 降级而不抛错', async () => {
  for (const ctx of [undefined, {}, { get: () => undefined }, { get: () => { throw new Error('no service') } }]) {
    const p = createProjectProvider(ctx)
    assert.equal(p.available(), false)
    assert.deepEqual(await p.list(), [])
  }
})

test('按 session.header.cwd 分组聚合，并用 workspaceRegistry 的标题做标签', async () => {
  // 两个会话属于项目 A，一个属于项目 B
  const sessions = [
    { header: { cwd: '/proj/a', id: 's1' } },
    { header: { cwd: '/proj/a', id: 's2' } },
    { header: { cwd: '/proj/b', id: 's3' } },
  ]
  const usage: Record<string, unknown> = {
    s1: { uncachedInputTokens: 10, outputTokens: 1, cacheReadTokens: 100, cacheWriteTokens: 0 },
    s2: { uncachedInputTokens: 20, outputTokens: 2, cacheReadTokens: 200, cacheWriteTokens: 0 },
    s3: { uncachedInputTokens: 30, outputTokens: 3, cacheReadTokens: 300, cacheWriteTokens: 0 },
  }

  const ctx = {
    get: (name: string) => {
      switch (name) {
        case 'sessions':
          return { list: () => sessions }
        case 'sessionProjections':
          return {
            stateOf: (session: { header: { id: string } }, key: string) =>
              key === 'tokenUsage' ? usage[session.header.id] : undefined,
          }
        case 'workspaceRegistry':
          return { list: () => [{ path: '/proj/a', title: 'Project A' }] }
        default:
          return undefined
      }
    },
  }

  const p = createProjectProvider(ctx)
  assert.equal(p.available(), true)
  const list = await p.list()

  assert.equal(list.length, 2)
  // 用量降序：A 合计 333 > B 110
  const [a, b] = list
  assert.equal(a!.label, 'Project A', '应使用 workspaceRegistry 的标题')
  assert.equal(a!.stat.PROMPT_CACHE_HIT_TOKEN, 300)
  assert.equal(a!.stat.PROMPT_CACHE_MISS_TOKEN, 30)
  assert.equal(a!.stat.RESPONSE_TOKEN, 3)
  assert.equal(b!.label, 'proj/b', '没有工作区标题时退化为末两级路径')
  assert.equal(b!.stat.PROMPT_CACHE_HIT_TOKEN, 300)
})

test('会话用量读取抛错时整次调用仍安全返回', async () => {
  const ctx = {
    get: (name: string) => {
      if (name === 'sessions') return { list: () => [{ header: { cwd: '/x', id: 's1' } }] }
      if (name === 'sessionProjections') {
        return {
          stateOf: () => {
            throw new Error('projection exploded')
          },
        }
      }
      return undefined
    },
  }
  const p = createProjectProvider(ctx)
  assert.equal(p.available(), true)
  const list = await p.list()
  assert.deepEqual(list, [], '读不到用量时应返回空列表而不是抛错')
})

test('空 Stat 与五类计量项键集合一致（防止字段漂移）', () => {
  assert.deepEqual(Object.keys(emptyStat()).sort(), [
    'PROMPT_CACHE_HIT_TOKEN',
    'PROMPT_CACHE_MISS_TOKEN',
    'PROMPT_TOKEN',
    'REQUEST',
    'RESPONSE_TOKEN',
  ])
})
