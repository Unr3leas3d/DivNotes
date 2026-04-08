# Editor Controller, Navigation & Tab Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify inline and popup/sidepanel note editors behind a shared controller, fix inline folder creation, make "Go to Note" open a new tab, and add "Open Folder as Tab Group".

**Architecture:** A pure `editorReducer` state machine in `src/lib/editor-controller.ts` replaces ad-hoc state in both renderers. The service worker gains smart new-tab navigation and a tab-group handler. FoldersView components get tab group trigger buttons.

**Tech Stack:** TypeScript, Chrome Extension APIs (tabs, tabGroups), React (useReducer), pure DOM rendering.

---

## Scope Check

This spec has four concerns but they share messaging infrastructure and file touchpoints (service worker, FoldersView). Implementing as one plan is appropriate.

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `src/lib/editor-controller.ts` | Shared editor state machine: state type, reducer, initializer, save payload builder |
| `src/lib/editor-controller.test.ts` | Unit tests for reducer transitions, validation, save payload |
| `src/lib/tab-group-utils.ts` | Hex-to-Chrome-color mapping, URL deduplication for tab groups |

### Modified Files

| File | Changes |
|------|---------|
| `src/content/index.tsx` | Replace inline editor state with `editorReducer`; use `buildSavePayload()`; wire folder creation through `CREATE_FOLDER` message |
| `src/components/workspace/WorkspaceNoteEditorDialog.tsx` | Replace `useState` calls with `useReducer(editorReducer, ...)` and `buildSavePayload()` |
| `src/background/service-worker.js` | Modify `OPEN_NOTE_TARGET` for smart new-tab; add `OPEN_FOLDER_AS_GROUP` handler |
| `src/sidepanel/components/FolderTreeNodeItem.tsx` | Add "Open as Tab Group" icon button on folder rows |
| `src/sidepanel/components/FoldersView.tsx` | Pass tab group handler down to tree nodes |
| `src/popup/components/FoldersView.tsx` | Add "Open as Tab Group" button on folder detail header |

---

## Task 1: Create the Editor Controller State Machine

**Files:**
- Create: `src/lib/editor-controller.ts`

- [ ] **Step 1: Create `EditorState` type and `EditorAction` union**

```ts
// src/lib/editor-controller.ts
import type { StoredNote } from './types';

export interface EditorState {
  mode: 'new' | 'edit';
  noteId: string | null;

  // Visible fields
  body: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;

  // Folder selector
  folderSelectorOpen: boolean;
  folderCreating: boolean;
  folderDraftName: string;
  folderDraftParentId: string | null;

  // UI state
  saving: boolean;
  saveDisabled: boolean;
  errorMessage: string;

  // Hidden (used for save, not rendered)
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
}

export type EditorAction =
  | { type: 'SET_BODY'; body: string }
  | { type: 'SET_FOLDER'; folderId: string | null }
  | { type: 'ADD_TAG'; tag: string }
  | { type: 'REMOVE_TAG'; tag: string }
  | { type: 'TOGGLE_PIN' }
  | { type: 'OPEN_FOLDER_SELECTOR' }
  | { type: 'CLOSE_FOLDER_SELECTOR' }
  | { type: 'SET_FOLDER_DRAFT'; name: string; parentId: string | null }
  | { type: 'FOLDER_CREATED'; folderId: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; message: string }
  | { type: 'DELETE_START' }
  | { type: 'DELETE_SUCCESS' };
```

- [ ] **Step 2: Implement `createEditorState`**

```ts
export interface TargetInfo {
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
  suggestedFolderId?: string | null;
}

export function createEditorState(
  targetInfo: TargetInfo,
  note?: StoredNote | null
): EditorState {
  const isEdit = !!note;
  return {
    mode: isEdit ? 'edit' : 'new',
    noteId: note?.id ?? null,
    body: note?.content ?? '',
    folderId: note?.folderId ?? targetInfo.suggestedFolderId ?? null,
    tags: note?.tags ? [...note.tags] : [],
    pinned: note?.pinned ?? false,
    folderSelectorOpen: false,
    folderCreating: false,
    folderDraftName: '',
    folderDraftParentId: null,
    saving: false,
    saveDisabled: isEdit ? false : true,
    errorMessage: '',
    url: targetInfo.url,
    hostname: targetInfo.hostname,
    pageTitle: targetInfo.pageTitle,
    elementSelector: targetInfo.elementSelector,
    elementTag: targetInfo.elementTag,
    elementInfo: targetInfo.elementInfo,
    elementXPath: targetInfo.elementXPath,
    elementTextHash: targetInfo.elementTextHash,
    elementPosition: targetInfo.elementPosition,
    selectedText: targetInfo.selectedText,
  };
}
```

- [ ] **Step 3: Implement `editorReducer`**

