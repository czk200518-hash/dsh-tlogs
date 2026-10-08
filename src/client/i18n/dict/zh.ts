/**
 * tlogs — 中文词典（唯一事实来源）。
 *
 * `typeof zh` 就是全部文案键的联合类型：英文词典必须以它为类型标注，
 * 因此「英文少翻一条」会在 typecheck 阶段直接失败，而不是等到界面上露中文。
 */
import { zhApp } from './zh-app.js'
import { zhUi } from './zh-ui.js'

export const zh = { ...zhApp, ...zhUi }
