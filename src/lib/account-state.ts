export const ACCOUNT_STORAGE_KEY = 'divnotes_account';

export type AccountAuthMode = 'login' | 'local' | 'authenticated';
export type AccountPlan = 'free' | 'pro';
export type EntitlementStatus = 'inactive' | 'active' | 'past_due' | 'canceled' | 'expired';
export type BillingProvider = 'polar' | null;
export type SubscriptionInterval = 'monthly' | 'yearly' | null;

export interface ProfileRecord {
  email: string;
  plan: AccountPlan;
  entitlement_status: EntitlementStatus;
  billing_provider: BillingProvider;
  subscription_interval: SubscriptionInterval;
  current_period_end: string | null;
  provider_subscription_status: string | null;
}

export interface StoredAccountState {
  authMode: AccountAuthMode;
  email: string;
  plan: AccountPlan | null;
  entitlementStatus: EntitlementStatus | null;
  billingProvider: BillingProvider;
  subscriptionInterval: SubscriptionInterval;
  currentPeriodEnd: string | null;
  providerSubscriptionStatus: string | null;
  cloudSyncEnabled: boolean;
}

type StorageAreaLike = Pick<chrome.storage.StorageArea, 'get' | 'set' | 'remove'>;

export function normalizeProfileRecord(
  profile: ProfileRecord | null | undefined,
  fallbackEmail = ''
): ProfileRecord {
  return {
    email: profile?.email ?? fallbackEmail,
    plan: profile?.plan ?? 'free',
    entitlement_status: profile?.entitlement_status ?? 'inactive',
    billing_provider: profile?.billing_provider ?? null,
    subscription_interval: profile?.subscription_interval ?? null,
    current_period_end: profile?.current_period_end ?? null,
    provider_subscription_status: profile?.provider_subscription_status ?? null,
  };
}

function isGracePeriodExpired(
  currentPeriodEnd: string | null | undefined,
  now = new Date()
): boolean {
  if (!currentPeriodEnd) {
    return false;
  }

  const periodEnd = new Date(currentPeriodEnd);
  if (Number.isNaN(periodEnd.getTime())) {
    return false;
  }

  return periodEnd.getTime() <= now.getTime();
}

function shouldEnableCloudSync(profile: ProfileRecord): boolean {
  if (profile.plan !== 'pro' || profile.entitlement_status !== 'active') {
    return false;
  }

  if (
    profile.provider_subscription_status &&
    profile.provider_subscription_status !== 'active' &&
    profile.provider_subscription_status !== 'trialing'
  ) {
    return !isGracePeriodExpired(profile.current_period_end);
  }

  return true;
}

export function buildStoredAccountState(params: {
  authMode: StoredAccountState['authMode'];
  email: string;
  profile: ProfileRecord | null;
}): StoredAccountState {
  if (params.authMode !== 'authenticated') {
    return {
      authMode: params.authMode,
      email: params.email,
      plan: null,
      entitlementStatus: null,
      billingProvider: null,
      subscriptionInterval: null,
      currentPeriodEnd: null,
      providerSubscriptionStatus: null,
      cloudSyncEnabled: false,
    };
  }

  const profile = normalizeProfileRecord(params.profile, params.email);
  const cloudSyncEnabled = params.authMode === 'authenticated' && shouldEnableCloudSync(profile);

  return {
    authMode: params.authMode,
    email: params.email || profile.email,
    plan: profile.plan,
    entitlementStatus: profile.entitlement_status,
    billingProvider: profile.billing_provider,
    subscriptionInterval: profile.subscription_interval,
    currentPeriodEnd: profile.current_period_end,
    providerSubscriptionStatus: profile.provider_subscription_status,
    cloudSyncEnabled,
  };
}

export function canUseCloudSync(
  state: StoredAccountState | null | undefined
): boolean {
  return Boolean(
    state &&
      state.authMode === 'authenticated' &&
      state.plan === 'pro' &&
      state.entitlementStatus === 'active' &&
      state.cloudSyncEnabled
  );
}

export async function readStoredAccountState(
  storage: StorageAreaLike = chrome.storage.local
): Promise<StoredAccountState | undefined> {
  const result = await storage.get([ACCOUNT_STORAGE_KEY]);
  return result[ACCOUNT_STORAGE_KEY] as StoredAccountState | undefined;
}

export async function writeStoredAccountState(
  state: StoredAccountState,
  storage: StorageAreaLike = chrome.storage.local
): Promise<void> {
  await storage.set({ [ACCOUNT_STORAGE_KEY]: state });
}

export async function clearStoredAccountState(
  storage: StorageAreaLike = chrome.storage.local
): Promise<void> {
  await storage.remove([ACCOUNT_STORAGE_KEY]);
}
