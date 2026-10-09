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
  /* Theme token aliases; each one carries a fallback. */
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
  /* Money gets its own colour because it is a neutral quantity, not a status: a success green
     would read as "spending more is good". The amber stays legible in both themes and separates
     \xA5 from the token counts next to it. */
  --tlogs-money: var(--dsw-alias-state-warn-primary, #c2740a);
  --tlogs-radius: var(--dsw-radius-xs, 4px);
  --tlogs-gap: 6px;

  /* Chart palette: c1\u2013c3 are the three stacked segments (cache hit / cache miss / output), c4\u2013c6
     are spare donut slices. The host has no chart-specific tokens, so these are fixed
     mid-luminance colours that stay distinguishable in both themes. */
  --tlogs-c1: var(--dsw-alias-state-business-primary, #4d6bfe);
  --tlogs-c2: #7c5cff;
  --tlogs-c3: #f0a020;
  --tlogs-c4: #14b8a6;
  --tlogs-c5: #ef4444;
  --tlogs-c6: #8b8fa3;

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

.tlogs-compact {
  display: flex;
  align-items: center;
  gap: var(--tlogs-gap);
  /* min-height, not height: a wrapped second metric row would be clipped. */
  min-height: 30px;
  padding: 3px 6px;
  width: 100%;
  min-width: 0;
  border-radius: var(--tlogs-radius);
  color: inherit;
  cursor: pointer;
}
.tlogs-compact:hover { background: var(--tlogs-hover); }

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

/* Numbers and labels are both non-shrinkable (flex: 0 0 auto) and the row wraps: every other
   split either clipped the trailing number or squeezed the labels into unreadable fragments. */
.tlogs-metrics {
  display: flex;
  align-items: center;
  /* column-gap is a lower bound: each .tlogs-metric also grows, so spare width is spread between metrics rather than piling up on the right. */
  column-gap: 12px;
  row-gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
  flex-wrap: wrap;
}
.tlogs-metric {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  min-width: 0;
  /* Still non-shrinkable but allowed to grow: each metric takes an equal share of the spare width,
     so the gaps widen with the sidebar; with many metrics this falls back to the 12px lower bound. */
  flex: 1 0 auto;
}
.tlogs-metric-label {
  color: var(--tlogs-muted);
  font-size: 10px;
  /* Never shrinks: wrapping the whole metric beats a chopped-off label. */
  flex: 0 0 auto;
  white-space: nowrap;
}
.tlogs-metric-value {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: -0.01em;
}
/* Money on the bar: same size as the token counts, told apart by colour, \xA5 kept. */
.tlogs-metric-money { color: var(--tlogs-money); }

/* Scope badge next to a number. The text comes from the caller: a platform tag
   (official / third party) in the tables, the third-party label on a card. */
.tlogs-src {
  flex: 0 0 auto;
  margin-left: 4px;
  padding: 0 3px;
  border: 1px solid var(--tlogs-border-strong);
  border-radius: var(--tlogs-radius);
  font-size: 9px;
  line-height: 13px;
  color: var(--tlogs-muted);
  cursor: help;
  white-space: nowrap;
}
.tlogs-src-pending { color: var(--tlogs-warn); border-color: var(--tlogs-warn); }
/* Kept for a real alert state; the daily settlement lag (10\u201330 min) is normal, so a
   permanently lit "settling" badge would only be noise. */
.tlogs-src-inline { margin: 0 4px 0 0; vertical-align: middle; display: inline-block; }

.tlogs-actions { display: inline-flex; align-items: center; gap: 2px; flex: 0 0 auto; }

/* Deliberately visible: the footer row needs a button one can actually see and hit. */
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
.tlogs-iconbtn:disabled { opacity: 0.45; cursor: default; }
.tlogs-iconbtn:disabled:hover {
  color: var(--tlogs-fg);
  border-color: var(--tlogs-border-strong);
  background: var(--tlogs-card-bg);
}
/* Too little room in the collapsed rail: hide manual refresh, keep expand/collapse. */
.tlogs-collapsed .tlogs-refresh { display: none; }

/* Stale-data badge: the last refresh failed and the numbers are cached. */
.tlogs-stale { flex: 0 0 auto; font-size: 10px; color: var(--tlogs-warn); cursor: help; }

/* Progress of the first full fetch. */
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

/* Expanded panel \u2014 opens in place and pushes the content above it up. */
/* The cap is viewport-relative: the five cards need roughly 370px in two columns, so a fixed cap
   cut the last one off and forced scrolling; overflow-y is only the fallback for very short windows. */
.tlogs-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 7px 6px 8px;
  margin-top: 2px;
  max-height: min(72vh, 520px);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--tlogs-panel-bg);
  border-top: 1px solid var(--tlogs-border);
  border-radius: var(--tlogs-radius);
  animation: tlogs-expand 140ms ease-out;
}
@keyframes tlogs-expand {
  from { max-height: 0; opacity: 0; }
  to { max-height: min(72vh, 520px); opacity: 1; }
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

.tlogs-cards { display: grid; grid-template-columns: 1fr; gap: 5px; }
.tlogs-w-full .tlogs-cards { grid-template-columns: 1fr 1fr; }
/*
 * Total consumption is the headline metric and always spans the full row; the other four pair up.
 * buildCards() on the host guarantees it is first, hence :first-child.
 */
.tlogs-w-full .tlogs-cards > :first-child { grid-column: 1 / -1; }

/* Tight cards: all five have to fit at once, without scrolling. */
.tlogs-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 7px;
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
  /* Badges wrap to their own line rather than squeezing the title. */
  flex-wrap: wrap;
}
.tlogs-card-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 10px;
  line-height: 1.25;
  color: var(--tlogs-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tlogs-card-total {
  font-size: 14px;
  line-height: 1.25;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.tlogs-card-total.is-error { font-size: 11px; font-weight: 400; color: var(--tlogs-muted); }
/*
 * Fixed 3-column grid, label above value: as flex-wrap the pairs broke at different points per
 * card (about 145px wide in two-column mode), so rows did not line up and card heights differed.
 */
.tlogs-card-split {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 6px;
  font-size: 9px;
  line-height: 1.3;
  color: var(--tlogs-muted);
}
.tlogs-card-split > span {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.tlogs-split-label {
  color: var(--tlogs-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tlogs-card-split b {
  font-size: 10.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--tlogs-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Main number row: token total left, money right. The money never shrinks \u2014 squeezed into
   "\xA51\u2026" it is worse than not showing it at all. */
.tlogs-card-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}
.tlogs-card-money {
  flex: 0 0 auto;
  font-size: 11.5px;
  line-height: 1.25;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--tlogs-money);
  white-space: nowrap;
}

.tlogs-account {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  font-size: 10px;
  color: var(--tlogs-muted);
}
.tlogs-account b {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--tlogs-money);
}

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
/* The name column must not be truncated: real "provider \xB7 model" strings do not fit in 9em, so it
   wraps (overflow-wrap: anywhere) and sets a floor that makes the numeric columns yield. */
.tlogs-table th:first-child, .tlogs-table td:first-child {
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  min-width: 12em;
  max-width: 26em;
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
/* Money column: the colour separates it from the token and request counts beside it. */
.tlogs-table td.tlogs-td-money { color: var(--tlogs-money); font-weight: 600; }
.tlogs-empty { padding: 10px 4px; text-align: center; color: var(--tlogs-muted); font-size: 11px; }
.tlogs-scroll { max-height: 190px; overflow-y: auto; overscroll-behavior: contain; }
.tlogs-error { color: var(--tlogs-danger); font-size: 10px; line-height: 1.5; }
.tlogs-hint { color: var(--tlogs-muted); font-size: 10px; line-height: 1.55; }

/* Detail modal \u2014 the only place in this file that uses position: fixed. A modal is a layer
   by nature, and the calendar plus the tables never fit in the narrow sidebar. */
.tlogs-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, #000 45%, transparent);
}
/* The frame is locked: width and height are fixed (shrinking only with the viewport), so switching
   tabs never resizes the dialog and nothing inside may be sized by its content \u2014 the calendar grid
   fills the leftover height and long tables or charts scroll inside .tlogs-modal-body. */
.tlogs-modal {
  display: flex;
  flex-direction: column;
  width: min(880px, 94vw);
  /* Locked size; the caps shrink with the viewport so it never leaves a short screen. */
  height: min(640px, 78vh);
  overflow: hidden;
  border: 1px solid var(--tlogs-border-strong);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1, #1b1f24);
  color: var(--tlogs-fg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  font-family: var(--dsw-font-family, inherit);
  font-size: 12px;
}
.tlogs-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  flex: 0 0 auto;
  border-bottom: 1px solid var(--tlogs-border);
}
.tlogs-modal-title { font-size: 13px; font-weight: 600; }
.tlogs-modal-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
  /* Takes all remaining height and scrolls internally, so content never sizes the body. */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.tlogs-table-wrap { max-height: 52vh; overflow-y: auto; overscroll-behavior: contain; }

.tlogs-cal-nav { display: flex; align-items: center; gap: 6px; }
.tlogs-cal-select { flex: 1 1 auto; }
.tlogs-cal-summary,
.tlogs-cal-detail {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 6px 8px;
  border-radius: var(--tlogs-radius);
  background: var(--tlogs-card-bg);
  font-size: 10px;
}
.tlogs-cal-summary-title { color: var(--tlogs-muted); font-weight: 600; }
.tlogs-cal-detail { min-height: 30px; }
/*
 * Row height: 52px floor, unbounded ceiling (1fr), so the grid fills the height the locked dialog
 * would otherwise leave blank under the calendar. Each cell is three rows (day / tokens / money)
 * and the money row renders unconditionally, empty when there is no data \u2014 on demand the height
 * would jump when switching months, which is what the fixed 42 cells exist to prevent.
 */
.tlogs-cal {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  /* Row 1 is the weekday header (auto), the other 6 are the date cells: minmax(52px, 1fr) spreads
     the leftover height over them. The calendar always renders 42 cells (see detail-modal.tsx). */
  grid-template-rows: auto repeat(6, minmax(52px, 1fr));
  /* Implicit rows get the same floor, in case a month ever needs more than 6 rows. */
  grid-auto-rows: minmax(52px, 1fr);
  gap: 3px;
  /* The body is a flex column: the grid has to absorb the leftover height. */
  flex: 1 1 auto;
  min-height: 0;
}
.tlogs-cal-head { text-align: center; font-size: 10px; color: var(--tlogs-muted); padding: 2px 0; }
.tlogs-cal-cell {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-height: 52px;
  min-width: 0;
  padding: 2px;
  border: 1px solid transparent;
  border-radius: var(--tlogs-radius);
  background: var(--tlogs-card-bg);
  color: var(--tlogs-fg);
  cursor: pointer;
  font-family: inherit;
}
.tlogs-cal-cell.is-empty { background: transparent; border-color: transparent; cursor: default; }
.tlogs-cal-cell:hover { border-color: var(--tlogs-border-strong); }
.tlogs-cal-cell.is-selected { border-color: var(--tlogs-accent); }
.tlogs-cal-day { font-size: 10px; color: var(--tlogs-muted); }
.tlogs-cal-val { font-size: 9.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
/* Money line, kept even when empty so every cell stays three rows tall. */
.tlogs-cal-money {
  min-height: 11px;
  font-size: 9px;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--tlogs-money);
  white-space: nowrap;
}

/* Charts (the modal's chart tab) \u2014 inline SVG only. Geometry lives in chart-utils.ts; this file
   only sets colour and layout, and every fill goes through --tlogs-cN so both themes follow. Each
   chart's height comes from its viewBox and the width scales to 100%, so no card jump on switch. */
.tlogs-chart-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.tlogs-ctl-group { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.tlogs-ctl-label { font-size: 10px; color: var(--tlogs-muted); white-space: nowrap; }
.tlogs-chart-select { flex: 0 1 auto; min-width: 118px; max-width: 220px; }
.tlogs-chart-date { flex: 0 1 auto; min-width: 132px; }

/* Sub-tab row directly under the main tabs; the right side holds the composition dimension. The row
   keeps a fixed height so switching sub-tabs (or showing/hiding those buttons) does not shift the
   content below. */
.tlogs-subtabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  flex-wrap: wrap;
  flex: 0 0 auto;
}

/* Fixed minimum height for the stage: the three charts are 220 / 236 / 170 tall, so a shared floor
   plus a card that fills it keeps the content below still when switching sub-tabs. */
.tlogs-chart-stage {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 372px;
}
.tlogs-chart-stage > .tlogs-chart-card { flex: 1 1 auto; }

.tlogs-chart-scope {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  padding: 5px 8px;
  border-radius: var(--tlogs-radius);
  background: var(--tlogs-card-bg);
  font-size: 10px;
}
.tlogs-chart-scope-range { font-weight: 600; font-variant-numeric: tabular-nums; }
.tlogs-chart-scope-note { color: var(--tlogs-muted); }
.tlogs-chart-busy { color: var(--tlogs-accent); }

.tlogs-chart-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px 10px;
  border: 1px solid var(--tlogs-border);
  border-radius: 6px;
  background: var(--tlogs-card-bg);
}
.tlogs-chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.tlogs-chart-title { display: inline-flex; align-items: baseline; gap: 6px; font-size: 11px; font-weight: 600; }
.tlogs-chart-sub { font-size: 9.5px; font-weight: 400; color: var(--tlogs-muted); }
.tlogs-chart-dim { display: inline-flex; gap: 3px; }

.tlogs-chart-svg { display: block; width: 100%; height: auto; }
.tlogs-axis-text { fill: var(--tlogs-muted); font-size: 9px; }
.tlogs-axis-text.is-y { font-variant-numeric: tabular-nums; }
.tlogs-grid { stroke: var(--tlogs-border); stroke-width: 1; }
.tlogs-line { fill: none; stroke: var(--tlogs-accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.tlogs-area { fill: var(--tlogs-accent); opacity: 0.16; }
.tlogs-dot { fill: var(--tlogs-accent); }
.tlogs-guide { stroke: var(--tlogs-border-strong); stroke-width: 1; stroke-dasharray: 3 3; }
.tlogs-hit { fill: transparent; }
.tlogs-chart-svg .tlogs-hit { cursor: crosshair; }
/* The bar brightens on hover; hit testing belongs to the transparent rects. */
.tlogs-bar { transition: opacity 120ms ease; }
.tlogs-bar:hover { opacity: 0.82; }

.tlogs-fill-c1 { fill: var(--tlogs-c1); }
.tlogs-fill-c2 { fill: var(--tlogs-c2); }
.tlogs-fill-c3 { fill: var(--tlogs-c3); }
.tlogs-stroke-c1 { stroke: var(--tlogs-c1); }
.tlogs-stroke-c2 { stroke: var(--tlogs-c2); }
.tlogs-stroke-c3 { stroke: var(--tlogs-c3); }
.tlogs-stroke-c4 { stroke: var(--tlogs-c4); }
.tlogs-stroke-c5 { stroke: var(--tlogs-c5); }
.tlogs-stroke-c6 { stroke: var(--tlogs-c6); }
.tlogs-swatch { display: inline-block; flex: 0 0 auto; width: 9px; height: 9px; border-radius: 2px; }
.tlogs-swatch-c1 { background: var(--tlogs-c1); }
.tlogs-swatch-c2 { background: var(--tlogs-c2); }
.tlogs-swatch-c3 { background: var(--tlogs-c3); }
.tlogs-swatch-c4 { background: var(--tlogs-c4); }
.tlogs-swatch-c5 { background: var(--tlogs-c5); }
.tlogs-swatch-c6 { background: var(--tlogs-c6); }
.tlogs-swatch-req { background: var(--tlogs-fg); opacity: 0.55; }

.tlogs-reqline { fill: none; stroke: var(--tlogs-fg); opacity: 0.5; stroke-width: 1.5; stroke-dasharray: 4 3; }
.tlogs-legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 9.5px; color: var(--tlogs-muted); }
.tlogs-legend-item { display: inline-flex; align-items: center; gap: 4px; }

.tlogs-chart-summary { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 10px; }
.tlogs-chart-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
  min-height: 26px;
  padding: 5px 8px;
  border-radius: var(--tlogs-radius);
  background: var(--tlogs-panel-bg);
  font-size: 10px;
}
.tlogs-chart-info.is-hint { color: var(--tlogs-muted); }
.tlogs-chart-info-key { font-weight: 600; font-variant-numeric: tabular-nums; }

.tlogs-donut-wrap { display: flex; flex: 1 1 auto; align-items: center; gap: 16px; flex-wrap: wrap; }
.tlogs-donut { flex: 0 0 auto; width: 170px; height: 170px; }
.tlogs-donut-seg { cursor: pointer; transition: stroke-width 120ms ease; }
.tlogs-donut-center { fill: var(--tlogs-fg); font-size: 15px; font-weight: 600; }
.tlogs-donut-sub { fill: var(--tlogs-muted); font-size: 9.5px; }
.tlogs-donut-legend {
  flex: 1 1 220px;
  min-width: 0;
  max-height: 172px;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tlogs-legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border-radius: var(--tlogs-radius);
  font-size: 10px;
}
.tlogs-legend-row.is-active { background: var(--tlogs-hover); }
.tlogs-legend-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tlogs-legend-value { font-weight: 600; font-variant-numeric: tabular-nums; }
.tlogs-legend-pct { width: 46px; text-align: right; color: var(--tlogs-muted); font-variant-numeric: tabular-nums; }

/* Settings tab (language). The block is capped in width: the dialog is far wider than a heading plus three radio options need. */
.tlogs-settings { display: flex; flex-direction: column; gap: 10px; max-width: 520px; }
.tlogs-settings-title { font-size: 13px; font-weight: 600; }
.tlogs-settings-options { display: flex; flex-wrap: wrap; gap: 8px; }
.tlogs-settings-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--tlogs-border);
  border-radius: var(--tlogs-radius);
  cursor: pointer;
  user-select: none;
}
.tlogs-settings-option:hover { background: var(--tlogs-hover); }
.tlogs-settings-option.is-selected {
  border-color: var(--tlogs-accent);
  background: color-mix(in srgb, var(--tlogs-accent) 12%, transparent);
}
.tlogs-settings-radio { accent-color: var(--tlogs-accent); margin: 0; }
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
var React11 = __toESM(require("react"), 1);

