/**
 * tlogs — 详细数据的「性能」「工具」两个页签。
 *
 * 数据来自本机会话日志的过程指标（见 store/session-insights.ts）：只用了时间戳、工具名、
 * 参数字符串长度、isError 与后台任务状态，不读消息正文。窗口与「供应商」页签相同：
 * 会话日志还在的那些天，而不是账号全量。
 */
import * as React from 'react';
import { h } from './h.js';
import { formatMoney, formatNumber } from './format.js';
import { useT } from './i18n/index.js';
/** 按平台五类单价估算金额；缺单价或没有用量时返回 undefined（不编 0）。 */
export function estimateMoney(stat, unitPrices) {
    if (!unitPrices)
        return undefined;
    let sum = 0;
    let any = false;
    for (const [type, price] of Object.entries(unitPrices)) {
        const tokens = stat.raw[type] ?? 0;
        if (tokens > 0 && price > 0) {
            sum += tokens * price;
            any = true;
        }
    }
    return any ? sum : undefined;
}
/** 毫秒 → 人类可读；`0` 单独说「<1 ms」以外的 0，避免和「没有数据」混淆。 */
export function formatMs(ms) {
    if (!Number.isFinite(ms) || ms <= 0)
        return '0 ms';
    if (ms < 1)
        return '<1 ms';
    if (ms < 1000)
        return `${Math.round(ms)} ms`;
    if (ms < 60_000)
        return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
    const m = Math.floor(ms / 60_000);
    const s = Math.round((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
}
/** 字节 → KB / MB（二进制约 1024），只用于「大小」这一栏。 */
export function formatBytes(n) {
    if (!Number.isFinite(n) || n <= 0)
        return '0 B';
    if (n < 1024)
        return `${Math.round(n)} B`;
    if (n < 1024 * 1024)
        return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function Kpi(props) {
    return (h("div", { className: "tlogs-bd-kpi" },
        h("span", { className: "tlogs-bd-kpi-label" },
            props.glyph ? h("i", { className: "tlogs-bd-glyph" }, props.glyph) : null,
            props.label),
        h("b", { className: "tlogs-bd-kpi-value" }, props.value)));
}
/** 过程指标不可用时的统一提示（原因码复用 `error.reason.*`）。 */
function Unavailable(props) {
    return (h("div", { className: "tlogs-hint" }, props.t('insights.unavailable', { reason: props.reasonLabel(props.unavailable?.reason) })));
}
/** 工具表最多画多少行（按调用次数排序后的前 N 个）。 */
const TOOL_ROWS = 40;
const BUCKET_KEYS = [
    'insights.bucket.1',
    'insights.bucket.2',
    'insights.bucket.3',
    'insights.bucket.4',
    'insights.bucket.5',
    'insights.bucket.6',
];
export function PerformanceView(props) {
    const { insights, unavailable, reasonLabel, numberFormat } = props;
    const t = useT();
    if (!insights)
        return h(Unavailable, { unavailable: unavailable, reasonLabel: reasonLabel, t: t });
    const steps = insights.steps;
    const bucketMax = Math.max(1, ...steps.buckets);
    return (h("div", { className: "tlogs-bd" },
        h("div", { className: "tlogs-hint" }, t('insights.scope', { from: insights.window.from, to: insights.window.to, files: formatNumber(insights.window.files, numberFormat) })),
        h("div", { className: "tlogs-bd-kpis" },
            h(Kpi, { label: t('insights.ttft'), value: formatMs(insights.ttft.avgMs), glyph: "\u23F1" }),
            h(Kpi, { label: t('insights.tpot'), value: formatMs(insights.tpot.avgMs), glyph: "\u2044" }),
            h(Kpi, { label: t('insights.tpsAvg'), value: insights.tps.avg.toFixed(1), glyph: "\u25B2" }),
            h(Kpi, { label: t('insights.tpsPeak'), value: insights.tps.peak.toFixed(1), glyph: "\u21D7" })),
        h("div", { className: "tlogs-bd-kpis" },
            h(Kpi, { label: t('insights.tpmAvg'), value: formatNumber(Math.round(insights.tpm.avg), numberFormat), glyph: "\u25F7" }),
            h(Kpi, { label: t('insights.tpmPeak'), value: formatNumber(Math.round(insights.tpm.peak), numberFormat), glyph: "\u21D7" }),
            h(Kpi, { label: t('insights.rpmAvg'), value: insights.rpm.avg.toFixed(1), glyph: "\u21BB" }),
            h(Kpi, { label: t('insights.rpmPeak'), value: formatNumber(insights.rpm.peak, numberFormat), glyph: "\u21D7" })),
        h("div", { className: "tlogs-bd-kpis" },
            h(Kpi, { label: t('insights.calls'), value: formatNumber(insights.calls, numberFormat) }),
            h(Kpi, { label: t('insights.steps'), value: formatNumber(steps.total, numberFormat) }),
            h(Kpi, { label: t('insights.stepsPerTurn'), value: steps.avgPerTurn.toFixed(1) }),
            h(Kpi, { label: t('insights.maxSteps'), value: formatNumber(steps.maxPerTurn, numberFormat) }),
            h(Kpi, { label: t('insights.loops'), value: formatNumber(insights.loops.repeatedCalls, numberFormat) }),
            h(Kpi, { label: t('insights.loopMax'), value: formatNumber(insights.loops.maxRepeatRun, numberFormat) }),
            h(Kpi, { label: t('insights.edits'), value: formatNumber(insights.edits.calls, numberFormat) }),
            h(Kpi, { label: t('insights.toolShare'), value: `${(insights.toolTimeShare * 100).toFixed(1)}%` }),
            h(Kpi, { label: t('insights.efficiency'), value: `${(insights.tokenEfficiency * 100).toFixed(1)}%` })),
        h("div", { className: "tlogs-bd-title" }, t('insights.stepsTitle')),
        h("div", { className: "tlogs-bd-rows" }, steps.buckets.map((n, i) => (h("div", { className: "tlogs-bd-row", key: BUCKET_KEYS[i] },
            h("i", { className: "tlogs-bd-dot", style: { background: 'var(--tlogs-c1)' } }),
            h("span", { className: "tlogs-bd-label" }, t(BUCKET_KEYS[i])),
            h("span", { className: "tlogs-bd-bar" },
                h("i", { style: { width: `${Math.min(100, (n / bucketMax) * 100)}%`, background: 'var(--tlogs-c1)' } })),
            h("span", { className: "tlogs-bd-value" }, formatNumber(n, numberFormat)),
            h("span", { className: "tlogs-bd-pct" }, steps.turns > 0 ? `${((n / steps.turns) * 100).toFixed(1)}%` : '—'))))),
        h("div", { className: "tlogs-hint" }, t('insights.stepsHint'))));
}
function ToolRow(props) {
    const { row, numberFormat } = props;
    return (h("tr", null,
        h("td", { className: "tlogs-strong" }, row.name),
        h("td", null, formatNumber(row.calls, numberFormat)),
        h("td", null, row.errors > 0 ? formatNumber(row.errors, numberFormat) : '—'),
        h("td", null, row.measured > 0 ? formatMs(row.avgMs) : '—'),
        h("td", null, row.measured > 0 ? formatMs(row.totalMs) : '—'),
        h("td", null, formatBytes(row.paramBytes)),
        h("td", null, formatBytes(row.resultBytes))));
}
/** 会话表：一条会话 = 一个日志文件。没有标题（那属于正文），标签用短哈希 + 日期区间。 */
export function ConversationsView(props) {
    const { insights, unavailable, reasonLabel, numberFormat, unitPrices } = props;
    const t = useT();
    if (!insights)
        return h(Unavailable, { unavailable: unavailable, reasonLabel: reasonLabel, t: t });
    const rows = insights.sessions ?? [];
    if (rows.length === 0)
        return h("div", { className: "tlogs-empty" }, t('common.noData'));
    return (h("div", { className: "tlogs-bd" },
        h("div", { className: "tlogs-hint" }, t('conv.hint')),
        h("div", { className: "tlogs-table-wrap" },
            h("table", { className: "tlogs-table" },
                h("thead", null,
                    h("tr", null,
                        h("th", null, t('conv.col.id')),
                        h("th", null, t('conv.col.range')),
                        h("th", null, t('conv.col.calls')),
                        h("th", null, t('conv.col.steps')),
                        h("th", null, t('conv.col.tools')),
                        h("th", null, t('conv.col.tokens')),
                        h("th", null, t('conv.col.estimate')))),
                h("tbody", null, rows.map((row) => {
                    const estimate = estimateMoney({ raw: row.stat }, unitPrices);
                    return (h("tr", { key: row.id },
                        h("td", { className: "tlogs-strong" }, row.id),
                        h("td", null, row.from === row.to ? row.from : `${row.from} ~ ${row.to}`),
                        h("td", null, formatNumber(row.calls, numberFormat)),
                        h("td", null, formatNumber(row.steps, numberFormat)),
                        h("td", null, formatNumber(row.toolCalls, numberFormat)),
                        h("td", null, formatNumber(row.stat.PROMPT_CACHE_HIT_TOKEN + row.stat.PROMPT_CACHE_MISS_TOKEN + row.stat.PROMPT_TOKEN + row.stat.RESPONSE_TOKEN, numberFormat)),
                        h("td", null, estimate === undefined ? '—' : `≈ ${formatMoney(estimate)}`)));
                })))),
        h("div", { className: "tlogs-hint" }, t('conv.estimateHint'))));
}
export function ToolsView(props) {
    const { insights, unavailable, reasonLabel, numberFormat } = props;
    const t = useT();
    if (!insights)
        return h(Unavailable, { unavailable: unavailable, reasonLabel: reasonLabel, t: t });
    return (h("div", { className: "tlogs-bd" },
        h("div", { className: "tlogs-hint" }, t('insights.scope', { from: insights.window.from, to: insights.window.to, files: formatNumber(insights.window.files, numberFormat) })),
        h("div", { className: "tlogs-bd-kpis" },
            h(Kpi, { label: t('tools.totalCalls'), value: formatNumber(insights.toolCalls, numberFormat), glyph: "\u2699" }),
            h(Kpi, { label: t('tools.errorRate'), value: `${(insights.toolErrorRate * 100).toFixed(2)}%` }),
            h(Kpi, { label: t('tools.avgMs'), value: insights.toolMeasured > 0 ? formatMs(insights.toolWallMs / insights.toolMeasured) : '—' }),
            h(Kpi, { label: t('insights.toolShare'), value: `${(insights.toolTimeShare * 100).toFixed(1)}%` }),
            h(Kpi, { label: t('tools.jobs'), value: formatNumber(insights.jobs.total, numberFormat), glyph: "\u25A4" }),
            h(Kpi, { label: t('tools.killed'), value: formatNumber(insights.jobs.killed + insights.jobs.failed, numberFormat) }),
            h(Kpi, { label: t('tools.jobMs'), value: formatMs(insights.jobs.totalMs) }),
            h(Kpi, { label: t('tools.nonEmpty'), value: insights.toolMeasured > 0 ? `${(insights.resultNonEmptyRate * 100).toFixed(1)}%` : '—' })),
        h("div", { className: "tlogs-bd-title" }, t('tools.title')),
        h("div", { className: "tlogs-table-wrap" },
            h("table", { className: "tlogs-table" },
                h("thead", null,
                    h("tr", null,
                        h("th", null, t('tools.col.name')),
                        h("th", null, t('tools.col.calls')),
                        h("th", null, t('tools.col.errors')),
                        h("th", null, t('tools.col.avg')),
                        h("th", null, t('tools.col.total')),
                        h("th", null, t('tools.col.param')),
                        h("th", null, t('tools.col.result')))),
                h("tbody", null, insights.tools.slice(0, TOOL_ROWS).map((row) => (h(ToolRow, { key: row.name, row: row, numberFormat: numberFormat })))))),
        insights.tools.length > TOOL_ROWS ? (h("div", { className: "tlogs-hint" }, t('tools.truncated', { shown: TOOL_ROWS, total: insights.tools.length }))) : null,
        h("div", { className: "tlogs-hint" }, t('tools.hint'))));
}
//# sourceMappingURL=insights-view.js.map