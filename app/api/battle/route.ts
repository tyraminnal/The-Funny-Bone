import { randomInt } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GeminiError } from '@/lib/gemini';
import { failRequest, finishRequest, runChain } from '@/lib/pipeline';
import { countToday, json, readField, readImage, recordPhoto, requireCaller, savePhoto } from '@/lib/serverApi';
import { todaysTheme } from '@/lib/themes';

export const maxDuration = 60;

const DAILY_LIMIT = 10;
const MAX_CAPTION_LENGTH = 90;

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
    const imageBytes = Buffer.from(await image.arrayBuffer());

    // The AI's entry. It never sees the student's caption, so it can't copy or riff on it.
    let run;
    let aiCaption: string;
    try {
        run = await runChain<{ caption?: unknown }>(admin, {
            kind: 'battle',
            userId: user.id,
            vars: { theme_title: theme.title, theme_blurb: theme.blurb, max_length: String(MAX_CAPTION_LENGTH) },
            image: { mimeType: image.type, base64: imageBytes.toString('base64') },
            schema: {
                type: 'OBJECT',
                properties: { caption: { type: 'STRING' } },
                required: ['caption'],
            },
        });
        aiCaption = typeof run.data.caption === 'string' ? run.data.caption.trim().slice(0, 120) : '';
    } catch (err) {
        console.error('Gemini error:', err);
        const message = err instanceof GeminiError && err.status === 429
            ? 'The AI is overwhelmed. Try again in a minute.'
            : 'The AI had a problem. Try again.';
        return json({ error: message }, 502);
    }
    const { request: genRequest, prompt, model } = run;
    if (!aiCaption) {
        await failRequest(admin, genRequest, 'No caption in the reply');
        return json({ error: 'The AI forfeited on that photo. Try a different one.' }, 422);
    }

    const photo = await savePhoto(admin, user.id, image, imageBytes);
    if (!photo) {
        await failRequest(admin, genRequest, 'Photo upload failed');
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
        await failRequest(admin, genRequest, `Saving the battle failed: ${battleError?.message}`);
        return json({ error: 'Could not save your battle.' }, 500);
    }

    const { error: answerError } = await admin
        .from('battle_answers')
        .insert({ battle_id: battle.id, ai_side: aiSide, prompt, model });
    if (answerError) {
        console.error('Battle answer insert error:', answerError);
        await admin.from('battles').delete().eq('id', battle.id);
        await admin.storage.from('memes').remove([photo.path]);
        await failRequest(admin, genRequest, `Saving the battle failed: ${answerError.message}`);
        return json({ error: 'Could not save your battle.' }, 500);
    }

    await Promise.all([
        recordPhoto(admin, user.id, photo),
        finishRequest(admin, genRequest, { battle_id: battle.id, image_url: photo.url }),
    ]);
    return json({ id: battle.id });
}
