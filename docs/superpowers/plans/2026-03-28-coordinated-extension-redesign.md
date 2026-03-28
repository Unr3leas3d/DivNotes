# Coordinated Extension Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the logged-in popup, side panel, content selector overlays, placed-note states, and inline editor into one Eden.so-inspired extension workspace that matches the approved 2026-03-28 references.

**Architecture:** Introduce one shared workspace state layer for auth, current-tab context, notes, folders, tags, selectors, and shell actions, then render compact popup views and richer side-panel views from the same model. Split the content script into reusable DOM builder modules so selector overlays, placed-note states, and the inline editor stop living as one monolithic imperative block inside `src/content/index.tsx`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Chrome Extension APIs (Manifest V3), plain DOM content-script modules, Node `node:test`, `tsx --test`, Vite

**Spec:** `docs/superpowers/specs/2026-03-28-coordinated-extension-redesign-design.md`

---

## File Structure

### New files to create

```text
src/lib/extension-selectors.ts               # Pure derived selectors for this-page, all-notes, folders, and tags
src/lib/extension-selectors.test.ts          # Selector regression tests
src/lib/use-extension-workspace.ts           # Shared popup/side-panel state + shell actions
src/components/workspace/TopNavPills.tsx     # Shared muted pill-group navigation
src/components/workspace/WorkspaceNoteCard.tsx # Shared compact/rich note card shell
src/components/workspace/WorkspaceEmptyState.tsx # Shared calm empty/unavailable state
src/popup/components/PopupShell.tsx          # Logged-in popup frame/header/back handling
src/popup/components/ThisPageView.tsx        # Popup current-page summary view
src/popup/components/AllNotesView.tsx        # Popup grouped-domain notes view
src/popup/components/FoldersView.tsx         # Popup folder index + folder-detail state
src/popup/components/TagsView.tsx            # Popup tags filter view
src/popup/components/SettingsView.tsx        # Popup dedicated settings screen
src/sidepanel/components/SidePanelShell.tsx  # Side-panel header/actions/frame
src/sidepanel/components/ThisPageView.tsx    # Side-panel current-page workspace
src/sidepanel/components/AllNotesView.tsx    # Side-panel grouped notes workspace
src/sidepanel/components/SettingsView.tsx    # Side-panel dedicated settings screen
src/content/overlay-ui.ts                    # Pure DOM builders for selector/status/badge/preview overlays
src/content/overlay-ui.test.ts               # Overlay DOM builder tests
src/content/editor-surface.ts                # Pure DOM builders for inline editor shell + controls
src/content/editor-surface.test.ts           # Inline editor DOM builder tests
```

### Existing files to modify

```text
src/popup/App.tsx
src/popup/Dashboard.tsx
src/sidepanel/App.tsx
src/sidepanel/components/SegmentedControl.tsx
src/sidepanel/components/FoldersView.tsx
src/sidepanel/components/TagsView.tsx
src/sidepanel/components/NoteCard.tsx
src/background/service-worker.js
src/content/index.tsx
src/content/note-editor-helpers.ts
src/content/note-editor-helpers.test.ts
tests/eden-bright-redesign.test.mjs
```

### Legacy cleanup after rewiring

```text
src/sidepanel/components/SitesView.tsx       # Remove only after ThisPageView + AllNotesView are wired and references are gone
```

### Verification note

Do not use `npx tsc --noEmit` as the success gate for this plan. This repo currently has unrelated baseline typecheck failures. Use targeted tests plus `npm run build` as the implementation gate unless the typecheck baseline is fixed as part of the work.

### Task 1: Build the shared workspace selectors and shell actions

**Files:**
- Create: `src/lib/extension-selectors.ts`
- Create: `src/lib/extension-selectors.test.ts`
- Create: `src/lib/use-extension-workspace.ts`
- Modify: `src/background/service-worker.js`
- Test: `src/lib/extension-selectors.test.ts`

- [ ] **Step 1: Write the failing selector tests**

Create `src/lib/extension-selectors.test.ts` with pure-data tests for the view model the popup and side panel will both consume:

```ts
test('selectThisPageNotes filters by normalized current page url and newest-first order', () => {
  const result = selectThisPageNotes(sampleNotes, 'https://app.example.com/docs');
  assert.deepEqual(result.map((note) => note.id), ['note-2', 'note-1']);
});

test('groupNotesByHostname returns compact grouped rows for the all-notes view', () => {
  const groups = groupNotesByHostname(sampleNotes);
  assert.equal(groups[0]?.hostname, 'app.example.com');
  assert.equal(groups[0]?.notes.length, 2);
});

test('buildTagSummaries computes counts and filtered note ids', () => {
  const summaries = buildTagSummaries(sampleTags, sampleNotes);
  assert.equal(summaries[0]?.count, 3);
});

test('buildViewCounts returns shared pill counts for popup and side panel', () => {
  const counts = buildViewCounts({
    notes: sampleNotes,
    folders: sampleFolders,
    tags: sampleTags,
    currentPageUrl: 'https://app.example.com/docs',
  });
  assert.equal(counts['this-page'], 2);
  assert.equal(counts['folders'], 4);
});
```

- [ ] **Step 2: Run the new selector test file to confirm RED**

Run: `npx tsx --test src/lib/extension-selectors.test.ts`

Expected: FAIL because `src/lib/extension-selectors.ts` does not exist yet.

- [ ] **Step 3: Implement the pure selectors**

Create `src/lib/extension-selectors.ts` with explicit exported helpers instead of one opaque mega-function:

```ts
export function selectThisPageNotes(notes: StoredNote[], pageUrl: string | null): StoredNote[] {}
export function groupNotesByHostname(notes: StoredNote[]): DomainGroup[] {}
export function buildFolderSummaries(notes: StoredNote[], folders: StoredFolder[]): FolderSummary[] {}
export function buildTagSummaries(tags: StoredTag[], notes: StoredNote[]): TagSummary[] {}
export function buildViewCounts(input: ViewCountInput): Record<'this-page' | 'all-notes' | 'folders' | 'tags', number> {}
export function filterNotesBySearch(notes: StoredNote[], query: string): StoredNote[] {}
```

Keep these functions pure and data-only so popup, side panel, and tests do not depend on Chrome APIs.

- [ ] **Step 4: Add the shared workspace hook**

Create `src/lib/use-extension-workspace.ts` to own:

- auth mode and email/local label
- current-tab URL/title/hostname lookup
- storage-backed `notes`, `folders`, `tags`
- explicit `loading` state for auth, current-tab, and data hydration
- explicit per-shell `error` state for current-tab lookup and storage/action failures
- derived per-view counts/badges for `this-page`, `all-notes`, `folders`, and `tags`
- active view state: `this-page | all-notes | folders | tags | settings`
- popup folder-detail selection and tag filter state
- shell actions: `activateInspector`, `openSidePanel`, `openPopup`, `exportNotes`, `importNotes`, `clearAllNotes`, `logout`

Expose a stable interface like:

```ts
export type WorkspaceView = 'this-page' | 'all-notes' | 'folders' | 'tags' | 'settings';

export function useExtensionWorkspace(options: { shell: 'popup' | 'sidepanel' }) {
  return {
    auth,
    currentPage,
    data,
    derived,
    counts,
    loading,
    error,
    view,
    setView,
    actions,
  };
}
```

- [ ] **Step 5: Extend background support for the shared shell actions**

Modify `src/background/service-worker.js` to add an `OPEN_POPUP` message path using `chrome.action.openPopup()` and keep `ACTIVATE_INSPECTOR` as the canonical inspector message name. Do not rename the inspector message in this plan; the approved spec locked that message name for stability.

- [ ] **Step 6: Re-run the selector tests and build the extension**

Run: `npx tsx --test src/lib/extension-selectors.test.ts`

Expected: PASS

Run: `npm run build`

Expected: PASS

- [ ] **Step 7: Commit only in an isolated clean worktree**

If this plan is executed in a dirty workspace, skip the commit. If it is executed in a clean feature worktree, use:

```bash
git add src/lib/extension-selectors.ts src/lib/extension-selectors.test.ts src/lib/use-extension-workspace.ts src/background/service-worker.js
git commit -m "feat: add shared extension workspace state"
```

### Task 2: Rebuild the logged-in popup around routed views and shared pills

