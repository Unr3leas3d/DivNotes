export type SubscriptionInterval = 'monthly' | 'yearly' | null;

export interface PolarSubscriptionSnapshot {
  id: string;
  status?: string | null;
  recurring_interval?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
}

export interface DerivedPolarBillingState {
  plan: 'free' | 'pro';
  entitlementStatus: 'inactive' | 'active';
  providerSubscriptionStatus: string | null;
  polarSubscriptionId: string | null;
  subscriptionInterval: SubscriptionInterval;
  currentPeriodEnd: string | null;
}

const ACTIVE_PROVIDER_STATUSES = new Set(['active', 'trialing']);
const GRACE_PROVIDER_STATUSES = new Set(['past_due', 'unpaid', 'canceled']);

function mapRecurringInterval(
  interval: string | null | undefined
): SubscriptionInterval {
  if (interval === 'month') {
    return 'monthly';
  }

  if (interval === 'year') {
    return 'yearly';
  }

  return null;
}

function hasFuturePeriodEnd(
  currentPeriodEnd: string | null,
  nowIso: string
): boolean {
  if (!currentPeriodEnd) {
    return false;
  }

  const currentPeriodEndMs = new Date(currentPeriodEnd).getTime();
  const nowMs = new Date(nowIso).getTime();

  if (Number.isNaN(currentPeriodEndMs) || Number.isNaN(nowMs)) {
    return false;
  }

  return currentPeriodEndMs > nowMs;
}

export function derivePolarBillingState(
  subscription: PolarSubscriptionSnapshot | null,
  nowIso: string
): DerivedPolarBillingState {
  const status = subscription?.status ?? null;
  const currentPeriodEnd = subscription?.current_period_end ?? null;
  const hasAccess =
    Boolean(subscription) &&
    (ACTIVE_PROVIDER_STATUSES.has(status ?? '') ||
      (GRACE_PROVIDER_STATUSES.has(status ?? '') &&
        hasFuturePeriodEnd(currentPeriodEnd, nowIso)));

  return {
    plan: hasAccess ? 'pro' : 'free',
    entitlementStatus: hasAccess ? 'active' : 'inactive',
    providerSubscriptionStatus: status,
    polarSubscriptionId: subscription?.id ?? null,
    subscriptionInterval: mapRecurringInterval(subscription?.recurring_interval),
    currentPeriodEnd,
  };
}
