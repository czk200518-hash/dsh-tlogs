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
import { DetailModal } from '../lib/client/detail-modal.js'
import { ChartPanel } from '../lib/client/chart-panel.js'
import { CSS } from '../lib/client/styles.js'
import { moneyTotal } from '../lib/types.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ------------------------------------------------------------------ 假数据

const emptyStat = () => ({
  PROMPT_TOKEN: 0,
  PROMPT_CACHE_HIT_TOKEN: 0,
  PROMPT_CACHE_MISS_TOKEN: 0,
  RESPONSE_TOKEN: 0,
  REQUEST: 0,
})

/**
 * 金额占位拆分。
 *
 * 真实的五类拆分由接口给出（`usage/cost` 的 `total[].usage[]`）；预览页只需要一个
 * 形状正确、量级合理的分布，因此按「缓存命中 / 未命中 / 输出」的典型占比切分：
 * 实测 2026-09 是 92.18 / 32.97 / 60.90（49% / 18% / 33%），这里取其近似。
 */
const costSplit = (total) => ({
  PROMPT_TOKEN: 0,
  PROMPT_CACHE_HIT_TOKEN: round4(total * 0.49),
  PROMPT_CACHE_MISS_TOKEN: round4(total * 0.18),
  RESPONSE_TOKEN: round4(total * 0.33),
  REQUEST: 0,
})
const round4 = (n) => Math.round(n * 1e4) / 1e4

/**
 * 造一个 ScopeStat。
 *
 * @param cost 该范围的消费金额（CNY 元）；省略表示「没有金额数据」——
 *   此时组件**不渲染 ¥**（`cost === undefined` 与「花了 0 元」是两回事）。
 */
const scopeStat = (input, output, requests, cost) => {
  const s = {
    raw: { ...emptyStat(), PROMPT_CACHE_HIT_TOKEN: input, RESPONSE_TOKEN: output, REQUEST: requests },
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    requests,
  }
  if (cost !== undefined) {
    s.cost = costSplit(cost)
    s.currency = 'CNY'
  }
  return s
}

const snapshot = {
  auth: { status: 'ok', source: 'credentials' },
  cards: [
    { scope: 'total', label: '总消耗 Token', stat: scopeStat(8_111_339_079, 51_978_993, 51_451, 675.7352) },
    {
      scope: 'total',
      label: '当前项目消耗',
      // 项目用量来自本机会话投影：平台账单里没有它的金额 → 刻意不给 cost，
      // 用来展示「没有金额时不显示 ¥（而不是显示 ¥0.00）」这个分支。
      stat: scopeStat(1_204_882_120, 8_441_002, 9_820),
      options: [
        { id: 'tlogs', label: 'tlogs', stat: scopeStat(1_204_882_120, 8_441_002, 9_820) },
        { id: 'dsh', label: 'deepseek-harness', stat: scopeStat(402_118_004, 3_004_551, 3_210) },
      ],
      selectedOptionId: 'tlogs',
    },
    { scope: 'today', label: '今日消耗', stat: scopeStat(165_304_064, 399_575, 533, 12.3456) },
    { scope: 'week', label: '当周消耗', stat: scopeStat(2_450_674_688, 12_032_229, 10_141, 132.4471) },
    { scope: 'month', label: '当月消耗', stat: scopeStat(3_286_234_976, 14_429_553, 12_593, 186.0416) },
    { scope: 'last7', label: '近 7 天', stat: scopeStat(2_450_674_688, 12_032_229, 10_141, 132.4471) },
    { scope: 'last30', label: '近 30 天', stat: scopeStat(3_375_903_004, 14_109_238, 13_594, 170.7914) },
  ],
  compact: [
    // 默认形态：总 Token + 总金额 + 今日 + 今日请求数
    { scope: 'total', label: '总', value: 8_163_318_072 },
    { scope: 'total', label: '总 ¥', value: 675.7352, unit: 'money' },
    { scope: 'today', label: '今日', value: 165_703_639 },
    { scope: 'today', label: '请求', value: 1642, unit: 'requests' },
  ],
  stale: false,
  lastUpdatedAt: Date.now(),
  loading: false,
  costComplete: true,
  currency: 'CNY',
  account: { balance: 39.42725498, bonusBalance: 0, totalCosts: 677.7645829, currency: 'CNY' },
  display: { numberFormat: 'short', enableDetailView: true, defaultExpanded: false },
}

