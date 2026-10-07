'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRequireUser } from '@/lib/useRequireUser';
import Box from '../components/Box';
import Shell from '../components/Shell';

interface TVShow {
    id: number;
    title: string;
    genre: string;
    created_at: string;
}

export default function ShowsPage() {
    const user = useRequireUser();
    const [tvshows, setTVShows] = useState<TVShow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        supabase.from('tvshows').select('*').then(({ data }) => {
            setTVShows(data || []);
            setLoading(false);
        });
    }, [user]);

    if (!user) return <p className="p-8">Redirecting...</p>;

    return (
        <Shell>
            <Box title="TV Shows from Supabase">
                {loading ? (
                    <p>Loading...</p>
                ) : tvshows.length === 0 ? (
                    <p>No TV shows found.</p>
                ) : (
                    <table className="ms-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Genre</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tvshows.map((show) => (
                                <tr key={show.id}>
                                    <td>{show.title}</td>
                                    <td>{show.genre}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Box>
        </Shell>
    );
}
