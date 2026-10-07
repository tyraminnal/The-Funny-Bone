'use client';

import Link from 'next/link';
import { useState } from 'react';
import { themeBySlug } from '@/lib/themes';
import { timeAgo } from '@/lib/time';
import type { Caption, Generation, VoteValue } from '@/lib/types';
import Box from './Box';

interface Props {
    post: Generation;
    userId: string | null;
    myVotes: Record<string, VoteValue>;
    onVote: (caption: Caption, value: VoteValue) => void;
}

export default function PostCard({ post, userId, myVotes, onVote }: Props) {
    const [copied, setCopied] = useState(false);
    const isMine = post.user_id === userId;
    const theme = themeBySlug(post.theme);
    const captions = [...post.captions].sort((a, b) => b.score - a.score || a.created_at.localeCompare(b.created_at));
    const leaderId = captions[0]?.score > 0 ? captions[0].id : null;

    const copyLink = async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <Box title={
            <span className="flex justify-between gap-2">
                <span>{isMine ? 'Your pic' : 'New pic'} {theme && `· ${theme.title}`}</span>
                <span className="font-normal">{timeAgo(post.created_at)}</span>
            </span>
        }>
            <Link href={`/post/${post.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.image_url} alt="Uploaded photo" className="ms-post-photo" />
            </Link>

            {post.user_context && <p className="ms-muted mt-1.5 italic">“{post.user_context}”</p>}

            <p className="ms-title mt-2">AI Captions ({captions.length})</p>
            {captions.map((caption) => {
                const mine = myVotes[caption.id];
                const blockedTitle = isMine ? 'You can’t vote on your own pic' : undefined;
                return (
                    <div key={caption.id} className="ms-caption">
                        <div className="ms-caption-text">
                            {caption.id === leaderId && <span title="Top caption">👑 </span>}
                            {caption.text}
                            <span className="ms-caption-style">{caption.style}</span>
                        </div>
                        <div className="ms-votes">
                            <button
                                className="ms-vote"
                                data-on={mine === 1 ? 'up' : undefined}
                                disabled={isMine}
                                title={blockedTitle}
                                onClick={() => onVote(caption, 1)}
                            >
                                LOL ▲
                            </button>
                            <span className="ms-score">{caption.score > 0 ? `+${caption.score}` : caption.score}</span>
                            <button
                                className="ms-vote"
                                data-on={mine === -1 ? 'down' : undefined}
                                disabled={isMine}
                                title={blockedTitle}
                                onClick={() => onVote(caption, -1)}
                            >
                                meh ▼
                            </button>
                        </div>
                    </div>
                );
            })}

            <p className="ms-muted mt-2 flex justify-between">
                <span>{isMine ? 'Share it so people vote!' : 'Vote for the funniest one'}</span>
                <button onClick={copyLink} className="ms-button">{copied ? 'Copied!' : 'Copy Link'}</button>
            </p>
        </Box>
    );
}
