# tlogs — DSH 侧边栏 Token 用量组件

tlogs 在 DSH 桌面端侧边栏页脚常驻显示 Token 用量。紧凑条显示总量、今日与请求数；展开后是七张卡片；详细数据弹窗可按月回溯，按模型与供应商拆分。数字经 host → 浏览器 RPC 送达侧边栏，默认不进模型上下文。组件参与侧边栏布局，不是悬浮窗。

<!-- 📷 展示图待补：docs/images/overview.png、docs/images/detail-modal.png -->

## 形态

| 形态 | 内容 |
| --- | --- |
| 紧凑条 | 总量、今日、请求数。`↻` 刷新，`▾` 展开。侧边栏收起时只留总量。不放金额 |
| 展开面板 | 七张卡片：总消耗、当前项目、今日、当周、当月、近 7 天、近 30 天。每张含输入、输出、请求与金额 |
| 详细数据弹窗 | 日历、图表、模型、供应商、年、月、当月按天。图表为手写 SVG，不引图表库 |

## 口径

今日、当周、当月按平台日切：UTC 日 0 点 = 北京时间 8 点换日。近 7 天、近 30 天是滚动窗口，与控制台「时间维度」一致。

面板显示：`统计口径：平台日（UTC）· 北京 08:00 换日`。

账单按北京时间日结算，用量接口按 UTC 日切桶，跨日处最多差 8 小时。

接口只提供日粒度。一个北京日跨两个 UTC 桶，无法拆分。插件不提供北京时间日模式。

## 数据来源

平台接口有两个限制：当天数据需等结算，滞后约 10~30 分钟；只覆盖 DeepSeek 官方通道。窗口卡片与总消耗由两路数据合并。

| 来源 | 覆盖 | 时效 | 金额 |
| --- | --- | --- | --- |
| 平台账单 | 账号全部设备，仅官方通道 | 滞后约 10~30 分钟 | 有 |
| 本机会话日志 | 仅本机，含所有供应商 | 实时 | 无 |

合并规则：逐日取 `max(平台, 本机官方通道) + 本机第三方供应商`。总消耗 = 平台全部月份 + 当天未结算差额 + 本机第三方供应商。

两路是同一批调用的两种测量，取大不会重复计数。

- 卡片标 `本机` 或 `合并`，无标记为纯平台口径。金额未结算时标 `¥结算中`。
- 本机数据只覆盖会话日志保留期，界面标注区间。
- 历史月份与图表用平台口径。模型页签与供应商页签标 `官方` 或 `第三方`，按通道判定，不按模型名：火山方舟上的 `deepseek-v4-flash` 属第三方。已知通道显示中文名，未收录显示路由 id。
- 重叠区间内两路相差小于 1%。

## 金额

| 端点 | 内容 |
| --- | --- |
| `/api/v0/usage/amount` | token 计数，`biz_data` 为对象 |
| `/api/v0/usage/cost` | 金额，16 位小数，`biz_data` 为数组 |
| `/api/v0/users/get_user_summary` | 充值余额、赠送余额、官方累计消费 |

金额解析保留小数。截断解析会把整月金额读成 0。

`REQUEST` 不计费。无金额数据时不渲染 `¥`，由 `costComplete` 提示回补状态。

## 安装

`lib/` 是已构建产物，安装不会构建。执行 `pnpm install && pnpm run build`。

desktop profile 不能用 CLI 安装，CLI 拒绝该 profile 名。改用设置 → 插件 → 安装。其它 profile 用 `dsh plugin --profile web add dsh-tlogs`。

安装方式：绝对路径、tarball、npm 包名、`github:<user>/dsh-tlogs`。

实测版本：DSH 0.2.0-rc.2（desktop、web）。插件不声明 peer，其它版本可安装但未验证。

安装后重启 DSH，页脚出现紧凑条。`↻` 强制刷新，间隔最短 5 秒。点整条或 `▾` 展开，`详细数据 ›` 打开弹窗，`Esc` 关闭。

## 凭据

| 顺序 | 来源 |
| --- | --- |
| 1 | 环境变量 `DEEPSEEK_PLATFORM_USER_TOKEN` |
| 2 | 配置 `platformUserToken`，明文存储 |
| 3 | DSH 凭据 `TLOGS_USER_TOKEN`，面板填写 |
| 4 | 复用 DSH 已登录账号，零配置 |
| 5 | 内置登录窗口，桌面端不可用 |

