/**
 * tlogs — DeepSeek 开放平台用量接口客户端。
 *
 * 本文件是工作区权威参考实现 `deepseek_python_20261007_a1f087.py` 中
 * `fetch_month`（py:61-88）与 `HEADERS`（py:34-46）的逐行翻译。
 *
 * 已实测确认的事实（本文件不得擅自偏离）：
 *  - 唯一可用端点：`GET /api/v0/usage/amount?year=YYYY&month=MM`
 *  - `/usage/by_api_key/amount` 不可用（实测 HTTP 422 `{"detail":[{"loc":"query.end"}]}`）
 *  - `start_time` / `end_time` 会 422，因此只能按自然月拉取
 *  - 必须携带 Origin / Referer / x-client-platform，否则被 WAF 拦截或返回空数据
 */
import { unwrapBizData } from './parser.js';
export const BASE_URL = 'https://platform.deepseek.com/api/v0'; // py:32
export const USAGE_PATH = '/usage/amount'; // py:63
/**
 * 金额接口。与 `USAGE_PATH` 是**孪生**关系：入参相同（year/month），返回结构同构
 * （`total[]` + `days[]`），只是 `amount` 字段的含义从 token 数变成 CNY 金额。
 *
 * 实测差异：`/usage/amount` 的 `biz_data` 是**对象**，`/usage/cost` 的是
 * **长度 1 的数组**（多一个 `currency: "CNY"`）。已由 `unwrapBizData` 抹平。
 */
