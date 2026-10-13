/**
 * tlogs — 平台余额的宿主取数通道。
 *
 * 与 `auth/desktop-login.ts` 的 `getPlatformSession` 不同，`deepseekAccount.getBalance()` 由宿主自己持有
 * 并投递授权令牌，本插件既不接触凭据也不需要凭据租约；代价是它只给钱包余额，不给「官方累计消费」
 * （那项只有 `api/usage-client.ts` 的 `get_user_summary` 给得出，因而留在刷新周期里）。
 */
import { readFileSync } from 'node:fs';
/** 本机时区相对 UTC 的秒数（东为正），与 `AccountClientMetadata` 的口径一致。 */
export function timezoneOffsetSeconds(now = new Date()) {
    return -now.getTimezoneOffset() * 60;
}
/** 界面语言：宿主自己会归约成 `zh_CN` / `en_US`，所以原样给 POSIX 形式或 `<html lang>` 形式都可以。 */
function processLocale(env) {
    for (const name of ['LC_ALL', 'LC_MESSAGES', 'LANG']) {
        const v = env(name);
        if (typeof v === 'string' && v.trim().length > 0)
            return v.trim();
    }
    return 'zh_CN';
}
/**
 * 客户端版本：它进 `x-client-version` 请求头，所以取本插件真实的包版本。`package.json` 在包根，
 * 本文件在 `lib/auth/`（源码在 `src/auth/`），因此固定上溯两级；link / tarball / npm 三种装法
 * 都是这个相对位置。读不到返回 undefined —— 调用方据此放弃这次取数，而不是编一个版本号冒充某个构建。
 */
function packageVersion(entryUrl) {
    try {
        const url = new URL('../../package.json', entryUrl);
        const pkg = JSON.parse(readFileSync(url, 'utf8'));
        return typeof pkg.version === 'string' && pkg.version.trim().length > 0 ? pkg.version.trim() : undefined;
    }
    catch {
        return undefined;
    }
}
function isDict(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/**
 * 把外部文本压成单行：宿主服务的异常原文可能含换行（伪造多行日志）。这里不抹内容、只单行化 ——
 * 宿主自己投递凭据，异常里不会带令牌，所以没必要像 `api/usage-client.ts` 那样做整段替换。
 */
function oneLine(s, max = 200) {
    return s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function wallets(v) {
    return Array.isArray(v) ? v.filter(isDict) : [];
}
/**
 * 余额字符串 → 数字。平台给的是 `"20.51050378"` 这类字符串，也可能是 `0E-16` 这种合法但人眼不直觉
 * 的形式，所以走 `Number`；且必须保留精度（金额截断会把整月读成 0，见 api/parser.ts）。
 */
function toAmount(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}
/**
 * 读一次平台钱包余额。未接入账号服务、拿不到包版本、宿主报错或返回结构不认识都返回 undefined：
 * 余额是附加信息，任何失败都只应表现为「这一格暂时不更新」，不该让别的东西失败。
 */
export async function readPlatformBalance(opts) {
    const fn = opts.service?.getBalance;
    if (typeof fn !== 'function')
        return undefined;
    const version = packageVersion(opts.entryUrl ?? import.meta.url);
    if (!version) {
        opts.logger?.warn?.('tlogs: 读不到插件包版本，跳过账号余额查询');
        return undefined;
    }
    const client = {
        version,
        locale: processLocale(opts.env ?? ((n) => process.env[n])),
        timezoneOffsetSeconds: timezoneOffsetSeconds(opts.now?.() ?? new Date()),
    };
    let balance;
    try {
        balance = await fn.call(opts.service, client);
    }
    catch (e) {
        opts.logger?.warn?.(`tlogs: 账号余额查询失败 —— ${oneLine(e instanceof Error ? e.message : String(e))}`);
        return undefined;
    }
    if (!isDict(balance))
        return undefined;
    // 宿主已把 Platform 的 normal_wallets / bonus_wallets 改名成 value / bonusWallets（成功态才有钱包）。
    // 按 Platform 的原始字段名读不会报错，只会安静地读出 0 —— 界面上就是「明明有余额却恒显示 ¥0」，
    // 所以这里只认投影后的名字，认不出就当作「这次没有结果」，绝不编一个 0 出去覆盖已有余额。
    const unmatched = () => {
        opts.logger?.warn?.(`tlogs: 账号余额结构不认识（字段 ${oneLine(Object.keys(balance).join('/'), 80)}），本次不更新`);
        return undefined;
    };
    if (balance.status === 'failed')
        return undefined;
    if (balance.status !== 'ready')
        return unmatched();
    const raw = balance.value;
    if (!Array.isArray(raw))
        return unmatched();
    const normal = wallets(raw);
    const bonus = wallets(balance.bonusWallets);
    const currency = normal.find((w) => typeof w.currency === 'string')?.currency;
    return {
        balance: toAmount(normal[0]?.balance),
        bonusBalance: toAmount(bonus[0]?.balance),
        currency: typeof currency === 'string' ? currency : 'CNY',
    };
}
//# sourceMappingURL=account-balance.js.map