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

test('extension theme foundation uses Eden Bright tokens and typography', () => {
  const css = read('src/styles/globals.css');
  const config = read('tailwind.config.js');

  assert.ok(!css.includes('family=Inter'), 'expected Inter import to be removed');
  assert.ok(css.includes('--background: 50 14% 97%;'));
  assert.ok(css.includes('--foreground: 152 75% 8%;'));
  assert.ok(css.includes('--accent: 140 100% 80%;'));
  assert.ok(css.includes('--radius: 0.875rem;'));

  assert.ok(
    config.includes("sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']"),
    'expected Tailwind sans stack to use system fonts'
  );
  assert.ok(config.includes("serif: ['Georgia', 'serif']"));
  assert.ok(config.includes("'float-slow'"));
  assert.ok(config.includes("'hero': '0 16px 64px rgba(5,36,21,0.08)'"));
});

test('landing theme matches Eden Bright foundations', () => {
  const css = read('landing/src/index.css');
  const config = read('landing/tailwind.config.js');

  assert.ok(!css.includes('family=Inter'), 'expected landing Inter import to be removed');
  assert.ok(css.includes('--background: 50 14% 97%;'));
  assert.ok(css.includes('--foreground: 152 75% 8%;'));
  assert.ok(config.includes("serif: ['Georgia', 'serif']"));
});

test('tag colors switch to the green palette from the approved redesign', () => {
  const types = read('src/lib/types.ts');

  assert.ok(types.includes("'#052415', '#1a5c2e', '#3d8b5e', '#6ead71'"));
  assert.ok(types.includes("'#ABFFC0', '#0d9488', '#65784c', '#84cc16'"));
});

test('popup auth flow matches the Paper-driven redesign shell', () => {
  const loginForm = read('src/popup/LoginForm.tsx');

  assert.ok(loginForm.includes('const [showEmailForm, setShowEmailForm] = useState(false);'));
  assert.ok(
    loginForm.includes("const authOptionBaseClass = 'h-[50px] w-full rounded-[12px] border border-[#e7e2d8] bg-white px-4 text-[15px] font-medium text-[#314339] shadow-[0_1px_2px_rgba(5,36,21,0.03)] transition-colors hover:bg-[#f8f6f1] disabled:cursor-wait disabled:opacity-70';")
  );
  assert.ok(
    loginForm.includes('className="mx-auto flex w-full max-w-[316px] flex-1 flex-col justify-center px-7 pb-6 pt-11"')
  );
  assert.ok(
    loginForm.includes('max-w-[260px] text-center text-[14px] leading-[1.45] text-[#9aa294]')
  );
  assert.ok(
    loginForm.includes('h-[50px] w-full rounded-[12px] bg-[#f3f1eb] text-[15px] font-semibold text-[#314339] transition-colors hover:bg-[#ece8df]')
  );
  assert.ok(loginForm.includes('Continue with Google'));
  assert.ok(loginForm.includes('Continue with Email'));
  assert.ok(loginForm.includes('Use Local Only'));
  assert.ok(loginForm.includes('Think on top of the web.'));
});

test('content script styles switch from purple to Eden Bright green and cream treatments', () => {
  const contentScript = read('src/content/index.tsx');

  assert.ok(contentScript.includes("outline: 2px solid rgba(26, 92, 46, 0.8) !important;"));
  assert.ok(contentScript.includes("background: '#052415', color: '#F5EFE9'"));
  assert.ok(contentScript.includes("width: '22px'"));
  assert.ok(contentScript.includes("height: '22px'"));
  assert.ok(contentScript.includes('background: #FAFAF7; border: 1px solid rgba(5,36,21,0.06);'));
});

test('side panel segmented control uses themed active and inactive states', () => {
  const segmentedControl = read('src/sidepanel/components/SegmentedControl.tsx');

  assert.ok(segmentedControl.includes("bg-primary text-primary-foreground font-semibold shadow-card"));
  assert.ok(segmentedControl.includes("bg-muted text-foreground hover:bg-secondary"));
});

test('background worker keeps OPEN_POPUP support alongside ACTIVATE_INSPECTOR messaging', () => {
  const serviceWorker = read('src/background/service-worker.js');

  assert.ok(serviceWorker.includes("if (message.type === 'OPEN_POPUP')"));
  assert.ok(serviceWorker.includes('chrome.action?.openPopup'));
  assert.ok(serviceWorker.includes('chrome.action.openPopup()'));
  assert.ok(serviceWorker.includes("if (message.type === 'ACTIVATE_INSPECTOR')"));
  assert.ok(serviceWorker.includes("{ type: 'ACTIVATE_INSPECTOR' }"));
});
