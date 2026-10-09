/**
 * tlogs — 供应商（通道）元数据：这个模型走的是官方平台还是第三方平台。
 *
 * 不能按模型名判断：火山方舟的 `huoshanfangzhou` 通道上跑的就是 `deepseek-v4-flash`，平台
 * 账单里根本没有它。官方只有 `deepseek-official`（API Key/账单口径）与 `deepseek-account`
 * （DSH 账号登录态，用量同样进平台账单）两条通道；其余（`huoshanfangzhou`、`xiaomi`、`zai`、
 * `moonshot`、`qwen` …）一律算第三方。所以判定只看 provider 名字，绝不看模型名。
 */
/** 层级的展示文案。 */
export const TIER_LABEL = {
    official: '官方',
    'third-party': '第三方',
};
/**
 * 官方通道判定：provider 形如 `deepseek` / `deepseek-official` / `deepseek-account`。
 *
 * 与 `store/usage-merge.ts` 的 `isDeepseekProvider` 必须同一口径 —— 那边用于合并取大，这边用于
 * 展示标注，两处不一致就会出现「数字来自 A、徽标写着 B」。
 */
export function providerTier(provider) {
    return /^deepseek([-_.]|$)/i.test(provider.trim()) ? 'official' : 'third-party';
}
/** 已知通道的中文名；没收录的原样返回（宁可显示路由 id，也不要瞎猜）。 */
const PROVIDER_LABELS = {
    'deepseek-official': 'DeepSeek 开放平台',
    'deepseek-account': 'DSH 账号（官方）',
    deepseek: 'DeepSeek',
    huoshanfangzhou: '火山方舟',
    volcengine: '火山引擎',
    xiaomi: '小米',
    zai: '智谱',
    zhipu: '智谱',
    moonshot: 'Kimi',
    kimi: 'Kimi',
    qwen: '通义千问',
    dashscope: '阿里云百炼',
    aliyun: '阿里云百炼',
    bailian: '阿里云百炼',
    openrouter: 'OpenRouter',
    siliconflow: '硅基流动',
};
/** 通道的展示名（`xiaomi` → `小米`）。 */
export function providerLabel(provider) {
    const key = provider.trim().toLowerCase();
    return PROVIDER_LABELS[key] ?? provider.trim();
}
/** 层级徽标的 tooltip：说明这是哪家平台。 */
export function providerTierTitle(provider) {
    const name = providerLabel(provider);
    return providerTier(provider) === 'official'
        ? `官方平台：${name}（用量进 DeepSeek 账单）`
        : `第三方平台：${name}（平台账单看不到，数据来自本机会话日志）`;
}
/** 官方平台账单行（不是某个通道，而是账单本身）的徽标与说明。 */
export const OFFICIAL_BILLING_TAG = TIER_LABEL.official;
export const OFFICIAL_BILLING_TITLE = '官方平台：DeepSeek 开放平台（账单口径）';
//# sourceMappingURL=provider-meta.js.map