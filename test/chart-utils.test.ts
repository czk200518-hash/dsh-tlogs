/**
 * 图表纯函数单测。
 *
 * 这些换算是图表里唯一会算错的地方 —— 刻度不整、首尾点被裁、单色饼图画不出来、
 * 时间轴不等距。这里逐条钉住，避免「看着像对的」图表悄悄给错数。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_FILL_DAYS,
  autoGrain,
  bucketValues,
  dayBuckets,
  donutSegment,
  hitSpans,
  labelIndices,
  metricValue,
  monthBuckets,
  niceTicks,
  pieSlices,
  pointsOf,
  areaPath,
  linePath,
  projectBuckets,
  resolveGrain,
  shortLabel,
  spanDays,
  toPoints,
  yearBuckets,
} from '../lib/client/chart-utils.js'
import { emptyStat, type Stat } from '../lib/types.js'

/** 造一个 Stat：只关心缓存命中/未命中/输出/请求。 */
function stat(hit: number, miss: number, out: number, req = 0): Stat {
  const s = emptyStat()
  s.PROMPT_CACHE_HIT_TOKEN = hit
  s.PROMPT_CACHE_MISS_TOKEN = miss
  s.RESPONSE_TOKEN = out
  s.REQUEST = req
  return s
}

test('metricValue：六种指标各自取对应的量', () => {
  // 输入 = PROMPT + 命中 + 未命中；本例 PROMPT 恒为 0
  const s = stat(1000, 200, 30, 7)
  assert.equal(metricValue(s, 'total'), 1230)
  assert.equal(metricValue(s, 'input'), 1200)
  assert.equal(metricValue(s, 'output'), 30)
  assert.equal(metricValue(s, 'cacheHit'), 1000)
  assert.equal(metricValue(s, 'cacheMiss'), 200)
  assert.equal(metricValue(s, 'requests'), 7)
})

test('autoGrain：按跨度选粒度（一周按天、一年按月、多年按年）', () => {
  assert.equal(autoGrain('2026-10-01', '2026-10-07'), 'day')
  assert.equal(spanDays('2026-10-01', '2026-10-07'), 7)
  assert.equal(autoGrain('2026-01-01', '2026-12-31'), 'month')
  assert.equal(autoGrain('2020-01-01', '2026-10-07'), 'year')
  // 92 天仍是按天，93 天转按月（阈值边界）
  assert.equal(autoGrain('2026-01-01', '2026-04-02'), 'day')
  assert.equal(autoGrain('2026-01-01', '2026-04-03'), 'month')
  assert.equal(resolveGrain('auto', '2026-10-01', '2026-10-07'), 'day')
  assert.equal(resolveGrain('year', '2026-10-01', '2026-10-07'), 'year')
})

test('shortLabel：天 / 月 / 年各自的轴标签', () => {
  assert.equal(shortLabel('2026-10-07', 'day'), '10-07')
  assert.equal(shortLabel('2026-10', 'month'), '26-10')
  assert.equal(shortLabel('2026', 'year'), '2026')
})

test('dayBuckets：范围内**补齐每一天**，缺的天补 0 并标记 empty', () => {
  const buckets = dayBuckets(
    [
      { date: '2026-10-02', stat: stat(10, 0, 1) },
      { date: '2026-10-05', stat: stat(50, 0, 5) },
      // 范围外的点必须被裁掉
      { date: '2026-09-30', stat: stat(99, 0, 9) },
    ],
    '2026-10-01',
    '2026-10-05',
  )
  assert.deepEqual(
    buckets.map((b) => b.key),
    ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'],
    '时间轴必须等距：否则「中间空了 3 天」会画成相邻两点',
  )
  assert.deepEqual(
    buckets.map((b) => b.empty),
    [true, false, true, true, false],
  )
  assert.equal(metricValue(buckets[1]!.stat, 'total'), 11)
})

test('dayBuckets：跨度超过上限时不再补齐（避免几千个点）', () => {
  const buckets = dayBuckets(
    [{ date: '2026-10-02', stat: stat(10, 0, 1) }],
    '2020-01-01',
    '2026-10-05',
  )
  assert.equal(buckets.length, 1, `跨度 > ${MAX_FILL_DAYS} 天时只画真有数据的天`)
  assert.equal(buckets[0]!.key, '2026-10-02')
})

