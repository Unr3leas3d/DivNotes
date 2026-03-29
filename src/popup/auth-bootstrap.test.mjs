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
    persistAuthenticatedAuth: async () => {
      throw new Error('should not run');
    },
  });

  assert.deepEqual(state, {
    mode: 'login',
    email: '',
    error: 'Storage unavailable',
  });
});

test('resolvePopupBootstrapState falls back to login with error when session lookup returns an error', async () => {
  const state = await resolvePopupBootstrapState({
    readStoredAuth: async () => ({ mode: 'authenticated' }),
    readSupabaseSession: async () => ({
      session: null,
      error: new Error('Session fetch failed'),
    }),
    persistAuthenticatedAuth: async () => {
      throw new Error('should not run');
    },
  });

  assert.deepEqual(state, {
    mode: 'login',
    email: '',
    error: 'Session fetch failed',
  });
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