const detail = {
  models: [
    // 按模型只有金额总额（没有五类拆分）→ 承载在单一桶里
    { key: 'deepseek-flash', label: 'deepseek-flash', stat: { ...scopeStat(8_062_474_688, 51_120_229, 50_141), cost: { ...emptyStat(), PROMPT_TOKEN: 621.4021 }, currency: 'CNY' } },
    { key: 'deepseek-v4.1-flash-expires-on-0910', label: 'deepseek-v4.1-flash-expires-on-0910', stat: { ...scopeStat(284_130_176, 896_095, 903), cost: { ...emptyStat(), PROMPT_TOKEN: 23.6395 }, currency: 'CNY' } },
    { key: 'deepseek-v4-flash-vision-exp', label: 'deepseek-v4-flash-vision-exp', stat: { ...scopeStat(522_440_832, 1_492_111, 1_540), cost: { ...emptyStat(), PROMPT_TOKEN: 36.7237 }, currency: 'CNY' } },
    { key: 'deepseek-v4-flash', label: 'deepseek-v4-flash', stat: { ...scopeStat(60_288, 9_118, 9), cost: { ...emptyStat(), PROMPT_TOKEN: 0.1253 }, currency: 'CNY' } },
  ],
  years: [
    { key: '2024', label: '2024 年', stat: scopeStat(184_002_112, 2_004_551, 2_210, 0) },
    { key: '2025', label: '2025 年', stat: scopeStat(3_204_882_004, 22_441_002, 21_820, 24.7466) },
    { key: '2026', label: '2026 年', stat: scopeStat(4_722_455_841, 27_533_440, 27_421, 650.9886) },
  ],
  months: [
    { key: '2026-09', label: '2026-09', stat: scopeStat(3_286_234_976, 14_429_553, 12_593, 186.0416) },
    { key: '2026-08', label: '2026-08', stat: scopeStat(1_402_118_004, 9_004_551, 8_210, 134.9992) },
  ],
  days: [
    { key: '2026-09-30', label: '2026-09-30', stat: scopeStat(5_086_508, 31_821, 31, 0.5116) },
    { key: '2026-09-01', label: '2026-09-01', stat: scopeStat(136_723_417, 349_677, 449, 8.4302) },
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
    onRefresh: () => {},
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
    onRefresh: () => {},
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
        { scope: 'total', label: '总 ¥', value: 675.7352, unit: 'money' },
        { scope: 'today', label: '今日', value: 165_703_639 },
        { scope: 'today', label: '请求', value: 1642, unit: 'requests' },
        { scope: 'week', label: '本周', value: 2_462_706_917 },
        { scope: 'month', label: '本月', value: 3_300_664_529 },
        { scope: 'last7', label: '近 7 天', value: 2_462_706_917 },
        { scope: 'last30', label: '近 30 天', value: 3_375_903_004 },
      ],
    },
    numberFormat: 'short',
    wide: true,
    expanded: false,
    busy: false,
    onToggle: () => {},
    onRefresh: () => {},
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
const monthMarkupSource = {
  year: 2026,
  month: 9,
  stat: scopeStat(3_286_234_976, 14_429_553, 12_593, 186.0416),
  models: [],
  days: [
    { key: '2026-09-01', label: '2026-09-01', stat: scopeStat(136_723_417, 349_677, 449, 8.4302) },
    { key: '2026-09-15', label: '2026-09-15', stat: scopeStat(402_118_004, 1_004_551, 2_010, 22.3415) },
    { key: '2026-09-30', label: '2026-09-30', stat: scopeStat(5_086_508, 31_821, 31, 0.5116) },
  ],
  currency: 'CNY',
  costAvailable: true,
}

// ---------------------------------------------------- 图表页签的数据（tlogs.series）

/** 造一个原始 Stat（五类计量项）。 */
const rawStat = (hit, miss, out, req) => ({
  ...emptyStat(),
  PROMPT_CACHE_HIT_TOKEN: hit,
  PROMPT_CACHE_MISS_TOKEN: miss,
  RESPONSE_TOKEN: out,
  REQUEST: req,
})

/** 2024-04 → 2026-09 的月度合计（确定性伪随机，预览每次一致）——含金额。 */
const seriesMonths = []
for (let idx = 0; ; idx++) {
  const year = 2024 + Math.floor((3 + idx) / 12)
  const month = ((3 + idx) % 12) + 1
  if (year > 2026 || (year === 2026 && month > 9)) break
  // 缓慢增长 + 周期性波动，看起来像真实账单
  const base = 1.1e8 + idx * 9.4e6 + Math.sin(idx / 1.7) * 4.2e7
  const hit = Math.round(base * 8.2)
  const miss = Math.round(base * 0.42)
  const out = Math.round(base * 0.055)
  const req = Math.round(base / 21_000)
  // 金额与 token 同向增长，但早期月份刻意留「还没回补到金额」的空档，
  // 用来展示「缺金额 ≠ 0 元」与 costPartial 提示。
  const withCost = idx >= 2
  seriesMonths.push({
    key: `${year}-${String(month).padStart(2, '0')}`,
    stat: rawStat(hit, miss, out, req),
    ...(withCost ? { cost: round4((hit * 0.49 + miss * 0.18 + out * 0.33) / 6.4e6) } : {}),
  })
}

