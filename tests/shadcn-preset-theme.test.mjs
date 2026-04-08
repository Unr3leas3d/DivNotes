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

test('shadcn preset foundation uses oklch tokens, Inter, and radix-vega config', () => {
  const css = read('src/styles/globals.css');
  const config = read('tailwind.config.js');
  const componentsConfig = read('components.json');
  const contentScript = read('src/content/index.tsx');
  const popupMain = read('src/popup/main.tsx');
  const sidepanelMain = read('src/sidepanel/main.tsx');

  assert.ok(css.includes('--background: oklch(1 0 0);'));
  assert.ok(css.includes('--primary: oklch(0.508 0.118 165.612);'));
  assert.ok(css.includes('--radius: 0.45rem;'));
  assert.ok(css.includes('--sidebar-primary: oklch(0.596 0.145 163.225);'));

  assert.ok(config.includes("border: 'var(--border)'"));
  assert.ok(config.includes("background: 'var(--background)'"));
  assert.ok(config.includes("'4xl': 'calc(var(--radius) * 2.6)'"));
  assert.ok(config.includes("sans: ['Inter Variable', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']"));
  assert.ok(config.includes("'hero': '0 16px 64px oklch(0.148 0.004 228.8 / 0.08)'"));

  assert.ok(componentsConfig.includes('"style": "radix-vega"'));
  assert.ok(componentsConfig.includes('"baseColor": "mist"'));
  assert.ok(componentsConfig.includes('"iconLibrary": "hugeicons"'));
  assert.ok(componentsConfig.includes('"hooks": "@/hooks"'));

  assert.ok(contentScript.includes("import interFontCss from '@fontsource-variable/inter/index.css?inline';"));
  assert.ok(contentScript.includes("const CONTENT_FONT_STYLE_ID = 'canopy-content-fonts';"));
  assert.ok(contentScript.includes('ensureContentFontStyles();'));
  assert.ok(popupMain.includes("import '@fontsource-variable/inter';"));
  assert.ok(sidepanelMain.includes("import '@fontsource-variable/inter';"));
});

test('representative UI files switch from lucide-react to hugeicons and theme tokens', () => {
  const button = read('src/components/ui/button.tsx');
  const dialog = read('src/components/ui/dialog.tsx');
  const dropdownMenu = read('src/components/ui/dropdown-menu.tsx');
  const popupDashboard = read('src/popup/Dashboard.tsx');
  const popupFolders = read('src/popup/components/FoldersView.tsx');
  const sidepanelApp = read('src/sidepanel/App.tsx');
  const sidepanelFolderTreeNode = read('src/sidepanel/components/FolderTreeNodeItem.tsx');
  const workspaceCard = read('src/components/workspace/WorkspaceNoteCard.tsx');
  const tagFilterBar = read('src/components/workspace/WorkspaceTagFilterBar.tsx');
  const iconHelper = read('src/components/ui/huge-icon.tsx');

  assert.ok(button.includes('focus-visible:ring-3'));
  assert.ok(button.includes("default: 'bg-primary text-primary-foreground hover:bg-primary/80'"));

  assert.ok(iconHelper.includes("import { HugeiconsIcon"));
  assert.ok(dialog.includes("import { Cancel01Icon } from '@hugeicons/core-free-icons';"));
  assert.ok(dialog.includes('border border-border bg-card p-5 shadow-elevated'));
  assert.ok(dialog.includes('<HugeIcon icon={Cancel01Icon} className="h-4 w-4" />'));

  assert.ok(dropdownMenu.includes("import { ArrowRight01Icon, RadioIcon, Tick02Icon } from '@hugeicons/core-free-icons';"));

  assert.ok(popupDashboard.includes('@hugeicons/core-free-icons') || popupDashboard.includes('HugeIcon'));
  assert.ok(popupFolders.includes('@hugeicons/core-free-icons') || popupFolders.includes('HugeIcon'));
  assert.ok(sidepanelApp.includes('@hugeicons/core-free-icons') || sidepanelApp.includes('icon-aliases'));
  assert.ok(sidepanelFolderTreeNode.includes('@hugeicons/core-free-icons') || sidepanelFolderTreeNode.includes('icon-aliases'));
  assert.ok(workspaceCard.includes('@hugeicons/core-free-icons') || workspaceCard.includes('HugeIcon'));

  assert.ok(!popupDashboard.includes('lucide-react'));
  assert.ok(!popupFolders.includes('lucide-react'));
  assert.ok(!sidepanelApp.includes('lucide-react'));
  assert.ok(!sidepanelFolderTreeNode.includes('lucide-react'));
  assert.ok(!workspaceCard.includes('lucide-react'));

  assert.ok(tagFilterBar.includes('rounded-[20px] border border-border bg-card shadow-card'));
  assert.ok(tagFilterBar.includes('border-primary bg-primary text-primary-foreground'));
  assert.ok(workspaceCard.includes('text-primary-foreground'));
});

