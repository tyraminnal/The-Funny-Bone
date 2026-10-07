import { useCallback, useState } from 'react';
import { supabase } from './supabase';
import type { Caption, Generation, VoteValue } from './types';

// Loads the signed-in user's votes and records new ones.
// Every vote a user submits is a new row in caption_votes. Changing or
// removing a vote deletes the user's previous row for that caption first.
export function useVotes(userId: string | null, setPosts: React.Dispatch<React.SetStateAction<Generation[]>>) {
    const [myVotes, setMyVotes] = useState<Record<string, VoteValue>>({});
    const [voteError, setVoteError] = useState('');
    const [savedCaptionId, setSavedCaptionId] = useState<string | null>(null);
    const [voteCount, setVoteCount] = useState(0);

    const loadVotes = useCallback(async (captionIds: string[]) => {
        if (!userId || captionIds.length === 0) return;
        const { data } = await supabase
            .from('caption_votes')
            .select('caption_id, vote')
            .eq('user_id', userId)
            .in('caption_id', captionIds);
        const votes: Record<string, VoteValue> = {};
        for (const row of data ?? []) votes[row.caption_id] = row.vote as VoteValue;
        setMyVotes((prev) => ({ ...prev, ...votes }));
    }, [userId]);

    const setVote = useCallback((captionId: string, value: number) => {
        setMyVotes((prev) => {
            const copy = { ...prev };
            if (value === 0) delete copy[captionId];
            else copy[captionId] = value as VoteValue;
            return copy;
        });
    }, []);

    const adjustCaption = useCallback((captionId: string, from: number, to: number) => {
        setPosts((posts) => posts.map((post) => ({
            ...post,
            captions: post.captions.map((c): Caption => c.id !== captionId ? c : {
                ...c,
                upvotes: c.upvotes + (to === 1 ? 1 : 0) - (from === 1 ? 1 : 0),
                downvotes: c.downvotes + (to === -1 ? 1 : 0) - (from === -1 ? 1 : 0),
                score: c.score + to - from,
            }),
        })));
    }, [setPosts]);

    const vote = useCallback(async (caption: Caption, value: VoteValue) => {
        if (!userId) return;
        setVoteError('');
        setSavedCaptionId(null);

        const current: number = myVotes[caption.id] ?? 0;
        const next: number = current === value ? 0 : value; // clicking the same button again removes the vote

        setVote(caption.id, next);
        adjustCaption(caption.id, current, next);

        let error = null;
        if (current !== 0) {
            ({ error } = await supabase.from('caption_votes').delete().eq('caption_id', caption.id).eq('user_id', userId));
        }
        if (!error && next !== 0) {
            ({ error } = await supabase.from('caption_votes').insert({ caption_id: caption.id, user_id: userId, vote: next }));
        }

        if (error) {
            console.error('Vote error:', error);
            setVoteError('Your vote didn’t save. Try again.');
            setVote(caption.id, current);
            adjustCaption(caption.id, next, current);
            return;
        }
        setVoteCount((n) => n + 1);
        if (next !== 0) setSavedCaptionId(caption.id);
    }, [userId, myVotes, setVote, adjustCaption]);

    return { myVotes, loadVotes, vote, voteError, savedCaptionId, voteCount };
}
