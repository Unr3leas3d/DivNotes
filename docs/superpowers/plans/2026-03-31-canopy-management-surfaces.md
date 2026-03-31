# Canopy Management Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make popup and sidepanel note-management usable by adding in-app note editing, collapsible site grouping, tag-filter-only note lists, clear-filter actions, and cleaner folder management interactions.

**Architecture:** Keep popup and sidepanel on the shared workspace model, but evolve the filter state from single-tag detail into reusable multi-filter state that both shells can consume. Add one shared note editor dialog for popup and sidepanel, then let each shell render its own grouping and folder affordances on top of that shared editing primitive.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind CSS, Chrome Extension MV3 APIs, local storage-backed services, Node `node:test`

---

## Preflight Notes

- This plan builds on `main` at commit `0e879ea`.
- Batch 1 already removed popup and sidepanel browser dialogs. Do not reintroduce `window.alert`, `window.confirm`, or `window.prompt` in any React workspace surface.
- Favor shared workspace components when behavior must match between popup and sidepanel.
- Keep shell-specific differences limited to layout density, not behavior.

## File Map

- `src/lib/extension-workspace-types.ts`
  Replace single-tag view state with a multi-tag filter shape that can power popup and sidepanel consistently.
- `src/lib/use-extension-workspace.ts`
  Store and derive shared tag-filter state, clear-filter behavior, and any new note-edit dialog selection state that should survive shell navigation.
- `src/lib/extension-workspace-actions.ts`
  Add explicit actions for toggling tags, clearing filters, and saving edited notes through existing services.
- `src/lib/extension-selectors.ts`
  Keep grouped-note and tag-summary helpers stable while adding any new derived helpers needed for collapsible site sections and tag-filter rendering.
- `src/lib/extension-selectors.test.ts`
  Unit coverage for shared grouping, tag filtering, and clear-filter semantics.
- `src/components/workspace/WorkspaceNoteCard.tsx`
  Add explicit edit affordances and simplify metadata so the shared card can support popup and sidepanel editing without making navigation ambiguous.
- `src/components/workspace/WorkspaceActionDialog.tsx`
  Reuse the existing dialog shell for note editing and folder creation where possible.
- `src/components/workspace/WorkspaceNoteEditorDialog.tsx`
  New shared popup-and-sidepanel note editor surface built around existing `StoredNote` and services.
- `src/components/workspace/WorkspaceTagFilterBar.tsx`
  New shared filter chip row with clear-all affordance.
- `src/popup/Dashboard.tsx`
  Own popup note-editor dialog state and pass edit/navigation callbacks into the active view.
- `src/popup/components/AllNotesView.tsx`
  Convert site groups into collapsible sections and remove the misleading second summary line.
- `src/popup/components/TagsView.tsx`
  Stop listing tagged notes until at least one tag is selected and add clear-filter affordances.
- `src/popup/components/FoldersView.tsx`
  Keep `New Folder` in-page and reflect folder colors more clearly.
- `src/sidepanel/App.tsx`
  Own sidepanel note-editor dialog state, clear-filter wiring, and any search interactions that must reset with navigation.
- `src/sidepanel/components/AllNotesView.tsx`
  Convert grouped sites into collapsible sections and remove the extra per-group summary line.
- `src/sidepanel/components/TagsView.tsx`
  Preserve multi-tag behavior, but hide note results until filters exist and add explicit clear-all controls.
- `src/sidepanel/components/FoldersView.tsx`
  Finish the in-app folder UX: visible subfolder action, cleaner color changes, persistent reorder handling, and better hover containment.
- `src/sidepanel/components/FolderTreeNodeItem.tsx`
  Expand the row action surface to expose subfolder and reorder affordances without burying them in the context menu.
- `src/sidepanel/hooks/useDragAndDrop.ts`
  Extend folder drag-and-drop from pure reparenting to ordered sibling reordering.
- `src/lib/folders-service.ts`
  Persist folder order updates when sibling order changes.
- `tests/canopy-management-surfaces.test.mjs`
  New source-inspection regression suite for popup and sidepanel management-surface behavior.
