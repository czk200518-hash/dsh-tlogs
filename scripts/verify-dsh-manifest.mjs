/**
 * 用**本机安装的 DSH 真实解析器**校验本插件的 package.json 声明。
 *
 * 为什么值得单独做这一步：`dsh.client` 的字段名、`exports["./client"]` 的存在性、
 * 平台门禁这些约定，写错时**运行时不会友好报错**，只会静默不装载浏览器半。照着文档
 * 复刻校验逻辑只能证明「我按文档理解了」；直接从 app.asar 里取出 DSH 自己的
 * `parseDshClient` 并调用它，才能证明「DSH 确实会接受这份声明」。
 *
 * 本脚本在运行时从 asar 里抽取解析器源码（**不把 DSH 的代码提交进仓库**），
 * 因此可以随仓库分发而不涉及 DSH 源码的再分发问题。
 *
 * 用法：
 *   node scripts/verify-dsh-manifest.mjs
 *   DSH_ASAR="<path to app.asar>" node scripts/verify-dsh-manifest.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 常见安装位置（Windows / macOS）。 */
function findAsar() {
  if (process.env.DSH_ASAR) return process.env.DSH_ASAR
  const candidates = [
    'E:\\Users\\ASUS\\AppData\\Local\\Programs\\DeepSeek Harness\\resources\\app.asar',
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DeepSeek Harness', 'resources', 'app.asar'),
    '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar',
  ]
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c
  }
  return undefined
}

/** 最小 ASAR 头解析（只做读取，不修改）。 */
function openAsar(archive) {
  const fd = fs.openSync(archive, 'r')
  const sizeBuf = Buffer.alloc(8)
  fs.readSync(fd, sizeBuf, 0, 8, 0)
  const headerPickleSize = sizeBuf.readUInt32LE(4)
  const headerBuf = Buffer.alloc(headerPickleSize)
  fs.readSync(fd, headerBuf, 0, headerPickleSize, 8)
  const strLen = headerBuf.readUInt32LE(4)
  const header = JSON.parse(headerBuf.toString('utf8', 8, 8 + strLen))
  const base = 8 + headerPickleSize

  const flatten = (node, prefix, out) => {
    if (!node.files) {
      if (node.offset !== undefined) out.push({ path: prefix, size: node.size, offset: Number(node.offset) })
      return out
    }
    for (const [name, child] of Object.entries(node.files)) flatten(child, prefix ? `${prefix}/${name}` : name, out)
    return out
  }
  const entries = flatten(header, '', [])

  return {
    readFile(innerPath) {
      const e = entries.find((x) => x.path === innerPath)
      if (!e) return undefined
      const buf = Buffer.alloc(e.size)
      fs.readSync(fd, buf, 0, e.size, base + e.offset)
      return buf.toString('utf8')
    },
    close: () => fs.closeSync(fd),
  }
}

/** 按函数名从源码中切出完整函数（大括号配平）。 */
function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`在 DSH 产物里找不到函数 ${name}`)
  let depth = 0
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`函数 ${name} 未配平`)
}

const asarPath = findAsar()
if (!asarPath) {
  console.error('✖ 找不到 DSH 的 app.asar；请设置 DSH_ASAR 环境变量指向它')
  process.exit(1)
}
console.log(`DSH 产物：${asarPath}\n`)

const asar = openAsar(asarPath)
let src
try {
  src = asar.readFile('dsh/node_modules/@deepseek-ai/dsh-client-modules/lib/index.js')
} finally {
  asar.close()
}
if (!src) {
  console.error('✖ app.asar 里没有 @deepseek-ai/dsh-client-modules/lib/index.js')
  process.exit(1)
}

// 在沙箱里重建 DSH 自己的解析器
const sandbox = {}
vm.createContext(sandbox)
vm.runInContext(
  `${sliceFunction(src, 'optionalStringArray')}\n${sliceFunction(src, 'parseDshClient')}`,
  sandbox,
)

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const strip = (p) => String(p).replace(/^\.\//, '')

let failures = 0
const ok = (msg) => console.log(`✔ ${msg}`)
const bad = (msg) => {
  failures++
  console.error(`✖ ${msg}`)
}

// ① dsh.client 必须能通过 DSH 自己的解析器
let parsed
try {
  parsed = sandbox.parseDshClient(pkg.name, pkg.dsh?.client)
  ok(`dsh.client 通过 parseDshClient：${JSON.stringify(parsed)}`)
} catch (e) {
  bad(`dsh.client 被 DSH 解析器拒绝：${e.message}`)
}

// ② 平台门禁：只有 web 才会装载浏览器半
if (parsed?.platform === 'web') ok('platform === "web"（浏览器半会被装载）')
else bad(`platform 必须是 "web"，实际 ${JSON.stringify(parsed?.platform)}`)

// ③ exports["./client"] 必须是存在字符串入口
const clientRel = pkg.exports?.['./client']
if (typeof clientRel === 'string' && fs.existsSync(path.join(root, strip(clientRel)))) {
  ok(`exports["./client"] = ${clientRel}（文件存在）`)
} else {
  bad(`exports["./client"] 缺失或文件不存在：${JSON.stringify(clientRel)}`)
}

// ④ 宿主半入口
const mainRel = pkg.exports?.['.'] ?? pkg.main
if (typeof mainRel === 'string' && fs.existsSync(path.join(root, strip(mainRel)))) {
  ok(`宿主半入口 ${mainRel}（文件存在）`)
} else {
  bad(`宿主半入口缺失或文件不存在：${JSON.stringify(mainRel)}`)
}

// ⑤ bundle patch
const patchRel = pkg.dsh?.bundle?.patch
if (typeof patchRel === 'string' && fs.existsSync(path.join(root, strip(patchRel)))) {
  ok(`dsh.bundle.patch = ${patchRel}（文件存在）`)
} else {
  bad(`dsh.bundle.patch 缺失或文件不存在：${JSON.stringify(patchRel)}`)
}

// ⑥ 客户端 bundle 注册的 id 必须等于包名
if (clientRel) {
  const bundle = fs.readFileSync(path.join(root, strip(clientRel)), 'utf8')
  const m = /__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/.exec(bundle)
  if (m && m[1] === pkg.name) ok(`bundle 注册 id = "${m[1]}"（等于包名）`)
  else bad(`bundle 注册 id 为 ${m ? `"${m[1]}"` : '(未找到)'}，必须等于包名 "${pkg.name}"`)
}

// ⑦ 负例对照：证明上面的「通过」不是空转
console.log('\n负例对照（同一解析器必须拒绝这些）：')
let negativesWorked = 0
for (const [label, decl] of [
  ['platform 缺失', { inject: [] }],
  ['inject 含非字符串', { platform: 'web', inject: [1] }],
  ['immediately 非布尔', { platform: 'web', immediately: 'yes' }],
  ['dsh.client 非对象', 'nope'],
]) {
  try {
    sandbox.parseDshClient(pkg.name, decl)
    console.error(`  ✖ ${label} → 竟然通过了（解析器可能没生效）`)
    failures++
  } catch {
    console.log(`  ✔ ${label} → 被拒绝`)
    negativesWorked++
  }
}
if (negativesWorked === 0) failures++

console.log('')
if (failures === 0) {
  console.log('✅ 本插件的声明通过 DSH 自己的解析器与门禁校验（且负例对照有效）')
  process.exit(0)
}
console.error(`❌ 有 ${failures} 项校验未通过`)
process.exit(1)
