'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Box from './Box';

interface Row {
    rank: number;
    user_id: string;
    display_name: string;
    avatar_url: string | null;
    points: number;
    is_me: boolean;
}

// How a row changed since the last load: rank moved up/down, or new to the board.
type Move = { kind: 'up' | 'down'; by: number } | { kind: 'new' };

// Realtime is the main trigger; polling catches anything it misses.
const POLL_MS = 30_000;
const DEBOUNCE_MS = 800;
const MOVE_SHOWN_MS = 6_000;

// Null means the load failed; the last good ranking stays on screen.
async function fetchRanking(): Promise<Row[] | null> {
    const { data, error } = await supabase.rpc('leaderboard', { max_rows: 10 });
    if (error) {
        console.error('Ranking error:', error);
        return null;
    }
    return (data as Row[] | null) ?? [];
}

// Points ranking. Updates live as anyone posts or votes. Pass a new
// refreshKey to reload it right away (e.g. after your own vote).
export default function Ranking({ refreshKey }: { refreshKey?: unknown }) {
    const [rows, setRows] = useState<Row[] | null>(null);
    const [moves, setMoves] = useState<Record<string, Move>>({});
    const [live, setLive] = useState(false);
    const previous = useRef<Map<string, Row> | null>(null);
    const clearMoves = useRef<ReturnType<typeof setTimeout>>(undefined);

    const show = useCallback((next: Row[] | null) => {
        if (next === null) {
            setRows((r) => r ?? []);
            return;
        }

        // Compare against the last load (skipped on the first one).
        const before = previous.current;
        if (before) {
            const changed: Record<string, Move> = {};
            for (const row of next) {
                const old = before.get(row.user_id);
                if (!old) changed[row.user_id] = { kind: 'new' };
                else if (row.rank < old.rank) changed[row.user_id] = { kind: 'up', by: old.rank - row.rank };
                else if (row.rank > old.rank) changed[row.user_id] = { kind: 'down', by: row.rank - old.rank };
            }
            if (Object.keys(changed).length > 0) {
                setMoves(changed);
                clearTimeout(clearMoves.current);
                clearMoves.current = setTimeout(() => setMoves({}), MOVE_SHOWN_MS);
            }
        }
        previous.current = new Map(next.map((row) => [row.user_id, row]));
        setRows(next);
    }, []);

    const load = useCallback(() => {
        fetchRanking().then(show);
    }, [show]);

    useEffect(() => {
        fetchRanking().then(show);
    }, [show, refreshKey]);

    useEffect(() => {
        // Bursts of votes arrive together, so wait for a quiet moment before reloading.
        let debounce: ReturnType<typeof setTimeout> | undefined;
        const reloadSoon = () => {
            clearTimeout(debounce);
            debounce = setTimeout(load, DEBOUNCE_MS);
        };

        const channel = supabase
            .channel('ranking')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'generations' }, reloadSoon)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'captions' }, reloadSoon)
            .subscribe((status) => setLive(status === 'SUBSCRIBED'));

        const poll = setInterval(() => {
            if (document.visibilityState === 'visible') load();
        }, POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') load();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            clearTimeout(debounce);
            clearTimeout(clearMoves.current);
            clearInterval(poll);
            document.removeEventListener('visibilitychange', onVisible);
            supabase.removeChannel(channel);
        };
    }, [load]);

    return (
        <Box title="🏆 Funniest Ranking">
            {live && <p className="ms-live"><span aria-hidden="true">●</span> Live</p>}
            {rows === null ? (
                <p className="ms-muted">Loading...</p>
            ) : rows.length === 0 ? (
                <p className="ms-muted">No points yet. Post a pic or vote to get on the board!</p>
            ) : (
                <ol className="ms-rank" aria-live="polite">
                    {rows.map((row) => {
                        const move = moves[row.user_id];
                        return (
                            <li key={row.user_id} className={[row.is_me && 'me', move && 'moved'].filter(Boolean).join(' ') || undefined}>
                                <span className="ms-rank-num">{row.rank === 1 ? '👑' : `#${row.rank}`}</span>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={row.avatar_url || '/default-avatar.svg'} alt="" />
                                <span className="ms-rank-name">{row.display_name}{row.is_me && ' (you)'}</span>
                                {move && (
                                    <span className={`ms-rank-move ${move.kind}`}>
                                        {move.kind === 'new' ? 'NEW' : `${move.kind === 'up' ? '▲' : '▼'}${move.by}`}
                                    </span>
                                )}
                                <span className="ms-rank-pts">{row.points} pts</span>
                            </li>
                        );
                    })}
                </ol>
            )}
            <p className="ms-muted mt-2">
                +2 per pic you post · +1 per vote you cast · +1 per LOL your captions get (−1 per meh). Votes on your own pics don’t count.
            </p>
        </Box>
    );
}
