'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface TVShow {
    id: number;
    title: string;
    genre: string;
    created_at: string;
}

export default function Home() {
    const [tvshows, setTVShows] = useState<TVShow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTVShows = async () => {
            const { data, error } = await supabase
                .from('tvshows')
                .select('*');

            if (error) {
                console.error('Error fetching TV shows:', error);
            } else {
                setTVShows(data || []);
            }
            setLoading(false);
        };

        fetchTVShows();
    }, []);

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