# DivNotes Sidebar Redesign: Folders, Tags & Student-Focused Organization

**Date:** 2026-03-25
**Status:** Approved

## Overview

Redesign the DivNotes Chrome extension sidepanel from a flat domain-grouped note list into a three-view organizational system (Sites, Folders, Tags) aimed at students. Adds user-created folder hierarchies, a tagging system, pinned favorites, and power-user tree interactions (drag-and-drop, multi-select, keyboard navigation, context menus).

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Target audience | General student (university + self-learner) | Flexible for any study workflow |
| View switching | Segmented control (compact pill toggle) | Minimal chrome, fits narrow sidepanel |
| Folder depth | Unlimited nesting (soft cap at 6 levels visually) | Maximum flexibility; deep levels use truncated indentation |
| Tags vs folders relationship | Tags as a third independent view | Cross-cutting labels separate from hierarchy |
| Unfiled notes | Auto-suggest folder based on domain, fallback to Inbox | Reduces friction, keeps things organized |
| Data architecture | Flat list with `parentId` (Approach A) | Standard tree pattern, maps to both chrome.storage and Supabase |
| Icons | Lucide React throughout | Consistent with existing codebase, no emoji |

## Data Model

### StoredFolder (new)

```typescript
interface StoredFolder {
  id: string;           // UUID
  name: string;
  parentId: string | null;  // null = root-level
  order: number;        // sort position among siblings
  color: string | null; // optional accent color
  pinned: boolean;      // whether favorited
  createdAt: string;
  updatedAt: string;
}
```

### StoredTag (new)

```typescript
interface StoredTag {
  id: string;           // UUID
  name: string;         // display name, e.g. "exam-review"
  color: string;        // hex color for pill badge
  createdAt: string;
  updatedAt: string;
}
```

### StoredNote (extended)

New fields added to existing type:

```typescript
folderId: string | null;  // null = Inbox (unfiled)
tags: string[];           // array of tag IDs
pinned: boolean;          // whether favorited
```

Backwards-compatible: missing fields default to `null` / `[]` / `false`.

### Chrome Storage Keys

- `divnotes_folders` — flat array of `StoredFolder`
- `divnotes_tags` — flat array of `StoredTag`
- `divnotes_notes` — existing key, extended with new fields

## Sidebar UI Structure

### Navigation

Segmented control pinned below the header with three options:

- **Sites** — `Globe` icon. Existing domain > page > notes tree, refined with pinned section.
- **Folders** — `FolderTree` icon. User-created folder hierarchy with Inbox.
- **Tags** — `Tags` icon. Tag cloud with filtered note list.

Search bar shared across all views, filters within the active view.

### Sites View (refined existing)

- Pinned section at top for starred notes
- Domain > page > notes tree with note count badges
- Identical to current behavior but with pinned items support

### Folders View (new)

- **Pinned section:** Starred folders and notes at top
- **Inbox:** Always visible below pinned, shows unfiled note count with warning badge
- **Folder tree:** Nested folders with color-coded `Folder` icons. No hard depth limit, but indentation caps at 6 levels visually (deeper levels render at max indent with a breadcrumb tooltip showing full path).
- Notes display inline tag pills (max 2 visible, "+N" overflow)
- Header action button: `FolderPlus` icon to create new root folder

### Tags View (new)

- **Tag cloud:** All tags as clickable color-coded pills with note counts, using `Tag` icon
- Click a tag to filter — shows all notes with that tag across all folders
- Multiple tag selection: AND-filter (notes with ALL selected tags)
- Active filters shown as dismissible chips
- Each note card shows: element tag, domain, content preview, folder breadcrumb path, date

### Context Menus

Built with Radix UI `DropdownMenu` (sidepanel React) / pure DOM (content script).

**Folder context menu:**
- New Subfolder (`FolderPlus`)
- New Note (`StickyNote`)
- Rename (`Pencil`)
- Change Color (`Palette`)
- Pin to Top (`Star`)
- Delete Folder (`Trash2`) — destructive, with confirmation

