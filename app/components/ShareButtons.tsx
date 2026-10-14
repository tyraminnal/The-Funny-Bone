'use client';

import { useState, useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

// Share a page on socials. Phones get the native share sheet (Instagram,
// iMessage, TikTok...); everyone gets direct links and Copy Link.
export default function ShareButtons({ path, text }: { path: string; text: string }) {
    const [copied, setCopied] = useState(false);
    const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => '');
    const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === 'function', () => false);

    const url = `${origin}${path}`;
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(text);
    const links = [
        { label: 'X', href: `https://x.com/intent/tweet?text=${t}&url=${u}` },
        { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
        { label: 'Reddit', href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
        { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}` },
    ];

    const shareNative = async () => {
        try {
            await navigator.share({ title: 'The Funny Bone', text, url });
        } catch {
            // They closed the share sheet.
        }
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="ms-share">
            <span className="ms-share-label">Share:</span>
            {canShare && <button type="button" onClick={shareNative} className="ms-button">Share…</button>}
            {links.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="ms-button">
                    {link.label}
                </a>
            ))}
            <button type="button" onClick={copyLink} className="ms-button">{copied ? 'Copied!' : 'Copy Link'}</button>
        </div>
    );
}
