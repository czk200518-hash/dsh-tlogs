/**
 * tlogs — the three chart components: line, donut and stacked bar.
 *
 * Hand-written SVG, no chart library: inside the client bundle only React resolves from the
 * platform seed table, and a chart library costs hundreds of KB for a few paths and rects.
 * Hand-written also lets every colour come from a theme token. All geometry lives in
 * chart-utils.ts; this file only assembles the SVG.
 *
 * Interaction is the same in all three: hovering highlights the element, and the details always
 * land in a fixed-height info bar under the chart rather than in a cursor-following overlay —
 * an overlay would need position: absolute (not allowed in the in-flow parts) or make the chart
 * grow with its content.
 */
import * as React from 'react';
import { h, Fragment } from './h.js';
import { formatFull, formatMoneyFull, formatMoneyShort, formatShort } from './format.js';
import { areaPath, hitSpans, labelIndices, linePath, metricSuffix, niceTicks, pointsOf, } from './chart-utils.js';
import { useT } from './i18n/index.js';
const VB_W = 720;
const LINE_H = 220;
const PAD_L = 54;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 24;
/* The bar's x labels and legend need more bottom room. */
const BAR_H = 236;
const BAR_PAD_B = 38;
const DONUT = 170;
const DONUT_R = 62;
const DONUT_W = 17;
const lineInner = { w: VB_W - PAD_L - PAD_R, h: LINE_H - PAD_T - PAD_B };
const barInner = { w: VB_W - PAD_L - PAD_R, h: BAR_H - PAD_T - BAR_PAD_B };
/**
 * Money must never go through formatShort: it would print ¥172.48 as "172", which reads as a
 * token count.
 */
function formatValue(v, unit, mode = 'short') {
    if (unit === 'money')
        return mode === 'full' ? formatMoneyFull(v) : formatMoneyShort(v);
    if (unit === 'requests')
        return formatFull(Math.round(v));
    return mode === 'full' ? formatFull(Math.round(v)) : formatShort(v);
}
/** The three-part breakdown shared by every chart (cache hit / cache miss / output). */
function breakdownOf(stat, t) {
    return [
        { label: t('chart.breakdown.hit'), value: formatFull(stat.PROMPT_CACHE_HIT_TOKEN) },
        { label: t('chart.breakdown.miss'), value: formatFull(stat.PROMPT_CACHE_MISS_TOKEN + stat.PROMPT_TOKEN) },
        { label: t('stat.output'), value: formatFull(stat.RESPONSE_TOKEN) },
        ...(stat.REQUEST > 0
            ? [{ label: t('stat.requests'), value: `${formatFull(stat.REQUEST)}${t('chart.unit.requests')}` }]
            : []),
    ];
}
/** Hover details; the fixed height keeps the layout still while moving between points. */
function InfoBar(props) {
    const { point, unit, hint } = props;
    const t = useT();
    if (!point)
        return h("div", { className: "tlogs-chart-info is-hint" }, hint);
    return (h("div", { className: "tlogs-chart-info" },
        h("span", { className: "tlogs-chart-info-key" }, point.full),
        h("span", { className: "tlogs-metric" },
            h("span", { className: "tlogs-metric-label" }, unit === 'requests' ? t('stat.requests') : unit === 'money' ? t('stat.cost') : t('chart.customMetric')),
            h("span", { className: "tlogs-metric-value" },
                formatValue(point.value, unit, 'full'),
                metricSuffix(unit, t))),
        breakdownOf(point.stat, t).map((e) => (h("span", { key: e.label, className: "tlogs-metric" },
            h("span", { className: "tlogs-metric-label" }, e.label),
            h("span", { className: "tlogs-metric-value" }, e.value))))));
}
/**
 * Summary row (total / max / min / avg).
 *
 * Money and request counts print the full value: the abbreviated ten-thousand / hundred-
 * million scale loses precision exactly where an average needs it.
 */
