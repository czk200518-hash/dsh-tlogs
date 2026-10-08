/**
 * tlogs — 字典 part A：弹窗骨架、日历、供应商/模型表头说明、设置页签。
 *
 * 词典按 part 分文件只是为了并行改动的文件不打架；`dict/zh.ts` 负责合并。
 * 合并时键名**不允许重复**（test/i18n.test.ts 会核对 part 之和等于合并结果）。
 */
export const zhApp = {
    // ---- 详细数据弹窗的页签 ----
    'tab.calendar': '日历',
    'tab.charts': '图表',
    'tab.models': '模型',
    'tab.providers': '供应商',
    'tab.years': '年',
    'tab.months': '月',
    'tab.days': '当月按天',
    'tab.settings': '设置',
    // ---- 星期标题（周一起始，与「本周 = 周一至今」口径一致） ----
    'weekday.1': '一',
    'weekday.2': '二',
    'weekday.3': '三',
    'weekday.4': '四',
    'weekday.5': '五',
    'weekday.6': '六',
    'weekday.7': '日',
    // ---- 弹窗外壳 ----
    'modal.title': '用量详细数据',
    'modal.label': 'tlogs 用量详细数据',
    'modal.close': '关闭详细数据',
    'modal.closeTitle': '关闭（Esc）',
    // ---- 通用按钮与状态 ----
    'common.refresh': '刷新',
    'common.refreshing': '刷新中…',
    'common.loading': '加载中…',
    'common.noData': '暂无数据',
    // ---- 统计口径标签（日历汇总行、选中日明细、表格列头共用） ----
    'stat.input': '输入',
    'stat.output': '输出',
    'stat.totalTokens': '总 Token',
    'stat.requests': '请求',
    'stat.cost': '金额',
    // ---- 日历 ----
    'cal.prevMonth': '上一个月',
    'cal.nextMonth': '下一个月',
    'cal.selectMonth': '选择月份',
    'cal.monthTotal': '{month} 合计',
    'cal.option': '{key}（{tokens} tokens{cost}）',
    'cal.optionCost': ' · {money}',
    'cal.cell': '{date} · {tokens} tokens · {requests} 次请求{cost}',
    'cal.cellCost': ' · {money} 元',
    'cal.cellNoData': '{date} · 无数据',
    'cal.noDaily': '该月暂无逐日明细，仅显示上方月度合计。下一次自动刷新会尝试回补。',
    'cal.pickDay': '点击日历中的某一天查看当天明细。',
    // ---- 供应商 / 模型表的表头说明 ----
    'providers.localRange': '本机口径（DSH 会话日志{source}）：{range} · {days} 天 · {files} 个会话日志',
    'providers.localRangeSource': ' · {source}',
    'providers.unavailable': '本机口径不可用（{reason}）',
    'providers.unavailableLong': '本机口径不可用：{reason}',
    'providers.empty': '本机口径暂无数据',
    'providers.coverage': '；含平台账单看不到的供应商（火山方舟 / 小米 / GLM / GPT…）',
    'providers.modelsNote': '带「供应商 ·」前缀的行来自本机会话日志（平台账单看不到这些模型，因此没有金额）',
    // ---- 设置页签：语言 ----
    'settings.title': '语言',
    'settings.desc': '插件界面文案语言。跟随系统时按 DSH 界面语言 → 浏览器语言 → 中文 依次判断。',
    'settings.option.auto': '跟随系统',
    'settings.option.zh': '中文',
    'settings.option.en': 'English',
    'settings.active': '当前生效：{lang}',
    'settings.lang.zh': '中文',
    'settings.lang.en': 'English',
    'settings.storage': '选择保存在本机浏览器，插件重启后仍然有效。',
};
//# sourceMappingURL=zh-app.js.map