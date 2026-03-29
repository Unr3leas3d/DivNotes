import React, { useState, useEffect } from 'react';
import { LoginForm } from './LoginForm';
import { Dashboard } from './Dashboard';
import { resetFoldersService } from '@/lib/folders-service';
import { resetNotesService } from '@/lib/notes-service';
import { supabase } from '@/lib/supabase';
import { resetTagsService } from '@/lib/tags-service';

type AuthMode = 'loading' | 'login' | 'local' | 'authenticated';

export default function App() {
    const [authMode, setAuthMode] = useState<AuthMode>('loading');
    const [userEmail, setUserEmail] = useState('');
    const authModeRef = React.useRef<AuthMode>('loading');

    // Keep ref in sync with state
    useEffect(() => {
        authModeRef.current = authMode;
    }, [authMode]);

    useEffect(() => {
        // Check for local mode first, then Supabase session
        chrome.storage.local.get(['divnotes_auth'], async (result) => {
            if (result.divnotes_auth?.mode === 'local') {
                setAuthMode('local');
                return;
            }

            // Check Supabase session
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserEmail(session.user.email || '');
                setAuthMode('authenticated');
                chrome.storage.local.set({
                    divnotes_auth: { mode: 'authenticated', email: session.user.email },
                });
            } else {
                setAuthMode('login');
            }
        });

        // Listen for auth state changes (token refresh, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (session?.user) {
                    setUserEmail(session.user.email || '');
                    setAuthMode('authenticated');
                } else if (authModeRef.current === 'authenticated') {
                    // Only drop to login if we were previously authenticated and lost the session
                    setAuthMode('login');
                    setUserEmail('');
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const handleLogin = (email: string) => {
        chrome.storage.local.set({ divnotes_auth: { mode: 'authenticated', email } });
        setUserEmail(email);
        setAuthMode('authenticated');
    };

    const handleUseLocally = () => {
        chrome.storage.local.set({ divnotes_auth: { mode: 'local' } });
        setAuthMode('local');
    };

    const handleLogout = async () => {
        if (authMode === 'authenticated') {
            await supabase.auth.signOut();
        }
        await chrome.storage.local.remove('divnotes_auth');
        resetNotesService();
        resetFoldersService();
        resetTagsService();
        setAuthMode('login');
        setUserEmail('');
    };

    if (authMode === 'loading') {
        return (
            <div className="flex min-h-[500px] w-[380px] items-center justify-center bg-[#fcfbf7] text-[#173628]">
                <div className="h-6 w-6 rounded-full border-2 border-[#d9e3dc] border-t-[#173628] animate-spin" />
            </div>
        );
    }

    const isLoggedIn = authMode === 'local' || authMode === 'authenticated';
    const displayEmail = authMode === 'local' ? 'Local Mode' : userEmail;

    return (
        <div className="w-[380px] min-h-[500px] bg-[#fcfbf7] text-[#173628]">
            {isLoggedIn ? (
                <Dashboard email={displayEmail} onLogout={handleLogout} isLocalMode={authMode === 'local'} />
            ) : (
                <LoginForm onLogin={handleLogin} onUseLocally={handleUseLocally} />
            )}
        </div>
    );
}