/** 近 40 天的逐日明细（用于按天粒度）。 */
const seriesDays = []
for (let i = 39; i >= 0; i--) {
  const d = new Date(Date.UTC(2026, 9, 7) - i * 86_400_000)
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
  const base = 4.1e7 + Math.sin(i / 2.1) * 1.6e7 + (i % 7 === 0 ? -2.2e7 : 0)
  const hit = Math.round(base * 7.4)
  const miss = Math.round(base * 0.5)
  const out = Math.round(base * 0.06)
  seriesDays.push({
    date: key,
    stat: rawStat(hit, miss, out, Math.round(base / 24_000)),
    cost: round4((hit * 0.49 + miss * 0.18 + out * 0.33) / 6.4e6),
  })
}

const seriesFixture = {
  from: '2024-04-01',
  to: '2026-10-07',
  days: seriesDays,
  months: seriesMonths,
  prior: rawStat(0, 0, 0, 0),
  priorCost: 0,
  costPartial: true,
  currency: 'CNY',
  costByType: { ...emptyStat(), PROMPT_CACHE_HIT_TOKEN: 331.204, PROMPT_CACHE_MISS_TOKEN: 121.68, RESPONSE_TOKEN: 223.1 },
  models: [
    { key: 'deepseek-flash', stat: rawStat(8_062_474_688, 402_118_004, 51_120_229, 50_141), cost: 621.4021 },
    { key: 'deepseek-v4-flash-vision-exp', stat: rawStat(522_440_832, 31_004_551, 1_492_111, 1_540), cost: 36.7237 },
    { key: 'deepseek-v4.1-flash-expires-on-0910', stat: rawStat(284_130_176, 12_004_551, 896_095, 903), cost: 23.6395 },
    { key: 'deepseek-v4-flash', stat: rawStat(60_288, 4_118, 9_118, 9), cost: 0.1253 },
  ],
  projects: [
    {
      id: 'a1b2c3d4e5f60718',
      label: 'tlogs',
      stat: rawStat(1_204_882_120, 62_004_551, 8_441_002, 9_820),
    },
    {
      id: '0f1e2d3c4b5a6978',
      label: 'deepseek-harness',
      stat: rawStat(402_118_004, 21_004_551, 3_004_551, 3_210),
    },
    {
      id: '9988776655443322',
      label: 'python_prj/项目日淘运费计算器',
      stat: rawStat(84_118_004, 4_204_551, 704_551, 612),
    },
  ],
  partial: false,
}

const detailMarkup = renderToStaticMarkup(
  React.createElement(DetailModal, {
    detail,
    monthDetail: monthMarkupSource,
    series: seriesFixture,
    seriesLoading: false,
    loading: false,
    busy: false,
    error: null,
    onClose: () => {},
    onRefresh: () => {},
    onSelectMonth: () => {},
    onLoadSeries: () => {},
  }),
)

