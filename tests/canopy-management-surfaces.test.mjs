import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('workspace view state stores multiple active tag filters and clear-filters resets them', () => {
  const workspaceTypes = read('src/lib/extension-workspace-types.ts');
  const workspaceHook = read('src/lib/use-extension-workspace.ts');
  const workspaceActions = read('src/lib/extension-workspace-actions.ts');

  assert.ok(workspaceTypes.includes('tagIds: string[];'));
  assert.ok(workspaceHook.includes('const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])'));
  assert.ok(workspaceActions.includes('toggleTagFilter'));
  assert.ok(workspaceActions.includes('clearFilters: () => {'));
});

test('popup and sidepanel wire a shared workspace note editor dialog', () => {
  const popupDashboard = read('src/popup/Dashboard.tsx');
  const popupThisPageView = read('src/popup/components/ThisPageView.tsx');
  const popupAllNotesView = read('src/popup/components/AllNotesView.tsx');
  const popupFoldersView = read('src/popup/components/FoldersView.tsx');
  const popupTagsView = read('src/popup/components/TagsView.tsx');
  const sidepanelApp = read('src/sidepanel/App.tsx');
  const sidepanelAllNotesView = read('src/sidepanel/components/AllNotesView.tsx');
  const sidepanelFoldersView = read('src/sidepanel/components/FoldersView.tsx');
  const sidepanelTagsView = read('src/sidepanel/components/TagsView.tsx');
  const sidepanelNoteCard = read('src/sidepanel/components/NoteCard.tsx');
  const workspaceEditor = read('src/components/workspace/WorkspaceNoteEditorDialog.tsx');
  const workspaceCard = read('src/components/workspace/WorkspaceNoteCard.tsx');

  assert.ok(workspaceEditor.includes('notesService.update'));
  assert.ok(!workspaceEditor.includes('tags:'));
  assert.ok(!workspaceEditor.includes('Tags'));
  assert.ok(workspaceCard.includes('Edit note'));
  assert.ok(!workspaceCard.includes('window.dispatchEvent'));
  assert.ok(popupDashboard.includes('WorkspaceNoteEditorDialog'));
  assert.ok(popupDashboard.includes('onEditNote'));
  assert.ok(popupThisPageView.includes('onEditNote'));
  assert.ok(popupAllNotesView.includes('onEditNote'));
  assert.ok(popupFoldersView.includes('onEditNote'));
  assert.ok(popupTagsView.includes('onEditNote'));
  assert.ok(sidepanelApp.includes('WorkspaceNoteEditorDialog'));
  assert.ok(sidepanelApp.includes('onEditNote'));
  assert.ok(sidepanelAllNotesView.includes('onEditNote'));
  assert.ok(sidepanelFoldersView.includes('onEditNote'));
  assert.ok(sidepanelTagsView.includes('onEditNote'));
  assert.ok(sidepanelNoteCard.includes('onEdit?: (note: StoredNote) => void;'));
});