**Files:**
- Create: `src/components/workspace/TopNavPills.tsx`
- Create: `src/components/workspace/WorkspaceNoteCard.tsx`
- Create: `src/components/workspace/WorkspaceEmptyState.tsx`
- Create: `src/popup/components/PopupShell.tsx`
- Create: `src/popup/components/ThisPageView.tsx`
- Create: `src/popup/components/AllNotesView.tsx`
- Create: `src/popup/components/FoldersView.tsx`
- Create: `src/popup/components/TagsView.tsx`
- Create: `src/popup/components/SettingsView.tsx`
- Modify: `src/popup/App.tsx`
- Modify: `src/popup/Dashboard.tsx`
- Modify: `tests/eden-bright-redesign.test.mjs`
- Test: `tests/eden-bright-redesign.test.mjs`

- [ ] **Step 1: Tighten the popup regression markers before rewriting the shell**

Extend `tests/eden-bright-redesign.test.mjs` with a new `workspaceHook` file read for `src/lib/use-extension-workspace.ts`, then add assertions that encode the approved logged-in popup structure:

```js
assert.ok(workspaceHook.includes("export type WorkspaceView = 'this-page' | 'all-notes' | 'folders' | 'tags' | 'settings';"));
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
```

- [ ] **Step 2: Run the popup regression test to confirm RED**

Run: `node --test tests/eden-bright-redesign.test.mjs`

Expected: FAIL because the current popup is still the old dashboard.

- [ ] **Step 3: Build the shared popup primitives**

Create:

- `TopNavPills.tsx` for the exact shared muted-container plus one dark active pill treatment
- `WorkspaceNoteCard.tsx` with a `density: 'compact' | 'comfortable'` prop
- `WorkspaceEmptyState.tsx` for calm empty/unavailable/loading fallback blocks

The navigation component must render inactive tabs as labels inside one container, not as separate pill buttons.

- [ ] **Step 4: Replace the old popup dashboard with a routed shell**

Create `src/popup/components/PopupShell.tsx` and rewrite `src/popup/Dashboard.tsx` to become the logged-in popup workspace root:

- header with Canopy mark, serif wordmark, and per-view utility action slot
- routed body keyed by `this-page`, `all-notes`, `folders`, `tags`, `settings`
- back navigation for settings and popup folder-detail state
- no popup note form; `+ Add Note` must dispatch inspector activation and close the popup

Keep `src/popup/App.tsx` responsible only for auth gating between `LoginForm` and the logged-in dashboard shell.

- [ ] **Step 5: Implement the popup views from the approved references**

Create the popup view files with these responsibilities:

- `ThisPageView.tsx`: current-page note summary + full-width `+ Add Note`
- `AllNotesView.tsx`: search + grouped-by-domain notes
- `FoldersView.tsx`: folder index + compact folder-detail substate with back affordance
- `TagsView.tsx`: chip filters + filtered note list
- `SettingsView.tsx`: account/data/about sections using shared shell actions, including version text, Chrome Web Store link, and Privacy Policy link

Use the shared selector outputs from Task 1 instead of re-implementing grouping/count logic inside the components.

- [ ] **Step 6: Re-run the popup regression test and the pages build**

Run: `node --test tests/eden-bright-redesign.test.mjs`

Expected: PASS

Run: `npm run build:pages`

Expected: PASS

- [ ] **Step 7: Commit only if the execution workspace is clean**

```bash
git add src/components/workspace src/popup/App.tsx src/popup/Dashboard.tsx src/popup/components tests/eden-bright-redesign.test.mjs
git commit -m "feat: rebuild popup workspace views"
```

### Task 3: Rebuild the side panel around the same workspace model

**Files:**
- Create: `src/sidepanel/components/SidePanelShell.tsx`
- Create: `src/sidepanel/components/ThisPageView.tsx`
- Create: `src/sidepanel/components/AllNotesView.tsx`
- Create: `src/sidepanel/components/SettingsView.tsx`
- Modify: `src/sidepanel/App.tsx`
- Modify: `src/sidepanel/components/SegmentedControl.tsx`
- Modify: `src/sidepanel/components/FoldersView.tsx`
- Modify: `src/sidepanel/components/TagsView.tsx`
- Modify: `src/sidepanel/components/NoteCard.tsx`
- Modify: `tests/eden-bright-redesign.test.mjs`
- Test: `tests/eden-bright-redesign.test.mjs`

