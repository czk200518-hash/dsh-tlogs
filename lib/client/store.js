/**
 * tlogs — client state (snapshot polling + lazy detail loading). The first full fetch walks about
 * 31 months, so the host refreshes in the background and returns immediately; the client polls
 * `snapshot` to watch `loading` / `progress` instead of holding one long RPC open.
 */
import * as React from 'react';
import { callRpc } from './api.js';
// Errors are assembled in event handlers and async chains, never during render, so the module-level
// `t` is fine here: a failure is a fact that already happened, tied to the language it was made in.
import { t } from './i18n/index.js';
import { RPC, } from '../types.js';
const POLL_MS = 800;
/** Poll ceiling, so a stuck host cannot be polled forever (about four minutes). */
const MAX_POLLS = 300;
/**
 * How often the snapshot is re-read while idle (ms). Denser than the host's own auto-refresh (5
 * minutes by default), so a background refresh shows up within a minute; it is a local RPC and
 * costs nothing externally.
 */
const IDLE_RELOAD_MS = 60_000;
function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function messageOf(e) {
    return e instanceof Error ? e.message : String(e);
}
/**
 * Build the tlogs client state. `initialReason` is part of the caller's contract but does not
 * change behaviour: mounting always triggers exactly one refresh.
 */
export function useTlogs(rpc, initialReason = 'mount') {
    const [snapshot, setSnapshot] = React.useState(null);
    const [detail, setDetail] = React.useState(null);
    const [monthDetail, setMonthDetail] = React.useState(null);
    const [series, setSeries] = React.useState(null);
    const [seriesLoading, setSeriesLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const alive = React.useRef(true);
    const inflight = React.useRef(false);
    const started = React.useRef(false);
    /** Sequence of chart requests; only the newest result is accepted, so fast range switches cannot mix data. */
    const seriesSeq = React.useRef(0);
    const lastSeriesQuery = React.useRef(null);
    React.useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const reload = React.useCallback(async () => {
        try {
            const s = await callRpc(rpc, RPC.snapshot);
            if (alive.current) {
                setSnapshot(s);
                setError(null);
            }
            return s;
        }
        catch (e) {
            if (alive.current)
                setError(messageOf(e));
            return null;
        }
    }, [rpc]);
    const refresh = React.useCallback(async (force) => {
        if (inflight.current)
            return;
        inflight.current = true;
        if (alive.current)
            setBusy(true);
        try {
            await callRpc(rpc, RPC.refresh, { force });
            // Poll until the host reports that loading finished.
            for (let i = 0; i < MAX_POLLS; i++) {
                const s = await reload();
                if (!alive.current)
                    return;
                if (!s?.loading)
                    return;
                await delay(POLL_MS);
            }
        }
        catch (e) {
            if (alive.current)
                setError(messageOf(e));
        }
        finally {
            inflight.current = false;
            if (alive.current)
                setBusy(false);
        }
    }, [rpc, reload]);
    React.useEffect(() => {
        if (started.current)
            return;
        started.current = true;
        void refresh(false);
    }, [refresh]);
    const loadDetail = React.useCallback(async () => {
        try {
            const d = await callRpc(rpc, RPC.detail);
            if (alive.current)
                setDetail(d);
        }
        catch (e) {
            if (alive.current)
                setError(messageOf(e));
        }
    }, [rpc]);
    const loadMonth = React.useCallback(async (year, month) => {
        try {
            const d = await callRpc(rpc, RPC.month, { year, month });
            if (alive.current)
                setMonthDetail(d);
        }
        catch (e) {
            if (alive.current)
                setError(messageOf(e));
        }
    }, [rpc]);
    const loadSeries = React.useCallback(async (query) => {
        lastSeriesQuery.current = query;
        const seq = ++seriesSeq.current;
        if (alive.current)
            setSeriesLoading(true);
        try {
            const s = await callRpc(rpc, RPC.series, query);
            // Sequence check: when ranges are clicked in quick succession an earlier
            // request can land last, and its result has to be dropped.
            if (alive.current && seq === seriesSeq.current) {
                setSeries(s);
                setError(null);
            }
        }
        catch (e) {
            if (alive.current && seq === seriesSeq.current)
                setError(messageOf(e));
        }
        finally {
            if (alive.current && seq === seriesSeq.current)
                setSeriesLoading(false);
        }
    }, [rpc]);
    const reloadSeries = React.useCallback(async () => {
        const q = lastSeriesQuery.current;
        if (!q)
            return;
        await loadSeries(q);
    }, [loadSeries]);
    /**
     * Re-read the snapshot periodically while idle: the host auto-refreshes every `autoRefreshSeconds`
     * (5 minutes by default), but that only updates its in-memory data, so without a read the client
     * keeps showing the old numbers. A local RPC that makes no external request (TTL and credential
     * probing are cached separately).
     *
     * Defined after `reloadSeries` because the effect uses it; earlier would hit the temporal dead zone.
     */
    React.useEffect(() => {
        const timer = setInterval(() => {
            void reload();
            // Refresh the chart too: the modal can stay open for a long time and the
            // curves should not sit on stale numbers. No-op until a chart was opened.
            void reloadSeries();
        }, IDLE_RELOAD_MS);
        return () => clearInterval(timer);
    }, [reload, reloadSeries]);
    const setToken = React.useCallback(async (token) => {
        try {
            const r = await callRpc(rpc, RPC.setToken, { token });
            if (r.ok)
                await refresh(true);
            else if (alive.current)
                setError(r.error ?? t('error.saveFailed'));
            return r.ok;
        }
        catch (e) {
            if (alive.current)
                setError(messageOf(e));
            return false;
        }
    }, [rpc, refresh]);
    const logout = React.useCallback(async () => {
        try {
            await callRpc(rpc, RPC.logout);
            if (alive.current) {
                setDetail(null);
                setSeries(null);
                lastSeriesQuery.current = null;
                await reload();
            }
        }
        catch (e) {
            if (alive.current)
                setError(messageOf(e));
        }
    }, [rpc, reload]);
    const login = React.useCallback(async () => {
        try {
            const r = await callRpc(rpc, RPC.login);
            if (r.ok)
                await refresh(true);
            else if (alive.current)
                setError(r.error ?? t('error.loginFailed'));
            return r.ok;
        }
        catch (e) {
            if (alive.current)
                setError(messageOf(e));
            return false;
        }
    }, [rpc, refresh]);
    void initialReason;
    return {
        snapshot,
        detail,
        monthDetail,
        series,
        seriesLoading,
        error,
        busy,
        reload,
        refresh,
        loadDetail,
        loadMonth,
        loadSeries,
        reloadSeries,
        setToken,
        logout,
        login,
    };
}
//# sourceMappingURL=store.js.map