import React, { useRef, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { signInWithGoogleInExtension } from '@/lib/google-auth';
import { supabase } from '@/lib/supabase';
import { createAuthIntentGuard } from './auth-intent';
import type { PopupSessionUser } from './auth-bootstrap';

interface LoginFormProps {
    onLogin: (sessionUser: PopupSessionUser | null) => void | Promise<void>;
    onUseLocally: () => void | Promise<void>;
    onGoogleSessionPromotionChange: (allowed: boolean) => void;
}

export function LoginForm({ onLogin, onUseLocally, onGoogleSessionPromotionChange }: LoginFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const authIntentGuardRef = useRef(createAuthIntentGuard());
    const authOptionBaseClass = 'h-[50px] w-full rounded-[12px] border border-border bg-card px-4 text-[15px] font-medium text-foreground shadow-card transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-70';
    const authOptionContentClass = 'flex items-center gap-3';

    const handleGoogleSignIn = async () => {
        const currentIntent = authIntentGuardRef.current.beginIntent();
        onGoogleSessionPromotionChange(true);
        setIsLoading(true);
        setError('');

        try {
            const result = await signInWithGoogleInExtension({
                getRedirectURL: () => chrome.identity.getRedirectURL(),
                signInWithOAuth: (credentials) => supabase.auth.signInWithOAuth(credentials),
                launchWebAuthFlow: (details) => chrome.identity.launchWebAuthFlow(details),
                exchangeCodeForSession: (code) => supabase.auth.exchangeCodeForSession(code),
                canContinue: () => authIntentGuardRef.current.isCurrentIntent(currentIntent),
                signOut: () => supabase.auth.signOut(),
            });

            if (authIntentGuardRef.current.isCurrentIntent(currentIntent)) {
                await onLogin(result.user);
            }
        } catch (caughtError) {
            if (authIntentGuardRef.current.isCurrentIntent(currentIntent)) {
                setError(caughtError instanceof Error ? caughtError.message : 'Google sign-in failed');
            }
        } finally {
            if (authIntentGuardRef.current.isCurrentIntent(currentIntent)) {
                setIsLoading(false);
                onGoogleSessionPromotionChange(false);
            }
        }
    };

    const handleUseLocalOnly = () => {
        authIntentGuardRef.current.invalidateCurrentIntent();
        onGoogleSessionPromotionChange(false);
        setIsLoading(false);
        setError('');
        onUseLocally();
    };

    return (
        <div className="flex min-h-[500px] flex-col bg-background text-foreground">
            <div className="mx-auto flex w-full max-w-[316px] flex-1 flex-col justify-center px-7 pb-4 pt-8">
                <div className="flex flex-col items-center">
                    <h1 className="text-center font-serif text-[32px] font-semibold leading-[1.12] tracking-[-0.7px] text-foreground">
                        Think on top of the web.
                    </h1>
                    <p className="mt-5 max-w-[260px] text-center text-[14px] leading-[1.45] text-muted-foreground">
                        Attach notes to any element on any page.
                    </p>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className={authOptionBaseClass}
                        disabled={isLoading}
                    >
                        <span className={authOptionContentClass}>
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span>Continue with Google</span>
                        </span>
                    </button>

                    <div className="flex items-center gap-3 py-1.5">
                        <Separator className="flex-1 bg-border" />
                        <span className="text-[12px] text-muted-foreground">or</span>
                        <Separator className="flex-1 bg-border" />
                    </div>

                    <button
                        type="button"
                        onClick={handleUseLocalOnly}
                        className="h-[50px] w-full rounded-[12px] border border-border bg-secondary text-[15px] font-semibold text-foreground transition-colors hover:bg-secondary/80"
                    >
                        Use Local Only
                    </button>
                </div>

                {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}
            </div>

            <div className="px-10 pb-3 text-center">
                <p className="text-[10px] leading-[1.45] text-muted-foreground">
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
