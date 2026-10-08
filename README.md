# tlogs — DSH 侧边栏 Token 用量组件

> **tlogs** = **t**oken **logs**。在 DeepSeek Harness 桌面端**侧边栏页脚**常驻显示用量：
> 紧凑条看总计与今日，展开是完整明细，「详细数据」弹窗可按月回溯、按模型与供应商拆分。
> 数字经 host → 浏览器 RPC 直达侧边栏，**默认不进入模型上下文**；它参与侧边栏正常布局 ——
> **不是悬浮球，不是独立窗口。**

<!-- 📷 展示图待补：把图放进 docs/images/ 后替换成
     ![侧边栏紧凑条与展开面板](docs/images/overview.png)
     ![详细数据弹窗](docs/images/detail-modal.png)  -->

## 它做什么

| 形态 | 内容 |
| --- | --- |
| **紧凑条**（常驻页脚） | `总 / 今日 / 请求`，右侧 `↻` 刷新 + `▾` 展开；侧边栏收起时只留总计。**不放金额**（页脚太窄） |
| **展开面板**（就地撑开） | 七张卡片：总消耗 / **当前项目**（可点击切换）/ 今日 / 当周 / 当月 / 近 7 天 / 近 30 天，每张含输入·输出·请求 + ¥ |
| **详细数据弹窗** | 日历 / 图表（折线·饼图·堆叠柱，**手写 SVG，不引图表库**）/ 模型 / **供应商** / 年 / 月 / 当月按天 |

## 口径（对账前必读）

| 窗口 | 定义 |
| --- | --- |
| 今日 / 当周 / 当月 | **平台日（UTC）**：UTC 今天 / 周一至今 / 月 1 日至今 → **北京时间 08:00 换日** |
| 近 7 天 / 近 30 天 | **滚动窗口**（含今天往前数 N 天），与开放平台控制台「时间维度」同口径 |

- 面板里直接写着这一行：`统计口径：平台日（UTC）· 北京 08:00 换日`（只写时区会被误读成「北京 0 点换日」）。
- ⚠️ **账单日界 ≠ 用量接口日界**：官方**计费**按北京时间日（0 点）结算，而**用量接口**的日桶按 **UTC 日**（北京 08:00）切 —— 跨日处最多差 8 小时。对账先看这条，再怀疑插件。
- **不提供「北京时间日」模式**：接口只有「日」粒度，一个北京日 = UTC 桶 D-1 的 08:00–24:00 加桶 D 的 00:00–08:00，**拆不开**；改成北京日就等于放弃与官方用量接口对账。

## 数据从哪来（双路数据源）

平台接口有两处硬限制（实测）：**当天数据要等平台结算**（滞后约 10~30 分钟），且**只覆盖 DeepSeek 官方通道**（本机走火山方舟 / 小米 / GLM 的用量，平台恒为 0）。所以窗口卡片与总消耗都是两路合并出来的：

| 数据源 | 覆盖 | 时效 | 金额 |
| --- | --- | --- | --- |
| **平台账单**（`usage/amount` + `usage/cost`） | 该账号**全部设备**，仅官方通道 | 当天滞后约 10~30 分钟 | 有（官方计价） |
| **本机会话日志**（`<DSH_HOME>/sessions/**`） | 只有**本机**，含**所有**供应商 | 实时 | 无 |

**合并规则**：逐日 `max(平台, 本机 DeepSeek 通道) + 本机非 DeepSeek 供应商`；
**总消耗** = 平台全部月份合计 + Σ(当天未结算的差额 + 本机非 DeepSeek 供应商)。
取大而不是相加 —— 平台值与本机 DeepSeek 通道值是**同一批调用的两种测量**，相加等于把自己打的请求算两遍。

- 卡片右上角标 `本机` / `合并`，**没有徽标 = 纯平台口径**；金额平台未结算时标 `¥结算中`（金额永远平台计价）。
- **覆盖边界**：本机补充只覆盖**会话日志还在的那些天**（DSH 会清理旧日志），界面与详细数据都会标注实际区间，更早的无法回补。
- 历史月份 / 图表 / 「模型」页签**仍只用平台口径**；本机用过的**供应商 · 模型**（含火山方舟 / 小米 / GLM / GPT）去详细数据的**「供应商」页签**看。
- 两路对拍：重叠区间内本机 DeepSeek 通道与平台日桶合计相差 < 1%。

## 金额（¥）

| 端点 | 含义 | `biz_data` 形状 |
| --- | --- | --- |
| `GET /api/v0/usage/amount` | token 计数 | **对象** `{total, days}` |
| `GET /api/v0/usage/cost` | CNY 金额（16 位小数） | **数组** `[{total, days, currency}]` |
| `GET /api/v0/users/get_user_summary` | 充值 / 赠送余额、**官方累计消费** | 对象 |

- 金额必须用**保留小数**的解析（用 token 的截断版会把整月金额吞成 `¥0.00` 且不报错）；`REQUEST` 不计费。
- **缺金额 ≠ 0 元**：没有金额时界面不渲染 ¥（而不是显示 `¥0.00`），并由 `costComplete` 提示「正在回补历史金额」。

