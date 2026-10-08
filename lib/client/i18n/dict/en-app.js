/**
 * tlogs — 字典 part A（英文）：弹窗骨架、日历、供应商/模型表头说明、设置页签。
 *
 * 键必须与 `zh-app.ts` 完全一致；`dict/en.ts` 会把合并结果标注为中文词典的类型，
 * 少一个键或多一个键都会在 typecheck 阶段报错。
 *
 * 约定：语言自称沿用各自语言（中文选项写「中文」，英文写 English）；
 * 货币符号保留 ¥，中文里再加「元」，英文里用 CNY 后缀。
 */
export const enApp = {
    // ---- Detail modal tabs ----
    'tab.calendar': 'Calendar',
    'tab.charts': 'Charts',
    'tab.models': 'Models',
    'tab.providers': 'Providers',
    'tab.years': 'Years',
    'tab.months': 'Months',
    'tab.days': 'Days',
    'tab.settings': 'Settings',
    // ---- Weekday headers (Monday first) ----
    'weekday.1': 'Mon',
    'weekday.2': 'Tue',
    'weekday.3': 'Wed',
    'weekday.4': 'Thu',
    'weekday.5': 'Fri',
    'weekday.6': 'Sat',
    'weekday.7': 'Sun',
    // ---- Modal chrome ----
    'modal.title': 'Usage details',
    'modal.label': 'tlogs usage details',
    'modal.close': 'Close usage details',
    'modal.closeTitle': 'Close (Esc)',
    // ---- Shared buttons and states ----
    'common.refresh': 'Refresh',
    'common.refreshing': 'Refreshing…',
    'common.loading': 'Loading…',
    'common.noData': 'No data',
    // ---- Metric labels ----
    'stat.input': 'Input',
    'stat.output': 'Output',
    'stat.totalTokens': 'Total tokens',
    'stat.requests': 'Requests',
    'stat.cost': 'Cost',
    // ---- Calendar ----
    'cal.prevMonth': 'Previous month',
    'cal.nextMonth': 'Next month',
    'cal.selectMonth': 'Select month',
    'cal.monthTotal': '{month} total',
    'cal.option': '{key} ({tokens} tokens{cost})',
    'cal.optionCost': ' · {money}',
    'cal.cell': '{date} · {tokens} tokens · {requests} requests{cost}',
    'cal.cellCost': ' · {money} CNY',
    'cal.cellNoData': '{date} · no data',
    'cal.noDaily': 'No daily breakdown for this month yet — only the monthly total above is shown. The next auto refresh will try to backfill it.',
    'cal.pickDay': 'Click a day in the calendar to see that day’s breakdown.',
    // ---- Provider / model table headers ----
    'providers.localRange': 'Local basis (DSH session logs{source}): {range} · {days} days · {files} session logs',
    'providers.localRangeSource': ' · {source}',
    'providers.unavailable': 'Local basis unavailable ({reason})',
    'providers.unavailableLong': 'Local basis unavailable: {reason}',
    'providers.empty': 'No local-basis data',
    'providers.coverage': '; includes providers platform billing cannot see (Volcano Ark / Xiaomi / GLM / GPT…)',
    'providers.modelsNote': 'Rows prefixed with “provider ·” come from local session logs (platform billing cannot see those models, so they carry no cost)',
    // ---- Settings tab: language ----
    'settings.title': 'Language',
    'settings.desc': 'Language of this plugin’s UI. “Follow system” resolves DSH UI language → browser language → Chinese.',
    'settings.option.auto': 'Follow system',
    'settings.option.zh': '中文',
    'settings.option.en': 'English',
    'settings.active': 'Active now: {lang}',
    'settings.lang.zh': '中文',
    'settings.lang.en': 'English',
    'settings.storage': 'Stored in this browser only; it survives plugin restarts.',
};
//# sourceMappingURL=en-app.js.map