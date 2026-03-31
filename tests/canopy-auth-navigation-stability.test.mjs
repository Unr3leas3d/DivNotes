import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('workspace surfaces delegate note navigation through the background worker', () => {
  const popupDashboard = read('src/popup/Dashboard.tsx');
  const sidepanelApp = read('src/sidepanel/App.tsx');
  const serviceWorker = read('src/background/service-worker.js');

  assert.ok(popupDashboard.includes("type: 'OPEN_NOTE_TARGET'"));
  assert.ok(sidepanelApp.includes("type: 'OPEN_NOTE_TARGET'"));
  assert.ok(serviceWorker.includes("if (message.type === 'OPEN_NOTE_TARGET')"));
  assert.ok(serviceWorker.includes('chrome.tabs.onUpdated.addListener'));
});

test('note navigation copy is renamed and content tag entry no longer uses window.prompt', () => {
  const workspaceCard = read('src/components/workspace/WorkspaceNoteCard.tsx');
  const sidepanelNoteCard = read('src/sidepanel/components/NoteCard.tsx');
  const contentIndex = read('src/content/index.tsx');
  const editorSurface = read('src/content/editor-surface.ts');

  assert.ok(sidepanelNoteCard.includes('Go to note'));
  assert.ok(!sidepanelNoteCard.includes('Scroll to element'));
  assert.ok(!contentIndex.includes('window.prompt'));
  assert.ok(editorSurface.includes('data-canopy-tag-input'));
});

test('popup Google auth surfaces actionable inline failures', () => {
  const loginForm = read('src/popup/LoginForm.tsx');
  const googleAuth = read('src/lib/google-auth.ts');

  // chrome.identity is used in LoginForm (the call-site), not in google-auth.ts (which uses DI)
  assert.ok(loginForm.includes('chrome.identity'));
  assert.ok(googleAuth.includes('Google sign-in could not be started.'));
  assert.ok(loginForm.includes('Google sign-in failed'));
  assert.ok(loginForm.includes('onGoogleSessionPromotionChange(false)'));
});
