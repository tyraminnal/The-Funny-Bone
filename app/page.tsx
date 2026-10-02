'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileCheck } from '@/lib/useProfileCheck';

interface Profile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
}

export default function ProfilePage() {
    const router = useRouter();
    useProfileCheck();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadProfile = async () => {
            const { data: authData } = await supabase.auth.getSession();
            if (!authData.session) {
                router.push('/auth');
                return;
            }

            setUser(authData.session.user);

            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.session.user.id)
                .single();

            if (fetchError) {
                console.error('Error loading profile:', fetchError);
                setError('Failed to load profile');
            }

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
            const file = e.target.files[0];
            setAvatarFile(file);

            // Show preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadAvatar = async (): Promise<string | null> => {
        if (!avatarFile || !user) return avatarUrl;

        setUploading(true);
        setError('');
        try {
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            console.log('Starting avatar upload to:', filePath);

            const { error: uploadError } = await supabase.storage
                .from('profiles')
                .upload(filePath, avatarFile);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                setError(`Upload failed: ${uploadError.message}`);
                setUploading(false);
                return null;
            }

            const { data } = supabase.storage
                .from('profiles')
                .getPublicUrl(filePath);

            console.log('Avatar URL:', data.publicUrl);
            setUploading(false);
            return data.publicUrl;
        } catch (err: any) {
            console.error('Error uploading avatar:', err);
            setError(`Error: ${err.message}`);
            setUploading(false);
            return null;
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setError('');

        try {
            let newAvatarUrl = avatarUrl;
            if (avatarFile) {
                const uploadedUrl = await uploadAvatar();
                if (uploadedUrl) {
                    newAvatarUrl = uploadedUrl;
                } else if (!avatarUrl) {
                    // Upload failed and there's no existing avatar
                    setSaving(false);
                    return;
                }
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    first_name: firstName || null,
                    last_name: lastName || null,
                    avatar_url: newAvatarUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('Error updating profile:', updateError);
                setError('Error updating profile');
                setSaving(false);
                return;
            }

            setAvatarUrl(newAvatarUrl);
            setAvatarFile(null);
            setAvatarPreview('');
            alert('Profile updated successfully!');
        } catch (err: any) {
            console.error('Save error:', err);
            setError(`Error: ${err.message}`);
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
            <h1>Edit Profile</h1>
            {user && <p>Email: {user.email}</p>}

            {error && (
                <div style={{
                    color: 'red',
                    marginBottom: '1rem',
                    padding: '1rem',
                    backgroundColor: '#ffe0e0',
                    borderRadius: '4px'
                }}>
                    {error}
                </div>
            )}

            <div style={{ marginTop: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '1rem' }}>
                    First Name:
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        style={{ display: 'block', marginTop: '0.5rem', padding: '8px', width: '100%', boxSizing: 'border-box' }}
                    />
                </label>

                <label style={{ display: 'block', marginBottom: '1rem' }}>
                    Last Name:
                    <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        style={{ display: 'block', marginTop: '0.5rem', padding: '8px', width: '100%', boxSizing: 'border-box' }}
                    />
                </label>

                <label style={{ display: 'block', marginBottom: '1rem' }}>
                    Avatar:
                    {(avatarPreview || avatarUrl) && (
                        <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                            <img
                                src={avatarPreview || avatarUrl}
                                alt="Avatar"
                                style={{ maxWidth: '150px', borderRadius: '8px' }}
                            />
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        disabled={uploading}
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
                        backgroundColor: '#0066cc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        marginRight: '1rem'
                    }}
                >
                    {saving || uploading ? 'Saving...' : 'Save Profile'}
                </button>

                <button
                    onClick={handleSignOut}
                    style={{
                        marginTop: '1.5rem',
                        padding: '10px 20px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Sign Out
                </button>
            </div>
        </main>
    );
}