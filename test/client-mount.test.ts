/**
 * 内嵌挂载 / 卸载 / 交互测试。
 *
 * 这是本插件 UI 侧最强的自动化证据，覆盖验收 7.1 与 7.3：
 *  - bundle 以包名注册，且只 require 平台种子表里的 react（自包含）
 *  - `apply(ctx)` 把组件注册到 `sidebar.footer.action` 席位（带 id 与 inject share）
 *  - 组件真的能渲染出紧凑条与数据
 *  - 点击展开按钮后面板**就地展开**（同一容器内新增面板，不新窗口、不弹 Modal）
 *  - 点击「详细数据」切到详细视图，再点「返回」回到面板
 *  - 卸载后组件 DOM 被清理干净
 *  - 插件作用域销毁后注入的 <style> 被移除（需求 7.5「不残留 DOM 节点」）
 *
 * 注意：真实 slot 渲染器会把注册项的 `inject` share 合并进组件 props，
 * 因此这里的 `mount()` 也照做 —— 否则 rpc 注入缺失，测的就不是真实行为。
 */

import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { JSDOM } from 'jsdom'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

import { loadClientBundle } from './helpers/loader.ts'
import { emptyStat, type UsageSnapshot } from '../lib/types.js'

// ------------------------------------------------------------------ jsdom 环境

let dom: JSDOM
const g = globalThis as unknown as Record<string, unknown>
const originalGlobals = new Map<string, PropertyDescriptor | undefined>()

function defineGlobal(name: string, value: unknown): void {
  if (!originalGlobals.has(name)) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  }
  // Node 里部分全局（如 navigator）是只读 getter，必须用 defineProperty 覆盖。
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
}

before(() => {
  dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    pretendToBeVisual: true,
    url: 'http://127.0.0.1:19387/',
  })
  defineGlobal('window', dom.window)
  defineGlobal('document', dom.window.document)
  defineGlobal('HTMLElement', dom.window.HTMLElement)
  defineGlobal('Element', dom.window.Element)
  defineGlobal('Node', dom.window.Node)
  defineGlobal('MutationObserver', dom.window.MutationObserver)
  defineGlobal('getComputedStyle', dom.window.getComputedStyle.bind(dom.window))
  defineGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0))
  defineGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  // React 18 要求显式声明处于 act() 环境，否则会打印告警。
  defineGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})

after(() => {
  dom.window.close()
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else delete g[name]
  }
})

/** 每个用例从干净 DOM 开始：清空 body 并移除上一条用例注入的样式表。 */
beforeEach(() => {
  for (const el of Array.from(dom.window.document.querySelectorAll('body > div'))) el.remove()
  dom.window.document.getElementById('tlogs-style')?.remove()
  const root = dom.window.document.createElement('div')
  root.id = 'root'
  dom.window.document.body.appendChild(root)
})

// ------------------------------------------------------------------ 假数据

function statWith(input: number, output: number, requests: number) {
  const s = emptyStat()
  s.PROMPT_CACHE_HIT_TOKEN = input
  s.RESPONSE_TOKEN = output
  s.REQUEST = requests
  return s
}

function scopeStat(input: number, output: number, requests: number) {
  return {
    raw: statWith(input, output, requests),
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    requests,
  }
}

function snapshotFixture(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return {
    auth: { status: 'ok', source: 'credentials' },
    cards: [
      { scope: 'total', label: '总消耗 Token', stat: scopeStat(1_650_000_000, 399_575, 533) },
      {
        scope: 'total',
        label: '当前项目消耗',
        stat: scopeStat(1000, 100, 1),
        options: [
          { id: '/a/one', label: 'one', stat: scopeStat(1000, 100, 1) },
          { id: '/a/two', label: 'two', stat: scopeStat(2000, 200, 2) },
        ],
        selectedOptionId: '/a/one',
      },
      { scope: 'today', label: '今日消耗', stat: scopeStat(45_600, 1200, 12) },
      { scope: 'week', label: '当周消耗', stat: scopeStat(320_000, 9000, 88) },
      { scope: 'month', label: '当月消耗', stat: scopeStat(1_200_000, 30_000, 300) },
    ],
    compact: [
      { scope: 'total', label: '总', value: 1_650_399_575 },
      { scope: 'today', label: '今日', value: 46_800 },
      // 今日请求数：紧跟在今日 token 右侧（同一个 scope，用 unit 区分）
      { scope: 'today', label: '请求', value: 1600, unit: 'requests' },
      { scope: 'week', label: '本周', value: 329_000 },
      { scope: 'month', label: '本月', value: 1_230_000 },
    ],
    stale: false,
    lastUpdatedAt: Date.now(),
    loading: false,
    display: { numberFormat: 'short', enableDetailView: true, defaultExpanded: false, loginAvailable: true },
    ...overrides,
  }
}

const detailFixture = {
  models: [
    { key: 'deepseek-flash', label: 'deepseek-flash', stat: scopeStat(1000, 500, 3) },
    { key: 'deepseek-v4-pro', label: 'deepseek-v4-pro', stat: scopeStat(2000, 100, 1) },
  ],
  years: [{ key: '2026', label: '2026 年', stat: scopeStat(3000, 600, 4) }],
  months: [{ key: '2026-09', label: '2026-09', stat: scopeStat(3000, 600, 4) }],
  days: [{ key: '2026-09-01', label: '2026-09-01', stat: scopeStat(3000, 600, 4) }],
}

/** 日历查询用的单月明细（tlogs.month 的返回）。 */
const monthFixture = {
  year: 2026,
  month: 9,
  stat: scopeStat(3000, 600, 4),
  models: [{ key: 'deepseek-flash', label: 'deepseek-flash', stat: scopeStat(3000, 600, 4) }],
  days: [
    { key: '2026-09-01', label: '2026-09-01', stat: scopeStat(1000, 100, 1) },
    { key: '2026-09-30', label: '2026-09-30', stat: scopeStat(2000, 500, 3) },
  ],
}