- `tests/canopy-shell-login.test.mjs`
  Keep the shell batch green while adding assertions that the new management behavior does not regress popup or sidepanel layout contracts.

### Task 1: Shared Filter State And Regression Harness

**Files:**
- Create: `tests/canopy-management-surfaces.test.mjs`
- Modify: `src/lib/extension-workspace-types.ts`
- Modify: `src/lib/use-extension-workspace.ts`
- Modify: `src/lib/extension-workspace-actions.ts`
- Modify: `src/lib/extension-selectors.test.ts`

- [ ] **Step 1: Write the failing regression checks for shared filter state**

```js
test('workspace view state stores multiple active tag filters and clear-filters resets them', () => {
  const workspaceTypes = read('src/lib/extension-workspace-types.ts');
  const workspaceHook = read('src/lib/use-extension-workspace.ts');
  const workspaceActions = read('src/lib/extension-workspace-actions.ts');

  assert.ok(workspaceTypes.includes('tagIds: string[];'));
  assert.ok(workspaceHook.includes('const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])'));
  assert.ok(workspaceActions.includes('toggleTagFilter'));
  assert.ok(workspaceActions.includes('clearFilters: () => {'));
});
```

- [ ] **Step 2: Add one pure unit test for tag-filter matching**

```ts
test('noteHasAllTagValues matches every active tag value for multi-tag filters', () => {
  const resolver = createTagResolver(sampleTags);
  assert.equal(resolver.noteHasAllTagValues(sampleNotes[0], ['tag-1', 'tag-2']), true);
  assert.equal(resolver.noteHasAllTagValues(sampleNotes[1], ['tag-1', 'tag-2']), false);
});
```

- [ ] **Step 3: Run the targeted tests to verify they fail**

Run: `node --test tests/canopy-management-surfaces.test.mjs src/lib/extension-selectors.test.ts`

Expected: FAIL because `tagIds`, `selectedTagIds`, and `toggleTagFilter` do not exist yet.

- [ ] **Step 4: Implement the minimal shared filter model**

```ts
export interface ViewState {
  active: WorkspaceView;
  folderId: string | null;
  tagIds: string[];
}

const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

toggleTagFilter: (tagId: string) => {
  setSelectedTagIds((current) =>
    current.includes(tagId) ? current.filter((value) => value !== tagId) : [...current, tagId]
  );
},
clearFilters: () => {
  setSelectedFolderId(null);
  setSelectedTagIds([]);
},
```

- [ ] **Step 5: Re-run the targeted tests**

Run: `node --test tests/canopy-management-surfaces.test.mjs src/lib/extension-selectors.test.ts`

Expected: PASS

- [ ] **Step 6: Commit the shared filter state**

```bash
git add tests/canopy-management-surfaces.test.mjs src/lib/extension-workspace-types.ts src/lib/use-extension-workspace.ts src/lib/extension-workspace-actions.ts src/lib/extension-selectors.test.ts
git commit -m "feat: add shared workspace tag filter state"
```

### Task 2: Shared Popup And Sidepanel Note Editing

**Files:**
- Create: `src/components/workspace/WorkspaceNoteEditorDialog.tsx`
- Modify: `src/components/workspace/WorkspaceNoteCard.tsx`
- Modify: `src/popup/Dashboard.tsx`
- Modify: `src/sidepanel/App.tsx`
- Modify: `src/sidepanel/components/NoteCard.tsx`
- Test: `tests/canopy-management-surfaces.test.mjs`

- [ ] **Step 1: Extend the regression suite for in-app editing**

```js
test('popup and sidepanel wire a shared workspace note editor dialog', () => {
  const popupDashboard = read('src/popup/Dashboard.tsx');
  const sidepanelApp = read('src/sidepanel/App.tsx');
  const workspaceEditor = read('src/components/workspace/WorkspaceNoteEditorDialog.tsx');
  const workspaceCard = read('src/components/workspace/WorkspaceNoteCard.tsx');

  assert.ok(workspaceEditor.includes('notesService.update'));
  assert.ok(workspaceCard.includes('Edit note'));
  assert.ok(popupDashboard.includes('WorkspaceNoteEditorDialog'));
  assert.ok(sidepanelApp.includes('WorkspaceNoteEditorDialog'));
});
```

