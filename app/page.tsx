'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useProfileCheck } from '@/lib/useProfileCheck';
import { useRequireUser } from '@/lib/useRequireUser';
import { useVotes } from '@/lib/useVotes';
import { todaysTheme } from '@/lib/themes';
import type { Caption, Generation } from '@/lib/types';
import Nav from './components/Nav';
import PostCard from './components/PostCard';

type Sort = 'hot' | 'new' | 'top' | 'theme';

const SORTS: { key: Sort; label: string }[] = [
    { key: 'hot', label: '🔥 Hot' },
    { key: 'new', label: 'New' },
    { key: 'top', label: 'Top' },
    { key: 'theme', label: 'Today’s theme' },
];

interface TopCaption extends Caption {
    generations: { image_url: string } | null;
}

function bestScore(post: Generation) {
    return post.captions.reduce((max, c) => Math.max(max, c.score), 0);
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sort, setSort] = useState<Sort>('hot');
    const { myVotes, loadVotes, vote, voteError } = useVotes(user?.id ?? null, setPosts);

    useEffect(() => {
        if (!user) return;

        const load = async () => {
            const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
            const [feed, top] = await Promise.all([
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
            ]);

            if (feed.error) {
                console.error('Feed error:', feed.error);
                setError('Couldn’t load the feed.');
            }
            const loaded = (feed.data ?? []) as Generation[];
            setPosts(loaded);
            setTopCaption((top.data as TopCaption | null) ?? null);
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

    const votesCast = Object.keys(myVotes).length;

    if (!user) return <p className="p-8">Redirecting...</p>;

    return (
        <>
            <Nav />
            <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
                <section className="rounded-2xl bg-foreground p-5 text-background">
                    <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Today’s theme</p>
                    <h1 className="mt-1 text-2xl font-bold">{theme.title}</h1>
                    <p className="mt-1 text-sm opacity-80">{theme.blurb}</p>
                    <Link
                        href="/create"
                        className="mt-4 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                        Upload a photo →
                    </Link>
                </section>

                {topCaption && topCaption.generations && (
                    <Link
                        href={`/post/${topCaption.generation_id}`}
                        className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-card p-3 hover:border-accent"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={topCaption.generations.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-widest text-accent">👑 Caption of the day</p>
                            <p className="truncate text-sm font-medium">{topCaption.text}</p>
                            <p className="text-xs text-muted">+{topCaption.score} · {topCaption.style}</p>
                        </div>
                    </Link>
                )}

                <div className="mt-6 flex items-center justify-between gap-2">
                    <div className="flex gap-1 overflow-x-auto">
                        {SORTS.map((s) => (
                            <button
                                key={s.key}
                                onClick={() => setSort(s.key)}
                                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                                    sort === s.key ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                    {votesCast > 0 && <span className="hidden text-xs text-muted sm:inline">{votesCast} votes cast</span>}
                </div>

                {(error || voteError) && (
                    <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm text-red-800">{error || voteError}</p>
                )}

                <div className="mt-4 space-y-6">
                    {loading ? (
                        <p className="text-muted">Loading the funny...</p>
                    ) : visible.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
                            <p className="font-medium">Nothing here yet.</p>
                            <p className="mt-1 text-sm text-muted">Be the first to post for “{theme.title}”.</p>
                        </div>
                    ) : (
                        visible.map((post) => (
                            <PostCard key={post.id} post={post} userId={user.id} myVotes={myVotes} onVote={vote} />
                        ))
                    )}
                </div>

                <p className="mt-12 text-center text-xs text-muted">
                    <Link href="/shows" className="hover:text-foreground">TV shows</Link>
                </p>
            </main>
        </>
    );
}
