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
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const loadProfile = async () => {
            const { data: authData } = await supabase.auth.getSession();
            if (!authData.session) {
                router.push('/auth');
                return;
            }

            setUser(authData.session.user);

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.session.user.id)
                .single();

            if (data) {
                setProfile(data);
                setFirstName(data.first_name || '');
                setLastName(data.last_name || '');
                setAvatarUrl(data.avatar_url || '');
            }
            setLoading(false);
        };

        loadProfile();
    }, [router]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAvatarFile(e.target.files[0]);
        }
    };

    const uploadAvatar = async (): Promise<string | null> => {
        if (!avatarFile || !user) return avatarUrl;

        setUploading(true);
        try {
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('profiles')
                .upload(filePath, avatarFile);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                setUploading(false);
                return null;
            }

            const { data } = supabase.storage.from('profiles').getPublicUrl(filePath);
            setUploading(false);
            return data.publicUrl;
        } catch (error) {
            console.error('Error uploading avatar:', error);
            setUploading(false);
            return null;
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        let newAvatarUrl = avatarUrl;
        if (avatarFile) {
            const uploadedUrl = await uploadAvatar();
            if (uploadedUrl) {
                newAvatarUrl = uploadedUrl;
            }
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                first_name: firstName,
                last_name: lastName,
                avatar_url: newAvatarUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        if (error) {
            console.error('Error updating profile:', error);
            alert('Error updating profile');
        } else {
            alert('Profile updated successfully!');
            setAvatarUrl(newAvatarUrl);
            setAvatarFile(null);
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

                <label style={{ display: 'block', marginTop: '1rem' }}>
                    Avatar:
                    {avatarUrl && (
                        <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                            <img
                                src={avatarUrl}
                                alt="Avatar"
                                style={{ maxWidth: '150px', borderRadius: '8px' }}
                            />
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        style={{ display: 'block', marginTop: '0.5rem' }}
                    />
                </label>

                <button
                    onClick={handleSave}
                    disabled={saving || uploading}
                    style={{
                        marginTop: '1.5rem',
                        padding: '10px 20px',
                        cursor: saving || uploading ? 'not-allowed' : 'pointer',
                        opacity: saving || uploading ? 0.5 : 1,
                    }}
                >
                    {saving || uploading ? 'Saving...' : 'Save Profile'}
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