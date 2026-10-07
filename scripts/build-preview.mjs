/**
 * 生成内嵌组件预览（docs/embed-preview.html）。
 *
 * 重要说明（同样写在预览页顶部与 README 里）：
 * 这不是应用内的真实截图，而是**用真实组件 + 真实样式表**做静态渲染得到的
 * 预览页：组件来自 lib/client/*.js（由 src/client/*.tsx 编译而来），样式来自
 * src/client/styles.ts 的 CSS，两侧都是产物本体，不存在手绘的假 UI。
 *
 * 预览页额外提供一个「侧边栏页脚」外框，用来直观展示需求 1.1 的落点：
 * 控件在文档流内、位于侧边栏底部、展开时就地把上方内容顶上去。
 *
 * 由于真实主题 token 由 @deepseek-ai/dsh-client-ui-theme 在应用内注入，
 * 独立预览页里用一组「替身 token」模拟浅色/深色，页面上会明确标注这一点。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'

import { CompactBar } from '../lib/client/compact-bar.js'
import { ExpandPanel } from '../lib/client/expand-panel.js'
import { DetailView } from '../lib/client/detail-view.js'
import { CSS } from '../lib/client/styles.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ------------------------------------------------------------------ 假数据

const emptyStat = () => ({
  PROMPT_TOKEN: 0,
  PROMPT_CACHE_HIT_TOKEN: 0,
  PROMPT_CACHE_MISS_TOKEN: 0,
  RESPONSE_TOKEN: 0,
  REQUEST: 0,
})

const scopeStat = (input, output, requests) => ({
  raw: { ...emptyStat(), PROMPT_CACHE_HIT_TOKEN: input, RESPONSE_TOKEN: output, REQUEST: requests },
  inputTokens: input,
  outputTokens: output,
  totalTokens: input + output,
  requests,
})

const snapshot = {
  auth: { status: 'ok', source: 'credentials' },
  cards: [
    { scope: 'total', label: '总消耗 Token', stat: scopeStat(8_111_339_079, 51_978_993, 51_451) },
    {
      scope: 'total',
      label: '当前项目消耗',
      stat: scopeStat(1_204_882_120, 8_441_002, 9_820),
      options: [
        { id: 'tlogs', label: 'tlogs', stat: scopeStat(1_204_882_120, 8_441_002, 9_820) },
        { id: 'dsh', label: 'deepseek-harness', stat: scopeStat(402_118_004, 3_004_551, 3_210) },
      ],
      selectedOptionId: 'tlogs',
    },
    { scope: 'today', label: '今日消耗', stat: scopeStat(165_304_064, 399_575, 533) },
    { scope: 'week', label: '当周消耗', stat: scopeStat(2_450_674_688, 12_032_229, 10_141) },
    { scope: 'month', label: '当月消耗', stat: scopeStat(3_286_234_976, 14_429_553, 12_593) },
  ],
  compact: [
    // 默认形态：只有「总 + 今日」（本周/本月在展开面板里看）
    { scope: 'total', label: '总', value: 8_163_318_072 },
    { scope: 'today', label: '今日', value: 165_703_639 },
  ],
  stale: false,
  lastUpdatedAt: Date.now(),
  loading: false,
  display: { numberFormat: 'short', enableDetailView: true, defaultExpanded: false },
}

const detail = {
  models: [
    { key: 'deepseek-flash', label: 'deepseek-flash', stat: scopeStat(8_062_474_688, 51_120_229, 50_141) },
    { key: 'deepseek-v4.1-flash-expires-on-0910', label: 'deepseek-v4.1-flash-expires-on-0910', stat: scopeStat(284_130_176, 896_095, 903) },
    { key: 'deepseek-v4-flash-vision-exp', label: 'deepseek-v4-flash-vision-exp', stat: scopeStat(522_440_832, 1_492_111, 1_540) },
    { key: 'deepseek-v4-flash', label: 'deepseek-v4-flash', stat: scopeStat(60_288, 9_118, 9) },
  ],
  years: [
    { key: '2024', label: '2024 年', stat: scopeStat(184_002_112, 2_004_551, 2_210) },
    { key: '2025', label: '2025 年', stat: scopeStat(3_204_882_004, 22_441_002, 21_820) },
    { key: '2026', label: '2026 年', stat: scopeStat(4_722_455_841, 27_533_440, 27_421) },
  ],
  months: [
    { key: '2026-09', label: '2026-09', stat: scopeStat(3_286_234_976, 14_429_553, 12_593) },
    { key: '2026-08', label: '2026-08', stat: scopeStat(1_402_118_004, 9_004_551, 8_210) },
  ],
  days: [
    { key: '2026-09-30', label: '2026-09-30', stat: scopeStat(5_086_508, 31_821, 31) },
    { key: '2026-09-01', label: '2026-09-01', stat: scopeStat(136_723_417, 349_677, 449) },
  ],
}

const compactMarkup = renderToStaticMarkup(
  React.createElement(CompactBar, {
    snapshot,
    numberFormat: 'short',
    wide: true,
    expanded: false,
    busy: false,
    onToggle: () => {},
  }),
)
const compactCollapsedMarkup = renderToStaticMarkup(
  React.createElement(CompactBar, {
    snapshot,
    numberFormat: 'short',
    wide: false,
    expanded: false,
    busy: false,
    onToggle: () => {},
  }),
)
/**
 * 退化验证：即使有人把 4 项指标都配回紧凑条，数字也不该被裁掉。
 * 这正是用户实测报上来的症状（末尾显示成「本月 359」而不是「359M」）。
 */