前 3 项优先于自动来源。退出登录只清除第 3 项。

网页 token 用 `Authorization: Bearer`，账号会话凭据用 `x-dsh-auth-token`。头部错误返回 `40003`。

## 安全

| 措施 | 说明 |
| --- | --- |
| 凭据最小化 | 账号服务只暴露 `getPlatformSession()` |
| 只读 | 不调用 `rejectToken()`，不影响登录态 |
| 重定向 | 用 `redirect: 'manual'`，3xx 直接失败 |
| 请求头白名单 | 只接受 `x-` 前缀，丢弃 `Cookie`、`Origin`、`Referer`、`Host` |
| 出口 | 只与 `platform.deepseek.com` 通信，不读代理变量 |
| 输入校验 | token 只接受可打印 ASCII，不回显。错误文案清除令牌并截断 |
| 路径 | 下发前端的项目 id 为短哈希 |
| 端点 | 停用 `export`，强制刷新间隔最短 5 秒 |
| 模型隔离 | `exposeUsageToModel` 默认 `false`，不注册工具 |
| 会话日志 | 只读 `<DSH_HOME>/sessions/**`，只取用量计数与 provider/model，不读正文，落盘只存路径哈希，有解压预算 |
| 仓库 | 无令牌字面量，夹具为合成数据，`npm run verify:secrets` 为发布闸门 |

最小权限配置：

```yaml
exposeUsageToModel: false
useAccountSession: false
enableProjectScope: false
persistHistory: false
localUsage: false
```

## 隐患

**DSH 架构限制**

1. 同一浏览器 realm 内，其它插件可调用本插件的 RPC。
2. `.credentials.yaml` 中的凭据可直接使用，同用户进程可读。
3. 本机回环服务与会话 Cookie 的保护由 DSH 提供。profile 的 pnpm 源为第三方镜像。

**插件取舍**

4. 账号会话凭据在内存驻留最长 60 秒。
5. 面板显示项目 label，本机数据源读取会话日志。可用配置关闭。
6. 平台错误文案写入宿主日志。
7. `lib/` 被手动修改无法检测。
8. 项目快照从插件启用当天开始，无法回溯。

**使用习惯**

9. 在对话中粘贴数字或截图会进入模型上下文。
10. 参考脚本中的明文令牌需在平台侧轮换。

## 配置

完整模板见 [cordis.patch.yml](cordis.patch.yml)。

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `exposeUsageToModel` | `false` | 注册对话内查询工具 |
| `useAccountSession` | `true` | 复用 DSH 账号凭据 |
| `localUsage` | `true` | 读取会话日志 |
| `localUsageScanDays` | `32` | 本机数据回溯天数 |
| `enableProjectScope` | `true` | 当前项目卡片 |
| `persistHistory` | `true` | 历史落盘 |
| `autoRefreshSeconds` | `300` | 定时刷新间隔，0 为关闭 |
| `cacheTTL.total` / `.current` | `1800` / `300` | 缓存秒数 |
| `startYear` / `startMonth` | `2024` / `4` | 历史起点 |
| `requestIntervalMs` | `1000` | 月度请求间隔 |
| `numberFormat` | `short` | `full` 千分位，`short` K·M·B |
| `compactMetrics` | `[total, today]` | 紧凑条指标 |
| `cacheDir` | `''` | 空为 `<DSH_HOME>/tlogs` |

`compactMetrics` 取值：`total`、`today`、`week`、`month`、`last7`、`last30`、`cost_total`、`cost_today`、`cost_last7`、`cost_last30`。

环境变量：`DEEPSEEK_PLATFORM_USER_TOKEN`、`TLOGS_CACHE_DIR`、`DSH_HOME`。

## 开发

```bash
pnpm run check          # 密钥闸门、typecheck、build、测试
pnpm run golden         # 在线端到端对拍，需要 DEEPSEEK_PLATFORM_USER_TOKEN
pnpm run verify:dsh     # 用本机 DSH 解析器校验插件声明
pnpm run build:preview  # 重新生成 docs/embed-preview.html
```

`test/golden.test.ts` 缺外部 Python 参考脚本时跳过，用 `TLOGS_REFERENCE_SCRIPT=<路径>` 指定。

## 许可

MIT
