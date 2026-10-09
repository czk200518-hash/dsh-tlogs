# tlogs 去 AI 感评审：来源清单 / 两次削减 / 评分表 / 改动清单

对象：本仓库全部源码（src 42 文件 + test 17 文件 + scripts 7 文件，约 12.7k + 6.6k 行）。
约束：功能、对外 API、依赖、行为**完全不变**；改动仅限风格与表达。
交付形态：代码**原地改写落盘**（不是另存副本，也不是在对话里重贴 1.2 万行）——仓库自身的 `git diff` 即「完整可运行代码」，本文件承载评分表与改动清单，`npm run build` 与 245 项测试是「可运行」的证据。
验收网：`verify:secrets` → `verify:i18n` → `typecheck` → `build` → `node --test`（245 项）。

---

## 0. 结论速览

| 项 | 改前 | 改后 |
|---|---|---|
| 总评分（5×20） | 81 | **92** |
| 注释行（src 全目录） | 3 116 | 2 612（−504） |
| src 行数（全目录 39 文件） | 12 728 | 12 127（−601） |
| src 改动量 | — | 38 文件 / +1 719 / −2 320 |
| test 改动量 | — | 5 文件 / +15 / −15（仅注释与用例标题） |
| 对外 API / 依赖 / 行为 | — | 零变更 |

最终门禁：`verify:secrets` OK（172 文件）· `verify:i18n` OK · `typecheck` 0 错 · `build` 成功 · 测试 **245 项 / 243 通过 / 0 失败 / 2 跳过**（跳过项为需要外部 Python 的 golden 对拍，与本次改动无关）。

---

## 1. 第一步：通读全部代码，AI 感来源清单

按「类型 → 出现规模 → 代表位置」列出。带 ★ 的是靠人多写不出来的那类。

**A. 注释是「考古日志」而不是说明书** ★（最重的来源，几乎每个文件都有）
注释记录的是需求编号、原型脚本行号、实测日期、被删掉的旧实现、当时的排查过程，而不是代码当下为什么这样写。

| 形态 | 例子 |
|---|---|
| 指向已删除规格书 | `对应需求 1.5「数据刷新」与 5.4「错误处理」`（cache.ts）、`需求 2.2 给出三条路径`（desktop-login.ts） |
| 指向原型脚本行号 | `py:61-88 的逐行翻译`、`// py:169-171 grand[t] += agg[t]`（usage-client/parser/history） |
| 墓碑注释 | 整段 `已移除：方案 A（按名字盲猜宿主服务的 token getter）…那是 confused deputy：1. … 2. …`（desktop-login.ts） |
| 带日期的取证记录 | `实测 2026-10-08 北京时间 12:07 平台该日桶仍为 0；12:16 补到 589 万、12:34 补到 3022 万`（session-usage.ts、usage-merge.ts） |
| 版本考古 | `实测（0.2.0-rc.2，dsh-credentials-local）确认的方法签名`、`实测 359M`、`313px 侧边栏` |

**B. 注释里塞文档标记**
TS 注释里出现 markdown 标题 `## 为什么需要它`、markdown 表格（provider-meta.ts、usage-merge.ts 文件头）、代码块（```` ``` ```` 包住的公式与 dsh-tools 源码片段）、`**加粗**`（42 处）、`⚠️✅🚨`、`① ② ③`（16 处）、`----- 分隔横幅`（`// ---------- 凭据 ----------`、`// ---- ① 通过 sessionQuery 枚举 ----`）。

**C. 空话注释**
由名字就能读出的复述：`/** 是否可用。 */`、`/** 行情缓存。 */`、`/** 插件入口。 */`、`// 判断日期键是否落在窗口内`、styles.ts 里每块 CSS 上方复述类名的注释。

**D. 事实描述混进注释**
需求条目、验收条目、模型契约混在实现注释里：`（需求 5.3 最小化）`、`覆盖验收 7.1 与 7.3`、`provider 拥有全部五个 Platform 客户端头`。

