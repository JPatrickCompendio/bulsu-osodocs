import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

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
                setUser(prevUser => prevUser || { ...session.user, role: 'user' });

                if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
                    fetchProfile(session.user);
                }
            } else {
                setUser(null);
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
                setUser({
                    ...authUser,
                    ...profile,
                    role: profile.role || 'user'
                });
            } else {
                setUser({ ...authUser, role: 'user' });
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

            setUser({ ...data.user, ...profile, role: profile.role || 'user' });
            return { success: true };
        } catch (error) {
            console.error('Login error:', error.message);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
