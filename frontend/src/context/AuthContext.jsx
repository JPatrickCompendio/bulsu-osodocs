import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Only run the threshold check on the INITIAL mount
        let isInitialLoad = true;
        const timer = setTimeout(() => {
            if (isInitialLoad && loading) {
                console.warn('Auth check reached threshold - proceeding with caution');
                setLoading(false);
            }
        }, 8000); // Give it a generous 8 seconds for slow connections

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
                // Set basic user info so UI can render
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
            const response = await fetch(`http://localhost:5000/api/auth/profile?id=${authUser.id}`);
            const data = await response.json();

            if (data.success && data.profile) {
                setUser({
                    ...authUser,
                    ...data.profile,
                    role: data.profile.role || 'user'
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
        setLoading(true); // Show loading during manual login
        try {
            const response = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Login failed');

            if (data.session) {
                await supabase.auth.setSession({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token
                });
            }

            setUser({ ...data.user, role: data.user.role || 'user' });
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
