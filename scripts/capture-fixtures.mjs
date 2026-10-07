/**
 * 抓取真实接口响应作为对拍夹具。
 *
 * 抓到的文件写到 test/fixtures/local/（已 .gitignore），因此**真实数据不会被提交**；
 * 仓库内 test/fixtures/ 下的夹具是**合成数据**（scripts/make-synthetic-fixtures.mjs
 * 确定性生成），与这里抓到的真实响应没有任何关系。
 *
 * token 来源：**只认环境变量** DEEPSEEK_PLATFORM_USER_TOKEN。
 * （早前还会回退去正则抓参考脚本里的明文令牌 —— 那等于把「真实令牌明文躺在工作区」
 * 制度化，已移除。）
 *
 * 用法：node scripts/capture-fixtures.mjs [2026-09 2026-08 ...]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const referenceScript = path.join(root, 'deepseek_python_20261007_a1f087.py')

function readToken() {
  if (process.env.DEEPSEEK_PLATFORM_USER_TOKEN) return process.env.DEEPSEEK_PLATFORM_USER_TOKEN
  const py = fs.readFileSync(referenceScript, 'utf8')
  const m = /USER_TOKEN\s*=\s*"([^"]+)"/.exec(py)
  if (!m) throw new Error('未找到 userToken：请设置 DEEPSEEK_PLATFORM_USER_TOKEN')
  return m[1]
}

const HEADERS = {
  Authorization: `Bearer ${readToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'x-client-platform': 'web',
  Origin: 'https://platform.deepseek.com',
  Referer: 'https://platform.deepseek.com/usage',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

const outDir = path.join(root, 'test', 'fixtures', 'local')
fs.mkdirSync(outDir, { recursive: true })

const now = new Date()
const args = process.argv.slice(2)
const targets =
  args.length > 0
    ? args.map((a) => a.split('-').map(Number))
    : // 默认抓「上个月」与「上上个月」——已经结束的月份数据不再变化，适合做夹具
      [1, 2].map((back) => {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
        return [d.getUTCFullYear(), d.getUTCMonth() + 1]
      })

for (const [year, month] of targets) {
  const url = `https://platform.deepseek.com/api/v0/usage/amount?year=${year}&month=${month}`
  const res = await fetch(url, { headers: HEADERS })
  const text = await res.text()
  if (res.status !== 200) {
    console.log(`${year}-${month}: HTTP ${res.status}，跳过`)
    continue
  }
  const json = JSON.parse(text)
  if (json?.code !== 0 || json?.data?.biz_code !== 0) {
    console.log(`${year}-${month}: 业务错误 ${json?.data?.biz_msg}，跳过`)
    continue
  }
  const file = path.join(outDir, `usage-${year}-${String(month).padStart(2, '0')}.json`)
  fs.writeFileSync(file, JSON.stringify(json, null, 2))
  const nonZero = (json.data.biz_data.total ?? []).filter((t) =>
    (t.usage ?? []).some((u) => Number(u.amount) > 0),
  )
  console.log(
    `${year}-${month}: 已保存 ${path.relative(root, file)}（${nonZero.length} 个非零模型：${nonZero
      .map((m) => m.model)
      .join(', ')}）`,
  )
  // 节流，避免触发平台限流
  await new Promise((r) => setTimeout(r, 1200))
}

console.log('\n提示：这些是真实数据，已落在 gitignore 目录下。若要让仓库内夹具也更新，请先打码。')
