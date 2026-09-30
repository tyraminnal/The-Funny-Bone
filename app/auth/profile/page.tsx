'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Profile {
    first_name: string;
    last_name: string;
}

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<Profile>({
        first_name: '',
        last_name: '',
    });
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth');
                return;
            }
            setUser(user);

            // Fetch profile
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (data) {
                setProfile({
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                });
            }
            setLoading(false);
        };

        checkUser();
    }, []);

    const handleUpdateProfile = async () => {
        if (!user) return;

        const { error } = await supabase
            .from('profiles')
            .update({
                first_name: profile.first_name,
                last_name: profile.last_name,
            })
            .eq('id', user.id);

        if (!error) {
            alert('Profile updated!');
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
    };

    if (loading) return <p>Loading...</p>;
    if (!user) return <p>Not authenticated</p>;

    return (
        <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <h1>Profile</h1>
            <p>Email: {user.email}</p>

            <div style={{ marginTop: '2rem' }}>
                <h2>Edit Profile</h2>
                <input
                    type="text"
                    placeholder="First Name"
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem', width: '100%' }}
                />
                <input
                    type="text"
                    placeholder="Last Name"
                    value={profile.last_name}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    style={{ display: 'block', marginBottom: '1rem', padding: '0.5rem', width: '100%' }}
                />
                <button onClick={handleUpdateProfile} style={{ padding: '0.5rem 1rem' }}>
                    Save Profile
                </button>
            </div>

            <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', marginTop: '2rem' }}>
                Logout
            </button>
        </main>
    );
}