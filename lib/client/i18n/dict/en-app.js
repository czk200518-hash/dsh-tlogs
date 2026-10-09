/**
 * tlogs — 字典 part A（英文）：弹窗骨架、日历、供应商/模型表头说明、设置页签。
 *
 * 键必须与 `zh-app.ts` 完全一致，少一个或多一个都会在 typecheck 阶段报错
 *（`dict/en.ts` 把合并结果标注为中文词典的类型）。
 *
 * 约定：语言自称沿用各自语言（中文选项写「中文」，英文写 English）；
 * 货币符号保留 ¥，中文里再加「元」，英文里用 CNY 后缀。
 */
export const enApp = {
    'tab.calendar': 'Calendar',
    'tab.charts': 'Charts',
    'tab.models': 'Models',
    'tab.providers': 'Providers',
    'tab.years': 'Years',
    'tab.months': 'Months',
    'tab.days': 'Days',
    'tab.settings': 'Settings',
    'weekday.1': 'Mon',
    'weekday.2': 'Tue',
    'weekday.3': 'Wed',
    'weekday.4': 'Thu',
    'weekday.5': 'Fri',
    'weekday.6': 'Sat',
    'weekday.7': 'Sun',
    'modal.title': 'Usage details',
    'modal.label': 'tlogs usage details',
    'modal.close': 'Close usage details',
    'modal.closeTitle': 'Close (Esc)',
    'common.refresh': 'Refresh',
    'common.refreshing': 'Refreshing…',
    'common.loading': 'Loading…',
    'common.noData': 'No data',
    'stat.input': 'Input',
    'stat.output': 'Output',
    'stat.totalTokens': 'Total tokens',
    'stat.requests': 'Requests',
    'stat.cost': 'Cost',
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
    'providers.localRange': 'Local basis (DSH session logs{source}): {range} · {days} days · {files} session logs',
    'providers.localRangeSource': ' · {source}',
    'providers.unavailable': 'Local basis unavailable ({reason})',
    'providers.unavailableLong': 'Local basis unavailable: {reason}',
    'providers.empty': 'No local-basis data',
    'providers.coverage': '; includes providers platform billing cannot see (Volcano Ark / Xiaomi / GLM / GPT…)',
    'providers.modelsNote': 'Rows prefixed with “provider ·” come from local session logs (platform billing cannot see those models, so they carry no cost)',
    'settings.title': 'Language',
    'settings.option.auto': 'Follow system',
    'settings.option.zh': '中文',
    'settings.option.en': 'English',
};
//# sourceMappingURL=en-app.js.map