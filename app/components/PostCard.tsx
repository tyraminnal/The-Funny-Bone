'use client';

import Link from 'next/link';
import { useState } from 'react';
import { themeBySlug } from '@/lib/themes';
import { timeAgo } from '@/lib/time';
import type { Caption, Generation, VoteValue } from '@/lib/types';

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
        <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
            <Link href={`/post/${post.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.image_url} alt="Uploaded photo" className="max-h-[520px] w-full bg-black object-contain" />
            </Link>

            <div className="flex items-center justify-between gap-2 px-4 pt-3 text-xs text-muted">
                <span>
                    {theme && <span className="mr-2 rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">{theme.title}</span>}
                    {isMine ? 'Your post' : 'Posted'} · {timeAgo(post.created_at)}
                </span>
                <button onClick={copyLink} className="font-medium hover:text-foreground">
                    {copied ? 'Link copied!' : 'Share'}
                </button>
            </div>

            {post.user_context && (
                <p className="px-4 pt-2 text-sm italic text-muted">“{post.user_context}”</p>
            )}

            <ul className="divide-y divide-line px-4 pb-2 pt-1">
                {captions.map((caption) => {
                    const mine = myVotes[caption.id];
                    return (
                        <li key={caption.id} className="flex items-center gap-3 py-3">
                            <div className="flex w-10 shrink-0 flex-col items-center">
                                <button
                                    aria-label="Upvote"
                                    title={isMine ? 'You can’t vote on your own post' : 'Funny'}
                                    disabled={isMine}
                                    onClick={() => onVote(caption, 1)}
                                    className={`rounded-md px-2 leading-6 disabled:cursor-not-allowed disabled:opacity-30 ${
                                        mine === 1 ? 'bg-accent-soft text-accent' : 'text-muted hover:text-accent'
                                    }`}
                                >
                                    ▲
                                </button>
                                <span className={`text-sm font-bold tabular-nums ${mine === 1 ? 'text-accent' : mine === -1 ? 'text-down' : ''}`}>
                                    {caption.score}
                                </span>
                                <button
                                    aria-label="Downvote"
                                    title={isMine ? 'You can’t vote on your own post' : 'Not funny'}
                                    disabled={isMine}
                                    onClick={() => onVote(caption, -1)}
                                    className={`rounded-md px-2 leading-6 disabled:cursor-not-allowed disabled:opacity-30 ${
                                        mine === -1 ? 'bg-down-soft text-down' : 'text-muted hover:text-down'
                                    }`}
                                >
                                    ▼
                                </button>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[15px] leading-snug">
                                    {caption.id === leaderId && <span className="mr-1" title="Top caption">👑</span>}
                                    {caption.text}
                                </p>
                                <p className="mt-0.5 text-xs text-muted">{caption.style}</p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </article>
    );
}
