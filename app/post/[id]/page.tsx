'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRequireUser } from '@/lib/useRequireUser';
import { useVotes } from '@/lib/useVotes';
import type { Generation } from '@/lib/types';
import Nav from '../../components/Nav';
import PostCard from '../../components/PostCard';

export default function PostPage() {
    const { id } = useParams<{ id: string }>();
    const user = useRequireUser();
    const [posts, setPosts] = useState<Generation[]>([]);
    const [loading, setLoading] = useState(true);
    const { myVotes, loadVotes, vote, voteError } = useVotes(user?.id ?? null, setPosts);

    useEffect(() => {
        if (!user) return;

        const load = async () => {
            const { data } = await supabase
                .from('generations')
                .select('id, user_id, image_url, theme, user_context, created_at, captions(*)')
                .eq('id', id)
                .maybeSingle();
            const post = data as Generation | null;
            setPosts(post ? [post] : []);
            if (post) await loadVotes(post.captions.map((c) => c.id));
            setLoading(false);
        };

        load();
    }, [user, id, loadVotes]);

    if (!user) return <p className="p-8">Redirecting...</p>;

    return (
        <>
            <Nav />
            <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
                <Link href="/" className="text-sm text-muted hover:text-foreground">← Back to feed</Link>
                {voteError && <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm text-red-800">{voteError}</p>}
                <div className="mt-4">
                    {loading ? (
                        <p className="text-muted">Loading...</p>
                    ) : posts[0] ? (
                        <PostCard post={posts[0]} userId={user.id} myVotes={myVotes} onVote={vote} />
                    ) : (
                        <p>This post doesn’t exist.</p>
                    )}
                </div>
            </main>
        </>
    );
}
