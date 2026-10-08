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
  /*
   * \u91D1\u989D\u4E13\u7528\u8272\u3002
   *
   * \u4E3A\u4EC0\u4E48\u4E0D\u590D\u7528\u300C\u6210\u529F\u7EFF\u300D\uFF1A\u91D1\u989D\u662F**\u4E2D\u6027\u8BA1\u91CF**\uFF0C\u4E0D\u662F\u72B6\u6001\u3002\u7528\u7EFF\u8272\u4F1A\u8BA9\u4EBA\u4EE5\u4E3A
   * \u300C\u82B1\u5F97\u591A = \u597D\u300D\uFF0C\u800C\u8FD9\u91CC\u53EA\u662F\u628A \xA5 \u4E0E\u65C1\u8FB9\u7684 token \u6570\u5728\u89C6\u89C9\u4E0A\u5206\u5F00\u3002
   * \u9009\u4E00\u4E2A\u5728\u6D45\u8272/\u6DF1\u8272\u4E3B\u9898\u4E0B\u90FD\u6709\u8DB3\u591F\u5BF9\u6BD4\u5EA6\u7684\u7425\u73C0\u8272\u4F5C\u4E3A\u4E3B\u8272\u3002
   */
  --tlogs-money: var(--dsw-alias-state-warn-primary, #c2740a);
  --tlogs-radius: var(--dsw-radius-xs, 4px);
  --tlogs-gap: 6px;

  /*
   * \u56FE\u8868\u914D\u8272\u3002
   *
   * \u524D\u4E09\u4E2A\u662F\u5806\u53E0\u67F1\u7684\u4E09\u6BB5\uFF08\u8F93\u5165\xB7\u7F13\u5B58\u547D\u4E2D / \u8F93\u5165\xB7\u7F13\u5B58\u672A\u547D\u4E2D / \u8F93\u51FA\uFF09\uFF1B\u540E\u4E09\u4E2A\u662F\u997C\u56FE\u7684
   * \u5907\u7528\u8272\u3002\u523B\u610F\u9009\u5728\u6D45\u8272\u4E0E\u6DF1\u8272\u4E3B\u9898\u4E0B\u90FD\u80FD\u5206\u8FA8\u7684\u4E2D\u95F4\u660E\u5EA6\uFF0C\u4E14\u4E0D\u4F9D\u8D56\u5BBF\u4E3B\u7684\u8BED\u4E49 token
   * \uFF08\u5B83\u4EEC\u6CA1\u6709\u300C\u56FE\u8868\u8272\u677F\u300D\u8FD9\u4E00\u7C7B\uFF09\u3002
   */
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

/* ---------- \u5F62\u6001 A\uFF1A\u7D27\u51D1\u6761\uFF0828\u201332px\uFF09 ---------- */
.tlogs-compact {
  display: flex;
  align-items: center;
  gap: var(--tlogs-gap);
  /* \u539F\u6765\u662F\u5199\u6B7B\u7684 height: 30px \u2014\u2014 \u6307\u6807\u6362\u884C\u65F6\u7B2C\u4E8C\u884C\u4F1A\u88AB\u88C1\u6389\uFF0C\u6545\u6539\u6210 min-height\u3002 */
  min-height: 30px;
  padding: 3px 6px;
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
 * \u5E03\u5C40\u8981\u70B9\uFF1A**\u6570\u5B57\u4F18\u5148\uFF0C\u6807\u7B7E\u4E5F\u4E0D\u8BB8\u88AB\u538B\u6CA1**\u3002
 *
 * \u5386\u53F2\uFF1A.tlogs-metric \u91CC\u7684\u6807\u7B7E\u548C\u6570\u5B57\u90FD\u53EF\u538B\u7F29\u3001\u5BB9\u5668\u53C8\u662F overflow: hidden\uFF0C
 * \u7A7A\u95F4\u4E00\u7D27\u5C31\u628A\u6574\u884C\u672B\u5C3E\uFF08\u542B\u6570\u5B57\uFF09\u88C1\u6389 \u2014\u2014 \u5B9E\u6D4B\u6700\u540E\u4E00\u9879\u663E\u793A\u6210\u300C\u672C\u6708 359\u300D
 * \u800C\u4E0D\u662F\u5B8C\u6574\u7684\u300C359M\u300D\u3002\u4E8E\u662F\u6539\u6210\u6570\u5B57 flex: 0 0 auto\u3002
 *
 * \u4F46\u90A3\u53EA\u662F\u628A\u727A\u7272\u8F6C\u5AC1\u7ED9\u4E86\u6807\u7B7E\uFF1A\u6807\u7B7E flex: 0 1 auto + \u7701\u7565\u53F7\uFF0C\u5728 313px \u4FA7\u8FB9\u680F\u3001
 * \u56DB\u4E2A\u6307\u6807\u65F6**\u6807\u7B7E\u5168\u90E8\u88AB\u538B\u6CA1**\uFF0C\u7D27\u51D1\u6761\u53EA\u5269\u300C8.9B \xB7 \xA5678.87 \xB7 \u2196561M \xB7 \u26A12.4K\u300D\u3002
 *
 * \u73B0\u5728\u7684\u89C4\u5219\uFF1A**\u6570\u5B57\u4E0E\u6807\u7B7E\u90FD\u4E0D\u53EF\u6536\u7F29**\uFF08flex: 0 0 auto\uFF09\uFF0C\u6307\u6807\u884C\u6574\u4F53\u6362\u884C
 * \uFF08flex-wrap: wrap\uFF09\u3002\u5B81\u53EF\u7D27\u51D1\u6761\u591A\u5360\u4E00\u884C\uFF0C\u4E5F\u4E0D\u7559\u4E00\u4E2A\u8BA4\u4E0D\u51FA\u7684\u788E\u7247\u3002
 * \u53E6\u5916\u9ED8\u8BA4\u4E0D\u518D\u628A\u91D1\u989D\u653E\u8FDB\u7D27\u51D1\u6761\uFF08\u89C1 src/config.ts \u7684 compactMetrics \u9ED8\u8BA4\u503C\uFF09\u3002
 */
.tlogs-metrics {
  display: flex;
  align-items: center;
  /* \u6307\u6807\u5C11\u7684\u65F6\u5019\uFF0C\u628A\u7A7A\u4F59\u5BBD\u5EA6\u644A\u5230\u6307\u6807\u4E4B\u95F4\uFF0C\u800C\u4E0D\u662F\u5168\u5806\u5728\u53F3\u4FA7\u53D8\u6210\u4E00\u7247\u7A7A\u767D\u3002
     column-gap \u53EA\u662F**\u4E0B\u9650**\uFF1B\u5B9E\u9645\u95F4\u8DDD\u7531 .tlogs-metric \u7684 flex-grow \u5747\u5206\u3002 */
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
  /* \u4ECD\u7136\u4E0D\u53EF\u6536\u7F29\uFF08gap/\u6362\u884C\u4FDD\u8BC1\u5185\u5BB9\u4E0D\u88AB\u538B\u788E\uFF09\uFF0C\u4F46\u5141\u8BB8**\u4F38\u5C55**\uFF1A
     \u4E09\u4E2A\u6307\u6807\u5404\u5206\u5230\u4E00\u4EFD\u7B49\u91CF\u7A7A\u4F59\u5BBD\u5EA6\uFF0C\u4E8E\u662F\u300C\u603B / \u4ECA\u65E5 / \u8BF7\u6C42\u300D\u7684\u95F4\u8DDD\u968F
     \u4FA7\u8FB9\u680F\u53D8\u5BBD\u800C\u81EA\u52A8\u53D8\u5927\uFF0C\u53F3\u4FA7\u4E0D\u518D\u7A7A\u4E00\u5927\u5757\u3002\u6307\u6807\u591A\u5230\u51E0\u4E4E\u586B\u6EE1\u4E00\u884C\u65F6\uFF0C
     \u53EF\u5206\u914D\u7A7A\u4F59\u8D8B\u8FD1 0\uFF0C\u81EA\u52A8\u9000\u5316\u56DE\u4E0A\u9762\u7684 12px \u4E0B\u9650\u3002 */
  flex: 1 0 auto;
}
.tlogs-metric-label {
  color: var(--tlogs-muted);
  font-size: 10px;
  /* \u4E0D\u53C2\u4E0E\u6536\u7F29\uFF1A\u5B81\u53EF\u6574\u9879\u6362\u884C\uFF0C\u4E5F\u4E0D\u8981\u628A\u300C\u4ECA\u65E5\u300D\u300C\u8BF7\u6C42\u300D\u538B\u6210\u8BA4\u4E0D\u51FA\u7684\u788E\u7247\u3002 */
  flex: 0 0 auto;
  white-space: nowrap;
}
.tlogs-metric-value {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: -0.01em;
}
/* \u7D27\u51D1\u6761\u4E0A\u7684\u91D1\u989D\uFF1A\u4E0E token \u6570\u5B57\u540C\u5B57\u53F7\uFF0C\u4F46\u7528\u91D1\u989D\u8272\u533A\u5206\uFF0C\u5E76\u4FDD\u7559 \xA5 \u7B26\u53F7\u3002 */
.tlogs-metric-money { color: var(--tlogs-money); }

/* \u53E3\u5F84\u5FBD\u6807\uFF1A\u53EA\u5728\u6570\u5B57\u4E0D\u662F\u7EAF\u5E73\u53F0\u53E3\u5F84\u65F6\u51FA\u73B0\u3002
   \u300C\u672C\u673A\u300D= \u672C\u673A\u4F1A\u8BDD\u65E5\u5FD7\u53E3\u5F84\uFF08\u5B9E\u65F6\u3001\u542B\u5E73\u53F0\u770B\u4E0D\u5230\u7684\u4F9B\u5E94\u5546\uFF09\uFF1B
   \u300C\u5408\u5E76\u300D= \u5E73\u53F0 + \u672C\u673A\u5408\u5E76\uFF1B\u300C\xA5\u7ED3\u7B97\u4E2D\u300D= \u91D1\u989D\u90A3\u4E00\u680F\u5E73\u53F0\u8FD8\u6CA1\u7ED3\u7B97\u5B8C\u3002 */
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
/* \u8868\u683C\u91CC\u884C\u5185\u4F7F\u7528\u7684\u300C\u5B98\u65B9 / \u7B2C\u4E09\u65B9\u300D\u5FBD\u6807\uFF1A\u8DDF\u5728\u540D\u79F0\u524D\u9762\uFF0C\u53BB\u6389\u5DE6\u4FA7\u5916\u8FB9\u8DDD\u3002 */
.tlogs-src-inline { margin: 0 4px 0 0; vertical-align: middle; display: inline-block; }
/* \u6CE8\uFF1A\u539F\u5148\u8FD9\u91CC\u8FD8\u6709\u4E00\u6761 .tlogs-sep\uFF08\u6307\u6807\u4E4B\u95F4\u7684\u300C\xB7\u300D\u5206\u9694\u7B26\uFF09\u3002\u6307\u6807\u884C\u73B0\u5728\u5141\u8BB8
   \u6362\u884C\uFF0C\u5206\u9694\u7B26\u4F1A\u5B64\u96F6\u96F6\u7559\u5728\u884C\u9996\uFF0C\u56E0\u6B64\u5DF2\u4ECE compact-bar.tsx \u91CC\u79FB\u9664\u3002 */

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
.tlogs-iconbtn:disabled { opacity: 0.45; cursor: default; }
.tlogs-iconbtn:disabled:hover {
  color: var(--tlogs-fg);
  border-color: var(--tlogs-border-strong);
  background: var(--tlogs-card-bg);
}
/* \u6536\u8D77\u6001\uFF08\u56FE\u6807\u680F\uFF09\u7A7A\u95F4\u4E0D\u8DB3\uFF1A\u9690\u85CF\u624B\u52A8\u5237\u65B0\uFF0C\u53EA\u7559\u5C55\u5F00/\u6536\u8D77\u3002 */
.tlogs-collapsed .tlogs-refresh { display: none; }

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
/*
 * \u9AD8\u5EA6\u4E0A\u9650\u523B\u610F\u653E\u5BBD\u3002
 *
 * \u539F\u6765\u662F\u5199\u6B7B\u7684 300px\uFF1A\u4E94\u5F20\u5361\u7247\u5728\u53CC\u5217\u5E03\u5C40\u4E0B\u9700\u8981\u7EA6 370px\uFF0C\u4E8E\u662F\u7B2C\u4E94\u5F20\uFF08\u5F53\u6708\u6D88\u8017\uFF09
 * \u88AB\u622A\u65AD\u3001\u5FC5\u987B\u6EDA\u52A8\u624D\u80FD\u770B\u5230\u2014\u2014\u5B9E\u6D4B\u622A\u56FE\u786E\u8BA4\u3002\u73B0\u5728\u6539\u7528\u89C6\u53E3\u76F8\u5173\u7684\u4E0A\u9650\uFF0C\u5E38\u89C4\u7A97\u53E3\u4E0B
 * \u4E94\u5F20\u5361\u7247\u53EF\u4EE5\u4E00\u6B21\u770B\u5168\uFF1Boverflow-y: auto \u53EA\u4F5C\u4E3A\u6781\u5C0F\u7A97\u53E3\u7684\u6700\u540E\u515C\u5E95\u3002
 */
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
 * \u603B\u6D88\u8017\u662F\u4E3B\u6307\u6807\uFF1A**\u59CB\u7EC8\u5360\u6EE1\u4E00\u6574\u884C**\uFF08\u4E0E\u7F51\u683C\u540C\u5BBD\uFF09\uFF0C\u5176\u4F59\u5361\u7247\u4E24\u4E24\u6210\u884C\u3002
 *
 * buildCards() \u4FDD\u8BC1\u300C\u603B\u6D88\u8017 Token\u300D\u6C38\u8FDC\u662F\u7B2C\u4E00\u5F20\u5361\u7247\uFF0C\u6240\u4EE5\u7528 :first-child \u5373\u53EF\u3002
 * \u65E9\u524D\u8FD9\u91CC\u662F\u300C\u6700\u540E\u4E00\u5F20\u5728\u5947\u6570\u4F4D\u65F6\u6A2A\u8DE8\u4E24\u5217\u300D\uFF0C\u90A3\u662F\u4E3A\u4E86\u8BA9\u843D\u5355\u7684\u5F53\u6708\u6D88\u8017\u4E0D\u81F3\u4E8E\u534A\u884C\u2014\u2014
 * \u73B0\u5728\u4E3B\u6307\u6807\u5360\u4E86\u6574\u884C\uFF0C\u5269\u4F59\u56DB\u5F20\u6B63\u597D\u4E24\u4E24\u6210\u884C\uFF0C\u90A3\u6761\u89C4\u5219\u53CD\u800C\u4F1A\u6324\u51FA\u7A7A\u4F4D\uFF0C\u6545\u79FB\u9664\u3002
 */
.tlogs-w-full .tlogs-cards > :first-child { grid-column: 1 / -1; }

/* \u5361\u7247\u6392\u7248\u538B\u7D27\uFF1A\u4E94\u5F20\u5361\u7247\u8981\u80FD\u4E00\u6B21\u770B\u5168\uFF0C\u4E0D\u80FD\u9760\u6EDA\u52A8\u3002 */
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
}
.tlogs-card-title {
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
 * \u4E09\u9879\u62C6\u5206\u56FA\u5B9A\u6210 **3 \u5217\u7F51\u683C**\uFF0C\u6807\u7B7E\u5728\u4E0A\u3001\u6570\u503C\u5728\u4E0B\u3002
 *
 * \u539F\u6765\u662F flex + flex-wrap\uFF1A\u53CC\u5217\u5E03\u5C40\u4E0B\u6BCF\u5F20\u5361\u7247\u53EA\u6709\u7EA6 145px\uFF08\u5185\u5BB9\u7EA6 131px\uFF09\uFF0C
 * \u4E09\u7EC4\u300C\u6807\u7B7E + \u6570\u503C\u300D\u4E00\u884C\u653E\u4E0D\u4E0B\uFF0C\u4E8E\u662F\u6BCF\u5F20\u5361\u7247\u6362\u884C\u4F4D\u7F6E\u5404\u4E0D\u76F8\u540C \u2014\u2014
 * \u300C\u4ECA\u65E5\u6D88\u8017\u300D\u663E\u793A\u6210\u300C\u8F93\u5165 559M \u8F93\u51FA 1.7M / \u8BF7\u6C42 2.4K\u300D\uFF0C
 * \u800C\u300C\u5F53\u524D\u9879\u76EE\u6D88\u8017\u300D\u6324\u5728\u4E00\u884C\uFF0C\u4E24\u5F20\u5361\u7247\u9AD8\u5EA6\u8FD8\u4E0D\u4E00\u6837\uFF0C\u770B\u4E0A\u53BB\u5C31\u662F\u4E00\u56E2\u3002
 *
 * \u56FA\u5B9A 3 \u5217\u540E\u6BCF\u5217\u7EA6 (131 - 2\xD76) / 3 \u2248 40px\uFF1A\u6807\u7B7E\uFF082 \u5B57 @9px \u2248 18px\uFF09
 * \u4E0E\u6570\u503C\uFF08@10.5px\uFF0C\u6700\u957F 5 \u5B57\u7B26 \u2248 30px\uFF09\u90FD\u80FD\u5B8C\u6574\u653E\u4E0B\uFF0C
 * \u4E94\u5F20\u5361\u7247\u9AD8\u5EA6\u5929\u7136\u4E00\u81F4\uFF0C\u4E5F\u4E0D\u518D\u51FA\u73B0\u534A\u884C\u3002
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

/* \u5361\u7247\u7684\u4E3B\u6570\u5B57\u884C\uFF1A\u5DE6\u4FA7 token \u603B\u91CF\uFF0C\u53F3\u4FA7\u91D1\u989D\u3002
   \u7528 flex + \u57FA\u7EBF\u5BF9\u9F50\uFF0C\u5E76\u8BA9\u91D1\u989D flex: 0 0 auto\uFF08\u6C38\u4E0D\u538B\u7F29\uFF09\u2014\u2014
   \u4FA7\u8FB9\u680F\u5F88\u7A84\uFF0C\u4E00\u65E6\u91D1\u989D\u88AB\u538B\u7F29\u5C31\u4F1A\u9000\u5316\u6210\u300C\xA51\u2026\u300D\uFF0C\u90A3\u6BD4\u4E0D\u663E\u793A\u66F4\u7CDF\u3002 */
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

/* \u5E73\u53F0\u8D26\u6237\u6982\u89C8\uFF08\u4F59\u989D / \u5B98\u65B9\u7D2F\u8BA1\u6D88\u8D39\uFF09\u3002 */
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
/*
 * \u540D\u79F0\u5217\uFF1A**\u4E0D\u622A\u65AD**\u3002
 *
 * \u539F\u6765\u662F max-width: 9em + ellipsis\uFF0C\u5B9E\u6D4B\u628A\u6A21\u578B\u540D\u5207\u6210\u4E86
 * deepseek-v4.1-flash-expires-on-0\u2026 / deepseek-chat & deepseek-reaso\u2026\uFF0C
 * \u7528\u6237\u76F4\u63A5\u53CD\u9988\u300C\u540D\u5B57\u663E\u793A\u4E0D\u5168\u300D\u3002\u8FD9\u91CC\u6539\u6210\u5141\u8BB8\u6362\u884C\uFF08overflow-wrap: anywhere \u5904\u7406
 * \u300Cprovider \xB7 model\u300D\u8FD9\u79CD\u957F\u4E32\uFF09\uFF0C\u5E76\u7ED9\u5B83\u4E00\u4E2A\u4E0B\u9650\uFF0C\u8BA9\u6570\u5B57\u5217\u5148\u8BA9\u4F4D\u3002
 */
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
/* \u91D1\u989D\u5217\uFF1A\u7528\u91D1\u989D\u8272\u4E0E\u65C1\u8FB9\u56DB\u4E2A\u6574\u6570\u5217\u533A\u5206\u5F00\uFF08\u5B83\u4EEC\u662F token / \u6B21\u6570\uFF0C\u4E0D\u662F\u94B1\uFF09\u3002 */
.tlogs-table td.tlogs-td-money { color: var(--tlogs-money); font-weight: 600; }
.tlogs-empty { padding: 10px 4px; text-align: center; color: var(--tlogs-muted); font-size: 11px; }
.tlogs-scroll { max-height: 190px; overflow-y: auto; overscroll-behavior: contain; }
.tlogs-error { color: var(--tlogs-danger); font-size: 10px; line-height: 1.5; }
/* \u8BF4\u660E\u6027\u63D0\u793A\uFF08\u4F8B\u5982\u300C\u5185\u7F6E\u767B\u5F55\u4E0D\u53EF\u7528\uFF0C\u8BF7\u624B\u52A8\u586B\u5199\u300D\uFF09\u3002 */
.tlogs-hint { color: var(--tlogs-muted); font-size: 10px; line-height: 1.55; }

/* ---------- \u8BE6\u7EC6\u6570\u636E\u5F39\u7A97\uFF08\u6D6E\u5C42\uFF09 ---------- */
/*
 * \u8FD9\u662F\u5168\u6587\u4EF6\u552F\u4E00\u4F7F\u7528 position: fixed \u7684\u5730\u65B9\u3002
 * \u7D27\u51D1\u6761\u4E0E\u5C55\u5F00\u9762\u677F\u4ECD\u7136\u4E25\u683C\u7559\u5728\u6587\u6863\u6D41\u5185\uFF08\u9700\u6C42 1.1\uFF09\u2014\u2014 \u90A3\u4E00\u6761\u9488\u5BF9\u7684\u662F\u4FA7\u8FB9\u680F\u9875\u811A\u91CC\u7684
 * \u5185\u5D4C\u7EC4\u4EF6\uFF1B\u5F39\u7A97\u672C\u8D28\u4E0A\u5C31\u8BE5\u662F\u6D6E\u5C42\uFF0C\u5426\u5219\u5728\u7A84\u4FA7\u8FB9\u680F\u91CC\u653E\u4E0D\u4E0B\u65E5\u5386\u4E0E\u8868\u683C\u3002
 */
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
/*
 * \u5F39\u7A97\u5C3A\u5BF8**\u6C38\u8FDC\u9501\u5B9A**\uFF1A\u5BBD\u9AD8\u90FD\u5199\u6B7B\uFF08\u4EC5\u968F\u89C6\u53E3\u6536\u7F29\uFF09\uFF0C\u5207\u4EFB\u4F55\u9875\u7B7E\u90FD\u4E0D\u53D8\u3002
 *
 * \u5386\u53F2\uFF08\u4E24\u6B21\u53CD\u9988\u7684\u7ED3\u8BBA\uFF09\uFF1A
 *  1. \u65E9\u5148\u662F max-height: 82vh \u52A0 body \u7684 min-height\uFF0C\u9AD8\u5EA6\u7531\u5185\u5BB9\u51B3\u5B9A \u2192 \u5207\u9875\u7B7E\u4F38\u7F29\u3002
 *     \u7528\u6237\u660E\u786E\u8981\u6C42\u300C\u65E0\u8BBA\u5207\u6362\u5230\u54EA\u4E2A\u6807\u7B7E\uFF0C\u5F39\u7A97\u5C3A\u5BF8\u6C38\u8FDC\u9501\u5B9A\u300D\uFF0C\u4E8E\u662F\u5199\u6B7B\u5BBD\u9AD8\u3002
 *  2. \u5199\u6B7B\u4E4B\u540E\u65E5\u5386\u9875\u7B7E\uFF08\u9ED8\u8BA4\u9875\u7B7E\u3001\u5185\u5BB9\u6700\u77ED\uFF09\u4E0B\u65B9\u7A7A\u51FA\u4E00\u6761\uFF08\u7528\u6237\u6807\u6CE8\u300C\u7EA2\u7EBF\u4E0B\u65B9\u90A3\u622A\u4E0D\u8981\u300D\uFF09\u3002
 *     **\u4F46\u89E3\u6CD5\u4E0D\u662F\u628A\u5F39\u7A97\u6539\u6210\u8D34\u5185\u5BB9** \u2014\u2014 \u90A3\u4F1A\u63A8\u7FFB 1\u3002\u6B63\u786E\u89E3\u6CD5\u662F\u8BA9**\u5185\u5BB9\u53BB\u957F\u6EE1**\u8FD9\u5757
 *     \u9AD8\u5EA6\uFF1A\u65E5\u5386\u7F51\u683C\u7684\u884C\u9AD8\u6539\u6210 minmax(52px, 1fr) \u5E76 flex \u4F38\u5C55\uFF08\u89C1\u4E0B\uFF09\uFF0C
 *     \u8868\u683C/\u56FE\u8868\u8FD9\u7C7B\u8D85\u957F\u5185\u5BB9\u5728 body \u5185\u6EDA\u52A8\u3002
 *
 * \u4E00\u53E5\u8BDD\uFF1A\u5F39\u7A97\u5916\u6846\u6052\u5B9A\uFF0C\u7F3A\u7684\u9AD8\u5EA6\u7531\u65E5\u5386\u81EA\u5DF1\u586B\u6EE1\u3002
 */
.tlogs-modal {
  display: flex;
  flex-direction: column;
  width: min(880px, 94vw);
  /* \u9501\u5B9A\u5C3A\u5BF8\uFF1B\u4E0A\u9650\u968F\u89C6\u53E3\u6536\u7F29\uFF08\u77ED\u89C6\u53E3\u4E0B\u4E5F\u4E0D\u4F1A\u9876\u51FA\u5C4F\u5E55\uFF09\u3002 */
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
  /* \u628A\u5269\u4F59\u9AD8\u5EA6\u5168\u90E8\u5403\u6389\u5E76\u5728\u5185\u90E8\u6EDA\u52A8\uFF1Abody \u7684\u9AD8\u5EA6\u4E0D\u518D\u7531\u5185\u5BB9\u51B3\u5B9A\u3002 */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.tlogs-table-wrap { max-height: 52vh; overflow-y: auto; overscroll-behavior: contain; }

/* ---------- \u65E5\u5386 ---------- */
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
 * \u884C\u9AD8\u4E0B\u9650 52px\uFF0C\u4E0A\u9650\u4E0D\u9650\uFF081fr\uFF09\uFF1A\u5F39\u7A97\u9AD8\u5EA6\u662F**\u9501\u5B9A**\u7684\uFF0C\u65E5\u5386\u5FC5\u987B\u81EA\u5DF1\u957F\u6EE1
 * \u8FD9\u5757\u9AD8\u5EA6\uFF0C\u5426\u5219\u9501\u5B9A\u9AD8\u5EA6\u5C31\u4F1A\u5728\u65E5\u5386\u4E0B\u65B9\u53D8\u6210\u4E00\u6761\u7A7A\u767D \u2014\u2014 \u8FD9\u662F\u300C\u5C3A\u5BF8\u6C38\u8FDC\u9501\u5B9A\u300D
 * \u4E0E\u300C\u65E5\u5386\u4E0B\u65B9\u4E0D\u7559\u7A7A\u767D\u300D\u4E24\u6761\u8981\u6C42\u7684\u552F\u4E00\u4EA4\u70B9\u3002
 *
 * \u884C\u9AD8\u4E0B\u9650\u4ECD\u7136 52 \u800C\u4E0D\u662F 40\uFF1A\u6BCF\u683C\u73B0\u5728\u662F\u4E09\u884C\uFF08\u65E5\u53F7 / token / \u91D1\u989D\uFF09\u3002\u91D1\u989D\u90A3\u4E00\u884C
 * **\u65E0\u6761\u4EF6**\u5360\u4F4D\uFF08\u65E0\u6570\u636E\u65F6\u6E32\u67D3\u7A7A\u4E32\uFF09\uFF0C\u6240\u4EE5\u6709\u91D1\u989D\u4E0E\u6CA1\u91D1\u989D\u7684\u683C\u5B50\u9AD8\u5EA6\u4ECD\u5B8C\u5168\u76F8\u540C \u2014\u2014
 * \u4E00\u65E6\u6309\u9700\u6E32\u67D3\uFF0C\u5207\u6708\u65F6\u9AD8\u5EA6\u53C8\u4F1A\u8DF3\uFF0C\u90A3\u6B63\u662F\u300C\u56FA\u5B9A 42 \u683C\u300D\u8981\u89E3\u51B3\u7684\u95EE\u9898\u3002
 */
.tlogs-cal {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  /*
   * \u7B2C\u4E00\u884C\u662F\u661F\u671F\u6807\u9898\uFF08\u4FDD\u6301\u7D27\u51D1\uFF0C\u4E0D\u53C2\u4E0E\u5206\u644A\uFF09\uFF0C\u5176\u4F59 6 \u884C\u662F\u65E5\u671F\u683C\uFF1A
   * \u7528 minmax(52px, 1fr) \u628A\u300C\u9501\u5B9A\u9AD8\u5EA6\u591A\u51FA\u6765\u7684\u90E8\u5206\u300D\u6309\u6BD4\u4F8B\u644A\u7ED9\u5B83\u4EEC\u3002
   * \u65E5\u5386**\u59CB\u7EC8\u6E32\u67D3 42 \u683C**\uFF08\u89C1 detail-modal.tsx\uFF09\uFF0C\u6240\u4EE5\u6B63\u597D 1 + 6 \u884C\u3002
   */
  grid-template-rows: auto repeat(6, minmax(52px, 1fr));
  /* \u515C\u5E95\uFF1A\u4E07\u4E00\u5C06\u6765\u67D0\u4E2A\u6708\u4E0D\u662F 6 \u884C\uFF0C\u9690\u5F0F\u884C\u4E5F\u8981\u540C\u6837\u7684\u4E0B\u9650\u8BED\u4E49\u3002 */
  grid-auto-rows: minmax(52px, 1fr);
  gap: 3px;
  /* body \u662F flex \u5217\uFF1A\u8BA9\u7F51\u683C\u5403\u6389\u5269\u4F59\u9AD8\u5EA6\uFF0C\u5426\u5219\u9501\u5B9A\u9AD8\u5EA6\u4F1A\u53D8\u6210\u65E5\u5386\u4E0B\u65B9\u7684\u7A7A\u767D\u6761\u3002 */
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
/* \u91D1\u989D\u884C\uFF1A\u5373\u4F7F\u6CA1\u6709\u91D1\u989D\u4E5F\u4FDD\u7559\u8FD9\u4E00\u884C\uFF08min-height \u5360\u4F4D\uFF09\uFF0C\u4FDD\u8BC1\u6BCF\u683C\u884C\u6570\u6052\u5B9A\u3002 */
.tlogs-cal-money {
  min-height: 11px;
  font-size: 9px;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--tlogs-money);
  white-space: nowrap;
}

/* ---------- \u56FE\u8868\uFF08\u8BE6\u7EC6\u6570\u636E\u5F39\u7A97\u7684\u300C\u56FE\u8868\u300D\u9875\u7B7E\uFF09 ---------- */
/*
 * \u5168\u90E8\u662F\u5185\u8054 SVG\uFF0C\u51E0\u4F55\u6362\u7B97\u5728 chart-utils.ts\uFF08\u6709\u5355\u6D4B\uFF09\u3002\u8FD9\u91CC\u53EA\u7BA1\u989C\u8272\u4E0E\u6392\u7248\uFF1A
 * \u67F1/\u7EBF\u7684\u586B\u5145\u4E00\u5F8B\u8D70 --tlogs-cN\uFF0C\u56E0\u6B64\u6D45\u8272\u4E0E\u6DF1\u8272\u4E3B\u9898\u81EA\u52A8\u8DDF\u968F\u3002
 *
 * \u5173\u4E8E\u9AD8\u5EA6\uFF1A\u6BCF\u5F20\u56FE\u7684\u9AD8\u5EA6\u7531 viewBox \u51B3\u5B9A\u3001\u5BBD\u5EA6 100% \u7B49\u6BD4\u7F29\u653E\uFF0C\u6240\u4EE5\u5207\u6362\u8303\u56F4/\u7C92\u5EA6
 * \u65F6\u5361\u7247\u9AD8\u5EA6\u4E0D\u4F1A\u8DF3\uFF08\u70B9\u6570\u53D8\u5316\u53EA\u5F71\u54CD\u67F1\u5BBD\u4E0E\u6807\u7B7E\u5BC6\u5EA6\uFF09\u3002
 */
.tlogs-chart-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.tlogs-ctl-group { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.tlogs-ctl-label { font-size: 10px; color: var(--tlogs-muted); white-space: nowrap; }
.tlogs-chart-select { flex: 0 1 auto; min-width: 118px; max-width: 220px; }
.tlogs-chart-date { flex: 0 1 auto; min-width: 132px; }

/*
 * \u56FE\u5F62\u5B50\u6807\u7B7E\u884C\uFF1A\u7D27\u8D34\u4E3B\u9875\u7B7E\u4E0B\u9762\uFF0C\u53F3\u4FA7\u7559\u51FA\u300C\u6784\u6210\u7EF4\u5EA6\u300D\u7684\u4F4D\u7F6E\u3002
 * \u884C\u672C\u8EAB\u7528\u56FA\u5B9A\u9AD8\u5EA6\uFF0C\u8FD9\u6837\u5207\u5B50\u6807\u7B7E\uFF08\u6216\u8BA9\u53F3\u4FA7\u6309\u94AE\u51FA\u73B0/\u6D88\u5931\uFF09\u4E0D\u4F1A\u632A\u52A8\u4E0B\u9762\u7684\u5185\u5BB9\u3002
 */
.tlogs-subtabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  flex-wrap: wrap;
  flex: 0 0 auto;
}

/*
 * \u56FE\u5F62\u821E\u53F0\uFF1A**\u56FA\u5B9A\u6700\u5C0F\u9AD8\u5EA6**\u3002
 *
 * \u4E09\u5F20\u56FE\u7684\u9AD8\u5EA6\u5929\u7136\u4E0D\u540C\uFF08\u6298\u7EBF 220\u3001\u5806\u53E0\u67F1 236\u3001\u73AF\u5F62 170\uFF09\u3002\u7ED9\u821E\u53F0\u4E00\u4E2A\u7EDF\u4E00\u7684\u4E0B\u754C\uFF0C
 * \u518D\u8BA9\u5361\u7247\u6491\u6EE1\uFF0C\u5207\u5B50\u6807\u7B7E\u65F6\u4E0B\u65B9\u5185\u5BB9\u4E0D\u4F1A\u4E0A\u4E0B\u8DF3 \u2014\u2014 \u52A0\u4E0A\u5F39\u7A97\u5916\u6846\u672C\u8EAB\u56FA\u5B9A\uFF0C
 * \u6574\u4F53\u5C31\u662F\u300C\u600E\u4E48\u70B9\u90FD\u4E0D\u52A8\u300D\u3002
 */
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
/* \u67F1\u5B50\u6574\u4F53\u5728\u60AC\u505C\u65F6\u63D0\u4EAE\uFF0C\u547D\u4E2D\u533A\u7531\u4E0A\u9762\u7684\u900F\u660E\u77E9\u5F62\u627F\u62C5\u3002 */
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
var React9 = __toESM(require("react"), 1);

// src/client/h.ts
var React = __toESM(require("react"), 1);
var h = React.createElement;
var Fragment2 = React.Fragment;

// src/client/compact-bar.tsx
var React2 = require("react");

// src/client/format.ts
function localReasonLabel(reason) {
  switch (reason) {
    case void 0:
      return "\u5C1A\u672A\u626B\u63CF";
    case "disabled":
      return "\u914D\u7F6E\u91CC\u5DF2\u5173\u95ED localUsage";
    case "no-session-logs":
      return "\u672A\u627E\u5230\u4F1A\u8BDD\u65E5\u5FD7\uFF08\u5019\u9009\u76EE\u5F55\u90FD\u4E0D\u5B58\u5728\uFF09";
    case "zstd-unavailable":
      return "\u5F53\u524D\u8FD0\u884C\u65F6\u4E0D\u652F\u6301 zstd\uFF08\u9700\u8981 Node 22.15+ / 24\uFF09";
    case "not-scanned":
      return "\u5C1A\u672A\u626B\u63CF";
    case "restored-empty":
      return "\u7F13\u5B58\u91CC\u6CA1\u6709\u53EF\u7528\u6570\u636E";
    case "no-usage-in-window":
      return "\u65E5\u5FD7\u91CC\u6CA1\u6709\u7A97\u53E3\u5185\u7684\u7528\u91CF";
    case "session-log-read-failed":
      return "\u4F1A\u8BDD\u65E5\u5FD7\u8BFB\u53D6\u5931\u8D25";
    default:
      return reason.startsWith("sessions-dir-unreadable") ? "\u4F1A\u8BDD\u76EE\u5F55\u4E0D\u53EF\u8BFB" : "\u8BFB\u53D6\u5931\u8D25";
  }
}
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
function group(intPart) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
  if (abs >= 1e8) return `${sign}\xA5${(abs / 1e8).toFixed(2).replace(/\.?0+$/, "")}\u4EBF`;
  if (abs >= 1e4) {
    const wan = abs / 1e4;
    const s = wan < 100 ? wan.toFixed(2).replace(/\.?0+$/, "") : String(Math.round(wan));
    return `${sign}\xA5${s}\u4E07`;
  }
  return formatMoney(n);
}

// src/client/compact-bar.tsx
function CompactBar(props) {
  const { snapshot, numberFormat, wide, expanded, busy, onToggle, onRefresh } = props;
  const metrics = snapshot?.compact ?? [];
  const stale = snapshot?.stale === true;
  const progress = snapshot?.loading ? snapshot.progress ?? 0 : null;
  const lead = metrics.find((m) => m.scope === "total") ?? metrics[0];
  const fullTitle = (label, value, unit, source) => {
    const note = source === "local" ? "\uFF08\u672C\u673A\u53E3\u5F84\uFF1ADSH \u4F1A\u8BDD\u65E5\u5FD7\uFF09" : source === "merged" ? "\uFF08\u5E73\u53F0 + \u672C\u673A\u5408\u5E76\u53E3\u5F84\uFF09" : "";
    if (unit === "requests") return `${label} ${formatFull(value)} \u6B21\u8BF7\u6C42${note}`;
    if (unit === "money") return `${label} ${formatMoneyFull(value)} \u5143`;
    return `${label} ${formatFull(value)} tokens${note}`;
  };
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h(
    "div",
    {
      className: wide ? "tlogs-compact" : "tlogs-compact tlogs-collapsed",
      onClick: onToggle,
      title: "tlogs \u2014 DeepSeek \u7528\u91CF"
    },
    wide ? /* @__PURE__ */ h("span", { className: "tlogs-metrics" }, metrics.map((m, i) => /* @__PURE__ */ h(Fragment2, { key: `${m.scope}-${m.label}-${i}` }, /* @__PURE__ */ h(
      "span",
      {
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
    ))), metrics.length === 0 ? /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, "\u6682\u65E0\u6570\u636E") : null) : /* @__PURE__ */ h(
      "span",
      {
        className: "tlogs-collapsed-value",
        title: lead ? lead.unit === "money" ? `${lead.label} ${formatMoneyFull(lead.value)} \u5143` : `${lead.label} ${formatFull(lead.value)} tokens` : "tlogs \u2014 DeepSeek \u7528\u91CF"
      },
      lead ? lead.unit === "money" ? formatMoney(lead.value) : formatNumber(lead.value, numberFormat) : "\u2014"
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
        className: "tlogs-iconbtn tlogs-refresh",
        disabled: busy,
        onClick: (e) => {
          e.stopPropagation();
          onRefresh();
        },
        "aria-label": "\u5237\u65B0\u7528\u91CF\u6570\u636E",
        title: "\u5237\u65B0\u7528\u91CF"
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
        "aria-label": expanded ? "\u6536\u8D77 tlogs \u9762\u677F" : "\u5C55\u5F00 tlogs \u9762\u677F",
        title: expanded ? "\u6536\u8D77" : "\u5C55\u5F00"
      },
      expanded ? "\u25B4" : "\u25BE"
    ))
  ), progress !== null ? /* @__PURE__ */ h("span", { className: "tlogs-progress", "aria-hidden": "true" }, /* @__PURE__ */ h("i", { style: { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` } })) : null);
}

// src/client/expand-panel.tsx
var React3 = __toESM(require("react"), 1);

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
  for (const t of TOKEN_TYPES) s += m[t];
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
  env: "\u73AF\u5883\u53D8\u91CF",
  config: "\u63D2\u4EF6\u914D\u7F6E",
  credentials: "\u672C\u673A\u51ED\u636E\uFF08\u624B\u52A8\u586B\u5199 / \u767B\u5F55\uFF09",
  "platform-session": "DSH \u8D26\u53F7\u767B\u5F55\u6001\uFF08\u81EA\u52A8\u590D\u7528\uFF09",
  "desktop-login": "\u5185\u7F6E\u767B\u5F55\u7A97\u53E3"
};
var TIME_BASIS_LABEL = "\u7EDF\u8BA1\u53E3\u5F84\uFF1A\u5E73\u53F0\u65E5\uFF08UTC\uFF09\xB7 \u5317\u4EAC 08:00 \u6362\u65E5";
function dayBasisTip() {
  const offsetMin = -(/* @__PURE__ */ new Date()).getTimezoneOffset();
  const hhmm = (m) => {
    const x = (m % 1440 + 1440) % 1440;
    return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  };
  const start = hhmm(offsetMin);
  const end = hhmm(offsetMin + 1440);
  const billing = "\u5B98\u65B9\u8D26\u5355\u6309\u5317\u4EAC\u65F6\u95F4\u65E5\uFF080 \u70B9\uFF09\u7ED3\u7B97\uFF0C\u672C\u63D2\u4EF6\u7684\u65E5\u6876\u6309\u63A5\u53E3\u53E3\u5F84\uFF08UTC \u65E5\uFF09\u2014\u2014 \u4E24\u8005\u5728\u8DE8\u65E5\u5904\u6700\u591A\u5DEE 8 \u5C0F\u65F6\u7684\u7528\u91CF\u3002";
  if (offsetMin === 0) {
    return {
      tip: `\u5E73\u53F0\u63A5\u53E3\u7684 days[] \u6309 UTC \u65E5\u5207\u6876\uFF1B\u672C\u673A\u65F6\u533A\u5C31\u662F UTC\uFF0C\u6240\u4EE5\u672C\u673A 00:00 \u6362\u65E5\u3002${billing}`
    };
  }
  return {
    tip: `\u5E73\u53F0\u63A5\u53E3\u7684 days[] \u6309 UTC \u65E5\u5207\u6876\uFF1A\u672C\u673A ${start} \u6362\u65E5\uFF0C\u300C\u4ECA\u65E5\u300D= ${start} \uFF5E \u6B21\u65E5 ${end}\uFF08\u4E0D\u662F\u672C\u673A 00:00 \u6362\u65E5\uFF09\u3002\u5F53\u5468/\u5F53\u6708\u540C\u7406\uFF08\u5468\u4E00 00:00 / 1 \u65E5 00:00 \u5747\u6309 UTC \u8BA1\uFF09\u3002${billing}`
  };
}
function Card(props) {
  const { card, numberFormat, selectedId, onCycle } = props;
  const clickable = typeof onCycle === "function" && (card.options?.length ?? 0) > 1;
  const current = card.options?.find((o) => o.id === selectedId) ?? card.options?.[0];
  const stat = current?.stat ?? card.stat;
  const cost = stat.cost ? moneyTotal(stat.cost) : void 0;
  const moneyTip = cost === void 0 ? "" : [
    `${card.label} \u5408\u8BA1 ${formatMoneyFull(cost)} \u5143`,
    `\u8F93\u5165 ${formatMoneyFull(inputCost(stat))} \u5143`,
    `\u8F93\u51FA ${formatMoneyFull(outputCost(stat))} \u5143`
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
      title: clickable ? "\u70B9\u51FB\u5207\u6362\u9879\u76EE" : void 0
    },
    /* @__PURE__ */ h("div", { className: "tlogs-card-head" }, /* @__PURE__ */ h("span", { className: "tlogs-card-title" }, card.label, current && (card.options?.length ?? 0) > 1 ? ` \xB7 ${current.label}` : ""), card.source && card.source.kind !== "platform" ? /* @__PURE__ */ h("span", { className: "tlogs-src", title: sourceTip(card.source) }, card.source.kind === "local" ? "\u672C\u673A" : "\u5408\u5E76") : null, card.source?.costPending ? /* @__PURE__ */ h(
      "span",
      {
        className: "tlogs-src tlogs-src-pending",
        title: "\u91D1\u989D\u662F\u5E73\u53F0\u8D26\u5355\u53E3\u5F84\uFF1B\u8BE5\u7A97\u53E3\u5E73\u53F0\u5C1A\u672A\u7ED3\u7B97\u5B8C\uFF0C\u91D1\u989D\u4F1A\u504F\u5C0F\uFF08token \u6570\u5DF2\u7528\u672C\u673A\u53E3\u5F84\uFF09"
      },
      "\xA5\u7ED3\u7B97\u4E2D"
    ) : null, card.stale ? /* @__PURE__ */ h("span", { className: "tlogs-stale" }, "\u26A0") : null),
    card.error ? /* @__PURE__ */ h("span", { className: "tlogs-card-total is-error" }, card.error) : /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("span", { className: "tlogs-card-line" }, /* @__PURE__ */ h("span", { className: "tlogs-card-total", title: `${formatFull(stat.totalTokens)} tokens` }, formatNumber(stat.totalTokens, numberFormat)), cost === void 0 ? null : /* @__PURE__ */ h("span", { className: "tlogs-card-money", title: moneyTip }, formatMoney(cost))), /* @__PURE__ */ h("span", { className: "tlogs-card-split" }, /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("span", { className: "tlogs-split-label" }, "\u8F93\u5165"), /* @__PURE__ */ h("b", { title: formatFull(stat.inputTokens) }, formatNumber(stat.inputTokens, numberFormat))), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("span", { className: "tlogs-split-label" }, "\u8F93\u51FA"), /* @__PURE__ */ h("b", { title: formatFull(stat.outputTokens) }, formatNumber(stat.outputTokens, numberFormat))), /* @__PURE__ */ h("span", null, /* @__PURE__ */ h("span", { className: "tlogs-split-label" }, "\u8BF7\u6C42"), /* @__PURE__ */ h("b", { title: formatFull(stat.requests) }, formatNumber(stat.requests, numberFormat)))))
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
function sourceTip(s) {
  const head = s.kind === "local" ? "\u672C\u673A\u53E3\u5F84\uFF08DSH \u4F1A\u8BDD\u65E5\u5FD7\uFF09\uFF1A\u5B9E\u65F6\uFF0C\u8986\u76D6\u672C\u673A\u6240\u6709\u4F9B\u5E94\u5546" : s.kind === "merged" ? "\u5E73\u53F0 + \u672C\u673A\u5408\u5E76\u53E3\u5F84" : "\u5E73\u53F0\u8D26\u5355\u53E3\u5F84";
  const lines = [
    head,
    `\u5E73\u53F0 ${formatFull(s.platformTokens)} tokens`,
    `\u672C\u673A ${formatFull(s.localTokens)} tokens\uFF08\u5176\u4E2D DeepSeek \u901A\u9053 ${formatFull(s.localDeepseekTokens)}\uFF09`
  ];
  if (s.otherProviders.length > 0) {
    lines.push(
      "\u5E73\u53F0\u770B\u4E0D\u5230\u7684\u4F9B\u5E94\u5546\uFF1A" + s.otherProviders.slice(0, 4).map((p) => `${p.provider} ${formatFull(p.tokens)}`).join("\u3001")
    );
  }
  if (s.costPending) lines.push("\u91D1\u989D\u4ECD\u662F\u5E73\u53F0\u8D26\u5355\uFF1A\u8BE5\u7A97\u53E3\u5E73\u53F0\u5C1A\u672A\u7ED3\u7B97\u5B8C\uFF0C\u4F1A\u504F\u5C0F");
  return lines.join("\n");
}
function reasonLabel(reason) {
  return localReasonLabel(reason);
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
  const basis = dayBasisTip();
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
  ))) : null, error ? /* @__PURE__ */ h("div", { className: "tlogs-error" }, error) : null, auth.status === "ok" ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, "\u51ED\u636E\u6765\u6E90\uFF1A", SOURCE_LABEL[auth.source] ?? auth.source) : null, /* @__PURE__ */ h("div", { className: "tlogs-hint", title: basis.tip }, TIME_BASIS_LABEL), snapshot?.localUsage && !snapshot.localUsage.available ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, "\u672C\u673A\u53E3\u5F84\u4E0D\u53EF\u7528\uFF08", reasonLabel(snapshot.localUsage.reason), "\uFF09\uFF1A\u7A97\u53E3\u5361\u7247\u53EA\u7528\u5E73\u53F0\u8D26\u5355\uFF0C \u5F53\u5929\u4E0E\u300C\u975E DeepSeek \u4F9B\u5E94\u5546\u300D\u7684\u7528\u91CF\u53EF\u80FD\u7F3A\u5931\u6216\u663E\u793A 0") : null, snapshot && !snapshot.costComplete && snapshot.loading ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, "\u6B63\u5728\u56DE\u8865\u5386\u53F2\u91D1\u989D\uFF0C\u5361\u7247\u4E0A\u7684 \xA5 \u6682\u4E3A\u90E8\u5206\u5408\u8BA1\u2026") : null, /* @__PURE__ */ h("div", { className: "tlogs-cards" }, (snapshot?.cards ?? []).map((card, i) => /* @__PURE__ */ h(
    Card,
    {
      key: `${card.scope}-${card.label}-${i}`,
      card,
      numberFormat,
      selectedId: selections[i] ?? card.selectedOptionId,
      onCycle: card.options && card.options.length > 1 ? () => cycle(i, card) : void 0
    }
  )), snapshot === null ? /* @__PURE__ */ h("div", { className: "tlogs-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : null), snapshot?.account ? /* @__PURE__ */ h("div", { className: "tlogs-account" }, /* @__PURE__ */ h("span", { title: "\u5E73\u53F0\u5145\u503C\u4F59\u989D\uFF08get_user_summary.normal_wallets\uFF09" }, "\u4F59\u989D ", /* @__PURE__ */ h("b", null, formatMoneyFull(snapshot.account.balance))), /* @__PURE__ */ h("span", { title: "\u5E73\u53F0\u8D26\u5355\u7684\u7D2F\u8BA1\u6D88\u8D39\uFF08get_user_summary.total_costs\uFF09\uFF0C\u5373\u63A7\u5236\u53F0\u53E3\u5F84" }, "\u5B98\u65B9\u7D2F\u8BA1\u6D88\u8D39 ", /* @__PURE__ */ h("b", null, formatMoneyFull(snapshot.account.totalCosts))), snapshot.account.bonusBalance > 0 ? /* @__PURE__ */ h("span", { title: "\u8D60\u9001\u4F59\u989D" }, "\u8D60\u9001 ", /* @__PURE__ */ h("b", null, formatMoneyFull(snapshot.account.bonusBalance))) : null) : null, /* @__PURE__ */ h("div", { className: "tlogs-footer-actions" }, enableDetailView ? /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onOpenDetail }, "\u8BE6\u7EC6\u6570\u636E \u203A") : /* @__PURE__ */ h("span", null), /* @__PURE__ */ h("span", { className: "tlogs-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"), /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onLogout, title: "\u6E05\u9664\u672C\u673A\u4FDD\u5B58\u7684 userToken" }, "\u9000\u51FA\u767B\u5F55"))));
}

// src/client/detail-modal.tsx
var React7 = __toESM(require("react"), 1);

// src/client/detail-view.tsx
var React4 = __toESM(require("react"), 1);
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
  const { rows, emptyText = "\u6682\u65E0\u6570\u636E" } = props;
  const [sort, setSort] = React4.useState({
    key: "totalTokens",
    dir: "desc"
  });
  const hasCost = rows.some((r) => rowCost(r) !== void 0);
  const columns = React4.useMemo(() => {
    const base = [
      { key: "label", label: "\u540D\u79F0" },
      { key: "inputTokens", label: "\u8F93\u5165" },
      { key: "outputTokens", label: "\u8F93\u51FA" },
      { key: "totalTokens", label: "\u603B Token" },
      { key: "requests", label: "\u8BF7\u6C42" }
    ];
    if (hasCost) base.push({ key: "cost", label: "\u91D1\u989D" });
    return base;
  }, [hasCost]);
  const sorted = sortRows(rows, sort.key, sort.dir);
  const toggleSort = (key) => {
    setSort(
      (prev) => prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }
    );
  };
  if (rows.length === 0) return /* @__PURE__ */ h("div", { className: "tlogs-empty" }, emptyText);
  return /* @__PURE__ */ h("div", { className: "tlogs-table-wrap" }, /* @__PURE__ */ h("table", { className: "tlogs-table" }, /* @__PURE__ */ h("thead", null, /* @__PURE__ */ h("tr", null, columns.map((c) => /* @__PURE__ */ h(
    "th",
    {
      key: c.key,
      onClick: () => toggleSort(c.key),
      title: `\u6309${c.label}\u6392\u5E8F`,
      "aria-sort": sort.key === c.key ? sort.dir === "asc" ? "ascending" : "descending" : "none"
    },
    c.label,
    sort.key === c.key ? sort.dir === "asc" ? " \u2191" : " \u2193" : ""
  )))), /* @__PURE__ */ h("tbody", null, sorted.map((r) => {
    const c = rowCost(r);
    return /* @__PURE__ */ h("tr", { key: r.key }, /* @__PURE__ */ h("td", { title: r.label }, r.tag ? /* @__PURE__ */ h("span", { className: "tlogs-src tlogs-src-inline", title: r.tagTitle ?? r.tag }, r.tag) : null, r.label), /* @__PURE__ */ h("td", { title: formatFull(r.stat.inputTokens) }, formatFull(r.stat.inputTokens)), /* @__PURE__ */ h("td", { title: formatFull(r.stat.outputTokens) }, formatFull(r.stat.outputTokens)), /* @__PURE__ */ h("td", { title: formatFull(r.stat.totalTokens) }, formatFull(r.stat.totalTokens)), /* @__PURE__ */ h("td", { title: formatFull(r.stat.requests) }, formatFull(r.stat.requests)), hasCost ? /* @__PURE__ */ h("td", { className: "tlogs-td-money", title: c === void 0 ? "" : formatMoneyFull(c) }, c === void 0 ? "\u2014" : formatMoneyFull(c)) : null);
  }))));
}

// src/client/chart-panel.tsx
var React6 = __toESM(require("react"), 1);

// src/client/charts.tsx
var React5 = __toESM(require("react"), 1);

// src/api/parser.ts
function inputTokens(stat) {
  return stat.PROMPT_TOKEN + // py:125
  stat.PROMPT_CACHE_HIT_TOKEN + // py:126
  stat.PROMPT_CACHE_MISS_TOKEN;
}
function outputTokens(stat) {
  return stat.RESPONSE_TOKEN;
}

// src/client/chart-utils.ts
var METRICS = [
  { id: "total", label: "\u603B Token", unit: "tokens" },
  { id: "input", label: "\u8F93\u5165", unit: "tokens" },
  { id: "output", label: "\u8F93\u51FA", unit: "tokens" },
  { id: "cacheHit", label: "\u7F13\u5B58\u547D\u4E2D", unit: "tokens" },
  { id: "cacheMiss", label: "\u7F13\u5B58\u672A\u547D\u4E2D", unit: "tokens" },
  { id: "requests", label: "\u8BF7\u6C42\u6570", unit: "requests" },
  { id: "cost", label: "\u6D88\u8D39\u91D1\u989D (\xA5)", unit: "money" }
];
var GRAINS = [
  { id: "auto", label: "\u81EA\u52A8" },
  { id: "day", label: "\u6309\u5929" },
  { id: "month", label: "\u6309\u6708" },
  { id: "year", label: "\u6309\u5E74" }
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
    // 金额不在 Stat 里（它是另一套 Money 结构），必须由 bucket 携带。
    case "cost":
      return 0;
    default:
      return 0;
  }
}
function metricSuffix(unit) {
  if (unit === "requests") return " \u6B21";
  if (unit === "money") return " \u5143";
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
    // 「补齐的空天」与「真的有数据但为 0」在图上都画成 0，但只有前者算 empty。
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
function pieSlices(items, maxSlices = 8, otherLabel = "\u5176\u4ED6") {
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
function suffixOf(unit) {
  return metricSuffix(unit);
}
function formatValue(v, unit, mode = "short") {
  if (unit === "money") return mode === "full" ? formatMoneyFull(v) : formatMoneyShort(v);
  if (unit === "requests") return formatFull(Math.round(v));
  return mode === "full" ? formatFull(Math.round(v)) : formatShort(v);
}
function breakdownOf(stat) {
  return [
    { label: "\u547D\u4E2D", value: formatFull(stat.PROMPT_CACHE_HIT_TOKEN) },
    { label: "\u672A\u547D\u4E2D", value: formatFull(stat.PROMPT_CACHE_MISS_TOKEN + stat.PROMPT_TOKEN) },
    { label: "\u8F93\u51FA", value: formatFull(stat.RESPONSE_TOKEN) },
    ...stat.REQUEST > 0 ? [{ label: "\u8BF7\u6C42", value: `${formatFull(stat.REQUEST)} \u6B21` }] : []
  ];
}
function InfoBar(props) {
  const { point, unit, hint } = props;
  if (!point) return /* @__PURE__ */ h("div", { className: "tlogs-chart-info is-hint" }, hint);
  return /* @__PURE__ */ h("div", { className: "tlogs-chart-info" }, /* @__PURE__ */ h("span", { className: "tlogs-chart-info-key" }, point.full), /* @__PURE__ */ h("span", { className: "tlogs-metric" }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, unit === "requests" ? "\u8BF7\u6C42" : unit === "money" ? "\u91D1\u989D" : "\u6240\u9009\u6307\u6807"), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, formatValue(point.value, unit, "full"), suffixOf(unit))), breakdownOf(point.stat).map((e) => /* @__PURE__ */ h("span", { key: e.label, className: "tlogs-metric" }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, e.label), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, e.value))));
}
function Summary(props) {
  const { values, unit } = props;
  const positive = values.filter((v) => v > 0);
  const total = values.reduce((s, v) => s + v, 0);
  const max = positive.length > 0 ? Math.max(...positive) : 0;
  const min = positive.length > 0 ? Math.min(...positive) : 0;
  const avg = positive.length > 0 ? total / positive.length : 0;
  const items = [
    ["\u5408\u8BA1", total, false],
    ["\u6700\u9AD8", max, false],
    ["\u6700\u4F4E", min, false],
    ["\u5747\u503C", avg, true]
  ];
  return /* @__PURE__ */ h("div", { className: "tlogs-chart-summary" }, items.map(([label, v, isAvg]) => /* @__PURE__ */ h("span", { key: label, className: "tlogs-metric", title: formatValue(v, unit, "full") }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, label), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, unit === "tokens" && isAvg ? formatShort(v) : formatValue(v, unit, "short"), isAvg || unit === "tokens" ? "" : suffixOf(unit)))));
}
function Axis(props) {
  const { ticks, max, width, height } = props;
  return /* @__PURE__ */ h(Fragment2, null, ticks.map((t) => {
    const y = height - t / (max > 0 ? max : 1) * height;
    return /* @__PURE__ */ h(Fragment2, { key: `t-${t}` }, /* @__PURE__ */ h("line", { className: "tlogs-grid", x1: 0, x2: width, y1: y, y2: y }), /* @__PURE__ */ h("text", { className: "tlogs-axis-text is-y", x: -8, y: y + 3, textAnchor: "end" }, formatShort(t)));
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
  const [hover, setHover] = React5.useState(null);
  if (points.length === 0) {
    return /* @__PURE__ */ h("div", { className: "tlogs-empty" }, "\u8BE5\u8303\u56F4\u5185\u6CA1\u6709\u53EF\u7528\u4E8E\u7ED8\u56FE\u7684\u6570\u636E");
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
      "aria-label": "\u7528\u91CF\u6298\u7EBF\u56FE"
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
      hint: cumulative ? "\u6298\u7EBF\u4E3A\u300C\u7D2F\u8BA1\u300D\u53E3\u5F84\uFF08\u81EA\u8303\u56F4\u5185\u9996\u65E5\u4E4B\u524D\u7D2F\u52A0\uFF09\uFF1B\u60AC\u505C\u67E5\u770B\u8BE5\u70B9\u660E\u7EC6\u3002" : "\u60AC\u505C\u6298\u7EBF\u67E5\u770B\u8BE5\u65F6\u95F4\u70B9\u7684\u660E\u7EC6\u3002"
    }
  ));
}
function StackedBarChart(props) {
  const { points } = props;
  const [hover, setHover] = React5.useState(null);
  if (points.length === 0) {
    return /* @__PURE__ */ h("div", { className: "tlogs-empty" }, "\u8BE5\u8303\u56F4\u5185\u6CA1\u6709\u53EF\u7528\u4E8E\u7ED8\u56FE\u7684\u6570\u636E");
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
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "tlogs-legend" }, /* @__PURE__ */ h("span", { className: "tlogs-legend-item" }, /* @__PURE__ */ h("i", { className: "tlogs-swatch tlogs-swatch-c1" }), "\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09"), /* @__PURE__ */ h("span", { className: "tlogs-legend-item" }, /* @__PURE__ */ h("i", { className: "tlogs-swatch tlogs-swatch-c2" }), "\u8F93\u5165\uFF08\u7F13\u5B58\u672A\u547D\u4E2D\uFF09"), /* @__PURE__ */ h("span", { className: "tlogs-legend-item" }, /* @__PURE__ */ h("i", { className: "tlogs-swatch tlogs-swatch-c3" }), "\u8F93\u51FA"), reqMax > 0 ? /* @__PURE__ */ h("span", { className: "tlogs-legend-item" }, /* @__PURE__ */ h("i", { className: "tlogs-swatch tlogs-swatch-req" }), "\u8BF7\u6C42\u6570") : null), /* @__PURE__ */ h(
    "svg",
    {
      className: "tlogs-chart-svg",
      viewBox: `0 0 ${VB_W} ${BAR_H}`,
      role: "img",
      "aria-label": "\u7528\u91CF\u5806\u53E0\u67F1\u72B6\u56FE"
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
      hint: "\u60AC\u505C\u67F1\u5B50\u67E5\u770B\u8BE5\u65F6\u95F4\u70B9\u7684\u8F93\u5165/\u8F93\u51FA\u6784\u6210\uFF1B\u865A\u7EBF\u4E3A\u8BF7\u6C42\u6570\uFF08\u72EC\u7ACB\u523B\u5EA6\uFF09\u3002"
    }
  ));
}
function DonutChart(props) {
  const { slices, centerLabel, centerValue, unit, emptyText = "\u8BE5\u8303\u56F4\u5185\u6CA1\u6709\u6784\u6210\u6570\u636E" } = props;
  const [hover, setHover] = React5.useState(null);
  if (slices.length === 0) return /* @__PURE__ */ h("div", { className: "tlogs-empty" }, emptyText);
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
      "aria-label": "\u7528\u91CF\u6784\u6210\u997C\u56FE"
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
      title: `${s.label} \xB7 ${formatFull(s.value)}${suffixOf(unit)}`
    },
    /* @__PURE__ */ h("i", { className: `tlogs-swatch tlogs-swatch-c${s.colorIndex % 6 + 1}` }),
    /* @__PURE__ */ h("span", { className: "tlogs-legend-name" }, s.label),
    /* @__PURE__ */ h("span", { className: "tlogs-legend-value" }, formatShort(s.value)),
    /* @__PURE__ */ h("span", { className: "tlogs-legend-pct" }, (s.percent * 100).toFixed(1), "%")
  )))), /* @__PURE__ */ h(InfoBar, { point: null, unit, hint: "\u60AC\u505C\u73AF\u5F62\u6216\u56FE\u4F8B\u67E5\u770B\u5360\u6BD4\uFF1B\u6784\u6210\u9879\u8FC7\u591A\u65F6\u5C3E\u90E8\u4F1A\u5408\u5E76\u4E3A\u300C\u5176\u4ED6\u300D\u3002" }));
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
  { id: "all", label: "\u6709\u53F2\u4EE5\u6765" },
  { id: "custom", label: "\u81EA\u5B9A\u4E49" },
  { id: "today", label: "\u4ECA\u65E5" },
  { id: "week", label: "\u672C\u5468" },
  { id: "month", label: "\u672C\u6708" },
  // 与控制台「时间维度」一致的两个滚动窗口。做成图表的范围预设后，
  // 用户可以直接对着控制台把同一条曲线比出来。
  { id: "last7", label: "\u8FD1 7 \u5929" },
  { id: "last30", label: "\u8FD1 30 \u5929" }
];
var PIE_DIMS = [
  { id: "model", label: "\u6309\u6A21\u578B" },
  { id: "composition", label: "\u8F93\u5165/\u8F93\u51FA" },
  { id: "project", label: "\u6309\u9879\u76EE" }
];
var KINDS = [
  { id: "line", label: "\u6298\u7EBF\u56FE" },
  { id: "pie", label: "\u997C\u72B6\u56FE" },
  { id: "bar", label: "\u67F1\u72B6\u56FE" }
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
  const [range, setRange] = React6.useState("all");
  const [from, setFrom] = React6.useState("");
  const [to, setTo] = React6.useState("");
  const [projectId, setProjectId] = React6.useState("");
  const [metric, setMetric] = React6.useState("total");
  const [grain, setGrain] = React6.useState("auto");
  const [mode, setMode] = React6.useState("perBucket");
  const [pieDim, setPieDim] = React6.useState("model");
  const [kind, setKind] = React6.useState("line");
  const lastSig = React6.useRef("");
  React6.useEffect(() => {
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
  React6.useEffect(() => {
    if (!projectId || !series) return;
    if (series.projects.length === 0) return;
    if (series.projects.some((p) => p.id === projectId)) return;
    setProjectId("");
  }, [projectId, series]);
  const resolvedGrain = series ? resolveGrain(grain, series.from, series.to) : "day";
  const buckets = React6.useMemo(() => {
    if (!series) return [];
    if (projectSource) {
      const points2 = series.project?.points ?? [];
      return projectBuckets(points2, series.project?.prior?.stat, mode);
    }
    if (resolvedGrain === "day") return dayBuckets(series.days, series.from, series.to);
    if (resolvedGrain === "year") return yearBuckets(series.months);
    return monthBuckets(series.months);
  }, [series, projectSource, resolvedGrain, mode]);
  const values = React6.useMemo(() => {
    if (projectSource) return buckets.map((b) => bucketMetricValue(b, metric));
    const prior = mode === "cumulative" && series ? priorValue(series.prior, series.priorCost, metric) : 0;
    return bucketValues(buckets, metric, mode, prior);
  }, [buckets, metric, mode, projectSource, series]);
  const points = React6.useMemo(() => toPoints(buckets, values), [buckets, values]);
  const metricDef = METRICS.find((m) => m.id === metric);
  const unit = metricDef.unit;
  const rangeStat = React6.useMemo(
    () => series ? sumStats(series.months.map((m) => m.stat)) : zeroStat2(),
    [series]
  );
  const rangeCost = React6.useMemo(
    () => series ? series.months.reduce((s, m) => s + (m.cost ?? 0), 0) : 0,
    [series]
  );
  const rangeMoney = series?.costByType ?? zeroMoney();
  const effectiveDim = projectSource && pieDim === "model" ? "composition" : pieDim;
  const dims = projectSource ? PIE_DIMS.filter((d) => d.id !== "model") : PIE_DIMS;
  const pieItems = React6.useMemo(() => {
    if (!series) return [];
    if (effectiveDim === "model") {
      return series.models.map((m) => ({
        key: m.key,
        label: m.key,
        // 模型金额只有总额（`SeriesPoint.cost`），没有五类拆分。
        value: metric === "cost" ? m.cost ?? 0 : metricValue(m.stat, metric)
      }));
    }
    if (effectiveDim === "project") {
      if (metric === "cost") return [];
      return series.projects.map((p) => ({ key: p.id, label: p.label, value: metricValue(p.stat, metric) }));
    }
    if (metric === "cost") {
      return [
        { key: "hit", label: "\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09", value: rangeMoney.PROMPT_CACHE_HIT_TOKEN },
        {
          key: "miss",
          label: "\u8F93\u5165\uFF08\u7F13\u5B58\u672A\u547D\u4E2D\uFF09",
          value: rangeMoney.PROMPT_CACHE_MISS_TOKEN + rangeMoney.PROMPT_TOKEN
        },
        { key: "out", label: "\u8F93\u51FA", value: rangeMoney.RESPONSE_TOKEN }
      ];
    }
    const s = projectSource ? sumStats((series.project?.points ?? []).map((p) => p.stat)) : rangeStat;
    return [
      { key: "hit", label: "\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09", value: s.PROMPT_CACHE_HIT_TOKEN },
      { key: "miss", label: "\u8F93\u5165\uFF08\u7F13\u5B58\u672A\u547D\u4E2D\uFF09", value: s.PROMPT_CACHE_MISS_TOKEN + s.PROMPT_TOKEN },
      { key: "out", label: "\u8F93\u51FA", value: s.RESPONSE_TOKEN }
    ];
  }, [series, effectiveDim, metric, projectSource, rangeStat, rangeMoney]);
  const slices = React6.useMemo(() => pieSlices(pieItems, 8), [pieItems]);
  const pickRange = (r) => {
    if (r === "custom" && (!from || !to)) {
      setFrom(series?.from ?? daysAgoKey(30));
      setTo(series?.to ?? todayKey());
    }
    setRange(r);
  };
  const projectPoints = series?.project?.points.length ?? 0;
  return /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "tlogs-subtabs" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-group", role: "group", "aria-label": "\u9009\u62E9\u56FE\u5F62" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, "\u56FE\u5F62"), KINDS.map((k) => /* @__PURE__ */ h(
    "button",
    {
      key: k.id,
      type: "button",
      className: k.id === kind ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => setKind(k.id),
      "aria-pressed": k.id === kind,
      "data-kind": k.id
    },
    k.label
  ))), /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, kind === "pie" ? /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, "\u6784\u6210"), dims.map((d) => /* @__PURE__ */ h(
    "button",
    {
      key: d.id,
      type: "button",
      className: d.id === effectiveDim ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => setPieDim(d.id),
      "aria-pressed": d.id === effectiveDim
    },
    d.label
  ))) : null)), /* @__PURE__ */ h("div", { className: "tlogs-chart-controls" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-group", role: "group", "aria-label": "\u65F6\u95F4\u8303\u56F4" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, "\u8303\u56F4"), RANGES.map((r) => /* @__PURE__ */ h(
    "button",
    {
      key: r.id,
      type: "button",
      className: r.id === range ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => pickRange(r.id),
      "aria-pressed": r.id === range
    },
    r.label
  ))), /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, "\u6570\u636E\u6E90"), /* @__PURE__ */ h(
    "select",
    {
      className: "tlogs-input tlogs-chart-select",
      value: projectId,
      onChange: (e) => setProjectId(e.target.value),
      "aria-label": "\u9009\u62E9\u6570\u636E\u6E90"
    },
    /* @__PURE__ */ h("option", { value: "" }, "\u5E73\u53F0\u8D26\u5355\uFF08\u5168\u90E8\uFF09"),
    (series?.projects ?? []).map((p) => /* @__PURE__ */ h("option", { key: p.id, value: p.id }, p.label))
  ))), /* @__PURE__ */ h("div", { className: "tlogs-chart-controls" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, "\u6307\u6807"), /* @__PURE__ */ h(
    "select",
    {
      className: "tlogs-input tlogs-chart-select",
      value: metric,
      onChange: (e) => setMetric(e.target.value),
      "aria-label": "\u9009\u62E9\u6307\u6807"
    },
    METRICS.map((m) => /* @__PURE__ */ h("option", { key: m.id, value: m.id }, m.label))
  )), /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, "\u7C92\u5EA6"), /* @__PURE__ */ h(
    "select",
    {
      className: "tlogs-input tlogs-chart-select",
      value: grain,
      onChange: (e) => setGrain(e.target.value),
      "aria-label": "\u9009\u62E9\u7C92\u5EA6",
      disabled: projectSource
    },
    GRAINS.map((g) => /* @__PURE__ */ h("option", { key: g.id, value: g.id }, g.label))
  )), /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, "\u53E3\u5F84"), /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: mode === "perBucket" ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => setMode("perBucket"),
      "aria-pressed": mode === "perBucket"
    },
    "\u6BCF\u671F\u65B0\u589E"
  ), /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: mode === "cumulative" ? "tlogs-tab is-active" : "tlogs-tab",
      onClick: () => setMode("cumulative"),
      "aria-pressed": mode === "cumulative"
    },
    "\u7D2F\u8BA1"
  ))), range === "custom" ? /* @__PURE__ */ h("div", { className: "tlogs-chart-controls" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-group" }, /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, "\u4ECE"), /* @__PURE__ */ h(
    "input",
    {
      type: "date",
      className: "tlogs-input tlogs-chart-date",
      value: from,
      max: to || todayKey(),
      onChange: (e) => setFrom(e.target.value),
      "aria-label": "\u8D77\u59CB\u65E5\u671F"
    }
  ), /* @__PURE__ */ h("span", { className: "tlogs-ctl-label" }, "\u5230"), /* @__PURE__ */ h(
    "input",
    {
      type: "date",
      className: "tlogs-input tlogs-chart-date",
      value: to,
      min: from || void 0,
      max: todayKey(),
      onChange: (e) => setTo(e.target.value),
      "aria-label": "\u7ED3\u675F\u65E5\u671F"
    }
  ))) : null, series ? /* @__PURE__ */ h("div", { className: "tlogs-chart-scope" }, /* @__PURE__ */ h("span", { className: "tlogs-chart-scope-range" }, series.from, " ~ ", series.to), /* @__PURE__ */ h(
    "span",
    {
      className: "tlogs-metric",
      title: metric === "cost" ? `${formatMoneyFull(rangeCost)} \u5143` : formatFull(metricValue(rangeStat, metric))
    },
    /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, "\u533A\u95F4\u5408\u8BA1"),
    /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, metric === "cost" ? formatMoneyShort(rangeCost) : formatShort(metricValue(rangeStat, metric)), metricSuffix(unit))
  ), /* @__PURE__ */ h("span", { className: "tlogs-metric" }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, "\u8BF7\u6C42"), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, formatFull(rangeStat.REQUEST), " \u6B21")), metric === "cost" && series.costPartial ? /* @__PURE__ */ h("span", { className: "tlogs-chart-scope-note" }, "\u90E8\u5206\u6708\u4EFD\u91D1\u989D\u5C1A\u672A\u56DE\u8865\uFF0C\u66F2\u7EBF\u53EF\u80FD\u504F\u4F4E") : null, /* @__PURE__ */ h("span", { className: "tlogs-chart-scope-note" }, projectSource ? `\u9879\u76EE\u7EF4\u5EA6\uFF1A${projectPoints} \u6761\u5FEB\u7167\uFF08\u63D2\u4EF6\u81EA\u542F\u7528\u5F53\u5929\u8D77\u9010\u65E5\u8BB0\u5F55\uFF0C\u65E0\u6CD5\u56DE\u6EAF\u66F4\u65E9\uFF09` : `${buckets.length} \u4E2A${resolvedGrain === "day" ? "\u5929" : resolvedGrain === "month" ? "\u6708" : "\u5E74"}`), loading ? /* @__PURE__ */ h("span", { className: "tlogs-chart-busy" }, "\u66F4\u65B0\u4E2D\u2026") : null) : null, error ? /* @__PURE__ */ h("div", { className: "tlogs-error" }, error) : null, !series ? /* @__PURE__ */ h("div", { className: "tlogs-empty" }, loading ? "\u52A0\u8F7D\u4E2D\u2026" : "\u6682\u65E0\u56FE\u8868\u6570\u636E") : /* @__PURE__ */ h(Fragment2, null, series.partial && !projectSource ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, "\u6CE8\u610F\uFF1A\u8303\u56F4\u5185\u6709\u6708\u4EFD\u7F3A\u5C11\u9010\u65E5\u660E\u7EC6\uFF08\u63A5\u53E3\u53EA\u5728\u90E8\u5206\u6708\u4EFD\u8FD4\u56DE\u6309\u5929\u6570\u636E\uFF09\u3002 \u6309\u5929\u7C92\u5EA6\u4F1A\u628A\u8FD9\u4E9B\u6708\u4EFD\u753B\u6210\u65AD\u70B9\uFF1B", /* @__PURE__ */ h("b", null, "\u6309\u6708 / \u6309\u5E74\u7C92\u5EA6\u4E0D\u53D7\u5F71\u54CD"), "\uFF08\u7528\u7684\u662F\u6708\u5EA6\u5408\u8BA1\uFF09\u3002") : null, projectSource && projectPoints < 2 ? /* @__PURE__ */ h("div", { className: "tlogs-hint" }, "\u8BE5\u9879\u76EE\u76EE\u524D\u53EA\u6709 ", projectPoints, " \u6761\u5FEB\u7167\uFF1A\u8D8B\u52BF\u7EBF\u9700\u8981\u81F3\u5C11\u8DE8 2 \u5929\u3002 \u5E73\u53F0\u8D26\u5355\u63A5\u53E3\u6CA1\u6709\u9879\u76EE\u7EF4\u5EA6\uFF0C\u5386\u53F2\u65E0\u6CD5\u56DE\u6EAF \u2014\u2014 \u5FEB\u7167\u4F1A\u5728\u63D2\u4EF6\u8FD0\u884C\u671F\u95F4\u6BCF\u5929\u7D2F\u79EF\u4E00\u6761\u3002") : null, /* @__PURE__ */ h("div", { className: "tlogs-chart-stage" }, kind === "line" ? /* @__PURE__ */ h("div", { className: "tlogs-chart-card" }, /* @__PURE__ */ h("div", { className: "tlogs-chart-head" }, /* @__PURE__ */ h("span", { className: "tlogs-chart-title" }, "\u7528\u91CF\u8D8B\u52BF", /* @__PURE__ */ h("span", { className: "tlogs-chart-sub" }, metricDef.label, mode === "cumulative" ? " \xB7 \u7D2F\u8BA1" : " \xB7 \u6BCF\u671F"))), /* @__PURE__ */ h(LineChart, { points, unit, cumulative: mode === "cumulative" })) : kind === "pie" ? /* @__PURE__ */ h("div", { className: "tlogs-chart-card" }, /* @__PURE__ */ h("div", { className: "tlogs-chart-head" }, /* @__PURE__ */ h("span", { className: "tlogs-chart-title" }, "\u6784\u6210\u5360\u6BD4", /* @__PURE__ */ h("span", { className: "tlogs-chart-sub" }, effectiveDim === "model" ? "\u6309\u6A21\u578B" : effectiveDim === "project" ? "\u6309\u9879\u76EE" : "\u8F93\u5165\u547D\u4E2D / \u672A\u547D\u4E2D / \u8F93\u51FA"))), /* @__PURE__ */ h(
    DonutChart,
    {
      slices,
      centerLabel: effectiveDim === "model" ? "\u6309\u6A21\u578B" : effectiveDim === "project" ? "\u6309\u9879\u76EE" : projectSource ? selectedProject?.label ?? "\u6240\u9009\u9879\u76EE" : "\u533A\u95F4\u5408\u8BA1",
      centerValue: metric === "cost" ? formatMoneyShort(slices.reduce((s, x) => s + x.value, 0)) : formatShort(slices.reduce((s, x) => s + x.value, 0)),
      unit,
      emptyText: effectiveDim === "project" ? metric === "cost" ? "\u9879\u76EE\u7528\u91CF\u6765\u81EA\u672C\u673A\u4F1A\u8BDD\u6295\u5F71\uFF0C\u5E73\u53F0\u8D26\u5355\u91CC\u6CA1\u6709\u5B83\u7684\u91D1\u989D" : "\u6CA1\u6709\u53EF\u7528\u7684\u9879\u76EE\u6570\u636E\uFF08\u5BBF\u4E3B\u672A\u63D0\u4F9B\u4F1A\u8BDD\u7528\u91CF\u6765\u6E90\uFF09" : "\u8BE5\u8303\u56F4\u5185\u6CA1\u6709\u6784\u6210\u6570\u636E"
    }
  )) : /* @__PURE__ */ h("div", { className: "tlogs-chart-card" }, /* @__PURE__ */ h("div", { className: "tlogs-chart-head" }, /* @__PURE__ */ h("span", { className: "tlogs-chart-title" }, "\u7528\u91CF\u5206\u5E03", /* @__PURE__ */ h("span", { className: "tlogs-chart-sub" }, "\u8F93\u5165\u547D\u4E2D / \u672A\u547D\u4E2D + \u8F93\u51FA\uFF0C\u4E09\u6BB5\u5806\u53E0"))), /* @__PURE__ */ h(StackedBarChart, { points })))));
}

// src/client/detail-modal.tsx
var TABS = [
  { id: "calendar", label: "\u65E5\u5386" },
  { id: "charts", label: "\u56FE\u8868" },
  { id: "models", label: "\u6A21\u578B" },
  // 「供应商」表来自本机会话日志（含平台账单看不到的火山方舟/小米/GLM…），
  // 紧跟在平台口径的「模型」表后面，两张表的口径差异在表头上写明。
  { id: "providers", label: "\u4F9B\u5E94\u5546" },
  { id: "years", label: "\u5E74" },
  { id: "months", label: "\u6708" },
  { id: "days", label: "\u5F53\u6708\u6309\u5929" }
];
var WEEKDAYS = ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u65E5"];
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
function statLine(stat) {
  const out = [
    { label: "\u8F93\u5165", text: formatNumber(stat.inputTokens, "short"), full: formatFull(stat.inputTokens) },
    { label: "\u8F93\u51FA", text: formatNumber(stat.outputTokens, "short"), full: formatFull(stat.outputTokens) },
    { label: "\u603B Token", text: formatNumber(stat.totalTokens, "short"), full: formatFull(stat.totalTokens) },
    { label: "\u8BF7\u6C42", text: formatNumber(stat.requests, "short"), full: formatFull(stat.requests) }
  ];
  if (stat.cost) {
    const m = moneyTotal(stat.cost);
    out.push({ label: "\u91D1\u989D", text: formatMoneyShort(m), full: formatMoneyFull(m) });
  }
  return out;
}
function Calendar(props) {
  const { months, monthDetail, onSelectMonth } = props;
  const sorted = React7.useMemo(
    () => [...months].sort((a, b) => a.key.localeCompare(b.key)),
    [months]
  );
  const [sel, setSel] = React7.useState(null);
  const [selectedDate, setSelectedDate] = React7.useState(null);
  React7.useEffect(() => {
    if (sel || sorted.length === 0) return;
    const last = sorted[sorted.length - 1];
    const ym = parseYm(last.key);
    if (!ym) return;
    setSel(ym);
    onSelectMonth(ym.year, ym.month);
  }, [sorted, sel, onSelectMonth]);
  if (sorted.length === 0) return /* @__PURE__ */ h("div", { className: "tlogs-empty" }, "\u6682\u65E0\u6570\u636E");
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
    const title = stat ? `${date} \xB7 ${formatFull(value)} tokens \xB7 ${formatFull(stat.requests)} \u6B21\u8BF7\u6C42` + (stat.cost ? ` \xB7 ${formatMoneyFull(dayCost)} \u5143` : "") : `${date} \xB7 \u65E0\u6570\u636E`;
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
      "aria-label": "\u4E0A\u4E00\u4E2A\u6708"
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
      "aria-label": "\u9009\u62E9\u6708\u4EFD"
    },
    sorted.map((r) => /* @__PURE__ */ h("option", { key: r.key, value: r.key }, r.key, "\uFF08", formatNumber(r.stat.totalTokens, "short"), " tokens", r.stat.cost ? ` \xB7 ${formatMoneyShort(moneyTotal(r.stat.cost))}` : "", "\uFF09"))
  ), /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      className: "tlogs-btn",
      onClick: () => step(1),
      disabled: idx < 0 || idx >= sorted.length - 1,
      "aria-label": "\u4E0B\u4E00\u4E2A\u6708"
    },
    "\u203A"
  )), /* @__PURE__ */ h("div", { className: "tlogs-cal-summary" }, /* @__PURE__ */ h("span", { className: "tlogs-cal-summary-title" }, ymKey(current.year, current.month), " \u5408\u8BA1"), statLine(monthDetail?.stat ?? ZERO_COUNTERS).map((s) => /* @__PURE__ */ h("span", { key: s.label, className: "tlogs-metric", title: s.full }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, s.label), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, s.text)))), byDate.size === 0 ? (
    // 兜底：确实拿不到该月逐日明细时，明确说明而不是渲染一片「—」。
    // （正常情况下插件会自动回补缺失的逐日明细，见 history.plan 的说明。）
    /* @__PURE__ */ h("div", { className: "tlogs-empty" }, "\u8BE5\u6708\u6682\u65E0\u9010\u65E5\u660E\u7EC6\uFF0C\u4EC5\u663E\u793A\u4E0A\u65B9\u6708\u5EA6\u5408\u8BA1\u3002\u4E0B\u4E00\u6B21\u81EA\u52A8\u5237\u65B0\u4F1A\u5C1D\u8BD5\u56DE\u8865\u3002")
  ) : /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { className: "tlogs-cal", role: "grid" }, WEEKDAYS.map((w) => /* @__PURE__ */ h("div", { key: w, className: "tlogs-cal-head" }, w)), cells), /* @__PURE__ */ h("div", { className: "tlogs-cal-detail" }, selectedDate && selected ? /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("span", { className: "tlogs-cal-summary-title" }, selectedDate), statLine(selected).map((s) => /* @__PURE__ */ h("span", { key: s.label, className: "tlogs-metric", title: s.full }, /* @__PURE__ */ h("span", { className: "tlogs-metric-label" }, s.label), /* @__PURE__ */ h("span", { className: "tlogs-metric-value" }, s.text)))) : /* @__PURE__ */ h("span", { className: "tlogs-hint" }, "\u70B9\u51FB\u65E5\u5386\u4E2D\u7684\u67D0\u4E00\u5929\u67E5\u770B\u5F53\u5929\u660E\u7EC6\u3002"))));
}
function DetailModal(props) {
  const { detail, monthDetail, series, seriesLoading, loading, busy, error, onClose, onRefresh, onSelectMonth, onLoadSeries } = props;
  const [tab, setTab] = React7.useState("calendar");
  React7.useEffect(() => {
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
    /* @__PURE__ */ h("div", { className: "tlogs-modal", role: "dialog", "aria-modal": "true", "aria-label": "tlogs \u7528\u91CF\u8BE6\u7EC6\u6570\u636E" }, /* @__PURE__ */ h("div", { className: "tlogs-modal-head" }, /* @__PURE__ */ h("span", { className: "tlogs-modal-title" }, "\u7528\u91CF\u8BE6\u7EC6\u6570\u636E"), /* @__PURE__ */ h("span", { className: "tlogs-actions" }, /* @__PURE__ */ h("button", { type: "button", className: "tlogs-btn", onClick: onRefresh, disabled: busy }, busy ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0"), /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "tlogs-btn",
        onClick: onClose,
        "aria-label": "\u5173\u95ED\u8BE6\u7EC6\u6570\u636E",
        title: "\u5173\u95ED\uFF08Esc\uFF09"
      },
      "\u2715"
    ))), /* @__PURE__ */ h("div", { className: "tlogs-modal-body" }, /* @__PURE__ */ h("div", { className: "tlogs-tabs", role: "tablist" }, TABS.map((t) => /* @__PURE__ */ h(
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
    ))), loading && !detail ? /* @__PURE__ */ h("div", { className: "tlogs-empty" }, "\u52A0\u8F7D\u4E2D\u2026") : tab === "calendar" ? /* @__PURE__ */ h(
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
    ) : tab === "providers" ? /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("div", { className: "tlogs-hint" }, detail?.localRange ? `\u672C\u673A\u53E3\u5F84\uFF08DSH \u4F1A\u8BDD\u65E5\u5FD7${detail.localRange.sourceLabel ? ` \xB7 ${detail.localRange.sourceLabel}` : ""}\uFF09\uFF1A${detail.localRange.from} ~ ${detail.localRange.to} \xB7 ${detail.localRange.days} \u5929 \xB7 ${detail.localRange.files} \u4E2A\u4F1A\u8BDD\u65E5\u5FD7` : `\u672C\u673A\u53E3\u5F84\u4E0D\u53EF\u7528\uFF08${localReasonLabel(detail?.localUnavailable?.reason)}\uFF09`, "\uFF1B\u542B\u5E73\u53F0\u8D26\u5355\u770B\u4E0D\u5230\u7684\u4F9B\u5E94\u5546\uFF08\u706B\u5C71\u65B9\u821F / \u5C0F\u7C73 / GLM / GPT\u2026\uFF09"), /* @__PURE__ */ h(
      StatTable,
      {
        rows: detail?.providers ?? [],
        emptyText: detail?.localUnavailable ? `\u672C\u673A\u53E3\u5F84\u4E0D\u53EF\u7528\uFF1A${localReasonLabel(detail.localUnavailable.reason)}` : "\u672C\u673A\u53E3\u5F84\u6682\u65E0\u6570\u636E"
      }
    )) : tab === "models" && detail?.modelsIncludeLocal ? /* @__PURE__ */ h("div", null, /* @__PURE__ */ h("div", { className: "tlogs-hint" }, "\u5E26\u300C\u4F9B\u5E94\u5546 \xB7\u300D\u524D\u7F00\u7684\u884C\u6765\u81EA\u672C\u673A\u4F1A\u8BDD\u65E5\u5FD7\uFF08\u5E73\u53F0\u8D26\u5355\u770B\u4E0D\u5230\u8FD9\u4E9B\u6A21\u578B\uFF0C\u56E0\u6B64\u6CA1\u6709\u91D1\u989D\uFF09"), /* @__PURE__ */ h(StatTable, { rows: detail?.models ?? [] })) : /* @__PURE__ */ h(
      StatTable,
      {
        rows: tab === "models" ? detail?.models ?? [] : tab === "years" ? detail?.years ?? [] : tab === "months" ? detail?.months ?? [] : monthDetail?.days ?? detail?.days ?? []
      }
    )))
  );
}

// src/client/store.ts
var React8 = __toESM(require("react"), 1);

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
var IDLE_RELOAD_MS = 6e4;
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function messageOf(e) {
  return e instanceof Error ? e.message : String(e);
}
function useTlogs(rpc, initialReason = "mount") {
  const [snapshot, setSnapshot] = React8.useState(null);
  const [detail, setDetail] = React8.useState(null);
  const [monthDetail, setMonthDetail] = React8.useState(null);
  const [series, setSeries] = React8.useState(null);
  const [seriesLoading, setSeriesLoading] = React8.useState(false);
  const [error, setError] = React8.useState(null);
  const [busy, setBusy] = React8.useState(false);
  const alive = React8.useRef(true);
  const inflight = React8.useRef(false);
  const started = React8.useRef(false);
  const seriesSeq = React8.useRef(0);
  const lastSeriesQuery = React8.useRef(null);
  React8.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const reload = React8.useCallback(async () => {
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
  const refresh = React8.useCallback(
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
  React8.useEffect(() => {
    if (started.current) return;
    started.current = true;
    void refresh(false);
  }, [refresh]);
  const loadDetail = React8.useCallback(async () => {
    try {
      const d = await callRpc(rpc, RPC.detail);
      if (alive.current) setDetail(d);
    } catch (e) {
      if (alive.current) setError(messageOf(e));
    }
  }, [rpc]);
  const loadMonth = React8.useCallback(
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
  const loadSeries = React8.useCallback(
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
  const reloadSeries = React8.useCallback(async () => {
    const q = lastSeriesQuery.current;
    if (!q) return;
    await loadSeries(q);
  }, [loadSeries]);
  React8.useEffect(() => {
    const timer = setInterval(() => {
      void reload();
      void reloadSeries();
    }, IDLE_RELOAD_MS);
    return () => clearInterval(timer);
  }, [reload, reloadSeries]);
  const setToken = React8.useCallback(
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
  const logout = React8.useCallback(async () => {
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
  const login = React8.useCallback(async () => {
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
  const [view, setView] = React9.useState(defaultExpanded ? "expanded" : "compact");
  const [detailOpen, setDetailOpen] = React9.useState(false);
  const userToggled = React9.useRef(false);
  const defaultApplied = React9.useRef(false);
  React9.useEffect(() => {
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
