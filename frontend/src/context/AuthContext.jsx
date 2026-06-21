import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Cleanup object URL on unmount or when avatarUrl changes
    useEffect(() => {
        return () => {
            if (user?.avatarUrl) {
                URL.revokeObjectURL(user.avatarUrl);
            }
        };
    }, [user?.avatarUrl]);

    useEffect(() => {
        let isInitialLoad = true;
        const timer = setTimeout(() => {
            if (isInitialLoad && loading) {
                console.warn('Auth check reached threshold - proceeding with caution');
                setLoading(false);
            }
        }, 8000);

        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    await fetchProfile(session.user);
                }
            } catch (err) {
                console.error('Initial session fetch failed:', err);
            } finally {
                isInitialLoad = false;
                setLoading(false);
                clearTimeout(timer);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                setUser(prevUser => {
                    if (prevUser?.avatarUrl) URL.revokeObjectURL(prevUser.avatarUrl);
                    return prevUser || { ...session.user, role: 'user' };
                });

                if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                    fetchProfile(session.user);
                }
            } else {
                setUser(prevUser => {
                    if (prevUser?.avatarUrl) URL.revokeObjectURL(prevUser.avatarUrl);
                    return null;
                });
                setLoading(false);
            }
        });

        return () => {
            if (subscription) subscription.unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    const fetchProfile = async (authUser) => {
        try {
            const { data: profile, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();

            if (!error && profile) {
                let avatarUrl = null;
                if (profile.profile_image) {
                    try {
                        const { data: blob } = await supabase.storage
                            .from('profile_img')
                            .download(profile.profile_image);
                        if (blob) {
                            avatarUrl = URL.createObjectURL(blob);
                        }
                    } catch (e) {
                        console.error('Failed to download profile image:', e);
                    }
                }
                setUser((prev) => {
                    if (prev?.avatarUrl && prev.avatarUrl !== avatarUrl) {
                        URL.revokeObjectURL(prev.avatarUrl);
                    }
                    return {
                        ...prev,
                        ...authUser,
                        ...profile,
                        role: profile.role || 'user',
                        avatarUrl
                    };
                });
            } else {
                setUser((prev) => {
                    if (prev?.avatarUrl) URL.revokeObjectURL(prev.avatarUrl);
                    return { ...authUser, role: 'user' };
                });
            }
        } catch (error) {
            console.warn('Profile fetch background sync:', error.message);
            setUser(prev => prev || { ...authUser, role: 'user' });
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw new Error(error.message);

            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError) throw new Error(profileError.message);

            let avatarUrl = null;
            if (profile.profile_image) {
                try {
                    const { data: blob } = await supabase.storage
                        .from('profile_img')
                        .download(profile.profile_image);
                    if (blob) {
                        avatarUrl = URL.createObjectURL(blob);
                    }
                } catch (e) {
                    console.error('Failed to download profile image:', e);
                }
            }

            setUser((prev) => {
                if (prev?.avatarUrl && prev.avatarUrl !== avatarUrl) {
                    URL.revokeObjectURL(prev.avatarUrl);
                }
                return { ...data.user, ...profile, role: profile.role || 'user', avatarUrl };
            });
            return { success: true };
        } catch (error) {
            console.error('Login error:', error.message);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        if (user?.avatarUrl) {
            URL.revokeObjectURL(user.avatarUrl);
        }
        await supabase.auth.signOut();
        setUser(null);
    };

    const refreshUser = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                await fetchProfile(session.user);
            }
        } catch (err) {
            console.error('Failed to refresh user profile:', err);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
