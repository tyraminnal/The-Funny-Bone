'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileCheck } from '@/lib/useProfileCheck';

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
        <main style={{ padding: '2rem', textAlign: 'center' }}>
            <h1>Welcome to The Funny Bone</h1>
            <p>Sign in with Google to continue</p>
            <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                style={{
                    padding: '10px 20px',
                    fontSize: '16px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                }}
            >
                {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>
        </main>
    );
}