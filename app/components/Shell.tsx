'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { signInWithGoogle } from '@/lib/signIn';
import { supabase } from '@/lib/supabase';
import { todaysTheme } from '@/lib/themes';

const LINKS = [
    { href: '/', label: 'Home' },
    { href: '/create', label: 'Make a Meme' },
    { href: '/profile', label: 'Profile' },
    { href: '/shows', label: 'TV Shows' },
];

const SKINS = [
    { key: 'classic', label: 'Classic' },
    { key: 'emo', label: 'Emo' },
    { key: 'glitter', label: 'Glitter' },
];

// The skin lives on <html data-skin>, set before paint by the script in layout.tsx.
function subscribeToSkin(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-skin'] });
    return () => observer.disconnect();
}

function applySkin(key: string) {
    document.documentElement.dataset.skin = key;
    try {
        localStorage.setItem('fb-skin', key);
    } catch {
        // Storage blocked; the skin just won't persist.
    }
}

export default function Shell({ children, signedIn = true }: { children: React.ReactNode; signedIn?: boolean }) {
    const pathname = usePathname();
    const router = useRouter();
    const theme = todaysTheme();
    const skin = useSyncExternalStore(
        subscribeToSkin,
        () => document.documentElement.dataset.skin || 'classic',
        () => 'classic'
    );

    const signOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
    };

    return (
        <div className="ms-wrap">
            <header className="ms-top">
                <Link href="/" className="ms-logo">
                    TheFunnyBone.com
                    <small>a place for laughs</small>
                </Link>
                <div className="ms-top-right">
                    {signedIn ? (
                        <button onClick={signOut} className="ms-button">Sign Out</button>
                    ) : (
                        <button onClick={signInWithGoogle} className="ms-button">Sign In</button>
                    )}
                </div>
            </header>

            {signedIn && (
                <nav className="ms-nav">
                    {LINKS.map((link) => (
                        <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>
                            {link.label}
                        </Link>
                    ))}
                </nav>
            )}

            <div className="ms-marquee" aria-label={`Today's theme: ${theme.title}`}>
                <span>
                    ★ Today’s theme: {theme.title.toUpperCase()} ★ {theme.blurb} ★ Upload a pic, pick a voice, get 4 AI captions, vote for the funniest ★
                </span>
            </div>

            <main className="ms-main">{children}</main>

            <footer className="ms-footer">
                <p>
                    Profile skin:
                    {SKINS.map((s) => (
                        <button key={s.key} onClick={() => applySkin(s.key)} aria-pressed={skin === s.key}>
                            {s.label}
                        </button>
                    ))}
                </p>
                <p>© 2004–{new Date().getFullYear()} TheFunnyBone.com · All captions written by AI, judged by you</p>
            </footer>
        </div>
    );
}
