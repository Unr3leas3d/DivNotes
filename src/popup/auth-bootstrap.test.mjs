import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePopupBootstrapState } from './auth-bootstrap.ts';

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
