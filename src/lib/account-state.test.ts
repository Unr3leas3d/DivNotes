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
        cloudSyncEnabled: false,
      })
    ).toBe(false);
  });
});
