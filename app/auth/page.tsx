'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileCheck } from '@/lib/useProfileCheck';
import Box from '../components/Box';
import Shell from '../components/Shell';

export default function AuthPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);

    useProfileCheck(); // This checks and redirects if needed

    useEffect(() => {
        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                setLoggedIn(true);
                router.push('/auth/setup');
            }
        };
        checkAuth();
    }, [router]);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            console.error('Sign in error:', error);
            setLoading(false);
        }
    };

    if (loggedIn) {
        return <p>Redirecting...</p>;
    }

    return (
        <Shell signedIn={false}>
            <div className="ms-cols">
                <div className="ms-col">
                    <Box title="Member Login">
                        <p className="mb-3">Sign in with your Google account to post pics and vote.</p>
                        <p className="text-center">
                            <button onClick={handleGoogleSignIn} disabled={loading} className="ms-button ms-button-big">
                                {loading ? 'Signing in...' : 'Sign in with Google »'}
                            </button>
                        </p>
                    </Box>
                </div>
                <div className="ms-col">
                    <section>
                        <h1 className="ms-big-title">Welcome to The Funny Bone!</h1>
                        <p className="ms-title">Upload a pic. Pick a voice. Get 4 AI captions. Vote for the funniest.</p>
                    </section>
                    <Box title="Why join?">
                        <table className="ms-table">
                            <tbody>
                                <tr><th>Daily theme</th><td>A new theme every day, from the subway to Butler at 2am</td></tr>
                                <tr><th>AI captions</th><td>Pick any voice you want and get 4 captions right on your pic</td></tr>
                                <tr><th>Voting</th><td>LOL or meh. The funniest becomes Caption of the Day</td></tr>
                                <tr><th>Ranking</th><td>Earn points and climb the Funniest Ranking</td></tr>
                            </tbody>
                        </table>
                    </Box>
                </div>
            </div>
        </Shell>
    );
}
