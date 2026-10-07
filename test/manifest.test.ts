/**
 * 声明与模板的一致性测试。
 *
 * 这一类错误在运行时**不会报错**，只会静默降级（用默认值），所以必须靠测试守住：
 *  - `cordis.patch.yml` 里的 config 键写错 → schemastery 校验失败或回落到默认值
 *  - 模板里的 `id` / `name` 与 package.json 不一致 → Loader 找不到包
 *  - `dsh.client` 声明漏了必需字段 → 浏览器半不会装载
 *  - 客户端 bundle 注册的 id 与包名不一致 → DSH 报 "loaded without registering <id>"
 *
 * 这里刻意把 package.json / cordis.patch.yml / 构建产物三者放在一起交叉校验。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

import { Config } from '../lib/index.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string
  version: string
  main: string
  exports: Record<string, string>
  peerDependencies: Record<string, string>
  dsh: { bundle: { patch: string }; client: { platform: string; inject: string[] } }
}

/** 读取并解析 bundle patch（顶层 YAML 数组）。 */
function readPatch(): Array<Record<string, unknown>> {
  const text = readFileSync(join(root, pkg.dsh.bundle.patch), 'utf8')
  const doc = parseYaml(text)
  assert.ok(Array.isArray(doc), 'cordis.patch.yml 顶层必须是数组（与官方 bundle patch 格式一致）')
  return doc as Array<Record<string, unknown>>
}

/** 取出我们这一行 patch（含 config）。 */
function ourPatchRow(): { id: string; name: string; config: Record<string, unknown> } {
  const doc = readPatch()
  for (const entry of doc) {
    const insert = entry.insert
    if (!Array.isArray(insert)) continue
    for (const row of insert as Array<Record<string, unknown>>) {
      if (row && typeof row === 'object' && typeof row.name === 'string') {
        return row as { id: string; name: string; config: Record<string, unknown> }
      }
    }
  }
  throw new Error('cordis.patch.yml 里没有找到 insert 行')
}

test('package.json 的双端入口与 dsh 声明齐备', () => {
  assert.equal(pkg.name, 'dsh-tlogs')
  const strip = (p: string) => p.replace(/^\.\//, '')
  assert.equal(
    strip(pkg.exports['.']!),
    strip(pkg.main),
    'main 与 exports["."] 必须指向同一入口（允许 ./ 前缀差异）',
  )
  assert.equal(pkg.exports['./client'], './lib/client.js')
  assert.equal(pkg.dsh.client.platform, 'web', '只有 platform=web 才会装载浏览器半')
  assert.deepEqual(pkg.dsh.client.inject, [
    '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-client-ui-slots',
  ])
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
})

test('cordis.patch.yml 的 patch 行与 package.json 一致', () => {
  const row = ourPatchRow()
  assert.equal(row.id, 'tlogs', 'Loader 行 id 是客户端 configForms 与诊断用的稳定标识')
  assert.equal(row.name, pkg.name, 'name 必须是被安装的包名，否则 Loader 解析不到')
})

test('cordis.patch.yml 的 config 键全部是 Config schema 声明的键（防止静默回落默认值）', () => {
  const row = ourPatchRow()
  const cfg = row.config ?? {}
  // schemastery 把对象字段表挂在 `dict` 上（不是 Object.keys —— 那是 type/meta/toString/dict）。
  const dictKeys = Object.keys((Config as unknown as { dict?: Record<string, unknown> }).dict ?? {})
  assert.ok(dictKeys.length > 0, '应能从 Config.dict 读出字段表')
  const declared = new Set(dictKeys)

  assert.ok(Object.keys(cfg).length > 0, '模板应当把可配置项都列出来')
  for (const key of Object.keys(cfg)) {
    assert.ok(declared.has(key), `cordis.patch.yml 里的 "${key}" 不是 Config 声明的键（会静默失效）`)
  }

  // 反向检查：schema 里的每个键都应在模板里出现，否则用户不知道能配什么
  for (const key of declared) {
    assert.ok(key in cfg, `Config 声明了 "${key}"，但 cordis.patch.yml 模板里没有列出`)
  }
})

test('模板里的每个 config 值都能被 schemastery 校验通过', () => {
  const row = ourPatchRow()
  // schemastery schema 直接调用即校验并补默认值；非法枚举/类型会抛错
  const validate = Config as unknown as (v: unknown) => Record<string, unknown>
  const validated = validate(row.config)
  assert.equal(validated.startYear, 2024)
  assert.equal(validated.startMonth, 4)
  assert.equal(validated.requestIntervalMs, 1000)
  assert.deepEqual(validated.cacheTTL, { total: 1800, current: 300 })
  assert.equal(validated.numberFormat, 'short')
  assert.deepEqual(validated.compactMetrics, ['total', 'today'])

  // 反向对照：证明上面的「通过」不是空转 —— 同一 schema 必须拒绝非法枚举。
  assert.throws(() => validate({ ...row.config, numberFormat: 'nope' }))
  assert.throws(() => validate({ ...row.config, compactMetrics: ['bogus'] }))
  // 并且确实会使用模板里的值（而不是无脑返回默认值）
  assert.equal(validate({ ...row.config, startYear: 2025 }).startYear, 2025)
  assert.equal(validate({ ...row.config, numberFormat: 'full' }).numberFormat, 'full')
})

test('客户端 bundle 注册的 id 必须等于包名（DSH 会据此匹配 module row）', () => {
  const bundle = readFileSync(join(root, pkg.exports['./client']), 'utf8')
  const m = /__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/.exec(bundle)
  assert.ok(m, 'bundle 必须以 window.__ModuleLoader__.load({ id, factory }) 注册')
  assert.equal(m[1], pkg.name, `bundle id "${m?.[1]}" 必须等于包名 "${pkg.name}"`)
})

test('构建产物存在且被 package.json 的 files 覆盖（DSH 只消费已构建产物）', () => {
  const files = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { files: string[] }).files
  for (const required of ['lib', 'cordis.patch.yml']) {
    assert.ok(files.includes(required), `package.json files 应包含 "${required}"，否则发布后插件不可用`)
  }
})

