/**
 * tlogs — React binding helpers. The client bundle may only resolve modules from the platform seed
 * table (react is in it), so JSX compiles to the `h` exported here (see the `build:client` script)
 * and the bundle ends up with a single `require("react")` instead of resolving `react/jsx-runtime`.
 */
import * as React from 'react';
/** JSX factory: `<div className="x" />` compiles to `h('div', { className: 'x' })`. */
export const h = React.createElement;
export const Fragment = React.Fragment;
export { React };
//# sourceMappingURL=h.js.map