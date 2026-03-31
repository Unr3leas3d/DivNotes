# Canopy Inline Editor And Anchoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make placed notes and the inline editor stay attached to their target element during hover, edit, and page scroll, while simplifying the editor chrome to match the approved Canopy editing UX.

**Architecture:** Split overlay positioning from the monolithic content script into testable anchoring helpers, then rebuild both the preview card and editor to use the same anchored container model. Simplify the editor surface to be body-first, hide raw element info from the visible header, and replace the current folder dropdown with a focused selector flow that can also create folders inline.

**Tech Stack:** TypeScript, DOM-based content script UI, Chrome Extension MV3 runtime messaging, local storage-backed note and folder services, Node `node:test`

---

## Preflight Notes

- This plan intentionally stays inside the content-script layer. Do not mix popup or sidepanel list work into it.
- The current clipping and jumping behavior comes from one-time `getBoundingClientRect()` placement in `src/content/index.tsx`; the fix is architectural, not just CSS tuning.
- Keep the content-script UI DOM-only. Do not introduce React into the page layer.
- Reuse existing storage and note-save helpers rather than inventing a second editor persistence path.

## File Map

- `src/content/index.tsx`
  Remove inline positioning logic, reuse anchored helper modules, and wire the new editor and preview behaviors.
- `src/content/editor-surface.ts`
  Simplify the editor header and fields, remove the title input, and replace the folder-change UI with a selector-style control plus create-folder affordance.
- `src/content/editor-surface.test.ts`
  Regression coverage for the simplified editor structure.
- `src/content/overlay-ui.ts`
  Update the preview-card shell so it can render inside the new anchored container without clipping.
- `src/content/overlay-ui.test.ts`
  Regression coverage for the preview-card shell and action layout.
- `src/content/anchored-overlay.ts`
  New helper for measuring targets, choosing card/editor placement, and updating positions on scroll and resize.
- `src/content/anchored-overlay.test.ts`
  New unit tests for placement, clamping, and anchor-follow behavior.
- `src/content/note-editor-helpers.ts`
  Extend folder-draft helpers so the editor can open nested folder selectors and create a folder inline while editing.
- `src/content/note-editor-helpers.test.ts`
  Cover folder creation and folder-label resolution in the new selector flow.

### Task 1: Extract Anchored Overlay Positioning

**Files:**
- Create: `src/content/anchored-overlay.ts`
- Create: `src/content/anchored-overlay.test.ts`
- Modify: `src/content/index.tsx`

- [ ] **Step 1: Write the failing anchoring tests**

```ts
test('computeAnchoredOverlayPosition keeps cards inside the viewport while staying attached to the target', () => {
  const result = computeAnchoredOverlayPosition({
    anchorRect: { top: 580, left: 980, right: 1020, bottom: 620, width: 40, height: 40 },
    overlaySize: { width: 300, height: 260 },
    viewport: { width: 1024, height: 640 },
    offset: 12,
  });

  assert.deepEqual(result, { top: 308, left: 716, placement: 'above-end' });
});

test('watchAnchorPosition emits a new position when the page scrolls', () => {
  let calls = 0;
  const stop = watchAnchorPosition(fakeWindow, fakeElement, () => {
    calls += 1;
  });

  fakeWindow.dispatch('scroll');
  assert.equal(calls, 1);
  stop();
});
```

- [ ] **Step 2: Run the new anchoring tests to verify they fail**

Run: `node --test src/content/anchored-overlay.test.ts`

Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Implement the minimal anchoring helper**

```ts
export function computeAnchoredOverlayPosition({ anchorRect, overlaySize, viewport, offset }) {
  let top = anchorRect.bottom + offset;
  let left = anchorRect.left;

  if (top + overlaySize.height > viewport.height) top = anchorRect.top - overlaySize.height - offset;
  if (left + overlaySize.width > viewport.width) left = viewport.width - overlaySize.width - 16;
  if (left < 8) left = 8;
  if (top < 8) top = 8;

  return { top, left, placement: top < anchorRect.top ? 'above-start' : 'below-start' };
}
```

- [ ] **Step 4: Update `index.tsx` to consume the helper for both note cards and the editor**

Replace inline `editorWidth` / `editorHeight` / viewport clamping math with the shared helper and add a lightweight `watchAnchorPosition()` subscription so open overlays follow the target element on scroll and resize.

- [ ] **Step 5: Re-run the anchoring tests**

Run: `node --test src/content/anchored-overlay.test.ts`

Expected: PASS

- [ ] **Step 6: Commit the anchoring helper**

```bash
git add src/content/anchored-overlay.ts src/content/anchored-overlay.test.ts src/content/index.tsx
git commit -m "refactor: extract anchored overlay positioning"
```

### Task 2: Keep Placed-Note Cards Attached And Unclipped

**Files:**
- Modify: `src/content/index.tsx`
- Modify: `src/content/overlay-ui.ts`
- Modify: `src/content/overlay-ui.test.ts`

- [ ] **Step 1: Extend the preview-card regression tests**

```ts
test('createNotePreviewCardShell keeps edit and move actions in the footer', () => {
  const card = createNotePreviewCardShell(fakeDocument, samplePreview);

  assert.equal(card.querySelector('[data-canopy-edit]')?.textContent, 'Edit');
  assert.equal(card.querySelector('[data-canopy-move]')?.textContent, 'Move');
  assert.equal(card.querySelector('[data-canopy-preview-panel]')?.dataset.canopyPreviewPanel, '');
});
```

