window.__ModuleLoader__.load({ id: "dsh-tlogs", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  FOOTER_SLOT: () => FOOTER_SLOT,
  SLOT_ITEM_ID: () => SLOT_ITEM_ID,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/styles.ts
var STYLE_ID = "tlogs-style";
var PLUGIN_ID = "tlogs";
var CSS = `
.tlogs {
  /* ---- \u4E3B\u9898 token \u522B\u540D\uFF08\u5E26 fallback\uFF0C\u5BBF\u4E3B token \u7F3A\u5931\u4E5F\u80FD\u6E32\u67D3\uFF09 ---- */
  --tlogs-fg: var(--dsw-alias-label-primary, currentColor);
  --tlogs-muted: var(--dsw-alias-label-tertiary, color-mix(in srgb, currentColor 58%, transparent));
  --tlogs-card-bg: var(--dsw-alias-bg-layer-1, color-mix(in srgb, currentColor 6%, transparent));
  --tlogs-panel-bg: var(--dsw-alias-bg-layer-2, color-mix(in srgb, currentColor 4%, transparent));
  --tlogs-border: var(--dsw-alias-border-l3, color-mix(in srgb, currentColor 16%, transparent));
  --tlogs-border-strong: var(--dsw-alias-border-l4, color-mix(in srgb, currentColor 24%, transparent));
  --tlogs-hover: var(--dsw-alias-interactive-bg-hover, color-mix(in srgb, currentColor 9%, transparent));
  --tlogs-accent: var(--dsw-alias-state-business-primary, #4d6bfe);
  --tlogs-warn: var(--dsw-alias-state-warn-primary, #d97706);
  --tlogs-danger: var(--dsw-alias-state-error-primary, #dc2626);
  --tlogs-radius: var(--dsw-radius-xs, 4px);
  --tlogs-gap: 6px;

  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  font-family: var(--dsw-font-family, inherit);
  font-size: 11px;
  line-height: 1.4;
  color: var(--tlogs-fg);
}
.tlogs *, .tlogs *::before, .tlogs *::after { box-sizing: border-box; }
.tlogs button, .tlogs input { font-family: inherit; }

/* ---------- \u5F62\u6001 A\uFF1A\u7D27\u51D1\u6761\uFF0828\u201332px\uFF09 ---------- */
.tlogs-compact {
  display: flex;
  align-items: center;
  gap: var(--tlogs-gap);
  height: 30px;
  min-height: 30px;
  padding: 0 6px;
  width: 100%;
  min-width: 0;
  border-radius: var(--tlogs-radius);
  color: inherit;
  cursor: pointer;
}
.tlogs-compact:hover { background: var(--tlogs-hover); }

/* \u6536\u8D77\u6001\uFF08\u56FE\u6807\u680F\uFF09\uFF1A\u53EA\u663E\u793A\u603B\u8BA1\u6570\u5B57\u3002\u539F\u5148\u8FD9\u91CC\u653E\u4E00\u4E2A\u6C42\u548C\u7B26\u53F7\u5FBD\u6807\uFF0C\u5DF2\u6309\u8981\u6C42\u5220\u9664\u3002 */
.tlogs-collapsed-value {
  flex: 1 1 auto;
  min-width: 0;
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  color: var(--tlogs-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tlogs-collapsed .tlogs-compact { justify-content: center; padding: 0 2px; }

/*
 * \u5E03\u5C40\u8981\u70B9\uFF1A**\u6570\u5B57\u4F18\u5148**\u3002
 *
 * \u539F\u5148 .tlogs-metric \u91CC\u7684\u6807\u7B7E\u548C\u6570\u5B57\u90FD\u662F\u53EF\u538B\u7F29\u7684\uFF0C\u5BB9\u5668\u53C8\u662F overflow: hidden\uFF0C
 * \u4E8E\u662F\u7A7A\u95F4\u4E00\u7D27\u5C31\u628A\u6574\u884C\u672B\u5C3E\uFF08\u542B\u6570\u5B57\uFF09\u88C1\u6389 \u2014\u2014 \u5B9E\u6D4B\u8868\u73B0\u4E3A\u6700\u540E\u4E00\u9879\u663E\u793A\u6210
 * \u300C\u672C\u6708 359\u300D\u800C\u4E0D\u662F\u5B8C\u6574\u7684\u300C359M\u300D\u3002
 *
 * \u73B0\u5728\uFF1A\u6570\u5B57\u7528 flex 0 0 auto\uFF0C\u6C38\u4E0D\u538B\u7F29/\u622A\u65AD\uFF1B\u6807\u7B7E\u53EF\u538B\u7F29\u5E76\u53EF\u7701\u7565\u53F7\u6536\u5C3E\uFF0C
 * \u7A7A\u95F4\u4E0D\u8DB3\u65F6\u5148\u727A\u7272\u6807\u7B7E\u3001\u4FDD\u4F4F\u6570\u5B57\u3002
 */
.tlogs-metrics {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  white-space: nowrap;
}
.tlogs-metric { display: inline-flex; align-items: baseline; gap: 3px; min-width: 0; }
.tlogs-metric-label {
  color: var(--tlogs-muted);
  font-size: 10px;
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tlogs-metric-value {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.tlogs-sep { color: var(--tlogs-muted); opacity: 0.6; flex: 0 0 auto; }

.tlogs-actions { display: inline-flex; align-items: center; gap: 2px; flex: 0 0 auto; }

/* \u5C55\u5F00/\u6536\u8D77\u6309\u94AE\uFF1A\u5FC5\u987B\u662F**\u770B\u5F97\u89C1**\u7684\u6309\u94AE\u3002
   \u6B64\u524D\u5B83\u662F 10px\u3001\u65E0\u8FB9\u6846\u3001\u7528 tertiary \u7070\u7684\u9879\u76EE\u7B26\u53F7\uFF0C\u5728\u9875\u811A\u5E95\u8272\u4E0A\u51E0\u4E4E\u4E0D\u53EF\u8FA8\u8BA4\u3002 */
.tlogs-iconbtn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--tlogs-border-strong);
  background: var(--tlogs-card-bg);
  color: var(--tlogs-fg);
  cursor: pointer;
  border-radius: var(--tlogs-radius);
  font-size: 11px;
  line-height: 1;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.tlogs-iconbtn:hover {
  color: var(--tlogs-accent);
  border-color: var(--tlogs-accent);
  background: var(--tlogs-hover);
}
.tlogs-iconbtn:focus-visible { outline: 2px solid var(--tlogs-accent); outline-offset: 1px; }

/* \u6570\u636E\u53EF\u80FD\u8FC7\u671F\u89D2\u6807\uFF08\u9700\u6C42 5.4\uFF09 */
.tlogs-stale { flex: 0 0 auto; font-size: 10px; color: var(--tlogs-warn); cursor: help; }

/* \u9996\u6B21\u5168\u91CF\u62C9\u53D6\u8FDB\u5EA6 */
.tlogs-progress {
  display: block;
  height: 2px;
  width: 100%;
  overflow: hidden;
  border-radius: 1px;
  background: var(--tlogs-border);
}
.tlogs-progress > i {
  display: block;
  height: 100%;
  background: var(--tlogs-accent);
  transition: width 200ms ease-out;
}

/* ---------- \u5F62\u6001 B\uFF1A\u5C55\u5F00\u9762\u677F\uFF08\u5C31\u5730\u6491\u5F00\uFF09 ---------- */
.tlogs-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 8px 6px 10px;
  margin-top: 2px;
  max-height: 300px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--tlogs-panel-bg);
  border-top: 1px solid var(--tlogs-border);
  border-radius: var(--tlogs-radius);
  animation: tlogs-expand 140ms ease-out;
}
@keyframes tlogs-expand {
  from { max-height: 0; opacity: 0; }
  to { max-height: 300px; opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .tlogs-panel { animation: none; }
  .tlogs-progress > i { transition: none; }
}

.tlogs-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 8px;
  border-radius: var(--tlogs-radius);
  font-size: 11px;
  color: var(--tlogs-fg);
  background: color-mix(in srgb, var(--tlogs-warn) 14%, transparent);
}
.tlogs-notice-danger { background: color-mix(in srgb, var(--tlogs-danger) 14%, transparent); }

.tlogs-cards { display: grid; grid-template-columns: 1fr; gap: 6px; }
.tlogs-w-full .tlogs-cards { grid-template-columns: 1fr 1fr; }

.tlogs-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 7px 8px;
  border-radius: var(--tlogs-radius);
  background: var(--tlogs-card-bg);
  border: 1px solid transparent;
  min-width: 0;
}
.tlogs-card-clickable { cursor: pointer; }
.tlogs-card-clickable:hover { border-color: var(--tlogs-border-strong); }
.tlogs-card-clickable:focus-visible { outline: 2px solid var(--tlogs-accent); outline-offset: 1px; }
.tlogs-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}
.tlogs-card-title {
  font-size: 10px;
  color: var(--tlogs-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tlogs-card-total {
  font-size: 15px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.tlogs-card-total.is-error { font-size: 11px; font-weight: 400; color: var(--tlogs-muted); }
.tlogs-card-split { display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 10px; color: var(--tlogs-muted); }
.tlogs-card-split b { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--tlogs-fg); }

.tlogs-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-top: 2px;
}
.tlogs-btn {
  appearance: none;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: var(--tlogs-radius);
  border: 1px solid var(--tlogs-border-strong);
  background: transparent;
  color: var(--tlogs-fg);
  cursor: pointer;
  white-space: nowrap;
}
.tlogs-btn:hover { background: var(--tlogs-hover); }
.tlogs-btn:focus-visible { outline: 2px solid var(--tlogs-accent); outline-offset: 1px; }
.tlogs-btn:disabled { opacity: 0.45; cursor: default; }
.tlogs-btn-primary { border-color: var(--tlogs-accent); color: var(--tlogs-accent); }

.tlogs-input {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 11px;
  padding: 3px 6px;
  border-radius: var(--tlogs-radius);
  border: 1px solid var(--tlogs-border-strong);
  background: var(--dsw-alias-bg-base, transparent);
  color: var(--tlogs-fg);
}
.tlogs-input:focus-visible { outline: 2px solid var(--tlogs-accent); outline-offset: 0; }

/* ---------- \u8BE6\u7EC6\u89C6\u56FE\uFF08\u540C\u4E00\u5BB9\u5668\u5185\u5207\u6362\uFF09 ---------- */
.tlogs-detail { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.tlogs-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.tlogs-tabs { display: flex; flex-wrap: wrap; gap: 3px; }
.tlogs-tab {
  appearance: none;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--tlogs-card-bg);
  color: var(--tlogs-fg);
  cursor: pointer;
}
.tlogs-tab.is-active { border-color: var(--tlogs-accent); color: var(--tlogs-accent); background: transparent; }

.tlogs-table { width: 100%; border-collapse: collapse; font-size: 10px; }
.tlogs-table th, .tlogs-table td { padding: 3px 4px; text-align: right; white-space: nowrap; }
.tlogs-table th:first-child, .tlogs-table td:first-child {
  text-align: left;
  max-width: 9em;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tlogs-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--tlogs-panel-bg);
  border-bottom: 1px solid var(--tlogs-border-strong);
  color: var(--tlogs-muted);
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
.tlogs-table tbody tr:hover { background: var(--tlogs-hover); }
.tlogs-table td {
  font-variant-numeric: tabular-nums;
  border-bottom: 1px solid var(--tlogs-border);
}
.tlogs-empty { padding: 10px 4px; text-align: center; color: var(--tlogs-muted); font-size: 11px; }
.tlogs-scroll { max-height: 190px; overflow-y: auto; overscroll-behavior: contain; }
.tlogs-error { color: var(--tlogs-danger); font-size: 10px; line-height: 1.5; }
/* \u8BF4\u660E\u6027\u63D0\u793A\uFF08\u4F8B\u5982\u300C\u5185\u7F6E\u767B\u5F55\u4E0D\u53EF\u7528\uFF0C\u8BF7\u624B\u52A8\u586B\u5199\u300D\uFF09\u3002 */
.tlogs-hint { color: var(--tlogs-muted); font-size: 10px; line-height: 1.55; }
`;
function installStyles(doc = document) {
  const existing = doc.getElementById(STYLE_ID);
  if (existing) return () => {
  };
  const el = doc.createElement("style");
  el.id = STYLE_ID;
  el.dataset.plugin = PLUGIN_ID;
  el.dataset.pluginCss = `${PLUGIN_ID}/styles.css`;
  el.textContent = CSS;
  doc.head.appendChild(el);
  return () => {
    el.remove();
  };
}

// src/client/footer.tsx
var React6 = __toESM(require("react"), 1);

// src/client/h.ts
var React = __toESM(require("react"), 1);
var h = React.createElement;
var Fragment2 = React.Fragment;

// src/client/compact-bar.tsx
var React2 = require("react");

// src/client/format.ts
function formatFull(n) {
  if (!Number.isFinite(n)) return "0";
  const neg = n < 0;
  const abs = Math.abs(Math.trunc(n));
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg ? `-${s}` : s;
}
function formatShort(n) {
  if (!Number.isFinite(n)) return "0";
  const neg = n < 0;
  const abs = Math.abs(n);
  const units = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"]
  ];
  for (const [div, suffix] of units) {
    if (abs >= div) {
      const v = abs / div;
      const s = v < 100 ? v.toFixed(1).replace(/\.0$/, "") : String(Math.round(v));
      return (neg ? "-" : "") + s + suffix;
    }
  }
  return (neg ? "-" : "") + String(Math.trunc(abs));
}
function formatNumber(n, mode) {
  return mode === "short" ? formatShort(n) : formatFull(n);
}

// src/client/compact-bar.tsx
function CompactBar(props) {
  const { snapshot, numberFormat, wide, expanded, busy, onToggle } = props;
  const metrics = snapshot?.compact ?? [];
  const stale = snapshot?.stale === true;
  const progress = snapshot?.loading ? snapshot.progress ?? 0 : null;
  const lead = metrics.find((m) => m.scope === "total") ?? metrics[0];
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h(
    "div",
    {
      className: wide ? "tlogs-compact" : "tlogs-compact tlogs-collapsed",
      onClick: onToggle,
      title: "tlogs \u2014 DeepSeek \u7528\u91CF"
    },
    wide ? /* @__PURE__ */ h("span", { className: "tlogs-metrics" }, metrics.map((m, i) => /* @__PURE__ */ h(Fragment2, { key: `${m.scope}-${i}` }, i > 0 ? /* @__PURE__ */ h("span", { className: "tlogs-sep" }, "\xB7") : null, /* @__PURE__ */ h("span", { className: "tlogs-metric", title: `${m.label} ${formatFull(m.value)} tokens` }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, m.label), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, formatNumber(m.value, numberFormat))))), metrics.length === 0 ? /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, "\u6682\u65E0\u6570\u636E") : null) : /* @__PURE__ */ h(
      "span",
      {
        className: "tlogs-collapsed-value",
        title: lead ? `${lead.label} ${formatFull(lead.value)} tokens` : "tlogs \u2014 DeepSeek \u7528\u91CF"
      },
      lead ? formatNumber(lead.value, numberFormat) : "\u2014"
    ),
    /* @__PURE__ */ h("span", { className: "tlogs-actions" }, stale ? /* @__PURE__ */ h(
      "span",
      {
        className: "tlogs-stale",
        title: snapshot?.error ?? "\u6570\u636E\u53EF\u80FD\u8FC7\u671F\uFF1A\u6700\u8FD1\u4E00\u6B21\u5237\u65B0\u5931\u8D25\uFF0C\u5F53\u524D\u663E\u793A\u7F13\u5B58\u503C"
      },
      "\u26A0"
    ) : null, busy ? /* @__PURE__ */ h("span", { className: "tlogs-stale", title: "\u6B63\u5728\u5237\u65B0\u2026" }, "\u27F3") : null, /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "tlogs-iconbtn",
        onClick: (e) => {
          e.stopPropagation();
          onToggle();
        },
        "aria-expanded": expanded,
        "aria-label": expanded ? "\u6536\u8D77 tlogs \u9762\u677F" : "\u5C55\u5F00 tlogs \u9762\u677F",
        title: expanded ? "\u6536\u8D77" : "\u5C55\u5F00"
      },
      expanded ? "\u25B4" : "\u25BE"
    ))
  ), progress !== null ? /* @__PURE__ */ h("span", { className: "tlogs-progress", "aria-hidden": "true" }, /* @__PURE__ */ h("i", { style: { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` } })) : null);
}

// src/client/expand-panel.tsx
var React3 = __toESM(require("react"), 1);
var SOURCE_LABEL = {
  env: "\u73AF\u5883\u53D8\u91CF",
  config: "\u63D2\u4EF6\u914D\u7F6E",
  credentials: "\u672C\u673A\u51ED\u636E\uFF08\u624B\u52A8\u586B\u5199 / \u767B\u5F55\uFF09",
  "platform-session": "DSH \u8D26\u53F7\u767B\u5F55\u6001\uFF08\u81EA\u52A8\u590D\u7528\uFF09",
  "desktop-login": "\u5185\u7F6E\u767B\u5F55\u7A97\u53E3"
};
function Card(props) {
  const { card, numberFormat, selectedId, onCycle } = props;
  const clickable = typeof onCycle === "function" && (card.options?.length ?? 0) > 1;
  const current = card.options?.find((o) => o.id === selectedId) ?? card.options?.[0];
  const stat = current?.stat ?? card.stat;
  return /* @__PURE__ */ h(
    "div",
    {
      className: clickable ? "tlogs-card tlogs-card-clickable" : "tlogs-card",
      onClick: clickable ? onCycle : void 0,
      role: clickable ? "button" : void 0,
      tabIndex: clickable ? 0 : void 0,
      onKeyDown: clickable ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCycle?.();
        }
      } : void 0,
      title: clickable ? "\u70B9\u51FB\u5207\u6362\u9879\u76EE" : void 0
    },
    /* @__PURE__ */ h("div", { className: "tlogs-card-head" }, /* @__PURE__ */ h("span", { className: "tlogs-card-title" }, card.label, current && (card.options?.length ?? 0) > 1 ? ` \xB7 ${current.label}` : ""), card.stale ? /* @__PURE__ */ h("span", { className: "tlogs-stale" }, "\u26A0") : null),
    card.error ? /* @__PURE__ */ h("span", { className: "tlogs-card-total is-error" }, card.error) : /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("span", { className: "tlogs-card-total", title: `${formatFull(stat.totalTokens)} tokens` }, formatNumber(stat.totalTokens, numberFormat)), /* @__PURE__ */ h("span", { className: "tlogs-card-split" }, /* @__PURE__ */ h("span", null, "\u8F93\u5165 ", /* @__PURE__ */ h("b", { title: formatFull(stat.inputTokens) }, formatNumber(stat.inputTokens, numberFormat))), /* @__PURE__ */ h("span", null, "\u8F93\u51FA ", /* @__PURE__ */ h("b", { title: formatFull(stat.outputTokens) }, formatNumber(stat.outputTokens, numberFormat))), /* @__PURE__ */ h("span", null, "\u8BF7\u6C42 ", /* @__PURE__ */ h("b", { title: formatFull(stat.requests) }, formatNumber(stat.requests, numberFormat)))))
  );
}
function ExpandPanel(props) {
  const {
    snapshot,
    error,
    busy,
    numberFormat,
    enableDetailView,
    onRefresh,
    onOpenDetail,
    onLogin,
    onSetToken,
    onLogout
  } = props;
  const [showTokenInput, setShowTokenInput] = React3.useState(false);
  const [draft, setDraft] = React3.useState("");
  const [selections, setSelections] = React3.useState({});
  const auth = snapshot?.auth ?? { status: "unknown" };
  const needsAuth = auth.status === "invalid" || auth.status === "missing";
  const loginAvailable = snapshot?.display.loginAvailable !== false;
  const cycle = (index, card) => {
    const opts = card.options ?? [];
    if (opts.length < 2) return;
    const currentId = selections[index] ?? card.selectedOptionId ?? opts[0].id;
    const pos = opts.findIndex((o) => o.id === currentId);
    const next = opts[(pos + 1) % opts.length];
    setSelections((prev) => ({ ...prev, [index]: next.id }));
  };
  const submitToken = async () => {
    const t = draft.trim();
    if (!t) return;
    const ok = await onSetToken(t);
    if (ok) {
      setDraft("");
      setShowTokenInput(false);
    }
  };
  return /* @__PURE__ */ h("div", { className: "tlogs-panel" }, needsAuth ? /* @__PURE__ */ h("div", { className: "tlogs-notice tlogs-notice-danger" }, /* @__PURE__ */ h("span", null, auth.status === "invalid" ? "userToken \u5DF2\u5931\u6548\uFF0C\u9700\u8981\u91CD\u65B0\u767B\u5F55" : "\u672A\u914D\u7F6E userToken\uFF0C\u65E0\u6CD5\u83B7\u53D6\u7528\u91CF", auth.status === "invalid" && auth.message ? /* @__PURE__ */ h("span", { className: "tlogs-hint" }, " \u2014\u2014 ", auth.message) : null), /* @__PURE__ */ h("span", { className: "tlogs-actions" }, /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "tlogs-btn tlogs-btn-primary",
      onClick: onLogin,
      disabled: !loginAvailable,
      title: loginAvailable ? "\u6253\u5F00\u5185\u7F6E\u767B\u5F55\u7A97\u53E3" : "\u5F53\u524D\u5BBF\u4E3B\u65E0\u6CD5\u521B\u5EFA\u767B\u5F55\u7A97\u53E3\uFF0C\u8BF7\u7528\u300C\u624B\u52A8\u586B\u5199\u300D\u7C98\u8D34 platform userToken"
    },
    "\u767B\u5F55"
  ), /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "tlogs-btn",
      onClick: () => setShowTokenInput((v) => !v),
      title: "\u624B\u52A8\u7C98\u8D34 userToken\uFF08\u65B9\u6848 C\uFF09"
    },
    "\u624B\u52A8\u586B\u5199"
  ))) : null, needsAuth && !loginAvailable ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, "\u5185\u7F6E\u767B\u5F55\u5728\u5F53\u524D\u5BBF\u4E3B\u4E0D\u53EF\u7528\uFF1A\u63D2\u4EF6\u8FD0\u884C\u5728 Electron \u7684 Node \u5B50\u8FDB\u7A0B\u91CC\uFF0C\u521B\u5EFA\u4E0D\u4E86\u767B\u5F55\u7A97\u53E3\u3002 \u8BF7\u70B9\u300C\u624B\u52A8\u586B\u5199\u300D\u7C98\u8D34 platform userToken\uFF08\u5F62\u5982\u6D4F\u89C8\u5668 localStorage \u91CC\u7684 userToken \u503C\uFF09\u3002") : null, showTokenInput ? /* @__PURE__ */ h("div", { className: "tlogs-notice" }, /* @__PURE__ */ h(
    "input",
    {
      className: "tlogs-input",
      type: "password",
      autoComplete: "off",
      spellCheck: false,
      placeholder: "\u7C98\u8D34 userToken",
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter") void submitToken();
      }
    }
  ), /* @__PURE__ */ h("span", { className: "tlogs-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn tlogs-btn-primary", onClick: () => void submitToken() }, "\u4FDD\u5B58"), /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "tlogs-btn",
      onClick: () => {
        setDraft("");
        setShowTokenInput(false);
      }
    },
    "\u53D6\u6D88"
  ))) : null, error ? /* @__PURE__ */ h("div", { className: "tlogs-error" }, error) : null, auth.status === "ok" ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, "\u51ED\u636E\u6765\u6E90\uFF1A", SOURCE_LABEL[auth.source] ?? auth.source) : null, /* @__PURE__ */ h("div", { className: "tlogs-cards" }, (snapshot?.cards ?? []).map((card, i) => /* @__PURE__ */ h(
    Card,
    {
      key: `${card.scope}-${card.label}-${i}`,
      card,
      numberFormat,
      selectedId: selections[i] ?? card.selectedOptionId,
      onCycle: card.options && card.options.length > 1 ? () => cycle(i, card) : void 0
    }
  )), snapshot === null ? /* @__PURE__ */ h("div", { className: "tlogs-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : null), /* @__PURE__ */ h("div", { className: "tlogs-footer-actions" }, enableDetailView ? /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onOpenDetail }, "\u8BE6\u7EC6\u6570\u636E \u203A") : /* @__PURE__ */ h("span", null), /* @__PURE__ */ h("span", { className: "tlogs-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"), /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onLogout, title: "\u6E05\u9664\u672C\u673A\u4FDD\u5B58\u7684 userToken" }, "\u9000\u51FA\u767B\u5F55"))));
}

// src/client/detail-view.tsx
var React4 = __toESM(require("react"), 1);
var COLUMNS = [
  { key: "label", label: "\u540D\u79F0" },
  { key: "inputTokens", label: "\u8F93\u5165" },
  { key: "outputTokens", label: "\u8F93\u51FA" },
  { key: "totalTokens", label: "\u603B Token" },
  { key: "requests", label: "\u8BF7\u6C42" }
];
var TABS = [
  { id: "models", label: "\u6A21\u578B", pick: (d) => d.models },
  { id: "years", label: "\u5E74", pick: (d) => d.years },
  { id: "months", label: "\u6708", pick: (d) => d.months },
  { id: "days", label: "\u5F53\u6708\u6309\u5929", pick: (d) => d.days }
];
function sortRows(rows, key, dir) {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "label") return sign * a.label.localeCompare(b.label);
    return sign * (a.stat[key] - b.stat[key]);
  });
}
function DetailView(props) {
  const { detail, loading, onBack, onRefresh, busy } = props;
  const [tab, setTab] = React4.useState("models");
  const [sort, setSort] = React4.useState({
    key: "totalTokens",
    dir: "desc"
  });
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const rows = detail ? sortRows(active.pick(detail), sort.key, sort.dir) : [];
  const toggleSort = (key) => {
    setSort((prev) => prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" });
  };
  return /* @__PURE__ */ h("div", { className: "tlogs-panel tlogs-detail" }, /* @__PURE__ */ h("div", { className: "tlogs-detail-head" }, /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onBack }, "\u2039 \u8FD4\u56DE"), /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0")), /* @__PURE__ */ h("div", { className: "tlogs-tabs", role: "tablist" }, TABS.map((t) => /* @__PURE__ */ h(
    "button",
    {
      key: t.id,
      type: "button",
      role: "tab",
      "aria-selected": t.id === tab,
      className: t.id === tab ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => setTab(t.id)
    },
    t.label
  ))), loading && !detail ? /* @__PURE__ */ h("div", { className: "tlogs-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : rows.length === 0 ? /* @__PURE__ */ h("div", { className: "tlogs-empty" }, "\u6682\u65E0\u6570\u636E") : /* @__PURE__ */ h("div", { className: "tlogs-scroll" }, /* @__PURE__ */ h("table", { className: "tlogs-table" }, /* @__PURE__ */ h("thead", null, /* @__PURE__ */ h("tr", null, COLUMNS.map((c) => /* @__PURE__ */ h(
    "th",
    {
      key: c.key,
      onClick: () => toggleSort(c.key),
      title: `\u6309${c.label}\u6392\u5E8F`,
      "aria-sort": sort.key === c.key ? sort.dir === "asc" ? "ascending" : "descending" : "none"
    },
    c.label,
    sort.key === c.key ? sort.dir === "asc" ? " \u2191" : " \u2193" : ""
  )))), /* @__PURE__ */ h("tbody", null, rows.map((r) => /* @__PURE__ */ h("tr", { key: r.key }, /* @__PURE__ */ h("td", { title: r.label }, r.label), /* @__PURE__ */ h("td", { title: formatFull(r.stat.inputTokens) }, formatFull(r.stat.inputTokens)), /* @__PURE__ */ h("td", { title: formatFull(r.stat.outputTokens) }, formatFull(r.stat.outputTokens)), /* @__PURE__ */ h("td", { title: formatFull(r.stat.totalTokens) }, formatFull(r.stat.totalTokens)), /* @__PURE__ */ h("td", { title: formatFull(r.stat.requests) }, formatFull(r.stat.requests))))))));
}

// src/client/store.ts
var React5 = __toESM(require("react"), 1);

// src/types.ts
var TOKEN_TYPES = [
  "PROMPT_TOKEN",
  "PROMPT_CACHE_HIT_TOKEN",
  "PROMPT_CACHE_MISS_TOKEN",
  "RESPONSE_TOKEN",
  "REQUEST"
];
var TOKEN_TYPE_SET = new Set(TOKEN_TYPES);
var TLOGS_CHANNEL = "/tlogs";
var RPC = {
  snapshot: "tlogs.snapshot",
  refresh: "tlogs.refresh",
  detail: "tlogs.detail",
  login: "tlogs.login",
  setToken: "tlogs.setToken",
  logout: "tlogs.logout",
  export: "tlogs.export"
};

// src/client/api.ts
function makeRpc(ctx) {
  const call = ctx?.connection?.rpc?.call;
  if (typeof call !== "function") return void 0;
  return {
    call: (endpoint, payload) => call(TLOGS_CHANNEL, endpoint, payload ?? {})
  };
}
async function callRpc(rpc, endpoint, payload) {
  if (!rpc) {
    const err = new Error("tlogs: \u5F53\u524D\u8FDE\u63A5\u4E0D\u652F\u6301 RPC\uFF08\u7F3A\u5C11 connection \u670D\u52A1\uFF09");
    err.code = "no-connection";
    throw err;
  }
  const res = await rpc.call(endpoint, payload ?? {});
  if (!res?.ok) {
    const err = new Error(res?.error?.message ?? `tlogs: ${endpoint} \u8C03\u7528\u5931\u8D25`);
    err.code = res?.error?.code;
    throw err;
  }
  return res.value;
}

// src/client/store.ts
var POLL_MS = 800;
var MAX_POLLS = 300;
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function messageOf(e) {
  return e instanceof Error ? e.message : String(e);
}
function useTlogs(rpc, initialReason = "mount") {
  const [snapshot, setSnapshot] = React5.useState(null);
  const [detail, setDetail] = React5.useState(null);
  const [error, setError] = React5.useState(null);
  const [busy, setBusy] = React5.useState(false);
  const alive = React5.useRef(true);
  const inflight = React5.useRef(false);
  const started = React5.useRef(false);
  React5.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const reload = React5.useCallback(async () => {
    try {
      const s = await callRpc(rpc, RPC.snapshot);
      if (alive.current) {
        setSnapshot(s);
        setError(null);
      }
      return s;
    } catch (e) {
      if (alive.current) setError(messageOf(e));
      return null;
    }
  }, [rpc]);
  const refresh = React5.useCallback(
    async (force) => {
      if (inflight.current) return;
      inflight.current = true;
      if (alive.current) setBusy(true);
      try {
        await callRpc(rpc, RPC.refresh, { force });
        for (let i = 0; i < MAX_POLLS; i++) {
          const s = await reload();
          if (!alive.current) return;
          if (!s?.loading) return;
          await delay(POLL_MS);
        }
      } catch (e) {
        if (alive.current) setError(messageOf(e));
      } finally {
        inflight.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [rpc, reload]
  );
  React5.useEffect(() => {
    if (started.current) return;
    started.current = true;
    void refresh(false);
  }, [refresh]);
  const loadDetail = React5.useCallback(async () => {
    try {
      const d = await callRpc(rpc, RPC.detail);
      if (alive.current) setDetail(d);
    } catch (e) {
      if (alive.current) setError(messageOf(e));
    }
  }, [rpc]);
  const setToken = React5.useCallback(
    async (token) => {
      try {
        const r = await callRpc(rpc, RPC.setToken, { token });
        if (r.ok) await refresh(true);
        else if (alive.current) setError(r.error ?? "\u4FDD\u5B58\u5931\u8D25");
        return r.ok;
      } catch (e) {
        if (alive.current) setError(messageOf(e));
        return false;
      }
    },
    [rpc, refresh]
  );
  const logout = React5.useCallback(async () => {
    try {
      await callRpc(rpc, RPC.logout);
      if (alive.current) {
        setDetail(null);
        await reload();
      }
    } catch (e) {
      if (alive.current) setError(messageOf(e));
    }
  }, [rpc, reload]);
  const login = React5.useCallback(async () => {
    try {
      const r = await callRpc(rpc, RPC.login);
      if (r.ok) await refresh(true);
      else if (alive.current) setError(r.error ?? "\u767B\u5F55\u5931\u8D25");
      return r.ok;
    } catch (e) {
      if (alive.current) setError(messageOf(e));
      return false;
    }
  }, [rpc, refresh]);
  void initialReason;
  return { snapshot, detail, error, busy, reload, refresh, loadDetail, setToken, logout, login };
}

// src/client/footer.tsx
function TlogsFooter(props) {
  const { wide = true, rpc, defaultExpanded = false } = props;
  const store = useTlogs(rpc, "mount");
  const [view, setView] = React6.useState(defaultExpanded ? "expanded" : "compact");
  const userToggled = React6.useRef(false);
  const defaultApplied = React6.useRef(false);
  React6.useEffect(() => {
    if (defaultApplied.current || userToggled.current) return;
    const d = store.snapshot?.display;
    if (!d) return;
    defaultApplied.current = true;
    if (d.defaultExpanded) setView("expanded");
  }, [store.snapshot]);
  const display = store.snapshot?.display;
  const numberFormat = display?.numberFormat ?? props.numberFormat ?? "short";
  const enableDetailView = display?.enableDetailView ?? props.enableDetailView !== false;
  const openDetail = () => {
    userToggled.current = true;
    setView("detail");
    void store.loadDetail();
  };
  const toggle = () => {
    userToggled.current = true;
    if (view === "compact") {
      setView("expanded");
      void store.refresh(false);
    } else if (view === "expanded") {
      setView("compact");
    } else {
      setView("expanded");
    }
  };
  const refresh = () => {
    void store.refresh(true);
    if (view === "detail") void store.loadDetail();
  };
  return /* @__PURE__ */ h("div", { className: wide ? "tlogs tlogs-w-full" : "tlogs" }, /* @__PURE__ */ h(
    CompactBar,
    {
      snapshot: store.snapshot,
      numberFormat,
      wide,
      expanded: view !== "compact",
      busy: store.busy,
      onToggle: toggle
    }
  ), view === "expanded" ? /* @__PURE__ */ h(
    ExpandPanel,
    {
      snapshot: store.snapshot,
      error: store.error,
      busy: store.busy,
      numberFormat,
      enableDetailView,
      onRefresh: refresh,
      onOpenDetail: openDetail,
      onLogin: () => void store.login(),
      onSetToken: store.setToken,
      onLogout: () => void store.logout()
    }
  ) : null, view === "detail" ? /* @__PURE__ */ h(
    DetailView,
    {
      detail: store.detail,
      loading: store.busy,
      busy: store.busy,
      onBack: () => setView("expanded"),
      onRefresh: refresh
    }
  ) : null);
}

// src/client/index.ts
var inject = ["connection", "slots"];
var FOOTER_SLOT = "sidebar.footer.action";
var SLOT_ITEM_ID = "tlogs";
function apply(ctx) {
  const removeStyles = installStyles();
  if (typeof ctx.effect === "function") {
    ctx.effect(() => () => removeStyles(), "tlogs: stylesheet");
  }
  const slots = ctx.slots;
  if (typeof slots?.inject !== "function" || typeof slots?.register !== "function") {
    return;
  }
  const rpc = makeRpc(ctx);
  slots.inject(
    FOOTER_SLOT,
    () => slots.register(
      {
        name: FOOTER_SLOT,
        id: SLOT_ITEM_ID,
        // 业务 share：注入给组件的非 slot props。展示配置由 host 的
        // snapshot.display 下发（客户端读不到插件自身的 cordis 配置）。
        inject: () => ({ rpc })
      },
      TlogsFooter
    )
  );
}
return module.exports; } });
//# sourceMappingURL=client.js.map
