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

export const STYLE_ID = 'tlogs-style'
export const PLUGIN_ID = 'tlogs'

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
  /*
   * 金额专用色。
   *
   * 为什么不复用「成功绿」：金额是**中性计量**，不是状态。用绿色会让人以为
   * 「花得多 = 好」，而这里只是把 ¥ 与旁边的 token 数在视觉上分开。
   * 选一个在浅色/深色主题下都有足够对比度的琥珀色作为主色。
   */
  --tlogs-money: var(--dsw-alias-state-warn-primary, #c2740a);
  --tlogs-radius: var(--dsw-radius-xs, 4px);
  --tlogs-gap: 6px;

  /*
   * 图表配色。
   *
   * 前三个是堆叠柱的三段（输入·缓存命中 / 输入·缓存未命中 / 输出）；后三个是饼图的
   * 备用色。刻意选在浅色与深色主题下都能分辨的中间明度，且不依赖宿主的语义 token
   * （它们没有「图表色板」这一类）。
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

/* ---------- 形态 A：紧凑条（28–32px） ---------- */
.tlogs-compact {
  display: flex;
  align-items: center;
  gap: var(--tlogs-gap);
  /* 原来是写死的 height: 30px —— 指标换行时第二行会被裁掉，故改成 min-height。 */
  min-height: 30px;
  padding: 3px 6px;
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
 * 布局要点：**数字优先，标签也不许被压没**。
 *
 * 历史：.tlogs-metric 里的标签和数字都可压缩、容器又是 overflow: hidden，
 * 空间一紧就把整行末尾（含数字）裁掉 —— 实测最后一项显示成「本月 359」
 * 而不是完整的「359M」。于是改成数字 flex: 0 0 auto。
 *
 * 但那只是把牺牲转嫁给了标签：标签 flex: 0 1 auto + 省略号，在 313px 侧边栏、
 * 四个指标时**标签全部被压没**，紧凑条只剩「8.9B · ¥678.87 · ↖561M · ⚡2.4K」。
 *
 * 现在的规则：**数字与标签都不可收缩**（flex: 0 0 auto），指标行整体换行
 * （flex-wrap: wrap）。宁可紧凑条多占一行，也不留一个认不出的碎片。
 * 另外默认不再把金额放进紧凑条（见 src/config.ts 的 compactMetrics 默认值）。
 */
.tlogs-metrics {
  display: flex;
  align-items: center;
  /* 指标少的时候，把空余宽度摊到指标之间，而不是全堆在右侧变成一片空白。
     column-gap 只是**下限**；实际间距由 .tlogs-metric 的 flex-grow 均分。 */
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
  /* 仍然不可收缩（gap/换行保证内容不被压碎），但允许**伸展**：
     三个指标各分到一份等量空余宽度，于是「总 / 今日 / 请求」的间距随
     侧边栏变宽而自动变大，右侧不再空一大块。指标多到几乎填满一行时，
     可分配空余趋近 0，自动退化回上面的 12px 下限。 */
  flex: 1 0 auto;
}
.tlogs-metric-label {
  color: var(--tlogs-muted);
  font-size: 10px;
  /* 不参与收缩：宁可整项换行，也不要把「今日」「请求」压成认不出的碎片。 */
  flex: 0 0 auto;
  white-space: nowrap;
}
.tlogs-metric-value {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: -0.01em;
}
/* 紧凑条上的金额：与 token 数字同字号，但用金额色区分，并保留 ¥ 符号。 */
.tlogs-metric-money { color: var(--tlogs-money); }

/* 口径徽标：只在数字不是纯平台口径时出现。
   「本机」= 本机会话日志口径（实时、含平台看不到的供应商）；
   「合并」= 平台 + 本机合并；「¥结算中」= 金额那一栏平台还没结算完。 */
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
/* 注：曾有一条「¥结算中」徽标（.tlogs-src-pending）。平台当天结算滞后是**常态**
   （约 10~30 分钟），那个徽标几乎永久常亮，只剩噪声 —— 已从卡面移除，
   结算滞后只在卡片的 tooltip 里说明。这条样式保留给将来真正的告警态复用。 */
/* 表格里行内使用的「官方 / 第三方」徽标：跟在名称前面，去掉左侧外边距。 */
.tlogs-src-inline { margin: 0 4px 0 0; vertical-align: middle; display: inline-block; }
/* 注：原先这里还有一条 .tlogs-sep（指标之间的「·」分隔符）。指标行现在允许
   换行，分隔符会孤零零留在行首，因此已从 compact-bar.tsx 里移除。 */

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
.tlogs-iconbtn:disabled { opacity: 0.45; cursor: default; }
.tlogs-iconbtn:disabled:hover {
  color: var(--tlogs-fg);
  border-color: var(--tlogs-border-strong);
  background: var(--tlogs-card-bg);
}
/* 收起态（图标栏）空间不足：隐藏手动刷新，只留展开/收起。 */
.tlogs-collapsed .tlogs-refresh { display: none; }

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
/*
 * 高度上限刻意放宽。
 *
 * 原来是写死的 300px：五张卡片在双列布局下需要约 370px，于是第五张（当月消耗）
 * 被截断、必须滚动才能看到——实测截图确认。现在改用视口相关的上限，常规窗口下
 * 五张卡片可以一次看全；overflow-y: auto 只作为极小窗口的最后兜底。
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
 * 总消耗是主指标：**始终占满一整行**（与网格同宽），其余卡片两两成行。
 *
 * buildCards() 保证「总消耗 Token」永远是第一张卡片，所以用 :first-child 即可。
 * 早前这里是「最后一张在奇数位时横跨两列」，那是为了让落单的当月消耗不至于半行——
 * 现在主指标占了整行，剩余四张正好两两成行，那条规则反而会挤出空位，故移除。
 */
.tlogs-w-full .tlogs-cards > :first-child { grid-column: 1 / -1; }

/* 卡片排版压紧：五张卡片要能一次看全，不能靠滚动。 */
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
  /* 允许换行：徽标宁可另起一行，也不要把标题压成「今…」「当…」（实测踩过）。 */
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
 * 三项拆分固定成 **3 列网格**，标签在上、数值在下。
 *
 * 原来是 flex + flex-wrap：双列布局下每张卡片只有约 145px（内容约 131px），
 * 三组「标签 + 数值」一行放不下，于是每张卡片换行位置各不相同 ——
 * 「今日消耗」显示成「输入 559M 输出 1.7M / 请求 2.4K」，
 * 而「当前项目消耗」挤在一行，两张卡片高度还不一样，看上去就是一团。
 *
 * 固定 3 列后每列约 (131 - 2×6) / 3 ≈ 40px：标签（2 字 @9px ≈ 18px）
 * 与数值（@10.5px，最长 5 字符 ≈ 30px）都能完整放下，
 * 五张卡片高度天然一致，也不再出现半行。
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

/* 卡片的主数字行：左侧 token 总量，右侧金额。
   用 flex + 基线对齐，并让金额 flex: 0 0 auto（永不压缩）——
   侧边栏很窄，一旦金额被压缩就会退化成「¥1…」，那比不显示更糟。 */
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

/* 平台账户概览（余额 / 官方累计消费）。 */
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
/*
 * 名称列：**不截断**。
 *
 * 原来是 max-width: 9em + ellipsis，实测把模型名切成了
 * deepseek-v4.1-flash-expires-on-0… / deepseek-chat & deepseek-reaso…，
 * 用户直接反馈「名字显示不全」。这里改成允许换行（overflow-wrap: anywhere 处理
 * 「provider · model」这种长串），并给它一个下限，让数字列先让位。
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
/* 金额列：用金额色与旁边四个整数列区分开（它们是 token / 次数，不是钱）。 */
.tlogs-table td.tlogs-td-money { color: var(--tlogs-money); font-weight: 600; }
.tlogs-empty { padding: 10px 4px; text-align: center; color: var(--tlogs-muted); font-size: 11px; }
.tlogs-scroll { max-height: 190px; overflow-y: auto; overscroll-behavior: contain; }
.tlogs-error { color: var(--tlogs-danger); font-size: 10px; line-height: 1.5; }
/* 说明性提示（例如「内置登录不可用，请手动填写」）。 */
.tlogs-hint { color: var(--tlogs-muted); font-size: 10px; line-height: 1.55; }

/* ---------- 详细数据弹窗（浮层） ---------- */
/*
 * 这是全文件唯一使用 position: fixed 的地方。
 * 紧凑条与展开面板仍然严格留在文档流内（需求 1.1）—— 那一条针对的是侧边栏页脚里的
 * 内嵌组件；弹窗本质上就该是浮层，否则在窄侧边栏里放不下日历与表格。
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
 * 弹窗尺寸**永远锁定**：宽高都写死（仅随视口收缩），切任何页签都不变。
 *
 * 历史（两次反馈的结论）：
 *  1. 早先是 max-height: 82vh 加 body 的 min-height，高度由内容决定 → 切页签伸缩。
 *     用户明确要求「无论切换到哪个标签，弹窗尺寸永远锁定」，于是写死宽高。
 *  2. 写死之后日历页签（默认页签、内容最短）下方空出一条（用户标注「红线下方那截不要」）。
 *     **但解法不是把弹窗改成贴内容** —— 那会推翻 1。正确解法是让**内容去长满**这块
 *     高度：日历网格的行高改成 minmax(52px, 1fr) 并 flex 伸展（见下），
 *     表格/图表这类超长内容在 body 内滚动。
 *
 * 一句话：弹窗外框恒定，缺的高度由日历自己填满。
 */
.tlogs-modal {
  display: flex;
  flex-direction: column;
  width: min(880px, 94vw);
  /* 锁定尺寸；上限随视口收缩（短视口下也不会顶出屏幕）。 */
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
  /* 把剩余高度全部吃掉并在内部滚动：body 的高度不再由内容决定。 */
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.tlogs-table-wrap { max-height: 52vh; overflow-y: auto; overscroll-behavior: contain; }

/* ---------- 日历 ---------- */
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
 * 行高下限 52px，上限不限（1fr）：弹窗高度是**锁定**的，日历必须自己长满
 * 这块高度，否则锁定高度就会在日历下方变成一条空白 —— 这是「尺寸永远锁定」
 * 与「日历下方不留空白」两条要求的唯一交点。
 *
 * 行高下限仍然 52 而不是 40：每格现在是三行（日号 / token / 金额）。金额那一行
 * **无条件**占位（无数据时渲染空串），所以有金额与没金额的格子高度仍完全相同 ——
 * 一旦按需渲染，切月时高度又会跳，那正是「固定 42 格」要解决的问题。
 */
.tlogs-cal {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  /*
   * 第一行是星期标题（保持紧凑，不参与分摊），其余 6 行是日期格：
   * 用 minmax(52px, 1fr) 把「锁定高度多出来的部分」按比例摊给它们。
   * 日历**始终渲染 42 格**（见 detail-modal.tsx），所以正好 1 + 6 行。
   */
  grid-template-rows: auto repeat(6, minmax(52px, 1fr));
  /* 兜底：万一将来某个月不是 6 行，隐式行也要同样的下限语义。 */
  grid-auto-rows: minmax(52px, 1fr);
  gap: 3px;
  /* body 是 flex 列：让网格吃掉剩余高度，否则锁定高度会变成日历下方的空白条。 */
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
/* 金额行：即使没有金额也保留这一行（min-height 占位），保证每格行数恒定。 */
.tlogs-cal-money {
  min-height: 11px;
  font-size: 9px;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--tlogs-money);
  white-space: nowrap;
}

/* ---------- 图表（详细数据弹窗的「图表」页签） ---------- */
/*
 * 全部是内联 SVG，几何换算在 chart-utils.ts（有单测）。这里只管颜色与排版：
 * 柱/线的填充一律走 --tlogs-cN，因此浅色与深色主题自动跟随。
 *
 * 关于高度：每张图的高度由 viewBox 决定、宽度 100% 等比缩放，所以切换范围/粒度
 * 时卡片高度不会跳（点数变化只影响柱宽与标签密度）。
 */
.tlogs-chart-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
.tlogs-ctl-group { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.tlogs-ctl-label { font-size: 10px; color: var(--tlogs-muted); white-space: nowrap; }
.tlogs-chart-select { flex: 0 1 auto; min-width: 118px; max-width: 220px; }
.tlogs-chart-date { flex: 0 1 auto; min-width: 132px; }

/*
 * 图形子标签行：紧贴主页签下面，右侧留出「构成维度」的位置。
 * 行本身用固定高度，这样切子标签（或让右侧按钮出现/消失）不会挪动下面的内容。
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
 * 图形舞台：**固定最小高度**。
 *
 * 三张图的高度天然不同（折线 220、堆叠柱 236、环形 170）。给舞台一个统一的下界，
 * 再让卡片撑满，切子标签时下方内容不会上下跳 —— 加上弹窗外框本身固定，
 * 整体就是「怎么点都不动」。
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
/* 柱子整体在悬停时提亮，命中区由上面的透明矩形承担。 */
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

/* ---------- 设置页签（语言） ---------- */
/*
 * 定宽内容块：弹窗很宽，语言选项铺满整行会显得空。
 * 三个选项做成一行 "radio + 文字" 的小卡片，选中态用强调色描边。
 */
.tlogs-settings { display: flex; flex-direction: column; gap: 10px; max-width: 520px; }
.tlogs-settings-title { font-size: 13px; font-weight: 600; }
.tlogs-settings-desc { max-width: 100%; }
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
 * 注入样式表，返回卸载函数。
 *
 * 与官方 `ui-theme` 的 installThemeStyles 保持同一约定：
 * 打上 `data-plugin` / `data-plugin-css` 标记，卸载时移除节点，
 * 满足需求 7.5「插件卸载后不残留 DOM 节点」。
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