- [ ] **Step 1: Add failing side-panel markers to the static regression file**

Add assertions for the new information architecture and header actions:

```js
assert.ok(sidepanelApp.includes("'this-page' | 'all-notes' | 'folders' | 'tags'"));
assert.ok(sidepanelApp.includes('openPopup'));
assert.ok(sidepanelApp.includes('settings'));
assert.ok(segmentedControl.includes('This Page'));
assert.ok(segmentedControl.includes('All Notes'));
assert.ok(noteCard.includes('Scroll to element'));
```

- [ ] **Step 2: Run the regression suite to confirm RED**

Run: `node --test tests/eden-bright-redesign.test.mjs`

Expected: FAIL because `src/sidepanel/App.tsx` still uses `sites | folders | tags`.

- [ ] **Step 3: Update the shared side-panel navigation and note card layer**

Modify:

- `SegmentedControl.tsx` to support `this-page | all-notes | folders | tags`
- `NoteCard.tsx` to wrap or reuse `WorkspaceNoteCard.tsx` instead of maintaining a separate visual system
- `NoteCard.tsx` to keep a visible target affordance in comfortable density, labeled `Scroll to element` or another equally explicit target action wired to `onNavigate`

Do not keep two competing note-card designs.

- [ ] **Step 4: Build the new side-panel shell and top-level views**

Create `SidePanelShell.tsx`, `ThisPageView.tsx`, `AllNotesView.tsx`, and `SettingsView.tsx`, then rewrite `src/sidepanel/App.tsx` to use `useExtensionWorkspace({ shell: 'sidepanel' })`.

The shell header must expose:

- inspector toggle / add-note action
- open popup action wired through the new `OPEN_POPUP` background message
- settings entry

Both `ThisPageView.tsx` and `AllNotesView.tsx` must surface the note target action through the rebuilt card layer so the richer workspace still lets users jump to the anchored page element from the side panel.

`SettingsView.tsx` must mirror the spec-required account/data/about structure, including version text plus Chrome Web Store and Privacy Policy links.

- [ ] **Step 5: Refit folders and tags to the new workspace**

Modify `src/sidepanel/components/FoldersView.tsx` and `src/sidepanel/components/TagsView.tsx` so they keep their power-user behaviors but adopt:

- the new top-level navigation keys
- the shared note-card treatment
- the calmer Eden-inspired spacing and chips
- dedicated settings routing instead of in-view utility clutter
- existing drag-and-drop note/folder moves
- existing multi-select and bulk-action flows
- existing keyboard/tree interactions from `useTreeKeyboard`
- existing folder/tag context menus and create/rename flows

Only remove `src/sidepanel/components/SitesView.tsx` after this command returns no references:

Run: `rg -n "SitesView" src/sidepanel`

Expected: no output

- [ ] **Step 6: Re-run the regression suite and build the React surfaces**

Run: `node --test tests/eden-bright-redesign.test.mjs`

Expected: PASS

Run: `npm run build:pages`

Expected: PASS

- [ ] **Step 7: Commit only if the execution workspace is clean**

```bash
git add src/sidepanel/App.tsx src/sidepanel/components src/components/workspace tests/eden-bright-redesign.test.mjs
git commit -m "feat: rebuild sidepanel workspace views"
```

### Task 4: Split the selector overlay and placed-note states out of the content-script monolith

**Files:**
- Create: `src/content/overlay-ui.ts`
- Create: `src/content/overlay-ui.test.ts`
- Modify: `src/content/index.tsx`
- Modify: `tests/eden-bright-redesign.test.mjs`
- Test: `src/content/overlay-ui.test.ts`

- [ ] **Step 1: Write failing overlay builder tests**

Create `src/content/overlay-ui.test.ts` with fake-document tests for the approved overlay surfaces:

