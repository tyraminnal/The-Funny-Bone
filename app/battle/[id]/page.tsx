'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BATTLE_COLUMNS, battleResult, loadReveals } from '@/lib/battles';
import { supabase } from '@/lib/supabase';
import { themeBySlug } from '@/lib/themes';
import type { Battle, BattleReveal, BattleSide } from '@/lib/types';
import { useRequireUser } from '@/lib/useRequireUser';
import Box from '../../components/Box';
import MemeImage from '../../components/MemeImage';
import ShareButtons from '../../components/ShareButtons';
import Shell from '../../components/Shell';

const SIDES: BattleSide[] = ['a', 'b'];

export default function BattlePage() {
    const { id } = useParams<{ id: string }>();
    const user = useRequireUser();
    const [battle, setBattle] = useState<Battle | null>(null);
    const [reveal, setReveal] = useState<BattleReveal | null>(null);
    const [loading, setLoading] = useState(true);
    const [voting, setVoting] = useState(false);
    const [error, setError] = useState('');

    const fetchBattle = useCallback(async () => {
        const { data } = await supabase.from('battles').select(BATTLE_COLUMNS).eq('id', id).maybeSingle();
        const loaded = data as Battle | null;
        const reveals = loaded ? await loadReveals([loaded.id]) : {};
        return { loaded, reveal: loaded ? reveals[loaded.id] ?? null : null };
    }, [id]);

    useEffect(() => {
        if (!user) return;
        fetchBattle().then(({ loaded, reveal: r }) => {
            setBattle(loaded);
            setReveal(r);
            setLoading(false);
        });

        // Live vote counts while the page is open.
        const channel = supabase
            .channel(`battle-${id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${id}` }, (payload) => {
                setBattle((b) => (b ? { ...b, ...(payload.new as Partial<Battle>) } : b));
            })
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, id, fetchBattle]);

    const vote = async (side: BattleSide) => {
        if (!user || !battle) return;
        setVoting(true);
        setError('');
        const { error: voteError } = await supabase.from('battle_votes').insert({ battle_id: battle.id, user_id: user.id, side });
        // 23505: already voted (e.g. in another tab), so just show the result.
        if (voteError && voteError.code !== '23505') {
            console.error('Battle vote error:', voteError);
            setError('Your vote didn’t save. Try again.');
            setVoting(false);
            return;
        }
        const { loaded, reveal: r } = await fetchBattle();
        setBattle(loaded);
        setReveal(r);
        setVoting(false);
    };

    if (!user) return <p className="p-8">Redirecting...</p>;

    const mine = battle?.user_id === user.id;
    const theme = battle ? themeBySlug(battle.theme) : undefined;
    const result = battle && reveal ? battleResult(battle, reveal) : null;
    const totalVotes = battle ? battle.votes_a + battle.votes_b : 0;
    const shareText = mine
        ? 'I’m in a caption battle against an AI. Can you tell which caption is mine? 🧑 vs 🤖'
        : 'Human vs AI: can you tell which caption the AI wrote? 🧑 vs 🤖';

    return (
        <Shell>
            <p className="mb-2"><Link href="/compete">« All battles</Link></p>
            {loading ? (
                <p>Loading...</p>
            ) : !battle ? (
                <p>This battle doesn’t exist (or got deleted).</p>
            ) : (
                <Box title={
                    <span className="flex justify-between gap-2">
                        <span>🧑 vs 🤖 Which caption is funnier?</span>
                        {theme && <span className="font-normal">{theme.title}</span>}
                    </span>
                }>
                    <p className="mb-2">
                        {reveal
                            ? verdict(result!, reveal, mine)
                            : 'One of these was written by a student, the other by an AI. Vote for the funnier one, then find out who wrote it.'}
                    </p>

                    <div className="ms-battle">
                        {SIDES.map((side) => {
                            const text = side === 'a' ? battle.caption_a : battle.caption_b;
                            const votes = side === 'a' ? battle.votes_a : battle.votes_b;
                            const isAi = reveal?.ai_side === side;
                            const won = result?.winner && result.winner !== 'tie' && (result.winner === 'ai') === isAi;
                            return (
                                <div key={side} className="ms-battle-side" data-won={won || undefined}>
                                    <p className="ms-battle-label">
                                        {reveal ? (isAi ? '🤖 AI' : `🧑 ${mine ? 'You' : reveal.human_name}`) : `Caption ${side.toUpperCase()}`}
                                        {won && ' 👑'}
                                        {reveal?.my_side === side && <span className="ms-battle-pick">your pick</span>}
                                    </p>
                                    <MemeImage src={battle.image_url} alt={`Caption ${side.toUpperCase()}`} bottomText={text} />
                                    {reveal ? (
                                        <>
                                            <div className="ms-vs-bar mt-1.5" role="img" aria-label={`${votes} of ${totalVotes} votes`}>
                                                <span style={{ width: `${totalVotes ? Math.round((votes / totalVotes) * 100) : 0}%` }} />
                                            </div>
                                            <p className="ms-muted mt-1">{votes} vote{votes === 1 ? '' : 's'}</p>
                                        </>
                                    ) : (
                                        <p className="mt-1.5 text-center">
                                            <button className="ms-button ms-button-big" onClick={() => vote(side)} disabled={voting}>
                                                {voting ? 'Saving...' : `${side.toUpperCase()} is funnier`}
                                            </button>
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {error && <p className="ms-error">{error}</p>}
                    {!reveal && <p className="ms-muted mt-2 text-center">Votes are final. No take-backs.</p>}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <Link href="/compete">Start your own battle »</Link>
                        <ShareButtons path={`/battle/${battle.id}`} text={shareText} />
                    </div>
                </Box>
            )}
        </Shell>
    );
}

function verdict(result: ReturnType<typeof battleResult>, reveal: BattleReveal, mine: boolean): string {
    const human = mine ? 'you' : reveal.human_name;
    const picked = reveal.my_side === null ? '' : reveal.my_side === reveal.ai_side ? 'You picked the AI’s caption 🤖. ' : `You picked ${human === 'you' ? 'your own' : `${human}’s`} caption 🧑. `;
    if (result.winner === null) return mine ? 'No votes yet. Share it so people can judge!' : picked;
    if (result.winner === 'tie') return `${picked}It’s a tie so far!`;
    if (result.winner === 'human') return `${picked}${mine ? 'You’re' : `${reveal.human_name} is`} beating the AI ${result.humanVotes}–${result.aiVotes}!`;
    return `${picked}The AI is beating ${human} ${result.aiVotes}–${result.humanVotes}.`;
}