const compactFourMarkup = renderToStaticMarkup(
  React.createElement(CompactBar, {
    snapshot: {
      ...snapshot,
      compact: [
        { scope: 'total', label: '总', value: 8_163_318_072 },
        { scope: 'today', label: '今日', value: 165_703_639 },
        { scope: 'week', label: '本周', value: 2_462_706_917 },
        { scope: 'month', label: '本月', value: 3_300_664_529 },
      ],
    },
    numberFormat: 'short',
    wide: true,
    expanded: false,
    busy: false,
    onToggle: () => {},
  }),
)
const panelMarkup = renderToStaticMarkup(
  React.createElement(ExpandPanel, {
    snapshot,
    error: null,
    busy: false,
    numberFormat: 'short',
    enableDetailView: true,
    onRefresh: () => {},
    onOpenDetail: () => {},
    onLogin: () => {},
    onSetToken: async () => true,
    onLogout: () => {},
  }),
)
const expiredMarkup = renderToStaticMarkup(
  React.createElement(ExpandPanel, {
    snapshot: { ...snapshot, auth: { status: 'invalid', message: '401 认证失败（userToken 失效）' } },
    error: null,
    busy: false,
    numberFormat: 'short',
    enableDetailView: true,
    onRefresh: () => {},
    onOpenDetail: () => {},
    onLogin: () => {},
    onSetToken: async () => true,
    onLogout: () => {},
  }),
)
const detailMarkup = renderToStaticMarkup(
  React.createElement(DetailView, {
    detail,
    loading: false,
    busy: false,
    onBack: () => {},
    onRefresh: () => {},
  }),
)

