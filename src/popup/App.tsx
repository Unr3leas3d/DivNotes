import React, { useState, useEffect } from 'react';
import { LoginForm } from './LoginForm';
import { Dashboard } from './Dashboard';
import { resetFoldersService } from '@/lib/folders-service';
import { resetNotesService } from '@/lib/notes-service';
import { supabase } from '@/lib/supabase';
import { resetTagsService } from '@/lib/tags-service';
import { resolvePopupAuthStateChange, resolvePopupBootstrapState } from './auth-bootstrap';

type AuthMode = 'loading' | 'login' | 'local' | 'authenticated';

export default function App() {
    const [authMode, setAuthMode] = useState<AuthMode>('loading');
    const [userEmail, setUserEmail] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const authModeRef = React.useRef<AuthMode>('loading');
    const allowSessionPromotionRef = React.useRef(false);

    // Keep ref in sync with state
    useEffect(() => {
        authModeRef.current = authMode;
    }, [authMode]);

    useEffect(() => {
        async function bootstrapAuth() {
            setAuthMode('loading');
            const nextState = await resolvePopupBootstrapState({
                readStoredAuth: async () => new Promise<{ mode?: string } | undefined>((resolve, reject) => {
                    chrome.storage.local.get(['divnotes_auth'], (value) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                            return;
                        }
                        resolve(value.divnotes_auth);
                    });
                }),
                readSupabaseSession: async () => {
                    const { data: { session }, error } = await supabase.auth.getSession();
                    return { session, error };
                },
                persistAuthenticatedAuth: async (email) => {
                    await chrome.storage.local.set({
                        divnotes_auth: { mode: 'authenticated', email },
                    });
                },
            });

            setAuthError(nextState.error);
            setUserEmail(nextState.email);
            setAuthMode(nextState.mode);
        }

        void bootstrapAuth();

        // Listen for auth state changes (token refresh, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                const nextState = resolvePopupAuthStateChange({
                    currentMode: authModeRef.current,
                    sessionUser: session?.user ?? null,
                    canPromoteFromSession: allowSessionPromotionRef.current,
                });
                if (!nextState) {
                    return;
                }

                setAuthMode(nextState.mode);
                setUserEmail(nextState.email);
                if (nextState.mode === 'authenticated') {
                    allowSessionPromotionRef.current = false;
                }
                if (nextState.clearAuthError) {
                    setAuthError(null);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const handleLogin = (email: string) => {
        allowSessionPromotionRef.current = false;
        setAuthError(null);
        chrome.storage.local.set({ divnotes_auth: { mode: 'authenticated', email } });
        setUserEmail(email);
        setAuthMode('authenticated');
    };

    const handleUseLocally = () => {
        allowSessionPromotionRef.current = false;
        setAuthError(null);
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
            <div className="h-[500px] w-[380px] overflow-hidden bg-[#fcfbf7] text-[#173628]">
                <div className="flex h-full flex-col items-center justify-center gap-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d9e3dc] border-t-[#173628]" />
                    {authError ? (
                        <p className="max-w-[280px] text-center text-[12px] text-[#7b5f5f]">{authError}</p>
                    ) : null}
                </div>
            </div>
        );
    }

    const isLoggedIn = authMode === 'local' || authMode === 'authenticated';
    const displayEmail = authMode === 'local' ? 'Local Mode' : userEmail;

    return (
        <div className="relative h-[500px] w-[380px] overflow-hidden bg-[#fcfbf7] text-[#173628]">
            {authError && !isLoggedIn ? (
                <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 rounded-[12px] border border-[rgba(185,28,28,0.16)] bg-[rgba(254,242,242,0.96)] px-3 py-2 text-center text-[11px] text-[#b91c1c]">
                    {authError}
                </div>
            ) : null}
            {isLoggedIn ? (
                <Dashboard email={displayEmail} onLogout={handleLogout} isLocalMode={authMode === 'local'} />
            ) : (
                <LoginForm
                    onLogin={handleLogin}
                    onUseLocally={handleUseLocally}
                    onGoogleSessionPromotionChange={(allowed) => {
                        allowSessionPromotionRef.current = allowed;
                    }}
                />
            )}
        </div>
    );
}
