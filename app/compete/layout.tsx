import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Battleground · The Funny Bone',
    description: 'Think you’re funnier than an AI? Write a caption, battle the AI, and let everyone vote.',
};

export default function CompeteLayout({ children }: { children: React.ReactNode }) {
    return children;
}