- [ ] **Step 2: Run the preview-card test to verify it fails if new structure is absent**

Run: `node --test src/content/overlay-ui.test.ts`

Expected: FAIL after adding the new assertion because the preview panel wrapper marker does not exist yet.

- [ ] **Step 3: Implement anchored preview-card behavior**

Minimum acceptable behavior:

- the hover card is rendered from the shared anchoring helper
- it stays visually attached while the page scrolls
- card placement flips above or below to avoid clipping
- clicking `Edit` keeps the card anchored to the same target instead of reopening elsewhere

- [ ] **Step 4: Re-run the preview-card tests**

Run: `node --test src/content/overlay-ui.test.ts src/content/anchored-overlay.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the placed-note card work**

```bash
git add src/content/index.tsx src/content/overlay-ui.ts src/content/overlay-ui.test.ts src/content/anchored-overlay.test.ts
git commit -m "fix: keep placed note cards anchored"
```

### Task 3: Simplify The Inline Editor Surface

**Files:**
- Modify: `src/content/editor-surface.ts`
- Modify: `src/content/editor-surface.test.ts`

- [ ] **Step 1: Update the editor-surface tests first**

```ts
test('createEditorSurface hides raw element info and removes the title input', () => {
  const surface = createEditorSurface(fakeDocument, sampleState);

  assert.equal(surface.querySelector('[data-canopy-editor-title]'), null);
  assert.equal(surface.querySelector('[data-canopy-editor-element-info]'), null);
  assert.equal(surface.querySelector('[data-canopy-folder-trigger]')?.textContent, 'Folder');
});
```

- [ ] **Step 2: Run the editor-surface tests to verify they fail**

Run: `node --test src/content/editor-surface.test.ts`

Expected: FAIL because the title input and raw element-info chip still exist.

- [ ] **Step 3: Implement the minimal editor redesign**

```ts
export type EditorSurfaceState = {
  isNew: boolean;
  body: string;
  folderLabel: string;
  tagLabels: readonly string[];
  pinned: boolean;
  errorMessage: string;
  saveDisabled: boolean;
};

function createEditorHeader(doc, state) {
  const heading = applyDataAttr(doc.createElement('span'), 'canopy-editor-heading');
  heading.textContent = state.isNew ? 'New note' : 'Edit note';
  // no visible raw selector / HTML-ish element tag in the header
}
```

Implement these visible changes:

- remove the title input entirely
- remove the visible raw HTML-ish element info from the header
- keep delete and close in the header for existing notes
- keep body, tags, folder, pin, and save actions

- [ ] **Step 4: Re-run the editor-surface tests**

Run: `node --test src/content/editor-surface.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the simplified editor surface**

```bash
git add src/content/editor-surface.ts src/content/editor-surface.test.ts
git commit -m "refactor: simplify inline note editor surface"
```

### Task 4: Folder Selector Flow And Inline Folder Creation

**Files:**
- Modify: `src/content/index.tsx`
- Modify: `src/content/editor-surface.ts`
- Modify: `src/content/note-editor-helpers.ts`
- Modify: `src/content/note-editor-helpers.test.ts`

- [ ] **Step 1: Add failing tests for folder selection and creation**

```ts
test('buildFolderSelectionTree returns nested folder choices for the inline editor', () => {
  const options = buildFolderSelectionTree(sampleFolders);
  assert.deepEqual(options.map((option) => option.label), ['Inbox', 'Product', 'Product / Specs']);
});

test('createFolderDraft returns a new child folder with sibling order and green shade', () => {
  const folder = createFolderDraft({ name: 'Launch', parentId: 'folder-1', siblings: sampleFolders });
  assert.equal(folder.parentId, 'folder-1');
  assert.equal(typeof folder.color, 'string');
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `node --test src/content/note-editor-helpers.test.ts`

Expected: FAIL because the selector helpers and inline folder draft helper do not exist yet.

- [ ] **Step 3: Implement the selector flow**

Minimum acceptable behavior:

- clicking the folder control opens a selector-style menu, not an expanding inline tree
- selecting a parent folder can reveal its nested children in the same flow
- the flow includes `Create folder` and `Create subfolder here`
- creating a folder updates storage and immediately selects the new folder in the active editor

- [ ] **Step 4: Re-run the helper tests**

Run: `node --test src/content/note-editor-helpers.test.ts src/content/editor-surface.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the folder selector flow**

```bash
git add src/content/index.tsx src/content/editor-surface.ts src/content/note-editor-helpers.ts src/content/note-editor-helpers.test.ts
git commit -m "feat: add inline editor folder selector flow"
```

### Task 5: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run the focused content-script test suite**

Run: `node --test src/content/anchored-overlay.test.ts src/content/editor-surface.test.ts src/content/note-editor-helpers.test.ts src/content/overlay-ui.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: exit code `0`

- [ ] **Step 3: Perform manual browser checks**

Verify in Chrome:

1. Hovering a placed note near the viewport edge does not clip the card.
2. Clicking `Edit` keeps the editor attached to the same element.
3. Scrolling while a preview card or editor is open keeps the UI anchored to the target.
4. Edit mode no longer shows the raw HTML-ish tag info or the title field.
5. Creating a folder from the editor immediately selects it and keeps the editor open.

- [ ] **Step 4: Commit any final fixes**

```bash
git add .
git commit -m "test: verify inline editor anchoring"
```