**Note context menu:**
- Open on Page (`ExternalLink`)
- Edit Note (`Pencil`)
- Move to Folder... (`Folder`)
- Add Tags... (`Tag`)
- Pin to Top (`Star`)
- Duplicate (`Copy`)
- Delete Note (`Trash2`) — destructive, with confirmation

## Folder Picker on Note Creation

When creating a note via the content script, a compact folder picker appears in the note editor overlay.

### Auto-Suggest Logic

1. Match current page's domain against existing notes
2. If >50% of notes from that domain are in one folder, pre-select that folder
3. Otherwise, default to Inbox

### UI

- Small dropdown below the note content field showing the suggested folder
- "Change" button opens a mini tree browser (scrollable, max 200px height)
- "New Folder" option at the bottom for inline creation
- Skip/dismiss saves to the auto-suggested folder (or Inbox)

This is pure DOM in the content script. Reads folder list from `chrome.storage.local`.

## Power-User Interactions

### Drag and Drop

- Notes and folders are draggable within the Folders view
- Drop targets: folders (move into), between items (reorder)
- Visual feedback: drop zone highlight with 2px purple indicator line
- Dragging a folder moves it and all children (reparent = update `parentId`)
- Cross-view filing: notes in Sites view show a small `Folder` icon on hover; clicking it opens the folder picker popover (same component as the content script picker) to file the note without switching views.

### Multi-Select

- `Cmd+Click` (Mac) / `Ctrl+Click` to toggle individual items
- `Shift+Click` to select a range
- Selected items get subtle highlight background
- Bulk action bar at bottom when >1 selected: "Move to...", "Tag...", "Pin", "Delete"
- `Cmd+A` selects all visible items in current view

### Keyboard Navigation

| Key | Action |
|---|---|
| `Arrow Up/Down` | Traverse the tree |
| `Arrow Right` | Expand folder |
| `Arrow Left` | Collapse folder, or jump to parent |
| `Enter` | Open/expand focused item |
| `Space` | Toggle selection (with Shift for range) |
| `Delete/Backspace` | Delete selected (with confirmation) |
| `F2` | Rename focused folder |
| `/` | Focus search input |

## Tag System

### Creating Tags

**Inline hashtags:** Content script detects `#tagname` patterns in note content during save. Extraction rules:
- Pattern: `#` followed by 1-50 word characters (`[a-zA-Z0-9_-]`), must be preceded by whitespace or start of line (to distinguish from markdown headings like `# Heading`)
- Case-insensitive: `#ExamReview` and `#examreview` resolve to the same tag (stored lowercase)
- Extracts tag names, sends them via message to the service worker (see Content Script Integration below)
- Hashtags remain visible in note text

**Dedicated picker:** In the sidepanel, "Add Tags..." context menu option opens a popover with autocomplete input. Type to filter existing tags, Enter to create new. New tags get a randomly assigned color from a preset palette.

### Tag Management

Accessed via `Settings` icon in Tags view header:

- **Rename:** Updates display name everywhere
- **Change color:** Pick from preset palette (8-10 colors matching folder colors)
- **Merge:** Select two tags, merge into one (reassigns all notes)
- **Delete:** Removes from all notes, with confirmation

### Tag Display

- **Folders tree:** Small colored pills next to note labels (max 2, "+N" overflow)
- **Tags view:** Tag cloud at top, filtered note list below
- **Multiple selection:** Click multiple pills to AND-filter

## Supabase Schema

### New Tables

```sql
CREATE TABLE folders (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES auth.users NOT NULL,
  name        text NOT NULL,
  parent_id   uuid REFERENCES folders(id) ON DELETE CASCADE,
  color       text,
  "order"     integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE tags (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES auth.users NOT NULL,
  name        text NOT NULL,
  color       text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE note_tags (
  note_id     uuid REFERENCES notes(id) ON DELETE CASCADE,
  tag_id      uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
```

### Changes to Existing `notes` Table

```sql
ALTER TABLE notes ADD COLUMN folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN pinned boolean DEFAULT false;
```

