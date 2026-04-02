import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolvePopupBootstrapState,
  resolvePopupAuthStateChange,
} from './auth-bootstrap.ts';

test('resolvePopupBootstrapState falls back to login with error when storage lookup fails', async () => {
  const state = await resolvePopupBootstrapState({
    readStoredAuth: async () => {
      throw new Error('Storage unavailable');
    },
    readSupabaseSession: async () => {
      throw new Error('should not run');
    },
    readProfile: async () => {
      throw new Error('should not run');
    },
    persistAuthenticatedState: async () => {
      throw new Error('should not run');
    },
  });

  assert.deepEqual(state, {
    mode: 'login',
    email: '',
    error: 'Storage unavailable',
    account: {
      authMode: 'login',
      email: '',
      plan: null,
      entitlementStatus: null,
      billingProvider: null,
      subscriptionInterval: null,
      cloudSyncEnabled: false,
    },
  });
});

test('resolvePopupBootstrapState falls back to login with error when session lookup returns an error', async () => {
  const state = await resolvePopupBootstrapState({
    readStoredAuth: async () => ({ mode: 'authenticated' }),
    readSupabaseSession: async () => ({
      session: null,
      error: new Error('Session fetch failed'),
    }),
    readProfile: async () => {
      throw new Error('should not run');
    },
    persistAuthenticatedState: async () => {
      throw new Error('should not run');
    },
  });

  assert.deepEqual(state, {
    mode: 'login',
    email: '',
    error: 'Session fetch failed',
    account: {
      authMode: 'login',
      email: '',
      plan: null,
      entitlementStatus: null,
      billingProvider: null,
      subscriptionInterval: null,
      cloudSyncEnabled: false,
    },
  });
});

test('resolvePopupBootstrapState returns local mode without fetching a profile', async () => {
  const state = await resolvePopupBootstrapState({
    readStoredAuth: async () => ({ mode: 'local' }),
    readSupabaseSession: async () => {
      throw new Error('should not run');
    },
    readProfile: async () => {
      throw new Error('should not run');
    },
    persistAuthenticatedState: async () => {
      throw new Error('should not run');
    },
  });

  assert.deepEqual(state, {
    mode: 'local',
    email: '',
    error: null,
    account: {
      authMode: 'local',
      email: '',
      plan: null,
      entitlementStatus: null,
      billingProvider: null,
      subscriptionInterval: null,
      cloudSyncEnabled: false,
    },
  });
});

test('resolvePopupBootstrapState normalizes a missing profile row to free and inactive', async () => {
  let persistedState = null;

  const state = await resolvePopupBootstrapState({
    readStoredAuth: async () => ({ mode: 'authenticated' }),
    readSupabaseSession: async () => ({
      session: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    }),
    readProfile: async () => null,
    persistAuthenticatedState: async (account) => {
      persistedState = account;
    },
  });

  assert.deepEqual(state.account, {
    authMode: 'authenticated',
    email: 'user@example.com',
    plan: 'free',
    entitlementStatus: 'inactive',
    billingProvider: null,
    subscriptionInterval: null,
    cloudSyncEnabled: false,
  });
  assert.deepEqual(persistedState, state.account);
});

test('resolvePopupBootstrapState enables cloud sync for pro users with active entitlement', async () => {
  const state = await resolvePopupBootstrapState({
    readStoredAuth: async () => ({ mode: 'authenticated' }),
    readSupabaseSession: async () => ({
      session: { user: { id: 'user-1', email: 'pro@example.com' } },
      error: null,
    }),
    readProfile: async () => ({
      email: 'pro@example.com',
      plan: 'pro',
      entitlement_status: 'active',
      billing_provider: 'polar',
      subscription_interval: 'yearly',
    }),
    persistAuthenticatedState: async () => {},
  });

  assert.equal(state.account.cloudSyncEnabled, true);
  assert.equal(state.account.plan, 'pro');
  assert.equal(state.account.entitlementStatus, 'active');
  assert.equal(state.account.subscriptionInterval, 'yearly');
});

test('resolvePopupAuthStateChange ignores session promotion while current mode is local', () => {
  const nextState = resolvePopupAuthStateChange({
    currentMode: 'local',
    sessionUser: { email: 'user@example.com' },
    canPromoteFromSession: true,
  });

  assert.equal(nextState, null);
});

test('resolvePopupAuthStateChange promotes authenticated mode when current mode is not local', () => {
  const nextState = resolvePopupAuthStateChange({
    currentMode: 'login',
    sessionUser: { email: 'user@example.com' },
    canPromoteFromSession: true,
  });

  assert.deepEqual(nextState, {
    mode: 'authenticated',
    email: 'user@example.com',
    clearAuthError: true,
  });
});

test('resolvePopupAuthStateChange ignores login promotion when session promotion is not allowed', () => {
  const nextState = resolvePopupAuthStateChange({
    currentMode: 'login',
    sessionUser: { email: 'user@example.com' },
    canPromoteFromSession: false,
  });

  assert.equal(nextState, null);
});

test('resolvePopupAuthStateChange ignores loading promotion when session promotion is not allowed', () => {
  const nextState = resolvePopupAuthStateChange({
    currentMode: 'loading',
    sessionUser: { email: 'user@example.com' },
    canPromoteFromSession: false,
  });

  assert.equal(nextState, null);
});
