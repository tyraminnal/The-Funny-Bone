'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
    { href: '/', label: 'Feed' },
    { href: '/create', label: 'Make a meme' },
    { href: '/profile', label: 'Profile' },
];

export default function Nav() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
            <nav className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
                <Link href="/" className="text-lg font-bold tracking-tight">
                    🦴 The Funny Bone
                </Link>
                <div className="flex gap-1 text-sm">
                    {LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`rounded-full px-3 py-1.5 font-medium ${
                                pathname === link.href
                                    ? 'bg-foreground text-background'
                                    : 'text-muted hover:text-foreground'
                            }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </nav>
        </header>
    );
}
