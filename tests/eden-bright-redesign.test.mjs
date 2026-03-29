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
  const popupDashboard = read('src/popup/Dashboard.tsx');
  const workspaceHook = read('src/lib/use-extension-workspace.ts');

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
  assert.ok(
    workspaceHook.includes(
      "export type WorkspaceView = 'this-page' | 'all-notes' | 'folders' | 'tags' | 'settings';"
    )
  );
  assert.ok(popupDashboard.includes('This Page'));
  assert.ok(popupDashboard.includes('All Notes'));
  assert.ok(popupDashboard.includes('Folders'));
  assert.ok(popupDashboard.includes('Tags'));
  assert.ok(popupDashboard.includes('New Folder'));
  assert.ok(popupDashboard.includes('Account'));
  assert.ok(popupDashboard.includes('Data'));
  assert.ok(popupDashboard.includes('About'));
  assert.ok(popupDashboard.includes('Chrome Web Store'));
  assert.ok(popupDashboard.includes('Privacy Policy'));
  assert.ok(popupDashboard.includes('const handleOpenSidePanel = async () => {'));
  assert.ok(popupDashboard.includes('await workspace.actions.openSidePanel();'));
  assert.ok(popupDashboard.includes('onOpenSidePanel={() => void handleOpenSidePanel()}'));
  assert.ok(popupDashboard.includes("const chromeWebStoreUrl = 'https://divnotes.com';"));
  assert.ok(popupDashboard.includes("const privacyPolicyUrl = 'https://divnotes.com/privacy';"));
});

test('content script styles switch from purple to Eden Bright green and cream treatments', () => {
  const contentScript = read('src/content/index.tsx');
  const overlayUi = read('src/content/overlay-ui.ts');
  const editorSurface = read('src/content/editor-surface.ts');

  assert.ok(contentScript.includes("outline: 2px solid rgba(26, 92, 46, 0.8) !important;"));
  assert.ok(contentScript.includes('Click to add a note · ESC to cancel'));
  assert.ok(contentScript.includes('Element selected · Opening note editor…'));
  assert.ok(contentScript.includes('createPlacedNoteBadge'));
  assert.ok(contentScript.includes('createPageNoteCountPill'));
  assert.ok(contentScript.includes('createEditorSurface'));
  assert.ok(contentScript.includes('function clearSelectedElement() {'));
  assert.ok(contentScript.includes('clearSelectedElement();'));
  assert.ok(contentScript.includes("console.error('[Canopy] Failed to delete note', error);"));
  assert.ok(contentScript.includes("console.error('[Canopy] Failed to move note', error);"));
  assert.ok(contentScript.includes('.canopy-has-note {'));
  assert.ok(contentScript.includes('outline: 1px solid rgba(171, 255, 192, 0.28) !important;'));
  assert.ok(contentScript.includes('let pendingEditorOpenTimeout: ReturnType<typeof setTimeout> | null = null;'));
  assert.ok(overlayUi.includes("background: '#052415'"));
  assert.ok(overlayUi.includes("width: '22px'"));
  assert.ok(overlayUi.includes("height: '22px'"));
  assert.ok(overlayUi.includes("background: '#FAFAF7'"));
  assert.ok(overlayUi.includes("border: '1px solid rgba(5,36,21,0.06)'"));
  assert.ok(overlayUi.includes("setDataAttribute(pill, 'canopyOverlay', 'selector-guide')"));
  assert.ok(overlayUi.includes("pointerEvents: 'auto'"));
  assert.ok(editorSurface.includes("applyDataAttr(doc.createElement('div'), 'canopy-editor-shell')"));
  assert.ok(editorSurface.includes("applyDataAttr(doc.createElement('input'), 'canopy-editor-title')"));
  assert.ok(editorSurface.includes("applyDataAttr(doc.createElement('textarea'), 'canopy-editor-body')"));
  assert.ok(editorSurface.includes("'canopy-close'"));
  assert.ok(editorSurface.includes("'canopy-delete'"));
  assert.ok(editorSurface.includes("'canopy-add-tag'"));
  assert.ok(editorSurface.includes("createPrimarySaveButton(doc, state)"));
});

test('side panel segmented control uses themed active and inactive states', () => {
  const sidepanelApp = read('src/sidepanel/App.tsx');
  const segmentedControl = read('src/sidepanel/components/SegmentedControl.tsx');
  const noteCard = read('src/sidepanel/components/NoteCard.tsx');
  const allNotesView = read('src/sidepanel/components/AllNotesView.tsx');
  const popupSettingsView = read('src/popup/components/SettingsView.tsx');
  const workspaceNoteCard = read('src/components/workspace/WorkspaceNoteCard.tsx');

  assert.ok(sidepanelApp.includes("'this-page' | 'all-notes' | 'folders' | 'tags'"));
  assert.ok(sidepanelApp.includes('openPopup'));
  assert.ok(sidepanelApp.includes('settings'));
  assert.ok(sidepanelApp.includes('divnotes_screen_share'));
  assert.ok(sidepanelApp.includes('Screen Share Mode'));
  assert.ok(segmentedControl.includes('TopNavPills'));
  assert.ok(segmentedControl.includes('This Page'));
  assert.ok(segmentedControl.includes('All Notes'));
  assert.ok(!segmentedControl.includes('counts?: Partial<Record<ViewMode, number>>'));
  assert.ok(workspaceNoteCard.includes('title?: string | null;'));
  assert.ok(workspaceNoteCard.includes('details?: React.ReactNode;'));
  assert.ok(workspaceNoteCard.includes("interactionMode?: 'open' | 'toggle';"));
  assert.ok(workspaceNoteCard.includes("aria-expanded={interactionMode === 'toggle' ? expanded : undefined}"));
  assert.ok(noteCard.includes('WorkspaceNoteCard'));
  assert.ok(noteCard.includes('interactionMode="toggle"'));
  assert.ok(noteCard.includes('const [expanded, setExpanded] = useState(false);'));
  assert.ok(noteCard.includes('DOMPurify.sanitize'));
  assert.ok(noteCard.includes('marked.parse'));
  assert.ok(noteCard.includes('Scroll to element'));
  assert.ok(noteCard.includes('dangerouslySetInnerHTML'));
  assert.ok(allNotesView.includes('<PinnedSection'));
  assert.ok(popupSettingsView.includes('showSidePanelAction = true'));
  assert.ok(popupSettingsView.includes('{showSidePanelAction ? ('));
});

test('background worker keeps OPEN_POPUP support alongside ACTIVATE_INSPECTOR messaging', () => {
  const serviceWorker = read('src/background/service-worker.js');

  assert.ok(serviceWorker.includes("if (message.type === 'OPEN_POPUP')"));
  assert.ok(serviceWorker.includes("if (!chrome.action?.openPopup)"));
  assert.ok(serviceWorker.includes("sendResponse({ success: false, error: 'Popup opening is not supported in this browser context.' })"));
  assert.ok(serviceWorker.includes('Promise.resolve(chrome.action.openPopup())'));
  assert.ok(serviceWorker.includes('sendResponse({ success: true });'));
  assert.ok(serviceWorker.includes('success: false,'));
  assert.ok(serviceWorker.includes("if (message.type === 'ACTIVATE_INSPECTOR')"));
  assert.ok(serviceWorker.includes("{ type: 'ACTIVATE_INSPECTOR' }"));
});
