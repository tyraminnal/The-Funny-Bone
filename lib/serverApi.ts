import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';

// Shared pieces of the upload routes (/api/generate and /api/battle).
// Server only: uses the service role key.

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function json(body: unknown, status = 200) {
    return Response.json(body, { status });
}

export interface Caller {
    user: User;
    admin: SupabaseClient;
}

// Checks config and the caller's session. Returns the caller, or an error response to send back.
export async function requireCaller(request: NextRequest): Promise<Caller | Response> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey || !process.env.GEMINI_API_KEY) {
        return json({ error: 'Caption generation is not configured yet.' }, 500);
    }

    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) {
        return json({ error: 'You need to be signed in.' }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) {
        return json({ error: 'Your session expired. Sign in again.' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    return { user: userData.user, admin };
}

// How many rows the user added to a table in the last 24 hours (for daily limits).
export async function countToday(admin: SupabaseClient, table: string, userId: string): Promise<number> {
    const { count } = await admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - DAY_MS).toISOString());
    return count ?? 0;
}

// The uploaded photo from the form, or an error message for the user.
export function readImage(form: FormData): File | string {
    const image = form.get('image');
    if (!(image instanceof File)) return 'Pick a photo first.';
    if (!ALLOWED_TYPES.includes(image.type)) return 'Photos must be JPEG, PNG, or WebP.';
    if (image.size > MAX_IMAGE_BYTES) return 'That photo is too large.';
    return image;
}

// A trimmed text field from the form, cut to max length, or null when blank.
export function readField(form: FormData, name: string, max: number): string | null {
    const value = form.get(name);
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

// Saves the photo to the public "memes" bucket. Returns its path and URL, or null on failure.
export async function savePhoto(admin: SupabaseClient, userId: string, image: File, bytes: Buffer) {
    const ext = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await admin.storage.from('memes').upload(path, bytes, { contentType: image.type });
    if (error) {
        console.error('Upload error:', error);
        return null;
    }
    return { path, url: admin.storage.from('memes').getPublicUrl(path).data.publicUrl };
}