// src/client/h.ts
var React = __toESM(require("react"), 1);
var h = React.createElement;
var Fragment2 = React.Fragment;

// src/client/compact-bar.tsx
var React3 = require("react");

// src/client/i18n/index.ts
var React2 = __toESM(require("react"), 1);

// src/client/i18n/dict/zh-app.ts
var zhApp = {
  "tab.calendar": "\u65E5\u5386",
  "tab.charts": "\u56FE\u8868",
  "tab.models": "\u6A21\u578B",
  "tab.providers": "\u4F9B\u5E94\u5546",
  "tab.years": "\u5E74",
  "tab.months": "\u6708",
  "tab.days": "\u5F53\u6708\u6309\u5929",
  "tab.settings": "\u8BBE\u7F6E",
  // 星期标题（周一起始，与「本周 = 周一至今」口径一致）
  "weekday.1": "\u4E00",
  "weekday.2": "\u4E8C",
  "weekday.3": "\u4E09",
  "weekday.4": "\u56DB",
  "weekday.5": "\u4E94",
  "weekday.6": "\u516D",
  "weekday.7": "\u65E5",
  "modal.title": "\u7528\u91CF\u8BE6\u7EC6\u6570\u636E",
  "modal.label": "tlogs \u7528\u91CF\u8BE6\u7EC6\u6570\u636E",
  "modal.close": "\u5173\u95ED\u8BE6\u7EC6\u6570\u636E",
  "modal.closeTitle": "\u5173\u95ED\uFF08Esc\uFF09",
  "common.refresh": "\u5237\u65B0",
  "common.refreshing": "\u5237\u65B0\u4E2D\u2026",
  "common.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "common.noData": "\u6682\u65E0\u6570\u636E",
  // 统计口径标签（日历汇总行、选中日明细、表格列头共用）
  "stat.input": "\u8F93\u5165",
  "stat.output": "\u8F93\u51FA",
  "stat.totalTokens": "\u603B Token",
  "stat.requests": "\u8BF7\u6C42",
  "stat.cost": "\u91D1\u989D",
  "cal.prevMonth": "\u4E0A\u4E00\u4E2A\u6708",
  "cal.nextMonth": "\u4E0B\u4E00\u4E2A\u6708",
  "cal.selectMonth": "\u9009\u62E9\u6708\u4EFD",
  "cal.monthTotal": "{month} \u5408\u8BA1",
  "cal.option": "{key}\uFF08{tokens} tokens{cost}\uFF09",
  "cal.optionCost": " \xB7 {money}",
  "cal.cell": "{date} \xB7 {tokens} tokens \xB7 {requests} \u6B21\u8BF7\u6C42{cost}",
  "cal.cellCost": " \xB7 {money} \u5143",
  "cal.cellNoData": "{date} \xB7 \u65E0\u6570\u636E",
  "cal.noDaily": "\u8BE5\u6708\u6682\u65E0\u9010\u65E5\u660E\u7EC6\uFF0C\u4EC5\u663E\u793A\u4E0A\u65B9\u6708\u5EA6\u5408\u8BA1\u3002\u4E0B\u4E00\u6B21\u81EA\u52A8\u5237\u65B0\u4F1A\u5C1D\u8BD5\u56DE\u8865\u3002",
  "cal.pickDay": "\u70B9\u51FB\u65E5\u5386\u4E2D\u7684\u67D0\u4E00\u5929\u67E5\u770B\u5F53\u5929\u660E\u7EC6\u3002",
  "providers.localRange": "\u672C\u673A\u53E3\u5F84\uFF08DSH \u4F1A\u8BDD\u65E5\u5FD7{source}\uFF09\uFF1A{range} \xB7 {days} \u5929 \xB7 {files} \u4E2A\u4F1A\u8BDD\u65E5\u5FD7",
  "providers.localRangeSource": " \xB7 {source}",
  "providers.unavailable": "\u672C\u673A\u53E3\u5F84\u4E0D\u53EF\u7528\uFF08{reason}\uFF09",
  "providers.unavailableLong": "\u672C\u673A\u53E3\u5F84\u4E0D\u53EF\u7528\uFF1A{reason}",
  "providers.empty": "\u672C\u673A\u53E3\u5F84\u6682\u65E0\u6570\u636E",
  "providers.coverage": "\uFF1B\u542B\u5E73\u53F0\u8D26\u5355\u770B\u4E0D\u5230\u7684\u4F9B\u5E94\u5546\uFF08\u706B\u5C71\u65B9\u821F / \u5C0F\u7C73 / GLM / GPT\u2026\uFF09",
  "providers.modelsNote": "\u5E26\u300C\u4F9B\u5E94\u5546 \xB7\u300D\u524D\u7F00\u7684\u884C\u6765\u81EA\u672C\u673A\u4F1A\u8BDD\u65E5\u5FD7\uFF08\u5E73\u53F0\u8D26\u5355\u770B\u4E0D\u5230\u8FD9\u4E9B\u6A21\u578B\uFF0C\u56E0\u6B64\u6CA1\u6709\u91D1\u989D\uFF09",
  // 设置页签：语言（界面只有标题 + 三个选项，解析顺序等细节写在 README）
  "settings.title": "\u8BED\u8A00",
  "settings.option.auto": "\u8DDF\u968F\u7CFB\u7EDF",
  "settings.option.zh": "\u4E2D\u6587",
  "settings.option.en": "English"
};

// src/client/i18n/dict/zh-ui.ts
var zhUi = {
  "bar.title": "tlogs \u2014 DeepSeek \u7528\u91CF",
  "bar.titleTokens": "{label} {value} tokens{note}",
  "bar.titleRequests": "{label} {value} \u6B21\u8BF7\u6C42{note}",
  "bar.titleMoney": "{label} {value} \u5143",
  "bar.noteLocal": "\uFF08\u672C\u673A\u53E3\u5F84\uFF1ADSH \u4F1A\u8BDD\u65E5\u5FD7\uFF09",
  "bar.noteMerged": "\uFF08\u5E73\u53F0 + \u672C\u673A\u5408\u5E76\u53E3\u5F84\uFF09",
  "bar.staleTip": "\u6570\u636E\u53EF\u80FD\u8FC7\u671F\uFF1A\u6700\u8FD1\u4E00\u6B21\u5237\u65B0\u5931\u8D25\uFF0C\u5F53\u524D\u663E\u793A\u7F13\u5B58\u503C",
  "bar.busyTip": "\u6B63\u5728\u5237\u65B0\u2026",
  "bar.refreshLabel": "\u5237\u65B0\u7528\u91CF\u6570\u636E",
  "bar.refreshTitle": "\u5237\u65B0\u7528\u91CF",
  "bar.expandLabel": "\u5C55\u5F00 tlogs \u9762\u677F",
  "bar.collapseLabel": "\u6536\u8D77 tlogs \u9762\u677F",
  "bar.expand": "\u5C55\u5F00",
  "bar.collapse": "\u6536\u8D77",
  "panel.timeBasis": "\u7EDF\u8BA1\u53E3\u5F84\uFF1A\u5E73\u53F0\u65E5\uFF08UTC\uFF09\xB7 \u5317\u4EAC 08:00 \u6362\u65E5",
  "panel.dayBasis.utc": "\u5E73\u53F0\u63A5\u53E3\u7684 days[] \u6309 UTC \u65E5\u5207\u6876\uFF1B\u672C\u673A\u65F6\u533A\u5C31\u662F UTC\uFF0C\u6240\u4EE5\u672C\u673A 00:00 \u6362\u65E5\u3002{billing}",
  "panel.dayBasis.local": "\u5E73\u53F0\u63A5\u53E3\u7684 days[] \u6309 UTC \u65E5\u5207\u6876\uFF1A\u672C\u673A {start} \u6362\u65E5\uFF0C\u300C\u4ECA\u65E5\u300D= {start} \uFF5E \u6B21\u65E5 {end}\uFF08\u4E0D\u662F\u672C\u673A 00:00 \u6362\u65E5\uFF09\u3002\u5F53\u5468/\u5F53\u6708\u540C\u7406\uFF08\u5468\u4E00 00:00 / 1 \u65E5 00:00 \u5747\u6309 UTC \u8BA1\uFF09\u3002{billing}",
  "panel.dayBasis.billing": "\u5B98\u65B9\u8D26\u5355\u6309\u5317\u4EAC\u65F6\u95F4\u65E5\uFF080 \u70B9\uFF09\u7ED3\u7B97\uFF0C\u672C\u63D2\u4EF6\u7684\u65E5\u6876\u6309\u63A5\u53E3\u53E3\u5F84\uFF08UTC \u65E5\uFF09\u2014\u2014 \u4E24\u8005\u5728\u8DE8\u65E5\u5904\u6700\u591A\u5DEE 8 \u5C0F\u65F6\u7684\u7528\u91CF\u3002",
  "panel.source.env": "\u73AF\u5883\u53D8\u91CF",
  "panel.source.config": "\u63D2\u4EF6\u914D\u7F6E",
  "panel.source.credentials": "\u672C\u673A\u51ED\u636E\uFF08\u624B\u52A8\u586B\u5199 / \u767B\u5F55\uFF09",
  "panel.source.platformSession": "DSH \u8D26\u53F7\u767B\u5F55\u6001\uFF08\u81EA\u52A8\u590D\u7528\uFF09",
  "panel.source.desktopLogin": "\u5185\u7F6E\u767B\u5F55\u7A97\u53E3",
  "panel.credentialsSource": "\u51ED\u636E\u6765\u6E90\uFF1A{source}",
  "panel.auth.invalid": "userToken \u5DF2\u5931\u6548\uFF0C\u9700\u8981\u91CD\u65B0\u767B\u5F55",
  "panel.auth.missing": "\u672A\u914D\u7F6E userToken\uFF0C\u65E0\u6CD5\u83B7\u53D6\u7528\u91CF",
  "panel.login": "\u767B\u5F55",
  "panel.login.title": "\u6253\u5F00\u5185\u7F6E\u767B\u5F55\u7A97\u53E3",
  "panel.login.titleDisabled": "\u5F53\u524D\u5BBF\u4E3B\u65E0\u6CD5\u521B\u5EFA\u767B\u5F55\u7A97\u53E3\uFF0C\u8BF7\u7528\u300C\u624B\u52A8\u586B\u5199\u300D\u7C98\u8D34 platform userToken",
  "panel.login.unavailable": "\u5185\u7F6E\u767B\u5F55\u5728\u5F53\u524D\u5BBF\u4E3B\u4E0D\u53EF\u7528\uFF1A\u63D2\u4EF6\u8FD0\u884C\u5728 Electron \u7684 Node \u5B50\u8FDB\u7A0B\u91CC\uFF0C\u521B\u5EFA\u4E0D\u4E86\u767B\u5F55\u7A97\u53E3\u3002 \u8BF7\u70B9\u300C\u624B\u52A8\u586B\u5199\u300D\u7C98\u8D34 platform userToken\uFF08\u5F62\u5982\u6D4F\u89C8\u5668 localStorage \u91CC\u7684 userToken \u503C\uFF09\u3002",
  "panel.manual": "\u624B\u52A8\u586B\u5199",
  "panel.manual.title": "\u624B\u52A8\u7C98\u8D34 userToken\uFF08\u65B9\u6848 C\uFF09",
  "panel.token.placeholder": "\u7C98\u8D34 userToken",
  "panel.save": "\u4FDD\u5B58",
  "panel.cancel": "\u53D6\u6D88",
  "panel.localUnavailable": "\u672C\u673A\u53E3\u5F84\u4E0D\u53EF\u7528\uFF08{reason}\uFF09\uFF1A\u7A97\u53E3\u5361\u7247\u53EA\u7528\u5E73\u53F0\u8D26\u5355\uFF0C\u5F53\u5929\u4E0E\u300C\u975E DeepSeek \u4F9B\u5E94\u5546\u300D\u7684\u7528\u91CF\u53EF\u80FD\u7F3A\u5931\u6216\u663E\u793A 0",
  "panel.costBackfill": "\u6B63\u5728\u56DE\u8865\u5386\u53F2\u91D1\u989D\uFF0C\u5361\u7247\u4E0A\u7684 \xA5 \u6682\u4E3A\u90E8\u5206\u5408\u8BA1\u2026",
  "panel.account.balance": "\u4F59\u989D ",
  "panel.account.balanceTip": "\u5E73\u53F0\u5145\u503C\u4F59\u989D\uFF08get_user_summary.normal_wallets\uFF09",
  "panel.account.totalCosts": "\u5B98\u65B9\u7D2F\u8BA1\u6D88\u8D39 ",
  "panel.account.totalCostsTip": "\u5E73\u53F0\u8D26\u5355\u7684\u7D2F\u8BA1\u6D88\u8D39\uFF08get_user_summary.total_costs\uFF09\uFF0C\u5373\u63A7\u5236\u53F0\u53E3\u5F84",
  "panel.account.bonus": "\u8D60\u9001 ",
  "panel.account.bonusTip": "\u8D60\u9001\u4F59\u989D",
  "panel.detail": "\u8BE6\u7EC6\u6570\u636E \u203A",
  "panel.logout": "\u9000\u51FA\u767B\u5F55",
  "panel.logout.title": "\u6E05\u9664\u672C\u673A\u4FDD\u5B58\u7684 userToken",
  "panel.cycle.title": "\u70B9\u51FB\u5207\u6362\u9879\u76EE",
  "panel.thirdParty": "\u7B2C\u4E09\u65B9",
  "panel.moneyTip.total": "{label} \u5408\u8BA1 {money} \u5143",
  "panel.moneyTip.input": "\u8F93\u5165 {money} \u5143",
  "panel.moneyTip.output": "\u8F93\u51FA {money} \u5143",
  "panel.sourceTip.local": "\u672C\u673A\u53E3\u5F84\uFF08DSH \u4F1A\u8BDD\u65E5\u5FD7\uFF09\uFF1A\u5B9E\u65F6\uFF0C\u8986\u76D6\u672C\u673A\u6240\u6709\u4F9B\u5E94\u5546",
  "panel.sourceTip.merged": "\u5E73\u53F0\u8D26\u5355 + \u672C\u673A\u53E3\u5F84\u5408\u5E76",
  "panel.sourceTip.platform": "\u5E73\u53F0\u8D26\u5355\u53E3\u5F84",
  "panel.sourceTip.platformTokens": "\u5E73\u53F0 {n} tokens",
  "panel.sourceTip.localTokens": "\u672C\u673A {n} tokens\uFF08\u5176\u4E2D DeepSeek \u901A\u9053 {deepseek}\uFF09",
  "panel.sourceTip.other": "\u5E73\u53F0\u770B\u4E0D\u5230\u7684\u4F9B\u5E94\u5546\uFF1A{list}",
  "panel.sourceTip.costPending": "\u91D1\u989D\u662F\u5E73\u53F0\u8BA1\u4EF7\uFF0C\u5F53\u5929\u7ED3\u7B97\u6EDE\u540E\u7EA6 10~30 \u5206\u949F\uFF0C\u4F1A\u7565\u504F\u5C0F",
  // 图表（面板的「图表」页签 + 三张图）
  "chart.range.all": "\u6709\u53F2\u4EE5\u6765",
  "chart.range.custom": "\u81EA\u5B9A\u4E49",
  "chart.range.today": "\u4ECA\u65E5",
  "chart.range.week": "\u672C\u5468",
  "chart.range.month": "\u672C\u6708",
  "chart.range.last7": "\u8FD1 7 \u5929",
  "chart.range.last30": "\u8FD1 30 \u5929",
  "chart.dim.model": "\u6309\u6A21\u578B",
  "chart.dim.composition": "\u8F93\u5165/\u8F93\u51FA",
  "chart.dim.project": "\u6309\u9879\u76EE",
  "chart.kind.line": "\u6298\u7EBF\u56FE",
  "chart.kind.pie": "\u997C\u72B6\u56FE",
  "chart.kind.bar": "\u67F1\u72B6\u56FE",
  "chart.aria.kind": "\u9009\u62E9\u56FE\u5F62",
  "chart.label.kind": "\u56FE\u5F62",
  "chart.label.composition": "\u6784\u6210",
  "chart.aria.range": "\u65F6\u95F4\u8303\u56F4",
  "chart.label.range": "\u8303\u56F4",
  "chart.label.source": "\u6570\u636E\u6E90",
  "chart.aria.source": "\u9009\u62E9\u6570\u636E\u6E90",
  "chart.source.platform": "\u5E73\u53F0\u8D26\u5355\uFF08\u5168\u90E8\uFF09",
  "chart.label.metric": "\u6307\u6807",
  "chart.aria.metric": "\u9009\u62E9\u6307\u6807",
  "chart.label.grain": "\u7C92\u5EA6",
  "chart.aria.grain": "\u9009\u62E9\u7C92\u5EA6",
  "chart.label.basis": "\u53E3\u5F84",
  "chart.mode.perBucket": "\u6BCF\u671F\u65B0\u589E",
  "chart.mode.cumulative": "\u7D2F\u8BA1",
  "chart.label.from": "\u4ECE",
  "chart.aria.from": "\u8D77\u59CB\u65E5\u671F",
  "chart.label.to": "\u5230",
  "chart.aria.to": "\u7ED3\u675F\u65E5\u671F",
  "chart.rangeTotal": "\u533A\u95F4\u5408\u8BA1",
  "chart.costPartial": "\u90E8\u5206\u6708\u4EFD\u91D1\u989D\u5C1A\u672A\u56DE\u8865\uFF0C\u66F2\u7EBF\u53EF\u80FD\u504F\u4F4E",
  "chart.scope.snapshots": "\u9879\u76EE\u7EF4\u5EA6\uFF1A{n} \u6761\u5FEB\u7167\uFF08\u63D2\u4EF6\u81EA\u542F\u7528\u5F53\u5929\u8D77\u9010\u65E5\u8BB0\u5F55\uFF0C\u65E0\u6CD5\u56DE\u6EAF\u66F4\u65E9\uFF09",
  "chart.scope.bucketsDay": "{n} \u4E2A\u5929",
  "chart.scope.bucketsMonth": "{n} \u4E2A\u6708",
  "chart.scope.bucketsYear": "{n} \u4E2A\u5E74",
  "chart.updating": "\u66F4\u65B0\u4E2D\u2026",
  "chart.noData": "\u6682\u65E0\u56FE\u8868\u6570\u636E",
  "chart.partialNote.lead": "\u6CE8\u610F\uFF1A\u8303\u56F4\u5185\u6709\u6708\u4EFD\u7F3A\u5C11\u9010\u65E5\u660E\u7EC6\uFF08\u63A5\u53E3\u53EA\u5728\u90E8\u5206\u6708\u4EFD\u8FD4\u56DE\u6309\u5929\u6570\u636E\uFF09\u3002\u6309\u5929\u7C92\u5EA6\u4F1A\u628A\u8FD9\u4E9B\u6708\u4EFD\u753B\u6210\u65AD\u70B9\uFF1B",
  "chart.partialNote.bold": "\u6309\u6708 / \u6309\u5E74\u7C92\u5EA6\u4E0D\u53D7\u5F71\u54CD",
  "chart.partialNote.tail": "\uFF08\u7528\u7684\u662F\u6708\u5EA6\u5408\u8BA1\uFF09\u3002",
  "chart.projectSnapshots": "\u8BE5\u9879\u76EE\u76EE\u524D\u53EA\u6709 {n} \u6761\u5FEB\u7167\uFF1A\u8D8B\u52BF\u7EBF\u9700\u8981\u81F3\u5C11\u8DE8 2 \u5929\u3002\u5E73\u53F0\u8D26\u5355\u63A5\u53E3\u6CA1\u6709\u9879\u76EE\u7EF4\u5EA6\uFF0C\u5386\u53F2\u65E0\u6CD5\u56DE\u6EAF \u2014\u2014 \u5FEB\u7167\u4F1A\u5728\u63D2\u4EF6\u8FD0\u884C\u671F\u95F4\u6BCF\u5929\u7D2F\u79EF\u4E00\u6761\u3002",
  "chart.title.line": "\u7528\u91CF\u8D8B\u52BF",
  "chart.sub.cumulative": " \xB7 \u7D2F\u8BA1",
  "chart.sub.perBucket": " \xB7 \u6BCF\u671F",
  "chart.title.pie": "\u6784\u6210\u5360\u6BD4",
  "chart.sub.composition": "\u8F93\u5165\u547D\u4E2D / \u672A\u547D\u4E2D / \u8F93\u51FA",
  "chart.selectedProject": "\u6240\u9009\u9879\u76EE",
  "chart.title.bar": "\u7528\u91CF\u5206\u5E03",
  "chart.sub.bar": "\u8F93\u5165\u547D\u4E2D / \u672A\u547D\u4E2D + \u8F93\u51FA\uFF0C\u4E09\u6BB5\u5806\u53E0",
  "chart.metric.cacheHit": "\u7F13\u5B58\u547D\u4E2D",
  "chart.metric.cacheMiss": "\u7F13\u5B58\u672A\u547D\u4E2D",
  "chart.metric.requests": "\u8BF7\u6C42\u6570",
  "chart.metric.cost": "\u6D88\u8D39\u91D1\u989D (\xA5)",
  "chart.grain.auto": "\u81EA\u52A8",
  "chart.grain.day": "\u6309\u5929",
  "chart.grain.month": "\u6309\u6708",
  "chart.grain.year": "\u6309\u5E74",
  "chart.other": "\u5176\u4ED6",
  "chart.legend.hit": "\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09",
  "chart.legend.miss": "\u8F93\u5165\uFF08\u7F13\u5B58\u672A\u547D\u4E2D\uFF09",
  "chart.breakdown.hit": "\u547D\u4E2D",
  "chart.breakdown.miss": "\u672A\u547D\u4E2D",
  "chart.customMetric": "\u6240\u9009\u6307\u6807",
  "chart.sum.total": "\u5408\u8BA1",
  "chart.sum.max": "\u6700\u9AD8",
  "chart.sum.min": "\u6700\u4F4E",
  "chart.sum.avg": "\u5747\u503C",
  "chart.noPlotData": "\u8BE5\u8303\u56F4\u5185\u6CA1\u6709\u53EF\u7528\u4E8E\u7ED8\u56FE\u7684\u6570\u636E",
  "chart.aria.line": "\u7528\u91CF\u6298\u7EBF\u56FE",
  "chart.aria.bar": "\u7528\u91CF\u5806\u53E0\u67F1\u72B6\u56FE",
  "chart.aria.donut": "\u7528\u91CF\u6784\u6210\u997C\u56FE",
  "chart.hint.line": "\u60AC\u505C\u6298\u7EBF\u67E5\u770B\u8BE5\u65F6\u95F4\u70B9\u7684\u660E\u7EC6\u3002",
  "chart.hint.lineCumulative": "\u6298\u7EBF\u4E3A\u300C\u7D2F\u8BA1\u300D\u53E3\u5F84\uFF08\u81EA\u8303\u56F4\u5185\u9996\u65E5\u4E4B\u524D\u7D2F\u52A0\uFF09\uFF1B\u60AC\u505C\u67E5\u770B\u8BE5\u70B9\u660E\u7EC6\u3002",
  "chart.hint.bar": "\u60AC\u505C\u67F1\u5B50\u67E5\u770B\u8BE5\u65F6\u95F4\u70B9\u7684\u8F93\u5165/\u8F93\u51FA\u6784\u6210\uFF1B\u865A\u7EBF\u4E3A\u8BF7\u6C42\u6570\uFF08\u72EC\u7ACB\u523B\u5EA6\uFF09\u3002",
  "chart.hint.donut": "\u60AC\u505C\u73AF\u5F62\u6216\u56FE\u4F8B\u67E5\u770B\u5360\u6BD4\uFF1B\u6784\u6210\u9879\u8FC7\u591A\u65F6\u5C3E\u90E8\u4F1A\u5408\u5E76\u4E3A\u300C\u5176\u4ED6\u300D\u3002",
  "chart.empty.composition": "\u8BE5\u8303\u56F4\u5185\u6CA1\u6709\u6784\u6210\u6570\u636E",
  "chart.empty.projectCost": "\u9879\u76EE\u7528\u91CF\u6765\u81EA\u672C\u673A\u4F1A\u8BDD\u6295\u5F71\uFF0C\u5E73\u53F0\u8D26\u5355\u91CC\u6CA1\u6709\u5B83\u7684\u91D1\u989D",
  "chart.empty.project": "\u6CA1\u6709\u53EF\u7528\u7684\u9879\u76EE\u6570\u636E\uFF08\u5BBF\u4E3B\u672A\u63D0\u4F9B\u4F1A\u8BDD\u7528\u91CF\u6765\u6E90\uFF09",
  "chart.unit.requests": " \u6B21",
  "chart.unit.money": " \u5143",
  "table.name": "\u540D\u79F0",
  "table.sortBy": "\u6309{column}\u6392\u5E8F",
  // 金额格式化（中文按万 / 亿缩放）
  "money.shortBig": "\u4EBF",
  "money.shortSmall": "\u4E07",
  "error.reason.notScanned": "\u5C1A\u672A\u626B\u63CF",
  "error.reason.disabled": "\u914D\u7F6E\u91CC\u5DF2\u5173\u95ED localUsage",
  "error.reason.noSessionLogs": "\u672A\u627E\u5230\u4F1A\u8BDD\u65E5\u5FD7\uFF08\u5019\u9009\u76EE\u5F55\u90FD\u4E0D\u5B58\u5728\uFF09",
  "error.reason.zstd": "\u5F53\u524D\u8FD0\u884C\u65F6\u4E0D\u652F\u6301 zstd\uFF08\u9700\u8981 Node 22.15+ / 24\uFF09",
  "error.reason.restoredEmpty": "\u7F13\u5B58\u91CC\u6CA1\u6709\u53EF\u7528\u6570\u636E",
  "error.reason.noUsageInWindow": "\u65E5\u5FD7\u91CC\u6CA1\u6709\u7A97\u53E3\u5185\u7684\u7528\u91CF",
  "error.reason.sessionLogReadFailed": "\u4F1A\u8BDD\u65E5\u5FD7\u8BFB\u53D6\u5931\u8D25",
  "error.reason.sessionsDir": "\u4F1A\u8BDD\u76EE\u5F55\u4E0D\u53EF\u8BFB",
  "error.reason.readFailed": "\u8BFB\u53D6\u5931\u8D25",
  "error.saveFailed": "\u4FDD\u5B58\u5931\u8D25",
  "error.loginFailed": "\u767B\u5F55\u5931\u8D25",
  "error.noConnection": "tlogs: \u5F53\u524D\u8FDE\u63A5\u4E0D\u652F\u6301 RPC\uFF08\u7F3A\u5C11 connection \u670D\u52A1\uFF09",
  "error.rpcFailed": "tlogs: {endpoint} \u8C03\u7528\u5931\u8D25",
  // 列表分隔符（供应商列表用「、」，英文用逗号）
  "list.separator": "\u3001"
};

