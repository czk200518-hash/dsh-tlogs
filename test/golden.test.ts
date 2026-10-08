/**
 * 对拍测试（交付要求 6）：数据层与工作区权威 Python 脚本逐字段一致。
 *
 * 做法：把真实接口响应存成夹具，然后
 *   A 侧 —— 用 **真正的** `deepseek_python_20261007_a1f087.py`（当模块加载，
 *           调用其 parse_biz_data / input_tokens / output_tokens）
 *   B 侧 —— 用本插件的 lib/api/parser.js
 * 两侧分别解析同一份夹具，再深度比较全部五类计量项、按模型明细、输入/输出/总计。
 *
 * 夹具是**合成数据**，由 `scripts/make-synthetic-fixtures.mjs` 确定性生成（可复现）。
 * 形态刻意与真实接口一致（双层错误码、total/days 同构、amount 为字符串、
 * sum(days)==total、含全 0 模型），但**不含任何真实账号数据** —— 早前那版是从真实
 * 响应缩放而来，会保留模型清单与逐日活跃形态，已替换。
 *
 * 测试本身不发任何网络请求。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { addInto, inputTokens, outputTokens, parseBizData, parseDays } from '../lib/api/parser.js'
import { emptyStat, TOKEN_TYPES, type BizData } from '../lib/types.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const fixtureDir = join(here, 'fixtures')
/**
 * 权威参考脚本（`deepseek_python_*.py`）。
 *
 * 它是**外部输入且已 gitignore**（第 24 行把真实 USER_TOKEN 明文写死），所以新克隆的
 * 仓库里**不会有它** —— 依赖它的测试必须优雅跳过，否则 `npm test` 在别人机器上必然
 * 失败。名字也做成动态查找，避免写死某个具体文件名。
 *
 * 优先读环境变量 `TLOGS_REFERENCE_SCRIPT`：这样可以在**不把带令牌的文件放回仓库**的
 * 前提下跑对拍（例如指向桌面上的那一份）。
 */
function findReferenceScript(): string | undefined {
  const fromEnv = process.env.TLOGS_REFERENCE_SCRIPT
  if (fromEnv && fromEnv.trim().length > 0) {
    const p = fromEnv.trim()
    return existsSync(p) ? p : undefined
  }
  try {
    const hit = readdirSync(root)
      .filter((f) => /^deepseek_python_.*\.py$/.test(f))
      .sort()
    return hit.length > 0 ? join(root, hit[hit.length - 1]!) : undefined
  } catch {
    return undefined
  }
}
const referenceScript = findReferenceScript()
const referenceRunner = join(fixtureDir, 'parse_reference.py')

/** 找出 Python 解释器。找不到就跳过（并明确报告跳过原因）。 */
function findPython(): string | undefined {
  for (const candidate of ['python', 'python3', 'py']) {
    const r = spawnSync(candidate, ['--version'], { encoding: 'utf8' })
    if (r.status === 0) return candidate
  }
  return undefined
}

const python = findPython()
const fixtures = existsSync(fixtureDir)
  ? readdirSync(fixtureDir)
      .filter((f) => /^usage-\d{4}-\d{2}\.json$/.test(f))
      .sort()
  : []

test('前置条件：权威 Python 脚本与夹具齐备', (t) => {
  if (!referenceScript) {
    t.skip(
      '未找到权威参考脚本 deepseek_python_*.py —— 它是 gitignore 的外部输入，' +
        '新克隆的仓库里不会有它，因此对拍无法运行；数据层单测与结构测试照常运行。',
    )
    return
  }
  assert.ok(fixtures.length > 0, '缺少 test/fixtures/usage-YYYY-MM.json 夹具')
})

