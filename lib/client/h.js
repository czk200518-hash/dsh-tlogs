/**
 * tlogs — React 绑定辅助。
 *
 * 客户端 bundle 只允许从平台种子表解析模块（实测：`react` 可用）。
 * 因此这里统一从 `react` 取 `createElement`，并让 esbuild 的 JSX 工厂
 * 指向本模块导出的 `h`（见 package.json 的 build:client 脚本）。
 * 这样全插件只产生一个 `require("react")`，不会去解析 `react/jsx-runtime`。
 */
import * as React from 'react';
/** JSX 工厂：`<div className="x" />` 编译为 `h('div', { className: 'x' })`。 */
export const h = React.createElement;
/** JSX Fragment。 */
export const Fragment = React.Fragment;
export { React };
//# sourceMappingURL=h.js.map