## 安装与适配

`lib/` 是**已构建产物**，安装不会帮你构建：`pnpm install && pnpm run build`。

- ⚠️ **desktop profile 不能用 CLI 安装**（CLI 硬编码拒绝 `profile "desktop" is managed exclusively by the Electron application`），走 **设置 → 插件 → 安装**；其它 profile 可用 `dsh plugin --profile web add dsh-tlogs`。
- spec 支持四种：绝对路径（本地目录）/ tarball / npm 包名 / `github:<你>/dsh-tlogs`。
- **实测版本：DSH 0.2.0-rc.2**（desktop / web）。不声明 `@deepseek-ai/dsh*` peer，所以别的版本装得上但**未验证**。
- 使用：安装后重启 DSH → 页脚出现紧凑条；`↻` 强制刷新（最短 5 秒一次）、点整条或 `▾` 展开、「详细数据 ›」开弹窗、`Esc` 关闭。

## 凭据从哪来（按优先级）

| 顺序 | 来源 |
| --- | --- |
| 1 | 环境变量 `DEEPSEEK_PLATFORM_USER_TOKEN`（最高） |
| 2 | 配置 `platformUserToken`（会明文留在 profile，**不推荐**） |
| 3 | DSH 凭据系统 `TLOGS_USER_TOKEN`（面板手动填写并持久化） |
| 4 | **复用 DSH 已登录账号（推荐，零配置）** —— `useAccountSession: false` 可彻底关闭 |
| 5 | 内置登录窗口 —— 桌面端**不可用**（宿主是 Electron 的 Node 子进程，拿不到 `BrowserWindow`），按钮已置灰并写明替代路径 |

前 3 条是**你显式给的**，永远优先于自动来源；「退出登录」只清第 3 项。
凭据投递方式随来源绑定：网页 token 用 `Authorization: Bearer`，账号会话凭据用 **`x-dsh-auth-token`**（同一个令牌换错头必定 `40003`）。

## 实现要点

- **双面插件**：host 半 `lib/index.js`（取数 / 缓存 / 认证 / RPC / 可选工具），浏览器半 `lib/client.js`（React 组件）。
- **落点**：`sidebar.footer.action`（`kind: list`、`scope: root`）—— 页脚唯一的扩展席位。客户端模块用 `window.__ModuleLoader__.load({ id, factory })`，**`id` 必须等于包名**，只允许 `require` 宿主冻结种子表里的 `react`，其余一律打进单文件 bundle。
- **host 只用服务名**：只把 `tools` 声明为必需，`credentials` / `connection` / `webServer` / `deepseekAccount` 都是**可选注入**，缺失时优雅降级。
- **缓存**：总消耗 30 分钟、当前范围 5 分钟；首次全量 31 个月在**后台异步**拉，客户端轮询显示进度、不阻塞 UI。历史逐日明细一并持久化，升级后自动回补缺 `days` 的月份。
- **落盘**：`<DSH_HOME>/tlogs/history.json` —— 只有用量计数，不含 token、对话内容或 cwd（项目只存不可逆短哈希 id）。

## 为了安全性做了什么

| 措施 | 说明 |
| --- | --- |
| **凭据最小化** | 账号服务被收窄成只暴露 `getPlatformSession()` 的 facade，`signOut()` / `rejectToken()` **结构上拿不到**；可选注入，`useAccountSession: false` 时连注入都不发起 |
| **只读、绝不写回** | 从不调用 `rejectToken()` —— 那会把你的 DSH 登录态踢下线 |
| **不跟随重定向** | `redirect: 'manual'`：实测跨域重定向会剥掉 `Authorization` 但**不剥自定义头**，必须自己掐断 |
| **部署头白名单** | 只接受 `x-` 前缀；`Cookie` / `Origin` / `Referer` / `Host` / `x-forwarded-*` 一律丢弃；凭据头不允许被覆盖 |
| **出口写死单主机** | 只与 `platform.deepseek.com` 通信，不读代理环境变量 |
| **输入校验 / 文案净化** | token 只接受可打印 ASCII 且**不回显**；错误文案抹令牌 + 单行化 + 截断；平台响应体不落盘 |
| **本机路径不外泄** | 下发给浏览器的项目 id 是短哈希，工具异常只列 label，不列绝对路径 |
| **端点收敛** | 停用 `export` 端点（会返回含绝对路径的报告）；强制刷新最短 5 秒间隔 |
| **模型隔离** | `exposeUsageToModel` 默认 `false`，`query_token_usage` **根本不注册** |
| **会话日志只读** | 第二路数据源只读 `<DSH_HOME>/sessions/**`（**从不写入**），只取 usage 五个计数 + provider/model 名：不读消息正文，超长打包行解析前就跳过；落盘只留路径**不可逆短哈希**；有单文件解压预算与事件循环让出；`localUsage: false` 时**连目录都不列** |
| **仓库清洁** | 源码 / 日志 / 产物中无 token 字面量；对拍夹具是确定性合成数据；`npm run verify:secrets` 作为发布前闸门 |

