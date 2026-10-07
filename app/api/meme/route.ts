import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { after } from 'next/server';
import { HOUSE_RULES, generateJson } from '@/lib/gemini';
import { MEME_TEMPLATES, templateById } from '@/lib/memeTemplates';
import { todaysTheme } from '@/lib/themes';

export const maxDuration = 60;

// A fresh AI meme at most this often; visitors in between see the saved ones.
const FRESH_FOR_MS = 4 * 60 * 60 * 1000;
const SHOW_COUNT = 10;

interface MemeRow {
    id: string;
    template_name: string;
    image_url: string;
    top_text: string;
    bottom_text: string;
    created_at: string;
}

function buildPrompt(recentJokes: string[]): string {
    const theme = todaysTheme();
    const templates = MEME_TEMPLATES.map((t) => `- ${t.id}: ${t.name} (${t.hint})`).join('\n');
    const avoid = recentJokes.length ? `\nDon't repeat these recent jokes:\n${recentJokes.map((j) => `- ${j}`).join('\n')}\n` : '';

    return `You make memes for The Funny Bone, a meme site for Columbia University students.
The audience: college juniors who are chronically online, grew up in the Midwest, are new to New York City, live in the dorms, and explore the city on weekends.
${HOUSE_RULES}

Today's theme is "${theme.title}": ${theme.blurb}

Make one meme about today's theme using exactly one of these templates (use its id):
${templates}
${avoid}
The text goes on the image in classic white Impact letters. top_text can be empty. Keep each under 60 characters.
Return JSON with "template_id", "top_text", and "bottom_text".`;
}

const MEME_COLUMNS = 'id, template_name, image_url, top_text, bottom_text, created_at';

// Asks Gemini for a new meme about today's theme and saves it.
async function makeMeme(admin: SupabaseClient, recent: MemeRow[]): Promise<MemeRow | null> {
    try {
        const prompt = buildPrompt(recent.map((m) => `${m.top_text} / ${m.bottom_text}`));
        const { data: reply, model } = await generateJson<{ template_id?: string; top_text?: string; bottom_text?: string }>(
            [{ text: prompt }],
            {
                type: 'OBJECT',
                properties: {
                    template_id: { type: 'STRING', enum: MEME_TEMPLATES.map((t) => t.id) },
                    top_text: { type: 'STRING' },
                    bottom_text: { type: 'STRING' },
                },
                required: ['template_id', 'top_text', 'bottom_text'],
            }
        );
        const template = templateById(reply.template_id ?? '');
        const bottom = reply.bottom_text?.trim().slice(0, 80);
        if (!template || !bottom) return null;

        const { data, error } = await admin
            .from('showcase_memes')
            .insert({
                template_name: template.name,
                image_url: template.url,
                top_text: reply.top_text?.trim().slice(0, 80) ?? '',
                bottom_text: bottom,
                theme: todaysTheme().slug,
                prompt,
                model,
            })
            .select(MEME_COLUMNS)
            .single();
        if (error) console.error('Meme insert failed:', error);
        return (data as MemeRow | null) ?? null;
    } catch (err) {
        console.error('Meme generation failed:', err);
        return null;
    }
}

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey || !process.env.GEMINI_API_KEY) {
        return Response.json({ memes: [] });
    }

    // Logged-out visitors read memes through this route; the table itself has no public access.
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data } = await admin
        .from('showcase_memes')
        .select(MEME_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(SHOW_COUNT);
    const memes = (data ?? []) as MemeRow[];

    if (memes.length === 0) {
        // Nothing saved yet: make the first one now so the visitor has something to see.
        const first = await makeMeme(admin, []);
        return Response.json({ memes: first ? [first] : [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Stale: answer with the saved memes now and make a fresh one in the background.
    if (Date.now() - new Date(memes[0].created_at).getTime() > FRESH_FOR_MS) {
        after(() => makeMeme(admin, memes));
    }

    return Response.json({ memes }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } });
}
