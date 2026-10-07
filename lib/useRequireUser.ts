import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Redirects to /auth when nobody is signed in. Returns the user once known.
export function useRequireUser() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (!data.session) {
                router.push('/auth');
                return;
            }
            setUser(data.session.user);
        });
    }, [router]);

    return user;
}