// src/client/i18n/dict/zh.ts
var zh = { ...zhApp, ...zhUi };

// src/client/i18n/dict/en-app.ts
var enApp = {
  "tab.calendar": "Calendar",
  "tab.charts": "Charts",
  "tab.models": "Models",
  "tab.providers": "Providers",
  "tab.years": "Years",
  "tab.months": "Months",
  "tab.days": "Days",
  "tab.settings": "Settings",
  "weekday.1": "Mon",
  "weekday.2": "Tue",
  "weekday.3": "Wed",
  "weekday.4": "Thu",
  "weekday.5": "Fri",
  "weekday.6": "Sat",
  "weekday.7": "Sun",
  "modal.title": "Usage details",
  "modal.label": "tlogs usage details",
  "modal.close": "Close usage details",
  "modal.closeTitle": "Close (Esc)",
  "common.refresh": "Refresh",
  "common.refreshing": "Refreshing\u2026",
  "common.loading": "Loading\u2026",
  "common.noData": "No data",
  "stat.input": "Input",
  "stat.output": "Output",
  "stat.totalTokens": "Total tokens",
  "stat.requests": "Requests",
  "stat.cost": "Cost",
  "cal.prevMonth": "Previous month",
  "cal.nextMonth": "Next month",
  "cal.selectMonth": "Select month",
  "cal.monthTotal": "{month} total",
  "cal.option": "{key} ({tokens} tokens{cost})",
  "cal.optionCost": " \xB7 {money}",
  "cal.cell": "{date} \xB7 {tokens} tokens \xB7 {requests} requests{cost}",
  "cal.cellCost": " \xB7 {money} CNY",
  "cal.cellNoData": "{date} \xB7 no data",
  "cal.noDaily": "No daily breakdown for this month yet \u2014 only the monthly total above is shown. The next auto refresh will try to backfill it.",
  "cal.pickDay": "Click a day in the calendar to see that day\u2019s breakdown.",
  "providers.localRange": "Local basis (DSH session logs{source}): {range} \xB7 {days} days \xB7 {files} session logs",
  "providers.localRangeSource": " \xB7 {source}",
  "providers.unavailable": "Local basis unavailable ({reason})",
  "providers.unavailableLong": "Local basis unavailable: {reason}",
  "providers.empty": "No local-basis data",
  "providers.coverage": "; includes providers platform billing cannot see (Volcano Ark / Xiaomi / GLM / GPT\u2026)",
  "providers.modelsNote": "Rows prefixed with \u201Cprovider \xB7\u201D come from local session logs (platform billing cannot see those models, so they carry no cost)",
  "settings.title": "Language",
  "settings.option.auto": "Follow system",
  "settings.option.zh": "\u4E2D\u6587",
  "settings.option.en": "English"
};

// src/client/i18n/dict/en-ui.ts
var enUi = {
  "bar.title": "tlogs \u2014 DeepSeek usage",
  "bar.titleTokens": "{label} {value} tokens{note}",
  "bar.titleRequests": "{label} {value} requests{note}",
  "bar.titleMoney": "{label} {value} CNY",
  "bar.noteLocal": " (Local basis: DSH session logs)",
  "bar.noteMerged": " (Platform + local merged)",
  "bar.staleTip": "Data may be stale: the last refresh failed, so cached values are shown.",
  "bar.busyTip": "Refreshing\u2026",
  "bar.refreshLabel": "Refresh usage data",
  "bar.refreshTitle": "Refresh usage",
  "bar.expandLabel": "Expand tlogs panel",
  "bar.collapseLabel": "Collapse tlogs panel",
  "bar.expand": "Expand",
  "bar.collapse": "Collapse",
  "panel.timeBasis": "Basis: platform days (UTC) \xB7 day rolls over at 08:00 Beijing time",
  "panel.dayBasis.utc": "The platform API buckets days[] by UTC day; this machine is on UTC, so the local day rolls over at 00:00.{billing}",
  "panel.dayBasis.local": "The platform API buckets days[] by UTC day: the local day rolls over at {start}, so \u201Ctoday\u201D runs from {start} to {end} the next day (not local 00:00). Weeks and months work the same way (Monday 00:00 / day 1 00:00 UTC).{billing}",
  "panel.dayBasis.billing": " Official billing settles by Beijing-time days (00:00) while this plugin buckets by the API\u2019s UTC days \u2014 up to 8 hours of usage can differ across a day boundary.",
  "panel.source.env": "Environment variable",
  "panel.source.config": "Plugin config",
  "panel.source.credentials": "Local credentials (manual entry / login)",
  "panel.source.platformSession": "DSH account session (reused automatically)",
  "panel.source.desktopLogin": "Built-in login window",
  "panel.credentialsSource": "Credential source: {source}",
  "panel.auth.invalid": "The userToken has expired; please log in again",
  "panel.auth.missing": "No userToken configured, so usage cannot be fetched",
  "panel.login": "Log in",
  "panel.login.title": "Open the built-in login window",
  "panel.login.titleDisabled": "This host cannot open a login window; use \u201CEnter manually\u201D to paste a platform userToken",
  "panel.login.unavailable": "The built-in login is unavailable on this host: the plugin runs in Electron\u2019s Node subprocess, which cannot create a login window. Use \u201CEnter manually\u201D to paste a platform userToken (the value stored as userToken in the browser\u2019s localStorage).",
  "panel.manual": "Enter manually",
  "panel.manual.title": "Paste a userToken manually (option C)",
  "panel.token.placeholder": "Paste userToken",
  "panel.save": "Save",
  "panel.cancel": "Cancel",
  "panel.localUnavailable": "Local basis unavailable ({reason}): window cards use platform billing only, so today\u2019s usage and non-DeepSeek providers may be missing or 0.",
  "panel.costBackfill": "Backfilling historical cost; the \xA5 figures on the cards are partial for now\u2026",
  "panel.account.balance": "Balance ",
  "panel.account.balanceTip": "Platform wallet balance (get_user_summary.normal_wallets)",
  "panel.account.totalCosts": "Official total spend ",
  "panel.account.totalCostsTip": "Cumulative spend from platform billing (get_user_summary.total_costs), i.e. the console figure",
  "panel.account.bonus": "Bonus ",
  "panel.account.bonusTip": "Bonus balance",
  "panel.detail": "Details \u203A",
  "panel.logout": "Log out",
  "panel.logout.title": "Clear the userToken saved on this machine",
  "panel.cycle.title": "Click to switch project",
  "panel.thirdParty": "Third-party",
  "panel.moneyTip.total": "{label} total {money} CNY",
  "panel.moneyTip.input": "Input {money} CNY",
  "panel.moneyTip.output": "Output {money} CNY",
  "panel.sourceTip.local": "Local basis (DSH session logs): real-time, covers every provider on this machine",
  "panel.sourceTip.merged": "Platform billing merged with the local basis",
  "panel.sourceTip.platform": "Platform billing basis",
  "panel.sourceTip.platformTokens": "Platform {n} tokens",
  "panel.sourceTip.localTokens": "Local {n} tokens ({deepseek} on the DeepSeek channel)",
  "panel.sourceTip.other": "Providers platform billing cannot see: {list}",
  "panel.sourceTip.costPending": "Cost uses platform pricing; same-day settlement lags by about 10\u201330 minutes, so it reads slightly low.",
  "chart.range.all": "All time",
  "chart.range.custom": "Custom",
  "chart.range.today": "Today",
  "chart.range.week": "This week",
  "chart.range.month": "This month",
  "chart.range.last7": "Last 7 days",
  "chart.range.last30": "Last 30 days",
  "chart.dim.model": "By model",
  "chart.dim.composition": "Input / output",
  "chart.dim.project": "By project",
  "chart.kind.line": "Line",
  "chart.kind.pie": "Pie",
  "chart.kind.bar": "Bar",
  "chart.aria.kind": "Pick chart type",
  "chart.label.kind": "Chart",
  "chart.label.composition": "Split",
  "chart.aria.range": "Time range",
  "chart.label.range": "Range",
  "chart.label.source": "Source",
  "chart.aria.source": "Pick data source",
  "chart.source.platform": "Platform billing (all)",
  "chart.label.metric": "Metric",
  "chart.aria.metric": "Pick metric",
  "chart.label.grain": "Grain",
  "chart.aria.grain": "Pick grain",
  "chart.label.basis": "Basis",
  "chart.mode.perBucket": "Per period",
  "chart.mode.cumulative": "Cumulative",
  "chart.label.from": "From",
  "chart.aria.from": "Start date",
  "chart.label.to": "To",
  "chart.aria.to": "End date",
  "chart.rangeTotal": "Range total",
  "chart.costPartial": "Some months still lack backfilled cost, so the curve may read low.",
  "chart.scope.snapshots": "Project basis: {n} snapshots (recorded daily since the plugin was enabled; earlier history is unavailable)",
  "chart.scope.bucketsDay": "{n} days",
  "chart.scope.bucketsMonth": "{n} months",
  "chart.scope.bucketsYear": "{n} years",
  "chart.updating": "Updating\u2026",
  "chart.noData": "No chart data",
  "chart.partialNote.lead": "Note: some months in this range have no daily breakdown (the API returns daily data for only some months). Daily grain draws those months as gaps; ",
  "chart.partialNote.bold": "monthly and yearly grains are unaffected",
  "chart.partialNote.tail": " (they use monthly totals).",
  "chart.projectSnapshots": "This project has only {n} snapshot(s): a trend line needs at least 2 days. The platform billing API has no project dimension, so earlier history cannot be recovered \u2014 one snapshot accumulates per day while the plugin runs.",
  "chart.title.line": "Usage trend",
  "chart.sub.cumulative": " \xB7 Cumulative",
  "chart.sub.perBucket": " \xB7 Per period",
  "chart.title.pie": "Composition share",
  "chart.sub.composition": "Input hit / miss / output",
  "chart.selectedProject": "Selected project",
  "chart.title.bar": "Usage breakdown",
  "chart.sub.bar": "Input hit / miss + output, stacked in three segments",
  "chart.metric.cacheHit": "Cache hit",
  "chart.metric.cacheMiss": "Cache miss",
  "chart.metric.requests": "Requests",
  "chart.metric.cost": "Cost (\xA5)",
  "chart.grain.auto": "Auto",
  "chart.grain.day": "Daily",
  "chart.grain.month": "Monthly",
  "chart.grain.year": "Yearly",
  "chart.other": "Other",
  "chart.legend.hit": "Input (cache hit)",
  "chart.legend.miss": "Input (cache miss)",
  "chart.breakdown.hit": "Hit",
  "chart.breakdown.miss": "Miss",
  "chart.customMetric": "Selected metric",
  "chart.sum.total": "Total",
  "chart.sum.max": "Max",
  "chart.sum.min": "Min",
  "chart.sum.avg": "Avg",
  "chart.noPlotData": "No data to plot in this range",
  "chart.aria.line": "Usage line chart",
  "chart.aria.bar": "Usage stacked bar chart",
  "chart.aria.donut": "Usage composition donut",
  "chart.hint.line": "Hover the line to see details for that point in time.",
  "chart.hint.lineCumulative": "The line is cumulative (accumulated from before the first day in range); hover to see a point\u2019s details.",
  "chart.hint.bar": "Hover a bar to see that period\u2019s input/output split; the dashed line is requests (separate scale).",
  "chart.hint.donut": "Hover a slice or legend row to see its share; extra items are merged into \u201COther\u201D.",
  "chart.empty.composition": "No composition data in this range",
  "chart.empty.projectCost": "Project usage comes from the local session projection; platform billing carries no cost for it",
  "chart.empty.project": "No project data available (the host provides no session usage source)",
  "chart.unit.requests": " requests",
  "chart.unit.money": " CNY",
  "table.name": "Name",
  "table.sortBy": "Sort by {column}",
  "money.shortBig": "M",
  "money.shortSmall": "K",
  "error.reason.notScanned": "Not scanned yet",
  "error.reason.disabled": "localUsage is disabled in the config",
  "error.reason.noSessionLogs": "No session logs found (none of the candidate directories exist)",
  "error.reason.zstd": "This runtime does not support zstd (Node 22.15+ / 24 required)",
  "error.reason.restoredEmpty": "No usable data in the cache",
  "error.reason.noUsageInWindow": "No usage for this window in the logs",
  "error.reason.sessionLogReadFailed": "Failed to read session logs",
  "error.reason.sessionsDir": "Sessions directory is unreadable",
  "error.reason.readFailed": "Read failed",
  "error.saveFailed": "Save failed",
  "error.loginFailed": "Login failed",
  "error.noConnection": "tlogs: this connection does not support RPC (the connection service is missing)",
  "error.rpcFailed": "tlogs: {endpoint} call failed",
  "list.separator": ", "
};

