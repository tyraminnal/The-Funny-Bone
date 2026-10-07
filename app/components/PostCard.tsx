'use client';

import Link from 'next/link';
import { useState } from 'react';
import { themeBySlug } from '@/lib/themes';
import { timeAgo } from '@/lib/time';
import type { Caption, Generation, VoteValue } from '@/lib/types';
import Box from './Box';
import MemeImage from './MemeImage';

interface Props {
    post: Generation;
    userId: string | null;
    myVotes: Record<string, VoteValue>;
    savedCaptionId: string | null;
    onVote: (caption: Caption, value: VoteValue) => void;
}

export default function PostCard({ post, userId, myVotes, savedCaptionId, onVote }: Props) {
    const [index, setIndex] = useState(0);
    const [copied, setCopied] = useState(false);

    // Keep captions in the order they were written so they don't jump around while people vote.
    const captions = [...post.captions].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    const leader = captions.reduce<Caption | null>((best, c) => (c.score > (best?.score ?? 0) ? c : best), null);
    const caption = captions[index];
    const theme = themeBySlug(post.theme);
    const mine = caption ? myVotes[caption.id] : undefined;

    const step = (delta: number) => setIndex((i) => (i + delta + captions.length) % captions.length);

    const copyLink = async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <Box title={
            <span className="flex justify-between gap-2">
                <span>{post.user_id === userId ? 'Your pic' : 'New pic'} {theme && `· ${theme.title}`}</span>
                <span className="font-normal">{timeAgo(post.created_at)}</span>
            </span>
        }>
            <MemeImage src={post.image_url} alt="Uploaded photo" bottomText={caption?.text} />

            {captions.length > 1 && (
                <div className="ms-pager">
                    <button className="ms-button" onClick={() => step(-1)}>◀ Prev</button>
                    <span>
                        Caption {index + 1} of {captions.length}
                        {caption && leader?.id === caption.id && ' 👑'}
                    </span>
                    <button className="ms-button" onClick={() => step(1)}>Next ▶</button>
                </div>
            )}

            {caption && (
                <div className="ms-votebar">
                    <button className="ms-vote" data-on={mine === 1 ? 'up' : undefined} onClick={() => onVote(caption, 1)}>
                        LOL ▲
                    </button>
                    <span className="ms-score">{caption.score > 0 ? `+${caption.score}` : caption.score}</span>
                    <button className="ms-vote" data-on={mine === -1 ? 'down' : undefined} onClick={() => onVote(caption, -1)}>
                        meh ▼
                    </button>
                    {savedCaptionId === caption.id && <span className="ms-saved">Vote saved ✓</span>}
                </div>
            )}

            {post.user_context && <p className="ms-muted mt-1.5 italic">“{post.user_context}”</p>}

            <p className="ms-muted mt-2 flex items-center justify-between">
                <Link href={`/post/${post.id}`}>Permalink</Link>
                <button onClick={copyLink} className="ms-button">{copied ? 'Copied!' : 'Copy Link'}</button>
            </p>
        </Box>
    );
}
