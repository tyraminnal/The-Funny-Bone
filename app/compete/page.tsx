'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BATTLE_COLUMNS, battleResult, loadReveals } from '@/lib/battles';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/time';
import type { Battle, BattleReveal } from '@/lib/types';
import { useProfileCheck } from '@/lib/useProfileCheck';
import { useRequireUser } from '@/lib/useRequireUser';
import BattleScoreboard from '../components/BattleScoreboard';
import Box from '../components/Box';
import PicPicker from '../components/PicPicker';
import Shell from '../components/Shell';

const MAX_CAPTION_LENGTH = 90;
const LOADING_LINES = [
    'Sending your pic to the AI...',
    'The AI is stretching...',
    'The AI is writing its caption...',
    'Shuffling the captions so nobody can tell...',
];

export default function CompetePage() {
    useProfileCheck();
    const user = useRequireUser();
    const router = useRouter();

    const [image, setImage] = useState<Blob | null>(null);
    const [caption, setCaption] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [loadingLine, setLoadingLine] = useState(0);
    const [error, setError] = useState('');

    const [battles, setBattles] = useState<Battle[] | null>(null);
    const [reveals, setReveals] = useState<Record<string, BattleReveal>>({});

    useEffect(() => {
        if (!submitting) return;
        const timer = setInterval(() => setLoadingLine((i) => (i + 1) % LOADING_LINES.length), 2000);
        return () => clearInterval(timer);
    }, [submitting]);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            const { data, error: loadError } = await supabase
                .from('battles')
                .select(BATTLE_COLUMNS)
                .order('created_at', { ascending: false })
                .limit(40);
            if (loadError) console.error('Battles error:', loadError);
            const loaded = (data ?? []) as Battle[];
            setReveals(await loadReveals(loaded.map((b) => b.id)));
            setBattles(loaded);
        };
        load();
    }, [user]);

    const handleSubmit = async () => {
        if (!image || !caption.trim()) return;
        setSubmitting(true);
        setLoadingLine(0);
        setError('');

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
            router.push('/auth');
            return;
        }

        const form = new FormData();
        form.append('image', image, 'photo.jpg');
        form.append('caption', caption);

        try {
            const response = await fetch('/api/battle', {
                method: 'POST',
                headers: { Authorization: `Bearer ${data.session.access_token}` },
                body: form,
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(result.error || 'Something went wrong. Try again.');
                setSubmitting(false);
                return;
            }
            router.push(`/battle/${result.id}`);
        } catch {
            setError('Network error. Try again.');
            setSubmitting(false);
        }
    };

    if (!user) return <p className="p-8">Redirecting...</p>;

    // Battles you haven't judged yet come first; yours and ones you've judged show results.
    const toJudge = (battles ?? []).filter((b) => b.user_id !== user.id && !reveals[b.id]);
    const mine = (battles ?? []).filter((b) => b.user_id === user.id);
    const judged = (battles ?? []).filter((b) => b.user_id !== user.id && reveals[b.id]);

    return (
        <Shell>
            <div className="ms-cols-right">
                <div className="ms-col">
                    <Box title="🧑 vs 🤖 Start a Battle">
                        <p className="mb-2">
                            Think you’re funnier than an AI? Pick a pic and write your best caption. The AI writes one too (without seeing yours).
                            Everyone else votes on the funnier one without knowing which is which.
                        </p>

                        <PicPicker disabled={submitting} onImage={setImage} onError={setError} />

                        <label className="mt-3 block font-bold">
                            Your caption:
                            <input
                                type="text"
                                value={caption}
                                maxLength={MAX_CAPTION_LENGTH}
                                onChange={(e) => setCaption(e.target.value)}
                                disabled={submitting}
                                placeholder="Make it funnier than a robot could"
                                className="ms-input mt-1 font-normal"
                            />
                        </label>
                        <p className="ms-muted mt-1 text-right">{caption.length}/{MAX_CAPTION_LENGTH}</p>

                        {error && <p className="ms-error">{error}</p>}

                        <p className="mt-2 text-center">
                            <button onClick={handleSubmit} disabled={!image || !caption.trim() || submitting} className="ms-button ms-button-big">
                                {submitting ? LOADING_LINES[loadingLine] : 'Battle the AI »'}
                            </button>
                        </p>
                        <p className="ms-muted mt-3 text-center">
                            Everyone signed in can see your pic. Don’t post people who didn’t say it was OK.
                        </p>
                    </Box>

                    <Box title="⚖️ Your Turn to Judge">
                        {battles === null ? (
                            <p className="ms-muted">Loading...</p>
                        ) : toJudge.length === 0 ? (
                            <p className="ms-muted">You’ve judged every battle. Start one of your own!</p>
                        ) : (
                            <ul className="ms-battle-list">
                                {toJudge.map((battle) => (
                                    <BattleRow key={battle.id} battle={battle} status={`${battle.votes_a + battle.votes_b} votes so far`} action="Judge »" />
                                ))}
                            </ul>
                        )}
                    </Box>
                </div>

                <div className="ms-col">
                    <BattleScoreboard refreshKey={battles} />

                    <Box title="Your Battles">
                        {battles === null ? (
                            <p className="ms-muted">Loading...</p>
                        ) : mine.length === 0 ? (
                            <p className="ms-muted">None yet. The AI is waiting.</p>
                        ) : (
                            <ul className="ms-battle-list">
                                {mine.map((battle) => (
                                    <BattleRow key={battle.id} battle={battle} status={resultLine(battle, reveals[battle.id], true)} />
                                ))}
                            </ul>
                        )}
                    </Box>

                    {judged.length > 0 && (
                        <Box title="Battles You Judged">
                            <ul className="ms-battle-list">
                                {judged.map((battle) => (
                                    <BattleRow key={battle.id} battle={battle} status={resultLine(battle, reveals[battle.id], false)} />
                                ))}
                            </ul>
                        </Box>
                    )}
                </div>
            </div>
        </Shell>
    );
}

function resultLine(battle: Battle, reveal: BattleReveal | undefined, mine: boolean): string {
    if (!reveal) return '';
    const { humanVotes, aiVotes, winner } = battleResult(battle, reveal);
    const who = mine ? 'You' : reveal.human_name;
    if (winner === null) return 'No votes yet';
    if (winner === 'tie') return `Tied ${humanVotes}–${aiVotes}`;
    return winner === 'human' ? `🏆 ${who} beat the AI ${humanVotes}–${aiVotes}` : `🤖 AI beat ${mine ? 'you' : who} ${aiVotes}–${humanVotes}`;
}

function BattleRow({ battle, status, action }: { battle: Battle; status: string; action?: string }) {
    return (
        <li>
            <Link href={`/battle/${battle.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={battle.image_url} alt="" />
                <span className="ms-battle-text">
                    <span className="ms-battle-status">{status}</span>
                    <span className="ms-muted">{timeAgo(battle.created_at)}</span>
                </span>
                {action && <span className="ms-button">{action}</span>}
            </Link>
        </li>
    );
}
