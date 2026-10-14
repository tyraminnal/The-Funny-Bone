import type { Metadata } from 'next';

// What link previews show when a battle is shared. The battle itself needs sign-in.
export const metadata: Metadata = {
    title: 'Human vs AI · The Funny Bone',
    description: 'Two captions, one written by an AI. Vote for the funnier one, then find out who wrote it.',
    openGraph: {
        title: 'Human vs AI: which caption is funnier?',
        description: 'Two captions, one written by an AI. Vote for the funnier one, then find out who wrote it.',
        siteName: 'The Funny Bone',
    },
};

export default function BattleLayout({ children }: { children: React.ReactNode }) {
    return children;
}
