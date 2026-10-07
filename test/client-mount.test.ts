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

/** 造一个假的 host RPC。`loginFailure` 非空时 tlogs.login 返回失败信封。 */
function makeConnection(snapshot: UsageSnapshot, opts: { loginFailure?: string } = {}) {
  return {
    rpc: {
      call: async (_channel: string, endpoint: string) => {
        switch (endpoint) {
          case 'tlogs.snapshot':
            return { ok: true, value: snapshot }
          case 'tlogs.detail':
            return { ok: true, value: detailFixture }
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
function makeCtx(snapshot: UsageSnapshot, opts: { loginFailure?: string } = {}) {
  const registrations: Array<{ slot: string; options: Record<string, unknown>; component: unknown }> = []
  const cleanups: Array<() => void> = []

  const ctx = {
    connection: makeConnection(snapshot, opts),
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
  return { ctx, registrations, cleanups }
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
  // 需求 1.1：不得用 position: fixed/absolute 伪造悬浮
  assert.ok(
    !/position:\s*(fixed|absolute)/.test(tag.textContent ?? ''),
    '样式不得使用 fixed/absolute 定位',
  )

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
  assert.match(metricLabel, /text-overflow:\s*ellipsis/, '空间不足时应先压缩并省略标签，保住数字')
  assert.ok(css.includes('.tlogs-collapsed-value'), '收起态的数值样式应存在（替代已删除的 Σ 徽标）')

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

    // ---- 进入详细视图 ----
    const detailBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('详细数据'),
    ) as unknown as HTMLElement | undefined
    assert.ok(detailBtn, '应存在详细数据按钮')
    await act(async () => {
      detailBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })

    assert.ok(q('.tlogs-detail'), '应切到详细视图')
    assert.ok(container.querySelector('.tlogs-table'), '详细视图应有表格')
    assert.equal(container.querySelectorAll('.tlogs-tab').length, 4, '应有模型/年/月/当月按天 四个页签')
    assert.ok(text().includes('deepseek-flash'), '表格应含模型行')
    assert.equal(doc().querySelector('[role="dialog"]'), null, '详细视图不得使用 Modal')

    // ---- 返回面板 ----
    const backBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('返回'),
    ) as unknown as HTMLElement | undefined
    assert.ok(backBtn, '应存在返回按钮')
    await act(async () => {
      backBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      await new Promise((r) => setTimeout(r, 0))
    })
    assert.ok(q('.tlogs-panel'), '返回后应回到展开面板')
    assert.equal(q('.tlogs-detail'), null, '返回后不应再有详细视图')
  } finally {
    await act(async () => {
      root.unmount()
    })
  }

  assert.equal(container.childNodes.length, 0, '卸载后组件 DOM 必须被清理')
  assert.equal(container.querySelectorAll('.tlogs').length, 0)
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
