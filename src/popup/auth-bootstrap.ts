export type PopupAuthMode = 'login' | 'local' | 'authenticated';

interface StoredAuthRecord {
  mode?: string;
}

interface SessionUser {
  email?: string | null;
}

interface PopupSessionResult {
  session: { user: SessionUser } | null;
  error: Error | null;
}

interface PopupBootstrapDependencies {
  readStoredAuth: () => Promise<StoredAuthRecord | undefined>;
  readSupabaseSession: () => Promise<PopupSessionResult>;
  persistAuthenticatedAuth: (email: string) => Promise<void> | void;
}

export interface PopupBootstrapState {
  mode: PopupAuthMode;
  email: string;
  error: string | null;
}

interface PopupAuthStateChangeParams {
  currentMode: PopupAuthMode;
  sessionUser: SessionUser | null;
}

interface PopupAuthStateChangeResult {
  mode: PopupAuthMode;
  email: string;
  clearAuthError: boolean;
}

export async function resolvePopupBootstrapState(
  deps: PopupBootstrapDependencies
): Promise<PopupBootstrapState> {
  try {
    const storedAuth = await deps.readStoredAuth();
    if (storedAuth?.mode === 'local') {
      return { mode: 'local', email: '', error: null };
    }

    const { session, error } = await deps.readSupabaseSession();
    if (error) {
      throw error;
    }

    if (session?.user) {
      const email = session.user.email?.trim() ?? '';
      await deps.persistAuthenticatedAuth(email);
      return { mode: 'authenticated', email, error: null };
    }

    return { mode: 'login', email: '', error: null };
  } catch (caughtError) {
    return {
      mode: 'login',
      email: '',
      error:
        caughtError instanceof Error ? caughtError.message : 'Failed to determine auth state',
    };
  }
}

export function resolvePopupAuthStateChange({
  currentMode,
  sessionUser,
}: PopupAuthStateChangeParams): PopupAuthStateChangeResult | null {
  if (sessionUser) {
    if (currentMode === 'local') {
      return null;
    }

    return {
      mode: 'authenticated',
      email: sessionUser.email?.trim() ?? '',
      clearAuthError: true,
    };
  }

  if (currentMode === 'authenticated') {
    return { mode: 'login', email: '', clearAuthError: false };
  }

  return null;
}