test('monthBuckets：直接用月度合计（缺逐日明细的月份不能被低估）', () => {
  const buckets = monthBuckets([
    { key: '2026-09', stat: stat(100, 20, 10) },
    { key: '2026-08', stat: stat(200, 40, 20) },
  ])
  // 必须按时间升序，且不依赖 host 下发顺序
  assert.deepEqual(
    buckets.map((b) => b.key),
    ['2026-08', '2026-09'],
  )
  assert.equal(metricValue(buckets[1]!.stat, 'total'), 130)
})

test('yearBuckets：由月度合计按年汇总', () => {
  const buckets = yearBuckets([
    { key: '2025-12', stat: stat(100, 0, 10) },
    { key: '2026-01', stat: stat(200, 0, 20) },
    { key: '2026-02', stat: stat(300, 0, 30) },
  ])
  assert.deepEqual(
    buckets.map((b) => b.key),
    ['2025', '2026'],
  )
  assert.equal(metricValue(buckets[0]!.stat, 'total'), 110)
  assert.equal(metricValue(buckets[1]!.stat, 'total'), 550)
})

test('bucketValues：每期 vs 累计（累计必须带上之前的基线）', () => {
  const buckets = monthBuckets([
    { key: '2026-08', stat: stat(100, 0, 10) },
    { key: '2026-09', stat: stat(200, 0, 20) },
  ])
  assert.deepEqual(bucketValues(buckets, 'total', 'perBucket', 0), [110, 220])
  // prior = 1000：累计曲线必须从 1000 起跳，否则看上去像那 1000 是凭空出现的
  assert.deepEqual(bucketValues(buckets, 'total', 'cumulative', 1000), [1110, 1330])
})

test('niceTicks：刻度吸附到 1/2/5×10^n，且顶端不低于最大值', () => {
  assert.deepEqual(niceTicks(100), [0, 50, 100])
  assert.deepEqual(niceTicks(10), [0, 5, 10])
  const big = niceTicks(8_163_318_072)
  assert.equal(big[0], 0)
  assert.ok(big[big.length - 1]! >= 8_163_318_072, '顶端刻度必须覆盖最大值')
  assert.ok(big[big.length - 1]! <= 8_163_318_072 * 2, '也不该高得离谱')
  // 全 0 时给一个可用的 degenerate 刻度
  assert.deepEqual(niceTicks(0), [0, 1])
})

test('pointsOf / linePath / areaPath：首点贴左、最大值贴顶', () => {
  assert.deepEqual(pointsOf([0, 10], 100, 100, 10), [
    [0, 100],
    [100, 0],
  ])
  assert.equal(linePath([0, 10], 100, 100, 10), 'M0 100 L100 0')
  assert.equal(areaPath([0, 10], 100, 100, 10), 'M0 100 L100 0 L100 100 L0 100 Z')
  // 单点：居中，且不会退化成空路径
  assert.deepEqual(pointsOf([5], 100, 100, 10), [[50, 50]])
  assert.equal(linePath([5], 100, 100, 10), 'M50 50')
  // 空数据不产生路径
  assert.equal(linePath([], 100, 100, 10), '')
  assert.equal(areaPath([], 100, 100, 10), '')
})

test('hitSpans：相邻中点分界，首尾延伸到画布两端（不留无法命中的缝）', () => {
  assert.deepEqual(
    hitSpans(
      [
        [0, 100],
        [100, 0],
      ],
      100,
    ),
    [
      [0, 50],
      [50, 100],
    ],
  )
  // 单点：整幅画布都可命中
  assert.deepEqual(hitSpans([[50, 50]], 100), [[0, 100]])
  assert.deepEqual(hitSpans([], 100), [])
})

test('pieSlices：过滤 0、降序、超出上限合并为「其他」', () => {
  const slices = pieSlices([
    { key: 'a', label: 'a', value: 50 },
    { key: 'b', label: 'b', value: 30 },
    { key: 'c', label: 'c', value: 20 },
  ])
  assert.deepEqual(
    slices.map((s) => s.key),
    ['a', 'b', 'c'],
  )
  assert.equal(slices[0]!.percent, 0.5)

  // 12 项 → 7 项 + 其他（合并项文案由调用方给：渲染路径传 useT() 的结果，
  // 这里显式传中文，让这条用例只考「合并行为」而不受进程语言影响）
  const many = pieSlices(
    Array.from({ length: 12 }, (_, i) => ({ key: `k${i}`, label: `k${i}`, value: 12 - i })),
    8,
    '其他',
  )
  assert.equal(many.length, 8)
  assert.equal(many[many.length - 1]!.label, '其他')
  const sum = many.reduce((s, x) => s + x.percent, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9, `占比之和必须为 1，实际 ${sum}`)

  // 全 0 / 空：没有切片
  assert.deepEqual(pieSlices([]), [])
  assert.deepEqual(pieSlices([{ key: 'z', label: 'z', value: 0 }]), [])
})

