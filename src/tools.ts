/**
 * tlogs — 面向模型的工具 `query_token_usage`。
 *
 * 注册方式（0.2.0-rc.2 运行时已验证）：
 *   `ctx.tools.register(definition) -> Disposer`，definition 的形状由
 *   dsh-tools 的 `register()` 直接读取：
 *     - `name`（不能是保留名 `run_code`）
 *     - `output` 必须是 `{ schema, render }`，`render` 必须是函数
 *     - `output.schema` 必须落在受支持的 JSON Schema 子集内
 *       （type / oneOf / properties / required / additionalProperties / items / enum / const + 注解）
 *     - `timeoutMs` 若给出必须是正有限数
 *
 * 为什么不用 `defineTool` 助手：`@deepseek-ai/dsh-tools` 只存在于 DSH 的
 * app.asar 内部，profile 下的第三方插件**无法保证**能从自己的 node_modules
 * 解析到它。`register()` 读的是普通对象属性（已核对源码），因此这里直接传入
 * 等价的对象字面量，避免引入一个在运行时可能解析失败的 import。
 */

import type { UsageService } from './service.js'
import { toScopeStat } from './api/parser.js'
import { emptyStat, moneyTotal, type ScopeStat, type UsageScope } from './types.js'

/** 工具可查询的范围。 */
const SCOPES = ['total', 'today', 'week', 'month', 'last7', 'last30', 'project'] as const

/**
 * 参数 JSON Schema。
 *
 * ⚠️ 这里是**成品 JSON Schema**，不是 dsh-tools 的「参数 spec 表」。原因（已核对源码）：
 * `ctx.tools.register()` 把 `definition.parameters` **原样**交给 provider ——
 * dsh-tools 的 `schemaOf()` 不做任何转换：
 *
 *     schemaOf(definition, detachParameters) {
 *       const { name, description, parameters, deferLoading } = definition;
 *       return { name, description, parameters: detached, ... };
 *     }
 *
 * 只有 `defineTool()` 才会调用 `parameterSchemaSpecToJsonSchema()`，把
 * `{ key: { type: 'string', required: true, … } }` 这种 spec 表编译成
 * `{ type: 'object', properties: {…}, required: [...] }`（`required` 被提升为根数组）。
 *
 * 本插件**不能** import `@deepseek-ai/dsh-tools`（它只存在于 app.asar 内部，
 * profile 下解析不到），所以必须自己给出成品 schema。
 *
 * 曾经的 bug 就是把 spec 表直接塞进 `parameters`，provider 于是收到一个没有 `type`
 * 的对象并报：
 *   Invalid schema for function 'query_token_usage':
 *   schema must be a JSON Schema of 'type: "object"', got 'type: null'.
 *
 * 还有一个坑：`register()` 只校验 `output.schema`，**不校验 `parameters`**，
 * 所以这类错误只在真正发起请求时才暴露 —— 由 test/host-plugin.test.ts 守住。
 */
const PARAMETERS = {
  type: 'object',
  properties: {
    scope: {
      type: 'string',
      description:
        '查询范围：total（该账号有史以来全部用量）| today（今日）| week（本周一至今）| month（本月 1 日至今）| last7（最近 7 天，含今天）| last30（最近 30 天，含今天，与开放平台控制台「时间维度：近 30 天」同口径）| project（当前工作区项目）',
      enum: [...SCOPES],
    },
    projectId: {
      type: 'string',
      description:
        'scope=project 时用于指定项目的**不透明 id**（省略则使用用量最大的项目）。' +
        'id 是哈希值而非路径；先用 scope=project 查询即可从返回的项目列表里取到可用 id。',
    },
  },
  required: ['scope'],
} as const

/** 输出 schema（对象根，字段为计数）。 */
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    scope: { type: 'string' },
    inputTokens: { type: 'number' },
    outputTokens: { type: 'number' },
    totalTokens: { type: 'number' },
    requests: { type: 'number' },
    /** 该范围的消费金额（元）；金额尚未回补到时缺省。 */
    cost: { type: 'number' },
    currency: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['scope', 'inputTokens', 'outputTokens', 'totalTokens', 'requests'],
} as const

/** 工具返回的载荷。 */
interface ToolPayload {
  scope: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  requests: number
  cost?: number
  currency?: string
  note?: string
}

