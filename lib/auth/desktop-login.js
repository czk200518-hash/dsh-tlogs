/**
 * tlogs — 桌面端自动获取 userToken。
 *
 * 需求 2.2 给出三条路径，本文件实现其中的探测部分：
 *
 *  方案 A（优先）：从桌面端已有的认证状态中提取
 *    - 先探 DSH 的 credentials seam（候选 ref 列表，见 credentials-store.ts）
 *    - 再对宿主里可能存在的账号 / 授权服务做**受限探测**：只在服务真的暴露
 *      可调用的读取方法时才使用，任何异常都吞掉并返回 undefined
 *
 *  方案 B（回退）：内置浏览器窗口登录
 *    - 用 Electron 的 BrowserWindow 打开 https://platform.deepseek.com/usage
 *    - 轮询 webContents.executeJavaScript 读取
 *      localStorage['userToken']（JSON 字符串，需取 .value，见需求 2.3）
 *    - 取到后立即关闭窗口
 *
 * 诚实声明（同时写进 README）：
 *  方案 B 依赖宿主进程能加载 Electron 的 `electron` 模块。DSH 桌面端运行在
 *  Electron 主进程语义下，但**该能力无法在开发环境静态验证**，因此这里用
 *  try/catch 包裹：拿不到 Electron 就返回 undefined，插件随即退化为
 *  「手动填写 userToken」（方案 C），不会报错也不会卡住。
 */
import { createRequire } from 'node:module';
function asNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}
/**
 * 方案 D：复用 DSH 已登录账号的 Platform 会话凭据。
 *
 * 权威契约（`@deepseek-ai/dsh-deepseek-account` 的 `lib/types/index.d.ts`）：
 *
 * ```
 * // Read credentials for the configured Platform origin, bound to their
 * // issuing environment, ... @returns a Host-only snapshot, or null while signed out
 * abstract getPlatformSession(): Promise<PlatformSession | null>
 *
 * // Host-only credentials ... never expose through account RPC
 * interface PlatformSession { origin; token; userId; requestHeaders? }
 * ```
 *
 * 为什么用这个而不是 `resolveToken(url)`：后者的契约是
 * 「Resolve a credential **only for the inference origin** ... returns undefined for
 * other origins」—— 把用量接口的源传进去只会拿到 `undefined`。那是刻意的安全
 * 边界，不是缺陷，所以本插件必须走 `getPlatformSession()` 这条 Host-only 路径。
 *
 * 安全：本函数**只读**，且只碰 `getPlatformSession` 这一个方法。
 *
 * 调用方应当传入一个**收窄后的 facade**（只暴露 `getPlatformSession`），而不是
 * 完整的 `deepseekAccount` 服务 —— 那个服务上还有 `signOut()` / `rejectToken()`
 * 这类会移除本地登录态的破坏性方法。传 facade 才能把「我们不调用它们」从
 * 约定变成**结构上的不可能**。
 */
export async function readPlatformSessionToken(service) {
    const svc = service;
    if (!svc || typeof svc !== 'object')
        return undefined;
    const fn = svc['getPlatformSession'];
    if (typeof fn !== 'function')
        return undefined;
    let session;
    try {
        session = await fn.call(svc);
    }
    catch {
        // 未登录 / 凭据被拒 / 实现内部错误，一律归为「拿不到」，不打扰用户。
        return undefined;
    }
    if (!session || typeof session !== 'object')
        return undefined;
    const token = asNonEmptyString(session.token);
    if (!token)
        return undefined;
    const origin = asNonEmptyString(session.origin);
    const headers = asHeaderMap(session.requestHeaders);
    return headers ? { token, origin, headers } : { token, origin };
}
/** 只收 string→string 的普通对象；其余一律当作「没有」。 */
function asHeaderMap(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return undefined;
    const out = {};
    for (const [k, val] of Object.entries(v)) {
        if (k.length > 0 && typeof val === 'string')
            out[k] = val;
    }
    return Object.keys(out).length > 0 ? out : undefined;
}
/**
 * 方案 B：打开内置窗口让用户登录，并从 localStorage 抓取 userToken。
 *
 * @param opts.timeoutMs 用户最长可停留时间，默认 5 分钟
 * @param opts.pollMs    轮询间隔，默认 1000ms
 * @returns 原始 userToken（调用方负责 normalizeUserToken）
 */
