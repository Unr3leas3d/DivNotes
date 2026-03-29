import test from 'node:test';
import assert from 'node:assert/strict';

import { signInWithGoogleInExtension } from './google-auth.ts';

test('signInWithGoogleInExtension launches Chrome OAuth and exchanges the returned code', async () => {
  let exchangedCode = '';

  const result = await signInWithGoogleInExtension({
    getRedirectURL: () => 'https://extension-id.chromiumapp.org/',
    signInWithOAuth: async (credentials) => {
      assert.deepEqual(credentials, {
        provider: 'google',
        options: {
          redirectTo: 'https://extension-id.chromiumapp.org/',
          skipBrowserRedirect: true,
        },
      });

      return {
        data: { provider: 'google', url: 'https://supabase.example/google-start' },
        error: null,
      };
    },
    launchWebAuthFlow: async ({ url, interactive }) => {
      assert.equal(url, 'https://supabase.example/google-start');
      assert.equal(interactive, true);
      return 'https://extension-id.chromiumapp.org/?code=oauth-code';
    },
    exchangeCodeForSession: async (code) => {
      exchangedCode = code;
      return {
        data: {
          user: { email: 'user@example.com' },
          session: { access_token: 'token', refresh_token: 'refresh' },
        },
        error: null,
      };
    },
  });

  assert.equal(exchangedCode, 'oauth-code');
  assert.equal(result.email, 'user@example.com');
});

test('signInWithGoogleInExtension surfaces cancellation as an inline-safe error', async () => {
  await assert.rejects(
    signInWithGoogleInExtension({
      getRedirectURL: () => 'https://extension-id.chromiumapp.org/',
      signInWithOAuth: async () => ({
        data: { provider: 'google', url: 'https://supabase.example/google-start' },
        error: null,
      }),
      launchWebAuthFlow: async () => undefined,
      exchangeCodeForSession: async () => {
        throw new Error('should not run');
      },
    }),
    /cancelled/i
  );
});

test('signInWithGoogleInExtension rejects a callback with no auth code', async () => {
  await assert.rejects(
    signInWithGoogleInExtension({
      getRedirectURL: () => 'https://extension-id.chromiumapp.org/',
      signInWithOAuth: async () => ({
        data: { provider: 'google', url: 'https://supabase.example/google-start' },
        error: null,
      }),
      launchWebAuthFlow: async () => 'https://extension-id.chromiumapp.org/?state=missing-code',
      exchangeCodeForSession: async () => {
        throw new Error('should not run');
      },
    }),
    /authorization code/i
  );
});

test('signInWithGoogleInExtension propagates OAuth callback errors', async () => {
  await assert.rejects(
    signInWithGoogleInExtension({
      getRedirectURL: () => 'https://extension-id.chromiumapp.org/',
      signInWithOAuth: async () => ({
        data: { provider: 'google', url: 'https://supabase.example/google-start' },
        error: null,
      }),
      launchWebAuthFlow: async () => 'https://extension-id.chromiumapp.org/?error=access_denied',
      exchangeCodeForSession: async () => {
        throw new Error('should not run');
      },
    }),
    /access_denied/i
  );
});

test('signInWithGoogleInExtension fails when session user email is missing', async () => {
  await assert.rejects(
    signInWithGoogleInExtension({
      getRedirectURL: () => 'https://extension-id.chromiumapp.org/',
      signInWithOAuth: async () => ({
        data: { provider: 'google', url: 'https://supabase.example/google-start' },
        error: null,
      }),
      launchWebAuthFlow: async () => 'https://extension-id.chromiumapp.org/?code=oauth-code',
      exchangeCodeForSession: async () => ({
        data: { user: { email: null } },
        error: null,
      }),
    }),
    /email/i
  );
});
