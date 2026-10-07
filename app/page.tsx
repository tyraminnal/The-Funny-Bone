'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useProfileCheck } from '@/lib/useProfileCheck';
import { useRequireUser } from '@/lib/useRequireUser';
import { useVotes } from '@/lib/useVotes';
import { CAPTION_STYLES, todaysTheme } from '@/lib/themes';
import type { Caption, Generation } from '@/lib/types';
import Box from './components/Box';
import PostCard from './components/PostCard';
import Shell from './components/Shell';

type Sort = 'hot' | 'new' | 'top' | 'theme';

const SORTS: { key: Sort; label: string }[] = [
    { key: 'hot', label: 'Hot' },
    { key: 'new', label: 'New' },
    { key: 'top', label: 'Top' },
    { key: 'theme', label: 'Today’s Theme' },
];

const MOODS = ['amused 😂', 'giggly 🤭', 'chaotic 🙃', 'procrastinating 📚', 'homesick 🌽', 'caffeinated ☕'];

interface TopCaption extends Caption {
    generations: { image_url: string } | null;
}

interface Me {
    first_name: string | null;
    avatar_url: string | null;
}

function bestCaption(post: Generation): Caption | undefined {
    return post.captions.reduce<Caption | undefined>((best, c) => (!best || c.score > best.score ? c : best), undefined);
}

function bestScore(post: Generation) {
    return Math.max(0, bestCaption(post)?.score ?? 0);
}

// Score decays with age so new posts get a chance to reach the top.
function hotness(post: Generation) {
    const hours = (Date.now() - new Date(post.created_at).getTime()) / 3_600_000;
    return (bestScore(post) + 1) / Math.pow(hours + 2, 1.5);
}

export default function Home() {
    useProfileCheck();
    const user = useRequireUser();
    const theme = todaysTheme();

    const [posts, setPosts] = useState<Generation[]>([]);
    const [topCaption, setTopCaption] = useState<TopCaption | null>(null);
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sort, setSort] = useState<Sort>('hot');
    const { myVotes, loadVotes, vote, voteError } = useVotes(user?.id ?? null, setPosts);

    useEffect(() => {
        if (!user) return;

        const load = async () => {
            const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
            const [feed, top, profile] = await Promise.all([
                supabase
                    .from('generations')
                    .select('id, user_id, image_url, theme, user_context, created_at, captions(*)')
                    .order('created_at', { ascending: false })
                    .limit(100),
                supabase
                    .from('captions')
                    .select('*, generations(image_url)')
                    .gte('created_at', since)
                    .gt('score', 0)
                    .order('score', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                supabase.from('profiles').select('first_name, avatar_url').eq('id', user.id).maybeSingle(),
            ]);

            if (feed.error) {
                console.error('Feed error:', feed.error);
                setError('Couldn’t load the feed.');
            }
            const loaded = (feed.data ?? []) as Generation[];
            setPosts(loaded);
            setTopCaption((top.data as TopCaption | null) ?? null);
            setMe(profile.data);
            await loadVotes(loaded.flatMap((p) => p.captions.map((c) => c.id)));
            setLoading(false);
        };

        load();
    }, [user, loadVotes]);

    const visible = useMemo(() => {
        const list = sort === 'theme' ? posts.filter((p) => p.theme === theme.slug) : [...posts];
        if (sort === 'hot') list.sort((a, b) => hotness(b) - hotness(a));
        if (sort === 'top') list.sort((a, b) => bestScore(b) - bestScore(a));
        return list;
    }, [posts, sort, theme.slug]);

    const topEight = useMemo(
        () => [...posts].sort((a, b) => bestScore(b) - bestScore(a) || hotness(b) - hotness(a)).slice(0, 8),
        [posts]
    );

    const myPostCount = user ? posts.filter((p) => p.user_id === user.id).length : 0;
    const votesCast = Object.keys(myVotes).length;
    const mood = MOODS[new Date().getDate() % MOODS.length];

    if (!user) return <p className="p-8">Redirecting...</p>;

    return (
        <Shell>
            <div className="ms-cols">
                <div className="ms-col">
                    <section>
                        <h1 className="ms-big-title">{me?.first_name || 'Hey you'}</h1>
                        <div className="flex gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={me?.avatar_url || '/file.svg'} alt="Your avatar" className="ms-avatar" />
                            <div className="text-[11px]">
                                <p>“funny bone<br />fully tickled”</p>
                                <p className="mt-2">Columbia University<br />New York, NY</p>
                                <p className="ms-online mt-2">Online Now!</p>
                            </div>
                        </div>
                        <p className="mt-2 text-[11px]"><b>Mood:</b> {mood}</p>
                        <p className="mt-1 text-[11px]">View my: <Link href="/profile">Profile</Link> | <Link href="/create">Make a Meme</Link></p>
                    </section>

                    <Box title="Today’s Theme">
                        <p className="ms-title">{theme.title}</p>
                        <p>{theme.blurb}</p>
                        <Link href="/create" className="ms-button mt-2">Upload a Pic »</Link>
                    </Box>

                    {topCaption?.generations && (
                        <Box title="👑 Caption of the Day">
                            <Link href={`/post/${topCaption.generation_id}`} className="flex gap-2 text-inherit">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={topCaption.generations.image_url} alt="" className="h-16 w-16 shrink-0 border border-[var(--box-border)] object-cover" />
                                <span>
                                    <b>“{topCaption.text}”</b>
                                    <span className="ms-muted block">+{topCaption.score} · {topCaption.style}</span>
                                </span>
                            </Link>
                        </Box>
                    )}

                    <Box title="My Stats">
                        <table className="ms-table">
                            <tbody>
                                <tr><th>Pics posted</th><td>{myPostCount}</td></tr>
                                <tr><th>Votes cast</th><td>{votesCast}</td></tr>
                                <tr><th>Caption robot</th><td>Gemini</td></tr>
                                <tr><th>Voices</th><td>{CAPTION_STYLES.map((s) => s.name).join(', ')}</td></tr>
                            </tbody>
                        </table>
                    </Box>
                </div>

                <div className="ms-col">
                    {topEight.length > 0 && (
                        <Box title="The Funny Bone’s Top 8">
                            <p className="ms-muted mb-2">The funniest pics right now.</p>
                            <div className="ms-top8">
                                {topEight.map((post) => (
                                    <Link key={post.id} href={`/post/${post.id}`}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={post.image_url} alt="" />
                                        <span>{bestCaption(post)?.text}</span>
                                    </Link>
                                ))}
                            </div>
                        </Box>
                    )}

                    <div>
                        <p className="ms-title">Latest Pics</p>
                        <div className="ms-tabs">
                            {SORTS.map((s) => (
                                <button key={s.key} className="ms-tab" aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        {(error || voteError) && <p className="ms-error">{error || voteError}</p>}

                        <div className="ms-col">
                            {loading ? (
                                <p>Loading the funny...</p>
                            ) : visible.length === 0 ? (
                                <Box title="Nothing here yet">
                                    <p>Be the first to post for “{theme.title}”!</p>
                                    <Link href="/create" className="ms-button mt-2">Upload a Pic »</Link>
                                </Box>
                            ) : (
                                visible.map((post) => (
                                    <PostCard key={post.id} post={post} userId={user.id} myVotes={myVotes} onVote={vote} />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Shell>
    );
}