**E. 模板化命名 / 过度抽象**
`TlogsHostContext`、`ConnectionLike`、`peek(ctx, name)`、`safeService`、`readUsageTotals`、`pyStr`、`oneLine`、`suffixOf`、`reasonLabel`（后两个是纯直通转发）、`SCOPES = COMPACT_METRICS`（同义别名）。

**F. 机械式结构**
`buildCards()` 里 5 处完全同形的 throwaway 推入；`snapshot()` 里 11 分支各写一遍同样的对象字面量；`project.ts` 里手抄五字段累加；`desktop-login` 里 `readUsageTotals` 写了两遍同样的归一化。

**G. 千篇一律的错误处理**
`catch { /* ignore */ }` 与 `e instanceof Error ? e.message : String(e)` 遍布全仓——这一条**判定为合理**：插件边界宽（宿主服务形状未知），吞异常并降级正是设计意图，不做削减。

**H. 注释与代码/口径不同步**
`types.ts:320` 里 `days` 的 JSDoc 被挤成与下一行字段同处一行；`project-history.ts` 的 `record()` 注释写「stat 全零时返回 false」而实现从未检查；`project.ts` 注释提到 `ctx.sessions.list()` 语义与实际调用不一致。

规模：这些形态在 42 个 src 文件里 100% 命中；`test/**` 另有 60 行时代标记（13 × 需求编号、25 × 实测、5 × 早前/此前、13 × ①②③、其余为已移除/验收条目）。

---

## 2. 第二步：第一次削减（等价改写）

### 2.1 全局手法

| # | 手法 | 理由 |
|---|---|---|
| 1 | 文件头压到 2–5 行：这文件负责什么 + 与谁交互 + 硬约束 | 考古段落对读者零信息，删掉不影响理解 |
| 2 | 删 `需求 N`、`验收 N`、`py:NN`、`方案 A/B/C/D` 编号 | 指向的文档已不在仓库里，读者无法跟进 |
| 3 | 删实测日期与数字取证，只留结论 | 「滞后 10~30 分钟」是当下仍需知道的口径，「12:07 / 589 万」不是 |
| 4 | 去 `**加粗**`、markdown 标题/表格/代码块、`⚠️✅🚨`、`①②③`、分隔横幅 | TS 注释不是文档，这些标记只制造视觉噪声 |
| 5 | 删复述型注释，保留解释 why 与边界的注释 | 注释的价值在于代码里读不出来的信息 |
| 6 | 墓碑注释只留当下的约束句 | 「不按名字猜宿主服务」仍要留，但不必写成检讨书 |
| 7 | 去掉只转发一次的间接层、合并重复字面量、同义别名并回事实来源 | 减少读者要跟的跳转 |
| 8 | 注释与代码同步（改掉与实现不符的描述） | 错误注释比没有注释更糟 |

### 2.2 明确保留的硬约束（一条都没丢）

- 日期一律按 **UTC 日**切桶（换成本地日会让北京时间 00:00–08:00 的「今日」安静地显示 0）；
- 金额是 16 位小数字符串，不能用 `Math.trunc` 解析；
- `/usage/amount` 的 `biz_data` 是对象、`/usage/cost` 的是数组，解析前必须 `unwrapBizData`；
- 账号会话凭据只认 `x-dsh-auth-token` 头；
- 工具返回值直接进模型上下文，所以项目 id 只能是哈希、绝对路径不出现在任何出参；
- fork 种子事件（`time < createdAt`）必须剔除，否则用量翻倍；
- 金额/逐日明细的 `daysFetched` / `costFetched` 是「已抓过」的凭据，缺标记的行必须回补；
- 绝不跟随重定向（自定义头会被带到别的源）；
- 记凭据租约（刷新开始取、结束释放，热路径不碰令牌）。

### 2.3 逐文件