```ts
function isBodyMeaningful(body: string): boolean {
  return body.trim().length > 0;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_BODY':
      return {
        ...state,
        body: action.body,
        saveDisabled: !isBodyMeaningful(action.body),
        errorMessage: '',
      };
    case 'SET_FOLDER':
      return {
        ...state,
        folderId: action.folderId,
        folderSelectorOpen: false,
      };
    case 'ADD_TAG': {
      const normalized = action.tag.trim().replace(/^#+/, '').toLowerCase();
      if (!normalized || state.tags.includes(normalized)) return state;
      return { ...state, tags: [...state.tags, normalized] };
    }
    case 'REMOVE_TAG':
      return { ...state, tags: state.tags.filter((t) => t !== action.tag) };
    case 'TOGGLE_PIN':
      return { ...state, pinned: !state.pinned };
    case 'OPEN_FOLDER_SELECTOR':
      return { ...state, folderSelectorOpen: true };
    case 'CLOSE_FOLDER_SELECTOR':
      return { ...state, folderSelectorOpen: false, folderCreating: false, folderDraftName: '' };
    case 'SET_FOLDER_DRAFT':
      return {
        ...state,
        folderCreating: true,
        folderDraftName: action.name,
        folderDraftParentId: action.parentId,
      };
    case 'FOLDER_CREATED':
      return {
        ...state,
        folderId: action.folderId,
        folderSelectorOpen: false,
        folderCreating: false,
        folderDraftName: '',
        folderDraftParentId: null,
      };
    case 'SAVE_START':
      return { ...state, saving: true, errorMessage: '' };
    case 'SAVE_SUCCESS':
      return { ...state, saving: false };
    case 'SAVE_ERROR':
      return { ...state, saving: false, errorMessage: action.message };
    case 'DELETE_START':
      return { ...state, saving: true };
    case 'DELETE_SUCCESS':
      return { ...state, saving: false };
    default:
      return state;
  }
}
```

- [ ] **Step 4: Implement `buildSavePayload`**

```ts
export interface SavePayload {
  content: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
}

export function buildSavePayload(state: EditorState): SavePayload {
  return {
    content: state.body,
    folderId: state.folderId,
    tags: state.tags,
    pinned: state.pinned,
    url: state.url,
    hostname: state.hostname,
    pageTitle: state.pageTitle,
    elementSelector: state.elementSelector,
    elementTag: state.elementTag,
    elementInfo: state.elementInfo,
    elementXPath: state.elementXPath,
    elementTextHash: state.elementTextHash,
    elementPosition: state.elementPosition,
    selectedText: state.selectedText,
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor-controller.ts
git commit -m "feat: add shared editor controller state machine"
```

---

## Task 2: Unit Tests for Editor Controller

**Files:**
- Create: `src/lib/editor-controller.test.ts`

- [ ] **Step 1: Write tests for `createEditorState`**

```ts
import { describe, it, expect } from 'vitest';
import {
  createEditorState,
  editorReducer,
  buildSavePayload,
  type TargetInfo,
  type EditorState,
} from './editor-controller';
import type { StoredNote } from './types';

const baseTarget: TargetInfo = {
  url: 'https://example.com/page',
  hostname: 'example.com',
  pageTitle: 'Test Page',
  elementSelector: '#main',
  elementTag: 'div',
  elementInfo: '<div#main>',
};

describe('createEditorState', () => {
  it('creates new note state with saveDisabled true', () => {
    const state = createEditorState(baseTarget);
    expect(state.mode).toBe('new');
    expect(state.noteId).toBeNull();
    expect(state.body).toBe('');
    expect(state.saveDisabled).toBe(true);
    expect(state.saving).toBe(false);
  });

  it('creates edit state from existing note', () => {
    const note: StoredNote = {
      id: 'note-1',
      url: 'https://example.com/page',
      hostname: 'example.com',
      pageTitle: 'Test Page',
      elementSelector: '#main',
      elementTag: 'div',
      elementInfo: '<div#main>',
      content: 'Hello world',
      createdAt: '2026-01-01T00:00:00Z',
      folderId: 'folder-1',
      tags: ['tag-a'],
      pinned: true,
    };
    const state = createEditorState(baseTarget, note);
    expect(state.mode).toBe('edit');
    expect(state.noteId).toBe('note-1');
    expect(state.body).toBe('Hello world');
    expect(state.folderId).toBe('folder-1');
    expect(state.tags).toEqual(['tag-a']);
    expect(state.pinned).toBe(true);
    expect(state.saveDisabled).toBe(false);
  });

  it('uses suggestedFolderId for new notes', () => {
    const state = createEditorState({ ...baseTarget, suggestedFolderId: 'sug-1' });
    expect(state.folderId).toBe('sug-1');
  });
});
```

- [ ] **Step 2: Write tests for `editorReducer`**

