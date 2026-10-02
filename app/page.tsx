'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useProfileCheck } from '@/lib/useProfileCheck';

interface TVShow {
    id: number;
    title: string;
    genre: string;
    created_at: string;
}

export default function Home() {
    const router = useRouter();
    useProfileCheck();

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>TV Shows from Supabase</h1>
                <Link href="/profile" style={{ padding: '10px 20px', background: '#007bff', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                    Edit Profile
                </Link>
            </div>

            {tvshows.length === 0 ? (
                <p>No TV shows found.</p>
            ) : (
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #ccc' }}>Title</th>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #ccc' }}>Genre</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tvshows.map((show) => (
                            <tr key={show.id}>
                                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{show.title}</td>
                                <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{show.genre}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </main>
    );
}