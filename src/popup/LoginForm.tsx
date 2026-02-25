import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StickyNote, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface LoginFormProps {
    onLogin: (email: string) => void;
    onUseLocally: () => void;
}

export function LoginForm({ onLogin, onUseLocally }: LoginFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('login');

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setIsLoading(false);

        if (error) {
            setError(error.message);
        } else {
            onLogin(email);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const { error } = await supabase.auth.signUp({ email, password });
        setIsLoading(false);

        if (error) {
            setError(error.message);
        } else {
            // Auto-login after signup (Supabase auto-confirms by default)
            onLogin(email);
        }
    };

    return (
        <div className="flex flex-col min-h-[500px]">
            {/* Header / Branding */}
            <div className="flex flex-col items-center pt-8 pb-6 px-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/90 to-primary/60 flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
                    <StickyNote className="w-7 h-7 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    DivNotes
                </h1>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Annotate any element on the web
                </p>
            </div>

            {/* Auth Tabs */}
            <div className="flex-1 px-6 pb-6">
                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setError(''); }} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="login">Sign In</TabsTrigger>
                        <TabsTrigger value="signup">Sign Up</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login">
                        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">Welcome back</CardTitle>
                                <CardDescription>Sign in to access your notes</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSignIn} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="login-email">Email</Label>
                                        <Input
                                            id="login-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="login-password">Password</Label>
                                        <Input
                                            id="login-password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    {error && (
                                        <p className="text-xs text-destructive">{error}</p>
                                    )}
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                                Signing in...
                                            </span>
                                        ) : (
                                            'Sign In'
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="signup">
                        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">Create account</CardTitle>
                                <CardDescription>Start annotating the web</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSignUp} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="signup-email">Email</Label>
                                        <Input
                                            id="signup-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="signup-password">Password</Label>
                                        <Input
                                            id="signup-password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                    {error && (
                                        <p className="text-xs text-destructive">{error}</p>
                                    )}
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                                Creating account...
                                            </span>
                                        ) : (
                                            'Create Account'
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Separator */}
                <div className="flex items-center gap-3 my-4">
                    <Separator className="flex-1 opacity-30" />
                    <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">or</span>
                    <Separator className="flex-1 opacity-30" />
                </div>

                {/* Use Locally */}
                <Button
                    variant="outline"
                    className="w-full h-11 text-sm border-border/40 hover:bg-accent/50"
                    onClick={onUseLocally}
                >
                    <span className="mr-2">💾</span>
                    Use Locally — No Account Needed
                </Button>
            </div>

            {/* Footer */}
            <div className="px-6 pb-4 text-center">
                <p className="text-[11px] text-muted-foreground/60">
                    Local mode saves notes to your browser
                </p>
            </div>
        </div>
    );
}