// src/client/i18n/dict/en.ts
var en = { ...enApp, ...enUi };

// src/client/i18n/index.ts
var LANG_PREFS = ["auto", "zh", "en"];
var LANG_STORAGE_KEY = "tlogs.lang";
var DICTS = { zh, en };
var pref = readPref();
var listeners = /* @__PURE__ */ new Set();
function notify() {
  for (const fn of [...listeners]) fn();
}
function readPref() {
  try {
    const raw = globalThis.localStorage?.getItem(LANG_STORAGE_KEY);
    if (raw === "auto" || raw === "zh" || raw === "en") return raw;
  } catch {
  }
  return "auto";
}
function writePref(next) {
  try {
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, next);
  } catch {
  }
}
function normalizeLang(tag) {
  if (!tag) return void 0;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  if (primary === "zh") return "zh";
  if (primary === "en") return "en";
  return void 0;
}
function detectSystemLang() {
  const htmlLang = typeof document !== "undefined" ? document.documentElement?.lang : void 0;
  const fromHtml = normalizeLang(htmlLang);
  if (fromHtml) return fromHtml;
  const nav = typeof navigator !== "undefined" ? navigator : void 0;
  for (const tag of nav?.languages ?? []) {
    const hit = normalizeLang(tag);
    if (hit) return hit;
  }
  return normalizeLang(nav?.language) ?? "zh";
}
function resolveLang(next) {
  return next === "auto" ? detectSystemLang() : next;
}
function getLang() {
  return resolveLang(pref);
}
function setLangPref(next) {
  if (next === pref) return;
  pref = next;
  writePref(next);
  notify();
}
function subscribeLang(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function translate(target, key, params) {
  const table = DICTS[target];
  const template = table[key] ?? DICTS.zh[key] ?? key;
  if (!params) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (whole, name) => Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  );
}
function t(key, params) {
  return translate(getLang(), key, params);
}
function useLangState() {
  const [current, setCurrent] = React2.useState(pref);
  React2.useEffect(() => {
    const sync = () => setCurrent(pref);
    sync();
    return subscribeLang(sync);
  }, []);
  return { pref: current, lang: resolveLang(current), setPref: setLangPref };
}
function useT() {
  const { lang: current } = useLangState();
  return React2.useCallback(
    (key, params) => translate(current, key, params),
    [current]
  );
}

