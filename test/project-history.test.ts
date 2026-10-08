/**
 * 项目逐日快照存储单测。
 *
 * 这是「指定项目」图表的时间序列来源，必须满足：
 *  - 一天一条、重复记录覆盖（否则同一天会画出多个点）
 *  - 落盘内容**只有哈希 id 与数字**（不含 cwd、不含标签、不含会话内容）
 *  - 坏缓存/非法输入不能让插件起不来
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_POINTS_PER_PROJECT,
  MAX_PROJECTS,
  ProjectHistoryStore,
  isDateKey,
  isProjectId,
} from '../lib/store/project-history.js'
import { emptyStat, type Stat } from '../lib/types.js'

const ID_A = '0123456789abcdef'
const ID_B = 'fedcba9876543210'

function stat(hit: number, out: number): Stat {
  const s = emptyStat()
  s.PROMPT_CACHE_HIT_TOKEN = hit
  s.RESPONSE_TOKEN = out
  return s
}

test('record / points：一天一条，重复记录覆盖', () => {
  const h = new ProjectHistoryStore()
  assert.equal(h.record(ID_A, '2026-10-01', stat(100, 10)), true)
  assert.equal(h.record(ID_A, '2026-10-01', stat(180, 18)), true, '同一天再记应覆盖')
  assert.equal(h.record(ID_A, '2026-10-02', stat(200, 20)), true)

  const points = h.points(ID_A)
  assert.equal(points.length, 2, '同一天只能有一个点')
  assert.deepEqual(
    points.map((p) => p.date),
    ['2026-10-01', '2026-10-02'],
    '必须按日期升序',
  )
  assert.equal(points[0]!.stat.PROMPT_CACHE_HIT_TOKEN, 180, '应保留最后一次观测值')
  assert.equal(h.count(ID_A), 2)
  assert.equal(h.size, 1)
})

test('record：非法 id / 非法日期一律拒绝', () => {
  const h = new ProjectHistoryStore()
  for (const bad of ['', 'XYZ', '0123456789abcde', '0123456789abcdef0', '/abs/path', 'ABC1234567890abc']) {
    assert.equal(h.record(bad, '2026-10-01', stat(1, 0)), false, `应拒绝 id=${bad}`)
  }
  for (const bad of ['', '2026-1-1', '2026-13-01', '2026-02-30', '20261001', '2026-10-1']) {
    assert.equal(h.record(ID_A, bad, stat(1, 0)), false, `应拒绝日期=${bad}`)
  }
  assert.equal(h.size, 0)
  assert.equal(isProjectId(ID_A), true)
  assert.equal(isProjectId('nope'), false)
  assert.equal(isDateKey('2026-10-07'), true)
  assert.equal(isDateKey('2026-02-30'), false)
})

test('pointsBetween / lastBefore：范围与基线查询', () => {
  const h = new ProjectHistoryStore()
  for (const d of ['2026-09-28', '2026-09-30', '2026-10-01', '2026-10-05']) {
    h.record(ID_A, d, stat(10, 1))
  }
  assert.deepEqual(
    h.pointsBetween(ID_A, '2026-09-30', '2026-10-02').map((p) => p.date),
    ['2026-09-30', '2026-10-01'],
    '闭区间',
  )
  assert.equal(h.lastBefore(ID_A, '2026-10-01')?.date, '2026-09-30')
  assert.equal(h.lastBefore(ID_A, '2026-09-01'), undefined, '没有更早的快照时返回 undefined')
  assert.deepEqual(h.points('nope'), [])
})

test('serialize：只落盘哈希 id 与数字（不含标签/cwd）', () => {
  const h = new ProjectHistoryStore()
  h.record(ID_A, '2026-10-01', stat(100, 10))
  const text = JSON.stringify(h.serialize())
  assert.ok(text.includes(ID_A))
  assert.equal(text.includes('cwd'), false)
  assert.equal(text.includes('label'), false, '标签可能含目录名，不能落盘')
  assert.equal(/\//.test(text), false, '不该出现任何路径分隔符')
})

test('load：往返恢复，且坏数据静默跳过', () => {
  const src = new ProjectHistoryStore()
  src.record(ID_A, '2026-10-01', stat(100, 10))
  src.record(ID_B, '2026-09-30', stat(7, 1))

  const restored = new ProjectHistoryStore()
  assert.equal(restored.load(src.serialize()), 2)
  assert.deepEqual(restored.points(ID_A), src.points(ID_A))
  assert.deepEqual(restored.points(ID_B), src.points(ID_B))

  // 各种坏输入
  const bad = new ProjectHistoryStore()
  assert.equal(bad.load(undefined), 0)
  assert.equal(bad.load(null), 0)
  assert.equal(bad.load('x'), 0)
  assert.equal(bad.load({}), 0)
  assert.equal(bad.load({ projects: 'nope' }), 0)
  assert.equal(
    bad.load({
      projects: [
        null,
        { id: 'bad', points: [] },
        { id: ID_A, points: 'nope' },
        // 每一条都缺腿：null / 非字符串日期 / 没有 stat / stat 全 0
        { id: ID_A, points: [null, { date: 5 }, { date: '2026-10-01' }, { date: '2026-10-02', stat: {} }] },
      ],
    }),
    0,
    '没有任何一条可用的快照 → 不算恢复出项目',
  )
  assert.deepEqual(bad.points(ID_A), [])

  // 同一份数据里混入一条合法的，只恢复项目本身（逐条校验）
  const mixed = new ProjectHistoryStore()
  assert.equal(
    mixed.load({
      projects: [
        {
          id: ID_A,
          points: [null, { date: '2026-10-01' }, { date: '2026-10-02', stat: stat(9, 1) }],
        },
      ],
    }),
    1,
  )
  assert.deepEqual(
    mixed.points(ID_A).map((p) => p.date),
    ['2026-10-02'],
  )
})

test('保留上限：超出后丢弃最旧的快照', () => {
  const h = new ProjectHistoryStore()
  // 造出超过上限的天数（用连续日期）
  const start = Date.UTC(2020, 0, 1)
  const total = MAX_POINTS_PER_PROJECT + 10
  for (let i = 0; i < total; i++) {
    const d = new Date(start + i * 86_400_000)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`
    h.record(ID_A, key, stat(i, 1))
  }
  assert.equal(h.count(ID_A), MAX_POINTS_PER_PROJECT)
  const points = h.points(ID_A)
  assert.equal(points[0]!.date, '2020-01-11', '应丢掉最早的 10 条')
  assert.equal(points[points.length - 1]!.date, '2024-02-18')
})

test('项目数量上限：超出后拒绝新项目，而不是丢掉已有历史', () => {
  const h = new ProjectHistoryStore()
  const idOf = (i: number): string => i.toString(16).padStart(16, '0')
  for (let i = 0; i < MAX_PROJECTS; i++) {
    assert.equal(h.record(idOf(i), '2026-10-01', stat(i, 1)), true)
  }
  assert.equal(h.record(idOf(MAX_PROJECTS), '2026-10-01', stat(1, 1)), false)
  assert.equal(h.size, MAX_PROJECTS)
  assert.equal(h.count(idOf(0)), 1, '已有的历史不能被淘汰')
})

test('dailyTotals：同一天把所有项目相加', () => {
  const h = new ProjectHistoryStore()
  h.record(ID_A, '2026-10-01', stat(100, 10))
  h.record(ID_B, '2026-10-01', stat(200, 20))
  h.record(ID_A, '2026-10-02', stat(150, 15))
  const totals = h.dailyTotals()
  assert.deepEqual(
    totals.map((t) => t.date),
    ['2026-10-01', '2026-10-02'],
  )
  assert.equal(totals[0]!.stat.PROMPT_CACHE_HIT_TOKEN, 300)
  assert.equal(totals[1]!.stat.PROMPT_CACHE_HIT_TOKEN, 150)
})

test('clear：清空（退出登录时调用）', () => {
  const h = new ProjectHistoryStore()
  h.record(ID_A, '2026-10-01', stat(1, 1))
  h.clear()
  assert.equal(h.size, 0)
  assert.deepEqual(h.points(ID_A), [])
})
