# tlogs — DSH 内嵌用量组件

> **tlogs** = **t**oken **logs**。
> 在 DeepSeek Harness 桌面端的**侧边栏页脚**常驻显示 DeepSeek 开放平台账号的
> Token 用量（总消耗 / 当前项目 / 今日 / 当周 / 当月），包含紧凑条、就地展开面板
> 与详细数据视图。**不是悬浮球，不是独立窗口。**

- 目标平台：DSH **0.2.0-rc.2**（desktop / web profile）
- 形态：双面插件（host 半 + 浏览器半）
- 数据来源：`platform.deepseek.com` 私有用量接口，口径与工作区权威 Python 脚本
  `deepseek_python_20261007_a1f087.py` **逐字段一致**（已实测对拍通过，见下）

---

## 目录

- [它长什么样](#它长什么样)
- [安装](#安装)
- [配置](#配置)
- [认证](#认证)
- [数据来源与对拍结果](#数据来源与对拍结果)
- [验证](#验证)
- [项目结构](#项目结构)
- [用到的 DSH 扩展点（0.2.0-rc.2 实测）](#用到的-dsh-扩展点0200-rc2-实测)
- [与需求文档的差异（实测后修正）](#与需求文档的差异实测后修正)
- [已知限制](#已知限制)
- [数据清单与隐私](#数据清单与隐私)
- [安全](#安全)
- [可能风险（完整清单）](#可能风险完整清单)
- [许可](#许可)

---

## 它长什么样

完整预览页：**[docs/embed-preview.html](docs/embed-preview.html)**（用浏览器打开）。

> ⚠️ 该预览页是**静态预览，不是应用内截图**。组件与样式都取自构建产物本体
> （`lib/client/*.js` + `src/client/styles.ts` 的 CSS），由 `react-dom/server`
> 渲染生成，没有手绘的假 UI；页内颜色是**替身 token**，真实数值由
> `@deepseek-ai/dsh-client-ui-theme` 在应用内注入。
> 真实截图获取方式见 [验证](#验证)。

### 落点

控件注册到 DSH 侧边栏唯一的页脚席位 **`sidebar.footer.action`**
（`kind: list`、`scope: root`，由 `@deepseek-ai/dsh-client-ui-sidebar` 的
`SidebarRoot` 用 `renderSlot("sidebar.footer.action", { wide })` 渲染）。

```
┌─ DSH 侧边栏 ─────────────────────┐
│  ◉ DeepSeek Harness              │  品牌行
│  + 新建会话                       │
│                                  │
│  ▾ 工作区 A                       │
│      · 会话 1                     │  ← 正常内容
│      · 会话 2                     │
│  ▸ 工作区 B                       │
│                                  │
│  ⚙ 设置                           │  官方固定底部项
│ ┌──────────────────────────────┐ │
│ │ 总 8.5B · 今日 222M        ▾ │ │  ← tlogs 紧凑条（30px）
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

> 紧凑条默认只有**总计 + 今日**两项，且**不再有 Σ 符号**（徽标与总计标签都已删除，
> 总计的标签是「总」）。本周/本月只在展开面板里看。早期版本把 Σ 徽标 + 四项指标塞在
> 一行里，会超出侧边栏宽度、把末尾数字裁掉（实测表现为「本月 359」而不是「359M」）。
> 侧边栏收起时，紧凑条显示总计数字（替代原来的 Σ 徽标）。

展开时**就地撑开**（把上方内容顶上去），不覆盖、不浮动：

```
│  ▸ 工作区 B                       │
│ ┌──────────────────────────────┐ │
│ │ 总 8.5B · 今日 222M        ▴ │ │
│ ├──────────────────────────────┤ │
│ │ 总消耗 Token        8.2B      │ │
│ │ 输入 8.1B 输出 52.0M 请求 51.5K│ │
│ │ 当前项目消耗 · tlogs  1.2B    │ │  ← 点击可切换项目
│ │ …（共 5 张卡片）              │ │
│ │ 详细数据 ›      刷新  退出登录 │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

样式上**没有任何 `position: fixed` 或 `position: absolute`**（有自动化断言守着，见
`test/client-mount.test.ts`），因此组件完全参与正常布局。

---

## 安装

### ⚠️ 不要用 `dsh plugin --profile desktop add`

这条命令**一定失败**：

```
error: profile "desktop" is managed exclusively by the Electron application
```

原因是 CLI 里有一条针对 profile 名 `desktop` 的硬编码拒绝（`@deepseek-ai/dsh/lib/bin.js`）：

```js
function rejectElectronProfile(program, profile) {
  if (profile.toLowerCase() === "desktop")
    program.error('error: profile "desktop" is managed exclusively by the Electron application');
}
```

**desktop profile 只能由应用内的插件管理器管理**（设置 → 插件）。你机器上已有的
tidychat / thinking-effort / meow-memory / workspace-mover / memory-plugin 都是这样装进去的
（证据：`~/.dsh/profiles/desktop/.plugin-manager/logs/*/pnpm.log` 里是管理器执行的 pnpm 输出）。

### 先构建

安装**不会**触发构建，`lib/` 必须已经存在（DSH 只消费已构建产物）：

```bash
pnpm install
pnpm run build     # build:host (tsc) + build:client (esbuild → 单文件 bundle)
```

`lib/client.js` 缺失会导致插件激活失败。也可以用 `pnpm run check` 一次跑完 typecheck + build + 全部测试。

### 方式一：从本地目录安装（推荐，无需发布）

应用内插件管理器接受**绝对路径**：

1. 打开 DSH 桌面端 → **设置 → 插件 → 安装**
2. 填入本插件的绝对路径，例如 `D:\plugins\dsh-tlogs`
3. 按提示重启 DSH

> 相对路径会被拒绝（`a local path must be absolute`）：浏览器侧无法知道宿主的工作目录，
> 而相对路径会被解析到 profile 目录里面去。

### 方式二：打包成 tarball 后安装

```bash
npm pack            # 产出 dsh-tlogs-0.1.0.tgz
```

然后在应用内安装界面填入该 tgz 的**绝对路径**（也支持 `http(s)://…tgz`）：

```
D:\plugins\dsh-tlogs\dsh-tlogs-0.1.0.tgz
```

### 方式三：发布到 npm 后按包名安装

```bash
npm publish --access public
```

应用内安装界面填 `dsh-tlogs`（或 `dsh-tlogs@0.1.0`）。

### 方式四：GitHub

```bash
git push  # 仓库打上 dsh-plugin topic
```

应用内填 `github:<你的用户名>/dsh-tlogs`。

### 应用内管理器接受哪些 spec

来自 `@deepseek-ai/dsh-plugin-manager` 的 `parseInstallSpec`（已核对其源码）：

| 形式 | 例子 | 备注 |
| --- | --- | --- |
| registry 包名（可选 `@version`） | `dsh-tlogs`、`dsh-tlogs@0.1.0` | 走 npm registry |
| **绝对路径（本地目录）** | `D:\plugins\dsh-tlogs` | 必须是绝对路径 |
| tarball | `F:\…\dsh-tlogs-0.1.0.tgz`、`https://…/x.tgz` | `.tgz` / `.tar.gz` |
| git | `github:you/dsh-tlogs`、git URL、仓库 URL | 安装前用 `git ls-remote` 探活 |

### 兼容性门禁：本插件直接通过

管理器在安装前（本地路径）或安装后（git/tarball）会检查插件的
`peerDependencies` 里是否存在与当前 DSH 运行时不兼容的 **DSH peer**。
`dsh-app-boot` 的 `evaluatePluginCompatibility` 只评估名称匹配
`@deepseek-ai/dsh` 或 `@deepseek-ai/dsh-*` 的 peer：

```js
if (name !== "@deepseek-ai/dsh" && !name.startsWith("@deepseek-ai/dsh-")) continue;
...
if (Object.keys(peers).length === 0) return undefined;   // 无 DSH peer → 直接放过
```

本插件**没有任何 DSH peer**（只有 `react`，由宿主平台种子表提供），所以门禁短路通过，
**不需要申请版本豁免**（`dsh plugin allow-version` / 管理器里的豁免）。这一点有测试守着
（`test/manifest.test.ts`）。

> 非 desktop 的 profile（`web` / `tui` / `headless` 等）仍可用 CLI：
> `dsh plugin --profile tui add dsh-tlogs`。CLI 只是把参数转发给 profile 目录里的 pnpm。

---

## 配置

通过 profile 的 `cordis.patch.yml` 注入（本包自带一份模板，见
[cordis.patch.yml](cordis.patch.yml)）：

```yaml
- id: tlogs
  name: 'dsh-tlogs'
  config:
    platformUserToken: ''      # 可选：手动指定 userToken（不推荐）
    startYear: 2024            # 起始查询年（与权威脚本一致）
    startMonth: 4              # 起始查询月（与权威脚本一致）
    requestIntervalMs: 1000    # 月度请求间隔（毫秒，对应 time.sleep）
    cacheTTL:
      total: 1800              # 总消耗缓存（秒）= 30 分钟
      current: 300             # 今日/当周/当月缓存（秒）= 5 分钟
    defaultExpanded: false     # 内嵌组件默认是否展开
    compactMetrics: [total, today]  # 紧凑条只放总计+今日；本周/本月在展开面板看
    enableDetailView: true
    numberFormat: short        # full（千分位）| short（K/M/B）
    cacheDir: ''               # 留空 = <DSH_HOME>/tlogs 或 $TLOGS_CACHE_DIR
    enableProjectScope: true   # 「当前项目消耗」卡片
    persistHistory: true       # false = 完全不访问文件系统
    maxToolRows: 20
    exposeUsageToModel: false  # ⚠ 默认 false：用量数字不进入模型上下文
    useAccountSession: true    # false = 彻底关闭「复用 DSH 账号登录态」
```

### 两个安全开关

| 配置 | 默认 | 含义 |
| --- | --- | --- |
| `exposeUsageToModel` | **`false`** | 是否注册 `query_token_usage` 工具。**工具的返回值就是模型上下文** —— 注册即意味着你的用量统计会作为对话内容发给模型提供方。默认不注册，数字只经 host→浏览器 RPC 进入侧边栏 UI，模型完全看不到。需要「在对话里问用量」时才显式打开。 |
| `useAccountSession` | `true` | 是否复用 DSH 已登录账号的 Platform 会话凭据。设为 `false` 后插件**完全不接触** `deepseekAccount` —— 连可选注入都不发起，只剩环境变量 / 配置 / 本机凭据 / 手动填写四条显式来源。 |

> **默认状态下，你在对话里问我"用了多少 token"我答不出来** —— 因为
> `query_token_usage` 根本没注册。这不是故障，是刻意的默认值：用量数字不该悄悄
> 变成模型上下文。想恢复对话内查询，把 `exposeUsageToModel` 设为 `true` 并重启 DSH；
> 侧边栏面板不受影响，任何情况下都能看到完整数字。

### 环境变量

| 变量 | 作用 |
| --- | --- |
| `DEEPSEEK_PLATFORM_USER_TOKEN` | 手动指定 token（开发调试用，优先级最高） |
| `TLOGS_CACHE_DIR` | 历史缓存目录（默认 `<DSH_HOME>/tlogs`） |

> **注意 `cacheTTL` 的单位是「秒」**（与需求 6.1 的示例 `total: 1800  # 30 分钟` 一致），
> 内部会换算成毫秒；`requestIntervalMs` 的单位是毫秒。配置项越界或类型错误都会被
> 夹取/归一化，不会让插件加载失败。

---

## 认证

DeepSeek 开放平台没有公开的用量 API，需要用**网页登录态会话令牌（userToken）**。
本插件按下面的优先级自动获取，尽量免去 F12 手工复制：

| 顺序 | 来源 | 说明 |
| --- | --- | --- |
| 1 | 环境变量 `DEEPSEEK_PLATFORM_USER_TOKEN` | 开发调试显式覆盖 |
| 2 | 配置 `platformUserToken` | 需求 2.2 方案 C（静态） |
| 3 | **DSH 凭据系统** `TLOGS_USER_TOKEN` | 手动输入或桌面登录后持久化，可被「退出登录」清除 |
| 4 | **账号会话凭据**（方案 D，**推荐**） | 复用 DSH 已登录账号：`deepseekAccount.getPlatformSession()` + **`x-dsh-auth-token`** 头，零配置。可用 `useAccountSession: false` 彻底关闭 |
| 5 | 内置窗口登录（方案 B） | 打开 `platform.deepseek.com/usage`，轮询 `localStorage.userToken`。**DSH 桌面端实测不可用**，见下 |

> 1–3 是**用户显式**给出的凭据，永远优先；4–5 是自动来源。所以手动粘贴的 token
> 不会被账号复用悄悄抢走（有专门的测试锁定这一点）。

> **方案 A（按名字盲猜宿主服务的 token getter）已移除。** 它是 confused deputy：
> 插件会无参调用自己没有契约的宿主方法（可能有副作用），且若返回的是推理令牌或
> API Key，会被当作平台会话令牌发往外部域。方案 D 用有契约的 Host-only 接口把
> 自动获取做对了，这条猜测路径只是多余的攻击面。同时新增了
> `useAccountSession: false`，可以在需要时**连方案 D 一起关掉**（关掉后插件完全不
> 接触 `deepseekAccount`，连可选注入都不发起）。

> 「退出登录」只清除第 3 项（凭据系统里的值）。如果同时配置了第 1/2 项，需要一并移除
> 才能真正退出——这是刻意的设计，避免出现「点了退出还在用配置里的 token」的误解。

### 方案 D：复用 DSH 已登录账号（**已实测可用**）

DSH 桌面端已经登录了 DeepSeek，那能不能直接用？**能。** 但这里有个坑，我踩了两轮才趟平：
**凭据是对的，头用错了。**

#### 第一步：找对接口

`@deepseek-ai/dsh-llm-deepseek-account` 的鉴权只有三行：

```js
const account = ctx.get("deepseekAccount");
const token = await account?.resolveToken(connection.baseURL);
return { headers: { "x-dsh-auth-token": token } }
```

而 `@deepseek-ai/dsh-deepseek-account` 的权威契约（`lib/types/index.d.ts`）写明了边界：

```ts
/**
 * Resolve a credential only for the inference origin allowed by the provider.
 * @param url - actual request destination or API base URL.
 * @returns stored token, or undefined for other origins or a signed-out account.
 */
abstract resolveToken(url: string): Promise<string | undefined>;

/**
 * Read credentials for the configured Platform origin, bound to their issuing
 * environment, ... @returns a Host-only snapshot, or null while signed out ...
 */
abstract getPlatformSession(): Promise<PlatformSession | null>;
```

- **`resolveToken(url)` 用不了**。契约是「只对 provider 允许的**推理**源发凭据，其它源
  返回 `undefined`」——把用量接口的源传进去只会拿到 `undefined`。这是刻意的安全边界。
- **`getPlatformSession()` 可用**。返回面向「配置的 Platform 源」的
  `{ origin, token, userId, requestHeaders? }`，且明确是 **Host-only** ——
  本插件的 host 半侧正是设计内的消费者。

#### 第二步：找对投递头（关键）

拿到令牌不等于能用。**同一个令牌，换头就决定成败**（下表的 ✅ 是插件自己的
`fetchMonth` 打真接口得到的，不是旁路脚本）：

| 投递方式 | 结果 |
| --- | --- |
| `Authorization: Bearer <t>` | ❌ `200 {"code":40003,"msg":"Authorization Failed (invalid token)"}` |
| **`x-dsh-auth-token: <t>`** | ✅ `200 {"code":0,...}` → 取到该月完整用量与 6 个模型的明细 |

`x-dsh-auth-token` 正是 DSH 账号包自己投递该凭据用的头。而网页登录态拿到的
`userToken` 才是走 `Bearer`。**两种凭据、两种头，不能混用** —— 之前的「全部 40003」
就是这么来的。

实测数据（插件代码路径，2026-08）：

```
[bearer           ] ❌ unauthorized: 40003 认证失败
[x-dsh-auth-token ] ✅ code:0，取到该月完整用量（含 6 个模型的逐项明细）
```

> **具体数值不在此发布** —— 那是账号数据。上面这一行只是"跑通了"的证据；
> 比较是在运行时逐字段做的，不是靠引用数值。

#### 实现要点

- 用**可选**注入 `ctx.inject(['deepseekAccount'], cb)` 获取服务，**不写进 `inject` 声明**，
  否则 web 版（没有该服务）会让插件直接加载失败。
- 凭据投递方式随来源走（`ResolvedToken.scheme`）：网页 `userToken` → `bearer`；
  账号会话凭据 → `x-dsh-auth-token`。手工来源永远优先，不被自动复用抢走。
- 账号返回的 `requestHeaders` 会并入请求头，但**凭据头（`Authorization` 与
  `x-dsh-auth-token`）不允许被覆盖** —— 被换掉等于悄悄用了另一个身份。
- **只读，绝不调用 `rejectToken()`**。那个方法的用途是「移除被推理请求拒绝的令牌」，
  会清掉用户的 DSH 登录态；拿它处理用量接口的失败会把人踢下线，副作用远超本插件职责。
- 凭据不被接受时（`code=40003`）归类为**认证失败**，刷新循环立即终止。
  否则会把 31 个月全部打一遍（约 31 次请求 / 30 秒）才罢休。（实测印证：修复前那次
  失败只留下 1 条月份记录，而不是 31 条。）
- 失败静默回退到「手动填写」，不打扰用户。

### 关于「登录」按钮（实测后修正）

**桌面端的内置登录窗口打不开，这是宿主结构决定的，不是本插件的 bug。**

0.2.0-rc.2 桌面端把插件跑在 `dsh-desktop-host` 子进程里，该进程由 Electron 二进制以
**Node 模式**启动（`--expose-internals` 之后直接执行 `.js` 入口，已用真实进程命令行核实）。
Node 模式下 `require('electron')` 拿不到 `BrowserWindow`，因此方案 B 从未成功创建过窗口。

修复前表现为**点了登录毫无反应**，原因是两层叠加：

1. `interactiveLogin()` 拿不到 Electron → 静默返回 `undefined`
2. 客户端把失败原因藏掉了：错误行条件是 `error && !needsAuth`，而 token 缺失时
   `needsAuth` 恰好为 `true` —— 错误被自己这道门挡掉，一个字都不显示

现在 host 通过快照下发 `display.loginAvailable`（`canInteractiveLogin()` 的真实探测结果）：
不可用时「登录」按钮**置灰**并明确写出原因与替代路径（「手动填写」）。

### 为什么不能直接拿凭据库里的值

用量接口要的是**该平台签发的会话凭据**，而 API Key 是另一套东西，不能互用。

实测（2026-10，本机 `~/.dsh/.credentials.yaml`）：把凭据库里所有候选值
（3 条记录 + `refs` 里的值）**按 `Authorization: Bearer`** 打用量接口，
**全部返回 `{"code":40003,"msg":"Authorization Failed (invalid token)"}`** —— 包括
那条平台签发的 64 字符 grant。当时得出的结论是「自动探测不可用」。

**这个结论是错的，错因是头。** 后来发现同一条 64 字符 grant 换成
`x-dsh-auth-token` 就返回 `code:0` 的真实数据（见「方案 D」）。剩下的
`DEEPSEEK_API_KEY` 等确实是给 `api.deepseek.com` 用的，与本接口无关。

教训：**凭据被拒时，先怀疑投递方式，再怀疑凭据本身。**

### userToken 的形态（需求 2.3）

平台把它以 **JSON 字符串**存在 localStorage 里：

```json
{"value":"<这里是真正的 token，本文件不展示真实值>","__version":"0"}
```

**整个 JSON 不是 token，只有 `value` 才是。** `normalizeUserToken()` 能处理四种输入形态：
`{"value":...}`、`"裸串"`、裸串、误带的 `Bearer ` 前缀。

### 认证失效

- Host 收到 **HTTP 401** → 立即标记该 token 失效、停止后续逐月请求，并通过事件让客户端刷新
- 客户端在展开面板顶部显示 **「userToken 已失效，需要重新登录」+ 登录 / 手动填写**
- 网络失败时用**过期缓存兜底**，紧凑条显示 `⚠` 角标并说明原因（需求 5.4）

---

## 数据来源与对拍结果

### 唯一可用接口（实测确认）

```
GET https://platform.deepseek.com/api/v0/usage/amount?year=YYYY&month=MM
```

必须携带的请求头：`Authorization: Bearer <userToken>`、`Accept`、`Content-Type`、
`x-client-platform: web`、`Origin`、`Referer`、`User-Agent`（缺 `Origin`/`Referer`/
`x-client-platform` 会被 WAF 拦截或返回空数据）。

响应是**两层错误码**，两层都要检查：

```
data.code == 0  →  data.biz_code == 0  →  data.biz_data.{total[], days[]}
```

### 计算口径（与脚本一致）

| 计量项 | 含义 |
| --- | --- |
| `PROMPT_TOKEN` | 普通输入 token |
| `PROMPT_CACHE_HIT_TOKEN` | 输入缓存命中 |
| `PROMPT_CACHE_MISS_TOKEN` | 输入缓存未命中 |
| `RESPONSE_TOKEN` | 输出 token |
| `REQUEST` | 请求次数 |

```
总输入 = PROMPT_TOKEN + PROMPT_CACHE_HIT_TOKEN + PROMPT_CACHE_MISS_TOKEN
总输出 = RESPONSE_TOKEN
总 Token = 总输入 + 总输出
```

### 对拍（交付要求 6）

**离线对拍** —— `test/golden.test.ts` 用夹具双向解析，一侧加载**真正的** Python 参考脚本
并调用它的 `parse_biz_data` / `input_tokens` / `output_tokens`，另一侧跑本插件的
`parser.ts`，逐字段比较：

```
✔ 对拍：本插件 parser 与 Python 参考实现逐字段一致
  test/fixtures/usage-2026-08.json、usage-2026-09.json
  → 5 类计量项 + 按模型明细 + 输入/输出/总计 全部相等
```

该测试**不发任何网络请求**（Python 侧的 `requests` 被桩替换为「禁止联网」），
因此可以离线、可复现地守住口径。**缺少参考脚本时会 `skip` 而不是 `fail`** ——
那个脚本是 gitignore 的外部输入，新克隆的仓库里不会有它。

> **入仓夹具是合成数据，不是你的账号数据。**
> `test/fixtures/usage-*.json` 由 `scripts/make-synthetic-fixtures.mjs` **确定性生成**，
> 形态刻意与真实接口一致（`sum(days[]) == total`、`amount` 是字符串、含全 0 模型、
> 整月天数、双层错误码），但内容纯属虚构 —— 有测试断言 `_synthetic: true`。
>
> 早前那版是从真实响应**按整数因子缩放**而来：绝对数值虽被混淆（比值 45.65 非整数，
> 无法简单反推），但「用了哪些模型」和「哪些天活跃」被完整保留，那是账号持有人的
> 节奏指纹。已整体替换。
>
> 想用**真实数值**对拍：`node scripts/capture-fixtures.mjs` 把真实响应抓到
> `test/fixtures/local/`（已 gitignore），对拍测试会自动一并比较；或直接跑
> `node scripts/golden-live.mjs`（需要 `DEEPSEEK_PLATFORM_USER_TOKEN` 环境变量）。

**在线端到端对拍** —— `node scripts/golden-live.mjs` 用同一账号、同一区间分别跑
完整 Python 脚本与插件数据层：

```
已严格比较 30 个历史月份（全部 5 类计量项逐项比对）
已比较按年汇总（当年因含当月而豁免）

── 历史区间（排除当月）总计对照 ──
Python : 总 <N> / 输入 <N> / 输出 <N> / 请求 <N>
插件   : 总 <N> / 输入 <N> / 输出 <N> / 请求 <N>   ← 四项与上一行逐位相同

✅ 对拍通过：历史月份 30 个 × 5 类计量项 + 按年汇总 + 历史总计全部一致
```

> 上面用 `<N>` 而不是真实数值：那些数字属于账号数据。对拍本身是在运行时**逐字段
> 比较**的（任何一位不同都会让脚本以非 0 退出），不依赖把数值抄进文档。

> 当月（2026-10）被排除在严格判定之外：对拍期间当前会话本身也在消耗同一账号的
> token，两边运行时刻不同，当月数字**必然**随时间变化。第二次对拍就实测到了这一点：
> 脚本侧读到 `231,917,160`，插件侧读到 `234,283,923`——同一个月、同一账号，因为
> 中间本会话又消耗了约 240 万 token。这正是必须豁免当月的原因；脚本会把当月值
> 并列展示，但不计入通过/失败。

数据来源分三类，互不混淆：
- **总消耗 / 今日 / 当周 / 当月**：来自平台的 `total[]` 与 `days[]`（自然月拉取）
- **当前项目消耗**：来自 DSH 会话投影 `tokenUsage`，按 `session.header.cwd` 分组
  （见 [用到的 DSH 扩展点](#用到的-dsh-扩展点0200-rc2-实测)），可用时显示真实数字，
  宿主不提供该表面时明确显示「当前项目统计不可用」而不是伪造 0

---

## 验证

```bash
pnpm run check                                        # typecheck + build + 79 项测试
pnpm run golden                                       # 在线端到端对拍（约 90 秒）
pnpm run verify:dsh                                   # 用本机 DSH 真实解析器校验声明
pnpm run build:preview                                # 重新生成预览页
```

### 声明校验（`pnpm run verify:dsh`）

`dsh.client` 的字段名、`exports["./client"]` 的存在性、平台门禁这些约定写错时
**运行时不会友好报错**，只会静默不装载浏览器半。所以这里不只靠文档：

该脚本在运行时从本机 `app.asar` 里取出 **DSH 自己的** `parseDshClient`，
在沙箱中求值后直接调用，校验本插件的声明；并附带**负例对照**（`platform` 缺失、
`inject` 含非字符串、`immediately` 非布尔、`dsh.client` 非对象），
证明确实是在跑 DSH 的校验逻辑而不是空转：

```
✔ dsh.client 通过 parseDshClient：{"platform":"web","inject":["@deepseek-ai/dsh-client-connection","@deepseek-ai/dsh-client-ui-slots"]}
✔ platform === "web"（浏览器半会被装载）
✔ exports["./client"] = ./lib/client.js（文件存在）
✔ dsh.bundle.patch = ./cordis.patch.yml（文件存在）
✔ bundle 注册 id = "dsh-tlogs"（等于包名）

负例对照（同一解析器必须拒绝这些）：
  ✔ platform 缺失 → 被拒绝
  ✔ inject 含非字符串 → 被拒绝
  ✔ immediately 非布尔 → 被拒绝
  ✔ dsh.client 非对象 → 被拒绝

✅ 本插件的声明通过 DSH 自己的解析器与门禁校验（且负例对照有效）
```

> 脚本在运行时才抽取解析器源码，**不把 DSH 的代码提交进仓库**。
> 找不到 DSH 时可用 `DSH_ASAR=<app.asar 路径>` 指定。

测试覆盖：

| 文件 | 覆盖内容 |
| --- | --- |
| `test/parser.test.ts` | 解析口径：字符串 amount、向零截断、未知 type、非字典条目、全 0 模型建键 |
| `test/history.test.ts` | TTL 缓存、失败兜底、月份枚举、增量计划、年月模型聚合、序列化 |
| `test/project.test.ts` | 项目用量四字段 → 五类计量项映射、分组聚合、降级 |
| `test/golden.test.ts` | **与 Python 参考实现的对拍** |
| `test/host-plugin.test.ts` | host 半：inject / Config / 工具定义（按 dsh-tools 真实校验规则）/ RPC 挂载 / 不发无谓请求 |
| `test/manifest.test.ts` | 声明一致性：`cordis.patch.yml` 的 config 键与 `Config` schema 双向对齐、模板行 id/name、bundle 注册 id === 包名（防静默回落默认值） |
| `test/client-mount.test.ts` | bundle 注册 id 与自包含性、slot 注册、**真实 React 挂载 → 点击展开 → 切详细视图 → 返回 → 卸载清理**、样式注入与移除 |

### 获取真实截图

1. 按 [安装](#安装) 把插件装进 profile 并重启 DSH
2. 侧边栏底部会出现紧凑条；点击 `▾` 展开
3. 系统截图即可（macOS `⇧⌘4` / Windows `Win+Shift+S`）

本仓库的 CI 环境无法启动 Electron GUI，因此**没有**提供应用内截图；`docs/embed-preview.html`
是用真实组件 + 真实 CSS 渲染的静态预览，仅用于核对布局与两种主题下的可读性。

---

## 项目结构

```
tlogs/
├── package.json              # dsh.bundle.patch / dsh.client / 构建与测试脚本
├── tsconfig.json
├── cordis.patch.yml          # profile 配置模板（含全部配置项与默认值）
├── src/
│   ├── index.ts              # host 入口：apply / Config / inject / RPC 挂载 / 工具注册
│   ├── service.ts            # 编排层：刷新、进度、快照、详细数据
│   ├── rpc.ts                # /tlogs RPC 端点与信封
│   ├── tools.ts              # query_token_usage 工具定义
│   ├── config.ts             # 配置归一化（sec→ms、越界夹取）
│   ├── types.ts              # 双端共享类型
│   ├── api/
│   │   ├── usage-client.ts   # fetch_month 的逐行翻译（含双层错误码）
│   │   └── parser.ts         # parse_biz_data 的逐行翻译
│   ├── auth/
│   │   ├── token-manager.ts  # 优先级、归一化、失效、退出
│   │   ├── credentials-store.ts  # credentials seam 适配（扁平 ref）
│   │   └── desktop-login.ts  # 方案 A 探测 + 方案 B 内置窗口登录
│   ├── store/
│   │   ├── cache.ts          # TTL 缓存 + 失败兜底
│   │   ├── history.ts        # 按月历史、增量计划、聚合
│   │   ├── persist.ts        # 原子落盘（tmp + rename）
│   │   ├── dates.ts          # 本地日历窗口（今日/周一/当月）
│   │   └── project.ts        # 当前项目用量（会话投影 tokenUsage）
│   └── client/
│       ├── index.ts          # 浏览器半入口：__ModuleLoader__ + slot 注册
│       ├── footer.tsx        # 内嵌容器（紧凑条 / 面板 / 详细视图 切换）
│       ├── compact-bar.tsx   # 形态 A
│       ├── expand-panel.tsx  # 形态 B（五张卡片 + 认证提示）
│       ├── detail-view.tsx   # 详细视图（四个可排序表格）
│       ├── store.ts          # 快照轮询、RPC 调用封装
│       ├── format.ts         # 千分位 / K-M-B 缩写
│       ├── h.ts              # JSX 工厂（只依赖 react）
│       └── styles.ts         # 样式（--dsw-* 主题 token）
├── scripts/
│   ├── build-client.mjs      # esbuild → 单文件 lib/client.js（模块系统包装）
│   ├── build-preview.mjs     # 生成 docs/embed-preview.html
│   ├── golden-live.mjs       # 在线端到端对拍
│   ├── verify-dsh-manifest.mjs   # 用本机 DSH 真实解析器校验声明（含负例对照）
│   ├── capture-fixtures.mjs  # 抓真实夹具到 test/fixtures/local/（不入库）
│   ├── make-synthetic-fixtures.mjs  # 生成**合成**入仓夹具（确定性、可复现）
│   └── verify-secrets.mjs    # 发布前密钥闸门（真实值 0 命中）
├── test/                     # 119 项测试 + 合成夹具 + Python 对拍脚本
└── docs/embed-preview.html   # 静态预览
```

---

## 用到的 DSH 扩展点（0.2.0-rc.2 实测）

下面每一项都在本机安装的 **0.2.0-rc.2** 产物里核对过（app.asar 内的官方包源码 +
profile 里已安装的第三方插件），不是照抄文档猜测。

| 能力 | 实测结论 |
| --- | --- |
| **内嵌席位** | `sidebar.footer.action`（`kind: list`, `scope: root`）。侧边栏页脚**只有**这一个扩展席位，不存在 `statusbar.right` |
| **注册方式** | `ctx.slots.inject(name, () => ctx.slots.register({ name, id, inject }, Component))`；`inject` 返回的对象合并进组件 props |
| **客户端服务** | `inject = ['connection', 'slots']`。DSH 客户端有约 40 个可注入服务 |
| **客户端模块格式** | `window.__ModuleLoader__.load({ id, factory: (require) => {...} })`，**`id` 必须等于包名**；模块体只注册 factory，物化时才执行 |
| **可 require 的模块** | 冻结种子表：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`dsh-client-store`、`dsh-client-ui-slots`、`dsh-client-ui-primitives`、`dsh-client-ui-dockkit`。**其它一律要打进 bundle** |
| **host↔client** | 客户端 `ctx.connection.rpc.call(channel, endpoint, payload)` ↔ host 端 `ctx.connection.rpc.handle(channel, handler)`，信封 `{ok:true,value}` / `{ok:false,error:{code,message,details}}` |
| **凭据** | `ctx.credentials.resolve/set/unset(ref)`。ref 语法是**扁平**的 `/^[A-Za-z_][A-Za-z0-9_]*$/`（与 POSIX 环境变量同一命名空间）；落盘在 `$DSH_HOME/.credentials.yaml` |
| **工具注册** | `ctx.tools.register(definition)`；`definition.output` 必须是 `{ schema, render }`，`schema` 必须落在受支持子集（`type`/`oneOf`/`properties`/`required`/`additionalProperties`/`items`/`enum`/`const` + 注解），`run_code` 是保留名 |
| **插件配置** | `export const Config = z.object({...})`（schemastery）+ `apply(ctx, config)` |
| **项目用量** | `ctx.sessionProjections.stateOf(session, 'tokenUsage').totals` → `{uncachedInputTokens, outputTokens, cacheReadTokens, cacheWriteTokens}`；冷会话走 `ctx.sessionProjectionCache.cachedSnapshot(header, ['tokenUsage'])`；按 `session.header.cwd` 分组 |
| **主题 token** | `--dsw-alias-*`（如 `label-primary`、`bg-layer-1/-2`、`border-l3/-l4`、`interactive-bg-hover`、`state-business-primary`、`state-warn-primary`、`state-error-primary`）+ `--dsw-radius-xs` + `--dsw-font-family`；深色主题选择器是 `body[data-ds-dark-theme]` |
| **样式回收** | 自己给 `<style>` 打 `data-plugin`，模块系统在卸载/HMR 时按 `style[data-plugin="<pkg>"]` 回收 |
| **不 import 官方包** | profile 下的插件**无法保证**解析到 app.asar 内部的 `@deepseek-ai/*`；本插件全部通过服务名获取，唯一运行时依赖是 `schemastery`（已在 profile 内） |

---

## 与需求文档的差异（实测后修正）

需求文档里明确说「UI 扩展点等名称需在开发时根据 SDK 确认，上述为示意」。核对真实产物后，
以下地方与文档描述不同，本插件按**实测结果**实现；接口与口径方面则一律以工作区
Python 脚本为准。

| # | 文档/需求写法 | 实测结果 | 本插件的处理 |
| --- | --- | --- | --- |
| 1 | 挂载到 `sidebar.footer` | 真实席位是 **`sidebar.footer.action`**；不存在 `statusbar.right` | 用 `sidebar.footer.action` |
| 2 | `ctx.credentials.set('tlogs:userToken', ...)` | ref 语法**不允许冒号**（扁平命名，同 POSIX 环境变量） | 用 `TLOGS_USER_TOKEN` |
| 3 | `by_api_key/amount` 返回 `biz_code:1 / INVALID_PARAM` | 实测返回 **HTTP 422** `{"detail":[{"loc":"query.end"}]}` | 走脚本的「非 200」分支处理，可选 `by_api_key` 只是拿不到数据 |
| 4 | 「HTTP 422/403 → 记录日志，返回空结果」 | 权威脚本对**所有非 200** 返回错误（`HTTP {status}: {text}`）；「返回空结果」与该脚本不一致 | 遵循脚本：返回错误**并**记录日志（不静默丢数据） |
| 5 | 请求间隔建议 1200ms | 脚本是 `REQUEST_INTERVAL = 1.0` | 默认 **1000ms**，可配 |
| 6 | `cacheTTL` 示例 `total: 1800`（注释写「秒」） | 单位确实是**秒** | 按秒解析并换算为毫秒 |
| 7 | RPC 注册带 `{ authority: 'loopback' }` | 0.2.0-rc.2 的 `handle` **只接受 `(channel, handler)`**，该选项是 no-op；保护来自会话 Cookie + Host/Origin 围栏 | 不再传该选项，并写明真实保护来源 |
| 8 | 客户端可读插件配置 | 客户端 `apply(ctx, config)` 拿到的 **config 是 undefined**；`settingsScope` / `webUiSettings` 在 0.2.0-rc.2 **不存在** | 展示配置由 host 通过 `snapshot.display` 下发 |
| 9 | `import { defineTool } from '@deepseek-ai/dsh-tools'` | 该包只在 app.asar 内，profile 插件不保证可解析；但 `register()` 读的是普通对象属性 | 直接传等价的对象字面量，避免运行时解析失败 |
| 10 | 「当前项目消耗」从 session 日志提取或监听事件 | 存在更可靠的**会话投影** seam（`tokenUsage`） | 用投影实现；不可用时明确降级为「不可用」 |
| 11 | 主题适配需自己处理浅色/深色 | 官方提供 `--dsw-alias-*` token，深色是 `body[data-ds-dark-theme]` | 全部走 token（带 fallback），不自造深色覆盖 |
| 12 | 「首次全量约 31 个月」 | 2024-04 → 2026-10 确实是 31 个月 | 一致；增量刷新只拉当月 + 上月 |
| 13 | 以为可以直接复用 DSH 的登录态 | 两条边界：`resolveToken(url)` **只对推理源**发凭据（其余返回 `undefined`）；且拿到的令牌必须用 **`x-dsh-auth-token`** 投递，用 `Bearer` 一律 `40003` | 见「方案 D」 |

---

## 已知限制

1. **首次全量拉取较慢**：31 个月 × 1s 节流 ≈ 40 秒。已放在后台异步执行，客户端靠轮询
   `snapshot` 展示进度条，UI 不阻塞。
2. **方案 B（内置窗口登录）在 DSH 桌面端不可用**：插件宿主是 Electron 以 Node 模式
   启动的 `dsh-desktop-host` 子进程，`require('electron')` 拿不到 `BrowserWindow`，
   登录窗口从未被创建（已用真实进程命令行核实）。host 会把该能力探测结果
   （`display.loginAvailable`）下发给客户端，「登录」按钮据此置灰并写明原因，
   不再出现「点了没反应」。
3. **方案 D 的投递头是硬依赖**：账号会话凭据**必须**用 `x-dsh-auth-token` 投递，
   换成 `Authorization: Bearer` 一定被回 `40003`。这是平台侧的行为，不是可配置项；
   代码里已按来源绑定 `scheme`，并有测试锁定「该方式下不得出现 Authorization」。
   另：`deepseekAccount` 的实现不在 npm 上（registry 只有抽象类），因此这条路径
   在**外部环境无法实例化**，端到端验证是通过「插件自己的 `fetchMonth` + 真实平台
   凭据」完成的（见「方案 D」的实测表格）。
4. **`REQUEST`（请求次数）在「当前项目消耗」中为 0**：宿主 `tokenUsage` 投影只提供
   token 计数，不提供请求次数。
5. **本地日历 vs UTC 月份边界**：历史区间的月份边界严格跟随脚本用 **UTC**
   （保证对拍一致）；「今日/当周/当月」用**本机本地日历**切片。跨时区用户可能在上下午
   边界看到一天偏差，对 GMT+8 用户两者一致。
6. **历史缓存落盘**：默认写到 `<DSH_HOME>/tlogs/history.json`（只有用量计数，**不含
   token、不含对话内容**）。设 `persistHistory: false` 可完全关闭文件系统访问。
7. **GUI 状态**：已在真实桌面端 GUI 中确认插件**确实加载并渲染**（用户实测可见紧凑条
   与「登录」按钮，且点击有响应），对话也不再报工具 schema 错误。针对「登录静默失败」、
   「展开按钮看不清」以及新增的方案 D，**仍需重启 DSH 后目视确认**。

---

## 数据清单与隐私

本插件获取与产生的**全部**信息、各自流向与风险，都在下面这一张表里。
**插件只碰这些，没有别的。**

| # | 数据 / 信息 | 来源 → 用途 | 流向 | 可能的风险 | 已做的缓解 |
| --- | --- | --- | --- | --- | --- |
| 1 | **会话工作目录**（完整绝对路径） | `session.header.cwd` → 按项目分组算用量 | host 内存；**完整路径不出 host** | 暴露本机目录结构：用户名、盘符、项目命名，甚至客户名 / 机密项目名。原先会被下发到浏览器层，也曾随工具异常消息进模型上下文 | 下发前改 `publicProjectId()` 短哈希；工具异常只列 label；UI 只显示末两级。**剩余**：末两级路径与工作区标题仍会显示 |
| 2 | **会话枚举范围**（你有哪些会话） | `sessionQuery.filterSessions([])` —— **空过滤 = 全部会话**，外加 `sessions.list()` | 仅 host 内存 | 元数据泄漏：即便不读内容，也能推断出你有哪些项目、活跃程度与数量 | 无（这是「当前项目消耗」的必需输入）。可 `enableProjectScope: false` 整体关闭 |
| 3 | **工作区标题 + 路径** | `workspaceRegistry.list()` → 项目卡片显示名 | 会下发到浏览器（本地） | 标题可能含业务敏感名；开启工具时会随 label 进模型上下文 | 仅用于显示；`enableProjectScope: false` 可关 |
| 4 | **每会话 token 用量四元组** | `tokenUsage` 投影 / 冷缓存 → 汇总 | host 内存 + 可落盘 | 泄漏使用强度与成本规模；逐日粒度可推断工作作息 | 只在本机；默认不进模型上下文；`persistHistory: false` 完全不落盘 |
| 5 | **环境变量** | `DEEPSEEK_PLATFORM_USER_TOKEN`、`TLOGS_CACHE_DIR` | host 内存 | 前者是明文令牌（任何能读你进程环境的代码都能读）；后者被**完全信任**，若被恶意设置可让插件写向任意目录的 `history.json` | 只读这两个名字；缓存文件名固定、无路径穿越 |
| 6 | **本机凭据 `TLOGS_USER_TOKEN`** | DSH credentials seam → 认证 | 落盘 `$DSH_HOME/.credentials.yaml`；作为凭据发给平台 | **实测该文件里的值可直接使用**（未经任何解密就成功调用了接口）→ 任何以你用户身份运行的进程都能读走并冒用你的平台账号 | 插件自身不额外落盘令牌；日志只记长度。**存储方式由 DSH 决定，插件改不了** |
| 7 | **账号会话凭据**（token / origin / requestHeaders） | `deepseekAccount.getPlatformSession()` → 零配置认证 | **发给 `platform.deepseek.com`** | 账号级凭据；泄漏即他人可读你的用量（乃至更多，取决于 scope）。若平台返回 3xx 或中间人有能力，自定义头会被转发 | `redirect: 'manual'`（实测挡住跨域转发）；facade 收窄（结构上无法 `signOut` / `rejectToken`）；只读不写；`useAccountSession: false` 可完全关闭。**剩余**：凭据在进程内存驻留（现最长 60s 缓存） |
| 8 | **账号 `userId`**（接口会返回） | `getPlatformSession()` → **被丢弃不用** | 无处 | 若被记录会成为跨会话的稳定身份标识 | **代码从不读取**（全仓 grep `userId` 只命中一处注释）。无风险 |
| 9 | **插件配置** | profile 的 `cordis.patch.yml` | host 内存 | 若把 token 填进 `platformUserToken`，它会**明文出现在 profile 配置文件里** —— 比凭据库更容易被看到或误提交进版本库 | 模板默认空串并标注「不推荐」；推荐走凭据系统 |
| 10 | **月度用量五类计数** | 平台接口 → 面板 | 本地 UI；开启工具时进模型上下文 | 你的账单规模。进模型上下文 = 把消费数据交给模型提供方 | `exposeUsageToModel` **默认 false**（工具不注册） |
| 11 | **模型名** | 平台接口 `total[].model` | 本地 UI（详细视图）；同上 | 暴露你用了哪些模型，可能透露工作性质 | 同上 |
| 12 | **当月逐日明细** | 平台接口 `days[]` | 本地 UI；可落盘 | 比月度更细的时序 → 可推断工作节奏 | 仅本机；`persistHistory: false` 不落盘 |
| 13 | **平台错误响应体**（前 200 字符） | 接口响应 → 日志 + 面板 | 日志、UI | 外部文本进日志 → **日志注入**（换行可伪造日志行）；意外回显敏感文本 | 单行化 + 截断 + **显式抹掉令牌本体** + 不再落盘 |
| 14 | **`history.json`** | 插件写盘 | `<cacheDir>/history.json` | 长期驻留磁盘的用量画像（含模型名与逐日）；能读你用户目录的进程可读。**未显式设 0600**，靠 OS 默认 ACL | 不含 cwd / 会话 ID / token / 错误文本；`persistHistory: false` 可完全关闭 |
| 15 | **下发给浏览器的 snapshot / detail** | host → 浏览器 RPC | 本机浏览器（**不出机器**） | 与其它第三方插件的客户端代码**共享同一个 JS realm**，它们能读到全部数字、项目 label、哈希 id、认证来源 | 完整路径已改哈希；端点收敛（`export` 停用、`setToken` 限长、`refresh` 限流）。**剩余**：同 realm 读取无法由本插件阻止 —— 这是 DSH 的插件隔离模型问题 |
| 16 | **发往 `platform.deepseek.com` 的请求** | host → 外网 | 出境 | 请求本身**不含任何本地数据**（只有 `year` / `month` + 凭据）；但凭据泄漏即账号泄漏。另外 `Origin` / `Referer` 伪装头意味着流量伪装成网页客户端（不做会被 WAF 拦 —— 灰色但必要） | 出口写死单主机、不跟随重定向、部署头走白名单、不读代理环境变量 |
| 17 | **工具输出 → 模型提供方** | host → 模型 | 出境（仅当开启） | 用量数字 + 项目 label 进对话上下文，会被发送给模型提供方并可能被其留存 | **默认关闭**；显式 `exposeUsageToModel: true` 才注册 |
| 18 | **宿主日志** | 插件 `logger` | 磁盘日志 | 含 origin、脱敏 token（**仅长度**）、账号接入事件、平台错误文案；日志文件可能被同步或随工单上传 | 令牌不落日志；错误单行化 + 抹令牌；账号凭据只在真正重读时打一行 |
| 19 | **会话 header（整体对象）** | 传给 `sessionProjectionCache.cachedSnapshot(header, [...])` 当键 | 仅 host 内部 API | 我们**不解析**它的其它字段，但它会经过插件代码传递 | 只传引用、不读取、不存储、不出境 |

### 明确**不**获取的

对话内容 / 消息文本 · 附件与图片 · 会话标题 · 账号邮箱与手机号 · **任何 API Key**
（`DEEPSEEK_API_KEY` 等从未被读取）· 剪贴板 · 浏览器数据 · 其它文件 ·
`platform.deepseek.com` 以外的任何主机。

第 5 项里的「API Key 从不读取」是删掉方案 A 的直接收益：那条路径会按名字盲猜宿主服务
并调用任意 getter，可能把推理令牌或 API Key 当平台令牌发出去。删掉后凭据来源只剩四条
显式途径（环境变量 / 配置 / `TLOGS_USER_TOKEN` / `getPlatformSession()`），与 API Key
完全无关。

### 最小化配置

四个开关全关之后，这个插件只剩一件事：拿你**显式**给的 token 去
`platform.deepseek.com` 按月取数并显示在侧边栏。**不遍历会话、不读 cwd、不写磁盘、
不接触账号服务、数字不进模型上下文。**

```yaml
exposeUsageToModel: false   # 默认已是 false
useAccountSession: false    # 不接触 deepseekAccount
enableProjectScope: false   # 不遍历会话、不读 cwd
persistHistory: false       # 完全不写磁盘
```

---

## 安全

- userToken **不出现在源码、日志、打包产物**中：源码里没有任何字面量 token，
  日志只输出脱敏描述（`<redacted:len=64>`，**只暴露长度，不暴露任何字符**）
- token 只存于 DSH 凭据系统（`$DSH_HOME/.credentials.yaml`），**不写入插件自己的缓存文件**
- token **只发送到 `platform.deepseek.com`**，不经过任何第三方
- **不跟随重定向**（`redirect: 'manual'`）。这是实测逼出来的加固：运行时在跨域重定向
  时会剥掉标准凭据头（`Authorization` / `Cookie`），但**不剥自定义头** —— 实测
  `x-dsh-auth-token` 会被原样转发到重定向目标。方案 D 用的正是自定义头，所以必须
  自己掐断；3xx 会被当成非 200 报错，且只回显目标 origin，不回显整条 Location
- 权限最小化：host 只把 `tools` 声明为必需服务；`credentials` / `connection` / `webServer` /
  `deepseekAccount` 都是可选能力，缺失时优雅降级
- 方案 D 复用账号登录态时：服务在注入时就被**收窄成只暴露 `getPlatformSession`
  的 facade** —— `deepseekAccount` 上还有 `signOut()` / `rejectToken()` 这类会移除
  本地登录态的方法，收窄后令牌路径**结构上拿不到它们**（不是靠约定）
- 由本插件独占的请求头（`authorization` / `x-dsh-auth-token` / `host`）**不允许被
  账号下发的 `requestHeaders` 覆盖**。实测：即便 `requestHeaders` 里塞了伪造的
  `Authorization` 与 `Host`，实际发出的仍是插件自己的凭据，连接目标也无法被劫持
- RPC `setToken` 有 **4096 字符上限**：该入口会把入参落盘并当请求头发出去，
  不能接受任意长度的输入
- **用量数字默认不进入模型上下文**：`exposeUsageToModel` 默认 `false`，即
  `query_token_usage` 工具**根本不注册**。数字只经 host→浏览器 RPC 进入侧边栏 UI
- **部署头走白名单**：只接受 `x-` 前缀的扩展头，`Cookie` / `Origin` / `Referer` /
  `Host` / `x-forwarded-*` 一律丢弃（实测不做白名单时它们会原样到达服务器）
- **`export` 端点已停用**：客户端从未调用它，而它会返回含项目绝对路径的全量报告
- 平台响应体**不再落盘**：`serialize()` 剥离 `error` 字段，避免把外部文本写进本地文件
- 只读写缓存目录下的**一个** JSON 文件，不触碰 session 日志或其它路径
- 组件不接收、不渲染、不记录任何对话内容
- **不使用 `innerHTML`** 渲染动态内容（全部经 React），所有数字经严格类型转换
- `setToken` 提交后立即从组件状态清除明文输入
- 仓库内的对拍夹具是**合成数据**（`scripts/make-synthetic-fixtures.mjs` 确定性生成，
  有测试断言 `_synthetic: true`），**不含任何真实账号数据**；真实夹具只在本地
  `test/fixtures/local/` 生成且不入库
- 样例配置与文档里**不含任何真实 token**（有脚本级扫描确认）

### 可能风险（完整清单）

> 两轮审查发现的问题**已全部修掉**（见下方「安全审查修复记录」）。下面是**仍然存在**
> 的风险，按「谁该负责」分组 —— 我不想把 DSH 层面的问题说成是插件的，也不想把插件的
> 问题推给 DSH。**A 类我改不了，B 类是我引入的取舍，C 类靠你的使用习惯。**

#### A. 由 DSH 的架构决定，本插件无法修复

1. **跨插件共享同一个 JS realm。** 所有插件的浏览器半侧都跑在同一个 `window` 里。
   **任何另一个插件的客户端代码都能调用 `/tlogs` 的 `setToken`（把用量查询指向别人的
   账号）或 `logout`（清掉令牌并销毁历史缓存）。** 装的第三方插件越多，这个面越大。
   本插件能做的只是收敛端点（`export` 停用、`setToken` 限长、`refresh` 限流），
   **无法阻止同 realm 的读取**。
2. **`.credentials.yaml` 里的凭据是「拿来即用」形态。** 实测：把文件里那条 grant 的
   `token` 值**未经任何解密**直接当 `x-dsh-auth-token` 打接口，就取到了真实数据。
   含义是 —— **任何以你用户身份运行的进程都能读到可用凭据**（Windows ACL 只挡别的
   用户）。你手动粘贴的 `TLOGS_USER_TOKEN` 也以同样形态落在那里。存储方式由 DSH
   决定，插件改不了。
3. **本机回环服务 + 会话 Cookie。** DSH 的 401/403 围栏（会话 Cookie + Host/Origin
   校验）我核实过源码、是真实有效的，能挡 CSRF 与 DNS rebinding；但本机上一个拿到该
   Cookie 的恶意进程可以调 RPC。这属于 DSH 的威胁模型。
4. **依赖供应链。** 插件唯一运行时依赖是 `schemastery`，但 profile 的 pnpm registry
   指向 `registry.npmmirror.com`（第三方镜像）。**镜像被投毒 = 安装期注入代码**，
   影响所有包，不是本插件特有的问题。

#### B. 本插件引入、已缓解但有剩余

5. **账号会话凭据在进程内存驻留。** 为消除「每 800ms 轮询都读一次账号服务」的放大
   效应，我加了 60s 短缓存 —— 这是「性能 vs 凭据驻留时间」的取舍：不缓存则每秒
   1~2 次账号服务调用。`useAccountSession: false` 可彻底消除这条路径。
6. **面板仍显示项目 label**（末两级路径或工作区标题）。这是功能必需，否则你分不清
   是哪个项目。连这个都不接受，就 `enableProjectScope: false`。
7. **平台错误文案会进宿主日志。** 已做单行化 + 截断 + 抹掉令牌本体，但平台返回的
   文本本身仍会写进日志。这是「可诊断性」的代价；我选择不静默丢弃它。
8. **RPC 没有插件自有鉴权。** 保护全来自 DSH 连接层（见 A1 / A3）。我**故意不自己
   加一层** —— 那需要自定义共享密钥或密码学，引入的出错风险大概率高于它挡住的威胁。
9. **`lib/` 被手改无法检测。** `lib/` 是被提交且**直接运行**的产物，目前没有校验能
   发现「绕过 `src/` 只手改 `lib/`」。**我没实现这个检查**：客户端 bundle 由 esbuild
   写死输出路径，要支持「构建到别处再比对」得先改构建脚本；硬加比对容易产生假阳性，
   反而让这条检查失去可信度。这是**已知缺口**，不是已完成项。

#### C. 使用习惯层面（插件管不了）

10. **你自己在对话里贴数字或截图** → 照样进模型上下文。插件只能控制工具，控制不了
    这个行为本身。
11. **把 token 填进 `platformUserToken`** → 它会明文出现在 profile 配置里，比凭据库
    更容易被看到或误提交进版本库。
12. **参考脚本里的明文令牌**：`deepseek_python_20261007_a1f087.py` 第 24 行把真实
    `USER_TOKEN` 写死在源码里。这**不是本插件的文件**，我不擅自改写它，但已做的处理：
    `.gitignore` 排除 `deepseek_python_*.py`、`scripts/golden-live.mjs` 不再从它抓令牌
    （只认环境变量）。**建议在平台侧让该会话失效并轮换**，然后把它改成从环境变量读 ——
    这一步只能你自己做。

### 安全审查修复记录

一轮对抗性审查（含实测复现）后做的加固：

| # | 问题 | 处置 |
| --- | --- | --- |
| 1 | 自定义凭据头 `x-dsh-auth-token` 在**跨域重定向**时会被运行时原样转发（`Authorization` 会被剥离，自定义头不会）→ 平台侧或中间人返回 3xx 即泄漏账号凭据 | `redirect: 'manual'`，3xx 直接报错且只回显目标 origin |
| 2 | 插件持有 `deepseekAccount` 全部方法（含 `signOut()` / `rejectToken()`） | 注入时收窄成只暴露 `getPlatformSession` 的 facade |
| 3 | 方案 A 按名字盲猜宿主服务并调用任意 getter（confused deputy，可能有副作用、可能外发推理令牌/API Key） | **整体删除**，并由测试防止回归 |
| 4 | `extraHeaders` 可覆盖除凭据头外的任意头（实测 `Cookie`/`Origin`/`Referer`/`x-forwarded-*` 均原样到达服务器） | 改成**白名单**：只收 `x-` 前缀，且拒绝来源伪造类 |
| 5 | `export` 端点无客户端调用方，却返回含项目**绝对路径**的全量报告 | 停用（返回 `disabled`） |
| 6 | `redactToken()` 日志暴露令牌前 4 字符 | 改为只暴露长度 |
| 7 | RPC `setToken` 接受任意长度输入并落盘 + 当请求头发送 | 4096 字符上限 |
| 8 | 平台响应体前 200 字符会随 `error` 落盘到 `history.json` | `serialize()` 不再写 `error` |
| 9 | 用量数字默认进入模型上下文 | 新增 `exposeUsageToModel`，**默认 false**（工具不注册） |
| 10 | 无法关闭账号凭据复用 | 新增 `useAccountSession`（`false` 时连可选注入都不发起） |

第二轮自查（针对"还可能有什么风险"）新增的四条，都有实测复现：

| # | 问题 | 处置 |
| --- | --- | --- |
| 11 | **非法令牌会被原样回显**：`fetch` 在请求头非法时抛出的消息形如 `Headers.append: "Bearer <token>" is an invalid header value.` —— 多行粘贴的令牌因此进入宿主日志与面板错误文案 | `normalizeUserToken` 只接受可打印 ASCII（无空白/控制字符）；同时所有错误文案用 `scrubToken` 显式抹掉令牌本体 |
| 12 | **日志注入**：错误文本里的换行可伪造出额外的日志行 | 所有错误文案经 `oneLine` 压成单行（去控制字符、折叠空白、截断） |
| 13 | **账号服务被放大轮询**：客户端刷新期间每 800ms 拉一次 `snapshot`，而 `snapshot → authState → resolve()` 每次都会调用 `getPlatformSession()` —— 每秒 1~2 次账号服务读取 + 同频率日志行 | 短 TTL 缓存：拿到令牌缓存 60s、「没拿到」缓存 15s；日志只在真正重读时打一行 |
| 14 | **强制刷新可被打成循环**：`force` 绕开全部 TTL 与节流，单次最多 31 个外发请求，而任何已认证的页面代码都能调用该端点 | 强制刷新 5s 最小间隔（不影响手动点「刷新」的手感） |
| 15 | **本机目录结构外泄**：客户端的「当前项目消耗」卡片里 `options[].id` 就是 `session.header.cwd` 的**完整绝对路径**（UI 只显示 label，完整路径毫无用途却下发到了浏览器层） | 下发前改 `publicProjectId()` 短哈希；客户端的切换逻辑不受影响（id 仍稳定唯一） |
| 16 | **模型可见的异常消息列出全部项目绝对路径**：`未找到项目 'x'；可用：<cwd1>, <cwd2>…` | 改为只列 `label`（末两级） |

> 另有两条经实测确认**当前无风险**，记录以免重复怀疑：
> ① HTTP 头值含 CRLF **不会**造成头注入 —— undici 在发起连接前就拒绝；
> ② 客户端无 `innerHTML` / `dangerouslySetInnerHTML` / `eval` / `new Function`，
> 数据全部经 React 文本节点渲染。

> **仍建议但未实现**：`lib/` 是被提交且**直接运行**的产物，目前没有任何校验能发现
> "有人绕过 `src/` 只手改 `lib/`"。彻底的做法是加一条构建一致性检查（把 `src/` 重新
> 构建到临时目录再与 `lib/` 逐文件比对）。我没有实现，因为客户端 bundle 由 esbuild
> 直接写死输出路径，要支持"构建到别处"得先改构建脚本；在没改之前硬加比对容易产生
> 假阳性，反而降低这条检查的可信度。

> 审查中另有两项**被我实测推翻**，记在这里以免后人重复怀疑：
> ① 「`src/` 落后于 `lib/`、重建会静默回退加固」—— `lib/` 由 `tsc` 从 `src/` 生成；
> 我删掉整个 `lib/` 从 `src/` 重建后 114 项测试全过（其中一条正是断言
> `redirect: 'manual'` 通过真实构建产物生效），该结论是审计方并发读写的假象。
> ② 「`logger.info?.()` 未保护 `logger.info` 本身」—— `?.()` 就是可选调用语法，本身即保护。

> 提醒：参考脚本里的明文令牌见上方「已知残余风险」第 3 条 —— 该文件已加入
> `.gitignore`，但**轮换令牌这件事只能你自己在平台侧做**。

---

## 许可

MIT