**最小化配置** —— 五个开关全关后，插件只剩一件事：拿你**显式**给的 token 取数并显示。

```yaml
exposeUsageToModel: false   # 数字不进模型上下文
useAccountSession: false    # 不接触 deepseekAccount
enableProjectScope: false   # 不遍历会话、不读 cwd
persistHistory: false       # 完全不写磁盘
localUsage: false           # 完全不读会话日志（代价：当天与非 DeepSeek 用量会缺失）
```

## 仍存在的隐患

**A. 由 DSH 架构决定，本插件无法修复**

1. **跨插件共享同一个浏览器 realm**：任何另一个插件的客户端代码都能调用你的 `/tlogs` RPC（`setToken` 把用量查询指向别人的账号、`logout` 清掉令牌与历史缓存）。本插件只能收敛端点。
2. **`.credentials.yaml` 里的凭据是「拿来即用」形态** —— 任何以你用户身份运行的进程都能读到（Windows ACL 只挡别的用户）。
3. **本机回环服务 + 会话 Cookie** 的保护属于 DSH 的威胁模型；profile 的 pnpm registry 指向第三方镜像（供应链风险）。

**B. 本插件引入、已缓解但有剩余**

4. 账号会话凭据在进程内存驻留最长 60 秒（性能 vs 驻留时间的取舍）；`useAccountSession: false` 可消除。
5. 面板会显示项目 label；第二路数据源会读本机会话日志 —— 介意就关 `enableProjectScope` / `localUsage`。
6. 平台错误文案仍会进宿主日志（已净化，但文本本身会写）。
7. **`lib/` 被手改无法检测** —— 已知缺口，不是已完成项。
8. 项目快照只从**插件启用当天**开始积累（平台接口没有项目维度，宿主投影只给累计值）。

**C. 使用习惯层面（插件管不了）**

9. 自己在对话里贴数字或截图 → 照样进模型上下文。
10. 参考 Python 脚本里的明文令牌：本项目已做 `.gitignore` + 不再从它抓令牌，但**轮换令牌只能你在平台侧做**。

## 配置项

完整模板见 [cordis.patch.yml](cordis.patch.yml)。

| 配置 | 默认 | 含义 |
| --- | --- | --- |
| `exposeUsageToModel` | `false` | 是否注册对话内查询工具（返回值即模型上下文） |
| `useAccountSession` | `true` | 复用 DSH 已登录账号的会话凭据 |
| `localUsage` / `localUsageScanDays` | `true` / `32` | 第二路数据源（会话日志）与其回溯天数 |
| `enableProjectScope` | `true` | 「当前项目消耗」卡片（遍历会话读 cwd） |
| `persistHistory` | `true` | 历史落盘到 `<DSH_HOME>/tlogs/history.json` |
| `autoRefreshSeconds` | `300` | 定时刷新间隔（秒），`0` = 关闭 |
| `cacheTTL.total` / `.current` | `1800` / `300` | 总消耗 / 当前范围缓存（**秒**） |
| `startYear` / `startMonth` | `2024` / `4` | 首次全量的历史起点 |
| `requestIntervalMs` | `1000` | 月度请求间隔（毫秒） |
| `numberFormat` | `short` | `full`（千分位）/ `short`（K·M·B；金额另有一套） |
| `compactMetrics` | `[total, today]` | 紧凑条指标：`total` `today` `week` `month` `last7` `last30` + `cost_total` `cost_today` `cost_last7` `cost_last30` |
| `cacheDir` | `''` | 留空 = `<DSH_HOME>/tlogs` 或 `$TLOGS_CACHE_DIR` |

环境变量：`DEEPSEEK_PLATFORM_USER_TOKEN`（显式 token）、`TLOGS_CACHE_DIR`（缓存目录）、`DSH_HOME`（会话日志根 = `<DSH_HOME>/sessions`）。

**默认不放金额**：页脚只有约 250px，四个指标会把标签挤成认不出的碎片 —— 金额放在展开面板与详细数据里；确实想在小窗看，把 `cost_total` 显式加进 `compactMetrics`（指标挤不下时整项换行，不再压缩标签）。

## 开发

```bash
pnpm run check          # 密钥闸门 + typecheck + build + 全部测试
pnpm run golden         # 在线端到端对拍（需 DEEPSEEK_PLATFORM_USER_TOKEN，约 90 秒）
pnpm run verify:dsh     # 用本机 DSH 的真实解析器校验插件声明
pnpm run build:preview  # 重新生成 docs/embed-preview.html 静态预览
```

`test/golden.test.ts` 找不到外部 Python 参考脚本时 **skip 而非 fail**（那是 gitignore 的外部输入）；用 `TLOGS_REFERENCE_SCRIPT=<路径>` 指过去即可。

## 许可

MIT