export const COST_PATH = '/usage/cost';
/** 账户概览（余额 / 赠送余额 / 官方累计消费）。 */
export const ACCOUNT_SUMMARY_PATH = '/users/get_user_summary';
/** 单次请求超时，对应 Python `requests.get(..., timeout=30)`（py:67）。 */
export const DEFAULT_TIMEOUT_MS = 30_000;
/** 渲染 Python 的 `None`，让错误文案与脚本输出逐字一致。 */
function pyStr(v) {
    if (v === null || v === undefined)
        return 'None';
    if (typeof v === 'string')
        return v;
    return String(v);
}
function isDict(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/**
 * 把任何文本压成**单行**安全文本：去掉控制字符、折叠空白、截断。
 *
 * 为什么必须做：这些文本会进入日志、快照 `error` 与界面。实测发现
 * `fetch` 在请求头非法时抛出的错误消息**会把头的值原样回显**，而平台响应体
 * 也可能含换行 —— 直接透传会造成日志注入（伪造多行日志）与敏感值回显。
 */
function oneLine(s, max = 200) {
    return s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
/**
 * 从任意文本里抹掉令牌本体。
 *
 * 单行化只解决「换行污染日志」，不解决「令牌被回显」：`fetch` 在请求头非法时
 * 抛出的消息形如 `Headers.append: "Bearer <token>" is an invalid header value.`，
 * 头值是**原样**带出来的。既然我们手里就有这个令牌，最可靠的做法就是把它替换掉，
 * 而不是指望上游不回显。
 */
function scrubToken(s, token) {
    if (!token)
        return s;
    return s.split(token).join('<redacted>');
}
/** 组装一条既可读又不含令牌、且必然单行的错误文本。 */
function safeMsg(raw, token, max = 200) {
    // 顺序很重要：**先抹令牌再单行化**。反过来的话换行会先被换成空格，
    // 原始的令牌字符串就匹配不上了（这个坑被测试抓到过）。
    return oneLine(scrubToken(raw, token), max);
}
/**
 * 构造请求头。等价于 Python 的 `HEADERS`（py:34-46），另加凭据投递方式。
 *
 * @param extraHeaders 额外的部署请求头（例如 `deepseekAccount.getPlatformSession()`
 *   返回的 `requestHeaders`）。它们**覆盖**同名基础头（凭据头除外），因为那些是
 *   签发方要求的环境头，必须原样带上。
 * @param scheme 凭据投递方式，见 `CredentialScheme`。默认 `bearer`。
 *
 * 安全约束：令牌只在内存里拼进凭据头，绝不写入日志或源码。
 */
export function buildHeaders(token, extraHeaders, scheme = 'bearer') {
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-client-platform': 'web',
        Origin: 'https://platform.deepseek.com',
        Referer: 'https://platform.deepseek.com/usage',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/120.0.0.0 Safari/537.36',
    };
    // 由本插件独占的头，部署头一律不得覆盖。
    const protectedHeaders = new Set(['authorization', 'x-dsh-auth-token', 'host']);
    /**
     * 即便带 `x-` 前缀也要拒绝的头：来源伪造类（可用于绕过平台侧限流）。
     */
    const deniedExtraHeaders = new Set([
        'x-forwarded-for',
        'x-forwarded-host',
        'x-forwarded-proto',
        'x-real-ip',
        'x-client-ip',
    ]);
    if (scheme === 'x-dsh-auth-token')
        headers['x-dsh-auth-token'] = token;
    else
        headers.Authorization = `Bearer ${token}`;
    if (extraHeaders) {
        // **白名单**：只接受 `x-` 前缀的扩展头。
        //
        // 为什么要这么严：`extraHeaders` 来自 `getPlatformSession().requestHeaders`，
        // 它面向的是「嵌入式 Platform 文档」，不是用量接口；账号包的契约本身也写明
        // 「provider 拥有全部五个 Platform 客户端头，**部署配置无法覆盖**」。让部署头
        // 盖掉我们写死的 Origin / Referer，既与该契约的意图相反，也会破坏我们赖以
        // 免遭 WAF 拦截的伪装（见本文件顶部注释）。
        //
        // 实测（本机回显服务器）：若不做白名单，`Cookie` / `Origin` / `Referer` /
        // `x-forwarded-for` 都会**原样到达服务器**（`Host` 会被运行时静默丢弃）。
        // 其中 `Cookie` 会带上不属于本插件的会话、`Origin`/`Referer` 会换掉伪装。
        // 白名单一次性排除全部这些，且不需要枚举黑名单。
        const existingKey = new Map(Object.keys(headers).map((k) => [k.toLowerCase(), k]));
        for (const [k, v] of Object.entries(extraHeaders)) {
            if (k.length === 0 || typeof v !== 'string')
                continue;
            const lower = k.toLowerCase();
            if (!lower.startsWith('x-'))
                continue;
            if (protectedHeaders.has(lower) || deniedExtraHeaders.has(lower))
                continue;
            const target = existingKey.get(lower);
            if (target)
                headers[target] = v;
            else
                headers[k] = v;
        }
    }
    return headers;
}
/** 构造请求 URL，等价于 `f"{BASE_URL}/usage/amount"` + `params={"year","month"}`。 */
export function buildUrl(year, month, kind = 'amount') {
    const path = kind === 'cost' ? COST_PATH : USAGE_PATH;
    return `${BASE_URL}${path}?year=${encodeURIComponent(String(year))}&month=${encodeURIComponent(String(month))}`;
}
/** 构造结构化错误。 */
function err(kind, message, status) {
    return { ok: false, error: status === undefined ? { kind, message } : { kind, message, status } };
}
/** 合并外部取消信号与超时信号。 */
function mergeSignals(signal, timeoutMs) {
    // Python 用 requests 的 timeout；fetch 侧用 AbortSignal.timeout 等价表达，
    // 并与外部 signal 合并，保证取消与超时都能真正中断请求。
    const signals = [];
    if (signal)
        signals.push(signal);
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        signals.push(AbortSignal.timeout(timeoutMs));
    }
    if (signals.length === 0)
        return undefined;
    if (signals.length === 1)
        return signals[0];
    return AbortSignal.any(signals);
}
/**
 * 平台请求公共层：发出请求、逐层校验 `code` / `biz_code`，成功后把归一化过的
 * `biz_data` 交给调用方解析。
 *
 * 抽出来的原因：金额接口（`/usage/cost`）与账户概览（`/users/get_user_summary`）
 * 的错误语义、重定向策略、防令牌回显处理与用量接口**完全一致**，复制一份必然漂移。
 */
