'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleGoogleSignIn = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) console.error('Error:', error);
        setLoading(false);
    };

    return (
        <main style={{ padding: '2rem', textAlign: 'center' }}>
            <h1>Sign In</h1>
            <button onClick={handleGoogleSignIn} disabled={loading}>
                {loading ? 'Loading...' : 'Sign in with Google'}
            </button>
        </main>
    );
}