- [ ] **Step 2: Run the regression suite to verify it fails**

Run: `node --test tests/canopy-management-surfaces.test.mjs`

Expected: FAIL because the shared editor dialog and edit action do not exist yet.

- [ ] **Step 3: Implement the minimal shared note editor dialog**

```tsx
export function WorkspaceNoteEditorDialog({ note, folders, tags, open, onOpenChange, onSaved }) {
  const [draft, setDraft] = useState(note.content);

  async function handleSave() {
    const service = await getNotesService();
    await service.update(note.id, { content: draft, folderId: selectedFolderId, tags: selectedTagIds });
    onSaved();
    onOpenChange(false);
  }

  return (
    <WorkspaceActionDialog
      open={open}
      title="Edit note"
      description="Update this note without leaving Canopy."
      confirmLabel="Save changes"
    >
      {/* editor fields */}
    </WorkspaceActionDialog>
  );
}
```

- [ ] **Step 4: Wire popup and sidepanel cards to open the shared editor**

Run the smallest viable behavior:
- clicking `Edit note` opens the dialog
- saving updates storage-backed notes
- the existing navigation action remains available separately as `Go to note`

- [ ] **Step 5: Re-run the regression suite**

Run: `node --test tests/canopy-management-surfaces.test.mjs`

Expected: PASS

- [ ] **Step 6: Commit the shared editor**

```bash
git add src/components/workspace/WorkspaceNoteEditorDialog.tsx src/components/workspace/WorkspaceNoteCard.tsx src/popup/Dashboard.tsx src/sidepanel/App.tsx src/sidepanel/components/NoteCard.tsx tests/canopy-management-surfaces.test.mjs
git commit -m "feat: add workspace note editing"
```

### Task 3: All Notes And Tags UX

**Files:**
- Modify: `src/popup/components/AllNotesView.tsx`
- Modify: `src/sidepanel/components/AllNotesView.tsx`
- Modify: `src/popup/components/TagsView.tsx`
- Modify: `src/sidepanel/components/TagsView.tsx`
- Create: `src/components/workspace/WorkspaceTagFilterBar.tsx`
- Test: `tests/canopy-management-surfaces.test.mjs`

- [ ] **Step 1: Add failing checks for collapsible site groups and tag-filter-only note lists**

```js
test('all-notes views render collapsible site groups without a secondary summary line', () => {
  const popupAllNotes = read('src/popup/components/AllNotesView.tsx');
  const sidepanelAllNotes = read('src/sidepanel/components/AllNotesView.tsx');

  assert.ok(popupAllNotes.includes('aria-expanded'));
  assert.ok(sidepanelAllNotes.includes('aria-expanded'));
  assert.ok(!popupAllNotes.includes('{group.pageTitle}'));
  assert.ok(!sidepanelAllNotes.includes('{group.pageTitle}'));
});

test('tag views only render notes when active tag filters exist', () => {
  const popupTags = read('src/popup/components/TagsView.tsx');
  const sidepanelTags = read('src/sidepanel/components/TagsView.tsx');

  assert.ok(popupTags.includes('selectedTagIds.length === 0'));
  assert.ok(sidepanelTags.includes('activeTagIds.size === 0'));
  assert.ok(popupTags.includes('Clear filters'));
  assert.ok(sidepanelTags.includes('Clear filters'));
});
```

- [ ] **Step 2: Run the regression suite to verify it fails**

Run: `node --test tests/canopy-management-surfaces.test.mjs`

Expected: FAIL because the current views still render `group.pageTitle` and popup tags show note cards with no active filter.

- [ ] **Step 3: Implement the minimal view updates**

Use the same behavior in both shells:

- site groups default to expanded for the first visible hostname and collapsed for the rest
- clicking the group header toggles the site section
- group header shows hostname and note count only
- tags view shows a helpful empty state until one or more tags are selected
- `Clear filters` resets every active tag filter without changing the current root view

