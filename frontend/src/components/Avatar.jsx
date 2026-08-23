import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const Avatar = ({ profileImage, name, className = '', fallbackClassName = '' }) => {
    const [hasError, setHasError] = useState(false);

    if (profileImage && !hasError) {
        let imageUrl = profileImage;
        if (!profileImage.startsWith('http')) {
            const { data } = supabase.storage.from('profile_img').getPublicUrl(profileImage);
            imageUrl = data?.publicUrl;
        }

        if (imageUrl) {
            return (
                <img 
                    src={imageUrl} 
                    alt={name || 'Avatar'} 
                    className={`object-cover ${className}`} 
                    onError={() => setHasError(true)}
                />
            );
        }
    }

    return (
        <div className={`flex items-center justify-center font-bold ${className} ${fallbackClassName}`}>
            {name?.charAt(0).toUpperCase() || '?'}
        </div>
    );
};

export default Avatar;
