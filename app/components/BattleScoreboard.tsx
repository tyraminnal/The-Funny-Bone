'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Box from './Box';

interface Score {
    human_wins: number;
    ai_wins: number;
    ties: number;
    my_wins: number;
    my_losses: number;
    my_ties: number;
}

// Humans vs AI: battles won by each side, plus your own record.
// Pass a new refreshKey to reload it.
export default function BattleScoreboard({ showLink = false, refreshKey }: { showLink?: boolean; refreshKey?: unknown }) {
    const [score, setScore] = useState<Score | null>(null);

    useEffect(() => {
        supabase.rpc('battle_scoreboard').single().then(({ data, error }) => {
            if (error) console.error('Scoreboard error:', error);
            setScore((data as Score | null) ?? { human_wins: 0, ai_wins: 0, ties: 0, my_wins: 0, my_losses: 0, my_ties: 0 });
        });
    }, [refreshKey]);

    const decided = score ? score.human_wins + score.ai_wins : 0;
    const humanShare = decided ? Math.round((score!.human_wins / decided) * 100) : 50;
    const played = score ? score.my_wins + score.my_losses + score.my_ties : 0;

    return (
        <Box title="🧑 Humans vs AI 🤖">
            {score === null ? (
                <p className="ms-muted">Loading...</p>
            ) : (
                <>
                    <p className="ms-vs-score">
                        <span>Humans <b>{score.human_wins}</b></span>
                        <span><b>{score.ai_wins}</b> AI</span>
                    </p>
                    <div className="ms-vs-bar" role="img" aria-label={`Humans ${score.human_wins}, AI ${score.ai_wins}`}>
                        <span style={{ width: `${humanShare}%` }} />
                    </div>
                    <p className="ms-muted mt-1">
                        {decided === 0 ? 'No battles decided yet.' : humanShare >= 50 ? 'Humans are holding the line. For now.' : 'The robots are winning. Do something!'}
                        {score.ties > 0 && ` ${score.ties} tied.`}
                    </p>
                    {played > 0 && (
                        <p className="mt-1">
                            <b>Your record:</b> {score.my_wins}W · {score.my_losses}L{score.my_ties > 0 && ` · ${score.my_ties}T`}
                        </p>
                    )}
                </>
            )}
            {showLink && <Link href="/compete" className="ms-button mt-2">Battle the AI »</Link>}
        </Box>
    );
}
