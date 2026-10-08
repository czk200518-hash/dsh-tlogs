/**
 * tlogs — 供应商（通道）元数据：**这个模型是官方平台的，还是第三方平台的**。
 *
 * ## 为什么不能按模型名判断
 *
 * 用户实测的疑问点：火山方舟（`huoshanfangzhou`）上跑的就是 `deepseek-v4-flash`，
 * 小米 / 智谱 / Kimi / 通义千问 也各有自己的模型。所以「是不是 DeepSeek 模型」和
 * 「是不是官方平台」是**两件事**：
 *
 * | 通道（provider） | 平台 | 例 |
 * |---|---|---|
 * | `deepseek-official` | **官方**：DeepSeek 开放平台（用 API Key/账单口径） | deepseek-flash |
 * | `deepseek-account` | **官方**：DSH 账号登录态（用量同样进平台账单） | deepseek-flash |
 * | `huoshanfangzhou` | **第三方**：火山方舟 | **deepseek-v4-flash** ← 名字是 DeepSeek，平台是第三方 |
 * | `xiaomi` / `zai` / `moonshot` / `qwen` … | **第三方** | mimo / glm / kimi / qwen |
 *
 * 判定一律按 **provider（通道）**，绝不按模型名 —— 否则火山方舟上的 DeepSeek 模型
 * 会被误标成「官方」，而平台账单里根本没有它。
 */

/** 平台层级。 */
export type ProviderTier = 'official' | 'third-party'

/** 层级的展示文案。 */
export const TIER_LABEL: Record<ProviderTier, string> = {
  official: '官方',
  'third-party': '第三方',
}

/**
 * 官方通道判定：provider 形如 `deepseek` / `deepseek-official` / `deepseek-account`。
 *
 * 与 `store/usage-merge.ts` 的 `isDeepseekProvider` 同一口径（那边用于合并取大，
 * 这边用于展示标注），两处必须一致。
 */
export function providerTier(provider: string): ProviderTier {
  return /^deepseek([-_.]|$)/i.test(provider.trim()) ? 'official' : 'third-party'
}

/** 已知通道的中文名；未收录的原样返回（宁可显示路由 id，也不要瞎猜）。 */
const PROVIDER_LABELS: Record<string, string> = {
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
}

/** 通道的展示名（`xiaomi` → `小米`）。 */
export function providerLabel(provider: string): string {
  const key = provider.trim().toLowerCase()
  return PROVIDER_LABELS[key] ?? provider.trim()
}

/** 层级徽标的 tooltip：说明这是哪家平台。 */
export function providerTierTitle(provider: string): string {
  const name = providerLabel(provider)
  return providerTier(provider) === 'official'
    ? `官方平台：${name}（用量进 DeepSeek 账单）`
    : `第三方平台：${name}（平台账单看不到，数据来自本机会话日志）`
}

/** 官方平台账单行（不是某个通道，而是账单本身）的徽标与说明。 */
export const OFFICIAL_BILLING_TAG = TIER_LABEL.official
export const OFFICIAL_BILLING_TITLE = '官方平台：DeepSeek 开放平台（账单口径）'
