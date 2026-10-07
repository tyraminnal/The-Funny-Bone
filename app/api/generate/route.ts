import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { CAPTION_STYLES, todaysTheme } from '@/lib/themes';

export const maxDuration = 60;

const DAILY_LIMIT = 10;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_CONTEXT_LENGTH = 140;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const SYSTEM_PROMPT = `You write captions for The Funny Bone, a meme site for Columbia University students.
The audience is college students who are new to New York City, very online, and explore the city on weekends.
Rules:
- Keep it PG-13. No slurs, no punching down, no jokes about anyone's body, race, religion, gender, or sexuality.
- Never try to identify real people in the photo or guess their names.
- Each caption is one or two short sentences, under 120 characters, no hashtags, no emojis unless the style calls for it.
- Make the joke about what is actually in the photo. Specific beats generic.`;

function buildPrompt(themeTitle: string, themeBlurb: string, context: string | null): string {
    const styles = CAPTION_STYLES.map((s) => `- ${s.name}: ${s.guide}`).join('\n');
    return `${SYSTEM_PROMPT}

Today's theme is "${themeTitle}": ${themeBlurb}
${context ? `The uploader added this context: "${context}"\n` : ''}
Write exactly one caption for this photo in each of these styles:
${styles}

Return JSON with a "captions" array of objects with "style" and "text".`;
}

function json(body: unknown, status = 200) {
    return Response.json(body, { status });
}

export async function POST(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!serviceKey || !geminiKey) {
        return json({ error: 'Caption generation is not configured yet.' }, 500);
    }

    // Only signed-in users can generate.
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
        return json({ error: 'You need to be signed in.' }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) {
        return json({ error: 'Your session expired. Sign in again.' }, 401);
    }
    const user = userData.user;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Daily limit per user keeps us inside the free model quota.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
        .from('generations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', since);
    if ((count ?? 0) >= DAILY_LIMIT) {
        return json({ error: `You've hit today's limit of ${DAILY_LIMIT} uploads. Go vote on some captions!` }, 429);
    }

    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return json({ error: 'Invalid upload.' }, 400);
    }

    const image = form.get('image');
    if (!(image instanceof File)) {
        return json({ error: 'Pick a photo first.' }, 400);
    }
    if (!ALLOWED_TYPES.includes(image.type)) {
        return json({ error: 'Photos must be JPEG, PNG, or WebP.' }, 400);
    }
    if (image.size > MAX_IMAGE_BYTES) {
        return json({ error: 'That photo is too large.' }, 400);
    }

    const rawContext = form.get('context');
    const context = typeof rawContext === 'string' && rawContext.trim()
        ? rawContext.trim().slice(0, MAX_CONTEXT_LENGTH)
        : null;

    const theme = todaysTheme();
    const prompt = buildPrompt(theme.title, theme.blurb, context);
    const imageBytes = Buffer.from(await image.arrayBuffer());

    // Ask the model for captions.
    const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: image.type, data: imageBytes.toString('base64') } },
                    ],
                }],
                generationConfig: {
                    temperature: 1.0,
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'OBJECT',
                        properties: {
                            captions: {
                                type: 'ARRAY',
                                items: {
                                    type: 'OBJECT',
                                    properties: { style: { type: 'STRING' }, text: { type: 'STRING' } },
                                    required: ['style', 'text'],
                                },
                            },
                        },
                        required: ['captions'],
                    },
                },
            }),
        }
    );

    if (!geminiResponse.ok) {
        console.error('Gemini error:', geminiResponse.status, await geminiResponse.text());
        const message = geminiResponse.status === 429
            ? 'The caption robot is overwhelmed. Try again in a minute.'
            : 'The caption robot had a problem. Try again.';
        return json({ error: message }, 502);
    }

    const geminiData = await geminiResponse.json();
    const rawText: string | undefined = geminiData?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('');

    let captions: { style: string; text: string }[] = [];
    try {
        const parsed = JSON.parse(rawText ?? '');
        const allowedStyles = new Set<string>(CAPTION_STYLES.map((s) => s.name));
        captions = (parsed.captions ?? [])
            .filter((c: { style?: unknown; text?: unknown }) => typeof c?.text === 'string' && c.text.trim())
            .map((c: { style?: string; text: string }) => ({
                style: c.style && allowedStyles.has(c.style) ? c.style : 'Wildcard',
                text: c.text.trim().slice(0, 280),
            }))
            .slice(0, CAPTION_STYLES.length);
    } catch {
        captions = [];
    }

    if (captions.length === 0) {
        console.error('Gemini returned no usable captions:', JSON.stringify(geminiData).slice(0, 1000));
        return json({ error: 'No captions came back for that photo. Try a different one.' }, 422);
    }

    // Save the photo, then the generation and its captions.
    const ext = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
    const imagePath = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage
        .from('memes')
        .upload(imagePath, imageBytes, { contentType: image.type });
    if (uploadError) {
        console.error('Upload error:', uploadError);
        return json({ error: 'Could not save your photo.' }, 500);
    }
    const { data: urlData } = admin.storage.from('memes').getPublicUrl(imagePath);

    const { data: generation, error: generationError } = await admin
        .from('generations')
        .insert({
            user_id: user.id,
            image_url: urlData.publicUrl,
            image_path: imagePath,
            theme: theme.slug,
            user_context: context,
            prompt,
            model: MODEL,
        })
        .select('id')
        .single();
    if (generationError || !generation) {
        console.error('Generation insert error:', generationError);
        await admin.storage.from('memes').remove([imagePath]);
        return json({ error: 'Could not save your post.' }, 500);
    }

    const { error: captionsError } = await admin.from('captions').insert(
        captions.map((c) => ({ generation_id: generation.id, user_id: user.id, style: c.style, text: c.text }))
    );
    if (captionsError) {
        console.error('Captions insert error:', captionsError);
        await admin.from('generations').delete().eq('id', generation.id);
        await admin.storage.from('memes').remove([imagePath]);
        return json({ error: 'Could not save your captions.' }, 500);
    }

    return json({ id: generation.id });
}
