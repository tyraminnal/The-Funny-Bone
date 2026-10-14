// Remembers the page someone was trying to open before we sent them to sign
// in (e.g. a shared battle link), so they land back there afterwards.

const KEY = 'fb-return-to';
const MAX_AGE_MS = 30 * 60 * 1000;

export function rememberReturnTo() {
    const path = window.location.pathname + window.location.search;
    if (path === '/' || path.startsWith('/auth')) return;
    try {
        localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
    } catch {
        // Storage blocked; they'll land on the home page instead.
    }
}

// The remembered page (cleared once read), or the home page.
export function takeReturnTo(): string {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { path?: unknown; at?: unknown } | null;
        localStorage.removeItem(KEY);
        const { path, at } = saved ?? {};
        // Only same-site paths, never "//other.site".
        if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
            && typeof at === 'number' && Date.now() - at < MAX_AGE_MS) {
            return path;
        }
    } catch {
        // Storage blocked or garbled.
    }
    return '/';
}
