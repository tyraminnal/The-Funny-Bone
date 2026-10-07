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
