/**
 * tlogs — 英文词典。
 *
 * 标注成 `typeof zh` 是为了拿到两个方向的检查：少键报错、多键也报错。
 */
import { enApp } from './en-app.js';
import { enUi } from './en-ui.js';
export const en = { ...enApp, ...enUi };
//# sourceMappingURL=en.js.map