```ts
describe('editorReducer', () => {
  const initial = createEditorState(baseTarget);

  it('SET_BODY updates body and saveDisabled', () => {
    const next = editorReducer(initial, { type: 'SET_BODY', body: 'content' });
    expect(next.body).toBe('content');
    expect(next.saveDisabled).toBe(false);
  });

  it('SET_BODY with empty string disables save', () => {
    const withContent = editorReducer(initial, { type: 'SET_BODY', body: 'x' });
    const empty = editorReducer(withContent, { type: 'SET_BODY', body: '   ' });
    expect(empty.saveDisabled).toBe(true);
  });

  it('SET_FOLDER updates folderId and closes selector', () => {
    const opened = editorReducer(initial, { type: 'OPEN_FOLDER_SELECTOR' });
    const next = editorReducer(opened, { type: 'SET_FOLDER', folderId: 'f-1' });
    expect(next.folderId).toBe('f-1');
    expect(next.folderSelectorOpen).toBe(false);
  });

  it('ADD_TAG normalizes and deduplicates', () => {
    let state = editorReducer(initial, { type: 'ADD_TAG', tag: ' #MyTag ' });
    expect(state.tags).toEqual(['mytag']);
    state = editorReducer(state, { type: 'ADD_TAG', tag: 'mytag' });
    expect(state.tags).toEqual(['mytag']);
  });

  it('REMOVE_TAG removes by value', () => {
    let state = editorReducer(initial, { type: 'ADD_TAG', tag: 'a' });
    state = editorReducer(state, { type: 'ADD_TAG', tag: 'b' });
    state = editorReducer(state, { type: 'REMOVE_TAG', tag: 'a' });
    expect(state.tags).toEqual(['b']);
  });

  it('TOGGLE_PIN flips pinned', () => {
    const next = editorReducer(initial, { type: 'TOGGLE_PIN' });
    expect(next.pinned).toBe(true);
    expect(editorReducer(next, { type: 'TOGGLE_PIN' }).pinned).toBe(false);
  });

  it('folder creation flow: SET_FOLDER_DRAFT -> FOLDER_CREATED', () => {
    let state = editorReducer(initial, { type: 'OPEN_FOLDER_SELECTOR' });
    state = editorReducer(state, { type: 'SET_FOLDER_DRAFT', name: 'New', parentId: null });
    expect(state.folderCreating).toBe(true);
    expect(state.folderDraftName).toBe('New');
    state = editorReducer(state, { type: 'FOLDER_CREATED', folderId: 'new-id' });
    expect(state.folderId).toBe('new-id');
    expect(state.folderCreating).toBe(false);
    expect(state.folderSelectorOpen).toBe(false);
  });

  it('SAVE_START/SAVE_SUCCESS/SAVE_ERROR lifecycle', () => {
    let state = editorReducer(initial, { type: 'SAVE_START' });
    expect(state.saving).toBe(true);
    expect(state.errorMessage).toBe('');
    state = editorReducer(state, { type: 'SAVE_ERROR', message: 'fail' });
    expect(state.saving).toBe(false);
    expect(state.errorMessage).toBe('fail');
    state = editorReducer(initial, { type: 'SAVE_START' });
    state = editorReducer(state, { type: 'SAVE_SUCCESS' });
    expect(state.saving).toBe(false);
  });
});
```

- [ ] **Step 3: Write tests for `buildSavePayload`**

```ts
describe('buildSavePayload', () => {
  it('extracts all fields from state', () => {
    const state = createEditorState(baseTarget);
    const updated = editorReducer(
      editorReducer(state, { type: 'SET_BODY', body: 'my note' }),
      { type: 'SET_FOLDER', folderId: 'f-1' }
    );
    const payload = buildSavePayload(updated);
    expect(payload.content).toBe('my note');
    expect(payload.folderId).toBe('f-1');
    expect(payload.url).toBe('https://example.com/page');
    expect(payload.elementSelector).toBe('#main');
  });
});
```

- [ ] **Step 4: Install vitest if needed and run tests**

Run: `npx vitest run src/lib/editor-controller.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor-controller.test.ts
git commit -m "test: add unit tests for editor controller"
```

---

## Task 3: Integrate Editor Controller into React Editor

**Files:**
- Modify: `src/components/workspace/WorkspaceNoteEditorDialog.tsx`

- [ ] **Step 1: Replace useState with useReducer**

Replace the imports and state management. The `WorkspaceNoteEditorDialog` currently uses individual `useState` for `draft`, `selectedFolderId`, `isSaving`, and `error`. Replace with `useReducer(editorReducer, ...)`.

In `WorkspaceNoteEditorDialog.tsx`, replace:

```ts
import React, { useEffect, useMemo, useRef, useState } from 'react';
```

with:

```ts
import React, { useEffect, useMemo, useReducer, useRef } from 'react';
```

- [ ] **Step 2: Replace state initialization and handlers**

Replace:

```ts
  const [draft, setDraft] = useState(note.content);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(note.folderId ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousStateRef = useRef({
    open: false,
    noteId: note.id,
  });

  useEffect(() => {
    if (
      shouldReinitializeWorkspaceNoteEditor({
        previousOpen: previousStateRef.current.open,
        nextOpen: open,
        previousNoteId: previousStateRef.current.noteId,
        nextNoteId: note.id,
      })
    ) {
      setDraft(note.content);
      setSelectedFolderId(note.folderId ?? '');
      setError(null);
    }

    previousStateRef.current = {
      open,
      noteId: note.id,
    };
  }, [note.content, note.folderId, note.id, open]);

  const folderOptions = useMemo(() => buildWorkspaceNoteFolderOptions(folders), [folders]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const notesService = await getNotesService();
      await notesService.update(note.id, {
        content: draft,
        folderId: selectedFolderId || null,
      });
      onSaved();
      onOpenChange(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };
```

