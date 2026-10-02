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

export default function SetupPage() {
    const router = useRouter();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkAuth = async () => {
            const { data: authData } = await supabase.auth.getSession();
            if (!authData.session) {
                router.push('/auth');
                return;
            }
            setUser(authData.session.user);
            setLoading(false);
        };

        checkAuth();
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
        if (!avatarFile || !user) return null;

        setUploading(true);
        setError('');
        try {
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            console.log('Starting upload to:', filePath);

            const { data, error: uploadError } = await supabase.storage
                .from('profiles')
                .upload(filePath, avatarFile);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                setError(`Upload failed: ${uploadError.message}`);
                setUploading(false);
                return null;
            }

            console.log('Upload successful:', data);

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('profiles')
                .getPublicUrl(filePath);

            console.log('Public URL:', urlData.publicUrl);
            setUploading(false);
            return urlData.publicUrl;
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
            let avatarUrl = null;
            if (avatarFile) {
                avatarUrl = await uploadAvatar();
                if (!avatarUrl && avatarFile) {
                    setSaving(false);
                    return; // Upload failed, don't save profile
                }
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    first_name: firstName || null,
                    last_name: lastName || null,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('Error updating profile:', updateError);
                setError('Error saving profile');
                setSaving(false);
                return;
            }

            console.log('Profile saved successfully');
            router.push('/');
        } catch (err: any) {
            console.error('Save error:', err);
            setError(`Error: ${err.message}`);
            setSaving(false);
        }
    };

    if (loading) return <p>Loading...</p>;

    return (
        <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
            <h1>Complete Your Profile</h1>
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
                    Avatar (Optional):
                    {avatarPreview && (
                        <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                            <img
                                src={avatarPreview}
                                alt="Avatar preview"
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
                        borderRadius: '4px'
                    }}
                >
                    {saving || uploading ? 'Saving...' : 'Continue'}
                </button>
            </div>
        </main>
    );
}