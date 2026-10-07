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
import type { ScopeStat, UsageScope } from './types.js'

/** 工具可查询的范围。 */
const SCOPES = ['total', 'today', 'week', 'month', 'project'] as const

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
        '查询范围：total（该账号有史以来全部用量）| today（今日）| week（本周一至今）| month（本月 1 日至今）| project（当前工作区项目）',
      enum: [...SCOPES],
    },
    projectId: {
      type: 'string',
      description: 'scope=project 时用于指定项目；省略则使用用量最大的项目',
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
          // 只列 label（末两级），不列 id —— id 是完整 cwd，模型可见的异常消息
          // 不该成为「本机目录结构」的外泄通道。
          throw new Error(
            `未找到项目 '${wanted}'；可用项目：${options.map((o) => o.label).join(', ')}`,
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
          : 'month（本月 1 日至今）'
  return toPayload(label, service.statForScope(scope))
}

/** 组装载荷。 */
function toPayload(scope: string, stat?: ScopeStat): ToolPayload {
  const s = stat ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 }
  return {
    scope,
    inputTokens: s.inputTokens,
    outputTokens: s.outputTokens,
    totalTokens: s.totalTokens,
    requests: s.requests,
  }
}