async function platformBizData(opts, url, label) {
    const { token } = opts;
    const doFetch = opts.fetchImpl ?? fetch;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const signal = mergeSignals(opts.signal, timeoutMs);
    let resp;
    try {
        // py:67 —— Python 捕获 requests.exceptions.RequestException
        resp = await doFetch(url, {
            headers: buildHeaders(token, opts.extraHeaders, opts.scheme),
            signal,
            // 安全（实测确认，2026-10）：**绝不跟随重定向**。
            //
            // 运行时在跨域重定向时会剥掉标准凭据头（`Authorization` / `Cookie`），
            // 但**不会剥掉自定义头**。实测：302 到另一个源后，
            //   - `Authorization: Bearer <t>` → 目标服务器收不到 ✅
            //   - `x-dsh-auth-token: <t>`     → 目标服务器原样收到 🚨
            //
            // 方案 D 用的正是后者，所以必须自己把重定向掐断。用量接口不需要重定向，
            // `manual` 会把 3xx 当成非 200 报错（见下），凭据因而永远不会离开
            // platform.deepseek.com。
            redirect: 'manual',
        });
    }
    catch (e) {
        // 外部取消要原样抛出，交给调用方区分「用户取消」与「网络失败」。
        if (opts.signal?.aborted)
            throw e;
        return err('network', `请求异常：${safeMsg(e instanceof Error ? e.message : String(e), token)}`);
    }
    if (resp.status === 401)
        return err('unauthorized', '401 认证失败（userToken 失效）', 401); // py:71-72
    if (resp.status !== 200) {
        // 3xx：我们主动不跟随。只说目标 origin，不把整条 Location 回显出去
        // （它是外部输入，没必要原样带进日志/UI）。
        if (resp.status >= 300 && resp.status < 400) {
            const location = resp.headers?.get?.('location') ?? '';
            let where = '';
            try {
                where = location ? ` → ${oneLine(new URL(location).origin, 120)}` : '';
            }
            catch {
                where = location ? ' → (无效 Location)' : '';
            }
            return err('http', `HTTP ${resp.status} 意外重定向${where}；已拒绝跟随，凭据未转发到其它源`, resp.status);
        }
        const text = await safeText(resp);
        return err('http', `HTTP ${resp.status}: ${safeMsg(text, token)}`, resp.status); // py:73-74
    }
    let data;
    try {
        data = await resp.json(); // py:77
    }
    catch {
        return err('non-json', '返回非 JSON'); // py:78-79
    }
    // Python 用 `data.get(...)`，因此 JSON 顶层必须是对象；否则脚本会抛
    // AttributeError 崩溃。这里显式降级为错误结果，属于有意的健壮性增强。
    if (!isDict(data))
        return err('non-json', '返回结构非 JSON 对象');
    if (data.code !== 0) {
        // 40003 = "Authorization Failed (invalid token)"，HTTP 状态码仍是 200。
        // 实测：把非「开放平台网页会话令牌」的凭据当 Bearer 打进来就是它
        // （API Key、DSH 账号推理令牌都会命中）。
        //
        // 归为认证失败是必要的：否则刷新循环不会提前终止，会把 31 个月全部
        // 打一遍（约 31 次请求 / 30 秒）才罢休，用户只会看到一个迟迟不动的进度条。
        if (data.code === 40003) {
            return err('unauthorized', `40003 认证失败：该令牌不被${label}接受（msg=${safeMsg(pyStr(data.msg), token)}）`);
        }
        return err('code', `code=${safeMsg(pyStr(data.code), token, 32)} msg=${safeMsg(pyStr(data.msg), token)}`); // py:81-82
    }
    const inner = data.data || {}; // py:84 `data.get("data") or {}`
    if (!isDict(inner) || inner.biz_code !== 0) {
        const bizCode = isDict(inner) ? inner.biz_code : undefined;
        const bizMsg = isDict(inner) ? inner.biz_msg : undefined;
        return err('biz_code', `biz_code=${safeMsg(pyStr(bizCode), token, 32)} biz_msg=${safeMsg(pyStr(bizMsg), token)}`); // py:85-86
    }
    // py:88 `return (inner.get("biz_data") or {}), None`
    //
    // `unwrapBizData` 抹平两者差异：`/usage/amount` 给对象、`/usage/cost` 给数组。
    return { ok: true, bizData: unwrapBizData(inner.biz_data) };
}
/**
 * 拉取某月用量（或金额）。等价于 Python `fetch_month(year, month) -> (biz_data, error_msg)`。
 *
 * 返回判别式联合而非 Python 的 `(data, err)` 二元组：`err` 为空串在 Python 里是
 * 假值，用联合类型表达同一语义可以避免「空错误串被当成失败」这类隐式 bug。
 */