test('donutSegment：整圈也能画出来（path 弧线会退化，dasharray 不会）', () => {
  const c = 2 * Math.PI * 60
  const only = donutSegment(100, 100, 60, 0)
  assert.equal(only.circumference, c)
  assert.match(only.dasharray, new RegExp(`^${Math.round(c * 100) / 100} 0$`))
  assert.equal(only.dashoffset, '0')

  const half = donutSegment(50, 100, 60, 50)
  const [len, gap] = half.dasharray.split(' ').map(Number)
  assert.ok(Math.abs(len! - c / 2) < 0.02)
  assert.ok(Math.abs(gap! - c / 2) < 0.02)
  assert.ok(half.dashoffset! < 0, '后半段必须整体旋转到前半段之后')
})

test('projectBuckets：累计直接用快照；每期用相邻快照之差，且不为负', () => {
  const points = [
    { date: '2026-10-01', stat: stat(100, 0, 10, 1) },
    { date: '2026-10-02', stat: stat(150, 0, 12, 2) },
    // 累计值回退（宿主侧会话数据被清理）→ 差值必须钳到 0，不能出现负柱
    { date: '2026-10-03', stat: stat(140, 0, 12, 2) },
  ]

  const cum = projectBuckets(points, undefined, 'cumulative')
  assert.deepEqual(
    cum.map((b) => metricValue(b.stat, 'total')),
    [110, 162, 152],
  )

  const per = projectBuckets(points, undefined, 'perBucket')
  // 首点没有更早的快照 → 退化为「首点自身」（含历史全部增量）
  assert.deepEqual(
    per.map((b) => metricValue(b.stat, 'total')),
    [110, 52, 0],
  )

  // 有基线时首点才是真正的「当天新增」
  const base = projectBuckets(points, stat(60, 0, 0, 0), 'perBucket')
  assert.deepEqual(
    base.map((b) => metricValue(b.stat, 'total')),
    [50, 52, 0],
  )
})

test('labelIndices：标签不挤、不叠，且末尾桶一定有标签', () => {
  // 少于上限：全给
  assert.deepEqual([...labelIndices(3, 7)], [0, 1, 2])

  // 31 个月的逐月轴（默认 7 个标签）
  const m = [...labelIndices(31, 7)]
  assert.ok(m.length <= 7, `标签数不得超过上限，实际 ${m.length}`)
  assert.equal(m[0], 0)
  assert.equal(m[m.length - 1], 30, '最后一个桶必须有标签')
  for (let i = 1; i < m.length; i++) {
    assert.ok(m[i]! - m[i - 1]! >= 3, `相邻标签太近会叠字：${m[i - 1]} / ${m[i]}`)
  }

  // 30 个桶、9 个标签：旧实现在这里会输出 28 与 29 两个挨着的标签
  const b = [...labelIndices(30, 9)]
  assert.ok(b.length <= 9)
  assert.equal(b[b.length - 1], 29)
  for (let i = 1; i < b.length; i++) {
    assert.ok(b[i]! - b[i - 1]! >= 3, `相邻标签太近：${b[i - 1]} / ${b[i]}`)
  }
  assert.ok(
    b[b.length - 1]! - b[b.length - 2]! >= 5,
    `末尾标签必须与前一个拉开距离（否则 26-08 与 26-09 会叠在一起）：${b.join(',')}`,
  )

  assert.deepEqual([...labelIndices(0, 7)], [])
  assert.deepEqual([...labelIndices(1, 7)], [0])
})

test('toPoints：桶与数值一一对应，缺数值按 0 处理', () => {
  const buckets = monthBuckets([{ key: '2026-09', stat: stat(1, 0, 1) }])
  const points = toPoints(buckets, [])
  assert.equal(points.length, 1)
  assert.equal(points[0]!.value, 0)
  assert.equal(points[0]!.full, '2026-09')
})
