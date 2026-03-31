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
  assert.ok(loginForm.includes('pt-8'));
  assert.ok(loginForm.includes('mt-8'));
  assert.ok(loginForm.includes('pb-3'));
  assert.ok(!loginForm.includes('mt-12'));
  assert.ok(loginForm.includes('createAuthIntentGuard'));
  assert.ok(loginForm.includes('isCurrentIntent(currentIntent)'));
  assert.ok(loginForm.includes('onGoogleSessionPromotionChange'));
  assert.ok(loginForm.includes('signOut: () => supabase.auth.signOut()'));
  assert.ok(popupShell.includes('sticky top-0'));
  assert.ok(popupShell.includes('overflow-hidden'));
  assert.ok(popupShell.includes('text-left'));
  assert.ok(!popupShell.includes('text-center'));
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

test('sidepanel shell removes This Page and keeps a centered work surface', () => {
  const sidepanelApp = read('src/sidepanel/App.tsx');
  const segmentedControl = read('src/sidepanel/components/SegmentedControl.tsx');
  const shell = read('src/sidepanel/components/SidePanelShell.tsx');
  const foldersView = read('src/sidepanel/components/FoldersView.tsx');
  const tagManager = read('src/sidepanel/components/TagManager.tsx');
  const workspaceHook = read('src/lib/use-extension-workspace.ts');

  assert.ok(!segmentedControl.includes('This Page'));
  assert.ok(!sidepanelApp.includes('PanelsTopLeft'));
  assert.ok(!sidepanelApp.includes('handleOpenPopup'));
  assert.ok(!sidepanelApp.includes('window.confirm'));
  assert.ok(!foldersView.includes('window.prompt'));
  assert.ok(!foldersView.includes('window.alert'));
  assert.ok(!foldersView.includes('window.confirm'));
  assert.ok(!tagManager.includes('window.confirm'));
  assert.ok(foldersView.includes('WorkspaceActionDialog'));
  assert.ok(tagManager.includes('WorkspaceActionDialog'));
  assert.ok(shell.includes('max-w-[720px]'));
  assert.ok(workspaceHook.includes('sidePanelAllowedViews'));
  assert.ok(workspaceHook.includes("const defaultView = options.shell === 'popup' ? 'this-page' : 'all-notes';"));
});
