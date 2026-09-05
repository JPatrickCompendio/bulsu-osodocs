import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeMember, setActiveMemberState] = useState(() => {
        try {
            const saved = sessionStorage.getItem('osodocs_active_member');
            return saved ? JSON.parse(saved) : null;
        } catch (_) {
            return null;
        }
    });

    const setActiveMember = (member) => {
        setActiveMemberState(member);
        if (member) {
            try {
                sessionStorage.setItem('osodocs_active_member', JSON.stringify(member));
            } catch (_) {}
        } else {
            sessionStorage.removeItem('osodocs_active_member');
        }
    };

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

    useEffect(() => {
        if (!user?.id) return;

        // 1. Supabase Realtime Postgres Changes
        const postgresChannel = supabase
            .channel(`user-profile-postgres-${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'users',
                    filter: `id=eq.${user.id}`,
                },
                (payload) => {
                    if (payload?.new) {
                        setUser((prev) => {
                            if (!prev) return null;
                            return {
                                ...prev,
                                ...payload.new,
                                role: payload.new.role || prev.role || 'user',
                            };
                        });
                    }
                }
            )
            .subscribe();

        // 2. Supabase Realtime Broadcast Channel
        const broadcastChannel = supabase
            .channel(`user-status-broadcast-${user.id}`)
            .on('broadcast', { event: 'status-changed' }, (payload) => {
                if (payload?.payload?.status) {
                    setUser((prev) => (prev ? { ...prev, status: payload.payload.status } : null));
                }
            })
            .subscribe();

        // 3. Browser BroadcastChannel (for same browser multi-tab testing)
        let bc = null;
        try {
            bc = new BroadcastChannel(`user-status-${user.id}`);
            bc.onmessage = (event) => {
                if (event.data?.status) {
                    setUser((prev) => (prev ? { ...prev, status: event.data.status } : null));
                }
            };
        } catch (e) {
            // BroadcastChannel fallback
        }

        // 4. Lightweight polling sync fallback (every 3 seconds)
        const pollInterval = setInterval(async () => {
            try {
                const { data: latest } = await supabase
                    .from('users')
                    .select('status')
                    .eq('id', user.id)
                    .maybeSingle();

                if (latest && latest.status !== user.status) {
                    setUser((prev) => (prev ? { ...prev, status: latest.status } : null));
                }
            } catch (err) {
                // Silent catch
            }
        }, 3000);

        return () => {
            supabase.removeChannel(postgresChannel);
            supabase.removeChannel(broadcastChannel);
            if (bc) bc.close();
            clearInterval(pollInterval);
        };
    }, [user?.id, user?.status]);

    const resolveAvatarUrl = async (imagePath) => {
        if (!imagePath) return null;
        if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
            return imagePath;
        }
        const cleanPath = imagePath.replace(/^(profile_img\/|profile_image\/|avatars\/)/, '');
        try {
            const { data: signedData } = await supabase.storage
                .from('profile_img')
                .createSignedUrl(cleanPath, 86400);

            if (signedData?.signedUrl) {
                return `${signedData.signedUrl}&t=${Date.now()}`;
            }
        } catch (err) {
            console.warn('Signed avatar fetch error:', err);
        }

        const { data: pubData } = supabase.storage.from('profile_img').getPublicUrl(cleanPath);
        return pubData?.publicUrl ? `${pubData.publicUrl}?t=${Date.now()}` : null;
    };

    const fetchProfile = async (authUser) => {
        try {
            const { data: profile, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();

            if (!error && profile) {
                const avatarUrl = await resolveAvatarUrl(profile.profile_image);
                setUser((prev) => {
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

            const avatarUrl = await resolveAvatarUrl(profile.profile_image);

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
        try {
            sessionStorage.removeItem('osodocs_active_member');
        } catch (_) {}
        setActiveMemberState(null);
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
        <AuthContext.Provider value={{ user, login, logout, loading, refreshUser, activeMember, setActiveMember }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