function Summary(props) {
    const { values, unit } = props;
    const t = useT();
    const positive = values.filter((v) => v > 0);
    const total = values.reduce((s, v) => s + v, 0);
    const max = positive.length > 0 ? Math.max(...positive) : 0;
    const min = positive.length > 0 ? Math.min(...positive) : 0;
    const avg = positive.length > 0 ? total / positive.length : 0;
    const items = [
        ['chart.sum.total', total, false],
        ['chart.sum.max', max, false],
        ['chart.sum.min', min, false],
        ['chart.sum.avg', avg, true],
    ];
    return (h("div", { className: "tlogs-chart-summary" }, items.map(([labelKey, v, isAvg]) => (h("span", { key: labelKey, className: "tlogs-metric", title: formatValue(v, unit, 'full') },
        h("span", { className: "tlogs-metric-label" }, t(labelKey)),
        h("span", { className: "tlogs-metric-value" },
            unit === 'tokens' && isAvg ? formatShort(v) : formatValue(v, unit, 'short'),
            isAvg || unit === 'tokens' ? '' : metricSuffix(unit, t)))))));
}
function Axis(props) {
    const { ticks, max, width, height } = props;
    return (h(Fragment, null, ticks.map((t) => {
        const y = height - (t / (max > 0 ? max : 1)) * height;
        return (h(Fragment, { key: `t-${t}` },
            h("line", { className: "tlogs-grid", x1: 0, x2: width, y1: y, y2: y }),
            h("text", { className: "tlogs-axis-text is-y", x: -8, y: y + 3, textAnchor: "end" }, formatShort(t))));
    })));
}
function AxisLabels(props) {
    const { points, xs, y, max = 7 } = props;
    const shown = labelIndices(points.length, max);
    return (h(Fragment, null, points.map((p, i) => shown.has(i) ? (h("text", { key: `x-${p.key}`, className: "tlogs-axis-text", x: xs[i][0], y: y, textAnchor: "middle" }, p.label)) : null)));
}
export function LineChart(props) {
    const { points, unit, cumulative } = props;
    const t = useT();
    const [hover, setHover] = React.useState(null);
    if (points.length === 0) {
        return h("div", { className: "tlogs-empty" }, t('chart.noPlotData'));
    }
    const values = points.map((p) => p.value);
    const ticks = niceTicks(maxOfArray(values));
    const max = ticks[ticks.length - 1];
    const xs = pointsOf(values, lineInner.w, lineInner.h, max);
    const spans = hitSpans(xs, lineInner.w);
    const line = linePath(values, lineInner.w, lineInner.h, max);
    const area = areaPath(values, lineInner.w, lineInner.h, max);
    const active = hover === null ? null : points[hover] ?? null;
    return (h(Fragment, null,
        h("svg", { className: "tlogs-chart-svg", viewBox: `0 0 ${VB_W} ${LINE_H}`, role: "img", "aria-label": t('chart.aria.line') },
            h("g", { transform: `translate(${PAD_L}, ${PAD_T})` },
                h(Axis, { ticks: ticks, max: max, width: lineInner.w, height: lineInner.h }),
                area ? h("path", { className: "tlogs-area", d: area }) : null,
                line ? h("path", { className: "tlogs-line", d: line }) : null,
                active ? (h(Fragment, null,
                    h("line", { className: "tlogs-guide", x1: xs[hover][0], x2: xs[hover][0], y1: 0, y2: lineInner.h }),
                    h("circle", { className: "tlogs-dot", cx: xs[hover][0], cy: xs[hover][1], r: 3.5 }))) : null,
                points.map((p, i) => (h("rect", { key: `h-${p.key}`, className: "tlogs-hit", x: spans[i][0], width: Math.max(0, spans[i][1] - spans[i][0]), y: 0, height: lineInner.h, onMouseEnter: () => setHover(i), onMouseLeave: () => setHover((cur) => (cur === i ? null : cur)), "data-key": p.key }))),
                h(AxisLabels, { points: points, xs: xs, y: lineInner.h + 15 }))),
        h(Summary, { values: values, unit: unit }),
        h(InfoBar, { point: active, unit: unit, hint: cumulative ? t('chart.hint.lineCumulative') : t('chart.hint.line') })));
}
/**
 * Stacked bar: each bar stacks cache-hit / cache-miss / output tokens and overlays a dashed
 * request-count line on its own scale.
 */