/** 图表数据（tlogs.series 的返回）。 */
const seriesFixture = {
  from: '2026-09-01',
  to: '2026-09-03',
  days: [
    { date: '2026-09-01', stat: statWith(1000, 100, 1) },
    { date: '2026-09-02', stat: statWith(2000, 200, 2) },
    { date: '2026-09-03', stat: statWith(3000, 300, 3) },
  ],
  months: [{ key: '2026-09', stat: statWith(6000, 600, 6) }],
  prior: statWith(500, 50, 5),
  models: [{ key: 'deepseek-flash', stat: statWith(6000, 600, 6) }],
  projects: [{ id: '0123456789abcdef', label: 'tlogs', stat: statWith(1000, 100, 1) }],
  partial: false,
}

/** 造一个假的 host RPC。`loginFailure` 非空时 tlogs.login 返回失败信封。 */
function makeConnection(
  snapshot: UsageSnapshot,
  opts: {
    loginFailure?: string
    calls?: string[]
    detail?: unknown
    series?: unknown
    payloads?: Array<{ endpoint: string; payload: unknown }>
  } = {},
) {
  return {
    rpc: {
      call: async (_channel: string, endpoint: string, payload: unknown) => {
        opts.calls?.push(endpoint)
        opts.payloads?.push({ endpoint, payload })
        switch (endpoint) {
          case 'tlogs.snapshot':
            return { ok: true, value: snapshot }
          case 'tlogs.detail':
            return { ok: true, value: opts.detail ?? detailFixture }
          case 'tlogs.month':
            return { ok: true, value: monthFixture }
          case 'tlogs.series':
            return { ok: true, value: opts.series ?? seriesFixture }
          case 'tlogs.refresh':
            return { ok: true, value: { started: false } }
          case 'tlogs.login':
            if (opts.loginFailure) {
              return { ok: false, error: { code: 'login-failed', message: opts.loginFailure } }
            }
            return { ok: true, value: { ok: true } }
          default:
            return { ok: true, value: { ok: true } }
        }
      },
    },
  }
}

/** 造一个客户端 ctx，记录 slot 注册与 effect。 */
function makeCtx(
  snapshot: UsageSnapshot,
  opts: {
    loginFailure?: string
    detail?: unknown
    series?: unknown
    payloads?: Array<{ endpoint: string; payload: unknown }>
  } = {},
) {
  const registrations: Array<{ slot: string; options: Record<string, unknown>; component: unknown }> = []
  const cleanups: Array<() => void> = []
  /** 记录客户端实际调用过的 RPC endpoint。 */
  const rpcCalls: string[] = []

  const ctx = {
    connection: makeConnection(snapshot, { ...opts, calls: rpcCalls }),
    effect: (fn: () => unknown) => {
      const disposer = fn()
      if (typeof disposer === 'function') cleanups.push(disposer as () => void)
      return disposer
    },
    slots: {
      inject: (name: string, cb: () => unknown) => cb(),
      register: (options: Record<string, unknown>, component: unknown) => {
        registrations.push({ slot: String(options.name), options, component })
        return () => {}
      },
    },
  }
  return { ctx, registrations, cleanups, rpcCalls }
}

const doc = () => dom.window.document

// ------------------------------------------------------------------ 测试

test('bundle 以包名注册，且只 require react（自包含）', () => {
  const client = loadClientBundle()
  assert.equal(client.id, 'dsh-tlogs', 'id 必须等于解析出的包名，否则 DSH 会拒绝注册')
  assert.deepEqual(client.inject, ['connection', 'slots'])
  // esbuild 会为每个被打包的模块各生成一次 require("react")（模块系统会记忆化），
  // 关键不变量是：**没有任何非 react 的请求**，即 bundle 完全自包含。
  assert.ok(client.requiredSpecs.length > 0, '应至少请求一次 react')
  const nonReact = client.requiredSpecs.filter((s) => s !== 'react')
  assert.deepEqual(nonReact, [], `除 react 外不得 require 任何模块，实际多出：${nonReact.join(', ')}`)
  assert.equal(typeof client.apply, 'function')
})

test('apply 把组件注册进 sidebar.footer.action 席位，并提供 rpc 注入', () => {
  const client = loadClientBundle()
  const { ctx, registrations } = makeCtx(snapshotFixture())
  client.apply(ctx)

  assert.equal(registrations.length, 1)
  const reg = registrations[0]!
  assert.equal(reg.slot, 'sidebar.footer.action', '必须挂到侧边栏页脚席位')
  assert.equal(reg.options.id, 'tlogs')
  assert.equal(typeof reg.component, 'function', '注册项必须是一个组件')

  const share = (reg.options.inject as () => Record<string, unknown>)()
  assert.ok(share.rpc, 'inject share 应提供 rpc')
})

