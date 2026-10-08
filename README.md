# tlogs — DSH 侧边栏 Token 用量组件

tlogs 在 DSH 桌面端侧边栏页脚常驻显示 Token 用量，含紧凑条、展开面板与详细数据弹窗。

## 形态

| 形态 | 内容 |
| --- | --- |
| 紧凑条 | 总量、今日、请求数。`↻` 刷新，`▾` 展开 |
| 展开面板 | 总消耗、当前项目、今日、当周、当月、近 7 天、近 30 天 |
| 详细数据弹窗 | 日历、图表、模型、供应商、年、月、当月按天 |

## 数据来源

| 来源 | 覆盖 | 时效 | 金额 |
| --- | --- | --- | --- |
| 平台账单 | 账号全部设备，仅官方通道 | 滞后 10~30 分钟 | 有 |
| 本机会话日志 | 仅本机，含所有供应商 | 实时 | 无 |

两路**逐日**合并：`max(平台, 本机官方通道) + 本机第三方供应商`。同一次调用会被两路各记一次，因此取大而不相加。

- 只有窗口内含平台看不到的第三方用量时，卡片才标 `第三方`；其余口径细节见卡片 tooltip。
- 历史月份与图表用平台口径。模型与供应商页签按**通道**判定，不按模型名：火山方舟上的 `deepseek-v4-flash` 属第三方。

## 安装

四种方式：绝对路径、tarball、npm 包名、`github:<user>/dsh-tlogs`。`lib/` 是已构建产物，安装不会构建。

desktop profile 不能用 CLI 安装，改用 设置 → 插件 → 安装；其它 profile 用 `dsh plugin --profile web add dsh-tlogs`。

安装后重启 DSH。实测 DSH 0.2.0-rc.2（desktop、web）。

## 凭据

| 顺序 | 来源 |
| --- | --- |
| 1 | 环境变量 `DEEPSEEK_PLATFORM_USER_TOKEN` |
| 2 | 配置 `platformUserToken`（明文） |
| 3 | DSH 凭据 `TLOGS_USER_TOKEN`（面板填写） |
| 4 | 复用 DSH 已登录账号 |
| 5 | 内置登录窗口（桌面端不可用） |

前 3 项优先于自动来源；退出登录只清除第 3 项。

## 配置

完整模板见 [cordis.patch.yml](cordis.patch.yml)。

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `exposeUsageToModel` | `false` | 注册对话内查询工具 |
| `useAccountSession` | `true` | 复用 DSH 账号凭据 |
| `localUsage` / `localUsageScanDays` | `true` / `32` | 读会话日志与回溯天数 |
| `enableProjectScope` | `true` | 当前项目卡片 |
| `persistHistory` | `true` | 历史落盘 |
| `autoRefreshSeconds` | `300` | 定时刷新间隔，0 关闭 |
| `cacheTTL.total` / `.current` | `1800` / `300` | 缓存秒数 |
| `startYear` / `startMonth` | `2024` / `4` | 历史起点 |
| `requestIntervalMs` | `1000` | 月度请求间隔 |
| `numberFormat` | `short` | `full` 千分位 / `short` K·M·B |
| `compactMetrics` | `[total, today]` | 紧凑条指标 |
| `cacheDir` | `''` | 空为 `<DSH_HOME>/tlogs` |

`compactMetrics` 可选：`total`、`today`、`week`、`month`、`last7`、`last30`、`cost_total`、`cost_today`、`cost_last7`、`cost_last30`。

环境变量：`DEEPSEEK_PLATFORM_USER_TOKEN`、`TLOGS_CACHE_DIR`、`DSH_HOME`。

## 安全

| 措施 | 说明 |
| --- | --- |
| 凭据 | 只暴露 `getPlatformSession()`；会话凭据仅刷新期间持有；失效标记只存摘要 |
| 网络 | 只连 `platform.deepseek.com`；不跟重定向；部署头白名单只放行 `x-` |
| 模型隔离 | 默认不注册工具；打开后项目 id 仍是不可逆哈希 |
| 会话日志 | 只读、只取计数与 provider/model，落盘只存路径哈希 |
| 发布闸门 | `npm run verify:secrets` |

最小权限配置：

```yaml
exposeUsageToModel: false
useAccountSession: false
enableProjectScope: false
persistHistory: false
localUsage: false
```

## 隐患

**架构**

1. 同一浏览器 realm 内，其它插件可调用本插件的 RPC。
2. `.credentials.yaml` 同用户进程可读——本机凭据的主要暴露面，与插件无关。
3. 会话凭据只能断开引用，无法物理擦除（JS 字符串不可变）；DSH 内部是否缓存不在本插件边界内。

**取舍**

4. 面板显示项目 label，本机数据源读取会话日志；可用配置关闭。
5. 项目快照从插件启用当天开始，无法回溯。

**使用习惯**

6. 在对话中粘贴用量数字或截图会进入模型上下文。

## 开发

```bash
pnpm run check       # 密钥闸门、typecheck、build、测试
pnpm run verify:dsh  # 用本机 DSH 解析器校验插件声明
pnpm run golden      # 在线端到端对拍，需要 DEEPSEEK_PLATFORM_USER_TOKEN
```

`test/golden.test.ts` 缺外部 Python 参考脚本时跳过，用 `TLOGS_REFERENCE_SCRIPT=<路径>` 指定。

## 许可

GPL-3.0-only，全文见 [LICENSE](LICENSE)。
