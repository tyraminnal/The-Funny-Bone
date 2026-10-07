'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfileCheck } from '@/lib/useProfileCheck';
import { useRequireUser } from '@/lib/useRequireUser';
import { todaysTheme } from '@/lib/themes';
import Nav from '../components/Nav';

const MAX_DIMENSION = 1280;
const LOADING_LINES = [
    'Showing your photo to the caption robot...',
    'Consulting a Midwesterner...',
    'Asking a real New Yorker (they’re unimpressed)...',
    'Checking what the group chat would say...',
];

// Shrinks the photo in the browser so uploads stay small and fast.
function resizeImage(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))), 'image/jpeg', 0.85);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('unreadable image'));
        };
        img.src = url;
    });
}

export default function CreatePage() {
    useProfileCheck();
    const user = useRequireUser();
    const router = useRouter();
    const theme = todaysTheme();

    const [image, setImage] = useState<Blob | null>(null);
    const [preview, setPreview] = useState('');
    const [context, setContext] = useState('');
    const [generating, setGenerating] = useState(false);
    const [loadingLine, setLoadingLine] = useState(0);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!generating) return;
        const timer = setInterval(() => setLoadingLine((i) => (i + 1) % LOADING_LINES.length), 2000);
        return () => clearInterval(timer);
    }, [generating]);

    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError('');
        try {
            const resized = await resizeImage(file);
            setImage(resized);
            setPreview(URL.createObjectURL(resized));
        } catch {
            setError('Couldn’t read that photo. Try a JPEG or PNG.');
        }
    };

    const handleGenerate = async () => {
        if (!image) return;
        setGenerating(true);
        setLoadingLine(0);
        setError('');

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
            router.push('/auth');
            return;
        }

        const form = new FormData();
        form.append('image', image, 'photo.jpg');
        form.append('context', context);

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { Authorization: `Bearer ${data.session.access_token}` },
                body: form,
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(result.error || 'Something went wrong. Try again.');
                setGenerating(false);
                return;
            }
            router.push(`/post/${result.id}`);
        } catch {
            setError('Network error. Try again.');
            setGenerating(false);
        }
    };

    if (!user) return <p className="p-8">Redirecting...</p>;

    return (
        <>
            <Nav />
            <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
                <h1 className="text-2xl font-bold">Make a meme</h1>
                <p className="mt-1 text-sm text-muted">
                    Upload a photo and our AI writes four captions in different voices. Everyone else votes on the funniest.
                </p>

                <div className="mt-4 rounded-2xl bg-accent-soft p-4 text-sm">
                    <span className="font-semibold text-accent">Today’s theme: {theme.title}.</span> {theme.blurb}
                </div>

                <label className="mt-6 flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-card text-center hover:border-accent">
                    {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="Your photo" className="max-h-[480px] w-full object-contain" />
                    ) : (
                        <span className="p-8 text-muted">
                            <span className="block text-3xl">📸</span>
                            Tap to choose a photo
                        </span>
                    )}
                    <input type="file" accept="image/*" onChange={handleFile} disabled={generating} className="hidden" />
                </label>

                <label className="mt-4 block text-sm font-medium">
                    Add context (optional)
                    <input
                        type="text"
                        value={context}
                        maxLength={140}
                        onChange={(e) => setContext(e.target.value)}
                        disabled={generating}
                        placeholder="e.g. the 1 train at 116th, 8:55 for a 9am"
                        className="mt-1 block w-full rounded-xl border border-line bg-card px-3 py-2 font-normal outline-none focus:border-accent"
                    />
                </label>

                {error && <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm text-red-800">{error}</p>}

                <button
                    onClick={handleGenerate}
                    disabled={!image || generating}
                    className="mt-6 w-full rounded-full bg-accent py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {generating ? LOADING_LINES[loadingLine] : 'Generate captions'}
                </button>
                <p className="mt-3 text-center text-xs text-muted">
                    Your photo is shared with everyone signed in to The Funny Bone. Don’t post people who didn’t agree to it.
                </p>
            </main>
        </>
    );
}