with:

```ts
  const targetInfo = useMemo(() => ({
    url: note.url,
    hostname: note.hostname,
    pageTitle: note.pageTitle,
    elementSelector: note.elementSelector,
    elementTag: note.elementTag,
    elementInfo: note.elementInfo,
    elementXPath: note.elementXPath,
    elementTextHash: note.elementTextHash,
    elementPosition: note.elementPosition,
    selectedText: note.selectedText,
  }), [note.url, note.hostname, note.pageTitle, note.elementSelector, note.elementTag, note.elementInfo, note.elementXPath, note.elementTextHash, note.elementPosition, note.selectedText]);

  const [state, dispatch] = useReducer(
    editorReducer,
    { targetInfo, note },
    ({ targetInfo, note }) => createEditorState(targetInfo, note)
  );

  const previousStateRef = useRef({
    open: false,
    noteId: note.id,
  });

  useEffect(() => {
    if (
      shouldReinitializeWorkspaceNoteEditor({
        previousOpen: previousStateRef.current.open,
        nextOpen: open,
        previousNoteId: previousStateRef.current.noteId,
        nextNoteId: note.id,
      })
    ) {
      // Re-create state by dispatching SET_BODY + SET_FOLDER to reset
      dispatch({ type: 'SET_BODY', body: note.content });
      dispatch({ type: 'SET_FOLDER', folderId: note.folderId ?? null });
    }

    previousStateRef.current = {
      open,
      noteId: note.id,
    };
  }, [note.content, note.folderId, note.id, open]);

  const folderOptions = useMemo(() => buildWorkspaceNoteFolderOptions(folders), [folders]);

  const handleSave = async () => {
    dispatch({ type: 'SAVE_START' });

    try {
      const notesService = await getNotesService();
      const payload = buildSavePayload(state);
      await notesService.update(note.id, {
        content: payload.content,
        folderId: payload.folderId,
      });
      dispatch({ type: 'SAVE_SUCCESS' });
      onSaved();
      onOpenChange(false);
    } catch (caughtError) {
      dispatch({
        type: 'SAVE_ERROR',
        message: caughtError instanceof Error ? caughtError.message : 'Failed to save note',
      });
    }
  };
```

- [ ] **Step 3: Update the JSX to use `state` and `dispatch`**

Replace references in the JSX:
- `draft` -> `state.body`
- `setDraft(event.target.value)` -> `dispatch({ type: 'SET_BODY', body: event.target.value })`
- `selectedFolderId` -> `state.folderId ?? ''`
- `setSelectedFolderId(event.target.value)` -> `dispatch({ type: 'SET_FOLDER', folderId: event.target.value || null })`
- `isSaving` -> `state.saving`
- `error` -> `state.errorMessage || null`

Also add the import at the top:

```ts
import { createEditorState, editorReducer, buildSavePayload } from '@/lib/editor-controller';
```

- [ ] **Step 4: Build and verify**

Run: `npm run build:pages`
Expected: Build succeeds with no type errors

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/WorkspaceNoteEditorDialog.tsx
git commit -m "refactor: use shared editor controller in workspace note editor"
```

---

## Task 4: Integrate Editor Controller into Content Script Inline Editor

**Files:**
- Modify: `src/content/index.tsx`

This is the largest task. The inline editor in `showNoteEditor()` (lines 767-1267) currently manages state with local variables (`selectedFolderId`, `folderSelectionTouched`, `draft`, `manualTags`). We replace this with `editorReducer`.

- [ ] **Step 1: Add imports for the editor controller**

At the top of `src/content/index.tsx`, add:

```ts
import {
  createEditorState,
  editorReducer,
  buildSavePayload,
  type EditorState,
  type TargetInfo,
} from '../lib/editor-controller';
```

- [ ] **Step 2: Refactor `showNoteEditor` to use `editorReducer`**

Replace the state initialization block (lines ~784-798) that creates local variables `selectedFolderId`, `folderSelectionTouched`, `draft`, `manualTags` with a single `editorState` managed by the reducer.

Replace:
```ts
  const bodyContent = existingNote?.content ?? '';
  let selectedFolderId: string | null = existingNote?.folderId ?? null;
  let availableFolders: StoredFolder[] = [];
  let folderSelectionTouched = false;
  const draft = { title: '', body: bodyContent };
  let manualTags = getInitialManualTags(existingNote?.tags ?? [], bodyContent);
```

with:
```ts
  const targetInfo: TargetInfo = {
    url: getPageUrl(),
    hostname: window.location.hostname,
    pageTitle: document.title,
    elementSelector: getCssSelector(element),
    elementTag: element.tagName.toLowerCase(),
    elementInfo: getElementInfo(element),
    elementXPath: existingNote?.elementXPath ?? getXPath(element),
    elementTextHash: existingNote?.elementTextHash ?? getTextHash(element),
    elementPosition: existingNote?.elementPosition ?? getPosition(element),
    selectedText,
  };
  let editorState = createEditorState(targetInfo, existingNote ?? null);
  let availableFolders: StoredFolder[] = [];
  let manualTags = getInitialManualTags(existingNote?.tags ?? [], editorState.body);