test('content surfaces adopt the teal oklch palette', () => {
  const contentScript = read('src/content/index.tsx');
  const overlayUi = read('src/content/overlay-ui.ts');
  const editorSurface = read('src/content/editor-surface.ts');

  assert.ok(contentScript.includes('outline: 2px solid oklch(0.508 0.118 165.612 / 0.8) !important;'));
  assert.ok(contentScript.includes('background-color: oklch(0.865 0.127 207.078 / 0.08) !important;'));
  assert.ok(contentScript.includes('outline: 1px solid oklch(0.865 0.127 207.078 / 0.28) !important;'));

  assert.ok(overlayUi.includes("oklch(0.148 0.004 228.8 / 0.96)"));
  assert.ok(overlayUi.includes("oklch(0.979 0.021 166.113)"));
  assert.ok(overlayUi.includes("oklch(0.865 0.127 207.078 / 0.18)"));

  assert.ok(editorSurface.includes('linear-gradient(135deg, oklch(0.432 0.095 166.913), oklch(0.56 0.12 176))'));
  assert.ok(editorSurface.includes('oklch(0.704 0.191 22.216)'));
  assert.ok(editorSurface.includes('oklch(0.723 0.014 214.4)'));
});

test('sidepanel surfaces no longer use the old cream and dark-green literals', () => {
  const sidepanelApp = read('src/sidepanel/App.tsx');
  const sidepanelShell = read('src/sidepanel/components/SidePanelShell.tsx');
  const foldersView = read('src/sidepanel/components/FoldersView.tsx');
  const tagsView = read('src/sidepanel/components/TagsView.tsx');
  const allNotesView = read('src/sidepanel/components/AllNotesView.tsx');
  const thisPageView = read('src/sidepanel/components/ThisPageView.tsx');
  const noteCard = read('src/sidepanel/components/NoteCard.tsx');
  const folderTreeNode = read('src/sidepanel/components/FolderTreeNodeItem.tsx');

  const oldTokens = ['#fcfbf7', '#ece7de', '#e7e2d8', '#f8f6f1', '#173628', '#526357'];
  for (const token of oldTokens) {
    assert.ok(!sidepanelApp.includes(token), `expected App.tsx to drop ${token}`);
    assert.ok(!sidepanelShell.includes(token), `expected SidePanelShell.tsx to drop ${token}`);
    assert.ok(!foldersView.includes(token), `expected FoldersView.tsx to drop ${token}`);
    assert.ok(!tagsView.includes(token), `expected TagsView.tsx to drop ${token}`);
    assert.ok(!allNotesView.includes(token), `expected AllNotesView.tsx to drop ${token}`);
    assert.ok(!thisPageView.includes(token), `expected ThisPageView.tsx to drop ${token}`);
    assert.ok(!noteCard.includes(token), `expected NoteCard.tsx to drop ${token}`);
    assert.ok(!folderTreeNode.includes(token), `expected FolderTreeNodeItem.tsx to drop ${token}`);
  }

  assert.ok(sidepanelShell.includes('bg-background text-foreground'));
  assert.ok(sidepanelApp.includes('border-border bg-card'));
  assert.ok(foldersView.includes('border-border bg-card'));
  assert.ok(tagsView.includes('border-border bg-card'));
  assert.ok(allNotesView.includes('border-border bg-muted'));
  assert.ok(thisPageView.includes('border-border bg-card'));
});

