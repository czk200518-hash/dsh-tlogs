/**
 * tlogs — 注释体检闸门。
 *
 * 注释的问题不是"多"，而是"说不出代码之外的任何东西"。人工逐条判断不可能核完，
 * 所以把它写成可执行的两类规则：
 *
 *   1. 禁用形态（硬错误）：需求条目编号、原型脚本行号、加粗、⚠️/✅ 之类装饰、
 *      分隔线横幅。这些是上一轮表述层整理删干净的东西，不允许再长回来。
 *   2. 复述率（硬错误）：一条注释里的实词若几乎都能在它标注的标识符里找到，那它
 *      只是把名字读了一遍。按"标识符词覆盖率 ≥ 0.6 且剩余信息 ≤ 4 个字符"判定。
 *   3. 注释密度（硬错误）：src 的注释行占非空行比例超过上限即失败。上限是**棘轮**，
 *      不是「注释必须低于 X%」——两轮精简化之后落在 18.2%，上限取 19%，只许降不许涨，
 *      防的是新代码把注释再堆回去。
 *
 * 用法：
 *   node scripts/verify-comments.mjs           # 校验，不通过时以退出码 1 结束
 *   node scripts/verify-comments.mjs --list    # 只列出问题，不改变退出码
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/** 注释行占非空行的上限。棘轮：防回涨，不是要求注释越少越好。 */
const MAX_COMMENT_RATIO = 0.19

const BANNED = [
  [/需求\s*[0-9零一二三四五六七八九十]/, '指向已删除规格书的「需求 N」编号'],
  [/\bpy:\d+/, '原型脚本行号'],
  [/⚠️|✅|🚨/, '装饰符号'],
  [/^\s*(?:\/\/|\*)\s*-{4,}/, '分隔线横幅'],
  [/\*\*[^*\n]+\*\*/, '注释里的加粗'],
  [/验收\s*[0-9]/, '指向已删除验收清单的条目号'],
]

/** 剥掉注释，只用于统计代码行。 */
function stripComments(source) {
  let out = ''
  let i = 0
  let state = 'code'
  let quote = ''
  while (i < source.length) {
    const c = source[i]
    const n = source[i + 1]
    if (state === 'code') {
      if (c === '/' && n === '/') { state = 'line'; i += 2; continue }
      if (c === '/' && n === '*') { state = 'block'; i += 2; continue }
      if (c === '"' || c === "'" || c === '`') { state = 'string'; quote = c; out += c; i++; continue }
      out += c; i++; continue
    }
    if (state === 'line') { if (c === '\n') { state = 'code'; out += c } i++; continue }
    if (state === 'block') {
      if (c === '*' && n === '/') { state = 'code'; i += 2; continue }
      if (c === '\n') out += c
      i++; continue
    }
    if (quote === '`' && c === '/' && n === '*') { state = 'block'; i += 2; continue }
    out += c
    if (c === '\\') { out += source[i + 1] ?? ''; i += 2; continue }
    if (c === quote) state = 'code'
    i++
  }
  return out
}

/** 逐行判定注释行（块注释跨行跟踪）。 */
function commentLines(lines) {
  const idx = []
  let inBlock = false
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t === '') continue
    if (inBlock) {
      idx.push(i)
      if (t.includes('*/')) inBlock = false
      continue
    }
    if (t.startsWith('/*')) {
      idx.push(i)
      if (!t.includes('*/')) inBlock = true
      continue
    }
    if (t.startsWith('//')) idx.push(i)
  }
  return idx
}

const STOP = new Set([
  '的', '是', '在', '与', '和', '或', '为', '把', '被', '即', '用', '由', '到', '中', '上', '下',
  '一个', '一条', '这个', '那个', '如果', '否则', '以及', '并且', '可以', '需要', '应该', '是否',
  'a', 'an', 'the', 'is', 'are', 'for', 'of', 'to', 'in', 'on', 'with', 'and', 'or', 'when', 'used',
])
const squish = (s) => s.replace(/[\s`'"。，、（）()：:；;=*\-_/|【】「」<>{}[\]]/g, '').toLowerCase()
const identWords = (name) =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9\u4e00-\u9fff]+/)
    .flatMap((w) => w.split(/(?=[A-Z])/))
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 1 && !STOP.has(w))

/** 注释是否只是把紧随其后的标识符读了一遍。 */
function restatesOnly(text, name) {
  const ws = identWords(name)
  if (ws.length === 0) return false
  let body = squish(text)
  let consumed = 0
  for (const w of ws) {
    const s = squish(w)
    if (s.length > 1 && body.includes(s)) { consumed++; body = body.replace(s, '') }
  }
  return consumed / ws.length >= 0.6 && body.replace(/\d/g, '').length <= 4
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { walk(p, out); continue }
    if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(p)
  }
  return out
}

const listOnly = process.argv.includes('--list')
const findings = []
let totalLines = 0
let totalComment = 0

for (const file of walk(join(root, 'src'))) {
  const raw = readFileSync(file, 'utf8')
  const lines = raw.split('\n')
  const cIdx = commentLines(lines)
  const nonBlank = lines.filter((l) => l.trim() !== '').length
  totalLines += nonBlank
  totalComment += cIdx.length

  const cSet = new Set(cIdx)
  for (const i of cIdx) {
    const t = lines[i].trim()
    for (const [re, why] of BANNED) {
      if (re.test(t)) findings.push({ file, line: i + 1, why, text: t.slice(0, 90) })
    }
  }

  // 单行 JSDoc 的复述判定
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*\/\*\* (.+) \*\/$/.exec(lines[i])
    if (!m || m[1].length > 46) continue
    let name = null
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const nx = lines[j].trim()
      if (nx === '' || cSet.has(j)) continue
      const idm = /^(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum|readonly|private|public|protected|static)?\s*([A-Za-z_$][\w$]*)/.exec(nx)
      name = idm ? idm[1] : null
      break
    }
    if (name && restatesOnly(m[1], name)) {
      findings.push({ file, line: i + 1, why: `只复述标识符 ${name}`, text: m[1] })
    }
  }
}

const rel = (p) => relative(root, p).replace(/\\/g, '/')
const ratio = totalComment / totalLines
const ratioPct = (ratio * 100).toFixed(1)

console.log(`[verify:comments] src: ${totalComment} 注释行 / ${totalLines} 非空行 = ${ratioPct}%（上限 ${(MAX_COMMENT_RATIO * 100).toFixed(0)}%）`)

if (ratio > MAX_COMMENT_RATIO) {
  findings.push({
    file: join(root, 'src'),
    line: 0,
    why: `注释密度 ${ratioPct}% 超过上限 ${(MAX_COMMENT_RATIO * 100).toFixed(0)}%`,
    text: '删掉可由名字读出的注释，或把同类字段的注释合并',
  })
}

if (findings.length === 0) {
  console.log('[verify:comments] OK — 无禁用形态、无复述型注释、密度达标')
  process.exit(0)
}

console.log(`[verify:comments] 发现 ${findings.length} 处问题：`)
for (const f of findings) console.log(`  ${rel(f.file)}:${f.line}  [${f.why}]  ${f.text}`)
if (listOnly) process.exit(0)
process.exit(1)