```

- [ ] **Step 3: Update event handlers to dispatch through `editorReducer`**

Update `updateSaveState` to read from `editorState`:

```ts
  const updateSaveState = () => {
    applySaveButtonState(saveBtn, !editorState.saveDisabled);
  };
```

Update the body textarea `input` listener:

```ts
  bodyTextarea.addEventListener('input', () => {
    editorState = editorReducer(editorState, { type: 'SET_BODY', body: bodyTextarea.value });
    errorEl.textContent = '';
    updateSaveState();
    renderTagRow();
  });
```

Update `selectFolder`:

```ts
  const selectFolder = (folderId: string | null) => {
    editorState = editorReducer(editorState, { type: 'SET_FOLDER', folderId });
    updateFolderLabel();
    closeFolderDropdown();
  };
```

Update `updateFolderLabel`:

```ts
  const updateFolderLabel = () => {
    folderLabel.textContent = getFolderChipLabel(availableFolders, editorState.folderId);
  };
```

- [ ] **Step 4: Fix folder creation to use `CREATE_FOLDER` message**

Replace the `doCreate` function inside `createNewFolderRow` to send a message to the service worker instead of writing directly to `chrome.storage.local`:

```ts
    const doCreate = () => {
      const name = input.value.trim();
      if (!name) return;
      editorState = editorReducer(editorState, {
        type: 'SET_FOLDER_DRAFT',
        name,
        parentId: parentId,
      });
      chrome.runtime.sendMessage(
        { type: 'CREATE_FOLDER', name, parentId },
        (response) => {
          if (response?.success && response.folder) {
            availableFolders = [...availableFolders, response.folder];
            editorState = editorReducer(editorState, {
              type: 'FOLDER_CREATED',
              folderId: response.folder.id,
            });
            updateFolderLabel();
            closeFolderDropdown();
          }
        }
      );
    };
```

- [ ] **Step 5: Update the save handler to use `buildSavePayload`**

In the save button click handler, replace direct field access with `buildSavePayload(editorState)`. The save handler already constructs most fields inline - replace the note creation with:

```ts
    // Update editorState before save
    editorState = editorReducer(editorState, { type: 'SET_BODY', body: bodyTextarea.value });
    editorState = editorReducer(editorState, { type: 'SAVE_START' });

    const payload = buildSavePayload(editorState);
    const nextTags = buildEditorTagNames(manualTags, { title: '', body: payload.content });
    const nextPinned = pinnedInput.checked;
```

And in the note creation block, use payload fields:

```ts
        const note: SavedNote = {
          id: crypto.randomUUID(),
          element,
          elementSelector: payload.elementSelector,
          elementXPath: payload.elementXPath,
          elementTextHash: payload.elementTextHash,
          elementPosition: payload.elementPosition,
          elementInfo: payload.elementInfo,
          content: payload.content,
          selectedText: payload.selectedText,
          folderId: payload.folderId,
          tags: nextTags,
          pinned: nextPinned,
          createdAt: new Date().toISOString(),
          badgeEl: null,
          expandedEl: null,
        };
```

- [ ] **Step 6: Update folder ID initialization from storage**

In the `chrome.storage.local.get` callback (lines ~1094-1121), update to use the reducer:

```ts
    if (!editorState.folderId) {
      const suggestedFolderId = getSuggestedFolderIdForDomain(
        allNotes,
        window.location.hostname
      );
      if (suggestedFolderId) {
        editorState = editorReducer(editorState, {
          type: 'SET_FOLDER',
          folderId: suggestedFolderId,
        });
      }
    }
```

- [ ] **Step 7: Build and verify**

Run: `npm run build:content`
Expected: Build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/content/index.tsx
git commit -m "refactor: use shared editor controller in inline note editor

Fixes broken inline folder creation by routing through CREATE_FOLDER message."
```

---

## Task 5: Smart New-Tab Navigation for "Go to Note"

**Files:**
- Modify: `src/background/service-worker.js`

- [ ] **Step 1: Replace the `OPEN_NOTE_TARGET` handler**

Replace the existing handler (lines 94-157) with smart new-tab logic:

