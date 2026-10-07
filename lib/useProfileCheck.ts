import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from './supabase';

export function useProfileCheck() {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkProfile = async () => {
            // Skip check on auth pages
            if (pathname?.startsWith('/auth')) {
                return;
            }

            const { data } = await supabase.auth.getSession();

            if (!data.session) {
                // The home page has its own logged-out view.
                if (pathname !== '/') router.push('/auth');
                return;
            }

            // Check profile completion
            const { data: profileData } = await supabase
                .from('profiles')
                .select('first_name, last_name, avatar_url')
                .eq('id', data.session.user.id)
                .single();

            if (profileData) {
                const isProfileIncomplete =
                    !profileData.first_name &&
                    !profileData.last_name &&
                    !profileData.avatar_url;

                if (isProfileIncomplete && pathname !== '/auth/setup') {
                    router.push('/auth/setup');
                }
            }
        };

        checkProfile();
    }, [pathname, router]);
}