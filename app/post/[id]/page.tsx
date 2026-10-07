'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRequireUser } from '@/lib/useRequireUser';
import { useVotes } from '@/lib/useVotes';
import type { Generation } from '@/lib/types';
import Shell from '../../components/Shell';
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
        <Shell>
            <p className="mb-2"><Link href="/">« Back to Home</Link></p>
            {voteError && <p className="ms-error">{voteError}</p>}
            {loading ? (
                <p>Loading...</p>
            ) : posts[0] ? (
                <div className="mx-auto max-w-[560px]">
                    <PostCard post={posts[0]} userId={user.id} myVotes={myVotes} onVote={vote} />
                </div>
            ) : (
                <p>This pic doesn’t exist (or got deleted).</p>
            )}
        </Shell>
    );
}
