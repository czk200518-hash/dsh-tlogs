/**
 * tlogs — userToken 的获取、归一化、存储与生命周期管理。
 *
 * 对应需求第二章「认证机制」与 5.1/5.2「安全处理」。
 *
 * 安全约束（不得违反）：
 *  - userToken 绝不写入插件源码或打包产物
 *  - 只通过 DSH 的 credentials seam 持久化（见 SecretStore 接口）
 *  - 绝不把 token 打进日志、错误信息或 UI
 *  - token 只发送到 platform.deepseek.com
 */
/** 凭据系统中使用的键名。 */
export const TLOGS_TOKEN_KEY = 'tlogs:userToken';
/** 环境变量名（开发调试用，对应需求 6.2）。 */
export const TOKEN_ENV_VAR = 'DEEPSEEK_PLATFORM_USER_TOKEN';
/** 内存实现，用于测试与降级（进程重启即丢失，不会落盘）。 */
export class MemorySecretStore {
    map = new Map();
    get(key) {
        return this.map.get(key);
    }
    set(key, value) {
        this.map.set(key, value);
    }
    delete(key) {
        this.map.delete(key);
    }
}
/**
 * 归一化外部拿到的 userToken 原始值。
 *
 * 需求 2.3：platform.deepseek.com 把 token 以 **JSON 字符串**形式存在 localStorage：
 *   `{"value":"TESTONLY...","__version":"0"}`
 * 整个 JSON 对象不是 token，只有 `value` 字段才是。
 *
 * 因此这里要能处理以下全部输入形态：
 *   1. `{"value":"...","__version":"0"}`  ← localStorage 原始值
 *   2. `"Vc8..."`                          ← 被 JSON 序列化过的裸串
 *   3. `Vc8...`                            ← 已经取出的裸 token
 *   4. `Bearer Vc8...`                     ← 误带前缀
 *
 * 返回 undefined 表示无法得到有效 token。
 */
export function normalizeUserToken(raw) {
    if (typeof raw !== 'string')
        return undefined;
    let s = raw.trim();
    if (s.length === 0)
        return undefined;
    // 形态 1/2：JSON。解析失败则按裸串处理。
    if (s.startsWith('{')) {
        try {
            const parsed = JSON.parse(s);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                const v = parsed.value;
                if (typeof v === 'string')
                    s = v.trim();
            }
        }
        catch {
            // 保持原样，继续按裸串处理
        }
    }
    else if (s.startsWith('"')) {
        try {
            const parsed = JSON.parse(s);
            if (typeof parsed === 'string')
                s = parsed.trim();
        }
        catch {
            // 保持原样
        }
    }
    // 形态 4：剥掉可能存在的 Bearer 前缀（大小写不敏感）。
    s = s.replace(/^Bearer\s+/i, '').trim();
    if (s.length === 0)
        return undefined;
    // 只接受可打印 ASCII（无空格、无控制字符）。
    //
    // 安全：平台令牌是 base64 风格字母表，绝不含空白或控制字符。若用户粘贴的是
    // 多行内容，带换行的值会让 undici 在构造请求头时抛错，而**那条错误消息会把头的
    // 值原样回显**（实测：`Headers.append: "Bearer <token>" is an invalid header
    // value.`）—— 令牌因此进入宿主日志与面板错误文案，换行还会污染日志行。
    // 在这里挡掉，用户拿到的是明确的「格式无效」，而不是一条含令牌的报错。
    if (!/^[\x21-\x7e]+$/.test(s))
        return undefined;
    return s;
}
/**
 * token 的脱敏展示，仅用于日志/诊断：**只暴露长度**。
 *
 * 早前这里会带上前 4 位（`<redacted:64:TEST…>`）。虽然 4 个字符不足以还原
 * 64 字符的令牌，但它没有任何诊断价值 —— 长度就够区分「拿到了/没拿到」，
 * 而暴露前缀只会让日志变成可用于**交叉比对/确认猜测**的材料。因此去掉。
 */
export function redactToken(token) {
    if (!token)
        return '<none>';
    return `<redacted:len=${token.length}>`;
}
/**
 * token 解析优先级（自上而下，先命中者胜）：
 *   1. 环境变量 DEEPSEEK_PLATFORM_USER_TOKEN   —— 开发调试显式覆盖
 *   2. 插件配置 platformUserToken              —— 需求 2.2 方案 C
 *   3. credentials seam 中的 tlogs:userToken   —— 手动输入或桌面登录后持久化
 *   4. 账号会话凭据（方案 D）                  —— 复用 DSH 已登录账号，零配置
 *   5. 桌面端已有认证状态                      —— 需求 2.2 方案 A
 *   6. 交互式登录（方案 B）                    —— 仅在显式调用 login() 时触发
 *
 * 方案 D 排在手工凭据之后：用户显式配置/粘贴的 token 永远优先于自动复用。
 * 排在方案 A 之前：方案 D 拿的是真正面向 Platform 的凭据，而方案 A 只是按
 * 名字猜宿主服务的 getter（见 desktop-login.ts 的说明）。
 *
 * 说明：1/2 是静态配置，因此「退出登录」清不掉它们；要彻底退出请同时移除配置项
 * 与环境变量。这一点在 README 中明确写出，避免出现「点了退出登录却还在用旧 token」
 * 的误解。
 */