| 文件 | 主要动作 | 行数 |
|---|---|---|
| `src/types.ts` | 删「逐字段与 Python 对拍」头与加粗；修 `days` 文档被挤行；修「供应 商」 | +112/−107 |
| `src/config.ts` | 头压 3 行；`SCOPES` 同义别名并回 `COMPACT_METRICS`；抽出 `nonEmpty()` 消 5 处 `trim().length > 0` | +74/−75 |
| `src/service.ts` | 5 处同形卡片 → `windowCard()`；11 分支 → `tokens()`/`money()` 两个取值函数；月份计划的两段循环合并；`YearMonth` 类型替代重复字面量 | +340/−341 |
| `src/index.ts` | `peek` → `optionalService`；合并 `autoRefreshSeconds * 1000`；精简双面结构说明 | +117/−117 |
| `src/api/parser.ts` | 删 `py:` 与「逐行翻译」头；`round8(x)` → 已有 `toMoneyAmount(x)` ×2 并删私有副本；内联单次使用的 `usageList` | +74/−75 |
| `src/api/usage-client.ts` | `pyStr` → `toText`、`oneLine` → `singleLine`、`num` → `amount`；删取证段落保留安全结论 | +94/−94 |
| `src/auth/token-manager.ts` | 6 条编号优先级清单 → 自然句（保留真实顺序与「1/2 是静态配置、退出登录清不掉」） | +92/−93 |
| `src/auth/desktop-login.ts` | 删整段墓碑注释与 markdown 契约块；返回值恒含 `headers` 键（等价） | +60/−35 |
| `src/auth/credentials-store.ts` | 头压 5 行；删除零引用导出 `CANDIDATE_TOKEN_REFS`（**已回滚**，见 §5.1） | +12/−12 |
| `src/store/project.ts` | 头 27 行编号清单 → 段落（保留读取路径与映射）；`safeService` → `optionalService`；五字段手抄累加 → `for (const t of TOKEN_TYPES)`；删 `① ②` 横幅 | +53/−53 |
| `src/store/session-usage.ts` | 删带日期的取证与加粗；markdown 标题改自然段 | +约90/−约90 |
| `src/store/usage-merge.ts` | markdown 表格与代码块 → 散文（保留逐日取大的理由） | +约60/−约60 |
| `src/store/history.ts` | 删 `py:` 引用；`plan()` 的 20 行回补考古 → 3 行机制说明（逻辑逐行未动） | +74/−74 |
| `src/store/cache.ts`、`persist.ts`、`dates.ts`、`provider-meta.ts`、`project-history.ts` | 删需求编号/加粗/表格；保留 TTL 口径、原子写入、UTC 日切桶、通道判定 | 各 ±(17–50) |
| `src/rpc.ts`、`src/tools.ts` | 删版本号与「曾经踩过」叙述；保留成品 schema 不能换成 spec 表这一约束 | ±(27–43) |
| `src/client/*`（18 文件） | 注释统一改英文短句（该目录既有约定，且 `verify-i18n` 据此设门禁）；删「实测修正」「原先…」考古与分隔横幅；`suffixOf`/`reasonLabel` 内联；`<Fragment key>` → `span key` | 约 ±870 |
| `test/*`（5 文件） | 只删需求编号与验收条目这类跨文档引用（13 处）与 3 处用例标题里的编号 | +15/−15 |

---

## 3. 第三步：第一次削减打分

| 维度 | 得分 | 扣分理由 |
|---|---|---|
| 命名自然度 | 17/20 | `optionalService` 等已贴合；但 `readUsageTotals`、`XxxLike`、`TFileDays` 属跨文件 API 未动 |
| 注释合理性 | 17/20 | 主营考古已清；`session-usage.ts` / `usage-merge.ts` / `rpc.ts` / `tools.ts` 仍在首轮范围外，仍有加粗、markdown 表格、⚠️、实测日期 |
| 结构简洁度 | 16/20 | 只做了低风险的局部合并；`service.ts` 的月份计划仍绕、`project.ts` 的冷热两路读取仍交叉 |
| 业务贴合度 | 17/20 | 口径约束全留；但注释语言混用（中文/英文按目录分），同一仓库两种语气 |
| 可运行性 | 20/20 | `typecheck` 0 错、`build` 成功、245 项测试 243 通过 0 失败 |
| **合计** | **87** | 触发第二次削减 |

