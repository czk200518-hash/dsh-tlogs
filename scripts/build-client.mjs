/**
 * tlogs — 客户端 bundle 构建脚本。
 *
 * 为什么需要这一步：DSH 只把**已构建**的客户端 bundle 提供给浏览器
 * （dsh-client-modules 的「构建要求」：插件包必须自行产出 lib/client.js，
 * 缺失会导致激活失败）。浏览器半侧通过 `window.__ModuleLoader__.load({ id, factory })`
 * 注册，factory 内只允许同步 `require` 平台种子表里的模块（React 在其中）。
 *
 * 产出格式与已发布的第三方客户端插件逐字节同构：
 *   window.__ModuleLoader__.load({ id: "<pkg>", factory: (require) => {
 *     var module = { exports: {} }; var exports = module.exports;
 *     ...bundle...
 *     return module.exports;
 *   } });
 *
 * 关键约束：
 *  - 只 external `react`（不产生 react/jsx-runtime 请求，避免解析失败）
 *  - JSX 编译为 `h(...)` 调用（h = React.createElement，见 src/client/h.ts）
 *  - 单文件、自包含（协议不支持入口同步 require 同级 client*.js 产物）
 */

import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const outfile = resolve(root, 'lib/client.js')

const banner =
  'window.__ModuleLoader__.load({ id: ' +
  JSON.stringify(pkg.name) +
  ', factory: (require) => { var module = { exports: {} }; var exports = module.exports;'

const footer = 'return module.exports; } });'

await build({
  entryPoints: [resolve(root, 'src/client/index.ts')],
  outfile,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome120'],
  // 平台种子表里只有 React 等少数模块；其余一律必须打进 bundle。
  external: ['react'],
  jsx: 'transform',
  jsxFactory: 'h',
  // esbuild 的选项名是 jsxFragment（CLI 为 --jsx-fragment），
  // 不是 TypeScript 的 jsxFragmentFactory。
  jsxFragment: 'Fragment',
  sourcemap: true,
  legalComments: 'none',
  logLevel: 'info',
  banner: { js: banner },
  footer: { js: footer },
})

console.log(`tlogs: client bundle written to ${outfile}`)
