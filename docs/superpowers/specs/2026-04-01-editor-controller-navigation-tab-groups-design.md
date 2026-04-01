# Editor Controller, Navigation & Tab Groups Design

**Date:** 2026-04-01
**Status:** Approved
**Goal:** Unify the inline and popup/sidepanel note editors behind a shared controller, fix broken inline folder creation, make "Go to Note" open a new tab instead of hijacking the current one, and add the ability to open all notes in a folder as a Chrome tab group.

---

## Background

The previous plan (2026-03-31) simplified the content script inline editor — removing the title input, hiding raw element info, and adding a folder selector flow. However:

- The popup/sidepanel editor (`WorkspaceNoteEditorDialog`) manages its own state independently, risking drift.
- Inline folder creation in the content script is broken despite being committed.
- "Go to Note" navigates the current tab away, which is disruptive.
- There is no way to batch-open a folder's notes.

This design addresses all four issues.

---

## 1. Shared Editor Controller

### Problem

The content script (DOM) and popup/sidepanel (React) editors duplicate field definitions, validation logic, and save payload construction. Changes to one don't propagate to the other.

### Solution

Create `src/lib/editor-controller.ts` — a shared state machine that both renderers consume. The React side uses `useReducer(editorReducer, initialState)`. The DOM side calls `editorReducer` directly and re-renders.

### EditorState

```ts
interface EditorState {
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
```

### EditorAction

