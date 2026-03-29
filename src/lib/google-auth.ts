type LaunchWebAuthFlow = (details: { url: string; interactive: boolean }) => Promise<string | undefined>;

interface GoogleAuthDependencies {
  getRedirectURL: () => string;
  signInWithOAuth: (credentials: {
    provider: 'google';
    options: { redirectTo: string; skipBrowserRedirect: true };
  }) => Promise<{ data: { url: string | null }; error: Error | null }>;
  launchWebAuthFlow: LaunchWebAuthFlow;
  exchangeCodeForSession: (
    code: string
  ) => Promise<{ data: { user: { email?: string | null } | null }; error: Error | null }>;
  canContinue?: () => boolean;
  signOut?: () => Promise<{ error?: Error | null } | void>;
}

export async function signInWithGoogleInExtension(deps: GoogleAuthDependencies) {
  const canContinue = deps.canContinue ?? (() => true);
  const staleFlowError = () => new Error('Google sign-in was superseded by a newer auth choice.');

  const redirectTo = deps.getRedirectURL();
  const { data, error } = await deps.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    throw error ?? new Error('Google sign-in could not be started.');
  }

  const callbackUrl = await deps.launchWebAuthFlow({
    url: data.url,
    interactive: true,
  });

  if (!callbackUrl) {
    throw new Error('Google sign-in was cancelled.');
  }

  const parsed = new URL(callbackUrl);
  const callbackError =
    parsed.searchParams.get('error_description') || parsed.searchParams.get('error');
  if (callbackError) {
    throw new Error(callbackError);
  }

  const code = parsed.searchParams.get('code');
  if (!code) {
    throw new Error('Google sign-in did not return an authorization code.');
  }

  if (!canContinue()) {
    throw staleFlowError();
  }

  const { data: sessionData, error: exchangeError } = await deps.exchangeCodeForSession(code);
  if (exchangeError || !sessionData.user) {
    throw exchangeError ?? new Error('Google sign-in did not create a session.');
  }

  if (!canContinue()) {
    if (deps.signOut) {
      try {
        await deps.signOut();
      } catch {
        // Best-effort cleanup: stale flow must still fail even if sign out fails.
      }
    }
    throw staleFlowError();
  }

  const email = sessionData.user.email?.trim();
  if (!email) {
    throw new Error('Google sign-in did not return a user email.');
  }

  return { email };
}
