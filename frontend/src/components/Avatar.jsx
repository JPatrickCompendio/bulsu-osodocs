import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const Avatar = ({ profileImage, profileImg, name, className = '', fallbackClassName = '' }) => {
    const [resolvedUrl, setResolvedUrl] = useState(null);
    const [hasError, setHasError] = useState(false);
    const rawImage = profileImage || profileImg;

    useEffect(() => {
        let isMounted = true;
        setHasError(false);

        if (!rawImage) {
            setResolvedUrl(null);
            return;
        }

        if (typeof rawImage === 'string' && (rawImage.startsWith('http') || rawImage.startsWith('https') || rawImage.startsWith('data:') || rawImage.startsWith('blob:'))) {
            setResolvedUrl(rawImage);
            return;
        }

        const cleanPath = String(rawImage).replace(/^(profile_img\/|profile_image\/|avatars\/)/, '');

        const fetchUrl = async () => {
            try {
                const { data: signedData } = await supabase.storage
                    .from('profile_img')
                    .createSignedUrl(cleanPath, 86400);

                if (signedData?.signedUrl && isMounted) {
                    setResolvedUrl(`${signedData.signedUrl}&t=${Date.now()}`);
                    return;
                }
            } catch (e) {
                console.warn('Signed avatar fetch error:', e);
            }

            const { data } = supabase.storage.from('profile_img').getPublicUrl(cleanPath);
            if (data?.publicUrl && isMounted) {
                setResolvedUrl(`${data.publicUrl}?t=${Date.now()}`);
            }
        };

        fetchUrl();

        return () => {
            isMounted = false;
        };
    }, [rawImage]);

    if (resolvedUrl && !hasError) {
        return (
            <img 
                src={resolvedUrl} 
                alt={name || 'Avatar'} 
                className={`object-cover ${className}`} 
                onError={() => setHasError(true)}
            />
        );
    }

    return (
        <div className={`flex items-center justify-center font-bold ${className} ${fallbackClassName}`}>
            {name?.charAt(0).toUpperCase() || '?'}
        </div>
    );
};

export default Avatar;
