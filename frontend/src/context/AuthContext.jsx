import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // Start as true to avoid layout flicker

    useEffect(() => {
        // Patient timeout: If auth doesn't resolve in 6 seconds, force hide loading
        const timer = setTimeout(() => {
            if (loading) {
                console.warn('Auth check reached threshold - proceeding with caution');
                setLoading(false);
            }
        }, 6000);

        const initializeAuth = async () => {
            try {
                // Get the current session
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session) {
                    // Start fetching profile but don't block the UI if it's slow
                    fetchProfile(session.user);
                } else {
                    setLoading(false);
                }
            } catch (err) {
                console.error('Initial session fetch failed:', err);
                setLoading(false);
            } finally {
                clearTimeout(timer);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Supabase Auth Event:', event);
            try {
                if (session) {
                    // Set basic user info immediately
                    setUser(prevUser => prevUser || { ...session.user, role: 'user' });
                    
                    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
                        fetchProfile(session.user);
                    }
                } else {
                    setUser(null);
                }
            } finally {
                setLoading(false);
                clearTimeout(timer);
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
            if (!response.ok) throw new Error('Profile fetch failed');
            
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
            console.warn('Profile fetch background error:', error.message);
            setUser(prev => prev || { ...authUser, role: 'user' });
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
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
        }
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
            setUser(null);
        } catch (err) {
            console.error('Logout error:', err);
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
