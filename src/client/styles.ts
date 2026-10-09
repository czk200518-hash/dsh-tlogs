/**
 * tlogs — component stylesheet.
 *
 * The compact bar and the expanded panel stay in the sidebar footer's document flow, so neither
 * uses position: fixed/absolute; the detail modal is the one deliberate exception. Colours come
 * from DSH theme tokens (the dark theme flips them through `body[data-ds-dark-theme]`) and every
 * token is read as `var(--token, fallback)`, so a missing host token still renders readable text.
 */

export const STYLE_ID = 'tlogs-style'
export const PLUGIN_ID = 'tlogs'

export const CSS = `
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
     ¥ from the token counts next to it. */
  --tlogs-money: var(--dsw-alias-state-warn-primary, #c2740a);
  --tlogs-radius: var(--dsw-radius-xs, 4px);
  --tlogs-gap: 6px;

  /* Chart palette: c1–c3 are the three stacked segments (cache hit / cache miss / output), c4–c6
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
/* Money on the bar: same size as the token counts, told apart by colour, ¥ kept. */
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
/* Kept for a real alert state; the daily settlement lag (10–30 min) is normal, so a
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

/* Expanded panel — opens in place and pushes the content above it up. */
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

/* Main number row: token total left, money right. The money never shrinks — squeezed into
   "¥1…" it is worse than not showing it at all. */
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
/* The name column must not be truncated: real "provider · model" strings do not fit in 9em, so it
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

/* Detail modal — the only place in this file that uses position: fixed. A modal is a layer
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
   tabs never resizes the dialog and nothing inside may be sized by its content — the calendar grid
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
 * and the money row renders unconditionally, empty when there is no data — on demand the height
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

/* Charts (the modal's chart tab) — inline SVG only. Geometry lives in chart-utils.ts; this file
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
`

/**
 * Inject the stylesheet and return the uninstall function. Same convention as the official ui-theme
 * `installThemeStyles`: tag the node with data-plugin / data-plugin-css and remove it on uninstall,
 * so the plugin leaves no DOM behind.
 */
export function installStyles(doc: Document = document): () => void {
  const existing = doc.getElementById(STYLE_ID)
  if (existing) return () => {}
  const el = doc.createElement('style')
  el.id = STYLE_ID
  el.dataset.plugin = PLUGIN_ID
  el.dataset.pluginCss = `${PLUGIN_ID}/styles.css`
  el.textContent = CSS
  doc.head.appendChild(el)
  return () => {
    el.remove()
  }
}
