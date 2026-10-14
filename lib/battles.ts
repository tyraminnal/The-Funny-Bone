import { supabase } from './supabase';
import type { Battle, BattleReveal } from './types';

export const BATTLE_COLUMNS = 'id, user_id, image_url, theme, caption_a, caption_b, votes_a, votes_b, created_at';

// Reveals for the battles you're allowed to see the answer to, keyed by battle id.
export async function loadReveals(battleIds: string[]): Promise<Record<string, BattleReveal>> {
    if (battleIds.length === 0) return {};
    const { data, error } = await supabase.rpc('battle_reveals', { battle_ids: battleIds });
    if (error) console.error('Battle reveal error:', error);
    return Object.fromEntries(((data as BattleReveal[] | null) ?? []).map((r) => [r.battle_id, r]));
}

export interface BattleResult {
    humanVotes: number;
    aiVotes: number;
    // null until someone votes
    winner: 'human' | 'ai' | 'tie' | null;
}

export function battleResult(battle: Battle, reveal: BattleReveal): BattleResult {
    const aiVotes = reveal.ai_side === 'a' ? battle.votes_a : battle.votes_b;
    const humanVotes = reveal.ai_side === 'a' ? battle.votes_b : battle.votes_a;
    const winner = aiVotes + humanVotes === 0 ? null : humanVotes > aiVotes ? 'human' : aiVotes > humanVotes ? 'ai' : 'tie';
    return { humanVotes, aiVotes, winner };
}
