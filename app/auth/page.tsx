'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface TVShow {
    id: number;
    title: string;
    genre: string;
    created_at: string;
}

interface Profile {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
}

export default function Home() {
    const router = useRouter();
    const [tvshows, setTVShows] = useState<TVShow[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const checkAuthAndProfile = async () => {
            const { data } = await supabase.auth.getSession();

            if (!data.session) {
                router.push('/auth');
                return;
            }

            setIsLoggedIn(true);

            // Check if profile is complete
            const { data: profileData, error } = await supabase
                .from('profiles')
                .select('first_name, last_name, avatar_url')
                .eq('id', data.session.user.id)
                .single();

            if (profileData) {
                // Check if profile is incomplete (all fields are NULL)
                const isProfileIncomplete =
                    !profileData.first_name &&
                    !profileData.last_name &&
                    !profileData.avatar_url;

                if (isProfileIncomplete) {
                    router.push('/auth/setup');
                    return;
                }
            }

            // Fetch TV shows
            const { data: shows } = await supabase
                .from('tvshows')
                .select('*');

            setTVShows(shows || []);
            setLoading(false);
        };

        checkAuthAndProfile();
    }, [router]);

    if (!isLoggedIn) return <p>Redirecting...</p>;
    if (loading) return <p>Loading...</p>;

    return (
        <main style={{ padding: '2rem' }}>
            <h1>TV Shows from Supabase</h1>
            {tvshows.length === 0 ? (
                <p>No TV shows found.</p>
            ) : (
                <ul>
                    {tvshows.map((show) => (
                        <li key={show.id}>
                            <strong>{show.title}</strong> -