### Row-Level Security

All new tables get `user_id = auth.uid()` policies, same pattern as existing `notes` table.

### Sync Strategy

- Extend existing `CloudNotesService` pattern with new `CloudFoldersService` and `CloudTagsService`
- Same local-first + offline queue strategy
- Add `entity_type` field to `SyncQueueItem`: `'note' | 'folder' | 'tag' | 'note_tag'`
- `ON DELETE CASCADE` on `parent_id` cascades subfolder deletion in Supabase; local service handles cascade before syncing

### Updated SyncQueueItem

The existing `SyncQueueItem` is extended to support all entity types:

```typescript
interface SyncQueueItem {
  id: string;
  entityType: 'note' | 'folder' | 'tag' | 'note_tag';  // NEW — defaults to 'note' for legacy items
  action: 'save' | 'update' | 'delete';
  entityId: string;       // renamed from noteId — the ID of the entity being synced
  payload?: any;          // shape depends on entityType + action
  timestamp: number;
}
```

**Migration of existing queue items:** On first load after update, any queued items without `entityType` are assigned `entityType: 'note'` and `entityId` is copied from the legacy `noteId` field. This is a one-time in-place migration of `divnotes_sync_queue`.

### Local-to-Cloud Tag Mapping

The `tags: string[]` field on `StoredNote` (local storage) and the `note_tags` junction table (Supabase) represent the same relationship differently:

- **On cloud read (`getAll` / `getForPage`):** `CloudNotesService` fetches notes with a Supabase query that joins `note_tags` and `tags`. The `dbToStored` method reconstructs the `tags: string[]` array from the joined rows.
- **On local save/update:** `tags[]` is written directly on the `StoredNote` in chrome.storage. Separately, sync queue items with `entityType: 'note_tag'` and `action: 'save'` or `'delete'` are enqueued for each added/removed tag association.
- **On sync queue processing:** `note_tag` items insert into or delete from the `note_tags` junction table.

### Folder Deletion Behavior

When a folder is deleted:

1. **Notes inside the folder** (and all descendant subfolders) are moved to Inbox (`folderId = null`), NOT deleted. This matches the `ON DELETE SET NULL` constraint on `notes.folder_id`.
2. **Subfolders** are deleted via `ON DELETE CASCADE` on `folders.parent_id` in Supabase. Locally, the service collects all descendant folder IDs, reassigns their notes to Inbox, then removes the folder entries.
3. **Sync queue:** One `delete` item for the root folder being deleted. Supabase cascades handle subfolder deletion. Note `folderId` updates are queued as individual `update` items.

### Content Script Integration

The content script cannot import `NotesService` directly (it's a separate bundle). All folder/tag operations from the content script go through message passing:

1. **Note save with folder:** Content script reads `divnotes_folders` from `chrome.storage.local` to display the folder picker UI. When saving, it includes `folderId` on the note object stored to `chrome.storage.local`. The service worker listens for `SAVE_NOTE` messages and forwards to the notes service for cloud sync.
2. **Hashtag extraction:** Content script extracts tag names from note content. It sends a `SYNC_NOTE_TAGS` message to the service worker with `{ noteId, tagNames: string[] }`. The service worker resolves tag names to IDs (creating new `StoredTag` entries if needed), updates the note's `tags` array in chrome.storage, and enqueues sync items.
3. **Folder creation:** The "New Folder" option in the content script's picker sends a `CREATE_FOLDER` message to the service worker, which creates the folder via the folders service and responds with the new folder ID.

New message types:
- `SYNC_NOTE_TAGS` — `{ noteId: string, tagNames: string[] }`
- `CREATE_FOLDER` — `{ name: string, parentId: string | null }`

### Migration for Existing Users

- New fields default to `null` / `[]` / `false` — fully backwards-compatible
- First load after update: notes without `folderId` appear in Inbox
- Existing `SyncQueueItem` entries without `entityType` are migrated in-place on first load
- No data migration required — users organically file notes from Inbox
