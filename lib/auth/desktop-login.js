/**
 * tlogs — 账号会话凭据与内置登录窗口。
 *
 * `readPlatformSessionToken` 从宿主的账号服务读取 Platform 会话凭据（零配置路径）；
 * `interactiveLogin` 打开内置窗口让用户登录网页版，再从 localStorage 抓 userToken。
 * 约束：本文件只读凭据，绝不调用账号服务上任何会改动登录态的方法。
 */
import { createRequire } from 'node:module';
function asNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}
/**
 * 读取 DSH 已登录账号的 Platform 会话凭据。
 *
 * 宿主只通过 `getPlatformSession()` 暴露它：签名见 `@deepseek-ai/dsh-deepseek-account`
 * 的类型声明 `getPlatformSession(): Promise<PlatformSession | null>`，未登录时返回 null。
 * 不能用 `resolveToken(url)`：那个接口的契约是「只为推理源解析凭据」，把用量接口的源传进去
 * 只会拿到 undefined，这是刻意的安全边界而非缺陷。
 *
 * service 应当是只暴露 `getPlatformSession` 的收窄 facade，而不是完整的 `deepseekAccount`
 * —— 后者还有 `signOut()` / `rejectToken()` 这类会移除本地登录态的方法，传 facade 才能把
 * 「我们不调用它们」变成结构上的不可能。本函数只读这一个方法；未登录、凭据被拒、实现内部
 * 报错都归为「拿不到」。
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
        return undefined;
    }
    if (!session || typeof session !== 'object')
        return undefined;
    const token = asNonEmptyString(session.token);
    if (!token)
        return undefined;
    const origin = asNonEmptyString(session.origin);
    const headers = asHeaderMap(session.requestHeaders);
    return { token, origin, headers };
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
 * 打开内置窗口让用户登录网页版，并从 localStorage 抓取 userToken：拿不到 Electron 就返回
 * undefined（调用方会退化为「手动填写 userToken」），超时或用户关窗同样返回 undefined。
 * 返回的是原始值，归一化由调用方负责。
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
 * 尝试加载 Electron：任何失败都返回 undefined。插件被 profile 以 `link:` 装进
 * `node_modules`，从插件目录出发通常解析不到 `electron`，所以依次用插件自身、宿主入口、
 * 可执行文件三个基准路径再试。
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
 * 内置登录在当前宿主是否真的可用。桌面端的插件宿主由 Electron 二进制以 Node 模式启动，
 * `require('electron')` 拿不到 `BrowserWindow`。与其让按钮假装可用，不如把真实能力告诉
 * 客户端，由它置灰并给出改用手动填写的指引。
 */
export function canInteractiveLogin() {
    const electron = loadElectron();
    return typeof electron?.BrowserWindow === 'function';
}
function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
//# sourceMappingURL=desktop-login.js.map