import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const Avatar = ({ profileImage, name, className = '', fallbackClassName = '' }) => {
    const [avatarUrl, setAvatarUrl] = useState(null);

    useEffect(() => {
        let isMounted = true;
        let objectUrl = null;

        const loadAvatar = async () => {
            if (!profileImage) return;
            
            try {
                const { data: blob, error } = await supabase.storage
                    .from('profile_img')
                    .download(profileImage);
                    
                if (error) throw error;
                
                if (blob && isMounted) {
                    objectUrl = URL.createObjectURL(blob);
                    setAvatarUrl(objectUrl);
                }
            } catch (err) {
                // Silently fail to fallback if image missing/restricted
            }
        };

        loadAvatar();

        return () => {
            isMounted = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [profileImage]);

    if (avatarUrl) {
        return (
            <img 
                src={avatarUrl} 
                alt={name || 'Avatar'} 
                className={`object-cover ${className}`} 
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