export function StackedBarChart(props) {
    const { points } = props;
    const t = useT();
    const [hover, setHover] = React.useState(null);
    if (points.length === 0) {
        return h("div", { className: "tlogs-empty" }, t('chart.noPlotData'));
    }
    const totals = points.map((p) => p.stat.PROMPT_CACHE_HIT_TOKEN +
        p.stat.PROMPT_CACHE_MISS_TOKEN +
        p.stat.PROMPT_TOKEN +
        p.stat.RESPONSE_TOKEN);
    const ticks = niceTicks(maxOfArray(totals));
    const max = ticks[ticks.length - 1];
    const reqMax = Math.max(0, ...points.map((p) => p.stat.REQUEST));
    const slot = barInner.w / points.length;
    const barW = Math.max(1.5, Math.min(26, slot * 0.72));
    const active = hover === null ? null : points[hover] ?? null;
    const seg = (v) => (max > 0 ? (Math.max(0, v) / max) * barInner.h : 0);
    const centers = points.map((_, i) => slot * (i + 0.5));
    const reqLine = reqMax > 0
        ? points
            .map((p, i) => {
            const y = barInner.h - (p.stat.REQUEST / reqMax) * barInner.h;
            return `${i === 0 ? 'M' : 'L'}${r2(centers[i])} ${r2(y)}`;
        })
            .join(' ')
        : '';
    return (h(Fragment, null,
        h("div", { className: "tlogs-legend" },
            h("span", { className: "tlogs-legend-item" },
                h("i", { className: "tlogs-swatch tlogs-swatch-c1" }),
                t('chart.legend.hit')),
            h("span", { className: "tlogs-legend-item" },
                h("i", { className: "tlogs-swatch tlogs-swatch-c2" }),
                t('chart.legend.miss')),
            h("span", { className: "tlogs-legend-item" },
                h("i", { className: "tlogs-swatch tlogs-swatch-c3" }),
                t('stat.output')),
            reqMax > 0 ? (h("span", { className: "tlogs-legend-item" },
                h("i", { className: "tlogs-swatch tlogs-swatch-req" }),
                t('chart.metric.requests'))) : null),
        h("svg", { className: "tlogs-chart-svg", viewBox: `0 0 ${VB_W} ${BAR_H}`, role: "img", "aria-label": t('chart.aria.bar') },
            h("g", { transform: `translate(${PAD_L}, ${PAD_T})` },
                h(Axis, { ticks: ticks, max: max, width: barInner.w, height: barInner.h }),
                points.map((p, i) => {
                    const x = slot * i + (slot - barW) / 2;
                    const h1 = seg(p.stat.PROMPT_CACHE_HIT_TOKEN);
                    const h2 = seg(p.stat.PROMPT_CACHE_MISS_TOKEN + p.stat.PROMPT_TOKEN);
                    const h3 = seg(p.stat.RESPONSE_TOKEN);
                    let bottom = barInner.h;
                    const y3 = (bottom -= h3);
                    const y2 = (bottom -= h2);
                    const y1 = (bottom -= h1);
                    return (h("g", { key: `b-${p.key}`, className: hover === i ? 'tlogs-bar is-active' : 'tlogs-bar' },
                        h("rect", { className: "tlogs-fill-c3", x: r2(x), y: r2(y3), width: r2(barW), height: r2(h3) }),
                        h("rect", { className: "tlogs-fill-c2", x: r2(x), y: r2(y2), width: r2(barW), height: r2(h2) }),
                        h("rect", { className: "tlogs-fill-c1", x: r2(x), y: r2(y1), width: r2(barW), height: r2(h1) }),
                        h("rect", { className: "tlogs-hit", x: r2(slot * i), y: 0, width: r2(slot), height: barInner.h, onMouseEnter: () => setHover(i), onMouseLeave: () => setHover((cur) => (cur === i ? null : cur)), "data-key": p.key })));
                }),
                reqLine ? h("path", { className: "tlogs-reqline", d: reqLine }) : null,
                points.map((p, i) => labelIndices(points.length, 9).has(i) ? (h("text", { key: `bx-${p.key}`, className: "tlogs-axis-text", x: r2(centers[i]), y: barInner.h + 16, textAnchor: "middle" }, p.label)) : null))),
        h(Summary, { values: totals, unit: "tokens" }),
        h(InfoBar, { point: active, unit: "tokens", hint: t('chart.hint.bar') })));
}
/**
 * Donut chart.
 *
 * Segments are drawn with stroke-dasharray instead of path arcs: a lone 100% segment
 * degenerates as an arc (start and end coincide, so SVG draws nothing), while dasharray is
 * correct by construction.
 */