export class TokenManager {
    opts;
    /** 上次解析出的 token 及其来源，供 UI 展示与诊断。 */
    cached;
    /** 被显式标记为失效的 token（收到 401 后）。 */
    invalidToken;
    /** 最近一次失效说明。 */
    invalidMessage;
    /** 进程内临时 token（手动输入但不想落盘时使用）。 */
    transient;
    constructor(opts) {
        this.opts = opts;
    }
    /**
     * 解析当前应使用的 token。不会触发交互式登录（那是 `login()` 的职责）。
     *
     * 返回 undefined 表示「没有可用 token」。
     */
    async resolve() {
        if (this.transient)
            return { token: this.transient, source: 'credentials' };
        const envGetter = this.opts.env ?? ((n) => process.env[n]);
        const fromEnv = normalizeUserToken(envGetter(TOKEN_ENV_VAR));
        if (fromEnv && fromEnv !== this.invalidToken)
            return { token: fromEnv, source: 'env' };
        const fromConfig = normalizeUserToken(this.opts.readConfigToken?.());
        if (fromConfig && fromConfig !== this.invalidToken)
            return { token: fromConfig, source: 'config' };
        const stored = normalizeUserToken(await this.opts.secrets.get(TLOGS_TOKEN_KEY));
        if (stored && stored !== this.invalidToken)
            return { token: stored, source: 'credentials' };
        // 方案 D：复用 DSH 已登录账号的 Platform 会话凭据（零配置）。
        const session = await safeCallResult(this.opts.readPlatformSession);
        const sessionToken = normalizeUserToken(session?.token);
        if (sessionToken && sessionToken !== this.invalidToken) {
            return {
                token: sessionToken,
                source: session?.source ?? 'platform-session',
                scheme: session?.scheme,
                headers: session?.headers,
            };
        }
        return undefined;
    }
    /** 当前认证状态（供 UI 展示）。 */
    async state() {
        if (this.invalidToken && this.invalidMessage) {
            const resolved = await this.resolve();
            // 只有连兜底来源都拿不到有效 token 时，才整体报「失效」。
            if (!resolved)
                return { status: 'invalid', message: this.invalidMessage };
        }
        const resolved = await this.resolve();
        if (!resolved)
            return { status: 'missing' };
        return { status: 'ok', source: resolved.source };
    }
    /** 持久化一个 token（手动输入或桌面登录成功后调用）。 */
    async save(token, source = 'credentials') {
        const normalized = normalizeUserToken(token);
        if (!normalized)
            return false;
        await this.opts.secrets.set(TLOGS_TOKEN_KEY, normalized);
        this.cached = { token: normalized, source };
        // 新 token 覆盖旧的失效标记。
        this.invalidToken = undefined;
        this.invalidMessage = undefined;
        return true;
    }
    /** 记录一个进程内临时 token（不落盘）。 */
    useTransient(token) {
        const normalized = normalizeUserToken(token);
        if (!normalized)
            return false;
        this.transient = normalized;
        this.invalidToken = undefined;
        this.invalidMessage = undefined;
        return true;
    }
    /**
     * 标记当前 token 失效（收到 HTTP 401 时调用）。
     * 记录失效的 token 值本身，避免 resolve() 又把同一个坏 token 取回来。
     */
    async markInvalid(token, message) {
        this.invalidToken = token;
        this.invalidMessage = message;
        this.transient = undefined;
    }
    /** 是否处于「需要重新登录」状态。 */
    get needsLogin() {
        return this.invalidToken !== undefined;
    }
    /** 当前失效提示（若有）。 */
    get invalidReason() {
        return this.invalidMessage;
    }
    /**
     * 退出登录：清除持久化凭据、临时 token 与失效标记。
     *
     * 注意：环境变量与插件配置里的 token 不受影响（见类注释）。
     */
    async logout() {
        await this.opts.secrets.delete(TLOGS_TOKEN_KEY);
        this.transient = undefined;
        this.cached = undefined;
        this.invalidToken = undefined;
        this.invalidMessage = undefined;
    }
    /**
     * 走方案 B：交互式登录（打开内置窗口让用户登录并抓取 localStorage）。
     * 成功后自动持久化。
     */
    async login() {
        if (!this.opts.interactiveLogin) {
            return { ok: false, error: '当前环境不支持内置登录，请手动填写 userToken' };
        }
        try {
            const raw = await this.opts.interactiveLogin();
            const token = normalizeUserToken(raw);
            if (!token)
                return { ok: false, error: '登录窗口未取到有效 userToken' };
            await this.save(token, 'desktop-login');
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    }
    /** 诊断用：当前解析结果的脱敏描述。 */
    describe() {
        if (!this.cached)
            return 'token=<unresolved>';
        return `token=${redactToken(this.cached.token)} source=${this.cached.source}`;
    }
}
/** 调用可选钩子，吞掉异常并返回 undefined（认证探测失败不应让插件崩溃）。 */
async function safeCallResult(fn) {
    if (!fn)
        return undefined;
    try {
        return await fn();
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=token-manager.js.map