```js
    if (message.type === 'OPEN_NOTE_TARGET') {
        const note = message.note;

        // Validate note payload shape
        if (!note || typeof note !== 'object' || !isSafeUrl(note.url)) {
            sendResponse({ success: false, error: 'Invalid note target' });
            return true;
        }

        const normalizedNoteUrl = normalizeUrl(note.url);

        // Step 1: Check if a tab already has this URL open
        chrome.tabs.query({}, (allTabs) => {
            const matchingTab = allTabs.find(
                (t) => t.url && normalizeUrl(t.url) === normalizedNoteUrl
            );

            if (matchingTab && matchingTab.id) {
                // Tab exists - activate it and scroll to note
                chrome.tabs.update(matchingTab.id, { active: true });
                if (matchingTab.windowId) {
                    chrome.windows.update(matchingTab.windowId, { focused: true });
                }
                chrome.tabs.sendMessage(matchingTab.id, {
                    type: 'SCROLL_TO_NOTE',
                    selector: note.elementSelector,
                    note: {
                        elementSelector: note.elementSelector,
                        elementXPath: note.elementXPath,
                        elementTextHash: note.elementTextHash,
                        elementPosition: note.elementPosition,
                        elementTag: note.elementTag,
                        url: note.url,
                    },
                });
                sendResponse({ success: true });
            } else {
                // No matching tab - create a new one
                chrome.tabs.create({ url: note.url }, (newTab) => {
                    if (!newTab.id) {
                        sendResponse({ success: false, error: 'Failed to create tab' });
                        return;
                    }
                    pendingNoteTargets.set(newTab.id, note);
                    const onUpdated = (tabId, changeInfo) => {
                        if (tabId === newTab.id && changeInfo.status === 'complete') {
                            chrome.tabs.onUpdated.removeListener(onUpdated);
                            const pending = pendingNoteTargets.get(tabId);
                            if (pending) {
                                pendingNoteTargets.delete(tabId);
                                chrome.tabs.sendMessage(tabId, {
                                    type: 'SCROLL_TO_NOTE',
                                    selector: pending.elementSelector,
                                    note: {
                                        elementSelector: pending.elementSelector,
                                        elementXPath: pending.elementXPath,
                                        elementTextHash: pending.elementTextHash,
                                        elementPosition: pending.elementPosition,
                                        elementTag: pending.elementTag,
                                        url: pending.url,
                                    },
                                });
                            }
                        }
                    };
                    chrome.tabs.onUpdated.addListener(onUpdated);
                    sendResponse({ success: true });
                });
            }
        });
        return true;
    }
```

- [ ] **Step 2: Build and verify**

Run: `npm run build:sw`
Expected: service-worker.js copied to dist

- [ ] **Step 3: Commit**

```bash
git add src/background/service-worker.js
git commit -m "fix: Go to Note opens new tab instead of hijacking current tab

Checks for existing tab with matching URL first, activates it if found,
otherwise creates a new tab. Current tab is never navigated away."
```

---

## Task 6: Tab Group Utilities

**Files:**
- Create: `src/lib/tab-group-utils.ts`

- [ ] **Step 1: Create hex-to-Chrome-color mapping and URL deduplication**

```ts
// src/lib/tab-group-utils.ts

type ChromeTabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan';

const CHROME_COLORS: { name: ChromeTabGroupColor; rgb: [number, number, number] }[] = [
  { name: 'grey',   rgb: [128, 128, 128] },
  { name: 'blue',   rgb: [66, 133, 244] },
  { name: 'red',    rgb: [234, 67, 53] },
  { name: 'yellow', rgb: [251, 188, 4] },
  { name: 'green',  rgb: [52, 168, 83] },
  { name: 'pink',   rgb: [255, 105, 180] },
  { name: 'purple', rgb: [103, 58, 183] },
  { name: 'cyan',   rgb: [0, 188, 212] },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export function hexToChromeColor(hex: string | null | undefined): ChromeTabGroupColor {
  if (!hex) return 'grey';
  const rgb = hexToRgb(hex);
  if (!rgb) return 'grey';

  let closest: ChromeTabGroupColor = 'grey';
  let minDist = Infinity;
  for (const entry of CHROME_COLORS) {
    const dist = colorDistance(rgb, entry.rgb);
    if (dist < minDist) {
      minDist = dist;
      closest = entry.name;
    }
  }
  return closest;
}

export function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    const normalized = normalizeTabGroupUrl(url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(url);
    }
  }
  return unique;
}

function normalizeTabGroupUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch {
    return url;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/tab-group-utils.ts
git commit -m "feat: add tab group color mapping and URL deduplication utilities"
```

---

## Task 7: Open Folder as Chrome Tab Group (Service Worker)

**Files:**
- Modify: `src/background/service-worker.js`

- [ ] **Step 1: Add hex-to-Chrome-color mapping to service worker**

Since the service worker is plain JS with no build step, we cannot import from `tab-group-utils.ts`. Inline the mapping function at the top of `service-worker.js`, after the existing helper functions:

```js
// Chrome tab group color mapping
const CHROME_COLORS = [
    { name: 'grey',   rgb: [128, 128, 128] },
    { name: 'blue',   rgb: [66, 133, 244] },
    { name: 'red',    rgb: [234, 67, 53] },
    { name: 'yellow', rgb: [251, 188, 4] },
    { name: 'green',  rgb: [52, 168, 83] },
    { name: 'pink',   rgb: [255, 105, 180] },
    { name: 'purple', rgb: [103, 58, 183] },
    { name: 'cyan',   rgb: [0, 188, 212] },
];

function hexToChromeColor(hex) {
    if (!hex) return 'grey';
    const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!match) return 'grey';
    const rgb = [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
    let closest = 'grey';
    let minDist = Infinity;
    for (const entry of CHROME_COLORS) {
        const dist = Math.sqrt(
            (rgb[0] - entry.rgb[0]) ** 2 +
            (rgb[1] - entry.rgb[1]) ** 2 +
            (rgb[2] - entry.rgb[2]) ** 2
        );
        if (dist < minDist) {
            minDist = dist;
            closest = entry.name;
        }
    }
    return closest;
}
```