export async function interactiveLogin(opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
    const pollMs = opts.pollMs ?? 1000;
    const electron = loadElectron();
    if (!electron) {
        opts.logger?.warn?.('tlogs: 当前宿主无法加载 Electron，内置登录不可用');
        return undefined;
    }
    const BrowserWindow = electron.BrowserWindow;
    if (typeof BrowserWindow !== 'function') {
        opts.logger?.warn?.('tlogs: Electron 未导出 BrowserWindow，内置登录不可用');
        return undefined;
    }
    const win = new BrowserWindow({
        width: 520,
        height: 760,
        title: '登录 DeepSeek 开放平台',
        autoHideMenuBar: true,
        webPreferences: {
            // 独立分区，避免与主窗口的登录态互相影响；不开启 node 集成。
            partition: 'persist:tlogs-login',
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    try {
        await win.loadURL('https://platform.deepseek.com/usage');
    }
    catch (e) {
        opts.logger?.warn?.(`tlogs: 打开登录页失败：${e instanceof Error ? e.message : String(e)}`);
        try {
            win.destroy();
        }
        catch {
            /* ignore */
        }
        return undefined;
    }
    const deadline = Date.now() + timeoutMs;
    const readScript = "(() => { try { return window.localStorage.getItem('userToken'); } catch (e) { return null; } })()";
    try {
        while (Date.now() < deadline) {
            if (typeof win.isDestroyed === 'function' && win.isDestroyed())
                return undefined;
            if (typeof win.isVisible === 'function' && !win.isVisible())
                return undefined;
            try {
                const raw = await win.webContents.executeJavaScript(readScript, true);
                const s = asNonEmptyString(raw);
                if (s)
                    return s;
            }
            catch {
                // 页面尚未就绪 / 正在导航，忽略并继续轮询。
            }
            await delay(pollMs);
        }
        return undefined;
    }
    finally {
        // 需求 2.2：读取后立即关闭窗口。
        try {
            if (typeof win.isDestroyed !== 'function' || !win.isDestroyed())
                win.destroy();
        }
        catch {
            /* ignore */
        }
    }
}
/**
 * 尝试加载 Electron。任何失败都返回 undefined。
 *
 * 依次用插件自身、宿主入口、可执行文件三个基准路径做 `createRequire`：
 * 插件是被 profile 以 `link:` 装进 `node_modules` 的，从插件目录出发通常
 * 解析不到 `electron`，而宿主进程所在位置有可能可以。
 */
function loadElectron() {
    const bases = [import.meta.url, process.argv[1], process.execPath].filter((b) => typeof b === 'string' && b.length > 0);
    for (const base of bases) {
        try {
            const req = createRequire(base);
            const mod = req('electron');
            if (mod && typeof mod === 'object')
                return mod;
        }
        catch {
            // 该基准路径解析不到 electron，换下一个。
        }
    }
    return undefined;
}
/**
 * 内置登录（方案 B）在当前宿主是否**真的可用**。
 *
 * 实测（DSH 0.2.0-rc.2 桌面端）：插件跑在 `dsh-desktop-host` 子进程里，该进程
 * 由 Electron 二进制以 Node 模式启动（`--expose-internals` 后直接执行 .js 入口），
 * 因此 `require('electron')` 拿不到 `BrowserWindow` —— 表现就是「点了登录没反应」，
 * 窗口从未被创建。
 *
 * 与其让按钮假装可用，不如把真实能力告诉客户端：不可用时置灰并给出明确指引。
 */
export function canInteractiveLogin() {
    const electron = loadElectron();
    return typeof electron?.BrowserWindow === 'function';
}
function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
//# sourceMappingURL=desktop-login.js.map