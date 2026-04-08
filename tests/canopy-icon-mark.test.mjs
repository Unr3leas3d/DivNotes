import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('extension surfaces do not import or render the app icon', () => {
  const popupShell = read('src/popup/components/PopupShell.tsx');
  const sidePanelShell = read('src/sidepanel/components/SidePanelShell.tsx');
  const loginForm = read('src/popup/LoginForm.tsx');

  assert.ok(
    !popupShell.includes("import { CanopyMark } from '@/components/branding/CanopyMark';")
  );
  assert.ok(
    !sidePanelShell.includes("import { CanopyMark } from '@/components/branding/CanopyMark';")
  );
  assert.ok(
    !loginForm.includes("import { CanopyMark } from '@/components/branding/CanopyMark';")
  );
  assert.ok(!popupShell.includes('<CanopyMark'));
  assert.ok(!sidePanelShell.includes('<CanopyMark'));
  assert.ok(!loginForm.includes('<CanopyMark'));
});
