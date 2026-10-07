'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '../../components/Box';
import Shell from '../../components/Shell';

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
        <Shell signedIn={false}>
            <Box title="Complete Your Profile" className="mx-auto max-w-[560px]">
                <p className="mb-3">Welcome! Pick a name and a pic so people know who’s posting.</p>
                {user && <p className="ms-muted mb-3">Signed in as {user.email}</p>}
                {error && <p className="ms-error">{error}</p>}

                <div className="flex flex-wrap gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarPreview || '/file.svg'} alt="Avatar preview" className="ms-avatar" />
                    <div className="min-w-[220px] flex-1">
                    <label className="mb-3 block font-bold">
                        First Name:
                        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="ms-input mt-1 font-normal" />
                    </label>

                    <label className="mb-3 block font-bold">
                        Last Name:
                        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="ms-input mt-1 font-normal" />
                    </label>

                    <label className="mb-3 block font-bold">
                        Default Pic (optional):
                        <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploading} className="mt-1 block font-normal" />
                    </label>
                    </div>
                </div>

                <p className="mt-2 text-center">
                    <button onClick={handleSave} disabled={saving || uploading} className="ms-button ms-button-big">
                        {saving || uploading ? 'Saving...' : 'Continue »'}
                    </button>
                </p>
            </Box>
        </Shell>
    );
}
