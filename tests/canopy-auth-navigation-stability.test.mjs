import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('popup Google auth surfaces actionable inline failures', () => {
  const loginForm = read('src/popup/LoginForm.tsx');
  const googleAuth = read('src/lib/google-auth.ts');

  // chrome.identity is used in LoginForm (the call-site), not in google-auth.ts (which uses DI)
  assert.ok(loginForm.includes('chrome.identity'));
  assert.ok(googleAuth.includes('Google sign-in could not be started.'));
  assert.ok(loginForm.includes('Google sign-in failed'));
  assert.ok(loginForm.includes('onGoogleSessionPromotionChange(false)'));
});
