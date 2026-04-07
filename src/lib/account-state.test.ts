import { describe, expect, it } from 'vitest';

import {
  buildStoredAccountState,
  canUseCloudSync,
  type ProfileRecord,
} from './account-state';

const freeProfile: ProfileRecord = {
  email: 'user@example.com',
  plan: 'free',
  entitlement_status: 'inactive',
  billing_provider: null,
  subscription_interval: null,
  current_period_end: null,
  provider_subscription_status: null,
};

describe('buildStoredAccountState', () => {
  it('maps a free profile to cloudSyncEnabled false', () => {
    const state = buildStoredAccountState({
      authMode: 'authenticated',
      email: 'user@example.com',
      profile: freeProfile,
    });

    expect(state.plan).toBe('free');
    expect(state.entitlementStatus).toBe('inactive');
    expect(state.cloudSyncEnabled).toBe(false);
  });

  it('normalizes a missing profile row to free and inactive', () => {
    const state = buildStoredAccountState({
      authMode: 'authenticated',
      email: 'user@example.com',
      profile: null,
    });

    expect(state.plan).toBe('free');
    expect(state.entitlementStatus).toBe('inactive');
    expect(state.cloudSyncEnabled).toBe(false);
  });

  it('only enables cloud sync for authenticated pro users with active entitlement', () => {
    expect(
      canUseCloudSync({
        authMode: 'authenticated',
        email: 'user@example.com',
        plan: 'pro',
        entitlementStatus: 'active',
        billingProvider: 'polar',
        subscriptionInterval: 'monthly',
        currentPeriodEnd: null,
        providerSubscriptionStatus: 'active',
        cloudSyncEnabled: true,
      })
    ).toBe(true);

    expect(
      canUseCloudSync({
        authMode: 'authenticated',
        email: 'user@example.com',
        plan: 'pro',
        entitlementStatus: 'past_due',
        billingProvider: 'polar',
        subscriptionInterval: 'monthly',
        currentPeriodEnd: '2026-04-10T00:00:00.000Z',
        providerSubscriptionStatus: 'past_due',
        cloudSyncEnabled: false,
      })
    ).toBe(false);

    expect(
      canUseCloudSync({
        authMode: 'local',
        email: '',
        plan: 'pro',
        entitlementStatus: 'active',
        billingProvider: 'polar',
        subscriptionInterval: 'yearly',
        currentPeriodEnd: null,
        providerSubscriptionStatus: 'active',
        cloudSyncEnabled: false,
      })
    ).toBe(false);
  });

  it('keeps cloud sync enabled during a Polar grace window', () => {
    const state = buildStoredAccountState({
      authMode: 'authenticated',
      email: 'user@example.com',
      profile: {
        email: 'user@example.com',
        plan: 'pro',
        entitlement_status: 'active',
        billing_provider: 'polar',
        subscription_interval: 'monthly',
        current_period_end: '2099-04-10T00:00:00.000Z',
        provider_subscription_status: 'canceled',
      },
    });

    expect(state.cloudSyncEnabled).toBe(true);
  });

  it('disables cloud sync when a stored grace window has already expired', () => {
    const state = buildStoredAccountState({
      authMode: 'authenticated',
      email: 'user@example.com',
      profile: {
        email: 'user@example.com',
        plan: 'pro',
        entitlement_status: 'active',
        billing_provider: 'polar',
        subscription_interval: 'monthly',
        current_period_end: '2000-04-05T00:00:00.000Z',
        provider_subscription_status: 'canceled',
      },
    });

    expect(state.cloudSyncEnabled).toBe(false);
  });
});