```ts
type EditorAction =
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

### Key Exports

| Export | Purpose |
|--------|---------|
| `createEditorState(note?, targetInfo?)` | Initializes state from a `StoredNote` (edit mode) or targeting info (new mode). Both renderers call this instead of building state independently. |
| `editorReducer(state, action)` | Pure function returning next state. Handles validation (empty body → `saveDisabled: true`). |
| `buildSavePayload(state)` | Converts `EditorState` into the object shape expected by `NotesService`. Single source of truth for persistence. |
| `getEditorFieldDefs()` | Returns the ordered list of visible fields. Both renderers iterate this to ensure identical field presence and order. |

### Renderer Integration

**Content script (`editor-surface.ts`):**
- Import `createEditorState`, `editorReducer`, `buildSavePayload` from `editor-controller`
- Maintain a local `state` variable, call `editorReducer` on user interactions, re-render the DOM
- Folder creation dispatches `SET_FOLDER_DRAFT` → sends `CREATE_FOLDER` message → on response dispatches `FOLDER_CREATED`

**React (`WorkspaceNoteEditorDialog.tsx`):**
- Replace local `useState` calls with `useReducer(editorReducer, createEditorState(note))`
- Use `buildSavePayload(state)` in the save handler
- Folder picker dispatches the same actions as the content script

---

## 2. Fix: Inline Editor Folder Creation

### Problem

The content script folder selector flow (added in Task 4 of the previous plan) was committed but folder creation does not work. The code exists in `note-editor-helpers.ts` but the creation path is broken.

### Solution

Move folder creation orchestration into `editor-controller.ts`. The controller defines the action sequence (`SET_FOLDER_DRAFT` → `FOLDER_CREATED`), and each renderer handles the async middle step (sending a Chrome message) before dispatching `FOLDER_CREATED`. This guarantees both renderers use the same state transitions for folder creation.

The content script sends `chrome.runtime.sendMessage({ type: 'CREATE_FOLDER', ... })` and dispatches `FOLDER_CREATED` with the returned folder ID. The React renderer calls `FoldersService.create()` directly and dispatches the same action.

---

## 3. "Go to Note" — Smart New Tab Navigation

### Problem

Clicking "Go to Note" in the sidepanel/popup calls `chrome.tabs.update(tabId, { url })` on the current tab, navigating the user away from their current page.

### Solution

Modify the `OPEN_NOTE_TARGET` handler in `service-worker.js`:

1. **Query for existing tab** — `chrome.tabs.query({ url: normalizedNoteUrl })` to find a tab already on that page.
2. **Tab exists** — `chrome.tabs.update(tabId, { active: true })` + `chrome.windows.update(windowId, { focused: true })`, then send `SCROLL_TO_NOTE` to that tab.
3. **No matching tab** — `chrome.tabs.create({ url: note.url })`, store in `pendingNoteTargets`, send `SCROLL_TO_NOTE` on load complete.

The current tab is never navigated away. The user stays on their current page.

---

## 4. Open Folder as Chrome Tab Group

### Problem

There is no way to batch-open a folder's notes. Users must click "Go to Note" one at a time.

### Solution

Add a new `OPEN_FOLDER_AS_GROUP` message type in the service worker.

### Behavior

**Parent folders (have children):** Deep open — collects notes from the folder and all descendant folders recursively.

**Leaf folders (no children):** Shallow open — collects only the folder's direct notes.

**URL deduplication:** Multiple notes on the same page produce one tab. Unique URLs are determined after normalization.

**Confirmation safeguard:** If the unique URL count exceeds 15, the popup/sidepanel checks the count before sending the message to the service worker. It shows a native `window.confirm("Open {count} tabs in a group?")` dialog. If the user cancels, the message is never sent. This keeps the confirmation in the UI layer without adding a round-trip message pattern.

### Flow

1. Receive `{ type: 'OPEN_FOLDER_AS_GROUP', folderId }`.
2. Fetch the folder. Determine if it has children.
3. If parent: recursively collect all descendant folder IDs, fetch notes for all. If leaf: fetch notes for the folder only.
4. Extract unique URLs from the collected notes.
5. Create tabs: `chrome.tabs.create({ url })` for each unique URL. (Confirmation already handled by caller if count > 15.)
7. Group tabs: `chrome.tabs.group({ tabIds })`.
8. Style group: `chrome.tabGroups.update(groupId, { title: folder.name, color: chromeColor })`.

### Color Mapping

Chrome tab groups support 8 colors: `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`.

Map the folder's hex color to the nearest Chrome color. If the folder has no color set, default to `grey`.

### UI Trigger Points

**Folder row action (FoldersView):** An icon button on each folder row in both the sidepanel and popup FoldersView. Tooltip: "Open all as tab group".

**Folder detail header:** When viewing a folder's notes, an "Open All" button in the folder detail header.

Both triggers send `chrome.runtime.sendMessage({ type: 'OPEN_FOLDER_AS_GROUP', folderId })`.

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `src/lib/editor-controller.ts` | Shared editor state machine: state shape, reducer, initializer, save payload builder, field definitions |
| `src/lib/editor-controller.test.ts` | Unit tests for the controller (reducer transitions, validation, save payload, field defs) |

### Modified Files

| File | Changes |
|------|---------|
| `src/content/editor-surface.ts` | Consume `editor-controller` instead of managing own state. Dispatch actions on user input, re-render from state. |
| `src/content/index.tsx` | Use controller for editor lifecycle. Wire folder creation message flow. |
| `src/content/note-editor-helpers.ts` | Move folder creation and selector logic that belongs in the controller. Keep domain-suggestion and page-level helpers. |
| `src/components/workspace/WorkspaceNoteEditorDialog.tsx` | Replace local `useState` with `useReducer(editorReducer, ...)`. Use `buildSavePayload()` for save. |
| `src/background/service-worker.js` | Modify `OPEN_NOTE_TARGET` for smart new-tab. Add `OPEN_FOLDER_AS_GROUP` handler. Add `CREATE_FOLDER` handler for content script. Add hex-to-Chrome-color mapping. |
| `src/sidepanel/components/` (FoldersView or equivalent) | Add "Open as Tab Group" icon button on folder rows. Add "Open All" button in folder detail header. Add confirmation dialog for > 15 tabs. |
| `src/popup/components/` (FoldersView or equivalent) | Same tab group UI additions as sidepanel. |

### Unchanged

| File | Reason |
|------|--------|
| `src/lib/notes-service.ts` | Save/delete API unchanged; controller calls it the same way |
| `src/lib/folders-service.ts` | Folder CRUD unchanged; controller and service worker call existing methods |
| `src/content/anchored-overlay.ts` | Positioning logic unaffected |
| `src/content/overlay-ui.ts` | Preview card shell unaffected |

---

## Permissions

The `chrome.tabGroups` API requires no additional permissions — it is available to all extensions with the `tabs` permission, which the extension already declares.

---

## Out of Scope

- Drag-and-drop reordering of tabs within a group
- Saving/restoring tab group sessions
- Content script inline editor React migration
- Sidepanel or popup redesign beyond editor alignment and tab group buttons
