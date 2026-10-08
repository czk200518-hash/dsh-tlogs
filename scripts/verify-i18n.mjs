/**
 * tlogs — 客户端文案外置校验。
 *
 * 规则：`src/client/**`（除 `src/client/i18n/**` 这个文案目录外）的**代码**
 * 中不允许再出现中日韩文字；所有面向用户的文案必须走 `t('key')`。
 *
 * 注释里的中文是允许的（代码里的中文注释是仓库既定风格），因此先把注释剥掉
 * 再扫描 —— 这样这条检查才是可执行的，而不是靠人工核对。
 *
 * 用法：
 *   node scripts/verify-i18n.mjs            # 校验，发现问题时以退出码 1 结束
 *   node scripts/verify-i18n.mjs --list     # 只列出问题（不改变退出码）
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const clientDir = join(root, 'src', 'client')
const i18nDir = join(clientDir, 'i18n')

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/

/** 递归收集待检查的源码文件（.ts/.tsx，排除文案目录）。 */
function collect(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (p === i18nDir) continue
      collect(p, out)
      continue
    }
    if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(p)
  }
  return out
}

/**
 * 粗略剥掉注释（行注释与块注释）。
 * 目的只是"别把注释里的中文算成漏网文案"，不追求语法级精确。
 */
function stripComments(source) {
  let out = ''
  let i = 0
  let state = 'code'
  let quote = ''
  while (i < source.length) {
    const c = source[i]
    const n = source[i + 1]
    if (state === 'code') {
      if (c === '/' && n === '/') {
        state = 'line'
        i += 2
        continue
      }
      if (c === '/' && n === '*') {
        state = 'block'
        i += 2
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        state = 'string'
        quote = c
        out += c
        i++
        continue
      }
      out += c
      i++
      continue
    }
    if (state === 'line') {
      if (c === '\n') {
        state = 'code'
        out += c
      }
      i++
      continue
    }
    if (state === 'block') {
      if (c === '*' && n === '/') {
        state = 'code'
        i += 2
        continue
      }
      if (c === '\n') out += c
      i++
      continue
    }
    // state === 'string'：字符串内部的 // 与 /* 都不是注释
    // 例外：模板字面量里的 `/* */` 按注释处理 —— styles.ts 的 CSS 是模板字符串，
    // 里面的中文全是 CSS 注释，不该算成"漏网文案"。
    if (quote === '`' && c === '/' && n === '*') {
      state = 'block'
      i += 2
      continue
    }
    out += c
    if (c === '\\') {
      out += source[i + 1] ?? ''
      i += 2
      continue
    }
    if (c === quote) state = 'code'
    i++
  }
  return out
}

const listOnly = process.argv.includes('--list')
const findings = []

for (const file of collect(clientDir)) {
  const raw = readFileSync(file, 'utf8')
  const stripped = stripComments(raw)
  const lines = stripped.split('\n')
  lines.forEach((line, index) => {
    if (!CJK.test(line)) return
    findings.push({ file, line: index + 1, text: line.trim() })
  })
}

const rel = (p) => relative(root, p).replace(/\\/g, '/')

if (findings.length === 0) {
  console.log('verify-i18n: OK — 客户端代码中已无硬编码文案（注释除外）')
  process.exit(0)
}

console.log(`verify-i18n: 发现 ${findings.length} 处硬编码文案（应改为 t('key')）：`)
for (const f of findings) console.log(`  ${rel(f.file)}:${f.line}  ${f.text}`)
if (listOnly) process.exit(0)
process.exit(1)
