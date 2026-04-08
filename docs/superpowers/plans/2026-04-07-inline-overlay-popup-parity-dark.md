# Inline Overlay Popup-Parity Dark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the content-script hover preview and anchored inline editor so they match the approved dark shadcn popup-parity direction while keeping the current behavior model intact.

**Architecture:** Keep the content-script behavior in place and limit the work to the existing DOM-builder modules. Update tests first so the new structure is locked in, then reshape the overlay and editor builders to emit the richer dark surfaces without changing the controller flow.

**Tech Stack:** TypeScript DOM-builder modules, node:test, Vite extension build, shadcn preset dark tokens, inline content-script styles

---

## File Structure

- `src/content/overlay-ui.ts`
  Hover preview card shell and badge-adjacent note preview presentation.
- `src/content/overlay-ui.test.ts`
  Regression tests for preview card structure and actions.
- `src/content/editor-surface.ts`
  Anchored editor shell, header, textarea, metadata rows, and footer button styles.
- `src/content/editor-surface.test.ts`
  Regression tests for editor shell structure and controls.
- `tests/shadcn-preset-theme.test.mjs`
  Static content-theme assertions, if needed.

### Task 1: Lock the approved hover-preview structure in tests

**Files:**
- Modify: `src/content/overlay-ui.test.ts`
- Test: `src/content/overlay-ui.test.ts`

- [ ] **Step 1: Extend the hover preview test to reject the old header-heavy structure**

Add assertions proving the preview card:
- does not surface the element info pill in the visible card body contract
- does not require a title
- still exposes preview body, tags, and footer actions
- keeps `Move`, `Edit`, and `Delete` in the footer

- [ ] **Step 2: Run the overlay tests to verify RED**

Run: `node --test src/content/overlay-ui.test.ts`
Expected: FAIL because the current preview card still renders the old metadata header and title.

- [ ] **Step 3: Commit the failing-test checkpoint only after implementation passes**

```bash
git add src/content/overlay-ui.test.ts src/content/overlay-ui.ts
git commit -m "refactor: restyle content note preview card"
```

### Task 2: Lock the approved editor-shell presentation in tests

**Files:**
- Modify: `src/content/editor-surface.test.ts`
- Test: `src/content/editor-surface.test.ts`

- [ ] **Step 1: Extend the editor tests first**

Add assertions proving the editor:
- keeps `Edit note` / `New note` heading behavior
- groups destructive and close actions in the header
- renders folder and tags as structured rows instead of loose inline chrome
- keeps the body-first layout with no visible title input or element-info row
- keeps a single primary footer save action

- [ ] **Step 2: Run the editor tests to verify RED**

Run: `node --test src/content/editor-surface.test.ts`
Expected: FAIL because the current builder still emits the lighter legacy shell and looser metadata layout.

- [ ] **Step 3: Commit the editor redesign only after implementation passes**

```bash
git add src/content/editor-surface.test.ts src/content/editor-surface.ts
git commit -m "refactor: align inline editor with popup-parity dark theme"
```

### Task 3: Implement the new hover preview and editor surfaces

**Files:**
- Modify: `src/content/overlay-ui.ts`
- Modify: `src/content/editor-surface.ts`
- Modify: `tests/shadcn-preset-theme.test.mjs` (if static assertions need to change)
- Test: `src/content/overlay-ui.test.ts`
- Test: `src/content/editor-surface.test.ts`

- [ ] **Step 1: Implement the preview-card shell changes**

Update `src/content/overlay-ui.ts` so `createNotePreviewCardShell()`:
- removes the visible selector pill/header strip
- removes the visible note title
- promotes the preview body to the first content block
- keeps tag chips as supporting metadata
- styles the footer buttons and surfaces with the dark shadcn token palette

- [ ] **Step 2: Implement the anchored editor shell changes**

Update `src/content/editor-surface.ts` so the editor:
- uses the darker popup-parity shell
- strengthens header hierarchy and button grouping
- deepens the textarea/input surface and radius
- turns folder and tag controls into structured muted rows
- preserves the existing behavior markers used by `index.tsx`

- [ ] **Step 3: Re-run focused content-surface tests**

Run: `node --test src/content/overlay-ui.test.ts src/content/editor-surface.test.ts`
Expected: PASS

- [ ] **Step 4: Re-run the wider content-theme regression set**

Run: `node --test src/content/editor-surface.test.ts src/content/overlay-ui.test.ts src/content/note-editor-helpers.test.ts tests/shadcn-preset-theme.test.mjs`
Expected: PASS

- [ ] **Step 5: Build the worktree bundle**

Run: `npm run build`
Expected: PASS