```ts
test('createSelectorGuide renders bottom-center guidance pill text', () => {
  const guide = createSelectorGuide(fakeDocument, 'Click to add a note · ESC to cancel');
  assert.equal(guide.textContent, 'Click to add a note · ESC to cancel');
});

test('createPlacedNoteBadge renders a compact dark badge without innerHTML', () => {
  const badge = createPlacedNoteBadge(fakeDocument);
  assert.equal(badge.tagName, 'DIV');
});
```

- [ ] **Step 2: Run the new overlay test file to confirm RED**

Run: `npx tsx --test src/content/overlay-ui.test.ts`

Expected: FAIL because `src/content/overlay-ui.ts` does not exist yet.

- [ ] **Step 3: Implement reusable overlay DOM builders**

Create `src/content/overlay-ui.ts` with pure builder functions for:

- hover selector pill
- bottom-center guidance pill
- selected-state confirmation pill
- compact placed-note badge
- bottom-right page note-count pill
- expanded note preview card shell

Keep these builders free of storage and event side effects so they stay testable.

- [ ] **Step 4: Rewire `src/content/index.tsx` to use the overlay builders**

Replace the current top-right status banner flow with the approved bottom-center guidance treatment. Move selector hover/selected overlay rendering, placed-note badge creation, note-count pill updates, and expanded preview card shell creation behind the new helper module.

Keep the existing message contracts intact:

- `ACTIVATE_INSPECTOR`
- `ADD_SELECTION_NOTE`
- `SCROLL_TO_NOTE`

- [ ] **Step 5: Lock the new content-overlay markers into the static regression test**

Extend `tests/eden-bright-redesign.test.mjs` to assert for the approved overlay strings and markers, for example:

```js
assert.ok(contentScript.includes('Click to add a note · ESC to cancel'));
assert.ok(contentScript.includes('Element selected · Opening note editor'));
assert.ok(contentScript.includes('createPlacedNoteBadge'));
assert.ok(contentScript.includes('createPageNoteCountPill'));
```

- [ ] **Step 6: Run the content tests and the full extension build**

Run: `npx tsx --test src/content/overlay-ui.test.ts`

Expected: PASS

Run: `node --test tests/eden-bright-redesign.test.mjs`

Expected: PASS

Run: `npm run build`

Expected: PASS

- [ ] **Step 7: Commit only if the execution workspace is clean**

```bash
git add src/content/overlay-ui.ts src/content/overlay-ui.test.ts src/content/index.tsx tests/eden-bright-redesign.test.mjs
git commit -m "feat: rebuild content selector and placed-note overlays"
```

### Task 5: Rebuild the inline editor as a dedicated content module

**Files:**
- Create: `src/content/editor-surface.ts`
- Create: `src/content/editor-surface.test.ts`
- Modify: `src/content/index.tsx`
- Modify: `src/content/note-editor-helpers.ts`
- Modify: `src/content/note-editor-helpers.test.ts`
- Test: `src/content/editor-surface.test.ts`
- Test: `src/content/note-editor-helpers.test.ts`

- [ ] **Step 1: Write the failing editor-surface tests**

Create `src/content/editor-surface.test.ts` with fake-document tests for the approved editor shell:

```ts
test('createEditorSurface renders title, body, tag row, pinned row, and save button', () => {
  const surface = createEditorSurface(fakeDocument, sampleState);
  assert.equal(surface.querySelector?.('[data-canopy-save]')?.textContent, 'Save');
});

test('createEditorSurface omits delete for new notes', () => {
  const surface = createEditorSurface(fakeDocument, { ...sampleState, isNew: true });
  assert.equal(surface.querySelector?.('[data-canopy-delete]'), null);
});
```

- [ ] **Step 2: Extend the helper tests for the new editor state rules**

Add tests to `src/content/note-editor-helpers.test.ts` for:

- save disabled when title and body are blank
- existing-folder selection wins over auto-suggest
- save merge logic preserves notes from other pages

- [ ] **Step 3: Run the editor-focused test files to confirm RED**

Run: `npx tsx --test src/content/editor-surface.test.ts src/content/note-editor-helpers.test.ts`

Expected: FAIL because the new editor module does not exist yet and the helper expectations are not implemented.

- [ ] **Step 4: Implement the dedicated editor surface builders**

Create `src/content/editor-surface.ts` with DOM builders for:

