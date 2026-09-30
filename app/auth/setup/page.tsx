'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
    const router = useRouter();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                router.push('/auth');
                return;
            }

            // Load existing profile data if any
            const { data: profileData } = await supabase
                .from('profiles')
                .select('first_name, last_name, avatar_url')
                .eq('id', data.session.user.id)
                .single();

            if (profileData) {
                setFirstName(profileData.first_name || '');
                setLastName(profileData.last_name || '');
            }

            setUser(data.session.user);
            setLoading(false);
        };
        checkAuth();
    }, [router]);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAvatarFile(e.target.files[0]);
        }
    };

    const uploadAvatar = async (): Promise<string | null> => {
        if (!avatarFile || !user) return null;

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

    const handleComplete = async () => {
        if (!user) return;
        setSaving(true);

        let avatarUrl = null;
        if (avatarFile) {
            avatarUrl = await uploadAvatar();
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                first_name: firstName || null,
                last_name: lastName || null,
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);

        if (error) {
            console.error('Error updating profile:', error);
            alert('Error saving profile');
            setSaving(false);
        } else {
            router.push('/');
        }
    };

    if (loading) return <p>Loading...</p>;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
        >
            <div
                style={{
                    background: 'white',
                    borderRadius: '8px',
                    padding: '2rem',
                    maxWidth: '500px',
                    width: '90%',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
            >
                <h2>Complete Your Profile</h2>
                <p>Let's set up your profile to get started.</p>

                <div style={{ marginTop: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '1rem' }}>
                        First Name (optional):
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            style={{
                                display: 'block',
                                marginTop: '0.5rem',
                                padding: '8px',
                                width: '100%',
                                boxSizing: 'border-box',
                            }}
                        />
                    </label>

                    <label style={{ display: 'block', marginBottom: '1rem' }}>
                        Last Name (optional):
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            style={{
                                display: 'block',
                                marginTop: '0.5rem',
                                padding: '8px',
                                width: '100%',
                                boxSizing: 'border-box',
                            }}
                        />
                    </label>

                    <label style={{ display: 'block', marginBottom: '1rem' }}>
                        Profile Picture (optional):
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            style={{ display: 'block', marginTop: '0.5rem' }}
                        />
                    </label>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={handleComplete}
                        disabled={saving || uploading}
                        style={{
                            flex: 1,
                            padding: '10px',
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: saving || uploading ? 'not-allowed' : 'pointer',
                            opacity: saving || uploading ? 0.5 : 1,
                        }}
                    >
                        {saving || uploading ? 'Saving...' : 'Complete'}
                    </button>
                </div>
            </div>
        </div>
    );
}