// ---------------------------------------------------------------- 插件事务（plugin-manager）

test('peerDependencies 不含任何 @deepseek-ai/dsh* —— 插件事务的兼容性检查会直接通过', () => {
  const peers = Object.keys(pkg.peerDependencies ?? {})
  // dsh-app-boot 的 evaluatePluginCompatibility 只评估 DSH 自己的 peer：
  //   for (const [name, range] of Object.entries(peerDependencies))
  //     if (name !== '@deepseek-ai/dsh' && !name.startsWith('@deepseek-ai/dsh-')) continue;
  //   if (Object.keys(peers).length === 0) return undefined;   // 无 DSH peer → 直接放过
  // 因此这里“没有 DSH peer”就是通过门禁的充分条件，不需要任何版本豁免。
  const dshPeers = peers.filter((n) => n === '@deepseek-ai/dsh' || n.startsWith('@deepseek-ai/dsh-'))
  assert.deepEqual(
    dshPeers,
    [],
    '一旦声明 @deepseek-ai/dsh* peer，安装时会被兼容性门禁拦截（除非申请版本豁免）',
  )
  // react 是平台种子表里提供的运行时，不是 DSH peer，因此不参与门禁
  assert.ok(peers.includes('react'), 'react 应保留为 peer（由宿主种子表提供）')
})

test('包名与版本满足插件事务的 registry spec 规则', () => {
  // dsh-plugin-manager 的 PACKAGE_NAME 正则
  const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/
  assert.match(pkg.name, PACKAGE_NAME, `"${pkg.name}" 不是事务接受的包名形态`)
  assert.ok(pkg.name.length <= 214, '包名不得超过 214 字符')
  // 兼容性判定与 bundle meta 都需要 name@version 身份
  assert.match(pkg.version, /^\d+\.\d+\.\d+/, 'version 必须是可解析的 semver（门禁按 name@version 记录）')
})

test('声明为「组合包」（bundle）：有 dsh.bundle.patch 且 patch 是合法 YAML 数组', () => {
  // dsh-plugin-manager 对「被选中但没有 bundle patch」的依赖会报 not-bundle
  assert.equal(typeof pkg.dsh?.bundle?.patch, 'string', '必须声明 dsh.bundle.patch，否则不是组合包')
  const doc = readPatch()
  assert.ok(doc.length > 0, 'patch 必须至少有一条 insert')
  assert.ok(
    doc.some((e) => Array.isArray(e.insert)),
    'patch 必须包含 insert 条目（loader 的插入语法）',
  )
})

test('本地路径安装所需条件：产物已构建、无 install 期脚本依赖', () => {
  // 插件事务允许「绝对路径 / tarball」安装（parseInstallSpec 的 path / tarball 两类）。
  // 这类安装直接读取本地 package.json 并交给 pnpm，因此**产物必须已经构建好**，
  // 且不能依赖 prepare/postinstall 之类的安装期脚本去生成 lib/。
  assert.ok(existsSync(join(root, 'lib/index.js')), 'lib/index.js 必须随仓库提交')
  assert.ok(existsSync(join(root, 'lib/client.js')), 'lib/client.js 必须随仓库提交')
  const scripts = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts
  for (const banned of ['prepare', 'postinstall', 'preinstall']) {
    assert.equal(scripts[banned], undefined, `不应依赖 ${banned}：本地路径安装时不会执行构建`)
  }
})
