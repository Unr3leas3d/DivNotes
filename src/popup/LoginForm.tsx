import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('login');
    const [showEmailForm, setShowEmailForm] = useState(false);
    const authIntentGuardRef = useRef(createAuthIntentGuard());
    const authOptionBaseClass = 'h-[50px] w-full rounded-[12px] border border-[#e7e2d8] bg-white px-4 text-[15px] font-medium text-[#314339] shadow-[0_1px_2px_rgba(5,36,21,0.03)] transition-colors hover:bg-[#f8f6f1] disabled:cursor-wait disabled:opacity-70';
    const authOptionContentClass = 'flex items-center gap-3';

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(error.message);
        } else {
            await onLogin(data.session?.user ?? null);
        }

        setIsLoading(false);
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
            setError(error.message);
        } else if (!data.session?.user) {
            setError('Check your email to confirm your account, then sign in.');
        } else {
            await onLogin(data.session.user);
        }

        setIsLoading(false);
    };

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

    const handleShowEmailForm = () => {
        authIntentGuardRef.current.invalidateCurrentIntent();
        onGoogleSessionPromotionChange(false);
        setIsLoading(false);
        setError('');
        setShowEmailForm(true);
    };

    const handleUseLocalOnly = () => {
        authIntentGuardRef.current.invalidateCurrentIntent();
        onGoogleSessionPromotionChange(false);
        setIsLoading(false);
        setError('');
        onUseLocally();
    };

    if (showEmailForm) {
        return (
            <div className="flex min-h-[500px] flex-col bg-[#fcfbf7]">
                <div className="flex items-center px-4 pt-4">
                    <button type="button" onClick={() => setShowEmailForm(false)} className="rounded-[10px] p-2 transition-colors hover:bg-[#f1eee7]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6"/>
                        </svg>
                    </button>
                    <span className="ml-2 text-sm font-medium text-foreground">Sign in with Email</span>
                </div>
                <div className="flex-1 px-8 pt-6 pb-6">
                    <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setError(''); }} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="login">Sign In</TabsTrigger>
                            <TabsTrigger value="signup">Sign Up</TabsTrigger>
                        </TabsList>

                        <TabsContent value="login">
                            <form onSubmit={handleSignIn} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="login-email">Email</Label>
                                    <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="login-password">Password</Label>
                                    <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                                </div>
                                {error && <p className="text-xs text-destructive">{error}</p>}
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Signing in...' : 'Sign In'}
                                </Button>
                            </form>
                        </TabsContent>

                        <TabsContent value="signup">
                            <form onSubmit={handleSignUp} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="signup-email">Email</Label>
                                    <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="signup-password">Password</Label>
                                    <Input id="signup-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                                </div>
                                {error && <p className="text-xs text-destructive">{error}</p>}
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? 'Creating account...' : 'Create Account'}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-[500px] flex-col bg-[#fcfbf7]">
            <div className="mx-auto flex w-full max-w-[316px] flex-1 flex-col justify-center px-7 pb-4 pt-8">
                <div className="flex flex-col items-center">
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#0b2417] shadow-[0_10px_24px_rgba(5,36,21,0.14)]">
                        <svg width="28" height="28" viewBox="0 0 68 68" fill="none">
                            <path d="M32 62 C33 52 33 44 33 36" stroke="#F5EFE9" strokeWidth="4.5" strokeLinecap="round"/>
                            <path d="M33 36 C26 24 14 12 6 6" stroke="#F5EFE9" strokeWidth="4" strokeLinecap="round"/>
                            <path d="M33 36 C42 22 54 10 62 6" stroke="#F5EFE9" strokeWidth="4" strokeLinecap="round"/>
                            <path d="M33 36 C44 28 56 20 62 18" stroke="#F5EFE9" strokeWidth="3.5" strokeLinecap="round"/>
                            <circle cx="6" cy="6" r="5" fill="#ABFFC0"/>
                            <circle cx="62" cy="6" r="5" fill="#ABFFC0"/>
                            <circle cx="62" cy="18" r="4.5" fill="#ABFFC0"/>
                        </svg>
                    </div>
                    <h1 className="text-center font-serif text-[32px] font-semibold leading-[1.12] tracking-[-0.7px] text-[#173628]">
                        Think on top of the web.
                    </h1>
                    <p className="mt-5 max-w-[260px] text-center text-[14px] leading-[1.45] text-[#9aa294]">
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

                    <button
                        type="button"
                        onClick={handleShowEmailForm}
                        className={authOptionBaseClass}
                    >
                        <span className={authOptionContentClass}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="20" height="16" x="2" y="4" rx="2"/>
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                            <span>Continue with Email</span>
                        </span>
                    </button>

                    <div className="flex items-center gap-3 py-1.5">
                        <Separator className="flex-1 bg-[#ece7de]" />
                        <span className="text-[12px] text-[#aca89e]">or</span>
                        <Separator className="flex-1 bg-[#ece7de]" />
                    </div>

                    <button
                        type="button"
                        onClick={handleUseLocalOnly}
                        className="h-[50px] w-full rounded-[12px] bg-[#f3f1eb] text-[15px] font-semibold text-[#314339] transition-colors hover:bg-[#ece8df]"
                    >
                        Use Local Only
                    </button>
                </div>

                {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}
            </div>

            <div className="px-10 pb-3 text-center">
                <p className="text-[10px] leading-[1.45] text-[#aba79c]">
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}
