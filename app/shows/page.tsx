'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRequireUser } from '@/lib/useRequireUser';
import Nav from '../components/Nav';

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
        <>
            <Nav />
            <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
                <h1 className="mb-4 text-2xl font-bold">TV Shows from Supabase</h1>
                {loading ? (
                    <p>Loading...</p>
                ) : tvshows.length === 0 ? (
                    <p>No TV shows found.</p>
                ) : (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="border-b-2 border-line p-2 text-left">Title</th>
                                <th className="border-b-2 border-line p-2 text-left">Genre</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tvshows.map((show) => (
                                <tr key={show.id}>
                                    <td className="border-b border-line p-2">{show.title}</td>
                                    <td className="border-b border-line p-2">{show.genre}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </main>
        </>
    );
}
