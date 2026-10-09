/**
 * tlogs — 面向模型的工具 `query_token_usage`。
 *
 * definition 的形状由 dsh-tools 的 `register()` 直接读取：`name`（不能是保留名 `run_code`）；`output` 必须是
 * `{ schema, render }` 且 `render` 必须是函数；`output.schema` 必须落在受支持的 JSON Schema 子集内；`timeoutMs` 若给出必须是正有限数。
 * 这里不用 `defineTool` 助手：`@deepseek-ai/dsh-tools` 只存在于 DSH 的 app.asar 内部，profile 下的第三方插件无法保证能从
 * 自己的 node_modules 解析到它。而 `register()` 读的是普通对象属性，所以直接传入等价的对象字面量即可，避免引入一个在运行时有解析失败风险的 import。
 */
import { toScopeStat } from './api/parser.js';
import { emptyStat, moneyTotal } from './types.js';
const SCOPES = ['total', 'today', 'week', 'month', 'last7', 'last30', 'project'];
/**
 * 参数 JSON Schema。
 *
 * 这里必须是成品 JSON Schema，而不是 dsh-tools 的「参数 spec 表」：`register()` 把 `definition.parameters` 原样交给
 * provider，`schemaOf()` 不做任何转换；只有 `defineTool()` 才会调用 `parameterSchemaSpecToJsonSchema()` 把
 * `{ key: { type: 'string', required: true, … } }` 编译成 `{ type: 'object', properties: {…}, required: [...] }`。
 * 本插件不能 import `@deepseek-ai/dsh-tools`（它只在 app.asar 内部），所以只能自己给出成品 schema。把 spec 表直接塞进来
 * 会让 provider 收到一个没有 `type` 的对象并报 `type: null` 的 schema 错误。另注意 `register()` 只校验 `output.schema`、
 * 不校验 `parameters`，所以这类错误只在真正发起请求时才暴露 —— 由 test/host-plugin.test.ts 守住。
 */
const PARAMETERS = {
    type: 'object',
    properties: {
        scope: {
            type: 'string',
            description: '查询范围：total（该账号有史以来全部用量）| today（今日）| week（本周一至今）| month（本月 1 日至今）| last7（最近 7 天，含今天）| last30（最近 30 天，含今天，与开放平台控制台「时间维度：近 30 天」同口径）| project（当前工作区项目）',
            enum: [...SCOPES],
        },
        projectId: {
            type: 'string',
            description: 'scope=project 时用于指定项目的不透明 id（省略则使用用量最大的项目）。' +
                'id 是哈希值而非路径；先用 scope=project 查询即可从返回的项目列表里取到可用 id。',
        },
    },
    required: ['scope'],
};
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
};
function renderText(p) {
    const lines = [
        `tlogs 用量（${p.scope}）`,
        `  总 Token：${p.totalTokens.toLocaleString('en-US')}`,
        `  输入：${p.inputTokens.toLocaleString('en-US')}`,
        `  输出：${p.outputTokens.toLocaleString('en-US')}`,
        `  请求次数：${p.requests.toLocaleString('en-US')}`,
    ];
    if (p.cost !== undefined)
        lines.push(`  消费金额：${p.cost.toFixed(4)} ${p.currency ?? 'CNY'}`);
    if (p.note)
        lines.push(`  说明：${p.note}`);
    return lines.join('\n');
}
export function makeUsageTool(service) {
    return {
        name: 'query_token_usage',
        description: '查询 DeepSeek 开放平台账号的 Token 使用量（输入/输出/总计）与请求次数。' +
            '范围可选 total（有史以来全部）、today（今日）、week（本周一至今）、month（本月 1 日至今）、project（当前项目）。' +
            '首次查询需逐月拉取历史数据，可能耗时数十秒。',
        parameters: PARAMETERS,
        output: {
            schema: OUTPUT_SCHEMA,
            render: (_args, value) => {
                const payload = value;
                return [{ type: 'text', text: renderText(payload) }];
            },
        },
        async execute(args, exec) {
            const scopeRaw = typeof args?.scope === 'string' ? args.scope : 'total';
            // 展宽成 string[] 再 includes：SCOPES 是 as const 元组，直接 includes(string) 会被 TS 拒绝。
            if (!SCOPES.includes(scopeRaw)) {
                throw new Error(`未知的 scope '${scopeRaw}'，可选：${SCOPES.join(' | ')}`);
            }
            const scope = scopeRaw;
            // 尊重缓存 TTL：'scheduled' 只在超出 TTL 时才真正发请求。
            // 工具调用必须观察 exec.signal，避免用户取消后还继续逐月拉取。
            await service.refresh('scheduled', undefined, exec?.signal);
            if (scope === 'project') {
                const options = await service.projectOptions();
                if (options.length === 0) {
                    return {
                        scope: 'project',
                        inputTokens: 0,
                        outputTokens: 0,
                        totalTokens: 0,
                        requests: 0,
                        note: '当前项目统计不可用（宿主未提供会话用量来源）',
                    };
                }
                const wanted = typeof args?.projectId === 'string' && args.projectId.length > 0
                    ? args.projectId
                    : options[0].id;
                const hit = options.find((o) => o.id === wanted);
                if (!hit) {
                    // 只列 label（末两级）与哈希后的 id。为什么可以列 id：`projectOptions()` 返回的 id 是 `publicProjectId()`
                    // 的不可逆短哈希，不含任何路径信息 —— 模型要按 id 指定项目就必须能看见它，否则 `projectId` 入参形同虚设。
                    // 异常消息里因此也不会出现绝对路径。
                    throw new Error(`未找到项目 '${wanted}'；可用项目：` +
                        options.map((o) => `${o.label}（id: ${o.id}）`).join(', '));
                }
                return toPayload(`project:${hit.label}`, hit.stat);
            }
            const detailLike = scopeDetail(service, scope);
            return detailLike;
        },
    };
}
function scopeDetail(service, scope) {
    const label = scope === 'total'
        ? 'total（有史以来）'
        : scope === 'today'
            ? 'today（今日）'
            : scope === 'week'
                ? 'week（本周一至今）'
                : scope === 'month'
                    ? 'month（本月 1 日至今）'
                    : scope === 'last7'
                        ? 'last7（最近 7 天，含今天）'
                        : 'last30（最近 30 天，含今天）';
    return toPayload(label, service.statForScope(scope));
}
function toPayload(scope, stat) {
    const s = stat ?? toScopeStat(emptyStat());
    const out = {
        scope,
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        totalTokens: s.totalTokens,
        requests: s.requests,
    };
    // 金额按需带上：没有金额数据时不输出 `cost: 0`，否则模型会断言「这段时间没花钱」，
    // 而实际只是金额还没回补到。
    if (s.cost) {
        out.cost = moneyTotal(s.cost);
        out.currency = s.currency ?? 'CNY';
    }
    return out;
}
//# sourceMappingURL=tools.js.map