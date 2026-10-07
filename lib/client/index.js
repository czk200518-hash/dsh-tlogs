/**
 * tlogs — 浏览器半侧入口（exports "./client"）。
 *
 * 由构建脚本 scripts/build-client.mjs 用 esbuild 打成**单文件自包含**的
 * lib/client.js，外层包成 DSH 的模块约定：
 *
 *   window.__ModuleLoader__.load({ id: "dsh-tlogs", factory: (require) => { ... } })
 *
 * 约束（来自 dsh-client-modules 的说明）：
 *  - 入口 bundle 必须自包含，不能同步 require 同级的其它 client*.js 产物
 *  - factory 里同步 `require` 只能解析平台种子表（React 在其中）；
 *    其它依赖必须打进 bundle
 *  - 因此本插件只 `require("react")`，JSX 编译为 `h(...)`（见 src/client/h.ts）
 *
 * 挂载点：侧边栏页脚的 `sidebar.footer.action` 席位。
 * 该席位由 `@deepseek-ai/dsh-client-ui-sidebar` 的 SidebarRoot 用
 * `renderSlot("sidebar.footer.action", { wide })` 渲染，kind 为 `list`、
 * scope 为 `root`（已核对该包源码），因此注册项完整占用一个列表条目，
 * 组件在页脚内部按正常文档流排布 —— 满足「不使用 position: fixed/absolute」。
 *
 * 注册必须走 `ctx.slots.inject(name, cb)`：它会等待席位声明出现，
 * 并在声明被折叠时自动移除贡献、恢复时重新注册（官方推荐用法）。
 */
import { installStyles } from './styles.js';
import { TlogsFooter } from './footer.js';
import { makeRpc } from './api.js';
/** 客户端可用的服务名。只声明真正需要的两项（需求 5.3 权限最小化）。 */
export const inject = ['connection', 'slots'];
/** 席位名。 */
export const FOOTER_SLOT = 'sidebar.footer.action';
/** 注册项 id（在同一 list 席位内唯一）。 */
export const SLOT_ITEM_ID = 'tlogs';
export function apply(ctx) {
    // 样式随插件生命周期注入/移除（与官方 ui-theme 的 installThemeStyles 同约定）。
    const removeStyles = installStyles();
    if (typeof ctx.effect === 'function') {
        ctx.effect(() => () => removeStyles(), 'tlogs: stylesheet');
    }
    const slots = ctx.slots;
    if (typeof slots?.inject !== 'function' || typeof slots?.register !== 'function') {
        // 没有 slot 能力时静默退出：宿主缺少 ui-slots 时插件仍应加载成功。
        return;
    }
    const rpc = makeRpc(ctx);
    slots.inject(FOOTER_SLOT, () => slots.register({
        name: FOOTER_SLOT,
        id: SLOT_ITEM_ID,
        // 业务 share：注入给组件的非 slot props。展示配置由 host 的
        // snapshot.display 下发（客户端读不到插件自身的 cordis 配置）。
        inject: () => ({ rpc }),
    }, TlogsFooter));
}
//# sourceMappingURL=index.js.map