export interface Caption {
    id: string;
    generation_id: string;
    user_id: string;
    style: string;
    text: string;
    upvotes: number;
    downvotes: number;
    score: number;
    created_at: string;
}

export interface Generation {
    id: string;
    user_id: string;
    image_url: string;
    theme: string;
    user_context: string | null;
    created_at: string;
    captions: Caption[];
}

export type VoteValue = 1 | -1;

export type BattleSide = 'a' | 'b';

// A Human vs AI battle. Which side is the AI is only in BattleReveal.
export interface Battle {
    id: string;
    user_id: string;
    image_url: string;
    theme: string;
    caption_a: string;
    caption_b: string;
    votes_a: number;
    votes_b: number;
    created_at: string;
}

// Only returned for battles you started or already voted on.
export interface BattleReveal {
    battle_id: string;
    ai_side: BattleSide;
    human_name: string;
    my_side: BattleSide | null;
}
