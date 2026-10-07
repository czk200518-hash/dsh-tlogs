/**
 * tlogs — 组件样式。
 *
 * 设计要求（需求 1.1 / 7.3）：
 *  - **不使用** `position: fixed` 或 `position: absolute`；组件完全在文档流内，
 *    由侧边栏页脚的既有布局自然排布
 *  - 紧凑条高 28–32px
 *  - 展开面板就地撑开（把上方内容顶上去），而不是覆盖
 *  - 浅色 / 深色主题都正常显示
 *
 * 主题策略（不猜 token）：直接复用 DSH 真实的主题 token。
 * 这些名字来自 0.2.0-rc.2 的 `@deepseek-ai/dsh-client-ui-theme`：
 *   - 深色主题选择器是 `body[data-ds-dark-theme]`（token 值由主题表翻转，
 *     因此这里无需自己写深色覆盖）
 *   - 文字 `--dsw-alias-label-primary` / `-secondary` / `-tertiary`
 *   - 面板底色 `--dsw-alias-bg-layer-1` / `-2`
 *   - 描边 `--dsw-alias-border-l3` / `-l4`
 *   - 悬停 `--dsw-alias-interactive-bg-hover`
 *   - 强调 `--dsw-alias-state-business-primary`
 *   - 警告 / 错误 `--dsw-alias-state-warn-primary` / `--dsw-alias-state-error-primary`
 *   - 圆角 `--dsw-radius-xs`，字体 `--dsw-font-family`
 *
 * 每个 token 都带 fallback（`var(--token, fallback)`），因此即使宿主的
 * 主题包缺失或改名，组件仍可读、不会出现透明文字。
 */
export const STYLE_ID = 'tlogs-style';
export const PLUGIN_ID = 'tlogs';
export const CSS = `
.tlogs {
  /* ---- 主题 token 别名（带 fallback，宿主 token 缺失也能渲染） ---- */
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

/* ---------- 形态 A：紧凑条（28–32px） ---------- */
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

/* 收起态（图标栏）：只显示总计数字。原先这里放一个求和符号徽标，已按要求删除。 */
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
 * 布局要点：**数字优先**。
 *
 * 原先 .tlogs-metric 里的标签和数字都是可压缩的，容器又是 overflow: hidden，
 * 于是空间一紧就把整行末尾（含数字）裁掉 —— 实测表现为最后一项显示成
 * 「本月 359」而不是完整的「359M」。
 *
 * 现在：数字用 flex 0 0 auto，永不压缩/截断；标签可压缩并可省略号收尾，
 * 空间不足时先牺牲标签、保住数字。
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

/* 展开/收起按钮：必须是**看得见**的按钮。
   此前它是 10px、无边框、用 tertiary 灰的项目符号，在页脚底色上几乎不可辨认。 */
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

/* 数据可能过期角标（需求 5.4） */
.tlogs-stale { flex: 0 0 auto; font-size: 10px; color: var(--tlogs-warn); cursor: help; }

/* 首次全量拉取进度 */
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

/* ---------- 形态 B：展开面板（就地撑开） ---------- */
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

/* ---------- 详细视图（同一容器内切换） ---------- */
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
/* 说明性提示（例如「内置登录不可用，请手动填写」）。 */
.tlogs-hint { color: var(--tlogs-muted); font-size: 10px; line-height: 1.55; }
`;
/**
 * 注入样式表，返回卸载函数。
 *
 * 与官方 `ui-theme` 的 installThemeStyles 保持同一约定：
 * 打上 `data-plugin` / `data-plugin-css` 标记，卸载时移除节点，
 * 满足需求 7.5「插件卸载后不残留 DOM 节点」。
 */
export function installStyles(doc = document) {
    const existing = doc.getElementById(STYLE_ID);
    if (existing)
        return () => { };
    const el = doc.createElement('style');
    el.id = STYLE_ID;
    el.dataset.plugin = PLUGIN_ID;
    el.dataset.pluginCss = `${PLUGIN_ID}/styles.css`;
    el.textContent = CSS;
    doc.head.appendChild(el);
    return () => {
        el.remove();
    };
}
//# sourceMappingURL=styles.js.map