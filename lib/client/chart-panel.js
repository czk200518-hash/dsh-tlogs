/**
 * tlogs — 「图表」页签（详细数据弹窗内）。
 *
 * 三张图共享同一套控制项，**切换任意控制项三张图一起变**：
 *   范围（有史以来 / 自定义 / 今日 / 本周 / 本月）× 数据源（平台账单 / 指定项目）
 *   × 指标（总 Token / 输入 / 输出 / 缓存命中 / 缓存未命中 / 请求数）× 粒度（自动/天/月/年）
 *
 * 数据来源的口径差异（重要，别混）：
 *  - **平台账单**：账号维度，接口按天返回逐日明细，可回溯到配置的历史起点。
 *  - **指定项目**：只存在于本机。宿主只给「累计至今」一个数，因此趋势依赖插件
 *    自己每天记的快照（`store/project-history.ts`），**无法回溯到启用之前**。
 *    这一点在选中项目时会明确写在界面上，而不是让用户对着一张空图猜。
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatMoneyFull, formatMoneyShort, formatShort } from './format.js';
import { LineChart, StackedBarChart, DonutChart } from './charts.js';
import {} from '../types.js';
import { GRAINS, METRICS, bucketMetricValue, bucketValues, dayBuckets, metricSuffix, metricValue, monthBuckets, pieSlices, projectBuckets, resolveGrain, toPoints, yearBuckets, } from './chart-utils.js';
const RANGES = [
    { id: 'all', label: '有史以来' },
    { id: 'custom', label: '自定义' },
    { id: 'today', label: '今日' },
    { id: 'week', label: '本周' },
    { id: 'month', label: '本月' },
    // 与控制台「时间维度」一致的两个滚动窗口。做成图表的范围预设后，
    // 用户可以直接对着控制台把同一条曲线比出来。
    { id: 'last7', label: '近 7 天' },
    { id: 'last30', label: '近 30 天' },
];
const PIE_DIMS = [
    { id: 'model', label: '按模型' },
    { id: 'composition', label: '输入/输出' },
    { id: 'project', label: '按项目' },
];
const KINDS = [
    { id: 'line', label: '折线图' },
    { id: 'pie', label: '饼状图' },
    { id: 'bar', label: '柱状图' },
];
/** 本地今天（`YYYY-MM-DD`）。 */
function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 本地 N 天前。 */
function daysAgoKey(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 空的五类计量项（用于「构成」聚合）。 */
function zeroStat() {
    return {
        PROMPT_TOKEN: 0,
        PROMPT_CACHE_HIT_TOKEN: 0,
        PROMPT_CACHE_MISS_TOKEN: 0,
        RESPONSE_TOKEN: 0,
        REQUEST: 0,
    };
}
/** 空的金额五类。 */
function zeroMoney() {
    return zeroStat();
}
/**
 * 累计模式的起点值。
 *
 * 金额不在 `Stat` 里，必须单独取 `priorCost`；否则切到「累计 + 消费金额」时
 * 曲线会从 0 起跳（与 token 侧的行为不一致）。
 */
function priorValue(stat, cost, metric) {
    return metric === 'cost' ? (cost ?? 0) : metricValue(stat, metric);
}
/** 把若干 Stat 相加。 */
function sumStats(list) {
    const acc = zeroStat();
    for (const s of list) {
        acc.PROMPT_TOKEN += s.PROMPT_TOKEN;
        acc.PROMPT_CACHE_HIT_TOKEN += s.PROMPT_CACHE_HIT_TOKEN;
        acc.PROMPT_CACHE_MISS_TOKEN += s.PROMPT_CACHE_MISS_TOKEN;
        acc.RESPONSE_TOKEN += s.RESPONSE_TOKEN;
        acc.REQUEST += s.REQUEST;
    }
    return acc;
}
export function ChartPanel(props) {
    const { series, loading, error, onLoad } = props;
    const [range, setRange] = React.useState('all');
    const [from, setFrom] = React.useState('');
    const [to, setTo] = React.useState('');
    const [projectId, setProjectId] = React.useState('');
    const [metric, setMetric] = React.useState('total');
    const [grain, setGrain] = React.useState('auto');
    const [mode, setMode] = React.useState('perBucket');
    const [pieDim, setPieDim] = React.useState('model');
    /** 当前显示哪张图（子标签）。切它**不发请求**，只换渲染。 */
    const [kind, setKind] = React.useState('line');
    /**
     * 只在「查询参数真的变了」时发请求。
     *
     * 用签名字符串（而不是把 series 放进依赖）是为了避免「请求 → 新 series →
     * 触发 effect → 再请求」的循环：series 变化不改变签名，因此不会重发。
     */
    const lastSig = React.useRef('');
    React.useEffect(() => {
        if (range === 'custom' && (!from || !to))
            return;
        const query = { range };
        if (range === 'custom') {
            query.from = from;
            query.to = to;
        }
        if (projectId)
            query.projectId = projectId;
        const sig = JSON.stringify(query);
        if (lastSig.current === sig)
            return;
        lastSig.current = sig;
        onLoad(query);
    }, [range, from, to, projectId, onLoad]);
    const projectSource = projectId !== '';
    const selectedProject = series?.projects.find((p) => p.id === projectId);
    /**
     * 选中的项目从列表里消失时（宿主重启后会话被清理、项目被删）把选择清掉。
     *
     * 否则 `<select value>` 会指向一个不存在的 option：浏览器显示第一项、而 state
     * 仍是旧 id，界面与实际查询的数据源对不上。
     */
    React.useEffect(() => {
        if (!projectId || !series)
            return;
        if (series.projects.length === 0)
            return;
        if (series.projects.some((p) => p.id === projectId))
            return;
        setProjectId('');
    }, [projectId, series]);
    const resolvedGrain = series ? resolveGrain(grain, series.from, series.to) : 'day';
    /** 时间桶：项目维度走快照，平台维度按粒度取逐日 / 逐月 / 逐年。 */
    const buckets = React.useMemo(() => {
        if (!series)
            return [];
        if (projectSource) {
            const points = series.project?.points ?? [];
            return projectBuckets(points, series.project?.prior?.stat, mode);
        }
        if (resolvedGrain === 'day')
            return dayBuckets(series.days, series.from, series.to);
        if (resolvedGrain === 'year')
            return yearBuckets(series.months);
        return monthBuckets(series.months);
    }, [series, projectSource, resolvedGrain, mode]);
    /** 折线图的数值：平台维度可在「每期」与「累计」之间切；项目维度的桶已内含口径。 */
    const values = React.useMemo(() => {
        if (projectSource)
            return buckets.map((b) => bucketMetricValue(b, metric));
        const prior = mode === 'cumulative' && series ? priorValue(series.prior, series.priorCost, metric) : 0;
        return bucketValues(buckets, metric, mode, prior);
    }, [buckets, metric, mode, projectSource, series]);
    const points = React.useMemo(() => toPoints(buckets, values), [buckets, values]);
    const metricDef = METRICS.find((m) => m.id === metric);
    const unit = metricDef.unit;
    /** 范围内的合计（用于环形中心与说明）：只累加**月度合计**，因此不会因缺天而低估。 */
    const rangeStat = React.useMemo(() => (series ? sumStats(series.months.map((m) => m.stat)) : zeroStat()), [series]);
    /** 范围内的金额合计（元）。金额不在 `Stat` 里，因此单独累加。 */
    const rangeCost = React.useMemo(() => (series ? series.months.reduce((s, m) => s + (m.cost ?? 0), 0) : 0), [series]);
    /** 范围内的金额构成（输入命中 / 未命中 / 输出），由 host 一次算好下发。 */
    const rangeMoney = series?.costByType ?? zeroMoney();
    /** 环形图的维度：选中项目时不再有「按模型」——平台模型与该项目无关，会误导。 */
    const effectiveDim = projectSource && pieDim === 'model' ? 'composition' : pieDim;
    const dims = projectSource ? PIE_DIMS.filter((d) => d.id !== 'model') : PIE_DIMS;
    const pieItems = React.useMemo(() => {
        if (!series)
            return [];
        if (effectiveDim === 'model') {
            return series.models.map((m) => ({
                key: m.key,
                label: m.key,
                // 模型金额只有总额（`SeriesPoint.cost`），没有五类拆分。
                value: metric === 'cost' ? (m.cost ?? 0) : metricValue(m.stat, metric),
            }));
        }
        if (effectiveDim === 'project') {
            // 项目用量来自本机会话投影，平台账单里没有它的金额 —— 明确返回空，
            // 由饼图的 emptyText 说明，而不是画一张全 0 的图。
            if (metric === 'cost')
                return [];
            return series.projects.map((p) => ({ key: p.id, label: p.label, value: metricValue(p.stat, metric) }));
        }
        // 构成维度：金额走 Money 的五类拆分，其余走 Stat。
        if (metric === 'cost') {
            return [
                { key: 'hit', label: '输入（缓存命中）', value: rangeMoney.PROMPT_CACHE_HIT_TOKEN },
                {
                    key: 'miss',
                    label: '输入（缓存未命中）',
                    value: rangeMoney.PROMPT_CACHE_MISS_TOKEN + rangeMoney.PROMPT_TOKEN,
                },
                { key: 'out', label: '输出', value: rangeMoney.RESPONSE_TOKEN },
            ];
        }
        const s = projectSource ? sumStats((series.project?.points ?? []).map((p) => p.stat)) : rangeStat;
        return [
            { key: 'hit', label: '输入（缓存命中）', value: s.PROMPT_CACHE_HIT_TOKEN },
            { key: 'miss', label: '输入（缓存未命中）', value: s.PROMPT_CACHE_MISS_TOKEN + s.PROMPT_TOKEN },
            { key: 'out', label: '输出', value: s.RESPONSE_TOKEN },
        ];
    }, [series, effectiveDim, metric, projectSource, rangeStat, rangeMoney]);
    const slices = React.useMemo(() => pieSlices(pieItems, 8), [pieItems]);
    const pickRange = (r) => {
        if (r === 'custom' && (!from || !to)) {
            // 首次进入自定义：用当前范围当默认值，用户改起来才有对照。
            setFrom(series?.from ?? daysAgoKey(30));
            setTo(series?.to ?? todayKey());
        }
        setRange(r);
    };
    const projectPoints = series?.project?.points.length ?? 0;
    return (h(Fragment, null,
        h("div", { className: "tlogs-subtabs" },
            h("span", { className: "tlogs-ctl-group", role: "group", "aria-label": "\u9009\u62E9\u56FE\u5F62" },
                h("span", { className: "tlogs-ctl-label" }, "\u56FE\u5F62"),
                KINDS.map((k) => (h("button", { key: k.id, type: "button", className: k.id === kind ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setKind(k.id), "aria-pressed": k.id === kind, "data-kind": k.id }, k.label)))),
            h("span", { className: "tlogs-ctl-group" }, kind === 'pie' ? (h(Fragment, null,
                h("span", { className: "tlogs-ctl-label" }, "\u6784\u6210"),
                dims.map((d) => (h("button", { key: d.id, type: "button", className: d.id === effectiveDim ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setPieDim(d.id), "aria-pressed": d.id === effectiveDim }, d.label))))) : null)),
        h("div", { className: "tlogs-chart-controls" },
            h("span", { className: "tlogs-ctl-group", role: "group", "aria-label": "\u65F6\u95F4\u8303\u56F4" },
                h("span", { className: "tlogs-ctl-label" }, "\u8303\u56F4"),
                RANGES.map((r) => (h("button", { key: r.id, type: "button", className: r.id === range ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => pickRange(r.id), "aria-pressed": r.id === range }, r.label)))),
            h("span", { className: "tlogs-ctl-group" },
                h("span", { className: "tlogs-ctl-label" }, "\u6570\u636E\u6E90"),
                h("select", { className: "tlogs-input tlogs-chart-select", value: projectId, onChange: (e) => setProjectId(e.target.value), "aria-label": "\u9009\u62E9\u6570\u636E\u6E90" },
                    h("option", { value: "" }, "\u5E73\u53F0\u8D26\u5355\uFF08\u5168\u90E8\uFF09"),
                    (series?.projects ?? []).map((p) => (h("option", { key: p.id, value: p.id }, p.label)))))),
        h("div", { className: "tlogs-chart-controls" },
            h("span", { className: "tlogs-ctl-group" },
                h("span", { className: "tlogs-ctl-label" }, "\u6307\u6807"),
                h("select", { className: "tlogs-input tlogs-chart-select", value: metric, onChange: (e) => setMetric(e.target.value), "aria-label": "\u9009\u62E9\u6307\u6807" }, METRICS.map((m) => (h("option", { key: m.id, value: m.id }, m.label))))),
            h("span", { className: "tlogs-ctl-group" },
                h("span", { className: "tlogs-ctl-label" }, "\u7C92\u5EA6"),
                h("select", { className: "tlogs-input tlogs-chart-select", value: grain, onChange: (e) => setGrain(e.target.value), "aria-label": "\u9009\u62E9\u7C92\u5EA6", disabled: projectSource }, GRAINS.map((g) => (h("option", { key: g.id, value: g.id }, g.label))))),
            h("span", { className: "tlogs-ctl-group" },
                h("span", { className: "tlogs-ctl-label" }, "\u53E3\u5F84"),
                h("button", { type: "button", className: mode === 'perBucket' ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setMode('perBucket'), "aria-pressed": mode === 'perBucket' }, "\u6BCF\u671F\u65B0\u589E"),
                h("button", { type: "button", className: mode === 'cumulative' ? 'tlogs-tab is-active' : 'tlogs-tab', onClick: () => setMode('cumulative'), "aria-pressed": mode === 'cumulative' }, "\u7D2F\u8BA1"))),
        range === 'custom' ? (h("div", { className: "tlogs-chart-controls" },
            h("span", { className: "tlogs-ctl-group" },
                h("span", { className: "tlogs-ctl-label" }, "\u4ECE"),
                h("input", { type: "date", className: "tlogs-input tlogs-chart-date", value: from, max: to || todayKey(), onChange: (e) => setFrom(e.target.value), "aria-label": "\u8D77\u59CB\u65E5\u671F" }),
                h("span", { className: "tlogs-ctl-label" }, "\u5230"),
                h("input", { type: "date", className: "tlogs-input tlogs-chart-date", value: to, min: from || undefined, max: todayKey(), onChange: (e) => setTo(e.target.value), "aria-label": "\u7ED3\u675F\u65E5\u671F" })))) : null,
        series ? (h("div", { className: "tlogs-chart-scope" },
            h("span", { className: "tlogs-chart-scope-range" },
                series.from,
                " ~ ",
                series.to),
            h("span", { className: "tlogs-metric", title: metric === 'cost'
                    ? `${formatMoneyFull(rangeCost)} 元`
                    : formatFull(metricValue(rangeStat, metric)) },
                h("span", { className: "tlogs-metric-label" }, "\u533A\u95F4\u5408\u8BA1"),
                h("span", { className: "tlogs-metric-value" },
                    metric === 'cost'
                        ? formatMoneyShort(rangeCost)
                        : formatShort(metricValue(rangeStat, metric)),
                    metricSuffix(unit))),
            h("span", { className: "tlogs-metric" },
                h("span", { className: "tlogs-metric-label" }, "\u8BF7\u6C42"),
                h("span", { className: "tlogs-metric-value" },
                    formatFull(rangeStat.REQUEST),
                    " \u6B21")),
            metric === 'cost' && series.costPartial ? (h("span", { className: "tlogs-chart-scope-note" }, "\u90E8\u5206\u6708\u4EFD\u91D1\u989D\u5C1A\u672A\u56DE\u8865\uFF0C\u66F2\u7EBF\u53EF\u80FD\u504F\u4F4E")) : null,
            h("span", { className: "tlogs-chart-scope-note" }, projectSource
                ? `项目维度：${projectPoints} 条快照（插件自启用当天起逐日记录，无法回溯更早）`
                : `${buckets.length} 个${resolvedGrain === 'day' ? '天' : resolvedGrain === 'month' ? '月' : '年'}`),
            loading ? h("span", { className: "tlogs-chart-busy" }, "\u66F4\u65B0\u4E2D\u2026") : null)) : null,
        error ? h("div", { className: "tlogs-error" }, error) : null,
        !series ? (h("div", { className: "tlogs-empty" }, loading ? '加载中…' : '暂无图表数据')) : (h(Fragment, null,
            series.partial && !projectSource ? (h("div", { className: "tlogs-hint" },
                "\u6CE8\u610F\uFF1A\u8303\u56F4\u5185\u6709\u6708\u4EFD\u7F3A\u5C11\u9010\u65E5\u660E\u7EC6\uFF08\u63A5\u53E3\u53EA\u5728\u90E8\u5206\u6708\u4EFD\u8FD4\u56DE\u6309\u5929\u6570\u636E\uFF09\u3002 \u6309\u5929\u7C92\u5EA6\u4F1A\u628A\u8FD9\u4E9B\u6708\u4EFD\u753B\u6210\u65AD\u70B9\uFF1B",
                h("b", null, "\u6309\u6708 / \u6309\u5E74\u7C92\u5EA6\u4E0D\u53D7\u5F71\u54CD"),
                "\uFF08\u7528\u7684\u662F\u6708\u5EA6\u5408\u8BA1\uFF09\u3002")) : null,
            projectSource && projectPoints < 2 ? (h("div", { className: "tlogs-hint" },
                "\u8BE5\u9879\u76EE\u76EE\u524D\u53EA\u6709 ",
                projectPoints,
                " \u6761\u5FEB\u7167\uFF1A\u8D8B\u52BF\u7EBF\u9700\u8981\u81F3\u5C11\u8DE8 2 \u5929\u3002 \u5E73\u53F0\u8D26\u5355\u63A5\u53E3\u6CA1\u6709\u9879\u76EE\u7EF4\u5EA6\uFF0C\u5386\u53F2\u65E0\u6CD5\u56DE\u6EAF \u2014\u2014 \u5FEB\u7167\u4F1A\u5728\u63D2\u4EF6\u8FD0\u884C\u671F\u95F4\u6BCF\u5929\u7D2F\u79EF\u4E00\u6761\u3002")) : null,
            h("div", { className: "tlogs-chart-stage" }, kind === 'line' ? (h("div", { className: "tlogs-chart-card" },
                h("div", { className: "tlogs-chart-head" },
                    h("span", { className: "tlogs-chart-title" },
                        "\u7528\u91CF\u8D8B\u52BF",
                        h("span", { className: "tlogs-chart-sub" },
                            metricDef.label,
                            mode === 'cumulative' ? ' · 累计' : ' · 每期'))),
                h(LineChart, { points: points, unit: unit, cumulative: mode === 'cumulative' }))) : kind === 'pie' ? (h("div", { className: "tlogs-chart-card" },
                h("div", { className: "tlogs-chart-head" },
                    h("span", { className: "tlogs-chart-title" },
                        "\u6784\u6210\u5360\u6BD4",
                        h("span", { className: "tlogs-chart-sub" }, effectiveDim === 'model'
                            ? '按模型'
                            : effectiveDim === 'project'
                                ? '按项目'
                                : '输入命中 / 未命中 / 输出'))),
                h(DonutChart, { slices: slices, centerLabel: effectiveDim === 'model'
                        ? '按模型'
                        : effectiveDim === 'project'
                            ? '按项目'
                            : projectSource
                                ? (selectedProject?.label ?? '所选项目')
                                : '区间合计', centerValue: metric === 'cost'
                        ? formatMoneyShort(slices.reduce((s, x) => s + x.value, 0))
                        : formatShort(slices.reduce((s, x) => s + x.value, 0)), unit: unit, emptyText: effectiveDim === 'project'
                        ? metric === 'cost'
                            ? '项目用量来自本机会话投影，平台账单里没有它的金额'
                            : '没有可用的项目数据（宿主未提供会话用量来源）'
                        : '该范围内没有构成数据' }))) : (h("div", { className: "tlogs-chart-card" },
                h("div", { className: "tlogs-chart-head" },
                    h("span", { className: "tlogs-chart-title" },
                        "\u7528\u91CF\u5206\u5E03",
                        h("span", { className: "tlogs-chart-sub" }, "\u8F93\u5165\u547D\u4E2D / \u672A\u547D\u4E2D + \u8F93\u51FA\uFF0C\u4E09\u6BB5\u5806\u53E0"))),
                h(StackedBarChart, { points: points }))))))));
}
//# sourceMappingURL=chart-panel.js.map