- [ ] **Step 4: Re-run the regression suite**

Run: `node --test tests/canopy-management-surfaces.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit the list and tag UX**

```bash
git add src/components/workspace/WorkspaceTagFilterBar.tsx src/popup/components/AllNotesView.tsx src/sidepanel/components/AllNotesView.tsx src/popup/components/TagsView.tsx src/sidepanel/components/TagsView.tsx tests/canopy-management-surfaces.test.mjs
git commit -m "feat: polish workspace note grouping and tag filters"
```

### Task 4: Folder Workspace Polish

**Files:**
- Modify: `src/popup/components/FoldersView.tsx`
- Modify: `src/sidepanel/components/FoldersView.tsx`
- Modify: `src/sidepanel/components/FolderTreeNodeItem.tsx`
- Modify: `src/sidepanel/hooks/useDragAndDrop.ts`
- Modify: `src/lib/folders-service.ts`
- Modify: `src/lib/types.ts`
- Test: `tests/canopy-management-surfaces.test.mjs`

- [ ] **Step 1: Add failing checks for folder color, subfolder, and reorder affordances**

```js
test('folder views expose visible creation and reorder affordances without browser dialogs', () => {
  const popupFolders = read('src/popup/components/FoldersView.tsx');
  const sidepanelFolders = read('src/sidepanel/components/FoldersView.tsx');
  const folderTreeNode = read('src/sidepanel/components/FolderTreeNodeItem.tsx');
  const dragHook = read('src/sidepanel/hooks/useDragAndDrop.ts');

  assert.ok(popupFolders.includes('New Folder'));
  assert.ok(sidepanelFolders.includes('new-subfolder'));
  assert.ok(folderTreeNode.includes('FolderPlus'));
  assert.ok(dragHook.includes('onReorderFolder'));
  assert.ok(!sidepanelFolders.includes('window.prompt'));
  assert.ok(!sidepanelFolders.includes('window.confirm'));
});
```

- [ ] **Step 2: Run the regression suite to verify it fails**

Run: `node --test tests/canopy-management-surfaces.test.mjs`

Expected: FAIL because the tree item does not expose a visible subfolder action and drag-and-drop does not persist reordering yet.

- [ ] **Step 3: Implement the folder polish**

Minimum acceptable behavior:

- new folders use rotating green shades from the existing palette instead of defaulting to `null`
- sidepanel folder rows use a full-width hover treatment that stays inside the rounded container
- each folder row exposes a visible subfolder action without opening the context menu first
- drag-and-drop can reorder folders among siblings by updating `order`, not just `parentId`
- popup folder cards render folder color as part of the list so color changes are discoverable

- [ ] **Step 4: Re-run the regression suite**

Run: `node --test tests/canopy-management-surfaces.test.mjs`

Expected: PASS

- [ ] **Step 5: Commit the folder polish**

```bash
git add src/popup/components/FoldersView.tsx src/sidepanel/components/FoldersView.tsx src/sidepanel/components/FolderTreeNodeItem.tsx src/sidepanel/hooks/useDragAndDrop.ts src/lib/folders-service.ts src/lib/types.ts tests/canopy-management-surfaces.test.mjs
git commit -m "feat: improve workspace folder management"
```

### Task 5: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run the focused management test suite**

Run: `node --test tests/canopy-management-surfaces.test.mjs src/lib/extension-selectors.test.ts tests/canopy-shell-login.test.mjs tests/eden-bright-redesign.test.mjs`

Expected: PASS with zero failures.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: exit code `0`

- [ ] **Step 3: Perform manual extension checks**

Verify in Chrome:

1. Popup `All Notes` groups collapse and expand by hostname.
2. Popup and sidepanel `Tags` show no note list until one or more tags are selected.
3. Popup and sidepanel can edit an existing note without leaving the extension UI.
4. Folder creation stays in-app and newly created folders rotate through green shades.
5. Sidepanel folder reorder persists after refresh.

- [ ] **Step 4: Commit any final fixes**

```bash
git add .
git commit -m "test: verify canopy management surfaces"
```