/** 图表页签单独渲染一份：SSR 下没有 effect，于是正好是「初始状态」的样子。 */
const chartMarkup = renderToStaticMarkup(
  React.createElement(ChartPanel, {
    series: seriesFixture,
    loading: false,
    error: null,
    onLoad: () => {},
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
  /*
   * 深色 token 必须同时挂在 body 与带 data-ds-dark-theme 的**内联预览框**上。
   *
   * 原先只有 body[data-ds-dark-theme]，而深色示例用的是
   * <div class="frame" data-ds-dark-theme>，选择器根本不匹配 —— 于是深色框里
   * 组件拿到的还是浅色 token，表现为深底上的深色文字（几乎看不见）。这个坑一直
   * 在，正好在核对图表深色可读性时暴露出来。
   */
  body[data-ds-dark-theme], [data-ds-dark-theme] {
    --dsw-alias-label-primary: #e6edf3;
    --dsw-alias-label-tertiary: #8b949e;
    --dsw-alias-bg-layer-1: #21262d;
    --dsw-alias-bg-layer-2: #161b22;
    --dsw-alias-bg-base: #0d1117;
    --dsw-alias-border-l3: #30363d;
    --dsw-alias-border-l4: #3d444d;
    --dsw-alias-interactive-bg-hover: #21262d;
  }
  body[data-ds-dark-theme] {
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
  <div class="note">下面是模拟的侧边栏：上方虚线块代表工作区列表，控件固定在页脚区域内，完全参与正常文档流（不使用浮动定位）。
    默认指标是「总 Token · 总金额 · 今日 · 今日请求数」——金额项带 <code>unit: 'money'</code>，走金额格式（<code>¥675.74</code>）而不是 token 缩写。</div>
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
  <div class="note">
    七张卡片：<b>总消耗 / 当前项目消耗 / 今日 / 当周 / 当月 / 近 7 天 / 近 30 天</b>。
    「近 7 天 / 近 30 天」是<b>滚动窗口</b>（含今天、往前数 N 天），与开放平台控制台的
    「时间维度」同口径 —— 这正是此前「插件和控制台对不上」的原因：以前只有「本月」
    （自然月 1 日至今），而控制台截图用的是「近 30 天」。
    <br>每张卡片的 ¥ 来自 <code>/api/v0/usage/cost</code>（金额接口，与 <code>usage/amount</code> 同构，
    逐日日期逐个相同）；<b>没有金额数据时整行 ¥ 不渲染</b>，而不是显示 ¥0.00。
    「当前项目消耗」读的是本机会话投影，平台账单里没有它的金额，所以刻意没有 ¥。
    <br>底部一行还给出平台账户概览：<b>余额</b>与<b>官方累计消费</b>（<code>get_user_summary</code>），
    后者就是控制台账单页那个数字，用来和插件按接口重算的金额对照。
  </div>
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

  <h2>详细数据弹窗 <small>含日历查询：点某一天看当天明细，可换月回溯；每格带当天金额</small></h2>
  <div class="note">
    弹窗是真正的浮层（<code>position: fixed</code> 遮罩 + 居中对话框），所以在应用里它会
    盖住整个界面。下面的预览把它「就地化」以便内联查看：仅对预览页覆盖遮罩的定位，
    组件本身的样式与结构不变。
    <br>日历每格固定三行（日号 / token / ¥），并且<b>始终渲染 42 格</b> —— 无论切到哪个月，
    弹窗高度都不会变。
  </div>
  <style>
    .preview-modal .tlogs-modal-mask { position: static; padding: 0; background: none; }
    .preview-modal .tlogs-modal { width: 720px; max-width: 100%; max-height: none; }
  </style>
  <div class="preview-modal">${detailMarkup}</div>

  <h2>图表页签 <small>折线图 + 环形饼图 + 堆叠柱状图：范围 × 数据源 × 指标 × 粒度全部联动</small></h2>
  <div class="note">
    三张图共享上面那排控制项：<b>范围</b>（有史以来 / 自定义 / 今日 / 本周 / 本月 / <b>近 7 天</b> / <b>近 30 天</b>）、
    <b>数据源</b>（平台账单 / 指定项目）、<b>指标</b>（总 Token / 输入 / 输出 / 缓存命中 / 缓存未命中 / 请求数 / <b>消费金额 (¥)</b>）、
    <b>粒度</b>（自动 / 天 / 月 / 年）与<b>口径</b>（每期新增 / 累计）。
    悬停任一数据点会把明细显示在图表下方的固定信息条里（不做跟随鼠标的浮层，避免浮动定位与高度抖动）。
    <br>金额指标不能走 token 的缩写格式化 —— <code>¥172.48</code> 被缩成 <code>172</code> 就与 token 数分不清了，
    因此金额有独立的单位分支与格式化函数。
    <br>「指定项目」的数据来自插件自身的逐日快照 —— 平台账单接口没有项目维度，因此该项无法回溯到插件启用之前。
  </div>
  <style>
    .chart-preview { width: 760px; max-width: 100%; padding: 12px; border: 1px solid var(--dsw-alias-border-l4); border-radius: 10px; background: var(--dsw-alias-bg-base); }
    .chart-preview .tlogs { font-size: 12px; }
    .chart-preview .tlogs-modal-body { padding: 0; min-height: 0; }
  </style>
  <div class="chart-preview">
    <div class="tlogs"><div class="tlogs-modal-body">${chartMarkup}</div></div>
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
  <div class="note">
    图表在深色下的可读性单看一份：折线/面积、堆叠柱与图例的前三色都是中间明度的固定色，
    不依赖宿主语义 token，因此浅深两套主题下都成立。
  </div>
  <div class="row">
    <div class="frame chart-preview" data-ds-dark-theme style="background:#0d1117">
      <div class="cap">图表页签（深色）</div>
      <div class="tlogs"><div class="tlogs-modal-body">${chartMarkup}</div></div>
    </div>
  </div>

  <h2>宽度退化 <small>即使把 8 项指标都配回来，数字也不该被裁掉</small></h2>
  <div class="note">
    默认放「总 · 总 ¥ · 今日 · 今日请求数」，因此正常宽度下绰绰有余。下面刻意把全部 8 项
    都放回来，在最窄的侧边栏里验证：数字不可压缩、只有标签会让位 —— 若你看到数字自身被截断，
    说明这个回归又回来了。金额项同理：<code>flex: 0 0 auto</code>，宁可让标签省略也不把
    <code>¥675.74</code> 压成 <code>¥1…</code>。
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
