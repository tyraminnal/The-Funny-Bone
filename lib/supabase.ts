import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

// Helper function to check if user is logged in
export const getSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    return data.session;
};

// Helper function to get current user
export const getCurrentUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    return data.user;
};

// Helper function to sign out
export const signOut = async () => {
    await supabase.auth.signOut();
};