test('signed-out popup surfaces use theme tokens instead of the old auth palette', () => {
  const loginForm = read('src/popup/LoginForm.tsx');

  const oldTokens = ['#fcfbf7', '#ece7de', '#e7e2d8', '#f8f6f1', '#173628', '#9aa294', '#aba79c'];
  for (const token of oldTokens) {
    assert.ok(!loginForm.includes(token), `expected LoginForm.tsx to drop ${token}`);
  }

  assert.ok(loginForm.includes('bg-background text-foreground'));
  assert.ok(loginForm.includes('border border-border bg-card'));
  assert.ok(loginForm.includes('bg-primary text-primary-foreground shadow-elevated'));
  assert.ok(loginForm.includes('text-muted-foreground'));
  assert.ok(loginForm.includes('bg-secondary'));
});

test('content note editor surfaces drop the old dark-green inline palette', () => {
  const editorSurface = read('src/content/editor-surface.ts');
  const contentIndex = read('src/content/index.tsx');

  const oldTokens = ['#052415', '#F5EFE9', 'rgba(171,255,192', 'rgba(5,36,21'];
  for (const token of oldTokens) {
    assert.ok(!editorSurface.includes(token), `expected editor-surface.ts to drop ${token}`);
    assert.ok(!contentIndex.includes(token), `expected content/index.tsx to drop ${token}`);
  }

  assert.ok(editorSurface.includes('linear-gradient(135deg, oklch(0.432 0.095 166.913), oklch(0.56 0.12 176))'));
  assert.ok(
    contentIndex.includes('oklch(0.148 0.004 228.8 / 0.34)') ||
      contentIndex.includes('oklch(0.148 0.004 228.8 / 0.18)')
  );
  assert.ok(contentIndex.includes('const editorWidth = 308;'));
  assert.ok(contentIndex.includes('const editorHeight = 385;'));
});

test('content note editor interaction states are explicitly themed', () => {
  const editorSurface = read('src/content/editor-surface.ts');
  const contentIndex = read('src/content/index.tsx');

  assert.ok(editorSurface.includes('all:initial'));
  assert.ok(editorSurface.includes('font-family:Inter Variable,system-ui,sans-serif'));
  assert.ok(editorSurface.includes('appearance:none'));
  assert.ok(editorSurface.includes('outline:none'));
  assert.ok(editorSurface.includes('transition:border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease'));
  assert.ok(editorSurface.includes('accent-color:oklch(0.432 0.095 166.913)'));

  assert.ok(contentIndex.includes("bodyTextarea.addEventListener('focus'"));
  assert.ok(contentIndex.includes("bodyTextarea.addEventListener('blur'"));
  assert.ok(contentIndex.includes('const applyHoverState = ('));
  assert.ok(contentIndex.includes('applyHoverState(\n    closeBtn,'));
  assert.ok(contentIndex.includes('applyHoverState(\n    folderChangeButton,'));
  assert.ok(contentIndex.includes('applyHoverState(\n    saveBtn,'));
  assert.ok(contentIndex.includes("tagInput?.addEventListener('focus'"));
  assert.ok(contentIndex.includes("input.addEventListener('focus'"));
});

test('content overlays drop remaining legacy literals and use Inter across the content script', () => {
  const overlayUi = read('src/content/overlay-ui.ts');
  const contentIndex = read('src/content/index.tsx');

  const oldTokens = ['#7a8a7d', '#1a5c2e', '#dc2626', 'rgba(5,36,21', 'rgba(26, 92, 46', 'rgba(171, 255, 192'];
  for (const token of oldTokens) {
    assert.ok(!overlayUi.includes(token), `expected overlay-ui.ts to drop ${token}`);
    assert.ok(!contentIndex.includes(token), `expected content/index.tsx to drop ${token}`);
  }

  assert.ok(overlayUi.includes("fontFamily: 'Inter Variable, system-ui, sans-serif'"));
  assert.ok(contentIndex.includes("fontFamily: 'Inter Variable, system-ui, sans-serif'"));
});