---

## 4. 第四步：第二次削减（87 → 92）

### 4.1 针对扣分项的动作

| 目标 | 动作 |
|---|---|
| 补首轮遗漏的 4 个文件 | `session-usage.ts`：删带日期的取证、`## 标题`、全部 `**加粗**`；`usage-merge.ts`：markdown 表格 + ```` ``` ```` 公式块 → 散文，去 `⚠️`；`rpc.ts`：去版本号与「已停用」加粗；`tools.ts`：删 dsh-tools 源码片段与 `曾经的 bug` 叙述 |
| 一致性 | 全文再扫一遍 `**`、`⚠️`、`实测`、需求编号：src 归零（仅留 3 处语义必要的行内强调，如 `**` 属于 glob 字面量） |
| 测试的跨文档引用 | 删 13 处 `需求 N` / `验收 N` 与 3 处用例标题编号；`早前…` 历史改为当下句。**测试行为与断言一字未动** |

### 4.2 为什么不再往下削（这两项是刻意的）

1. **`实测`（测试与注释里共 25 处）保留**：它们是「这条断言为什么必须存在」的唯一证据（例如「实测症状是末尾指标被右边缘裁掉」）。删掉就只剩干巴巴的断言，后来者无法判断能否放宽。它不是 AI 感，是取证记录。
2. **`test/**` 的行为与断言不改**：测试是本次等价改写的唯一验证手段，动它会让「行为不变」这个结论失去意义。只清注释与用例标题。

### 4.3 前后对比

| 维度 | 第一次 | 第二次 | 变化原因 |
|---|---|---|---|
| 命名自然度 | 17 | 18 | 删除只转发一次的包装后，读者路径变短；跨文件 API 名仍为兼容保留 |
| 注释合理性 | 17 | **19** | 首轮遗漏文件清零，全仓注释风格统一；仅少数条目为解释跨文件读取路径而偏长 |
| 结构简洁度 | 16 | 17 | 第二次以注释为主，只顺带删了 3 处转发层 |
| 业务贴合度 | 17 | **19** | 口径约束改写成自然句后仍逐条在位，且不再与实现漂移 |
| 可运行性 | 20 | 19 | 因第二轮改动了 4 个逻辑文件与 5 个测试文件，改为扣除「需重跑全门才能确认」的风险分；实测结果仍为满分表现 |
| **合计** | **87** | **92** | ≥ 90，停止迭代 |

### 4.4 仍扣分的具体位置（如实列出）

| 位置 | 扣分 | 为什么没动 |
|---|---|---|
| `service.ts:192` `end()` | 结构 | 取 UTC 月与本地月的较后者是刻意为跨月边界服务的，抽走会丢语义 |
| `store/project.ts` `list()` 里 sessionQuery 与 sessions.list 两路补集 | 结构 | 两路覆盖冷热会话不同集合，合并需重新验证宿主行为 |
| `store/session-usage.ts` `serialize()` 的嵌套元组类型 | 结构 | 落盘格式已入库，改形状会破坏旧缓存兼容 |
| `service.ts` 类注释 8 行 / `types.ts` 若干条目 2–3 行 | 注释 | 每条都在解释不可从代码推断的边界 |
| `scripts/*.mjs`（7 文件） | 注释 | 本次未纳入（门禁脚本，改动风险大于收益） |
| `styles.ts` 的 `.tlogs-src-pending` 规则零引用 | 结构 | 删除属行为面改动（CSS 死规则），未获授权；已记入 CHANGELOG「已知问题」 |
| 本文件第一版把仓库绝对路径写进了正文 | — | 命中 `verify:secrets` 的本地拒绝清单（本机路径片段），门禁直接 FAILED；已改为「本仓库 / `<仓库根目录>`」。教训：交付文档也是入库文件，写路径要用占位符 |

---

## 5. 改动清单（行为等价的完整账）

### 5.1 唯一一处「对外 API 变更」及其回滚

改到 `credentials-store.ts` 时删除了零引用导出 `CANDIDATE_TOKEN_REFS`（src 与 test 均无引用）。复核后判定它仍属对外 API 面，与「对外 API 完全不变」冲突，**已回滚**并保留原样。

### 5.2 非注释性质的等价简化（全部逐条给出）

| # | 文件 | 改动 | 等价性依据 |
|---|---|---|---|
| 1 | `api/parser.ts` | `round8(x)` → `toMoneyAmount(x)` ×2，删私有 `round8` | 两者仅在 `-0/NaN/Infinity` 上可能不同，而这两个入参分别来自 `moneyTotal()`（有限项之和）与正数分支 `sum > 0`，不可达 |
| 2 | `api/parser.ts` | 内联单次使用的 `usageList`；`inputTokens` 收成单表达式 | 无中间态，纯展平 |
| 3 | `api/usage-client.ts` | `pyStr`→`toText`、`oneLine`→`singleLine`、`num`→`amount` | 纯改名，无调用点语义变化 |
| 4 | `auth/desktop-login.ts` | `return headers ? {token,origin,headers} : {token,origin}` → `return {token,origin,headers}` | 唯一消费方 `buildHeaders` 用 `if (extraHeaders)` 判空；`headers: undefined` 与缺属性在 `in`/展开/`JSON.stringify` 下不可区分（测试只断言 `.headers` 子对象） |
| 5 | `store/project.ts` | `safeService`→`optionalService`（文件内私有）；五字段手抄 `+=` → `for (const t of TOKEN_TYPES) acc[t] += stat[t]` | `TOKEN_TYPES` 恰好是全部五个键；同序同值 |
| 6 | `client/format.ts` | `group()` 上移并被 `formatFull` 复用；`case undefined` 与 `case 'not-scanned'` 合并为 fallthrough | 同一个正则的重复副本；两个 case 返回同一 key |
| 7 | `client/chart-utils.ts` | 删 4 处多余非空断言 `!` | `noUncheckedIndexedAccess: false`，类型与运行时不变 |
| 8 | `client/charts.tsx` | 删单次转发 `suffixOf` → 直接用 `metricSuffix` | 同函数同参序 |
| 9 | `client/expand-panel.tsx` | 删单次转发 `reasonLabel` → 直接用 `localReasonLabel` | 原本就是 1:1 直通 |
| 10 | `client/compact-bar.tsx` | `<Fragment key>` 包裹单个 `span` → key 直接放 `span` | Fragment 不产 DOM，渲染结果与 React key 语义一致 |

### 5.3 结构性合并（`service.ts`，本轮最大的一处）

| 原 | 现 | 说明 |
|---|---|---|
| 5 处同形 `cards.push({scope,label,stat,stale,source})` | `windowCard(scope,label,mergedWindow)` | 字段与取值次序完全一致 |
| 11 分支各写一遍对象字面量 | `tokens(scope,label)` / `money(scope,label)` 局部函数 | `unit` 字面量与 `source` 取值不变；今日请求数那一项仍单独构造（靠 `unit` 区分同 scope 两项） |
| `need.total` 与 `need.current` 两段各自 `plan()` 后塞进同一个 Map | 两段保留、`wanted.size === 0` 提前返回 | 合并计划的结果集合不变（Map 插入顺序不影响后续排序） |
| `fetchCostFor` 前先取 `row` 再判 `costFetched` | 同序，`row` 在 `parseBizData` 之后就取 | 中间无 await，读到的仍是同一行 |
| 重复的 `{year,month}` 字面量 | `YearMonth` 别名 | 纯类型别名 |

### 5.4 行为不变的三重证据

1. **门禁全绿**：`verify:secrets`（172 文件）· `verify:i18n` · `typecheck` 0 错 · `build` 成功 · 245 项测试 243 通过 0 失败 2 跳过（跳过项需外部 Python，改前改后一致）。
2. **剥注释后逐字节比对（38 个 src 文件）**：25 个文件在剥掉注释与空白后与改前**逐字节相同**；其余 13 个的差异全部落在 §5.2 / §5.3 已逐条列出的等价简化上，没有第 14 处未申报的改动。逐文件差异量：`service.ts`（结构合并）、`parser.ts`、`config.ts`、`project.ts`、`expand-panel.tsx`、`format.ts`、`charts.tsx`、`usage-client.ts`、`compact-bar.tsx`、`desktop-login.ts`、`index.ts`、`chart-utils.ts`、`tools.ts`。
   test 侧 5 个文件只改了注释与 3 处用例标题，剥注释后同样全等。
3. **常量/文案/排序清单**：所有数值阈值（30 min / 5 min / 1500 / 500 / 3660 / 4096 / 5000 / 1e8 / 日历 42 格…）、日志与错误文案、排序方向、月份枚举顺序、localStorage key（`tlogs.lang`）、语言解析顺序、CSS 属性值、i18n 字典值均逐项核对未变。

### 5.5 仓库文档

- `CHANGELOG.md`：新增「未发布 → 整理：源码表述层重写（行为零变化）」一节，说明改动性质与门禁结果。
- `README.md` / `README.en.md`：无需改动——本次不涉及对外配置、界面与安装方式；两份文档按既有约定只写读者可见的结论。

---

## 6. 复现验收

```powershell
cd <仓库根目录>
npm run verify:secrets; npm run verify:i18n; npm run typecheck; npm run build; npm test
```

预期：四道门禁全绿，测试 `245 / pass 243 / fail 0 / skipped 2`。

配套：插件在 DSH 里需要**重载**才会用到新的 `lib/`。

---

## 7. 追加一轮：注释精简与注释闸门

第一轮把注释从「考古日志」改成「说明书」之后，体积仍偏大（注释行 2 503 / 非空行 10 996 = 22.8%）。
本节记录随后的**只动注释**精简，以及把标准固化成门禁的过程。

### 7.1 手法：压缩与合并，不是删信息

| 手段 | 做法 |
| --- | --- |
| 压缩 | 5~8 行的多行 JSDoc 块，用同样多的信息压成 2~4 行；理由、口径、常量来历一条不丢 |
| 合并 | 同一 `interface` / `type` / `class` 里成组的逐字段单行注释，合并到类型上方的一段块注释 |
| 删除 | 只删「把名字读了一遍」的复述，以及信息量近乎为零的标签式注释 |

### 7.2 结果

| 指标 | 改前 | 改后 |
| --- | --- | --- |
| `src` 注释行 | 2 503 | 1 886 |
| 注释行 / 非空行 | 22.8% | 18.2% |
| 分文件最大降幅 | — | `types.ts` 229→161、`service.ts` 210→137、`token-manager.ts` 173→133 |

### 7.3 校验

- **逐字节等价**：42 个文件剥掉注释与空白后与改前快照比对，41 个完全相同。
- **唯一差异**：`client/expand-panel.tsx` 里 3 个 JSX 注释连同 `{/* … */}` 容器一起删除。
  `{}` 在 React 里渲染为空，行为等价 —— 这是本轮唯一的代码级差异，已在 CHANGELOG 记账。
- 门禁全绿：`verify:secrets`、`verify:i18n`、`verify:comments`、`typecheck`、`build`、245 项测试。

### 7.4 注释闸门：`npm run verify:comments`

把「每条注释都要给出代码之外的信息」拆成三条机械规则，全部为硬错误：

1. **禁用形态**：需求条目编号、`py:NN` 原型行号、注释里的加粗、⚠️✅🚨、分隔线横幅。
2. **复述型单行 JSDoc**：注释实词与该标识符的词覆盖率 ≥ 0.6 且剩余信息 ≤ 4 字符。
3. **注释密度**：`src` 注释行 / 非空行 > 19% 即失败。

第 3 条是**棘轮**而非目标：它防的是新代码把注释再堆回去，不表示注释越少越好。上限没有压到
更低（例如 17%），是因为在禁用形态与复述型都已 0 命中的前提下，再削只能删掉解释 why 的注释
——那与本次整理的标准相反。

