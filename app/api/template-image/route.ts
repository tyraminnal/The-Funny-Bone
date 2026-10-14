import { NextRequest } from 'next/server';
import { templateById } from '@/lib/memeTemplates';

// Serves a meme template image from our own origin so the browser can draw it
// on a canvas and upload it like any other pic. Only known templates are
// fetched, so this can't be used to proxy arbitrary URLs.
export async function GET(request: NextRequest) {
    const template = templateById(request.nextUrl.searchParams.get('id') ?? '');
    if (!template) {
        return new Response('Unknown template', { status: 404 });
    }

    const upstream = await fetch(template.url).catch(() => null);
    const type = upstream?.headers.get('content-type') ?? '';
    if (!upstream?.ok || !type.startsWith('image/')) {
        return new Response('Template image unavailable', { status: 502 });
    }

    return new Response(upstream.body, {
        headers: {
            'Content-Type': type,
            'Cache-Control': 'public, max-age=86400, immutable',
        },
    });
}
