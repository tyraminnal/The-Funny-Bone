'use client';

import { useEffect, useState } from 'react';
import { MEME_TEMPLATES, type MemeTemplate } from '@/lib/memeTemplates';
import { supabase } from '@/lib/supabase';

// Pics an admin marked as suggested in Funny Bone HQ. Their ids start with "img-".
const LIBRARY_PREFIX = 'img-';

const MAX_DIMENSION = 1280;
const SUGGESTIONS_SHOWN = 8;

// Shrinks the photo in the browser so uploads stay small and fast.
function resizeImage(file: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))), 'image/jpeg', 0.85);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('unreadable image'));
        };
        img.src = url;
    });
}

// Upload a photo or pick a suggested classic meme template. Hands back the resized JPEG.
export default function PicPicker({ disabled, onImage, onError }: {
    disabled: boolean;
    onImage: (image: Blob) => void;
    onError: (message: string) => void;
}) {
    const [preview, setPreview] = useState('');
    const [suggestionPage, setSuggestionPage] = useState(0);
    const [pickedTemplate, setPickedTemplate] = useState<string | null>(null);
    const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
    const [libraryPics, setLibraryPics] = useState<MemeTemplate[]>([]);

    const allSuggestions = [...libraryPics, ...MEME_TEMPLATES];
    const suggestionPages = Math.ceil(allSuggestions.length / SUGGESTIONS_SHOWN);
    const suggestions = allSuggestions.slice(suggestionPage * SUGGESTIONS_SHOWN, (suggestionPage + 1) * SUGGESTIONS_SHOWN);

    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    useEffect(() => {
        supabase
            .from('images')
            .select('id, url, description')
            .eq('is_suggested', true)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                setLibraryPics((data ?? []).map((img) => ({
                    id: `${LIBRARY_PREFIX}${img.id}`,
                    name: img.description || 'Suggested pic',
                    url: img.url,
                    hint: img.description ?? '',
                })));
            });
    }, []);

    const showPhoto = async (file: Blob) => {
        const resized = await resizeImage(file);
        onImage(resized);
        setPreview(URL.createObjectURL(resized));
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        onError('');
        setPickedTemplate(null);
        try {
            await showPhoto(file);
        } catch {
            onError('Couldn’t read that photo. Try a JPEG or PNG.');
        }
    };

    // Classic templates come through our own /api/template-image so the canvas resize works.
    // Library pics live in our Supabase bucket, which already allows cross-origin reads.
    const pickTemplate = async (template: MemeTemplate) => {
        onError('');
        setLoadingTemplate(template.id);
        try {
            const response = await fetch(
                template.id.startsWith(LIBRARY_PREFIX) ? template.url : `/api/template-image?id=${encodeURIComponent(template.id)}`
            );
            if (!response.ok) throw new Error('template fetch failed');
            await showPhoto(await response.blob());
            setPickedTemplate(template.id);
        } catch {
            onError('Couldn’t load that pic. Try another one or upload your own.');
        } finally {
            setLoadingTemplate(null);
        }
    };

    return (
        <>
            <label className="ms-dropzone">
                {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Your pic" />
                ) : (
                    <span className="p-6">
                        <span className="block text-3xl">📸</span>
                        <b>Click here to pick a pic</b>
                        <span className="ms-muted block">JPEG, PNG, or WebP</span>
                    </span>
                )}
                <input type="file" accept="image/*" onChange={handleFile} disabled={disabled} className="hidden" />
            </label>

            <div className="mt-3">
                <p className="font-bold">
                    No pic? Pick a classic:
                    {suggestionPages > 1 && (
                        <button
                            type="button"
                            className="ml-2 font-normal text-[var(--link)] hover:underline"
                            onClick={() => setSuggestionPage((p) => (p + 1) % suggestionPages)}
                            disabled={disabled}
                        >
                            show more »
                        </button>
                    )}
                </p>
                <ul className="ms-suggest">
                    {suggestions.map((template) => (
                        <li key={template.id}>
                            <button
                                type="button"
                                onClick={() => pickTemplate(template)}
                                disabled={disabled || loadingTemplate !== null}
                                aria-pressed={pickedTemplate === template.id}
                                title={`${template.name}: ${template.hint}`}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={template.url} alt="" loading="lazy" />
                                <span>{loadingTemplate === template.id ? 'Loading...' : template.name}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
}