export async function fetchMonth(opts) {
    return platformBizData(opts, buildUrl(opts.year, opts.month, opts.kind ?? 'amount'), opts.kind === 'cost' ? '金额接口' : '用量接口');
}
/**
 * 读取平台账户概览：充值余额 / 赠送余额 / **官方累计消费**。
 *
 * 为什么要它：`/usage/cost` 是按月归集的金额，逐月相加与官方账单存在极小差异
 * （实测 31 个月求和 ¥676.0696 vs 账单 `total_costs` ¥675.7352，差 0.05%，
 * 来自按请求四舍五入）。把官方账单数一并显示出来，用户就能一眼看出这是
 * 「插件按接口重算」还是「官方口径」。
 *
 * 失败一律降级为 `undefined`（余额不是核心功能，不该因为它失败就让整个刷新报错）；
 * 但 401 仍然要抛出语义 —— 由调用方按需处理。
 *
 * 注：面板上的展示项已按要求移除，但数据链路保留，便于以后再加回。
 */
export async function fetchAccountSummary(opts) {
    const r = await platformBizData(opts, `${BASE_URL}${ACCOUNT_SUMMARY_PATH}`, '账户接口');
    if (!r.ok)
        return r;
    const raw = r.bizData;
    const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? Math.round(n * 1e8) / 1e8 : 0;
    };
    const normal = Array.isArray(raw.normal_wallets) ? raw.normal_wallets : [];
    const bonus = Array.isArray(raw.bonus_wallets) ? raw.bonus_wallets : [];
    const costs = Array.isArray(raw.total_costs) ? raw.total_costs : [];
    return {
        ok: true,
        summary: {
            balance: num(normal[0]?.balance),
            bonusBalance: num(bonus[0]?.balance),
            totalCosts: num(costs[0]?.amount),
            currency: costs[0]?.currency ?? normal[0]?.currency ?? 'CNY',
        },
    };
}
/** 读取响应体文本，失败时返回空串（仅用于错误文案，不影响判定）。 */
async function safeText(resp) {
    try {
        return await resp.text();
    }
    catch {
        return '';
    }
}
/** 判断错误是否为认证失效（HTTP 401）。 */
export function isAuthError(e) {
    return e.kind === 'unauthorized';
}
/** 可取消的睡眠，用于月度请求节流。 */
export function sleep(ms, signal) {
    if (ms <= 0)
        return Promise.resolve();
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        if (signal) {
            if (signal.aborted) {
                clearTimeout(t);
                reject(new DOMException('Aborted', 'AbortError'));
                return;
            }
            signal.addEventListener('abort', onAbort, { once: true });
        }
    });
}
//# sourceMappingURL=usage-client.js.map