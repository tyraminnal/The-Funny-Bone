import { randomInt } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GeminiError, HOUSE_RULES, generateJson } from '@/lib/gemini';
import { countToday, json, readField, readImage, requireCaller, savePhoto } from '@/lib/serverApi';
import { todaysTheme } from '@/lib/themes';

export const maxDuration = 60;

const DAILY_LIMIT = 10;
const MAX_CAPTION_LENGTH = 90;

// The AI never sees the student's caption, so it can't copy or riff on it.
function buildPrompt(themeTitle: string, themeBlurb: string): string {
    return `You're in a caption battle on The Funny Bone, a meme site for Columbia University students.
A student is writing a caption for this same photo. Other students will vote on which caption is funnier without knowing which one you wrote.
The audience is college students who are new to New York City, very online, and explore the city on weekends.
${HOUSE_RULES}
- The caption is printed over the photo like a classic meme: one punchy line under ${MAX_CAPTION_LENGTH} characters, no hashtags, no emojis.
- Write like a funny college student would, so voters can't tell it came from an AI.

Today's theme is "${themeTitle}": ${themeBlurb} Only use it if it fits the photo.

Write the single funniest caption you can for this photo.
Return JSON with a "caption" string.`;
}

export async function POST(request: NextRequest) {
    const caller = await requireCaller(request);
    if (caller instanceof Response) return caller;
    const { user, admin } = caller;

    if (await countToday(admin, 'battles', user.id) >= DAILY_LIMIT) {
        return json({ error: `You've hit today's limit of ${DAILY_LIMIT} battles. Go judge some others!` }, 429);
    }

    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return json({ error: 'Invalid upload.' }, 400);
    }

    const image = readImage(form);
    if (typeof image === 'string') {
        return json({ error: image }, 400);
    }
    const humanCaption = readField(form, 'caption', MAX_CAPTION_LENGTH);
    if (!humanCaption) {
        return json({ error: 'Write your caption first.' }, 400);
    }

    const theme = todaysTheme();
    const prompt = buildPrompt(theme.title, theme.blurb);
    const imageBytes = Buffer.from(await image.arrayBuffer());

    // The AI's entry.
    let aiCaption: string;
    let model: string;
    try {
        const result = await generateJson<{ caption?: unknown }>(
            [{ text: prompt }, { inline_data: { mime_type: image.type, data: imageBytes.toString('base64') } }],
            {
                type: 'OBJECT',
                properties: { caption: { type: 'STRING' } },
                required: ['caption'],
            }
        );
        model = result.model;
        aiCaption = typeof result.data.caption === 'string' ? result.data.caption.trim().slice(0, 120) : '';
    } catch (err) {
        console.error('Gemini error:', err);
        const message = err instanceof GeminiError && err.status === 429
            ? 'The AI is overwhelmed. Try again in a minute.'
            : 'The AI had a problem. Try again.';
        return json({ error: message }, 502);
    }
    if (!aiCaption) {
        return json({ error: 'The AI forfeited on that photo. Try a different one.' }, 422);
    }

    const photo = await savePhoto(admin, user.id, image, imageBytes);
    if (!photo) {
        return json({ error: 'Could not save your photo.' }, 500);
    }

    // Randomly put the AI on side A or B so position gives nothing away.
    const aiSide = randomInt(2) === 0 ? 'a' : 'b';
    const { data: battle, error: battleError } = await admin
        .from('battles')
        .insert({
            user_id: user.id,
            image_url: photo.url,
            image_path: photo.path,
            theme: theme.slug,
            caption_a: aiSide === 'a' ? aiCaption : humanCaption,
            caption_b: aiSide === 'b' ? aiCaption : humanCaption,
        })
        .select('id')
        .single();
    if (battleError || !battle) {
        console.error('Battle insert error:', battleError);
        await admin.storage.from('memes').remove([photo.path]);
        return json({ error: 'Could not save your battle.' }, 500);
    }

    const { error: answerError } = await admin
        .from('battle_answers')
        .insert({ battle_id: battle.id, ai_side: aiSide, prompt, model });
    if (answerError) {
        console.error('Battle answer insert error:', answerError);
        await admin.from('battles').delete().eq('id', battle.id);
        await admin.storage.from('memes').remove([photo.path]);
        return json({ error: 'Could not save your battle.' }, 500);
    }

    return json({ id: battle.id });
}
