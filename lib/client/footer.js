/**
 * tlogs — 内嵌容器（紧凑条 / 展开面板 在同一容器内切换）。
 *
 * 需求 1.1：组件通过 DSH 的 slot 扩展点注册到侧边栏页脚，
 * **紧凑条与展开面板**完全在文档流内，不使用 position: fixed / absolute 伪造悬浮。
 * 需求 1.2：展开时把上方内容顶上去（就地撑开），不覆盖。
 *
 * 「详细数据」改为打开**弹窗**（detail-modal.tsx）：侧边栏太窄，表格与日历都需要
 * 横向空间。弹窗是真正意义上的浮层，因此它使用 fixed —— 这是对需求 1.1 唯一且
 * 有意的偏离（需求原文写的是「不弹 Modal」），已在 README 记录。
 */
import * as React from 'react';
import { h } from './h.js';
import { CompactBar } from './compact-bar.js';
import { ExpandPanel } from './expand-panel.js';
import { DetailModal } from './detail-modal.js';
import { useTlogs } from './store.js';
export function TlogsFooter(props) {
    const { wide = true, rpc, defaultExpanded = false } = props;
    const store = useTlogs(rpc, 'mount');
    const [view, setView] = React.useState(defaultExpanded ? 'expanded' : 'compact');
    const [detailOpen, setDetailOpen] = React.useState(false);
    /** 用户是否手动切换过形态；一旦切换就不再套用 host 下发的默认值。 */
    const userToggled = React.useRef(false);
    const defaultApplied = React.useRef(false);
    // 客户端读不到插件自身的 cordis 配置（DSH 的浏览器半侧 apply(ctx, config)
    // 拿到的 config 是 undefined），因此展示配置由 host 通过 snapshot.display 下发。
    React.useEffect(() => {
        if (defaultApplied.current || userToggled.current)
            return;
        const d = store.snapshot?.display;
        if (!d)
            return;
        defaultApplied.current = true;
        if (d.defaultExpanded)
            setView('expanded');
    }, [store.snapshot]);
    const display = store.snapshot?.display;
    const numberFormat = display?.numberFormat ?? props.numberFormat ?? 'short';
    const enableDetailView = display?.enableDetailView ?? props.enableDetailView !== false;
    const openDetail = () => {
        setDetailOpen(true);
        void store.loadDetail();
    };
    const toggle = () => {
        userToggled.current = true;
        if (view === 'compact') {
            setView('expanded');
            // 需求 1.5：展开面板时再刷新一次（受缓存 TTL 约束，不一定真的发请求）。
            void store.refresh(false);
        }
        else {
            setView('compact');
        }
    };
    const refresh = () => {
        void store.refresh(true);
        if (detailOpen) {
            void store.loadDetail();
            // 图表数据也重取：手动刷新后项目快照会更新，累计曲线与卡片才对得上。
            void store.reloadSeries();
        }
    };
    return (h("div", { className: wide ? 'tlogs tlogs-w-full' : 'tlogs' },
        h(CompactBar, { snapshot: store.snapshot, numberFormat: numberFormat, wide: wide, expanded: view !== 'compact', busy: store.busy, onToggle: toggle, onRefresh: refresh }),
        view === 'expanded' ? (h(ExpandPanel, { snapshot: store.snapshot, error: store.error, busy: store.busy, numberFormat: numberFormat, enableDetailView: enableDetailView, onRefresh: refresh, onOpenDetail: openDetail, onLogin: () => void store.login(), onSetToken: store.setToken, onLogout: () => void store.logout() })) : null,
        detailOpen ? (h(DetailModal, { detail: store.detail, monthDetail: store.monthDetail, series: store.series, seriesLoading: store.seriesLoading, loading: store.busy, busy: store.busy, error: store.error, onClose: () => setDetailOpen(false), onRefresh: refresh, onSelectMonth: (year, month) => void store.loadMonth(year, month), onLoadSeries: (q) => void store.loadSeries(q) })) : null));
}
//# sourceMappingURL=footer.js.map