export function DonutChart(props) {
    const { slices, centerLabel, centerValue, unit, emptyText } = props;
    const t = useT();
    const [hover, setHover] = React.useState(null);
    if (slices.length === 0) {
        return h("div", { className: "tlogs-empty" }, emptyText ?? t('chart.empty.composition'));
    }
    const total = slices.reduce((s, x) => s + x.value, 0);
    const c = 2 * Math.PI * DONUT_R;
    let before = 0;
    const active = hover === null ? null : slices[hover] ?? null;
    return (h(Fragment, null,
        h("div", { className: "tlogs-donut-wrap" },
            h("svg", { className: "tlogs-donut", viewBox: `0 0 ${DONUT} ${DONUT}`, role: "img", "aria-label": t('chart.aria.donut') },
                h("g", { transform: `rotate(-90 ${DONUT / 2} ${DONUT / 2})` }, slices.map((s, i) => {
                    const len = (s.value / total) * c;
                    const el = (h("circle", { key: s.key, className: `tlogs-donut-seg tlogs-stroke-c${(s.colorIndex % 6) + 1}${hover === i ? ' is-active' : ''}`, cx: DONUT / 2, cy: DONUT / 2, r: DONUT_R, fill: "none", strokeWidth: hover === i ? DONUT_W + 5 : DONUT_W, strokeDasharray: `${r2(len)} ${r2(c - len)}`, strokeDashoffset: r2(-before), onMouseEnter: () => setHover(i), onMouseLeave: () => setHover((cur) => (cur === i ? null : cur)), "data-key": s.key }));
                    before += len;
                    return el;
                })),
                h("text", { className: "tlogs-donut-center", x: DONUT / 2, y: DONUT / 2 - 2, textAnchor: "middle" }, active ? `${(active.percent * 100).toFixed(1)}%` : centerValue),
                h("text", { className: "tlogs-donut-sub", x: DONUT / 2, y: DONUT / 2 + 14, textAnchor: "middle" }, active ? active.label : centerLabel)),
            h("ul", { className: "tlogs-donut-legend" }, slices.map((s, i) => (h("li", { key: s.key, className: hover === i ? 'tlogs-legend-row is-active' : 'tlogs-legend-row', onMouseEnter: () => setHover(i), onMouseLeave: () => setHover((cur) => (cur === i ? null : cur)), title: `${s.label} · ${formatFull(s.value)}${metricSuffix(unit, t)}` },
                h("i", { className: `tlogs-swatch tlogs-swatch-c${(s.colorIndex % 6) + 1}` }),
                h("span", { className: "tlogs-legend-name" }, s.label),
                h("span", { className: "tlogs-legend-value" }, formatShort(s.value)),
                h("span", { className: "tlogs-legend-pct" },
                    (s.percent * 100).toFixed(1),
                    "%")))))),
        h(InfoBar, { point: null, unit: unit, hint: t('chart.hint.donut') })));
}
function maxOfArray(values) {
    let max = 0;
    for (const v of values)
        if (Number.isFinite(v) && v > max)
            max = v;
    return max;
}
function r2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=charts.js.map