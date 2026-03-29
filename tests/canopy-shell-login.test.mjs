import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('popup login and shell match the approved batch-1 structure', () => {
  const loginForm = read('src/popup/LoginForm.tsx');
  const popupShell = read('src/popup/components/PopupShell.tsx');
  const popupDashboard = read('src/popup/Dashboard.tsx');
  const popupApp = read('src/popup/App.tsx');
  const manifest = JSON.parse(read('public/manifest.json'));

  assert.ok(loginForm.includes('signInWithGoogleInExtension'));
  assert.ok(!loginForm.includes('Sign in to sync across devices'));
  assert.ok(loginForm.includes('Continue with Google'));
  assert.ok(loginForm.includes('Continue with Email'));
  assert.ok(loginForm.includes('Use Local Only'));
  assert.ok(loginForm.includes('createAuthIntentGuard'));
  assert.ok(loginForm.includes('isCurrentIntent(currentIntent)'));
  assert.ok(loginForm.includes('onGoogleSessionPromotionChange'));
  assert.ok(loginForm.includes('signOut: () => supabase.auth.signOut()'));
  assert.ok(popupShell.includes('sticky top-0'));
  assert.ok(popupShell.includes('overflow-hidden'));
  assert.ok(popupShell.includes('text-center'));
  assert.ok(popupShell.includes('font-semibold'));
  assert.ok(!popupDashboard.includes('window.prompt'));
  assert.ok(!popupDashboard.includes('window.confirm'));
  assert.ok(popupDashboard.includes('WorkspaceActionDialog'));
  assert.ok(popupDashboard.includes('handleOpenSidePanel'));
  assert.ok(popupDashboard.includes('PanelsTopLeft'));
  assert.ok(popupDashboard.includes('This removes every saved note in this profile.'));
  assert.ok(manifest.permissions.includes('identity'));
  assert.ok(popupApp.includes('h-[500px]'));
  assert.ok(popupApp.includes('authError'));
  assert.ok(popupApp.includes('resolvePopupAuthStateChange'));
  assert.ok(popupApp.includes('allowSessionPromotionRef'));
});
