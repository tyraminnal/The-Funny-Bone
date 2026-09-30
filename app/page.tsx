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

export default function Home() {
    const router = useRouter();
    const [tvshows, setTVShows] = useState<TVShow[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();

            if (!data.session) {
                router.push('/auth');
                return;
            }

            setIsLoggedIn(true);

            // Fetch TV shows
            const { data: shows } = await supabase
                .from('tvshows')
                .select('*');

            setTVShows(shows || []);
            setLoading(false);
        };

        checkAuth();
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
                            <strong>{show.title}</strong> - {show.genre}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}