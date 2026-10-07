'use client';

import { useEffect, useState } from 'react';
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

// Points ranking. Pass a new refreshKey to reload it (e.g. after a vote).
export default function Ranking({ refreshKey }: { refreshKey?: unknown }) {
    const [rows, setRows] = useState<Row[] | null>(null);

    useEffect(() => {
        supabase.rpc('leaderboard', { max_rows: 10 }).then(({ data, error }) => {
            if (error) console.error('Ranking error:', error);
            setRows((data as Row[] | null) ?? []);
        });
    }, [refreshKey]);

    return (
        <Box title="🏆 Funniest Ranking">
            {rows === null ? (
                <p className="ms-muted">Loading...</p>
            ) : rows.length === 0 ? (
                <p className="ms-muted">No points yet. Post a pic or vote to get on the board!</p>
            ) : (
                <ol className="ms-rank">
                    {rows.map((row) => (
                        <li key={row.user_id} className={row.is_me ? 'me' : undefined}>
                            <span className="ms-rank-num">{row.rank === 1 ? '👑' : `#${row.rank}`}</span>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={row.avatar_url || '/default-avatar.svg'} alt="" />
                            <span className="ms-rank-name">{row.display_name}{row.is_me && ' (you)'}</span>
                            <span className="ms-rank-pts">{row.points} pts</span>
                        </li>
                    ))}
                </ol>
            )}
            <p className="ms-muted mt-2">
                +2 per pic you post · +1 per vote you cast · +1 per LOL your captions get (−1 per meh). Votes on your own pics don’t count.
            </p>
        </Box>
    );
}