- [ ] **Step 2: Add `OPEN_FOLDER_AS_GROUP` message handler**

Add before the final `sendResponse({ unhandled: true })` block:

```js
    if (message.type === 'OPEN_FOLDER_AS_GROUP') {
        const { folderId } = message;
        chrome.storage.local.get(['divnotes_folders', 'divnotes_notes'], async (result) => {
            const folders = result.divnotes_folders || [];
            const notes = result.divnotes_notes || [];
            const folder = folders.find(f => f.id === folderId);
            if (!folder) {
                sendResponse({ success: false, error: 'Folder not found' });
                return;
            }

            // Determine if parent (has children) or leaf
            const hasChildren = folders.some(f => f.parentId === folderId);

            // Collect target folder IDs
            let targetFolderIds = [folderId];
            if (hasChildren) {
                // Recursively collect all descendant folder IDs
                const stack = [folderId];
                while (stack.length) {
                    const current = stack.pop();
                    const children = folders.filter(f => f.parentId === current);
                    for (const child of children) {
                        targetFolderIds.push(child.id);
                        stack.push(child.id);
                    }
                }
            }

            // Collect notes from target folders
            const folderNotes = notes.filter(n => n.folderId && targetFolderIds.includes(n.folderId));

            // Deduplicate URLs
            const seen = new Set();
            const uniqueUrls = [];
            for (const note of folderNotes) {
                if (!note.url || !isSafeUrl(note.url)) continue;
                const normalized = normalizeUrl(note.url);
                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    uniqueUrls.push(note.url);
                }
            }

            if (uniqueUrls.length === 0) {
                sendResponse({ success: false, error: 'No notes with valid URLs in this folder' });
                return;
            }

            try {
                // Create tabs
                const tabIds = [];
                for (const url of uniqueUrls) {
                    const tab = await chrome.tabs.create({ url });
                    if (tab.id) tabIds.push(tab.id);
                }

                if (tabIds.length === 0) {
                    sendResponse({ success: false, error: 'Failed to create tabs' });
                    return;
                }

                // Group tabs
                const groupId = await chrome.tabs.group({ tabIds });

                // Style the group
                await chrome.tabGroups.update(groupId, {
                    title: folder.name,
                    color: hexToChromeColor(folder.color),
                });

                sendResponse({ success: true, tabCount: tabIds.length });
            } catch (err) {
                sendResponse({ success: false, error: err.message || 'Failed to create tab group' });
            }
        });
        return true;
    }
```

- [ ] **Step 3: Build and verify**

Run: `npm run build:sw`
Expected: service-worker.js copied to dist

- [ ] **Step 4: Commit**

```bash
git add src/background/service-worker.js
git commit -m "feat: add Open Folder as Chrome Tab Group handler

Parent folders deep-open (all descendants). Leaf folders shallow-open.
Deduplicates URLs. Maps folder color to nearest Chrome tab group color."
```

---

## Task 8: Add Tab Group UI to Sidepanel FoldersView

**Files:**
- Modify: `src/sidepanel/components/FolderTreeNodeItem.tsx`
- Modify: `src/sidepanel/components/FoldersView.tsx`

- [ ] **Step 1: Add `onOpenAsTabGroup` prop to `FolderTreeNodeItem`**

In `FolderTreeNodeItem.tsx`, add to the interface:

```ts
  onOpenAsTabGroup?: (folderId: string) => void;
```

Add to the destructured props:

```ts
  onOpenAsTabGroup,
```

- [ ] **Step 2: Add tab group icon button to the folder row**

Import `ExternalLink` from lucide-react:

```ts
import { ChevronDown, ChevronRight, Folder, FolderPlus, MoreVertical, ExternalLink } from 'lucide-react';
```

In the folder row's action buttons area (after the existing buttons in the `<div className="flex w-full items-center gap-1 pr-1">` section), add a tab group button next to the existing `FolderPlus` and `MoreVertical` buttons:

Add this button before the existing subfolder/context menu buttons in the `group-hover:opacity-100` section:

```tsx
            {onOpenAsTabGroup && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAsTabGroup(node.folder.id);
                }}
                className="rounded-lg p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted/50 hover:text-foreground group-hover:opacity-100"
                title="Open all as tab group"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
```

- [ ] **Step 3: Pass the prop recursively for child nodes**

In the recursive rendering of child `FolderTreeNodeItem` components, add:

```tsx
onOpenAsTabGroup={onOpenAsTabGroup}
```

- [ ] **Step 4: Add handler in FoldersView and pass it down**

In `FoldersView.tsx`, add the handler:

```ts
  const handleOpenAsTabGroup = useCallback(async (folderId: string) => {
    // Count unique URLs for confirmation
    const folderIds = [folderId];
    const hasChildren = folders.some(f => f.parentId === folderId);
    if (hasChildren) {
      const stack = [folderId];
      while (stack.length) {
        const current = stack.pop()!;
        const children = folders.filter(f => f.parentId === current);
        for (const child of children) {
          folderIds.push(child.id);
          stack.push(child.id);
        }
      }
    }
    const folderNotes = notes.filter(n => n.folderId && folderIds.includes(n.folderId));
    const uniqueUrls = new Set(folderNotes.map(n => n.url).filter(Boolean));

    if (uniqueUrls.size === 0) return;

    if (uniqueUrls.size > 15) {
      const confirmed = window.confirm(`Open ${uniqueUrls.size} tabs in a group?`);
      if (!confirmed) return;
    }

    chrome.runtime.sendMessage({ type: 'OPEN_FOLDER_AS_GROUP', folderId });
  }, [folders, notes]);
```

Pass it to `FolderTreeNodeItem`:

```tsx
onOpenAsTabGroup={handleOpenAsTabGroup}
```

- [ ] **Step 5: Build and verify**

Run: `npm run build:pages`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/sidepanel/components/FolderTreeNodeItem.tsx src/sidepanel/components/FoldersView.tsx
git commit -m "feat: add Open as Tab Group button to sidepanel folder rows

Shows on hover. Confirms if > 15 tabs would open."
```

---

## Task 9: Add Tab Group UI to Popup FoldersView

**Files:**
- Modify: `src/popup/components/FoldersView.tsx`

- [ ] **Step 1: Add `onOpenAsTabGroup` prop and handler**

Add to the interface:

```ts
  onOpenAsTabGroup?: (folderId: string) => void;
```

Add to destructured props:

```ts
  onOpenAsTabGroup,
```

- [ ] **Step 2: Add "Open All" button to folder detail header**

In the `selectedSummary` block, after the note count paragraph, add:

```tsx
          {selectedSummary.count > 0 && onOpenAsTabGroup && (
            <button
              type="button"
              onClick={() => {
                if (selectedSummary.count > 15) {
                  const confirmed = window.confirm(`Open ${selectedSummary.count} tabs in a group?`);
                  if (!confirmed) return;
                }
                onOpenAsTabGroup(selectedSummary.folder.id);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-[10px] bg-[#173628] px-3 py-1.5 text-[11px] font-semibold text-[#f5efe9] transition-colors hover:bg-[#10271d]"
            >
              <ExternalLink className="h-3 w-3" />
              Open All
            </button>
          )}
```

Import `ExternalLink`:

```ts
import { ExternalLink, Folder, FolderOpen } from 'lucide-react';
```

- [ ] **Step 3: Add tab group icon button on each folder summary card**

In the folder summary list (the `folderSummaries.map` section), add a tab group button. Inside the existing folder button, add after the "Open" span:

Actually, since each folder card is a `<button>`, we need a separate click handler. Add a small icon button alongside the card. Wrap the card in a div:

Replace the folder card `<button>` with a `<div>` wrapper containing the original button and a tab group button:

```tsx
          <div key={summary.folder.id} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelectFolder(summary.folder.id)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] border border-[#ece7de] bg-white px-4 py-4 text-left shadow-[0_1px_2px_rgba(5,36,21,0.04)] transition-colors hover:bg-[#fbfaf6]"
            >
              {/* ... existing inner content unchanged ... */}
            </button>
            {onOpenAsTabGroup && summary.count > 0 && (
              <button
                type="button"
                onClick={() => onOpenAsTabGroup(summary.folder.id)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] border border-[#ece7de] bg-white text-[#6e7c72] shadow-[0_1px_2px_rgba(5,36,21,0.04)] transition-colors hover:bg-[#fbfaf6] hover:text-[#173628]"
                title="Open all as tab group"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
```

- [ ] **Step 4: Build and verify**

Run: `npm run build:pages`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/popup/components/FoldersView.tsx
git commit -m "feat: add Open as Tab Group buttons to popup FoldersView

Adds Open All button in folder detail header and icon button on folder cards."
```

---

## Task 10: Wire `onOpenAsTabGroup` in Popup Parent Component

**Files:**
- The popup parent that renders `FoldersView` needs to pass `onOpenAsTabGroup`

- [ ] **Step 1: Find and update the popup parent component**

Search for where `<FoldersView` is rendered in the popup components and add the `onOpenAsTabGroup` prop:

```ts
onOpenAsTabGroup={(folderId) => {
  chrome.runtime.sendMessage({ type: 'OPEN_FOLDER_AS_GROUP', folderId });
}}
```

- [ ] **Step 2: Build and verify**

Run: `npm run build:pages`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/popup/
git commit -m "feat: wire tab group handler in popup parent component"
```

---

## Task 11: Final Build Verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: All three build steps succeed (pages, content, sw)

- [ ] **Step 2: Manual smoke test checklist**

Load `dist/` as unpacked extension and verify:
1. Inline editor on a page — body textarea, folder selector, tag input, pinned checkbox all work
2. Inline folder creation — clicking "Create" in the folder dropdown creates a folder and selects it
3. Editing a note from the workspace dialog — content and folder are saved correctly
4. "Go to Note" from sidepanel — opens a new tab (or activates existing one), does not navigate current tab
5. "Open as Tab Group" on a folder — creates a Chrome tab group with the folder's notes
6. Tab group color matches folder color

- [ ] **Step 3: Final commit if any fixes needed**