test('apply 注入 <style> 并在销毁时移除（不残留 DOM）', () => {
  const client = loadClientBundle()
  const { ctx, cleanups } = makeCtx(snapshotFixture())

  client.apply(ctx)
  const tag = doc().getElementById('tlogs-style')
  assert.ok(tag, '应注入样式表')
  assert.equal(tag.getAttribute('data-plugin'), 'tlogs', '应打上 data-plugin 以便模块系统回收')
  assert.ok(tag.textContent && tag.textContent.includes('tlogs-compact'), '样式内容应包含组件类名')
  // 需求 1.1：内嵌部分（紧凑条 / 展开面板）不得用 position: fixed/absolute 伪造悬浮。
  // 例外：详细数据**弹窗**的遮罩与对话框 —— 弹窗本来就该是浮层，否则窄侧边栏里
  // 放不下日历与表格。这里把内嵌部分单独切出来断言，避免例外把整条规则废掉。
  const cssText = tag.textContent ?? ''
  // 先剥掉 CSS 注释：注释里提到 "position: fixed"（用来说明例外）不该被当成规则。
  const cssNoComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  const modalAt = cssNoComments.indexOf('.tlogs-modal-mask')
  assert.ok(modalAt > 0, '应能在样式里找到弹窗部分的边界')
  const embeddedCss = cssNoComments.slice(0, modalAt)
  assert.ok(
    !/position:\s*(fixed|absolute)/.test(embeddedCss),
    '内嵌的紧凑条与展开面板不得使用 fixed/absolute 定位',
  )
  assert.match(
    cssNoComments,
    /\.tlogs-modal-mask\s*\{[^}]*position:\s*fixed/,
    '弹窗遮罩应使用 fixed 浮层',
  )

  /*
   * 回归：**弹窗尺寸必须恒定**（用户明确要求「无论怎么样，弹窗的大小决不能变化」）。
   *
   * 此前是 `max-height: 82vh` + body 的 `min-height`，高度于是变成内容的函数：
   * 日历页签 6 行固定、图表页签堆三张图很高、表格页签行数不定，切页签时弹窗会伸缩。
   * 现在宽高都写死，多出来的内容由 body 内部滚动消化。
   */
  const modalCss = /\.tlogs-modal\s*\{([^}]*)\}/.exec(cssNoComments)?.[1] ?? ''
  assert.match(modalCss, /height:\s*min\(/, '弹窗高度必须写死（随视口收缩），不能由内容决定')
  assert.equal(
    /max-height/.test(modalCss),
    false,
    '不得再用 max-height —— 那正是「切页签弹窗变大变小」的成因',
  )
  const modalBodyCss = /\.tlogs-modal-body\s*\{([^}]*)\}/.exec(cssNoComments)?.[1] ?? ''
  assert.match(modalBodyCss, /flex:\s*1 1 auto/, 'body 必须吃掉剩余高度')
  assert.match(modalBodyCss, /min-height:\s*0/, 'body 的 min-height 必须是 0，否则又会被内容撑开')
  assert.match(modalBodyCss, /overflow-y:\s*auto/, '内容超出时由 body 内部滚动')
  assert.equal(
    /min-height:\s*min\(/.test(modalBodyCss),
    false,
    'body 不该再写 min-height: min(...)：那会让弹窗高度跟着内容走',
  )
  // 图形舞台固定下界：三张图高度不同，切子标签也不该上下跳
  const stageCss = /\.tlogs-chart-stage\s*\{([^}]*)\}/.exec(cssNoComments)?.[1] ?? ''
  assert.match(stageCss, /min-height:/, '图形舞台必须有固定下界，避免切图时内容跳动')

  // 回归：展开按钮必须是**看得见**的按钮。早前它是 10px、无边框、用 tertiary 灰，
  // 在侧边栏页脚底色上几乎不可辨认（用户实测反馈「▾ 不太能看得清」）。
  const iconbtn = /\.tlogs-iconbtn\s*\{([^}]*)\}/.exec(tag.textContent ?? '')?.[1] ?? ''
  assert.match(iconbtn, /width:\s*20px/, '展开按钮应有明确尺寸，不能是微不足道的小字形')
  assert.match(iconbtn, /border:\s*1px solid/, '展开按钮应有可见描边')
  assert.match(iconbtn, /background:/, '展开按钮应有可见底色')
  assert.match(iconbtn, /color:\s*var\(--tlogs-fg\)/, '展开按钮应使用主文字色，而非 tertiary 灰')
  assert.ok(
    /\.tlogs-compact:hover|\.tlogs-compact\s*\{[^}]*cursor:\s*pointer/.test(tag.textContent ?? ''),
    '紧凑条本身应是可点区域（整条点击展开）',
  )

  // 回归：紧凑条「文字显示不全」的修复必须留在样式里。
  // 实测症状是末尾指标被右边缘裁掉（最后一项显示成「本月 359」而不是「359M」）。
  const css = tag.textContent ?? ''
  assert.equal(css.includes('.tlogs-logo'), false, 'Σ 徽标的样式应已删除')
  const metricValue = /\.tlogs-metric-value\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  assert.match(
    metricValue,
    /flex:\s*0 0 auto/,
    '数字必须不可压缩：否则空间一紧就把数字本身截断（这正是「显示不全」的成因）',
  )
  const metricLabel = /\.tlogs-metric-label\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  assert.match(
    metricLabel,
    /flex:\s*0 0 auto/,
    '标签不得参与收缩：宁可整项换行，也不能被压成认不出的碎片',
  )
  assert.equal(
    /text-overflow:\s*ellipsis/.test(metricLabel),
    false,
    '标签不应再用省略号截断 —— 实测四个指标时标签会被全部压没（只剩数字）',
  )
  const metricsCss = /\.tlogs-metrics\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  assert.match(
    metricsCss,
    /flex-wrap:\s*wrap/,
    '指标行挤不下时应整项换行，而不是压缩标签',
  )
  // 回归：指标少的时候右侧空一大片（实测「总 8.9B 今日 0 请求 0」挤在左侧）。
  // 修法是让每个指标均分空余宽度（间距自动变大），并保留一个间距下限。
  const metricCss = /\.tlogs-metric\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  assert.match(
    metricCss,
    /flex:\s*1 0 auto/,
    '指标应伸展以均分空余宽度（间距随侧边栏变宽而变大），但收缩仍为 0（不得压碎内容）',
  )
  assert.match(
    metricsCss,
    /column-gap:\s*12px/,
    '指标间距下限 12px：指标多到填满一行、无可分配空余时仍要有分隔',
  )
  assert.ok(css.includes('.tlogs-collapsed-value'), '收起态的数值样式应存在（替代已删除的 Σ 徽标）')

  // 回归：展开面板「第五张卡片被截断」的修复必须留在样式里。
  // 实测症状：写死的 max-height 300px 装不下五张卡片，当月消耗被裁、必须滚动。
  const panelCss = /\.tlogs-panel\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  assert.match(
    panelCss,
    /max-height:\s*min\(/,
    '展开面板的高度上限必须随视口放宽，否则内容会被截断',
  )
  assert.equal(
    /max-height:\s*300px/.test(panelCss),
    false,
    '不得再写死 300px —— 那正是截断当月消耗卡片的原因',
  )

  // 总消耗是主指标：必须横跨整行（与「当月消耗」曾经的样子同款宽条）。
  assert.match(
    css,
    /\.tlogs-w-full \.tlogs-cards > :first-child\s*\{[^}]*grid-column:\s*1 \/ -1/,
    '总消耗卡片必须占满一整行',
  )
  assert.equal(
    /:last-child:nth-child\(odd\)/.test(css),
    false,
    '已移除「最后一张横跨」规则：主指标占整行后它会在网格里挤出空位',
  )

  assert.equal(cleanups.length, 1, '应注册一个 effect 用于清理')
  cleanups[0]!()
  assert.equal(doc().getElementById('tlogs-style'), null, '销毁后样式表必须被移除')
})