- panel shell and header
- title input
- body textarea
- folder control
- tag chip row plus `+ tag`
- pinned row
- inline error text
- primary save button

Use explicit element creation APIs instead of string-built `innerHTML` blocks wherever practical.

- [ ] **Step 5: Update the helpers for the simplified editor model**

Modify `src/content/note-editor-helpers.ts` so the helper layer supports the approved simplified flow:

- meaningful-content check for enabling save
- stable folder defaulting and chip labels
- storage merge behavior after save/delete

Keep folder/tag suggestion logic pure and reusable.

- [ ] **Step 6: Rewire `src/content/index.tsx` to use the new editor surface**

Replace the old editor creation path with the new module and preserve the required behavior:

- popup/side-panel `+ Add Note` leads to selector, then inline editor
- save persists through the existing notes/storage service path
- save failure keeps the editor open and shows inline error text
- delete shows only for existing notes
- `Escape` and close fully clear selection/highlight/editor state

- [ ] **Step 7: Re-run the editor tests and full build**

Run: `npx tsx --test src/content/editor-surface.test.ts src/content/note-editor-helpers.test.ts`

Expected: PASS

Run: `npm run build`

Expected: PASS

- [ ] **Step 8: Commit only if the execution workspace is clean**

```bash
git add src/content/editor-surface.ts src/content/editor-surface.test.ts src/content/index.tsx src/content/note-editor-helpers.ts src/content/note-editor-helpers.test.ts
git commit -m "feat: rebuild inline note editor surface"
```

### Task 6: Final regression sweep and coordinated manual verification

**Files:**
- Modify: `tests/eden-bright-redesign.test.mjs`
- Test: `tests/eden-bright-redesign.test.mjs`
- Test: `src/lib/extension-selectors.test.ts`
- Test: `src/content/overlay-ui.test.ts`
- Test: `src/content/editor-surface.test.ts`
- Test: `src/content/note-editor-helpers.test.ts`

- [ ] **Step 1: Make the static redesign test cover every approved surface**

Ensure `tests/eden-bright-redesign.test.mjs` covers:

- popup logged-in shell and settings markers
- shared top pill navigation markers
- shared per-view count/badge markers
- side-panel header actions and routed view markers
- side-panel note target affordance marker
- selector guidance / selected-state / placed-note markers
- inline editor shell markers
- `OPEN_POPUP` background message markers

Do not leave one surface dependent on manual memory alone.

- [ ] **Step 2: Run the static regression suite**

Run: `node --test tests/eden-bright-redesign.test.mjs`

Expected: PASS

- [ ] **Step 3: Run all focused TypeScript test files together**

Run: `npx tsx --test src/lib/extension-selectors.test.ts src/content/overlay-ui.test.ts src/content/editor-surface.test.ts src/content/note-editor-helpers.test.ts`

Expected: PASS

- [ ] **Step 4: Run the full extension build**

Run: `npm run build`

Expected: PASS

- [ ] **Step 5: Perform manual verification on the built extension**

Load `dist/` in `chrome://extensions` and verify:

- local mode popup
- authenticated mode popup
- popup navigation across `This Page`, `All Notes`, `Folders`, `Tags`, and `Settings`
- popup folder-detail state and back navigation
- side-panel header actions: inspector, open popup, settings
- side-panel navigation and search behavior
- popup `+ Add Note` closes popup and activates selector
- side-panel `+ Add Note` activates selector without opening a form in the panel
- selector hover and selected states
- placed-note badge, expanded preview card, and page note-count pill
- inline editor create, edit, delete, pin, folder, and tag flows
- cross-surface refresh after save/delete/pin/tag/folder updates

- [ ] **Step 6: Record any remaining deviations before claiming completion**

If any approved surface still differs materially from the screenshot or browser mockups, stop and fix it before calling the redesign done.

- [ ] **Step 7: Commit only if requested and only from a clean execution workspace**

```bash
git add tests/eden-bright-redesign.test.mjs src/lib/extension-selectors.test.ts src/content/overlay-ui.test.ts src/content/editor-surface.test.ts src/content/note-editor-helpers.test.ts
git commit -m "test: lock coordinated redesign regressions"
```
