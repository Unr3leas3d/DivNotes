import React, { useState, useEffect } from 'react';
import { LoginForm } from './LoginForm';
import { Dashboard } from './Dashboard';
import {
    buildStoredAccountState,
    type ProfileRecord,
    type StoredAccountState,
    writeStoredAccountState,
    clearStoredAccountState,
} from '@/lib/account-state';
import { resetFoldersService } from '@/lib/folders-service';
import { resetNotesService } from '@/lib/notes-service';
import { supabase } from '@/lib/supabase';
import { resetTagsService } from '@/lib/tags-service';
import {
    type PopupSessionUser,
    resolveAuthenticatedPopupState,
    resolvePostLoginPopupState,
    resolvePopupAuthStateChange,
    resolvePopupBootstrapState,
} from './auth-bootstrap';

type AuthMode = 'loading' | 'login' | 'local' | 'authenticated';

const LOGIN_ACCOUNT_STATE = buildStoredAccountState({
    authMode: 'login',
    email: '',
    profile: null,
});

async function readProfile(userId: string): Promise<ProfileRecord | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('email, plan, entitlement_status, billing_provider, subscription_interval')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    return {
        email: data.email ?? '',
        plan: data.plan,
        entitlement_status: data.entitlement_status,
        billing_provider: data.billing_provider,
        subscription_interval: data.subscription_interval,
    } as ProfileRecord;
}

async function persistAuthenticatedState(account: StoredAccountState) {
    await chrome.storage.local.set({
        divnotes_auth: { mode: 'authenticated', email: account.email },
    });
    await writeStoredAccountState(account);
}

async function persistLocalState() {
    const account = buildStoredAccountState({
        authMode: 'local',
        email: '',
        profile: null,
    });
    await chrome.storage.local.set({ divnotes_auth: { mode: 'local' } });
    await writeStoredAccountState(account);
    return account;
}

export default function App() {
    const [authMode, setAuthMode] = useState<AuthMode>('loading');
    const [accountState, setAccountState] = useState<StoredAccountState>(LOGIN_ACCOUNT_STATE);
    const [authError, setAuthError] = useState<string | null>(null);
    const authModeRef = React.useRef<AuthMode>('loading');
    const allowSessionPromotionRef = React.useRef(false);

    // Keep ref in sync with state
    useEffect(() => {
        authModeRef.current = authMode;
    }, [authMode]);

    useEffect(() => {
        const syncAuthenticatedAccount = async (
            sessionUser: { id?: string; email?: string | null },
            fallbackEmail = ''
        ) => {
            try {
                const nextState = await resolveAuthenticatedPopupState(sessionUser, {
                    readProfile,
                    persistAuthenticatedState,
                });
                setAuthError(null);
                setAccountState(nextState.account);
                setAuthMode(nextState.mode);
            } catch (caughtError) {
                const account = buildStoredAccountState({
                    authMode: 'authenticated',
                    email: sessionUser.email?.trim() ?? fallbackEmail,
                    profile: null,
                });
                await persistAuthenticatedState(account);
                setAccountState(account);
                setAuthMode('authenticated');
                setAuthError(
                    caughtError instanceof Error
                        ? caughtError.message
                        : 'Failed to determine account state'
                );
            }
        };

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
                readProfile,
                persistAuthenticatedState,
            });

            setAuthError(nextState.error);
            setAccountState(nextState.account);
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

                if (nextState.mode === 'authenticated' && session?.user) {
                    allowSessionPromotionRef.current = false;
                    void syncAuthenticatedAccount(session.user, nextState.email);
                    return;
                }

                if (nextState.mode === 'login') {
                    void clearStoredAccountState();
                    setAccountState(LOGIN_ACCOUNT_STATE);
                }

                setAuthMode(nextState.mode);
                if (nextState.clearAuthError) {
                    setAuthError(null);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const handleLogin = async (sessionUser: PopupSessionUser | null) => {
        allowSessionPromotionRef.current = false;
        const nextState = await resolvePostLoginPopupState(sessionUser, {
            readProfile,
            persistAuthenticatedState,
        });
        setAuthError(nextState.error);
        setAccountState(nextState.account);
        setAuthMode(nextState.mode);
    };

    const handleUseLocally = async () => {
        allowSessionPromotionRef.current = false;
        setAuthError(null);
        const account = await persistLocalState();
        setAccountState(account);
        setAuthMode('local');
    };

    const handleLogout = async () => {
        if (authMode === 'authenticated') {
            await supabase.auth.signOut();
        }
        await chrome.storage.local.remove('divnotes_auth');
        await clearStoredAccountState();
        resetNotesService();
        resetFoldersService();
        resetTagsService();
        setAccountState(LOGIN_ACCOUNT_STATE);
        setAuthMode('login');
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
    const displayEmail = authMode === 'local' ? 'Local Mode' : accountState.email;

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