test('缺少 slots 能力时 apply 不应抛错（优雅降级）', () => {
  const client = loadClientBundle()
  const cleanups: Array<() => void> = []
  const ctx = {
    effect: (fn: () => unknown) => {
      const d = fn()
      if (typeof d === 'function') cleanups.push(d as () => void)
    },
  }
  assert.doesNotThrow(() => client.apply(ctx))
  assert.ok(doc().getElementById('tlogs-style'), '样式仍应注入，便于后续排查')
  cleanups.forEach((c) => c())
})

test('渲染紧凑条，点击展开后就地展开面板，可进入详细视图并返回', async () => {
  const client = loadClientBundle()
  const snapshot = snapshotFixture()
  const { ctx, registrations } = makeCtx(snapshot)
  client.apply(ctx)

  const reg = registrations[0]!
  const Component = reg.component as React.ComponentType<Record<string, unknown>>
  const share = (reg.options.inject as () => Record<string, unknown>)()
  const container = doc().getElementById('root')!
  const root: Root = createRoot(container as unknown as Element)

  /** 模拟真实 slot 渲染器：把 inject share 合并进 props。 */
  const render = async (props: Record<string, unknown> = {}) => {
    await act(async () => {
      root.render(React.createElement(Component, { ...share, ...props }))
      // 让 store 的异步快照链（refresh → reload → setState）跑完
      await new Promise((r) => setTimeout(r, 0))
    })
  }

  const q = (sel: string) => container.querySelector(sel)
  const text = () => container.textContent ?? ''

  try {
    // ---- 形态 A：紧凑条 ----
    await render({ wide: true })
    assert.ok(q('.tlogs-compact'), '应渲染紧凑条')
    // Σ 已按要求删除：徽标与总计标签都不应再出现
    assert.equal(text().includes('Σ'), false, '紧凑条不得再出现任何 Σ 符号')
    assert.equal(q('.tlogs-logo'), null, 'Σ 徽标应已删除')
    // numberFormat=short：1,650,399,575 → 1.7B
    assert.ok(/1\.7B/.test(text()), `紧凑条应显示缩写后的总量，实际：${text()}`)
    assert.ok(text().includes('总'), '总计应带「总」标签')
    assert.ok(text().includes('今日'), '紧凑条应包含今日指标')
    // 今日请求数必须紧跟在今日 token 右侧
    assert.ok(text().includes('请求'), '紧凑条应包含今日请求数')
    assert.match(text(), /1\.6K/, '今日请求数也应缩写显示')
    const labels = Array.from(container.querySelectorAll('.tlogs-metric-label')).map(
      (e) => e.textContent,
    )
    assert.deepEqual(
      labels.slice(0, 3),
      ['总', '今日', '请求'],
      '今日请求数必须紧跟在今日 token 之后（顺序不能错）',
    )
    const reqTitle = container
      .querySelectorAll('.tlogs-metric')[2]
      ?.getAttribute('title')
    assert.match(reqTitle ?? '', /次请求/, '请求数的 tooltip 应说「次请求」而不是 tokens')
    assert.equal(q('.tlogs-panel'), null, '默认收起时不应渲染面板')

    // ---- 点击展开按钮 ----
    const toggle = q('button[aria-label*="展开"]')
    assert.ok(toggle, '应存在展开按钮')
    await act(async () => {
      ;(toggle as unknown as HTMLElement).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })

    // 需求 1.2：就地展开（同一容器内新增面板），而不是新窗口/Modal
    assert.ok(q('.tlogs-panel'), '展开后应出现面板')
    assert.equal(doc().querySelectorAll('.tlogs-panel').length, 1, '面板必须在同一容器内')
    assert.equal(doc().querySelector('[role="dialog"]'), null, '不得使用 Modal 覆盖层')

    // 需求 1.3：五张卡片
    const cards = container.querySelectorAll('.tlogs-card')
    assert.equal(cards.length, 5, `应渲染五张卡片，实际 ${cards.length}`)
    for (const label of ['总消耗 Token', '当前项目消耗', '今日消耗', '当周消耗', '当月消耗']) {
      assert.ok(text().includes(label), `应包含卡片「${label}」`)
    }
    assert.ok(text().includes('输入'), '卡片应显示输入')
    assert.ok(text().includes('输出'), '卡片应显示输出')
    assert.ok(text().includes('请求'), '卡片应显示请求次数')

    // 底部一行
    assert.ok(text().includes('详细数据'), '应有详细数据入口')
    assert.ok(text().includes('刷新'), '应有刷新按钮')
    assert.ok(text().includes('退出登录'), '应有退出登录按钮')

    // ---- 打开详细数据弹窗 ----
    const detailBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('详细数据'),
    ) as unknown as HTMLElement | undefined
    assert.ok(detailBtn, '应存在详细数据按钮')
    await act(async () => {
      detailBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })

    const dialog = doc().querySelector('[role="dialog"]')
    assert.ok(dialog, '点「详细数据」应打开弹窗')
    assert.ok(dialog!.classList.contains('tlogs-modal'), '弹窗应渲染对话框容器')
    // 页签：日历 + 图表 + 模型 / 供应商 / 年 / 月 / 当月按天
    // 「供应商」是本机口径的表（含平台账单看不到的供应商与其模型），与平台口径的
    // 「模型」表并列，所以是 7 个页签。
    const tabLabels = Array.from(dialog!.querySelectorAll('.tlogs-tab')).map((t) => t.textContent)
    assert.deepEqual(
      tabLabels,
      ['日历', '图表', '模型', '供应商', '年', '月', '当月按天'],
      '弹窗应有日历、图表、模型、供应商与年/月/当月按天页签',
    )
    // 默认停在日历页，且日历是「周一起始」的 7 列网格
    assert.equal(dialog!.querySelectorAll('.tlogs-cal-head').length, 7, '日历应有 7 个星期标题')
    assert.ok(dialog!.querySelectorAll('.tlogs-cal-cell').length >= 28, '日历应有日期格子')

    // 关掉弹窗
    const closeBtn = dialog!.querySelector('button[aria-label="关闭详细数据"]') as unknown as HTMLElement
    assert.ok(closeBtn, '弹窗应有关闭按钮')
    await act(async () => {
      closeBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    assert.equal(doc().querySelector('[role="dialog"]'), null, '关闭后弹窗应消失')
    assert.ok(q('.tlogs-panel'), '关掉弹窗后展开面板仍在')
  } finally {
    await act(async () => {
      root.unmount()
    })
  }

  assert.equal(container.childNodes.length, 0, '卸载后组件 DOM 必须被清理')
  assert.equal(container.querySelectorAll('.tlogs').length, 0)
})

test('日历弹窗：向 host 拉取该月逐日明细，点击某天显示当天数字', async () => {
  const client = loadClientBundle()
  const { ctx, registrations, rpcCalls } = makeCtx(snapshotFixture())
  client.apply(ctx)
  const reg = registrations[0]!
  const Component = reg.component as React.ComponentType<Record<string, unknown>>
  const share = (reg.options.inject as () => Record<string, unknown>)()

  const container = doc().createElement('div')
  doc().body.appendChild(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => {
      root.render(React.createElement(Component, { ...share, wide: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    // 展开面板
    const bar = container.querySelector('.tlogs-compact') as unknown as HTMLElement
    await act(async () => {
      bar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    // 打开详细数据弹窗
    const detailBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('详细数据'),
    ) as unknown as HTMLElement | undefined
    await act(async () => {
      detailBtn!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })

    assert.ok(rpcCalls.includes('tlogs.month'), '打开日历应向 host 请求该月逐日明细')

    const dialog = doc().querySelector('[role="dialog"]')!
    const cell = dialog.querySelector('[data-date="2026-09-01"]') as unknown as HTMLElement
    assert.ok(cell, '日历应有 2026-09-01 的格子')
    assert.match(cell.getAttribute('title') ?? '', /tokens/, '格子 tooltip 应含当日用量')

    await act(async () => {
      cell.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const text = dialog.textContent ?? ''
    assert.match(text, /2026-09-01/, '点选某天后应显示该日明细')
    // scopeStat(1000, 100, 1) → 总 1100 → 缩写 1.1K
    assert.match(text, /1\.1K/, '应显示当天的 token 数')
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('日历默认落在最新月份（不依赖 host 下发顺序）', async () => {
  // 实测踩过的坑：host 若按降序下发月份，取数组末项就会默认到更早的月份。
  const detail = {
    ...detailFixture,
    months: [
      { key: '2026-09', label: '2026-09', stat: scopeStat(3000, 600, 4) },
      { key: '2026-08', label: '2026-08', stat: scopeStat(2000, 400, 2) },
    ],
  }
  const client = loadClientBundle()
  const { ctx, registrations } = makeCtx(snapshotFixture(), { detail })
  client.apply(ctx)
  const reg = registrations[0]!
  const Component = reg.component as React.ComponentType<Record<string, unknown>>
  const share = (reg.options.inject as () => Record<string, unknown>)()

  const container = doc().createElement('div')
  doc().body.appendChild(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => {
      root.render(React.createElement(Component, { ...share, wide: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const bar = container.querySelector('.tlogs-compact') as unknown as HTMLElement
    await act(async () => {
      bar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const detailBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('详细数据'),
    ) as unknown as HTMLElement | undefined
    await act(async () => {
      detailBtn!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })

    const select = doc().querySelector('.tlogs-cal-select') as unknown as HTMLSelectElement
    assert.ok(select, '日历应有月份选择器')
    assert.equal(select.value, '2026-09', '默认必须落在最新月份，而不是数组末项')
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('日历始终渲染 42 格（6 行）：切换月份不改变弹窗尺寸', async () => {
  // 实测问题：7 月只要 5 行、8 月要 6 行，切月时弹窗高度会跳一下。
  // 修法是固定渲染 42 格（不足补空格），这条测试把该不变量钉住。
  const detail = {
    ...detailFixture,
    months: [
      { key: '2026-09', label: '2026-09', stat: scopeStat(3000, 600, 4) },
      { key: '2026-08', label: '2026-08', stat: scopeStat(2000, 400, 2) },
    ],
  }
  const client = loadClientBundle()
  const { ctx, registrations } = makeCtx(snapshotFixture(), { detail })
  client.apply(ctx)
  const reg = registrations[0]!
  const Component = reg.component as React.ComponentType<Record<string, unknown>>
  const share = (reg.options.inject as () => Record<string, unknown>)()

  const container = doc().createElement('div')
  doc().body.appendChild(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => {
      root.render(React.createElement(Component, { ...share, wide: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const bar = container.querySelector('.tlogs-compact') as unknown as HTMLElement
    await act(async () => {
      bar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const detailBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('详细数据'),
    ) as unknown as HTMLElement | undefined
    await act(async () => {
      detailBtn!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })

    const cellCount = () => doc().querySelectorAll('.tlogs-cal-cell').length
    assert.equal(cellCount(), 42, '日历必须固定 42 格（6 行）')

    // 切到 2026-08（本身就需要 6 行）
    const select = doc().querySelector('.tlogs-cal-select') as unknown as HTMLSelectElement
    assert.ok(select, '应有月份选择器')
    await act(async () => {
      select.value = '2026-08'
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    assert.equal(select.value, '2026-08', '应已切到 8 月')
    assert.equal(cellCount(), 42, '切月后仍是 42 格')
    // 8 月 1 号是周六 → 5 个前置空格 + 31 天 = 36，再补 6 个尾部空格
    assert.equal(doc().querySelectorAll('.tlogs-cal-cell.is-empty').length, 11)
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('侧边栏收起时只显示图标（wide=false）', async () => {
  const client = loadClientBundle()
  const { ctx, registrations } = makeCtx(snapshotFixture())
  client.apply(ctx)
  const reg = registrations[0]!
  const Component = reg.component as React.ComponentType<Record<string, unknown>>
  const share = (reg.options.inject as () => Record<string, unknown>)()

  const container = doc().createElement('div')
  doc().body.appendChild(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => {
      root.render(React.createElement(Component, { ...share, wide: false }))
      await new Promise((r) => setTimeout(r, 0))
    })
    assert.ok(container.querySelector('.tlogs-collapsed'), '收起态应加 collapsed 类')
    assert.equal(container.querySelector('.tlogs-metrics'), null, '收起态不应渲染指标文本')
    // Σ 徽标删除后，收起态改为显示总计数字（否则只剩下一个孤零零的三角按钮）
    const collapsed = container.querySelector('.tlogs-collapsed-value')
    assert.ok(collapsed, '收起态应显示总计数字')
    assert.ok(
      /1\.7B/.test(collapsed!.textContent ?? ''),
      `收起态应显示缩写后的总计，实际：${collapsed!.textContent}`,
    )
    assert.equal(collapsed!.textContent?.includes('Σ'), false)
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('token 失效时面板顶部提示重新登录（需求 2.4 / 5.2）', async () => {
  const client = loadClientBundle()
  const snapshot = snapshotFixture({
    auth: { status: 'invalid', message: '401 认证失败（userToken 失效）' },
  })
  const { ctx, registrations } = makeCtx(snapshot)
  client.apply(ctx)
  const reg = registrations[0]!
  const Component = reg.component as React.ComponentType<Record<string, unknown>>
  const share = (reg.options.inject as () => Record<string, unknown>)()

  const container = doc().createElement('div')
  doc().body.appendChild(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => {
      root.render(React.createElement(Component, { ...share, wide: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const toggle = container.querySelector('button[aria-label*="展开"]') as unknown as HTMLElement
    await act(async () => {
      toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const text = container.textContent ?? ''
    assert.ok(text.includes('需要重新登录'), `应提示重新登录，实际：${text}`)
    assert.ok(text.includes('登录'), '应提供登录入口')
    assert.ok(text.includes('手动填写'), '应提供手动填写 userToken 兜底')
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('数据可能过期时紧凑条显示角标（需求 5.4）', async () => {
  const client = loadClientBundle()
  const snapshot = snapshotFixture({ stale: true, error: 'HTTP 500: oops' })
  const { ctx, registrations } = makeCtx(snapshot)
  client.apply(ctx)
  const reg = registrations[0]!
  const Component = reg.component as React.ComponentType<Record<string, unknown>>
  const share = (reg.options.inject as () => Record<string, unknown>)()

  const container = doc().createElement('div')
  doc().body.appendChild(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => {
      root.render(React.createElement(Component, { ...share, wide: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const badge = container.querySelector('.tlogs-stale')
    assert.ok(badge, '过期数据应显示角标')
    assert.match(badge.getAttribute('title') ?? '', /HTTP 500/, '角标 tooltip 应说明原因')
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

// ------------------------------------------------ 登录入口可用性（实测回归）

/** 挂载组件并展开面板，返回容器与文本。 */
async function mountExpanded(snapshot: UsageSnapshot, opts: { loginFailure?: string } = {}) {
  const client = loadClientBundle()
  const { ctx, registrations } = makeCtx(snapshot, opts)
  client.apply(ctx)
  const reg = registrations[0]!
  const Component = reg.component as React.ComponentType<Record<string, unknown>>
  const share = (reg.options.inject as () => Record<string, unknown>)()

  const container = doc().createElement('div')
  doc().body.appendChild(container)
  const root = createRoot(container as unknown as Element)

  await act(async () => {
    root.render(React.createElement(Component, { ...share, wide: true }))
    await new Promise((r) => setTimeout(r, 0))
  })

  // 点整条紧凑条展开（不再只依赖那个小三角）
  const bar = container.querySelector('.tlogs-compact') as unknown as HTMLElement
  assert.ok(bar, '应渲染紧凑条')
  await act(async () => {
    bar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 0))
  })

  return { container, root, text: container.textContent ?? '' }
}

test('宿主开不了登录窗口时置灰「登录」并写明原因', async () => {
  const snapshot = snapshotFixture({ auth: { status: 'missing' } })
  snapshot.display.loginAvailable = false

  const { container, root, text } = await mountExpanded(snapshot)
  try {
    assert.ok(container.querySelector('.tlogs-panel'), '点紧凑条本身应展开面板')

    const loginBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => (b.textContent ?? '').trim() === '登录',
    ) as HTMLButtonElement | undefined

    assert.ok(loginBtn, '应渲染出「登录」按钮')
    assert.equal(loginBtn.disabled, true, '宿主不支持时必须置灰，而不是点了没反应')
    assert.match(text, /内置登录在当前宿主不可用/, '必须写明置灰原因，否则用户只会以为坏了')
    assert.match(text, /手动填写/, '必须指引到可用的兜底路径')
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('回归：token 缺失时「点登录失败」的原因必须可见（不再被 needsAuth 吞掉）', async () => {
  const snapshot = snapshotFixture({ auth: { status: 'missing' } })
  // 关键组合：auth 缺失（needsAuth === true）**且** 登录失败。
  // 此前错误行是 `error && !needsAuth`，这个组合恰好把错误完全藏起来 ——
  // 用户看到的就是「点了登录没反应」。
  const { container, root } = await mountExpanded(snapshot, {
    loginFailure: '登录窗口未取到有效 userToken',
  })
  try {
    const loginBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => (b.textContent ?? '').trim() === '登录',
    ) as HTMLButtonElement | undefined
    assert.ok(loginBtn, '应渲染出「登录」按钮')
    assert.equal(loginBtn.disabled, false, '宿主支持时应可点')

    await act(async () => {
      loginBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })

    const err = container.querySelector('.tlogs-error')
    assert.ok(err, '登录失败必须渲染出错误行')
    assert.match(err.textContent ?? '', /登录窗口未取到有效 userToken/, '错误内容应是真实失败原因')
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('登录窗口可用时不置灰，也不显示「不可用」说明', async () => {
  const snapshot = snapshotFixture({ auth: { status: 'missing' } })
  // fixture 默认 loginAvailable: true
  const { container, root, text } = await mountExpanded(snapshot)
  try {
    const loginBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => (b.textContent ?? '').trim() === '登录',
    ) as HTMLButtonElement | undefined

    assert.ok(loginBtn, '应渲染出「登录」按钮')
    assert.equal(loginBtn.disabled, false, '宿主支持时不应置灰')
    assert.doesNotMatch(text, /内置登录在当前宿主不可用/, '可用时不该出现不可用说明')
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('认证成功时显示凭据来源，便于判断方案 D 是否命中', async () => {
  const snapshot = snapshotFixture()
  snapshot.auth = { status: 'ok', source: 'platform-session' }
  const { container, root, text } = await mountExpanded(snapshot)
  try {
    assert.match(text, /凭据来源/, '应显示凭据来源')
    assert.match(
      text,
      /DSH 账号登录态/,
      '方案 D 命中时必须一眼可辨，否则无法区分它和残留的手工 token',
    )
    // 平台按 UTC 日切桶（= 北京 08:00 换日），而官方**账单**按北京时间日结算：
    // 这行必须把「时区」和「换日时刻」都点出来，否则只会被读成「北京 0 点换日」，
    // 凌晨 00:00–08:00（GMT+8）看到「今日」不是从本机 0 点算起就会以为是 bug。
    // 文案是用户指定的**固定原文**（逐字照抄），刻意保持一行；「本机几点换日」
    // 以及「账单日界 vs 接口日界」的差异在 title tooltip 里说明。
    assert.match(
      text,
      /统计口径：平台日（UTC）· 北京 08:00 换日/,
      '必须逐字显示用户指定的统计口径文案',
    )
    assert.equal(text.includes('统计时区：UTC+08:00'), false, '旧的歧义文案（只写时区）必须已删除')
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('紧凑条上的手动刷新按钮：触发强制刷新，且不会顺带展开/收起面板', async () => {
  const client = loadClientBundle()
  const { ctx, registrations, rpcCalls } = makeCtx(snapshotFixture())
  client.apply(ctx)
  const reg = registrations[0]!
  const Component = reg.component as React.ComponentType<Record<string, unknown>>
  const share = (reg.options.inject as () => Record<string, unknown>)()

  const container = doc().createElement('div')
  doc().body.appendChild(container)
  const root = createRoot(container as unknown as Element)
  try {
    await act(async () => {
      root.render(React.createElement(Component, { ...share, wide: true }))
      await new Promise((r) => setTimeout(r, 0))
    })

    const refreshBtn = container.querySelector(
      'button[aria-label="刷新用量数据"]',
    ) as unknown as HTMLElement
    assert.ok(refreshBtn, '紧凑条上应有手动刷新按钮')

    const before = rpcCalls.filter((e) => e === 'tlogs.refresh').length
    await act(async () => {
      refreshBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })

    const after = rpcCalls.filter((e) => e === 'tlogs.refresh').length
    assert.ok(after > before, '点击刷新必须真的发起 tlogs.refresh')
    assert.equal(
      container.querySelector('.tlogs-panel'),
      null,
      '点刷新不得连带切换面板（必须 stopPropagation）',
    )
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('图表页签：三张图 + 控制项，切换范围会重新向 host 取数', async () => {
  const client = loadClientBundle()
  const payloads: Array<{ endpoint: string; payload: unknown }> = []
  const { ctx, registrations } = makeCtx(snapshotFixture(), { payloads })
  client.apply(ctx)
  const reg = registrations[0]!
  const Component = reg.component as React.ComponentType<Record<string, unknown>>
  const share = (reg.options.inject as () => Record<string, unknown>)()

  const container = doc().createElement('div')
  doc().body.appendChild(container)
  const root = createRoot(container as unknown as Element)
  /** 跑两轮微任务：图表页挂载 → effect 发请求 → 结果回填 → 重新渲染。 */
  const flush = async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
      await new Promise((r) => setTimeout(r, 0))
    })
  }

  try {
    await act(async () => {
      root.render(React.createElement(Component, { ...share, wide: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const bar = container.querySelector('.tlogs-compact') as unknown as HTMLElement
    await act(async () => {
      bar.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    const detailBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('详细数据'),
    ) as unknown as HTMLElement
    await act(async () => {
      detailBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })

    // 切到图表页
    const dialog = doc().querySelector('[role="dialog"]')!
    const chartTab = Array.from(dialog.querySelectorAll('.tlogs-tab')).find(
      (t) => t.textContent === '图表',
    ) as unknown as HTMLElement
    assert.ok(chartTab, '弹窗应有「图表」页签')
    await act(async () => {
      chartTab.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    })
    await flush()

    const seriesCalls = payloads.filter((p) => p.endpoint === 'tlogs.series')
    assert.ok(seriesCalls.length > 0, '打开图表页必须向 host 请求 tlogs.series')
    assert.equal(
      (seriesCalls[0]!.payload as { range?: string }).range,
      'all',
      '默认范围是「有史以来」',
    )

    // 默认只画折线图（三张图是子标签，同屏只渲染一张）
    assert.equal(dialog.querySelectorAll('.tlogs-chart-svg').length, 1, '默认应渲染折线图')
    assert.equal(dialog.querySelectorAll('.tlogs-donut').length, 0, '此时不应有环形饼图')
    const text = dialog.textContent ?? ''
    for (const label of ['图形', '折线图', '饼状图', '柱状图', '用量趋势', '有史以来', '今日', '本周', '本月', '平台账单']) {
      assert.ok(text.includes(label), `图表页应包含「${label}」，实际：${text.slice(0, 200)}`)
    }
    // 界面上不得再自称「官方风格」——那种说法既没有依据，也容易让人以为数据来自官方图表。
    assert.equal(text.includes('官方风格'), false, '界面文案不得出现「官方风格」')
    assert.equal(text.includes('官方开放平台'), false, '界面文案不得出现「官方开放平台」')

    /** 点某个图形子标签。 */
    const pickKind = async (kind: string) => {
      const btn = dialog.querySelector(`.tlogs-subtabs button[data-kind="${kind}"]`) as unknown as HTMLElement
      assert.ok(btn, `应有子标签 ${kind}`)
      await act(async () => {
        btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
      await flush()
    }

    // 子标签切换：同屏只有一张图，且**不会**因此再发一次请求（换的只是渲染）
    const callsBeforeKind = payloads.filter((p) => p.endpoint === 'tlogs.series').length
    await pickKind('pie')
    assert.equal(dialog.querySelectorAll('.tlogs-donut').length, 1, '饼状图子标签应渲染环形图')
    assert.equal(dialog.querySelectorAll('.tlogs-chart-svg').length, 0, '饼状图时不应还有折线/柱状 svg')
    assert.ok((dialog.textContent ?? '').includes('构成占比'))
    // 「构成维度」只在饼图时出现
    assert.ok(
      Array.from(dialog.querySelectorAll('button')).some((b) => b.textContent === '按模型'),
      '饼图应提供构成维度切换',
    )

    await pickKind('bar')
    assert.equal(dialog.querySelectorAll('.tlogs-chart-svg').length, 1, '柱状图应渲染堆叠柱')
    assert.equal(dialog.querySelectorAll('.tlogs-donut').length, 0, '堆叠柱时不应还有环形图')
    const barText = dialog.textContent ?? ''
    assert.ok(barText.includes('用量分布'))
    // 用户明确要求：这里不要再自称「官方风格 / 官方开放平台」。
    assert.equal(barText.includes('官方风格'), false, '柱状图卡片文案不得出现「官方风格」')
    assert.equal(barText.includes('官方开放平台'), false, '柱状图卡片文案不得出现「官方开放平台」')
    // 堆叠柱必须有那三段图例
    for (const label of ['输入（缓存命中）', '输入（缓存未命中）', '输出']) {
      assert.ok(barText.includes(label), `堆叠柱应有图例「${label}」`)
    }
    await pickKind('line')
    assert.equal(
      payloads.filter((p) => p.endpoint === 'tlogs.series').length,
      callsBeforeKind,
      '切图形子标签只换渲染，不应重新请求数据',
    )

    // 切换范围 → 必须再取一次数（同一份数据源、不同窗口）
    const before = seriesCalls.length
    const weekBtn = Array.from(dialog.querySelectorAll('.tlogs-ctl-group button')).find(
      (b) => b.textContent === '本周',
    ) as unknown as HTMLElement
    assert.ok(weekBtn, '应有「本周」范围按钮')
    await act(async () => {
      weekBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    })
    await flush()
    const after = payloads.filter((p) => p.endpoint === 'tlogs.series')
    assert.ok(after.length > before, '切换范围必须重新取数')
    assert.equal((after[after.length - 1]!.payload as { range?: string }).range, 'week')

    // 换指标：不应抛错，图仍在，且图形子标签的选择被保留
    const metricSelect = dialog.querySelector('select[aria-label="选择指标"]') as HTMLSelectElement
    assert.ok(metricSelect, '应有指标选择器')
    await act(async () => {
      metricSelect.value = 'requests'
      metricSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    })
    await flush()
    assert.equal(dialog.querySelectorAll('.tlogs-chart-svg').length, 1, '换指标后图表仍应渲染')
    assert.ok(
      (dialog.querySelector('.tlogs-subtabs button[data-kind="line"]') as HTMLElement).className.includes(
        'is-active',
      ),
      '换指标不该把图形子标签切回默认',
    )
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})

test('紧凑条与其中的三角按钮各自只切换一次（父级 onClick 不得叠加）', async () => {
  const { container, root } = await mountExpanded(snapshotFixture())
  try {
    // 点小三角收起
    const collapse = container.querySelector('button[aria-label*="收起"]') as unknown as HTMLElement
    assert.ok(collapse, '展开后按钮应变为「收起」')
    await act(async () => {
      collapse.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    assert.equal(
      container.querySelector('.tlogs-panel'),
      null,
      '点一次收起必须真的收起；若父级 onClick 也触发就会被切回展开',
    )

    // 再点小三角展开
    const expand = container.querySelector('button[aria-label*="展开"]') as unknown as HTMLElement
    await act(async () => {
      expand.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    assert.ok(container.querySelector('.tlogs-panel'), '再点一次应重新展开')
  } finally {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  }
})
