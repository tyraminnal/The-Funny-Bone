'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
}

export default function ProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const loadProfile = async () => {
            // Check authentication
            const { data: authData } = await supabase.auth.getSession();
            if (!authData.session) {
                router.push('/auth');
                return;
            }

            setUser(authData.session.user);

            // Load user profile
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.session.user.id)
                .single();

            if (data) {
                setProfile(data);
                setFirstName(data.first_name || '');
                setLastName(data.last_name || '');
            }
            setLoading(false);
        };

        loadProfile();
    }, [router]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        const { error } = await supabase
            .from('profiles')
            .update({
                first_name: firstName,
                last_name: lastName,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        if (error) {
            console.error('Error updating profile:', error);
        } else {
            alert('Profile updated successfully!');
        }
        setSaving(false);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
    };

    if (loading) return <p>Loading...</p>;

    return (
        <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <h1>Your Profile</h1>
            {user && <p>Email: {user.email}</p>}

            <div style={{ marginTop: '2rem' }}>
                <label>
                    First Name:
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        style={{ display: 'block', marginTop: '0.5rem', padding: '8px' }}
                    />
                </label>

                <label style={{ display: 'block', marginTop: '1rem' }}>
                    Last Name:
                    <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        style={{ display: 'block', marginTop: '0.5rem', padding: '8px' }}
                    />
                </label>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        marginTop: '1.5rem',
                        padding: '10px 20px',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.5 : 1,
                    }}
                >
                    {saving ? 'Saving...' : 'Save Profile'}
                </button>
            </div>

            <button
                onClick={handleSignOut}
                style={{
                    marginTop: '1rem',
                    marginLeft: '1rem',
                    padding: '10px 20px',
                    background: '#ff4444',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                }}
            >
                Sign Out
            </button>
        </main>
    );
}