'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useProfileCheck } from '@/lib/useProfileCheck';
import { useRequireUser } from '@/lib/useRequireUser';
import { todaysTheme } from '@/lib/themes';
import Box from '../components/Box';
import PicPicker from '../components/PicPicker';
import Shell from '../components/Shell';

const LOADING_LINES = [
    'Showing your pic to the caption robot...',
    'Getting into character...',
    'Workshopping punchlines...',
    'Checking what the group chat would say...',
];

const VOICE_IDEAS = ['my mom on Facebook', 'a tired TA', 'a nature documentary narrator', 'a sports announcer', 'Shakespeare', 'a LinkedIn influencer'];

export default function CreatePage() {
    useProfileCheck();
    const user = useRequireUser();
    const router = useRouter();
    const theme = todaysTheme();

    const [image, setImage] = useState<Blob | null>(null);
    const [context, setContext] = useState('');
    const [voice, setVoice] = useState('');
    const [generating, setGenerating] = useState(false);
    const [loadingLine, setLoadingLine] = useState(0);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!generating) return;
        const timer = setInterval(() => setLoadingLine((i) => (i + 1) % LOADING_LINES.length), 2000);
        return () => clearInterval(timer);
    }, [generating]);

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
        form.append('voice', voice);

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
        <Shell>
            <div className="ms-cols">
                <div className="ms-col">
                    <Box title="How it works">
                        <ol className="list-decimal space-y-1 pl-4">
                            <li>Upload a pic (bonus points for today’s theme)</li>
                            <li>Tell the caption robot what voice you want</li>
                            <li>It writes 4 captions, shown right on your pic</li>
                            <li>Everyone votes LOL or meh</li>
                            <li>The best one becomes Caption of the Day 👑</li>
                        </ol>
                    </Box>
                    <Box title="Today’s Theme">
                        <p className="ms-title">{theme.title}</p>
                        <p>{theme.blurb}</p>
                    </Box>
                </div>

                <Box title="Make a Meme">
                    <PicPicker disabled={generating} onImage={setImage} onError={setError} />

                    <label className="mt-3 block font-bold">
                        What voice should the captions be in?
                        <input
                            type="text"
                            value={voice}
                            maxLength={60}
                            onChange={(e) => setVoice(e.target.value)}
                            disabled={generating}
                            placeholder="e.g. my mom on Facebook (leave blank to be surprised)"
                            className="ms-input mt-1 font-normal"
                        />
                    </label>
                    <p className="ms-muted mt-1">
                        Ideas:{' '}
                        {VOICE_IDEAS.map((idea, i) => (
                            <span key={idea}>
                                {i > 0 && ' · '}
                                <button type="button" className="text-[var(--link)] hover:underline" onClick={() => setVoice(idea)} disabled={generating}>
                                    {idea}
                                </button>
                            </span>
                        ))}
                    </p>

                    <label className="mt-3 block font-bold">
                        Add context (optional):
                        <input
                            type="text"
                            value={context}
                            maxLength={140}
                            onChange={(e) => setContext(e.target.value)}
                            disabled={generating}
                            placeholder="e.g. the 1 train at 116th, 8:55 for a 9am"
                            className="ms-input mt-1 font-normal"
                        />
                    </label>

                    {error && <p className="ms-error">{error}</p>}

                    <p className="mt-3 text-center">
                        <button onClick={handleGenerate} disabled={!image || generating} className="ms-button ms-button-big">
                            {generating ? LOADING_LINES[loadingLine] : 'Generate Captions »'}
                        </button>
                    </p>
                    <p className="ms-muted mt-3 text-center">
                        Everyone signed in can see your pic. Don’t post people who didn’t say it was OK.
                    </p>
                </Box>
            </div>
        </Shell>
    );
}
