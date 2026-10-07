/**
 * 发布前密钥闸门 —— 防止「真实令牌被写进仓库」这类事故再次发生。
 *
 * 背景（真实事故）：本插件曾在 `test/auth.test.ts` 里把一个**真实的**平台令牌
 * 当作「测试样例」抄了两遍，另外在 `src/auth/token-manager.ts` 的注释里留了它的
 * 前 4~8 位。仓库还没 commit 就被发现并清掉了 —— 这个脚本就是那次事故的产物。
 *
 * 两件事：
 *   1. 若工作区存在权威参考脚本（`deepseek_python_*.py`，已 gitignore），
 *      读出其中的真实令牌，断言它（以及它的长前缀）**没有**出现在任何会入库的文件里。
 *   2. 对所有会入库的文件跑通用凭据形态匹配。
 *
 * 输出刻意**不含**命中的内容本身（只报文件名 + 模式 + 命中长度），避免这个检查
 * 自己把秘密打印到 CI 日志里。
 *
 * 用法：`npm run verify:secrets`（已挂到 `npm run check` / `prepublishOnly`）
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 不会入库的路径（与 .gitignore 保持一致）。 */
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.plugin-manager'])
const SKIP_PREFIXES = ['test/fixtures/local/']
/**
 * 文件名级跳过。注意 `.verify-secrets.local.txt` 必须在这里：它**本身**就是
 * 真实值的集合（拒绝清单），不跳过的话这个检查会把自己报成泄漏。
 */
const SKIP_FILE_RE =
  /^(deepseek_python_.*\.py|\.verify-secrets\.local\.txt|.*\.pyc|.*\.tmp-.*|\.history\.json)$/
/** 明确标注为假值的占位符，允许出现。 */
const ALLOW_MARKERS = ['TESTONLY', 'NOTAREALTOKEN', 'DO-NOT-USE', '<redacted']

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    const rel = path.relative(ROOT, abs).split(path.sep).join('/')
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      if (SKIP_PREFIXES.some((p) => rel.startsWith(p))) continue
      yield* walk(abs)
    } else if (entry.isFile()) {
      if (SKIP_PREFIXES.some((p) => rel.startsWith(p))) continue
      if (SKIP_FILE_RE.test(entry.name)) continue
      yield { abs, rel }
    }
  }
}

/** 通用凭据形态。命中内容只用于计数，不打印。 */
const PATTERNS = [
  ['github fine-grained PAT', /\bgithub_pat_[A-Za-z0-9_]{20,}/g],
  ['github PAT', /\bgh[pousr]_[A-Za-z0-9]{20,}/g],
  ['sk- style key', /\bsk-[A-Za-z0-9]{20,}/g],
  ['Bearer + long literal', /Bearer\s+[A-Za-z0-9+/=]{24,}/g],
  ['USER_TOKEN = "..."', /USER_TOKEN\s*=\s*"[^"]{16,}"/g],
  ['Authorization literal', /Authorization["']?\s*[:=]\s*["']?[A-Za-z0-9+/=]{24,}/g],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
]

const findings = []

// ---- 1. 参考脚本里的真实令牌（若有）不得出现在入库文件里 ----
let referenceToken
try {
  const py = fs.readdirSync(ROOT).find((f) => /^deepseek_python_.*\.py$/.test(f))
  if (py) {
    const m = /USER_TOKEN\s*=\s*"([^"]+)"/.exec(fs.readFileSync(path.join(ROOT, py), 'utf8'))
    if (m && m[1]) referenceToken = m[1]
  }
} catch {
  /* 没有参考脚本就只跑通用匹配 */
}

const needles = referenceToken
  ? [
      { label: 'REAL TOKEN (exact)', value: referenceToken },
      { label: 'REAL TOKEN (first 16)', value: referenceToken.slice(0, 16) },
      { label: 'REAL TOKEN (first 8)', value: referenceToken.slice(0, 8) },
      { label: 'REAL TOKEN (first 6)', value: referenceToken.slice(0, 6) },
    ]
  : []

/**
 * 本机私有拒绝清单（**已 gitignore**，绝不会被发布）。
 *
 * 为什么需要：真实令牌只存在于权威参考脚本里，而那个脚本随时可能被删/被移走。
 * 一旦它不在，上面的「真实值比对」就静默失效了 —— 那种"看起来在检查、其实没检查"
 * 的状态比不检查更危险。这个清单让我们把**其它**不该入库的真实值（真实用量数字、
 * 本机路径、邮箱等）也钉下来，且不依赖任何外部文件。
 *
 * 格式：每行一个固定字符串，`#` 开头为注释。放入任何你想禁止出现的真实值。
 */
const localListPath = path.join(ROOT, '.verify-secrets.local.txt')
let localNeedles = []
try {
  if (fs.existsSync(localListPath)) {
    localNeedles = fs
      .readFileSync(localListPath, 'utf8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4 && !s.startsWith('#'))
  }
} catch {
  /* 读不到就当没有 */
}
for (const v of localNeedles) needles.push({ label: 'LOCAL_DENYLIST', value: v })

let scanned = 0
for (const { abs, rel } of walk(ROOT)) {
  let buf
  try {
    buf = fs.readFileSync(abs)
  } catch {
    continue
  }
  // 跳过二进制（含 NUL 字节）
  if (buf.includes(0)) continue
  const text = buf.toString('utf8')
  if (ALLOW_MARKERS.some((m) => text.includes(m))) {
    // 含占位符的文件仍需检查：只有**真实**令牌是硬红线，通用模式可能误报占位符。
  }
  scanned++

  for (const { label, value } of needles) {
    if (value.length >= 6 && text.includes(value)) {
      findings.push({ rel, label, len: value.length })
    }
  }

  for (const [label, re] of PATTERNS) {
    re.lastIndex = 0
    const m = text.match(re)
    if (!m) continue
    // 占位符豁免：明显是假值的行不算命中
    const real = m.filter((hit) => !ALLOW_MARKERS.some((mark) => hit.includes(mark)))
    if (real.length > 0) findings.push({ rel, label, len: real[0].length })
  }
}

console.log(`[verify:secrets] scanned ${scanned} files`)
if (referenceToken) {
  console.log('[verify:secrets] reference script found -> checking its real token too')
}
if (localNeedles.length > 0) {
  console.log(`[verify:secrets] local denylist loaded -> ${localNeedles.length} extra real values pinned`)
}
if (!referenceToken && localNeedles.length === 0) {
  console.log('')
  console.log('[verify:secrets] !! WARNING: strongest check is INACTIVE')
  console.log('[verify:secrets]    - no deepseek_python_*.py in the workspace, and')
  console.log('[verify:secrets]    - no .verify-secrets.local.txt')
  console.log('[verify:secrets]    -> only GENERIC credential patterns are being checked.')
  console.log('[verify:secrets]       Create .verify-secrets.local.txt (gitignored) and list every real')
  console.log('[verify:secrets]       value that must never be published (real usage numbers, local')
  console.log('[verify:secrets]       paths, email). Otherwise this gate cannot catch them.')
  console.log('')
}

if (findings.length === 0) {
  console.log('[verify:secrets] OK - no credentials found in publishable files')
  process.exit(0)
}

console.error('')
console.error('[verify:secrets] FAILED - possible credentials in publishable files:')
for (const f of findings) {
  console.error(`  ${f.rel}  [${f.label}]  match length=${f.len}`)
}
console.error('')
console.error('  (match content is intentionally NOT printed)')
console.error('  fix: replace the literal with an obvious placeholder such as TESTONLY-...')
process.exit(1)