// src/client/format.ts
function group(intPart) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function localReasonLabel(reason, tr = t) {
  switch (reason) {
    case void 0:
    case "not-scanned":
      return tr("error.reason.notScanned");
    case "disabled":
      return tr("error.reason.disabled");
    case "no-session-logs":
      return tr("error.reason.noSessionLogs");
    case "zstd-unavailable":
      return tr("error.reason.zstd");
    case "restored-empty":
      return tr("error.reason.restoredEmpty");
    case "no-usage-in-window":
      return tr("error.reason.noUsageInWindow");
    case "session-log-read-failed":
      return tr("error.reason.sessionLogReadFailed");
    default:
      return reason.startsWith("sessions-dir-unreadable") ? tr("error.reason.sessionsDir") : tr("error.reason.readFailed");
  }
}
function formatFull(n) {
  if (!Number.isFinite(n)) return "0";
  const neg = n < 0;
  const s = group(Math.abs(Math.trunc(n)).toString());
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
function formatMoneyFull(n) {
  if (!Number.isFinite(n)) return "\xA50";
  const neg = n < 0;
  const abs = Math.abs(n);
  const s = abs.toFixed(8).replace(/\.?0+$/, "");
  const [int, frac] = s.split(".");
  return `${neg ? "-" : ""}\xA5${group(int)}${frac ? `.${frac}` : ""}`;
}
function formatMoney(n) {
  if (!Number.isFinite(n)) return "\xA50.00";
  const neg = n < 0;
  const [int, frac] = Math.abs(n).toFixed(2).split(".");
  return `${neg ? "-" : ""}\xA5${group(int)}.${frac}`;
}
function formatMoneyShort(n) {
  if (!Number.isFinite(n)) return "\xA50";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const en2 = getLang() === "en";
  const big = en2 ? 1e6 : 1e8;
  const small = en2 ? 1e3 : 1e4;
  if (abs >= big) return `${sign}\xA5${scaledMoney(abs / big)}${t("money.shortBig")}`;
  if (abs >= small) return `${sign}\xA5${scaledMoney(abs / small)}${t("money.shortSmall")}`;
  return formatMoney(n);
}
function scaledMoney(v) {
  return v < 100 ? v.toFixed(2).replace(/\.?0+$/, "") : String(Math.round(v));
}

// src/client/compact-bar.tsx
function CompactBar(props) {
  const { snapshot, numberFormat, wide, expanded, busy, onToggle, onRefresh } = props;
  const t2 = useT();
  const metrics = snapshot?.compact ?? [];
  const stale = snapshot?.stale === true;
  const progress = snapshot?.loading ? snapshot.progress ?? 0 : null;
  const lead = metrics.find((m) => m.scope === "total") ?? metrics[0];
  const fullTitle = (label, value, unit, source) => {
    const note = source === "local" ? t2("bar.noteLocal") : source === "merged" ? t2("bar.noteMerged") : "";
    if (unit === "requests") return t2("bar.titleRequests", { label, value: formatFull(value), note });
    if (unit === "money") return t2("bar.titleMoney", { label, value: formatMoneyFull(value) });
    return t2("bar.titleTokens", { label, value: formatFull(value), note });
  };
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h(
    "div",
    {
      className: wide ? "tlogs-compact" : "tlogs-compact tlogs-collapsed",
      onClick: onToggle,
      title: t2("bar.title")
    },
    wide ? /* @__PURE__ */ h("span", { className: "tlogs-metrics" }, metrics.map((m, i) => /* @__PURE__ */ h(
      "span",
      {
        key: `${m.scope}-${m.label}-${i}`,
        className: "tlogs-metric",
        title: fullTitle(m.label, m.value, m.unit, m.source)
      },
      /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, m.label),
      /* @__PURE__ */ h(
        "span",
        {
          className: m.unit === "money" ? "tlogs-metric-value tlogs-metric-money" : "tlogs-metric-value"
        },
        m.unit === "money" ? formatMoney(m.value) : formatNumber(m.value, numberFormat)
      )
    )), metrics.length === 0 ? /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, t2("common.noData")) : null) : /* @__PURE__ */ h(
      "span",
      {
        className: "tlogs-collapsed-value",
        title: lead ? lead.unit === "money" ? t2("bar.titleMoney", { label: lead.label, value: formatMoneyFull(lead.value) }) : t2("bar.titleTokens", { label: lead.label, value: formatFull(lead.value), note: "" }) : t2("bar.title")
      },
      lead ? lead.unit === "money" ? formatMoney(lead.value) : formatNumber(lead.value, numberFormat) : "\u2014"
    ),
    /* @__PURE__ */ h("span", { className: "tlogs-actions" }, stale ? /* @__PURE__ */ h(
      "span",
      {
        className: "tlogs-stale",
        title: snapshot?.error ?? t2("bar.staleTip")
      },
      "\u26A0"
    ) : null, busy ? /* @__PURE__ */ h("span", { className: "tlogs-stale", title: t2("bar.busyTip") }, "\u27F3") : null, /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "tlogs-iconbtn tlogs-refresh",
        disabled: busy,
        onClick: (e) => {
          e.stopPropagation();
          onRefresh();
        },
        "aria-label": t2("bar.refreshLabel"),
        title: t2("bar.refreshTitle")
      },
      "\u21BB"
    ), /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "tlogs-iconbtn",
        onClick: (e) => {
          e.stopPropagation();
          onToggle();
        },
        "aria-expanded": expanded,
        "aria-label": expanded ? t2("bar.collapseLabel") : t2("bar.expandLabel"),
        title: expanded ? t2("bar.collapse") : t2("bar.expand")
      },
      expanded ? "\u25B4" : "\u25BE"
    ))
  ), progress !== null ? /* @__PURE__ */ h("span", { className: "tlogs-progress", "aria-hidden": "true" }, /* @__PURE__ */ h("i", { style: { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` } })) : null);
}

// src/client/expand-panel.tsx
var React4 = __toESM(require("react"), 1);

// src/types.ts
var TOKEN_TYPES = [
  "PROMPT_TOKEN",
  "PROMPT_CACHE_HIT_TOKEN",
  "PROMPT_CACHE_MISS_TOKEN",
  "RESPONSE_TOKEN",
  "REQUEST"
];
function moneyTotal(m) {
  if (!m) return 0;
  let s = 0;
  for (const t2 of TOKEN_TYPES) s += m[t2];
  return s;
}
var TOKEN_TYPE_SET = new Set(TOKEN_TYPES);
var TLOGS_CHANNEL = "/tlogs";
var RPC = {
  snapshot: "tlogs.snapshot",
  refresh: "tlogs.refresh",
  detail: "tlogs.detail",
  /** 指定年月的明细（日历查询）。 */
  month: "tlogs.month",
  /** 图表数据（范围 × 项目 × 指标，见 UsageSeries）。 */
  series: "tlogs.series",
  login: "tlogs.login",
  setToken: "tlogs.setToken",
  logout: "tlogs.logout",
  export: "tlogs.export"
};

// src/client/expand-panel.tsx
var SOURCE_LABEL = {
  env: "panel.source.env",
  config: "panel.source.config",
  credentials: "panel.source.credentials",
  "platform-session": "panel.source.platformSession",
  "desktop-login": "panel.source.desktopLogin"
};
var TIME_BASIS_KEY = "panel.timeBasis";
function dayBasisTip(t2) {
  const offsetMin = -(/* @__PURE__ */ new Date()).getTimezoneOffset();
  const hhmm = (m) => {
    const x = (m % 1440 + 1440) % 1440;
    return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  };
  const start = hhmm(offsetMin);
  const end = hhmm(offsetMin + 1440);
  const billing = t2("panel.dayBasis.billing");
  if (offsetMin === 0) {
    return { tip: t2("panel.dayBasis.utc", { billing }) };
  }
  return { tip: t2("panel.dayBasis.local", { start, end, billing }) };
}
function Card(props) {
  const { card, numberFormat, selectedId, onCycle } = props;
  const t2 = useT();
  const clickable = typeof onCycle === "function" && (card.options?.length ?? 0) > 1;
  const current = card.options?.find((o) => o.id === selectedId) ?? card.options?.[0];
  const stat = current?.stat ?? card.stat;
  const cost = stat.cost ? moneyTotal(stat.cost) : void 0;
  const moneyTip = cost === void 0 ? "" : [
    t2("panel.moneyTip.total", { label: card.label, money: formatMoneyFull(cost) }),
    t2("panel.moneyTip.input", { money: formatMoneyFull(inputCost(stat)) }),
    t2("panel.moneyTip.output", { money: formatMoneyFull(outputCost(stat)) })
  ].join("\n");
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
      title: clickable ? t2("panel.cycle.title") : void 0
    },
    /* @__PURE__ */ h("div", { className: "tlogs-card-head" }, /* @__PURE__ */ h("span", { className: "tlogs-card-title", title: card.source ? sourceTip(card.source, t2) : void 0 }, card.label, current && (card.options?.length ?? 0) > 1 ? ` \xB7 ${current.label}` : ""), card.source && card.source.otherProviders.length > 0 ? /* @__PURE__ */ h("span", { className: "tlogs-src", title: sourceTip(card.source, t2) }, t2("panel.thirdParty")) : null, card.stale ? /* @__PURE__ */ h("span", { className: "tlogs-stale" }, "\u26A0") : null),
    card.error ? /* @__PURE__ */ h("span", { className: "tlogs-card-total is-error" }, card.error) : /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("span", { className: "tlogs-card-line" }, /* @__PURE__ */ h("span", { className: "tlogs-card-total", title: `${formatFull(stat.totalTokens)} tokens` }, formatNumber(stat.totalTokens, numberFormat)), cost === void 0 ? null : /* @__PURE__ */ h("span", { className: "tlogs-card-money", title: moneyTip }, formatMoney(cost))), /* @__PURE__ */ h("span", { className: "tlogs-card-split" }, /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("span", { className: "tlogs-split-label" }, t2("stat.input")), /* @__PURE__ */ h("b", { title: formatFull(stat.inputTokens) }, formatNumber(stat.inputTokens, numberFormat))), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("span", { className: "tlogs-split-label" }, t2("stat.output")), /* @__PURE__ */ h("b", { title: formatFull(stat.outputTokens) }, formatNumber(stat.outputTokens, numberFormat))), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("span", { className: "tlogs-split-label" }, t2("stat.requests")), /* @__PURE__ */ h("b", { title: formatFull(stat.requests) }, formatNumber(stat.requests, numberFormat)))))
  );
}
function inputCost(stat) {
  const c = stat.cost;
  if (!c) return 0;
  return c.PROMPT_TOKEN + c.PROMPT_CACHE_HIT_TOKEN + c.PROMPT_CACHE_MISS_TOKEN;
}
function outputCost(stat) {
  return stat.cost?.RESPONSE_TOKEN ?? 0;
}
function sourceTip(s, t2) {
  const head = s.kind === "local" ? t2("panel.sourceTip.local") : s.kind === "merged" ? t2("panel.sourceTip.merged") : t2("panel.sourceTip.platform");
  const lines = [
    head,
    t2("panel.sourceTip.platformTokens", { n: formatFull(s.platformTokens) }),
    t2("panel.sourceTip.localTokens", {
      n: formatFull(s.localTokens),
      deepseek: formatFull(s.localDeepseekTokens)
    })
  ];
  if (s.otherProviders.length > 0) {
    lines.push(
      t2("panel.sourceTip.other", {
        list: s.otherProviders.slice(0, 4).map((p) => `${p.provider} ${formatFull(p.tokens)}`).join(t2("list.separator"))
      })
    );
  }
  if (s.costPending) lines.push(t2("panel.sourceTip.costPending"));
  return lines.join("\n");
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
  const t2 = useT();
  const [showTokenInput, setShowTokenInput] = React4.useState(false);
  const [draft, setDraft] = React4.useState("");
  const [selections, setSelections] = React4.useState({});
  const auth = snapshot?.auth ?? { status: "unknown" };
  const needsAuth = auth.status === "invalid" || auth.status === "missing";
  const loginAvailable = snapshot?.display.loginAvailable !== false;
  const basis = dayBasisTip(t2);
  const cycle = (index, card) => {
    const opts = card.options ?? [];
    if (opts.length < 2) return;
    const currentId = selections[index] ?? card.selectedOptionId ?? opts[0].id;
    const pos = opts.findIndex((o) => o.id === currentId);
    const next = opts[(pos + 1) % opts.length];
    setSelections((prev) => ({ ...prev, [index]: next.id }));
  };
  const submitToken = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const ok = await onSetToken(trimmed);
    if (ok) {
      setDraft("");
      setShowTokenInput(false);
    }
  };
  return /* @__PURE__ */ h("div", { className: "tlogs-panel" }, needsAuth ? /* @__PURE__ */ h("div", { className: "tlogs-notice tlogs-notice-danger" }, /* @__PURE__ */ h("span", null, auth.status === "invalid" ? t2("panel.auth.invalid") : t2("panel.auth.missing"), auth.status === "invalid" && auth.message ? /* @__PURE__ */ h("span", { className: "tlogs-hint" }, " \u2014\u2014 ", auth.message) : null), /* @__PURE__ */ h("span", { className: "tlogs-actions" }, /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "tlogs-btn tlogs-btn-primary",
      onClick: onLogin,
      disabled: !loginAvailable,
      title: loginAvailable ? t2("panel.login.title") : t2("panel.login.titleDisabled")
    },
    t2("panel.login")
  ), /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "tlogs-btn",
      onClick: () => setShowTokenInput((v) => !v),
      title: t2("panel.manual.title")
    },
    t2("panel.manual")
  ))) : null, needsAuth && !loginAvailable ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, t2("panel.login.unavailable")) : null, showTokenInput ? /* @__PURE__ */ h("div", { className: "tlogs-notice" }, /* @__PURE__ */ h(
    "input",
    {
      className: "tlogs-input",
      type: "password",
      autoComplete: "off",
      spellCheck: false,
      placeholder: t2("panel.token.placeholder"),
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter") void submitToken();
      }
    }
  ), /* @__PURE__ */ h("span", { className: "tlogs-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn tlogs-btn-primary", onClick: () => void submitToken() }, t2("panel.save")), /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "tlogs-btn",
      onClick: () => {
        setDraft("");
        setShowTokenInput(false);
      }
    },
    t2("panel.cancel")
  ))) : null, error ? /* @__PURE__ */ h("div", { className: "tlogs-error" }, error) : null, auth.status === "ok" ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, t2("panel.credentialsSource", {
    source: SOURCE_LABEL[auth.source] ? t2(SOURCE_LABEL[auth.source]) : auth.source
  })) : null, /* @__PURE__ */ h("div", { className: "tlogs-hint", title: basis.tip }, t2(TIME_BASIS_KEY)), snapshot?.localUsage && !snapshot.localUsage.available ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, t2("panel.localUnavailable", { reason: localReasonLabel(snapshot.localUsage.reason, t2) })) : null, snapshot && !snapshot.costComplete && snapshot.loading ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, t2("panel.costBackfill")) : null, /* @__PURE__ */ h("div", { className: "tlogs-cards" }, (snapshot?.cards ?? []).map((card, i) => /* @__PURE__ */ h(
    Card,
    {
      key: `${card.scope}-${card.label}-${i}`,
      card,
      numberFormat,
      selectedId: selections[i] ?? card.selectedOptionId,
      onCycle: card.options && card.options.length > 1 ? () => cycle(i, card) : void 0
    }
  )), snapshot === null ? /* @__PURE__ */ h("div", { className: "tlogs-empty" }, t2("common.loading")) : null), snapshot?.account ? /* @__PURE__ */ h("div", { className: "tlogs-account" }, /* @__PURE__ */ h("span", { title: t2("panel.account.balanceTip") }, t2("panel.account.balance"), /* @__PURE__ */ h("b", null, formatMoneyFull(snapshot.account.balance))), /* @__PURE__ */ h("span", { title: t2("panel.account.totalCostsTip") }, t2("panel.account.totalCosts"), /* @__PURE__ */ h("b", null, formatMoneyFull(snapshot.account.totalCosts))), snapshot.account.bonusBalance > 0 ? /* @__PURE__ */ h("span", { title: t2("panel.account.bonusTip") }, t2("panel.account.bonus"), /* @__PURE__ */ h("b", null, formatMoneyFull(snapshot.account.bonusBalance))) : null) : null, /* @__PURE__ */ h("div", { className: "tlogs-footer-actions" }, enableDetailView ? /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onOpenDetail }, t2("panel.detail")) : /* @__PURE__ */ h("span", null), /* @__PURE__ */ h("span", { className: "tlogs-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? t2("common.refreshing") : t2("common.refresh")), /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onLogout, title: t2("panel.logout.title") }, t2("panel.logout")))));
}

// src/client/detail-modal.tsx
var React9 = __toESM(require("react"), 1);

// src/client/detail-view.tsx
var React5 = __toESM(require("react"), 1);
function rowCost(r) {
  return r.stat.cost ? moneyTotal(r.stat.cost) : void 0;
}
function sortRows(rows, key, dir) {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "label") return sign * a.label.localeCompare(b.label);
    if (key === "cost") return sign * ((rowCost(a) ?? 0) - (rowCost(b) ?? 0));
    return sign * (a.stat[key] - b.stat[key]);
  });
}
function StatTable(props) {
  const { rows, emptyText } = props;
  const t2 = useT();
  const [sort, setSort] = React5.useState({
    key: "totalTokens",
    dir: "desc"
  });
  const hasCost = rows.some((r) => rowCost(r) !== void 0);
  const columns = React5.useMemo(() => {
    const base = [
      { key: "label", labelKey: "table.name" },
      { key: "inputTokens", labelKey: "stat.input" },
      { key: "outputTokens", labelKey: "stat.output" },
      { key: "totalTokens", labelKey: "stat.totalTokens" },
      { key: "requests", labelKey: "stat.requests" }
    ];
    if (hasCost) base.push({ key: "cost", labelKey: "stat.cost" });
    return base;
  }, [hasCost]);
  const sorted = sortRows(rows, sort.key, sort.dir);
  const toggleSort = (key) => {
    setSort(
      (prev) => prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }
    );
  };
  if (rows.length === 0) return /* @__PURE__ */ h("div", { className: "tlogs-empty" }, emptyText ?? t2("common.noData"));
  return /* @__PURE__ */ h("div", { className: "tlogs-table-wrap" }, /* @__PURE__ */ h("table", { className: "tlogs-table" }, /* @__PURE__ */ h("thead", null, /* @__PURE__ */ h("tr", null, columns.map((c) => /* @__PURE__ */ h(
    "th",
    {
      key: c.key,
      onClick: () => toggleSort(c.key),
      title: t2("table.sortBy", { column: t2(c.labelKey) }),
      "aria-sort": sort.key === c.key ? sort.dir === "asc" ? "ascending" : "descending" : "none"
    },
    t2(c.labelKey),
    sort.key === c.key ? sort.dir === "asc" ? " \u2191" : " \u2193" : ""
  )))), /* @__PURE__ */ h("tbody", null, sorted.map((r) => {
    const c = rowCost(r);
    return /* @__PURE__ */ h("tr", { key: r.key }, /* @__PURE__ */ h("td", { title: r.label }, r.tag ? /* @__PURE__ */ h("span", { className: "tlogs-src tlogs-src-inline", title: r.tagTitle ?? r.tag }, r.tag) : null, r.label), /* @__PURE__ */ h("td", { title: formatFull(r.stat.inputTokens) }, formatFull(r.stat.inputTokens)), /* @__PURE__ */ h("td", { title: formatFull(r.stat.outputTokens) }, formatFull(r.stat.outputTokens)), /* @__PURE__ */ h("td", { title: formatFull(r.stat.totalTokens) }, formatFull(r.stat.totalTokens)), /* @__PURE__ */ h("td", { title: formatFull(r.stat.requests) }, formatFull(r.stat.requests)), hasCost ? /* @__PURE__ */ h("td", { className: "tlogs-td-money", title: c === void 0 ? "" : formatMoneyFull(c) }, c === void 0 ? "\u2014" : formatMoneyFull(c)) : null);
  }))));
}

// src/client/chart-panel.tsx
var React7 = __toESM(require("react"), 1);

// src/client/charts.tsx
var React6 = __toESM(require("react"), 1);

// src/api/parser.ts
function inputTokens(stat) {
  return stat.PROMPT_TOKEN + stat.PROMPT_CACHE_HIT_TOKEN + stat.PROMPT_CACHE_MISS_TOKEN;
}
function outputTokens(stat) {
  return stat.RESPONSE_TOKEN;
}

// src/client/chart-utils.ts
var METRICS = [
  { id: "total", labelKey: "stat.totalTokens", unit: "tokens" },
  { id: "input", labelKey: "stat.input", unit: "tokens" },
  { id: "output", labelKey: "stat.output", unit: "tokens" },
  { id: "cacheHit", labelKey: "chart.metric.cacheHit", unit: "tokens" },
  { id: "cacheMiss", labelKey: "chart.metric.cacheMiss", unit: "tokens" },
  { id: "requests", labelKey: "chart.metric.requests", unit: "requests" },
  { id: "cost", labelKey: "chart.metric.cost", unit: "money" }
];
var GRAINS = [
  { id: "auto", labelKey: "chart.grain.auto" },
  { id: "day", labelKey: "chart.grain.day" },
  { id: "month", labelKey: "chart.grain.month" },
  { id: "year", labelKey: "chart.grain.year" }
];
function metricValue(stat, metric) {
  switch (metric) {
    case "total":
      return inputTokens(stat) + outputTokens(stat);
    case "input":
      return inputTokens(stat);
    case "output":
      return outputTokens(stat);
    case "cacheHit":
      return stat.PROMPT_CACHE_HIT_TOKEN;
    case "cacheMiss":
      return stat.PROMPT_CACHE_MISS_TOKEN;
    case "requests":
      return stat.REQUEST;
    // Cost lives in a separate Money structure, never in Stat; buckets carry it.
    case "cost":
      return 0;
    default:
      return 0;
  }
}
function metricSuffix(unit, t2) {
  if (unit === "requests") return t2("chart.unit.requests");
  if (unit === "money") return t2("chart.unit.money");
  return "";
}
function toPoints(buckets, values) {
  return buckets.map((b, i) => ({
    key: b.key,
    label: b.label,
    full: b.full,
    value: values[i] ?? 0,
    stat: b.stat,
    empty: b.empty
  }));
}
function parseKeyMs(key) {
  const parts = key.split("-");
  const y = Number(parts[0]);
  if (!Number.isFinite(y)) return NaN;
  const m = parts.length > 1 ? Number(parts[1]) : 1;
  const d = parts.length > 2 ? Number(parts[2]) : 1;
  return Date.UTC(y, m - 1, d);
}
function spanDays(from, to) {
  const a = parseKeyMs(from);
  const b = parseKeyMs(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 864e5) + 1;
}
function autoGrain(from, to) {
  const days = spanDays(from, to);
  if (days <= 92) return "day";
  if (days <= 1100) return "month";
  return "year";
}
function resolveGrain(grain, from, to) {
  return grain === "auto" ? autoGrain(from, to) : grain;
}
function zeroStat() {
  return {
    PROMPT_TOKEN: 0,
    PROMPT_CACHE_HIT_TOKEN: 0,
    PROMPT_CACHE_MISS_TOKEN: 0,
    RESPONSE_TOKEN: 0,
    REQUEST: 0
  };
}
var MAX_FILL_DAYS = 400;
function dayBuckets(days, from, to) {
  const byDate = /* @__PURE__ */ new Map();
  for (const d of days) byDate.set(d.date, { stat: d.stat, cost: d.cost });
  const span = spanDays(from, to);
  if (span <= 0) return [];
  if (span > MAX_FILL_DAYS) {
    return [...byDate.entries()].filter(([date]) => date >= from && date <= to).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => makeBucket(date, "day", v.stat, true, v.cost));
  }
  const out = [];
  const start = parseKeyMs(from);
  for (let i = 0; i < span; i++) {
    const d = new Date(start + i * 864e5);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate()
    ).padStart(2, "0")}`;
    if (key > to) break;
    const v = byDate.get(key);
    out.push(v ? makeBucket(key, "day", v.stat, true, v.cost) : makeBucket(key, "day", zeroStat(), false));
  }
  return out;
}
function monthBuckets(months) {
  return [...months].sort((a, b) => a.key.localeCompare(b.key)).map((p) => makeBucket(p.key, "month", p.stat, false, p.cost));
}
function yearBuckets(months) {
  const acc = /* @__PURE__ */ new Map();
  const costs = /* @__PURE__ */ new Map();
  for (const p of months) {
    const year = p.key.slice(0, 4);
    let target = acc.get(year);
    if (!target) {
      target = zeroStat();
      acc.set(year, target);
    }
    target.PROMPT_TOKEN += p.stat.PROMPT_TOKEN;
    target.PROMPT_CACHE_HIT_TOKEN += p.stat.PROMPT_CACHE_HIT_TOKEN;
    target.PROMPT_CACHE_MISS_TOKEN += p.stat.PROMPT_CACHE_MISS_TOKEN;
    target.RESPONSE_TOKEN += p.stat.RESPONSE_TOKEN;
    target.REQUEST += p.stat.REQUEST;
    if (p.cost !== void 0) costs.set(year, (costs.get(year) ?? 0) + p.cost);
  }
  return [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([year, stat]) => makeBucket(year, "year", stat, false, costs.get(year)));
}
function makeBucket(key, grain, stat, filled, cost) {
  const empty = stat.PROMPT_TOKEN === 0 && stat.PROMPT_CACHE_HIT_TOKEN === 0 && stat.PROMPT_CACHE_MISS_TOKEN === 0 && stat.RESPONSE_TOKEN === 0 && stat.REQUEST === 0;
  const b = {
    key,
    label: shortLabel(key, grain),
    full: key,
    stat: { ...stat },
    // A filled gap and a real zero both plot at 0; only the gap counts as empty.
    empty: empty && !filled
  };
  if (cost !== void 0) b.cost = cost;
  return b;
}
function shortLabel(key, grain) {
  if (grain === "year") return key.slice(0, 4);
  if (grain === "month") return key.slice(2);
  return key.slice(5);
}
function bucketValues(buckets, metric, mode, prior) {
  const raw = buckets.map((b) => bucketMetricValue(b, metric));
  if (mode === "perBucket") return raw;
  let acc = prior;
  return raw.map((v) => {
    acc += v;
    return acc;
  });
}
function bucketMetricValue(bucket, metric) {
  if (metric === "cost") return bucket.cost ?? 0;
  return metricValue(bucket.stat, metric);
}
function niceTicks(max, count = 4) {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rough = max / Math.max(1, count);
  const exp = Math.floor(Math.log10(rough));
  const pow = Math.pow(10, exp);
  const f = rough / pow;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  const step = nice * pow;
  const out = [];
  for (let v = 0; v <= max + step * 0.5; v += step) out.push(round(v));
  if (out.length < 2) out.push(round(step));
  return out;
}
function round(n) {
  return Math.round(n * 1e6) / 1e6;
}
function linePath(values, width, height, max) {
  if (values.length === 0) return "";
  const pts = pointsOf(values, width, height, max);
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
}
function areaPath(values, width, height, max) {
  if (values.length === 0) return "";
  const pts = pointsOf(values, width, height, max);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${linePath(values, width, height, max)} L${last[0]} ${height} L${first[0]} ${height} Z`;
}
function pointsOf(values, width, height, max) {
  const n = values.length;
  const safeMax = max > 0 ? max : 1;
  const x = (i) => n <= 1 ? width / 2 : i / (n - 1) * width;
  const y = (v) => height - Math.max(0, v) / safeMax * height;
  return values.map((v, i) => [round2(x(i)), round2(y(v))]);
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function pieSlices(items, maxSlices = 8, otherLabel = t("chart.other")) {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];
  let head = positive;
  let tail = [];
  if (positive.length > maxSlices) {
    head = positive.slice(0, maxSlices - 1);
    tail = positive.slice(maxSlices - 1);
  }
  const slices = head.map((i, idx) => ({
    key: i.key,
    label: i.label,
    value: i.value,
    percent: i.value / total,
    colorIndex: idx
  }));
  if (tail.length > 0) {
    const sum = tail.reduce((s, i) => s + i.value, 0);
    slices.push({
      key: "__other__",
      label: otherLabel,
      value: sum,
      percent: sum / total,
      colorIndex: slices.length
    });
  }
  return slices;
}
function labelIndices(count, max = 7) {
  const out = /* @__PURE__ */ new Set();
  if (count <= 0) return out;
  if (count <= max) {
    for (let i = 0; i < count; i++) out.add(i);
    return out;
  }
  const step = Math.ceil((count - 1) / (max - 1));
  const picked = [];
  for (let i = 0; i < count - 1; i += step) picked.push(i);
  const last = picked[picked.length - 1];
  if (last !== void 0 && count - 1 - last < step * 0.6 && picked.length > 1) picked.pop();
  for (const i of picked) out.add(i);
  out.add(count - 1);
  return out;
}
function hitSpans(xs, width) {
  const n = xs.length;
  if (n === 0) return [];
  if (n === 1) return [[0, width]];
  const bounds = [0];
  for (let i = 1; i < n; i++) bounds.push((xs[i - 1][0] + xs[i][0]) / 2);
  bounds.push(width);
  return xs.map((_, i) => [bounds[i], bounds[i + 1]]);
}
function projectBuckets(points, prior, mode) {
  if (mode === "cumulative") {
    return points.map((p) => makeBucket(p.date, "day", p.stat, true));
  }
  let prev = prior ? { ...prior } : void 0;
  const out = [];
  for (const p of points) {
    const delta = zeroStat();
    if (prev) {
      delta.PROMPT_CACHE_HIT_TOKEN = Math.max(0, p.stat.PROMPT_CACHE_HIT_TOKEN - prev.PROMPT_CACHE_HIT_TOKEN);
      delta.PROMPT_CACHE_MISS_TOKEN = Math.max(0, p.stat.PROMPT_CACHE_MISS_TOKEN - prev.PROMPT_CACHE_MISS_TOKEN);
      delta.PROMPT_TOKEN = Math.max(0, p.stat.PROMPT_TOKEN - prev.PROMPT_TOKEN);
      delta.RESPONSE_TOKEN = Math.max(0, p.stat.RESPONSE_TOKEN - prev.RESPONSE_TOKEN);
      delta.REQUEST = Math.max(0, p.stat.REQUEST - prev.REQUEST);
    } else {
      delta.PROMPT_CACHE_HIT_TOKEN = p.stat.PROMPT_CACHE_HIT_TOKEN;
      delta.PROMPT_CACHE_MISS_TOKEN = p.stat.PROMPT_CACHE_MISS_TOKEN;
      delta.PROMPT_TOKEN = p.stat.PROMPT_TOKEN;
      delta.RESPONSE_TOKEN = p.stat.RESPONSE_TOKEN;
      delta.REQUEST = p.stat.REQUEST;
    }
    out.push(makeBucket(p.date, "day", delta, false));
    prev = p.stat;
  }
  return out;
}

// src/client/charts.tsx
var VB_W = 720;
var LINE_H = 220;
var PAD_L = 54;
var PAD_R = 10;
var PAD_T = 10;
var PAD_B = 24;
var BAR_H = 236;
var BAR_PAD_B = 38;
var DONUT = 170;
var DONUT_R = 62;
var DONUT_W = 17;
var lineInner = { w: VB_W - PAD_L - PAD_R, h: LINE_H - PAD_T - PAD_B };
var barInner = { w: VB_W - PAD_L - PAD_R, h: BAR_H - PAD_T - BAR_PAD_B };
function formatValue(v, unit, mode = "short") {
  if (unit === "money") return mode === "full" ? formatMoneyFull(v) : formatMoneyShort(v);
  if (unit === "requests") return formatFull(Math.round(v));
  return mode === "full" ? formatFull(Math.round(v)) : formatShort(v);
}
function breakdownOf(stat, t2) {
  return [
    { label: t2("chart.breakdown.hit"), value: formatFull(stat.PROMPT_CACHE_HIT_TOKEN) },
    { label: t2("chart.breakdown.miss"), value: formatFull(stat.PROMPT_CACHE_MISS_TOKEN + stat.PROMPT_TOKEN) },
    { label: t2("stat.output"), value: formatFull(stat.RESPONSE_TOKEN) },
    ...stat.REQUEST > 0 ? [{ label: t2("stat.requests"), value: `${formatFull(stat.REQUEST)}${t2("chart.unit.requests")}` }] : []
  ];
}
function InfoBar(props) {
  const { point, unit, hint } = props;
  const t2 = useT();
  if (!point) return /* @__PURE__ */ h("div", { className: "tlogs-chart-info is-hint" }, hint);
  return /* @__PURE__ */ h("div", { className: "tlogs-chart-info" }, /* @__PURE__ */ h("span", { className: "tlogs-chart-info-key" }, point.full), /* @__PURE__ */ h("span", { className: "tlogs-metric" }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, unit === "requests" ? t2("stat.requests") : unit === "money" ? t2("stat.cost") : t2("chart.customMetric")), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, formatValue(point.value, unit, "full"), metricSuffix(unit, t2))), breakdownOf(point.stat, t2).map((e) => /* @__PURE__ */ h("span", { key: e.label, className: "tlogs-metric" }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, e.label), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, e.value))));
}
function Summary(props) {
  const { values, unit } = props;
  const t2 = useT();
  const positive = values.filter((v) => v > 0);
  const total = values.reduce((s, v) => s + v, 0);
  const max = positive.length > 0 ? Math.max(...positive) : 0;
  const min = positive.length > 0 ? Math.min(...positive) : 0;
  const avg = positive.length > 0 ? total / positive.length : 0;
  const items = [
    ["chart.sum.total", total, false],
    ["chart.sum.max", max, false],
    ["chart.sum.min", min, false],
    ["chart.sum.avg", avg, true]
  ];
  return /* @__PURE__ */ h("div", { className: "tlogs-chart-summary" }, items.map(([labelKey, v, isAvg]) => /* @__PURE__ */ h("span", { key: labelKey, className: "tlogs-metric", title: formatValue(v, unit, "full") }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, t2(labelKey)), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, unit === "tokens" && isAvg ? formatShort(v) : formatValue(v, unit, "short"), isAvg || unit === "tokens" ? "" : metricSuffix(unit, t2)))));
}
function Axis(props) {
  const { ticks, max, width, height } = props;
  return /* @__PURE__ */ h(Fragment2, null, ticks.map((t2) => {
    const y = height - t2 / (max > 0 ? max : 1) * height;
    return /* @__PURE__ */ h(Fragment2, { key: `t-${t2}` }, /* @__PURE__ */ h("line", { className: "tlogs-grid", x1: 0, x2: width, y1: y, y2: y }), /* @__PURE__ */ h("text", { className: "tlogs-axis-text is-y", x: -8, y: y + 3, textAnchor: "end" }, formatShort(t2)));
  }));
}
function AxisLabels(props) {
  const { points, xs, y, max = 7 } = props;
  const shown = labelIndices(points.length, max);
  return /* @__PURE__ */ h(Fragment2, null, points.map(
    (p, i) => shown.has(i) ? /* @__PURE__ */ h(
      "text",
      {
        key: `x-${p.key}`,
        className: "tlogs-axis-text",
        x: xs[i][0],
        y,
        textAnchor: "middle"
      },
      p.label
    ) : null
  ));
}
function LineChart(props) {
  const { points, unit, cumulative } = props;
  const t2 = useT();
  const [hover, setHover] = React6.useState(null);
  if (points.length === 0) {
    return /* @__PURE__ */ h("div", { className: "tlogs-empty" }, t2("chart.noPlotData"));
  }
  const values = points.map((p) => p.value);
  const ticks = niceTicks(maxOfArray(values));
  const max = ticks[ticks.length - 1];
  const xs = pointsOf(values, lineInner.w, lineInner.h, max);
  const spans = hitSpans(xs, lineInner.w);
  const line = linePath(values, lineInner.w, lineInner.h, max);
  const area = areaPath(values, lineInner.w, lineInner.h, max);
  const active = hover === null ? null : points[hover] ?? null;
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h(
    "svg",
    {
      className: "tlogs-chart-svg",
      viewBox: `0 0 ${VB_W} ${LINE_H}`,
      role: "img",
      "aria-label": t2("chart.aria.line")
    },
    /* @__PURE__ */ h("g", { transform: `translate(${PAD_L}, ${PAD_T})` }, /* @__PURE__ */ h(Axis, { ticks, max, width: lineInner.w, height: lineInner.h }), area ? /* @__PURE__ */ h("path", { className: "tlogs-area", d: area }) : null, line ? /* @__PURE__ */ h("path", { className: "tlogs-line", d: line }) : null, active ? /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h(
      "line",
      {
        className: "tlogs-guide",
        x1: xs[hover][0],
        x2: xs[hover][0],
        y1: 0,
        y2: lineInner.h
      }
    ), /* @__PURE__ */ h("circle", { className: "tlogs-dot", cx: xs[hover][0], cy: xs[hover][1], r: 3.5 })) : null, points.map((p, i) => /* @__PURE__ */ h(
      "rect",
      {
        key: `h-${p.key}`,
        className: "tlogs-hit",
        x: spans[i][0],
        width: Math.max(0, spans[i][1] - spans[i][0]),
        y: 0,
        height: lineInner.h,
        onMouseEnter: () => setHover(i),
        onMouseLeave: () => setHover((cur) => cur === i ? null : cur),
        "data-key": p.key
      }
    )), /* @__PURE__ */ h(AxisLabels, { points, xs, y: lineInner.h + 15 }))
  ), /* @__PURE__ */ h(Summary, { values, unit }), /* @__PURE__ */ h(
    InfoBar,
    {
      point: active,
      unit,
      hint: cumulative ? t2("chart.hint.lineCumulative") : t2("chart.hint.line")
    }
  ));
}
function StackedBarChart(props) {
  const { points } = props;
  const t2 = useT();
  const [hover, setHover] = React6.useState(null);
  if (points.length === 0) {
    return /* @__PURE__ */ h("div", { className: "tlogs-empty" }, t2("chart.noPlotData"));
  }
  const totals = points.map(
    (p) => p.stat.PROMPT_CACHE_HIT_TOKEN + p.stat.PROMPT_CACHE_MISS_TOKEN + p.stat.PROMPT_TOKEN + p.stat.RESPONSE_TOKEN
  );
  const ticks = niceTicks(maxOfArray(totals));
  const max = ticks[ticks.length - 1];
  const reqMax = Math.max(0, ...points.map((p) => p.stat.REQUEST));
  const slot = barInner.w / points.length;
  const barW = Math.max(1.5, Math.min(26, slot * 0.72));
  const active = hover === null ? null : points[hover] ?? null;
  const seg = (v) => max > 0 ? Math.max(0, v) / max * barInner.h : 0;
  const centers = points.map((_, i) => slot * (i + 0.5));
  const reqLine = reqMax > 0 ? points.map((p, i) => {
    const y = barInner.h - p.stat.REQUEST / reqMax * barInner.h;
    return `${i === 0 ? "M" : "L"}${r2(centers[i])} ${r2(y)}`;
  }).join(" ") : "";
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "tlogs-legend" }, /* @__PURE__ */ h("span", { className: "tlogs-legend-item" }, /* @__PURE__ */ h("i", { className: "tlogs-swatch tlogs-swatch-c1" }), t2("chart.legend.hit")), /* @__PURE__ */ h("span", { className: "tlogs-legend-item" }, /* @__PURE__ */ h("i", { className: "tlogs-swatch tlogs-swatch-c2" }), t2("chart.legend.miss")), /* @__PURE__ */ h("span", { className: "tlogs-legend-item" }, /* @__PURE__ */ h("i", { className: "tlogs-swatch tlogs-swatch-c3" }), t2("stat.output")), reqMax > 0 ? /* @__PURE__ */ h("span", { className: "tlogs-legend-item" }, /* @__PURE__ */ h("i", { className: "tlogs-swatch tlogs-swatch-req" }), t2("chart.metric.requests")) : null), /* @__PURE__ */ h(
    "svg",
    {
      className: "tlogs-chart-svg",
      viewBox: `0 0 ${VB_W} ${BAR_H}`,
      role: "img",
      "aria-label": t2("chart.aria.bar")
    },
    /* @__PURE__ */ h("g", { transform: `translate(${PAD_L}, ${PAD_T})` }, /* @__PURE__ */ h(Axis, { ticks, max, width: barInner.w, height: barInner.h }), points.map((p, i) => {
      const x = slot * i + (slot - barW) / 2;
      const h1 = seg(p.stat.PROMPT_CACHE_HIT_TOKEN);
      const h2 = seg(p.stat.PROMPT_CACHE_MISS_TOKEN + p.stat.PROMPT_TOKEN);
      const h3 = seg(p.stat.RESPONSE_TOKEN);
      let bottom = barInner.h;
      const y3 = bottom -= h3;
      const y2 = bottom -= h2;
      const y1 = bottom -= h1;
      return /* @__PURE__ */ h("g", { key: `b-${p.key}`, className: hover === i ? "tlogs-bar is-active" : "tlogs-bar" }, /* @__PURE__ */ h("rect", { className: "tlogs-fill-c3", x: r2(x), y: r2(y3), width: r2(barW), height: r2(h3) }), /* @__PURE__ */ h("rect", { className: "tlogs-fill-c2", x: r2(x), y: r2(y2), width: r2(barW), height: r2(h2) }), /* @__PURE__ */ h("rect", { className: "tlogs-fill-c1", x: r2(x), y: r2(y1), width: r2(barW), height: r2(h1) }), /* @__PURE__ */ h(
        "rect",
        {
          className: "tlogs-hit",
          x: r2(slot * i),
          y: 0,
          width: r2(slot),
          height: barInner.h,
          onMouseEnter: () => setHover(i),
          onMouseLeave: () => setHover((cur) => cur === i ? null : cur),
          "data-key": p.key
        }
      ));
    }), reqLine ? /* @__PURE__ */ h("path", { className: "tlogs-reqline", d: reqLine }) : null, points.map(
      (p, i) => labelIndices(points.length, 9).has(i) ? /* @__PURE__ */ h(
        "text",
        {
          key: `bx-${p.key}`,
          className: "tlogs-axis-text",
          x: r2(centers[i]),
          y: barInner.h + 16,
          textAnchor: "middle"
        },
        p.label
      ) : null
    ))
  ), /* @__PURE__ */ h(Summary, { values: totals, unit: "tokens" }), /* @__PURE__ */ h(
    InfoBar,
    {
      point: active,
      unit: "tokens",
      hint: t2("chart.hint.bar")
    }
  ));
}
function DonutChart(props) {
  const { slices, centerLabel, centerValue, unit, emptyText } = props;
  const t2 = useT();
  const [hover, setHover] = React6.useState(null);
  if (slices.length === 0) {
    return /* @__PURE__ */ h("div", { className: "tlogs-empty" }, emptyText ?? t2("chart.empty.composition"));
  }
  const total = slices.reduce((s, x) => s + x.value, 0);
  const c = 2 * Math.PI * DONUT_R;
  let before = 0;
  const active = hover === null ? null : slices[hover] ?? null;
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "tlogs-donut-wrap" }, /* @__PURE__ */ h(
    "svg",
    {
      className: "tlogs-donut",
      viewBox: `0 0 ${DONUT} ${DONUT}`,
      role: "img",
      "aria-label": t2("chart.aria.donut")
    },
    /* @__PURE__ */ h("g", { transform: `rotate(-90 ${DONUT / 2} ${DONUT / 2})` }, slices.map((s, i) => {
      const len = s.value / total * c;
      const el = /* @__PURE__ */ h(
        "circle",
        {
          key: s.key,
          className: `tlogs-donut-seg tlogs-stroke-c${s.colorIndex % 6 + 1}${hover === i ? " is-active" : ""}`,
          cx: DONUT / 2,
          cy: DONUT / 2,
          r: DONUT_R,
          fill: "none",
          strokeWidth: hover === i ? DONUT_W + 5 : DONUT_W,
          strokeDasharray: `${r2(len)} ${r2(c - len)}`,
          strokeDashoffset: r2(-before),
          onMouseEnter: () => setHover(i),
          onMouseLeave: () => setHover((cur) => cur === i ? null : cur),
          "data-key": s.key
        }
      );
      before += len;
      return el;
    })),
    /* @__PURE__ */ h(
      "text",
      {
        className: "tlogs-donut-center",
        x: DONUT / 2,
        y: DONUT / 2 - 2,
        textAnchor: "middle"
      },
      active ? `${(active.percent * 100).toFixed(1)}%` : centerValue
    ),
    /* @__PURE__ */ h(
      "text",
      {
        className: "tlogs-donut-sub",
        x: DONUT / 2,
        y: DONUT / 2 + 14,
        textAnchor: "middle"
      },
      active ? active.label : centerLabel
    )
  ), /* @__PURE__ */ h("ul", { className: "tlogs-donut-legend" }, slices.map((s, i) => /* @__PURE__ */ h(
    "li",
    {
      key: s.key,
      className: hover === i ? "tlogs-legend-row is-active" : "tlogs-legend-row",
      onMouseEnter: () => setHover(i),
      onMouseLeave: () => setHover((cur) => cur === i ? null : cur),
      title: `${s.label} \xB7 ${formatFull(s.value)}${metricSuffix(unit, t2)}`
    },
    /* @__PURE__ */ h("i", { className: `tlogs-swatch tlogs-swatch-c${s.colorIndex % 6 + 1}` }),
    /* @__PURE__ */ h("span", { className: "tlogs-legend-name" }, s.label),
    /* @__PURE__ */ h("span", { className: "tlogs-legend-value" }, formatShort(s.value)),
    /* @__PURE__ */ h("span", { className: "tlogs-legend-pct" }, (s.percent * 100).toFixed(1), "%")
  )))), /* @__PURE__ */ h(InfoBar, { point: null, unit, hint: t2("chart.hint.donut") }));
}
function maxOfArray(values) {
  let max = 0;
  for (const v of values) if (Number.isFinite(v) && v > max) max = v;
  return max;
}
function r2(n) {
  return Math.round(n * 100) / 100;
}

// src/client/chart-panel.tsx
var RANGES = [
  { id: "all", labelKey: "chart.range.all" },
  { id: "custom", labelKey: "chart.range.custom" },
  { id: "today", labelKey: "chart.range.today" },
  { id: "week", labelKey: "chart.range.week" },
  { id: "month", labelKey: "chart.range.month" },
  // The same two rolling windows the console offers as its time dimension, so the user can
  // compare a curve one to one against the console.
  { id: "last7", labelKey: "chart.range.last7" },
  { id: "last30", labelKey: "chart.range.last30" }
];
var PIE_DIMS = [
  { id: "model", labelKey: "chart.dim.model" },
  { id: "composition", labelKey: "chart.dim.composition" },
  { id: "project", labelKey: "chart.dim.project" }
];
var KINDS = [
  { id: "line", labelKey: "chart.kind.line" },
  { id: "pie", labelKey: "chart.kind.pie" },
  { id: "bar", labelKey: "chart.kind.bar" }
];
function todayKey() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgoKey(n) {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function zeroStat2() {
  return {
    PROMPT_TOKEN: 0,
    PROMPT_CACHE_HIT_TOKEN: 0,
    PROMPT_CACHE_MISS_TOKEN: 0,
    RESPONSE_TOKEN: 0,
    REQUEST: 0
  };
}
function zeroMoney() {
  return zeroStat2();
}
function priorValue(stat, cost, metric) {
  return metric === "cost" ? cost ?? 0 : metricValue(stat, metric);
}
function sumStats(list) {
  const acc = zeroStat2();
  for (const s of list) {
    acc.PROMPT_TOKEN += s.PROMPT_TOKEN;
    acc.PROMPT_CACHE_HIT_TOKEN += s.PROMPT_CACHE_HIT_TOKEN;
    acc.PROMPT_CACHE_MISS_TOKEN += s.PROMPT_CACHE_MISS_TOKEN;
    acc.RESPONSE_TOKEN += s.RESPONSE_TOKEN;
    acc.REQUEST += s.REQUEST;
  }
  return acc;
}
function ChartPanel(props) {
  const { series, loading, error, onLoad } = props;
  const t2 = useT();
  const [range, setRange] = React7.useState("all");
  const [from, setFrom] = React7.useState("");
  const [to, setTo] = React7.useState("");
  const [projectId, setProjectId] = React7.useState("");
  const [metric, setMetric] = React7.useState("total");
  const [grain, setGrain] = React7.useState("auto");
  const [mode, setMode] = React7.useState("perBucket");
  const [pieDim, setPieDim] = React7.useState("model");
  const [kind, setKind] = React7.useState("line");
  const lastSig = React7.useRef("");
  React7.useEffect(() => {
    if (range === "custom" && (!from || !to)) return;
    const query = { range };
    if (range === "custom") {
      query.from = from;
      query.to = to;
    }
    if (projectId) query.projectId = projectId;
    const sig = JSON.stringify(query);
    if (lastSig.current === sig) return;
    lastSig.current = sig;
    onLoad(query);
  }, [range, from, to, projectId, onLoad]);
  const projectSource = projectId !== "";
  const selectedProject = series?.projects.find((p) => p.id === projectId);
  React7.useEffect(() => {
    if (!projectId || !series) return;
    if (series.projects.length === 0) return;
    if (series.projects.some((p) => p.id === projectId)) return;
    setProjectId("");
  }, [projectId, series]);
  const resolvedGrain = series ? resolveGrain(grain, series.from, series.to) : "day";
  const buckets = React7.useMemo(() => {
    if (!series) return [];
    if (projectSource) {
      const points2 = series.project?.points ?? [];
      return projectBuckets(points2, series.project?.prior?.stat, mode);
    }
    if (resolvedGrain === "day") return dayBuckets(series.days, series.from, series.to);
    if (resolvedGrain === "year") return yearBuckets(series.months);
    return monthBuckets(series.months);
  }, [series, projectSource, resolvedGrain, mode]);
  const values = React7.useMemo(() => {
    if (projectSource) return buckets.map((b) => bucketMetricValue(b, metric));
    const prior = mode === "cumulative" && series ? priorValue(series.prior, series.priorCost, metric) : 0;
    return bucketValues(buckets, metric, mode, prior);
  }, [buckets, metric, mode, projectSource, series]);
  const points = React7.useMemo(() => toPoints(buckets, values), [buckets, values]);
  const metricDef = METRICS.find((m) => m.id === metric);
  const unit = metricDef.unit;
  const rangeStat = React7.useMemo(
    () => series ? sumStats(series.months.map((m) => m.stat)) : zeroStat2(),
    [series]
  );
  const rangeCost = React7.useMemo(
    () => series ? series.months.reduce((s, m) => s + (m.cost ?? 0), 0) : 0,
    [series]
  );
  const rangeMoney = series?.costByType ?? zeroMoney();
  const effectiveDim = projectSource && pieDim === "model" ? "composition" : pieDim;
  const dims = projectSource ? PIE_DIMS.filter((d) => d.id !== "model") : PIE_DIMS;
  const pieItems = React7.useMemo(() => {
    if (!series) return [];
    if (effectiveDim === "model") {
      return series.models.map((m) => ({
        key: m.key,
        label: m.key,
        // Model money exists as a total only (`SeriesPoint.cost`); there is no five-way split.
        value: metric === "cost" ? m.cost ?? 0 : metricValue(m.stat, metric)
      }));
    }
    if (effectiveDim === "project") {
      if (metric === "cost") return [];
      return series.projects.map((p) => ({ key: p.id, label: p.label, value: metricValue(p.stat, metric) }));
    }
    if (metric === "cost") {
      return [
        { key: "hit", label: t2("chart.legend.hit"), value: rangeMoney.PROMPT_CACHE_HIT_TOKEN },
        {
          key: "miss",
          label: t2("chart.legend.miss"),
          value: rangeMoney.PROMPT_CACHE_MISS_TOKEN + rangeMoney.PROMPT_TOKEN
        },
        { key: "out", label: t2("stat.output"), value: rangeMoney.RESPONSE_TOKEN }
      ];
    }
    const s = projectSource ? sumStats((series.project?.points ?? []).map((p) => p.stat)) : rangeStat;
    return [
      { key: "hit", label: t2("chart.legend.hit"), value: s.PROMPT_CACHE_HIT_TOKEN },
      { key: "miss", label: t2("chart.legend.miss"), value: s.PROMPT_CACHE_MISS_TOKEN + s.PROMPT_TOKEN },
      { key: "out", label: t2("stat.output"), value: s.RESPONSE_TOKEN }
    ];
  }, [series, effectiveDim, metric, projectSource, rangeStat, rangeMoney, t2]);
  const slices = React7.useMemo(() => pieSlices(pieItems, 8, t2("chart.other")), [pieItems, t2]);
  const pickRange = (r) => {
    if (r === "custom" && (!from || !to)) {
      setFrom(series?.from ?? daysAgoKey(30));
      setTo(series?.to ?? todayKey());
    }
    setRange(r);
  };
  const projectPoints = series?.project?.points.length ?? 0;
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "tlogs-subtabs" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-group", role: "group", "aria-label": t2("chart.aria.kind") }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, t2("chart.label.kind")), KINDS.map((k) => /* @__PURE__ */ h(
    "button",
    {
      key: k.id,
      type: "button",
      className: k.id === kind ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => setKind(k.id),
      "aria-pressed": k.id === kind,
      "data-kind": k.id
    },
    t2(k.labelKey)
  ))), /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, kind === "pie" ? /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, t2("chart.label.composition")), dims.map((d) => /* @__PURE__ */ h(
    "button",
    {
      key: d.id,
      type: "button",
      className: d.id === effectiveDim ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => setPieDim(d.id),
      "aria-pressed": d.id === effectiveDim
    },
    t2(d.labelKey)
  ))) : null)), /* @__PURE__ */ h("div", { className: "tlogs-chart-controls" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-group", role: "group", "aria-label": t2("chart.aria.range") }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, t2("chart.label.range")), RANGES.map((r) => /* @__PURE__ */ h(
    "button",
    {
      key: r.id,
      type: "button",
      className: r.id === range ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => pickRange(r.id),
      "aria-pressed": r.id === range
    },
    t2(r.labelKey)
  ))), /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, t2("chart.label.source")), /* @__PURE__ */ h(
    "select",
    {
      className: "tlogs-input tlogs-chart-select",
      value: projectId,
      onChange: (e) => setProjectId(e.target.value),
      "aria-label": t2("chart.aria.source")
    },
    /* @__PURE__ */ h("option", { value: "" }, t2("chart.source.platform")),
    (series?.projects ?? []).map((p) => /* @__PURE__ */ h("option", { key: p.id, value: p.id }, p.label))
  ))), /* @__PURE__ */ h("div", { className: "tlogs-chart-controls" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, t2("chart.label.metric")), /* @__PURE__ */ h(
    "select",
    {
      className: "tlogs-input tlogs-chart-select",
      value: metric,
      onChange: (e) => setMetric(e.target.value),
      "aria-label": t2("chart.aria.metric")
    },
    METRICS.map((m) => /* @__PURE__ */ h("option", { key: m.id, value: m.id }, t2(m.labelKey)))
  )), /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, t2("chart.label.grain")), /* @__PURE__ */ h(
    "select",
    {
      className: "tlogs-input tlogs-chart-select",
      value: grain,
      onChange: (e) => setGrain(e.target.value),
      "aria-label": t2("chart.aria.grain"),
      disabled: projectSource
    },
    GRAINS.map((g) => /* @__PURE__ */ h("option", { key: g.id, value: g.id }, t2(g.labelKey)))
  )), /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, t2("chart.label.basis")), /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: mode === "perBucket" ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => setMode("perBucket"),
      "aria-pressed": mode === "perBucket"
    },
    t2("chart.mode.perBucket")
  ), /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: mode === "cumulative" ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => setMode("cumulative"),
      "aria-pressed": mode === "cumulative"
    },
    t2("chart.mode.cumulative")
  ))), range === "custom" ? /* @__PURE__ */ h("div", { className: "tlogs-chart-controls" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, t2("chart.label.from")), /* @__PURE__ */ h(
    "input",
    {
      type: "date",
      className: "tlogs-input tlogs-chart-date",
      value: from,
      max: to || todayKey(),
      onChange: (e) => setFrom(e.target.value),
      "aria-label": t2("chart.aria.from")
    }
  ), /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, t2("chart.label.to")), /* @__PURE__ */ h(
    "input",
    {
      type: "date",
      className: "tlogs-input tlogs-chart-date",
      value: to,
      min: from || void 0,
      max: todayKey(),
      onChange: (e) => setTo(e.target.value),
      "aria-label": t2("chart.aria.to")
    }
  ))) : null, series ? /* @__PURE__ */ h("div", { className: "tlogs-chart-scope" }, /* @__PURE__ */ h("span", { className: "tlogs-chart-scope-range" }, series.from, " ~ ", series.to), /* @__PURE__ */ h(
    "span",
    {
      className: "tlogs-metric",
      title: metric === "cost" ? `${formatMoneyFull(rangeCost)}${t2("chart.unit.money")}` : formatFull(metricValue(rangeStat, metric))
    },
    /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, t2("chart.rangeTotal")),
    /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, metric === "cost" ? formatMoneyShort(rangeCost) : formatShort(metricValue(rangeStat, metric)), metricSuffix(unit, t2))
  ), /* @__PURE__ */ h("span", { className: "tlogs-metric" }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, t2("stat.requests")), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, formatFull(rangeStat.REQUEST), t2("chart.unit.requests"))), metric === "cost" && series.costPartial ? /* @__PURE__ */ h("span", { className: "tlogs-chart-scope-note" }, t2("chart.costPartial")) : null, /* @__PURE__ */ h("span", { className: "tlogs-chart-scope-note" }, projectSource ? t2("chart.scope.snapshots", { n: projectPoints }) : t2(
    resolvedGrain === "day" ? "chart.scope.bucketsDay" : resolvedGrain === "month" ? "chart.scope.bucketsMonth" : "chart.scope.bucketsYear",
    { n: buckets.length }
  )), loading ? /* @__PURE__ */ h("span", { className: "tlogs-chart-busy" }, t2("chart.updating")) : null) : null, error ? /* @__PURE__ */ h("div", { className: "tlogs-error" }, error) : null, !series ? /* @__PURE__ */ h("div", { className: "tlogs-empty" }, loading ? t2("common.loading") : t2("chart.noData")) : /* @__PURE__ */ h(Fragment2, null, series.partial && !projectSource ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, t2("chart.partialNote.lead"), /* @__PURE__ */ h("b", null, t2("chart.partialNote.bold")), t2("chart.partialNote.tail")) : null, projectSource && projectPoints < 2 ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, t2("chart.projectSnapshots", { n: projectPoints })) : null, /* @__PURE__ */ h("div", { className: "tlogs-chart-stage" }, kind === "line" ? /* @__PURE__ */ h("div", { className: "tlogs-chart-card" }, /* @__PURE__ */ h("div", { className: "tlogs-chart-head" }, /* @__PURE__ */ h("span", { className: "tlogs-chart-title" }, t2("chart.title.line"), /* @__PURE__ */ h("span", { className: "tlogs-chart-sub" }, t2(metricDef.labelKey), mode === "cumulative" ? t2("chart.sub.cumulative") : t2("chart.sub.perBucket")))), /* @__PURE__ */ h(LineChart, { points, unit, cumulative: mode === "cumulative" })) : kind === "pie" ? /* @__PURE__ */ h("div", { className: "tlogs-chart-card" }, /* @__PURE__ */ h("div", { className: "tlogs-chart-head" }, /* @__PURE__ */ h("span", { className: "tlogs-chart-title" }, t2("chart.title.pie"), /* @__PURE__ */ h("span", { className: "tlogs-chart-sub" }, effectiveDim === "model" ? t2("chart.dim.model") : effectiveDim === "project" ? t2("chart.dim.project") : t2("chart.sub.composition")))), /* @__PURE__ */ h(
    DonutChart,
    {
      slices,
      centerLabel: effectiveDim === "model" ? t2("chart.dim.model") : effectiveDim === "project" ? t2("chart.dim.project") : projectSource ? selectedProject?.label ?? t2("chart.selectedProject") : t2("chart.rangeTotal"),
      centerValue: metric === "cost" ? formatMoneyShort(slices.reduce((s, x) => s + x.value, 0)) : formatShort(slices.reduce((s, x) => s + x.value, 0)),
      unit,
      emptyText: effectiveDim === "project" ? metric === "cost" ? t2("chart.empty.projectCost") : t2("chart.empty.project") : t2("chart.empty.composition")
    }
  )) : /* @__PURE__ */ h("div", { className: "tlogs-chart-card" }, /* @__PURE__ */ h("div", { className: "tlogs-chart-head" }, /* @__PURE__ */ h("span", { className: "tlogs-chart-title" }, t2("chart.title.bar"), /* @__PURE__ */ h("span", { className: "tlogs-chart-sub" }, t2("chart.sub.bar")))), /* @__PURE__ */ h(StackedBarChart, { points })))));
}

// src/client/settings-panel.tsx
var React8 = require("react");
var OPTION_KEY = {
  auto: "settings.option.auto",
  zh: "settings.option.zh",
  en: "settings.option.en"
};
function SettingsPanel() {
  const { pref: pref2, setPref } = useLangState();
  const t2 = useT();
  return /* @__PURE__ */ h("div", { className: "tlogs-settings" }, /* @__PURE__ */ h("div", { className: "tlogs-settings-title" }, t2("settings.title")), /* @__PURE__ */ h("div", { className: "tlogs-settings-options", role: "radiogroup", "aria-label": t2("settings.title") }, LANG_PREFS.map((id) => /* @__PURE__ */ h(
    "label",
    {
      key: id,
      className: id === pref2 ? "tlogs-settings-option is-selected" : "tlogs-settings-option"
    },
    /* @__PURE__ */ h(
      "input",
      {
        type: "radio",
        className: "tlogs-settings-radio",
        name: "tlogs-lang",
        value: id,
        checked: id === pref2,
        onChange: () => setPref(id)
      }
    ),
    /* @__PURE__ */ h("span", null, t2(OPTION_KEY[id]))
  ))));
}

// src/client/detail-modal.tsx
var TABS = [
  { id: "calendar", labelKey: "tab.calendar" },
  { id: "charts", labelKey: "tab.charts" },
  { id: "models", labelKey: "tab.models" },
  { id: "providers", labelKey: "tab.providers" },
  { id: "years", labelKey: "tab.years" },
  { id: "months", labelKey: "tab.months" },
  { id: "days", labelKey: "tab.days" },
  { id: "settings", labelKey: "tab.settings" }
];
var WEEKDAY_KEYS = [
  "weekday.1",
  "weekday.2",
  "weekday.3",
  "weekday.4",
  "weekday.5",
  "weekday.6",
  "weekday.7"
];
var pad2 = (n) => String(n).padStart(2, "0");
var ymKey = (y, m) => `${y}-${pad2(m)}`;
function parseYm(key) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(key);
  if (!m) return void 0;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return void 0;
  return { year, month };
}
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function leadingBlanks(year, month) {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (dow + 6) % 7;
}
var ZERO_COUNTERS = { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0 };
function statLine(stat, t2) {
  const out = [
    { key: "stat.input", label: t2("stat.input"), text: formatNumber(stat.inputTokens, "short"), full: formatFull(stat.inputTokens) },
    { key: "stat.output", label: t2("stat.output"), text: formatNumber(stat.outputTokens, "short"), full: formatFull(stat.outputTokens) },
    { key: "stat.totalTokens", label: t2("stat.totalTokens"), text: formatNumber(stat.totalTokens, "short"), full: formatFull(stat.totalTokens) },
    { key: "stat.requests", label: t2("stat.requests"), text: formatNumber(stat.requests, "short"), full: formatFull(stat.requests) }
  ];
  if (stat.cost) {
    const m = moneyTotal(stat.cost);
    out.push({
      key: "stat.cost",
      label: t2("stat.cost"),
      text: formatMoneyShort(m),
      full: formatMoneyFull(m)
    });
  }
  return out;
}
function Calendar(props) {
  const { months, monthDetail, onSelectMonth } = props;
  const t2 = useT();
  const sorted = React9.useMemo(
    () => [...months].sort((a, b) => a.key.localeCompare(b.key)),
    [months]
  );
  const [sel, setSel] = React9.useState(null);
  const [selectedDate, setSelectedDate] = React9.useState(null);
  React9.useEffect(() => {
    if (sel || sorted.length === 0) return;
    const last = sorted[sorted.length - 1];
    const ym = parseYm(last.key);
    if (!ym) return;
    setSel(ym);
    onSelectMonth(ym.year, ym.month);
  }, [sorted, sel, onSelectMonth]);
  if (sorted.length === 0) return /* @__PURE__ */ h("div", { className: "tlogs-empty" }, t2("common.noData"));
  const pick = (ym) => {
    setSel(ym);
    setSelectedDate(null);
    onSelectMonth(ym.year, ym.month);
  };
  const idx = sel ? sorted.findIndex((r) => r.key === ymKey(sel.year, sel.month)) : -1;
  const step = (delta) => {
    if (idx < 0) return;
    const next = sorted[idx + delta];
    if (!next) return;
    const ym = parseYm(next.key);
    if (ym) pick(ym);
  };
  const current = sel ?? (() => {
    const ym = parseYm(sorted[sorted.length - 1].key);
    return ym ?? { year: 0, month: 0 };
  })();
  const byDate = /* @__PURE__ */ new Map();
  for (const d of monthDetail?.days ?? []) byDate.set(d.key, d.stat);
  const maxDay = Math.max(1, ...[...byDate.values()].map((s) => s.totalTokens));
  const maxCost = Math.max(0, ...[...byDate.values()].map((s) => s.cost ? moneyTotal(s.cost) : 0));
  const hasCost = maxCost > 0;
  const total = daysInMonth(current.year, current.month);
  const blanks = leadingBlanks(current.year, current.month);
  const CAL_CELLS = 42;
  const cells = [];
  for (let i = 0; i < blanks; i++) {
    cells.push(/* @__PURE__ */ h("div", { key: `blank-${i}`, className: "tlogs-cal-cell is-empty" }));
  }
  for (let day = 1; day <= total; day++) {
    const date = `${ymKey(current.year, current.month)}-${pad2(day)}`;
    const stat = byDate.get(date);
    const value = stat?.totalTokens ?? 0;
    const heatToken = stat ? value / maxDay : 0;
    const dayCost = stat?.cost ? moneyTotal(stat.cost) : 0;
    const heatCost = maxCost > 0 ? dayCost / maxCost : 0;
    const heat = stat ? Math.round(Math.max(heatToken, heatCost) * 55) : 0;
    const title = stat ? t2("cal.cell", {
      date,
      tokens: formatFull(value),
      requests: formatFull(stat.requests),
      cost: stat.cost ? t2("cal.cellCost", { money: formatMoneyFull(dayCost) }) : ""
    }) : t2("cal.cellNoData", { date });
    cells.push(
      /* @__PURE__ */ h(
        "button",
        {
          key: date,
          type: "button",
          className: selectedDate === date ? "tlogs-cal-cell is-selected" : "tlogs-cal-cell",
          style: heat > 0 ? { background: `color-mix(in srgb, var(--tlogs-accent) ${heat}%, transparent)` } : void 0,
          title,
          onClick: () => setSelectedDate(date),
          "data-date": date
        },
        /* @__PURE__ */ h("span", { className: "tlogs-cal-day" }, day),
        /* @__PURE__ */ h("span", { className: "tlogs-cal-val" }, stat ? formatNumber(value, "short") : "\u2014"),
        /* @__PURE__ */ h("span", { className: "tlogs-cal-money" }, stat?.cost && hasCost ? formatMoneyShort(moneyTotal(stat.cost)) : "")
      )
    );
  }
  for (let i = cells.length; i < CAL_CELLS; i++) {
    cells.push(/* @__PURE__ */ h("div", { key: `tail-${i}`, className: "tlogs-cal-cell is-empty" }));
  }
  const selected = selectedDate ? byDate.get(selectedDate) : void 0;
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "tlogs-cal-nav" }, /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "tlogs-btn",
      onClick: () => step(-1),
      disabled: idx <= 0,
      "aria-label": t2("cal.prevMonth")
    },
    "\u2039"
  ), /* @__PURE__ */ h(
    "select",
    {
      className: "tlogs-input tlogs-cal-select",
      value: ymKey(current.year, current.month),
      onChange: (e) => {
        const ym = parseYm(e.target.value);
        if (ym) pick(ym);
      },
      "aria-label": t2("cal.selectMonth")
    },
    sorted.map((r) => /* @__PURE__ */ h("option", { key: r.key, value: r.key }, t2("cal.option", {
      key: r.key,
      tokens: formatNumber(r.stat.totalTokens, "short"),
      cost: r.stat.cost ? t2("cal.optionCost", { money: formatMoneyShort(moneyTotal(r.stat.cost)) }) : ""
    })))
  ), /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "tlogs-btn",
      onClick: () => step(1),
      disabled: idx < 0 || idx >= sorted.length - 1,
      "aria-label": t2("cal.nextMonth")
    },
    "\u203A"
  )), /* @__PURE__ */ h("div", { className: "tlogs-cal-summary" }, /* @__PURE__ */ h("span", { className: "tlogs-cal-summary-title" }, t2("cal.monthTotal", { month: ymKey(current.year, current.month) })), statLine(monthDetail?.stat ?? ZERO_COUNTERS, t2).map((s) => /* @__PURE__ */ h("span", { key: s.key, className: "tlogs-metric", title: s.full }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, s.label), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, s.text)))), byDate.size === 0 ? (
    // Fallback: say the daily detail is unavailable rather than render a grid of dashes.
    // The plugin normally backfills missing days (history.plan).
    /* @__PURE__ */ h("div", { className: "tlogs-empty" }, t2("cal.noDaily"))
  ) : /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "tlogs-cal", role: "grid" }, WEEKDAY_KEYS.map((w) => /* @__PURE__ */ h("div", { key: w, className: "tlogs-cal-head" }, t2(w))), cells), /* @__PURE__ */ h("div", { className: "tlogs-cal-detail" }, selectedDate && selected ? /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("span", { className: "tlogs-cal-summary-title" }, selectedDate), statLine(selected, t2).map((s) => /* @__PURE__ */ h("span", { key: s.key, className: "tlogs-metric", title: s.full }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, s.label), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, s.text)))) : /* @__PURE__ */ h("span", { className: "tlogs-hint" }, t2("cal.pickDay")))));
}
function DetailModal(props) {
  const { detail, monthDetail, series, seriesLoading, loading, busy, error, onClose, onRefresh, onSelectMonth, onLoadSeries } = props;
  const [tab, setTab] = React9.useState("calendar");
  const t2 = useT();
  React9.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return /* @__PURE__ */ h(
    "div",
    {
      className: "tlogs-modal-mask",
      role: "presentation",
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      }
    },
    /* @__PURE__ */ h("div", { className: "tlogs-modal", role: "dialog", "aria-modal": "true", "aria-label": t2("modal.label") }, /* @__PURE__ */ h("div", { className: "tlogs-modal-head" }, /* @__PURE__ */ h("span", { className: "tlogs-modal-title" }, t2("modal.title")), /* @__PURE__ */ h("span", { className: "tlogs-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? t2("common.refreshing") : t2("common.refresh")), /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "tlogs-btn",
        onClick: onClose,
        "aria-label": t2("modal.close"),
        title: t2("modal.closeTitle")
      },
      "\u2715"
    ))), /* @__PURE__ */ h("div", { className: "tlogs-modal-body" }, /* @__PURE__ */ h("div", { className: "tlogs-tabs", role: "tablist" }, TABS.map((item) => /* @__PURE__ */ h(
      "button",
      {
        key: item.id,
        type: "button",
        role: "tab",
        "aria-selected": item.id === tab,
        className: item.id === tab ? "tlogs-tab is-active" : "tlogs-tab",
        onClick: () => setTab(item.id)
      },
      t2(item.labelKey)
    ))), tab === "settings" ? (
      // Settings renders before the loading branch: the language switch must not be
      // blocked while usage is still loading.
      /* @__PURE__ */ h(SettingsPanel, null)
    ) : loading && !detail ? /* @__PURE__ */ h("div", { className: "tlogs-empty" }, t2("common.loading")) : tab === "calendar" ? /* @__PURE__ */ h(
      Calendar,
      {
        months: detail?.months ?? [],
        monthDetail,
        onSelectMonth
      }
    ) : tab === "charts" ? /* @__PURE__ */ h(
      ChartPanel,
      {
        series,
        loading: seriesLoading,
        error,
        onLoad: onLoadSeries
      }
    ) : tab === "providers" ? /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("div", { className: "tlogs-hint" }, detail?.localRange ? t2("providers.localRange", {
      source: detail.localRange.sourceLabel ? t2("providers.localRangeSource", { source: detail.localRange.sourceLabel }) : "",
      range: `${detail.localRange.from} ~ ${detail.localRange.to}`,
      days: detail.localRange.days,
      files: detail.localRange.files
    }) : t2("providers.unavailable", {
      reason: localReasonLabel(detail?.localUnavailable?.reason)
    }), t2("providers.coverage")), /* @__PURE__ */ h(
      StatTable,
      {
        rows: detail?.providers ?? [],
        emptyText: detail?.localUnavailable ? t2("providers.unavailableLong", {
          reason: localReasonLabel(detail.localUnavailable.reason)
        }) : t2("providers.empty")
      }
    )) : tab === "models" && detail?.modelsIncludeLocal ? /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("div", { className: "tlogs-hint" }, t2("providers.modelsNote")), /* @__PURE__ */ h(StatTable, { rows: detail?.models ?? [] })) : /* @__PURE__ */ h(
      StatTable,
      {
        rows: tab === "models" ? detail?.models ?? [] : tab === "years" ? detail?.years ?? [] : tab === "months" ? detail?.months ?? [] : monthDetail?.days ?? detail?.days ?? []
      }
    )))
  );
}

// src/client/store.ts
var React10 = __toESM(require("react"), 1);

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
    const err = new Error(t("error.noConnection"));
    err.code = "no-connection";
    throw err;
  }
  const res = await rpc.call(endpoint, payload ?? {});
  if (!res?.ok) {
    const err = new Error(res?.error?.message ?? t("error.rpcFailed", { endpoint }));
    err.code = res?.error?.code;
    throw err;
  }
  return res.value;
}

// src/client/store.ts
var POLL_MS = 800;
var MAX_POLLS = 300;
var IDLE_RELOAD_MS = 6e4;
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function messageOf(e) {
  return e instanceof Error ? e.message : String(e);
}
function useTlogs(rpc, initialReason = "mount") {
  const [snapshot, setSnapshot] = React10.useState(null);
  const [detail, setDetail] = React10.useState(null);
  const [monthDetail, setMonthDetail] = React10.useState(null);
  const [series, setSeries] = React10.useState(null);
  const [seriesLoading, setSeriesLoading] = React10.useState(false);
  const [error, setError] = React10.useState(null);
  const [busy, setBusy] = React10.useState(false);
  const alive = React10.useRef(true);
  const inflight = React10.useRef(false);
  const started = React10.useRef(false);
  const seriesSeq = React10.useRef(0);
  const lastSeriesQuery = React10.useRef(null);
  React10.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const reload = React10.useCallback(async () => {
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
  const refresh = React10.useCallback(
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
  React10.useEffect(() => {
    if (started.current) return;
    started.current = true;
    void refresh(false);
  }, [refresh]);
  const loadDetail = React10.useCallback(async () => {
    try {
      const d = await callRpc(rpc, RPC.detail);
      if (alive.current) setDetail(d);
    } catch (e) {
      if (alive.current) setError(messageOf(e));
    }
  }, [rpc]);
  const loadMonth = React10.useCallback(
    async (year, month) => {
      try {
        const d = await callRpc(rpc, RPC.month, { year, month });
        if (alive.current) setMonthDetail(d);
      } catch (e) {
        if (alive.current) setError(messageOf(e));
      }
    },
    [rpc]
  );
  const loadSeries = React10.useCallback(
    async (query) => {
      lastSeriesQuery.current = query;
      const seq = ++seriesSeq.current;
      if (alive.current) setSeriesLoading(true);
      try {
        const s = await callRpc(rpc, RPC.series, query);
        if (alive.current && seq === seriesSeq.current) {
          setSeries(s);
          setError(null);
        }
      } catch (e) {
        if (alive.current && seq === seriesSeq.current) setError(messageOf(e));
      } finally {
        if (alive.current && seq === seriesSeq.current) setSeriesLoading(false);
      }
    },
    [rpc]
  );
  const reloadSeries = React10.useCallback(async () => {
    const q = lastSeriesQuery.current;
    if (!q) return;
    await loadSeries(q);
  }, [loadSeries]);
  React10.useEffect(() => {
    const timer = setInterval(() => {
      void reload();
      void reloadSeries();
    }, IDLE_RELOAD_MS);
    return () => clearInterval(timer);
  }, [reload, reloadSeries]);
  const setToken = React10.useCallback(
    async (token) => {
      try {
        const r = await callRpc(rpc, RPC.setToken, { token });
        if (r.ok) await refresh(true);
        else if (alive.current) setError(r.error ?? t("error.saveFailed"));
        return r.ok;
      } catch (e) {
        if (alive.current) setError(messageOf(e));
        return false;
      }
    },
    [rpc, refresh]
  );
  const logout = React10.useCallback(async () => {
    try {
      await callRpc(rpc, RPC.logout);
      if (alive.current) {
        setDetail(null);
        setSeries(null);
        lastSeriesQuery.current = null;
        await reload();
      }
    } catch (e) {
      if (alive.current) setError(messageOf(e));
    }
  }, [rpc, reload]);
  const login = React10.useCallback(async () => {
    try {
      const r = await callRpc(rpc, RPC.login);
      if (r.ok) await refresh(true);
      else if (alive.current) setError(r.error ?? t("error.loginFailed"));
      return r.ok;
    } catch (e) {
      if (alive.current) setError(messageOf(e));
      return false;
    }
  }, [rpc, refresh]);
  void initialReason;
  return {
    snapshot,
    detail,
    monthDetail,
    series,
    seriesLoading,
    error,
    busy,
    reload,
    refresh,
    loadDetail,
    loadMonth,
    loadSeries,
    reloadSeries,
    setToken,
    logout,
    login
  };
}

// src/client/footer.tsx
function TlogsFooter(props) {
  const { wide = true, rpc, defaultExpanded = false } = props;
  const store = useTlogs(rpc, "mount");
  const [view, setView] = React11.useState(defaultExpanded ? "expanded" : "compact");
  const [detailOpen, setDetailOpen] = React11.useState(false);
  const userToggled = React11.useRef(false);
  const defaultApplied = React11.useRef(false);
  React11.useEffect(() => {
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
    setDetailOpen(true);
    void store.loadDetail();
  };
  const toggle = () => {
    userToggled.current = true;
    if (view === "compact") {
      setView("expanded");
      void store.refresh(false);
    } else {
      setView("compact");
    }
  };
  const refresh = () => {
    void store.refresh(true);
    if (detailOpen) {
      void store.loadDetail();
      void store.reloadSeries();
    }
  };
  return /* @__PURE__ */ h("div", { className: wide ? "tlogs tlogs-w-full" : "tlogs" }, /* @__PURE__ */ h(
    CompactBar,
    {
      snapshot: store.snapshot,
      numberFormat,
      wide,
      expanded: view !== "compact",
      busy: store.busy,
      onToggle: toggle,
      onRefresh: refresh
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
  ) : null, detailOpen ? /* @__PURE__ */ h(
    DetailModal,
    {
      detail: store.detail,
      monthDetail: store.monthDetail,
      series: store.series,
      seriesLoading: store.seriesLoading,
      loading: store.busy,
      busy: store.busy,
      error: store.error,
      onClose: () => setDetailOpen(false),
      onRefresh: refresh,
      onSelectMonth: (year, month) => void store.loadMonth(year, month),
      onLoadSeries: (q) => void store.loadSeries(q)
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
        // Business share: non-slot props injected into the component. Display
        // config arrives through the host's snapshot.display, since the client
        // cannot read the plugin's own cordis config.
        inject: () => ({ rpc })
      },
      TlogsFooter
    )
  );
}
return module.exports; } });
//# sourceMappingURL=client.js.map
