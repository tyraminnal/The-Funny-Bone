import { supabase } from './supabase';

export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) console.error('Sign in error:', error);
    return error;
}