// ------------------------------------------------------------------ 页面

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>tlogs — 内嵌用量组件预览</title>
<style>
  /* 独立预览页的替身主题 token：真实数值由 @deepseek-ai/dsh-client-ui-theme 注入。
     这里只为让预览在浅色/深色下都可读，颜色仅作示意。 */
  body {
    --dsw-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    --dsw-radius-xs: 4px;
    --dsw-alias-label-primary: #1f2328;
    --dsw-alias-label-tertiary: #8b949e;
    --dsw-alias-bg-layer-1: #f6f8fa;
    --dsw-alias-bg-layer-2: #ffffff;
    --dsw-alias-bg-base: #ffffff;
    --dsw-alias-border-l3: #d8dee4;
    --dsw-alias-border-l4: #cfd8e0;
    --dsw-alias-interactive-bg-hover: #eaeef2;
    --dsw-alias-state-business-primary: #4d6bfe;
    --dsw-alias-state-warn-primary: #bf8700;
    --dsw-alias-state-error-primary: #cf222e;
    margin: 0; padding: 24px; background: #ffffff; color: var(--dsw-alias-label-primary);
    font-family: var(--dsw-font-family);
  }
  body[data-ds-dark-theme] {
    --dsw-alias-label-primary: #e6edf3;
    --dsw-alias-label-tertiary: #8b949e;
    --dsw-alias-bg-layer-1: #21262d;
    --dsw-alias-bg-layer-2: #161b22;
    --dsw-alias-bg-base: #0d1117;
    --dsw-alias-border-l3: #30363d;
    --dsw-alias-border-l4: #3d444d;
    --dsw-alias-interactive-bg-hover: #21262d;
    background: #0d1117;
  }
  .warn { background: #fff8c5; color: #4d2d00; border: 1px solid #d4a72c66; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 18px; }
  body[data-ds-dark-theme] .warn { background: #3a2d00; color: #f0e6c8; }
  h2 { font-size: 15px; margin: 26px 0 8px; }
  h2 small { font-weight: 400; opacity: .6; font-size: 12px; }
  .note { font-size: 12px; opacity: .65; margin: 6px 0 10px; line-height: 1.6; }
  /* 模拟真实侧边栏：上方是工作区列表（会被顶上去），底部是页脚席位 */
  .sidebar { width: 268px; border: 1px dashed var(--dsw-alias-border-l4); border-radius: 8px; display: flex; flex-direction: column; min-height: 330px; overflow: hidden; background: var(--dsw-alias-bg-layer-2); }
  .sidebar.slim { width: 56px; min-height: 120px; }
  .sidebar-head { padding: 8px 10px; font-size: 11px; opacity: .6; border-bottom: 1px solid var(--dsw-alias-border-l3); }
  .fake-list { flex: 1 1 auto; padding: 8px 10px; font-size: 11px; opacity: .5; display: flex; flex-direction: column; gap: 7px; }
  .fake-list i { display: block; height: 9px; border-radius: 3px; background: currentColor; opacity: .18; }
  .fake-list i:nth-child(2) { width: 78%; } .fake-list i:nth-child(3) { width: 62%; }
  .sidebar-foot { border-top: 1px solid var(--dsw-alias-border-l3); padding: 5px 7px; flex: 0 0 auto; }
  .sidebar-foot .foot-label { font-size: 9px; opacity: .45; padding: 0 4px 4px; }
  .row { display: flex; gap: 26px; flex-wrap: wrap; align-items: flex-start; }
  .frame { border: 1px solid var(--dsw-alias-border-l4); border-radius: 10px; padding: 14px; background: var(--dsw-alias-bg-base); }
  .frame > .cap { font-size: 11px; opacity: .6; margin-bottom: 10px; }
</style>
<!-- 组件自身的样式表：直接取自 src/client/styles.ts（构建产物 lib/client/styles.js） -->
<style>
${CSS}
</style>
</head>
<body>
  <div class="warn">
    <b>这是静态预览，不是应用内截图。</b>
    组件与样式均取自构建产物本体（<code>lib/client/*.js</code> + <code>src/client/styles.ts</code> 的 CSS），
    用 <code>react-dom/server</code> 渲染得到，没有手绘的假 UI。
    页面上的 <code>--dsw-*</code> 颜色是<b>替身 token</b>；真实数值由
    <code>@deepseek-ai/dsh-client-ui-theme</code> 在应用内注入，因此实际配色以 DSH 内为准。
    获取真实截图的方式见 README「验证」一节。
  </div>

  <h2>形态 A：紧凑条 <small>高 30px（需求 28–32px），位于侧边栏页脚</small></h2>
  <div class="note">下面是模拟的侧边栏：上方虚线块代表工作区列表，控件固定在页脚区域内，完全参与正常文档流（不使用浮动定位）。</div>
  <div class="row">
    <div class="sidebar">
      <div class="sidebar-head">侧边栏（展开）</div>
      <div class="fake-list"><i></i><i></i><i></i><i></i></div>
      <div class="sidebar-foot">
        <div class="foot-label">sidebar.footer.action 席位</div>
        ${compactMarkup}
      </div>
    </div>
    <div class="sidebar slim">
      <div class="sidebar-head">收起</div>
      <div class="sidebar-foot">
        ${compactCollapsedMarkup}
      </div>
    </div>
  </div>

  <h2>形态 B：展开面板 <small>就地撑开，把上方内容顶上去（不覆盖）</small></h2>
  <div class="note">注意上方工作区列表被顶起、面板占据页脚上方空间；底部一行是「详细数据 › / 刷新 / 退出登录」。</div>
  <div class="sidebar" style="min-height:420px">
    <div class="sidebar-head">侧边栏（展开 · 面板已展开）</div>
    <div class="fake-list"><i></i><i></i></div>
    <div class="sidebar-foot">
      ${compactMarkup}
      ${panelMarkup}
    </div>
  </div>

  <h2>认证失效 <small>面板顶部提示重新登录（需求 2.4 / 5.2）</small></h2>
  <div class="sidebar" style="min-height:380px">
    <div class="sidebar-head">侧边栏（userToken 失效）</div>
    <div class="fake-list"><i></i></div>
    <div class="sidebar-foot">
      ${expiredMarkup}
    </div>
  </div>

  <h2>详细视图 <small>同一容器内切换，不新开窗口 / 不弹 Modal（需求 1.4）</small></h2>
  <div class="sidebar" style="min-height:420px;width:300px">
    <div class="sidebar-head">侧边栏（详细数据）</div>
    <div class="sidebar-foot">${detailMarkup}</div>
  </div>

  <h2>深色主题 <small>同一份组件与样式，仅主题 token 不同</small></h2>
  <div class="row">
    <div class="frame" data-ds-dark-theme style="background:#0d1117">
      <div class="cap">紧凑条 + 展开面板（深色）</div>
      <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:6px">
        ${compactMarkup}
        ${panelMarkup}
      </div>
    </div>
  </div>

  <h2>宽度退化 <small>即使把 4 项指标都配回来，数字也不该被裁掉</small></h2>
  <div class="note">
    默认只放「总 + 今日」，因此正常宽度下绰绰有余。下面刻意把 4 项都放回来，
    在最窄的侧边栏里验证：数字不可压缩、只有标签会让位 —— 若你看到数字自身被截断，
    说明这个回归又回来了。
  </div>
  <div class="row">
    <div class="sidebar" style="width:268px;min-height:110px">
      <div class="sidebar-head">268px · 4 项指标</div>
      <div class="sidebar-foot">${compactFourMarkup}</div>
    </div>
    <div class="sidebar" style="width:180px;min-height:110px">
      <div class="sidebar-head">180px · 4 项指标（极窄）</div>
      <div class="sidebar-foot">${compactFourMarkup}</div>
    </div>
  </div>

  <h2 id="capture">在应用内截取真实截图</h2>
  <div class="note">
    把本插件装进 profile 并重启 DSH 后，侧边栏底部即会出现紧凑条；展开后可直接系统截图。
    安装步骤见 README「安装」一节。本预览页无法替代真实截图，仅用于快速核对布局与两种主题下的可读性。
  </div>
</body>
</html>
`

const outDir = path.join(root, 'docs')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'embed-preview.html')
fs.writeFileSync(outFile, html)
console.log(`tlogs: 预览页已生成 -> ${outFile}`)