test('对拍：本插件 parser 与 Python 参考实现逐字段一致', (t) => {
  if (!python) {
    t.skip('未找到 Python 解释器，跳过对拍（数据层单测仍会运行）')
    return
  }
  if (!referenceScript) {
    t.skip('未找到权威参考脚本 deepseek_python_*.py，跳过对拍')
    return
  }

  const fixturePaths = fixtures.map((f) => join(fixtureDir, f))
  const r = spawnSync(python, [referenceRunner, referenceScript, ...fixturePaths], {
    encoding: 'utf8',
    cwd: root,
    env: {
      ...process.env,
      // 参考脚本第 24 行把 token 明文写在源码里；Python 生成的 .pyc 会把该字面量
      // 一起编码进去。禁止写字节码，避免在工作区留下含 token 的缓存文件。
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONIOENCODING: 'utf-8',
    },
  })

  assert.equal(
    r.status,
    0,
    `Python 参考侧执行失败：\nstdout=${r.stdout}\nstderr=${r.stderr}`,
  )

  const reference = JSON.parse(r.stdout) as Array<{
    file: string
    agg: Record<string, number>
    models: Record<string, Record<string, number>>
    input: number
    output: number
    total: number
  }>

  assert.equal(reference.length, fixtures.length, 'Python 侧返回的夹具数量不匹配')

  for (let i = 0; i < fixtures.length; i++) {
    const file = fixtures[i]!
    const expected = reference.find((x) => x.file === file)
    assert.ok(expected, `Python 侧缺少 ${file} 的结果`)

    const payload = JSON.parse(readFileSync(join(fixtureDir, file), 'utf8')) as {
      code: number
      data: { biz_code: number; biz_data: BizData }
    }

    // 双层错误码都要检查，与参考脚本 main() 的用法一致。
    assert.equal(payload.code, 0, `${file}: 外层 code 应为 0`)
    assert.equal(payload.data.biz_code, 0, `${file}: biz_code 应为 0`)

    const { agg, models } = parseBizData(payload.data.biz_data)

    // ---- ① 五类计量项：逐字段严格相等 ----
    for (const type of TOKEN_TYPES) {
      assert.equal(agg[type], expected.agg[type], `${file}: agg.${type} 与 Python 不一致`)
    }
    assert.deepEqual(
      Object.keys(agg).sort(),
      [...TOKEN_TYPES].sort(),
      `${file}: agg 的键集合应恰好是五种计量项`,
    )

    // ---- ② 派生口径：输入 / 输出 / 总计 ----
    assert.equal(inputTokens(agg), expected.input, `${file}: 输入合计与 Python 不一致`)
    assert.equal(outputTokens(agg), expected.output, `${file}: 输出合计与 Python 不一致`)
    assert.equal(inputTokens(agg) + outputTokens(agg), expected.total, `${file}: 总 Token 与 Python 不一致`)

    // ---- ③ 按模型明细：模型集合与每项计数都相等 ----
    assert.deepEqual(
      Object.keys(models).sort(),
      Object.keys(expected.models).sort(),
      `${file}: 模型集合与 Python 不一致`,
    )
    for (const [model, stat] of Object.entries(models)) {
      const want = expected.models[model]!
      for (const type of TOKEN_TYPES) {
        assert.equal(stat[type], want[type], `${file}: models[${model}].${type} 与 Python 不一致`)
      }
    }
  }

  // 夹具必须真的含有非零数据，否则「一致」没有意义。
  const grand = fixtures.reduce((acc, file) => {
    const payload = JSON.parse(readFileSync(join(fixtureDir, file), 'utf8')) as {
      data: { biz_data: BizData }
    }
    const { agg } = parseBizData(payload.data.biz_data)
    return acc + inputTokens(agg) + outputTokens(agg)
  }, 0)
  assert.ok(grand > 0, '夹具总 Token 为 0，对拍无法证明任何事')
})