/** 把计数渲染成人类可读的多行文本。 */
function renderText(p: ToolPayload): string {
  const lines = [
    `tlogs 用量（${p.scope}）`,
    `  总 Token：${p.totalTokens.toLocaleString('en-US')}`,
    `  输入：${p.inputTokens.toLocaleString('en-US')}`,
    `  输出：${p.outputTokens.toLocaleString('en-US')}`,
    `  请求次数：${p.requests.toLocaleString('en-US')}`,
  ]
  if (p.cost !== undefined) lines.push(`  消费金额：${p.cost.toFixed(4)} ${p.currency ?? 'CNY'}`)
  if (p.note) lines.push(`  说明：${p.note}`)
  return lines.join('\n')
}

/** 组装工具定义。 */
export function makeUsageTool(service: UsageService) {
  return {
    name: 'query_token_usage',
    description:
      '查询 DeepSeek 开放平台账号的 Token 使用量（输入/输出/总计）与请求次数。' +
      '范围可选 total（有史以来全部）、today（今日）、week（本周一至今）、month（本月 1 日至今）、project（当前项目）。' +
      '首次查询需逐月拉取历史数据，可能耗时数十秒。',
    parameters: PARAMETERS,

    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args: unknown, value: unknown) => {
        const payload = value as ToolPayload
        return [{ type: 'text', text: renderText(payload) }]
      },
    },

    async execute(args: { scope?: unknown; projectId?: unknown }, exec: { signal?: AbortSignal }): Promise<ToolPayload> {
      const scopeRaw = typeof args?.scope === 'string' ? args.scope : 'total'
      // 展宽成 string[] 再 includes：SCOPES 是 as const 元组，直接 includes(string) 会被 TS 拒绝。
      if (!(SCOPES as readonly string[]).includes(scopeRaw)) {
        throw new Error(`未知的 scope '${scopeRaw}'，可选：${SCOPES.join(' | ')}`)
      }
      const scope = scopeRaw as UsageScope | 'project'

      // 尊重缓存 TTL：'scheduled' 只在超出 TTL 时才真正发请求。
      // 工具调用必须观察 exec.signal，避免用户取消后还继续逐月拉取。
      await service.refresh('scheduled', undefined, exec?.signal)

      if (scope === 'project') {
        const options = await service.projectOptions()
        if (options.length === 0) {
          return {
            scope: 'project',
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            requests: 0,
            note: '当前项目统计不可用（宿主未提供会话用量来源）',
          }
        }
        const wanted =
          typeof args?.projectId === 'string' && args.projectId.length > 0
            ? args.projectId
            : options[0].id
        const hit = options.find((o) => o.id === wanted)
        if (!hit) {
          // 只列 label（末两级）与**哈希后**的 id。
          //
          // 为什么可以列 id：`projectOptions()` 返回的 id 是 `publicProjectId()` 的
          // 不可逆短哈希，不含任何路径信息 —— 模型要按 id 指定项目就必须能看见它，
          // 否则 `projectId` 入参形同虚设。异常消息里因此也不会出现绝对路径。
          throw new Error(
            `未找到项目 '${wanted}'；可用项目：` +
              options.map((o) => `${o.label}（id: ${o.id}）`).join(', '),
          )
        }
        return toPayload(`project:${hit.label}`, hit.stat)
      }

      const detailLike = scopeDetail(service, scope as UsageScope)
      return detailLike
    },
  }
}

/** 从服务里取出某个 scope 的统计。 */
function scopeDetail(service: UsageService, scope: UsageScope): ToolPayload {
  const label =
    scope === 'total'
      ? 'total（有史以来）'
      : scope === 'today'
        ? 'today（今日）'
        : scope === 'week'
          ? 'week（本周一至今）'
          : scope === 'month'
            ? 'month（本月 1 日至今）'
            : scope === 'last7'
              ? 'last7（最近 7 天，含今天）'
              : 'last30（最近 30 天，含今天）'
  return toPayload(label, service.statForScope(scope))
}

/** 组装载荷。 */
function toPayload(scope: string, stat?: ScopeStat): ToolPayload {
  const s: ScopeStat = stat ?? toScopeStat(emptyStat())
  const out: ToolPayload = {
    scope,
    inputTokens: s.inputTokens,
    outputTokens: s.outputTokens,
    totalTokens: s.totalTokens,
    requests: s.requests,
  }
  // 金额按需带上：没有金额数据时不输出 `cost: 0`，否则模型会断言「这段时间没花钱」，
  // 而实际只是金额还没回补到。
  if (s.cost) {
    out.cost = moneyTotal(s.cost)
    out.currency = s.currency ?? 'CNY'
  }
  return out
}
