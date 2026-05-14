import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // FAIL-SAFE: If auth doesn't resolve in 3 seconds, force hide loading
        const timer = setTimeout(() => {
            console.warn('Auth check timed out - forcing loading to false');
            setLoading(false);
        }, 3000);

        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    await fetchProfile(session.user);
                }
            } catch (err) {
                console.error('Initial session fetch failed:', err);
            } finally {
                setLoading(false);
                clearTimeout(timer);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Supabase Auth Event:', event);
            try {
                if (session) {
                    // Set a basic user state immediately so the UI can proceed
                    setUser(prevUser => prevUser || { ...session.user, role: 'user' });
                    
                    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
                        // DON'T await this, let it happen in background
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
            subscription.unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    const fetchProfile = async (authUser) => {
        console.log('Fetching profile via Backend for ID:', authUser.id);
        try {
            const response = await fetch(`http://localhost:5000/api/auth/profile?id=${authUser.id}`);
            const data = await response.json();

            if (data.success && data.profile) {
                console.log('Profile found via Backend:', data.profile);
                setUser({
                    ...authUser,
                    ...data.profile,
                    role: data.profile.role || 'user'
                });
            } else {
                console.warn('No profile found via Backend.');
                setUser({ ...authUser, role: 'user' });
            }
        } catch (error) {
            console.error('Error fetching profile via Backend:', error);
            setUser({ ...authUser, role: 'user' });
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
                // Set the session in the background
                supabase.auth.setSession({
                    access_token: data.session.access_token,
                    refresh_token: data.session.refresh_token
                });
            }

            // IMPORTANT: Set the user state manually so navigate('/') works immediately
            setUser({ ...data.user, role: data.user.role || 'user' });

            return { success: true };
        } catch (error) {
            console.error('Login error:', error.message);
            return { success: false, error: error.message };
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
