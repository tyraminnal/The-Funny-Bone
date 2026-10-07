'use client';

import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfileCheck } from '@/lib/useProfileCheck';
import Box from '../components/Box';
import Shell from '../components/Shell';

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
            router.push('/');
            return;
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
        <Shell>
            <Box title="Edit Profile" className="mx-auto max-w-[560px]">
                {user && <p className="ms-muted mb-3">Signed in as {user.email}</p>}
                {error && <p className="ms-error">{error}</p>}

                <div className="flex flex-wrap gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarPreview || avatarUrl || '/file.svg'} alt="Avatar" className="ms-avatar" />
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
                        Change Default Pic:
                        <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={uploading} className="mt-1 block font-normal" />
                    </label>
                    </div>
                </div>

                <p className="mt-2 flex justify-center gap-2">
                    <button onClick={handleSave} disabled={saving || uploading} className="ms-button ms-button-big">
                        {saving || uploading ? 'Saving...' : 'Save Profile'}
                    </button>
                    <button onClick={handleSignOut} className="ms-button ms-button-big">Sign Out</button>
                </p>
            </Box>
        </Shell>
    );
}
