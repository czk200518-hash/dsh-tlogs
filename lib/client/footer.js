/**
 * tlogs — the embedded container that switches between the compact bar and the expand panel.
 *
 * Both states stay in normal document flow: expanding pushes the content above upwards instead
 * of covering it, so neither uses position: fixed/absolute. The detail view is a real modal
 * (detail-modal.tsx) and does use fixed — the single deliberate exception to the in-flow rule,
 * because the sidebar is too narrow for the tables and the calendar.
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
    const userToggled = React.useRef(false);
    const defaultApplied = React.useRef(false);
    // The client cannot read the plugin's own cordis config (the browser-side apply(ctx, config)
    // sees config as undefined), so display config arrives via snapshot.display.
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
            // Expanding asks for a refresh; the host's cache TTL may absorb it.
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
            // The chart is refetched too: a manual refresh updates the project snapshots, and the
            // cumulative curve has to match the cards.
            void store.reloadSeries();
        }
    };
    return (h("div", { className: wide ? 'tlogs tlogs-w-full' : 'tlogs' },
        h(CompactBar, { snapshot: store.snapshot, numberFormat: numberFormat, wide: wide, expanded: view !== 'compact', busy: store.busy, onToggle: toggle, onRefresh: refresh }),
        view === 'expanded' ? (h(ExpandPanel, { snapshot: store.snapshot, error: store.error, busy: store.busy, numberFormat: numberFormat, enableDetailView: enableDetailView, onRefresh: refresh, onOpenDetail: openDetail, onLogin: () => void store.login(), onSetToken: store.setToken, onLogout: () => void store.logout() })) : null,
        detailOpen ? (h(DetailModal, { detail: store.detail, monthDetail: store.monthDetail, series: store.series, seriesLoading: store.seriesLoading, loading: store.busy, busy: store.busy, error: store.error, onClose: () => setDetailOpen(false), onRefresh: refresh, onSelectMonth: (year, month) => void store.loadMonth(year, month), onLoadSeries: (q) => void store.loadSeries(q) })) : null));
}
//# sourceMappingURL=footer.js.map