test('对拍夹具本身满足接口结构约定（total 与 days 同构）', () => {
  assert.ok(fixtures.length > 0)
  for (const file of fixtures) {
    const payload = JSON.parse(readFileSync(join(fixtureDir, file), 'utf8')) as {
      data: { biz_data: { total?: unknown[]; days?: Array<{ date: string; data: unknown[] }> } }
    }
    const bd = payload.data.biz_data
    assert.ok(Array.isArray(bd.total), `${file}: total 应为数组`)
    assert.ok(Array.isArray(bd.days), `${file}: days 应为数组`)
    assert.ok((bd.days?.length ?? 0) >= 28, `${file}: days 应覆盖整月（实测接口返回完整月份）`)
    for (const day of bd.days ?? []) {
      assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/, `${file}: days[].date 格式应为 YYYY-MM-DD`)
      assert.ok(Array.isArray(day.data), `${file}: days[].data 应为数组`)
    }
  }
})

test('对拍夹具保持了真实数据的不变量：逐日之和 == 月总计、amount 是字符串、含全 0 模型', () => {
  assert.ok(fixtures.length > 0)

  for (const file of fixtures) {
    const payload = JSON.parse(readFileSync(join(fixtureDir, file), 'utf8')) as {
      data: { biz_data: BizData }
    }
    const bd = payload.data.biz_data

    // ① 逐日之和必须等于月总计 —— 真实接口满足该恒等式，
    //    匿名化脚本用「整因子同倍放大」保证它不被破坏。
    const { agg: totalAgg, models } = parseBizData(bd)
    const daysAgg = emptyStat()
    for (const day of parseDays(bd)) addInto(daysAgg, day.stat)
    for (const type of TOKEN_TYPES) {
      assert.equal(
        daysAgg[type],
        totalAgg[type],
        `${file}: sum(days[].data) 应等于 total（${type}）`,
      )
    }

    // ② amount 必须是字符串 —— 这是最容易翻译错的细节
    for (const item of bd.total ?? []) {
      for (const u of item.usage ?? []) {
        assert.equal(typeof u.amount, 'string', `${file}: amount 应为字符串`)
      }
    }

    // ③ 必须含全 0 模型 —— 实测接口会返回一批，用来验证「仍要建键」
    const zeroModels = (bd.total ?? []).filter(
      (m) => !(m.usage ?? []).some((u) => Number(u.amount) > 0),
    )
    assert.ok(
      zeroModels.length > 0,
      `${file}: 夹具应包含全 0 模型（真实接口的形态之一）`,
    )

    // ④ 模型集合非空，且至少有一个模型真的有用量
    assert.ok(Object.keys(models).length > 0, `${file}: 应有模型条目`)
    assert.ok(
      inputTokens(totalAgg) + outputTokens(totalAgg) > 0,
      `${file}: 至少一个模型应有非零用量`,
    )
  }
})

test('入仓夹具是**合成数据**：不含任何真实账号数据', () => {
  // 早前入仓的夹具是从真实账号响应按整数因子缩放而来 —— 绝对数值虽然被混淆，
  // 但「用了哪些模型」和「哪些天活跃」被完整保留，那是账号持有人的节奏指纹。
  // 现在改为 scripts/make-synthetic-fixtures.mjs 确定性生成的纯合成数据。
  for (const file of fixtures) {
    const payload = JSON.parse(readFileSync(join(fixtureDir, file), 'utf8')) as {
      _synthetic?: unknown
      data: { biz_data: BizData }
    }
    assert.equal(payload._synthetic, true, `${file}: 必须显式标记为合成数据（_synthetic: true）`)

    // 合成不等于可以空：非零用量是解析测试有意义的前提
    const { agg } = parseBizData(payload.data.biz_data)
    assert.ok(agg.REQUEST > 0, `${file}: 合成夹具仍需含非零用量`)
    assert.ok(inputTokens(agg) + outputTokens(agg) > 0, `${file}: 合成夹具仍需含非零 token`)
  }
})

test('空 Stat 与 Python empty_stat() 的键集合一致', () => {
  assert.deepEqual(Object.keys(emptyStat()).sort(), [...TOKEN_TYPES].sort())
})
