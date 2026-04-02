import {
  buildStoredAccountState,
  type ProfileRecord,
  type StoredAccountState,
} from '../lib/account-state.ts';

const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 2000;

export type PopupAuthMode = 'login' | 'local' | 'authenticated';

interface StoredAuthRecord {
  mode?: string;
}

interface SessionUser {
  id?: string;
  email?: string | null;
}

interface PopupSessionResult {
  session: { user: SessionUser } | null;
  error: Error | null;
}

interface PopupBootstrapDependencies {
  readStoredAuth: () => Promise<StoredAuthRecord | undefined>;
  readSupabaseSession: () => Promise<PopupSessionResult>;
  readProfile: (userId: string) => Promise<ProfileRecord | null>;
  persistAuthenticatedState: (account: StoredAccountState) => Promise<void> | void;
  storageTimeoutMs?: number;
  sessionTimeoutMs?: number;
  profileTimeoutMs?: number;
}

export interface PopupBootstrapState {
  mode: PopupAuthMode;
  email: string;
  error: string | null;
  account: StoredAccountState;
}

interface PopupAuthStateChangeParams {
  currentMode: PopupAuthMode | 'loading';
  sessionUser: SessionUser | null;
  canPromoteFromSession: boolean;
}

interface PopupAuthStateChangeResult {
  mode: PopupAuthMode;
  email: string;
  clearAuthError: boolean;
}

function buildPopupState(
  mode: PopupAuthMode,
  email: string,
  error: string | null
): PopupBootstrapState {
  return {
    mode,
    email,
    error,
    account: buildStoredAccountState({
      authMode: mode,
      email,
      profile: null,
    }),
  };
}

interface ResolveAuthenticatedPopupStateDependencies {
  readProfile: (userId: string) => Promise<ProfileRecord | null>;
  persistAuthenticatedState: (account: StoredAccountState) => Promise<void> | void;
  profileTimeoutMs?: number;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function resolveAuthenticatedPopupState(
  sessionUser: SessionUser,
  deps: ResolveAuthenticatedPopupStateDependencies
): Promise<PopupBootstrapState> {
  const email = sessionUser.email?.trim() ?? '';
  const profile = sessionUser.id
    ? await withTimeout(
        deps.readProfile(sessionUser.id),
        deps.profileTimeoutMs ?? DEFAULT_BOOTSTRAP_TIMEOUT_MS,
        'Profile lookup timed out'
      )
    : null;
  const account = buildStoredAccountState({
    authMode: 'authenticated',
    email,
    profile,
  });

  await deps.persistAuthenticatedState(account);

  return {
    mode: 'authenticated',
    email: account.email,
    error: null,
    account,
  };
}

export async function resolvePopupBootstrapState(
  deps: PopupBootstrapDependencies
): Promise<PopupBootstrapState> {
  try {
    const storedAuth = await withTimeout(
      deps.readStoredAuth(),
      deps.storageTimeoutMs ?? DEFAULT_BOOTSTRAP_TIMEOUT_MS,
      'Stored auth lookup timed out'
    );
    if (storedAuth?.mode === 'local') {
      return buildPopupState('local', '', null);
    }

    const { session, error } = await withTimeout(
      deps.readSupabaseSession(),
      deps.sessionTimeoutMs ?? DEFAULT_BOOTSTRAP_TIMEOUT_MS,
      'Session lookup timed out'
    );
    if (error) {
      throw error;
    }

    if (session?.user) {
      return await resolveAuthenticatedPopupState(session.user, deps);
    }

    return buildPopupState('login', '', null);
  } catch (caughtError) {
    return buildPopupState(
      'login',
      '',
      caughtError instanceof Error ? caughtError.message : 'Failed to determine auth state'
    );
  }
}

export function resolvePopupAuthStateChange({
  currentMode,
  sessionUser,
  canPromoteFromSession,
}: PopupAuthStateChangeParams): PopupAuthStateChangeResult | null {
  if (sessionUser) {
    if (currentMode === 'local') {
      return null;
    }

    if ((currentMode === 'login' || currentMode === 'loading') && !canPromoteFromSession) {
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
