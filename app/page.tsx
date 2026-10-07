'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { signInWithGoogle } from '@/lib/signIn';
import { supabase } from '@/lib/supabase';
import { useProfileCheck } from '@/lib/useProfileCheck';
import { useSession } from '@/lib/useSession';
import { useVotes } from '@/lib/useVotes';
import { todaysTheme } from '@/lib/themes';
import type { Caption, Generation } from '@/lib/types';
import Box from './components/Box';
import MemeImage from './components/MemeImage';
import PostCard from './components/PostCard';
import Ranking from './components/Ranking';
import Shell from './components/Shell';

export default function Home() {
    useProfileCheck();
    const { user, ready } = useSession();

    if (!ready) return <p className="p-8">Loading...</p>;
    return user ? <Feed user={user} /> : <Welcome />;
}

// ---------------------------------------------------------------------------
// Logged out: an AI meme to laugh at, and a way in.
// ---------------------------------------------------------------------------

interface ShowcaseMeme {
    id: string;
    template_name: string;
    image_url: string;
    top_text: string;
    bottom_text: string;
}

function Welcome() {
    const theme = todaysTheme();
    const [memes, setMemes] = useState<ShowcaseMeme[] | null>(null);
    const [index, setIndex] = useState(0);
    const [signingIn, setSigningIn] = useState(false);

    useEffect(() => {
        fetch('/api/meme')
            .then((r) => r.json())
            .then((d) => setMemes(d.memes ?? []))
            .catch(() => setMemes([]));
    }, []);

    const meme = memes?.[index];
    const step = (delta: number) => memes && setIndex((i) => (i + delta + memes.length) % memes.length);

    const signIn = async () => {
        setSigningIn(true);
        if (await signInWithGoogle()) setSigningIn(false);
    };

    return (
        <Shell signedIn={false}>
            <div className="ms-cols-right">
                <div className="ms-col">
                    <Box title="😂 Meme of the Moment, made by AI">
                        {memes === null ? (
                            <p>Cooking up a meme...</p>
                        ) : !meme ? (
                            <p>The meme robot is napping. Sign in and make your own!</p>
                        ) : (
                            <>
                                <MemeImage src={meme.image_url} alt={meme.template_name} topText={meme.top_text} bottomText={meme.bottom_text} />
                                {memes.length > 1 && (
                                    <div className="ms-pager">
                                        <button className="ms-button" onClick={() => step(-1)}>◀ Prev</button>
                                        <span>Meme {index + 1} of {memes.length}</span>
                                        <button className="ms-button" onClick={() => step(1)}>Next ▶</button>
                                    </div>
                                )}
                                <p className="ms-muted mt-1.5">Written by Gemini about today’s theme. A fresh one drops every few hours.</p>
                            </>
                        )}
                    </Box>
                </div>

                <div className="ms-col">
                    <Box title="Member Login">
                        <p className="mb-2">Sign in to caption your own pics with AI and vote on everyone else’s.</p>
                        <p className="text-center">
                            <button onClick={signIn} disabled={signingIn} className="ms-button ms-button-big">
                                {signingIn ? 'Signing in...' : 'Sign in with Google »'}
                            </button>
                        </p>
                    </Box>

                    <Box title="Today’s Theme">
                        <p className="ms-title">{theme.title}</p>
                        <p>{theme.blurb}</p>
                    </Box>

                    <Box title="Why join?">
                        <table className="ms-table">
                            <tbody>
                                <tr><th>Make memes</th><td>Upload a pic, say what voice you want, get 4 AI captions</td></tr>
                                <tr><th>Vote</th><td>LOL or meh on every caption</td></tr>
                                <tr><th>Get ranked</th><td>Earn points and climb the Funniest Ranking</td></tr>
                                <tr><th>Daily theme</th><td>A new theme every day, from the subway to Butler at 2am</td></tr>
                            </tbody>
                        </table>
                    </Box>
                </div>
            </div>
        </Shell>
    );
}

// ---------------------------------------------------------------------------
// Signed in: the feed, with voting and the points ranking.
// ---------------------------------------------------------------------------

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

function bestScore(post: Generation) {
    return post.captions.reduce((max, c) => Math.max(max, c.score), 0);
}

// Score decays with age so new posts get a chance to reach the top.
function hotness(post: Generation) {
    const hours = (Date.now() - new Date(post.created_at).getTime()) / 3_600_000;
    return (bestScore(post) + 1) / Math.pow(hours + 2, 1.5);
}

function Feed({ user }: { user: User }) {
    const theme = todaysTheme();
    const [posts, setPosts] = useState<Generation[]>([]);
    const [topCaption, setTopCaption] = useState<TopCaption | null>(null);
    const [me, setMe] = useState<Me | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sort, setSort] = useState<Sort>('hot');
    const { myVotes, loadVotes, vote, voteError, savedCaptionId, voteCount } = useVotes(user.id, setPosts);

    useEffect(() => {
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
    }, [user.id, loadVotes]);

    const visible = useMemo(() => {
        const list = sort === 'theme' ? posts.filter((p) => p.theme === theme.slug) : [...posts];
        if (sort === 'hot') list.sort((a, b) => hotness(b) - hotness(a));
        if (sort === 'top') list.sort((a, b) => bestScore(b) - bestScore(a));
        return list;
    }, [posts, sort, theme.slug]);

    const mood = MOODS[new Date().getDate() % MOODS.length];

    return (
        <Shell>
            <div className="ms-cols-right">
                <div className="ms-col">
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
                    </div>

                    {loading ? (
                        <p>Loading the funny...</p>
                    ) : visible.length === 0 ? (
                        <Box title="Nothing here yet">
                            <p>Be the first to post for “{theme.title}”!</p>
                            <Link href="/create" className="ms-button mt-2">Upload a Pic »</Link>
                        </Box>
                    ) : (
                        visible.map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                userId={user.id}
                                myVotes={myVotes}
                                savedCaptionId={savedCaptionId}
                                onVote={vote}
                            />
                        ))
                    )}
                </div>

                <div className="ms-col">
                    <section>
                        <h1 className="ms-big-title">Hello, {me?.first_name || 'friend'}!</h1>
                        <div className="flex gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={me?.avatar_url || '/default-avatar.svg'} alt="Your avatar" className="ms-avatar" />
                            <div className="text-[11px]">
                                <p>Columbia University<br />New York, NY</p>
                                <p className="ms-online mt-2">Online Now!</p>
                                <p className="mt-2"><b>Mood:</b> {mood}</p>
                                <p className="mt-2"><Link href="/profile">Edit Profile</Link></p>
                            </div>
                        </div>
                    </section>

                    <Ranking refreshKey={voteCount} />

                    <Box title="Today’s Theme">
                        <p className="ms-title">{theme.title}</p>
                        <p>{theme.blurb}</p>
                        <Link href="/create" className="ms-button mt-2">Upload a Pic »</Link>
                    </Box>

                    {topCaption?.generations && (
                        <Box title="👑 Caption of the Day">
                            <Link href={`/post/${topCaption.generation_id}`} className="flex gap-2 text-inherit">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={topCaption.generations.image_url} alt="" className="h-14 w-14 shrink-0 border border-[var(--box-border)] object-cover" />
                                <span>
                                    <b>“{topCaption.text}”</b>
                                    <span className="ms-muted block">+{topCaption.score}</span>
                                </span>
                            </Link>
                        </Box>
                    )}
                </div>
            </div>
        </Shell>
    );
}
