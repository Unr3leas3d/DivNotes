# Sidebar Folders & Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the DivNotes sidepanel into a three-view organizational system (Sites, Folders, Tags) with folder hierarchies, tagging, pinned favorites, drag-and-drop, multi-select, keyboard navigation, and context menus.

**Architecture:** Data layer first (types, services, storage), then UI components bottom-up (shared primitives, then each view), then content script integration, then power-user interactions layered on top. Each task produces a buildable, testable increment.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, shadcn/ui + Radix UI, Lucide React icons, Supabase, Chrome Extension APIs (Manifest V3), Vite

**Spec:** `docs/superpowers/specs/2026-03-25-sidebar-folders-tags-design.md`

---

## File Structure

### New files to create

```
src/lib/types.ts                          # Shared types: StoredFolder, StoredTag, updated StoredNote, SyncQueueItem
src/lib/folders-service.ts                # LocalFoldersService + CloudFoldersService + factory
src/lib/tags-service.ts                   # LocalTagsService + CloudTagsService + factory
src/lib/tree-utils.ts                     # buildTree(), getDescendantIds(), getAncestorPath(), reorder helpers
src/lib/tag-utils.ts                      # extractHashtags(), TAG_COLORS palette, assignRandomColor()
src/sidepanel/components/SegmentedControl.tsx   # Three-tab pill toggle
src/sidepanel/components/PinnedSection.tsx      # Starred items section
src/sidepanel/components/SitesView.tsx          # Refactored domain tree (extracted from App.tsx)
src/sidepanel/components/FoldersView.tsx        # Folder tree with Inbox
src/sidepanel/components/TagsView.tsx           # Tag cloud + filtered notes
src/sidepanel/components/FolderTreeNode.tsx     # Recursive folder/note row
src/sidepanel/components/NoteCard.tsx           # Note display card (shared across views)
src/sidepanel/components/TagPill.tsx             # Color-coded tag pill
src/sidepanel/components/ContextMenu.tsx         # Right-click menus for folders and notes
src/sidepanel/components/FolderPicker.tsx        # Folder selection popover (shared with Sites view)
src/sidepanel/components/TagPicker.tsx           # Tag autocomplete popover
src/sidepanel/components/BulkActionBar.tsx       # Bottom bar for multi-select actions
src/sidepanel/hooks/useTreeKeyboard.ts           # Keyboard navigation hook
src/sidepanel/hooks/useMultiSelect.ts            # Multi-select state hook
src/sidepanel/hooks/useDragAndDrop.ts            # DnD state + handlers hook
src/components/ui/dropdown-menu.tsx              # shadcn/ui dropdown-menu (for context menus)
src/components/ui/popover.tsx                    # shadcn/ui popover (for pickers)
src/components/ui/tooltip.tsx                    # shadcn/ui tooltip (for breadcrumb on deep nesting)
```

### Files to modify

```
src/lib/notes-service.ts          # Update StoredNote, SyncQueueItem, add folderId/pinned/tags to db mappings
src/sidepanel/App.tsx             # Replace monolithic component with view switcher + shared state
src/background/service-worker.js  # Add SYNC_NOTE_TAGS, CREATE_FOLDER message handlers
src/content/index.tsx             # Add folder picker to note editor, hashtag extraction on save
```

---

## Task 1: Shared Types & Type Migration

**Files:**
- Create: `src/lib/types.ts`
- Modify: `src/lib/notes-service.ts`

This task extracts and extends the core types used across the entire feature.

- [ ] **Step 1: Create `src/lib/types.ts` with all shared types**

```typescript
// StoredFolder
export interface StoredFolder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  color: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// StoredTag
export interface StoredTag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

// Extended StoredNote (replaces the one in notes-service.ts)
export interface StoredNote {
  id: string;
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  content: string;
  color?: string;
  tagLabel?: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
  createdAt: string;
  // New fields
  folderId: string | null;
  tags: string[];
  pinned: boolean;
}

// Updated SyncQueueItem
export interface SyncQueueItem {
  id: string;
  entityType: 'note' | 'folder' | 'tag' | 'note_tag';
  action: 'save' | 'update' | 'delete';
  entityId: string;
  payload?: any;
  timestamp: number;
}

// Tree node for UI rendering
export interface FolderTreeNode {
  folder: StoredFolder;
  children: FolderTreeNode[];
  notes: StoredNote[];
}

// Tag color palette
export const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
] as const;
```

- [ ] **Step 2: Update `src/lib/notes-service.ts` to import types from `types.ts`**

Remove the `StoredNote`, `SyncQueueItem`, and `NotesService` interface definitions from `notes-service.ts`. Replace with imports:

```typescript
import { StoredNote, SyncQueueItem } from './types';
export type { StoredNote, SyncQueueItem };
```

Keep the `NotesService` interface in `notes-service.ts` (it's specific to the notes service pattern). Add the re-export so existing imports from `notes-service.ts` still work.

- [ ] **Step 3: Add new fields to `storedToDb` and `dbToStored` in `CloudNotesService`**

In `storedToDb` (line 163), add after `created_at`:
```typescript
folder_id: note.folderId || null,
pinned: note.pinned || false,
```

In `dbToStored` (line 312), add after `createdAt`:
```typescript
folderId: (row.folder_id as string) || null,
tags: [], // Tags are reconstructed from note_tags join — see Step 3b
pinned: (row.pinned as boolean) || false,
```

In `save` method (line 184), add `folder_id` and `pinned` to the insert object.

In `update` method (line 217), add mapping for `folderId` → `folder_id` and `pinned` → `pinned` in the `dbUpdates` block.

- [ ] **Step 3b: Modify `getAll()` and `getForPage()` to reconstruct tags from `note_tags` join**

The `notes` table does NOT have a `tags` column — tags live in the `note_tags` junction table. The cloud queries must join to reconstruct the `tags: string[]` array.

Update `getAll()` (line 291):
```typescript
const { data, error } = await supabase
  .from('notes')
  .select('*, note_tags(tag_id)')
  .eq('user_id', this.userId)
  .order('created_at', { ascending: false });
```

Update `getForPage()` (line 267) similarly:
```typescript
const { data, error } = await supabase
  .from('notes')
  .select('*, note_tags(tag_id)')
  .eq('user_id', this.userId)
  .eq('page_url', url);
```

Update `dbToStored` to extract tag IDs from the joined rows:
```typescript
private dbToStored(row: Record<string, unknown>): StoredNote {
  const noteTagRows = (row.note_tags as Array<{ tag_id: string }>) || [];
  return {
    // ... existing fields ...
    tags: noteTagRows.map(nt => nt.tag_id),
    // ...
  };
}
```

This ensures notes fetched from the cloud have their `tags[]` correctly populated.

- [ ] **Step 4: Update SyncQueueItem usage in CloudNotesService**

Update `queueOperation` to use `entityType` and `entityId`:

```typescript
private async queueOperation(
  action: 'save' | 'update' | 'delete',
  entityId: string,
  payload?: any,
  entityType: SyncQueueItem['entityType'] = 'note'
) {
  return new Promise<void>((resolve) => {
    chrome.storage.local.get(['divnotes_sync_queue'], (res) => {
      const queue: SyncQueueItem[] = res.divnotes_sync_queue || [];
      // Migrate legacy items
      const migrated = queue.map(item => {
        if (!item.entityType) {
          return { ...item, entityType: 'note' as const, entityId: (item as any).noteId };
        }
        return item;
      });
      migrated.push({
        id: crypto.randomUUID(),
        entityType,
        action,
        entityId,
        payload,
        timestamp: Date.now()
      });
      chrome.storage.local.set({ divnotes_sync_queue: migrated }, resolve);
    });
  });
}
```

Update `processSyncQueue` to handle legacy items and route by entity type. Add this migration at the start of the queue processing loop:

```typescript
// Inside processSyncQueue, before the for loop:
// Migrate legacy items in-place
const migratedQueue = queue.map(item => {
  if (!item.entityType) {
    return {
      ...item,
      entityType: 'note' as const,
      entityId: (item as any).noteId || item.entityId,
    };
  }
  return item;
});
```

Then in the loop, use `item.entityId` (which now always exists after migration) instead of `item.noteId`. For now, only handle `entityType === 'note'` — folder/tag handling is added in Task 19.

- [ ] **Step 5: Ensure defaults for new StoredNote fields**

Add a helper at the top of `notes-service.ts`:
```typescript
export function withNoteDefaults(note: Partial<StoredNote> & { id: string }): StoredNote {
  return {
    ...note,
    folderId: note.folderId ?? null,
    tags: note.tags ?? [],
    pinned: note.pinned ?? false,
  } as StoredNote;
}
```
Note: defaults are applied AFTER the spread using `??` (nullish coalescing) so that `undefined` values from the spread are caught, but explicit `null` on `folderId` is preserved.

- [ ] **Step 6: Build and verify no regressions**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors. Existing functionality unchanged since new fields default gracefully.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/notes-service.ts
git commit -m "feat: add shared types for folders, tags, and extended notes"
```

---

## Task 2: Tree & Tag Utility Functions

**Files:**
- Create: `src/lib/tree-utils.ts`
- Create: `src/lib/tag-utils.ts`

Pure functions with no Chrome API dependencies — easy to reason about and test.

- [ ] **Step 1: Create `src/lib/tree-utils.ts`**

```typescript
import type { StoredFolder, StoredNote, FolderTreeNode } from './types';

/** Build a tree from a flat folder list. Returns root-level nodes. */
export function buildFolderTree(
  folders: StoredFolder[],
  notes: StoredNote[]
): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  // Create nodes
  for (const folder of folders) {
    map.set(folder.id, { folder, children: [], notes: [] });
  }

  // Assign notes to folders
  for (const note of notes) {
    if (note.folderId && map.has(note.folderId)) {
      map.get(note.folderId)!.notes.push(note);
    }
  }

  // Build tree
  for (const node of map.values()) {
    if (node.folder.parentId && map.has(node.folder.parentId)) {
      map.get(node.folder.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by order
  const sortChildren = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.folder.order - b.folder.order);
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

/** Get all descendant folder IDs (recursive). */
export function getDescendantFolderIds(
  folderId: string,
  folders: StoredFolder[]
): string[] {
  const ids: string[] = [];
  const stack = [folderId];
  while (stack.length) {
    const current = stack.pop()!;
    const children = folders.filter(f => f.parentId === current);
    for (const child of children) {
      ids.push(child.id);
      stack.push(child.id);
    }
  }
  return ids;
}

/** Get ancestor path from root to the given folder (for breadcrumbs). */
export function getAncestorPath(
  folderId: string,
  folders: StoredFolder[]
): StoredFolder[] {
  const path: StoredFolder[] = [];
  let current = folders.find(f => f.id === folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? folders.find(f => f.id === current!.parentId)
      : undefined;
  }
  return path;
}

/** Get unfiled notes (folderId is null or undefined). */
export function getUnfiledNotes(notes: StoredNote[]): StoredNote[] {
  return notes.filter(n => !n.folderId);
}

/** Count total notes in a folder and all descendants. */
export function countNotesInTree(node: FolderTreeNode): number {
  let count = node.notes.length;
  for (const child of node.children) {
    count += countNotesInTree(child);
  }
  return count;
}
```

- [ ] **Step 2: Create `src/lib/tag-utils.ts`**

```typescript
import { TAG_COLORS } from './types';

/** Extract hashtag names from note content. Returns lowercase unique names.
 *  Pattern: # followed by 1-50 word chars, preceded by whitespace or start of line.
 *  IMPORTANT: Regex is created inside the function (not module-level) because /g flag
 *  maintains lastIndex state between calls, which would cause bugs if reused. */
export function extractHashtags(content: string): string[] {
  const regex = /(?:^|(?<=\s))#([a-zA-Z0-9_-]{1,50})(?=\s|$)/g;
  const tags = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags);
}

/** Assign a random color from the palette. */
export function assignRandomColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

/** Get the next sibling order value for a folder list. */
export function getNextOrder(siblings: { order: number }[]): number {
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map(s => s.order)) + 1;
}
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds. New files are pure utility — no side effects.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tree-utils.ts src/lib/tag-utils.ts
git commit -m "feat: add tree and tag utility functions"
```

---

## Task 3: Folders Service (Local + Cloud)

**Files:**
- Create: `src/lib/folders-service.ts`

Follows the exact same local-first + cloud sync pattern as `notes-service.ts`.

- [ ] **Step 1: Create `src/lib/folders-service.ts`**

```typescript
import { supabase } from './supabase';
import type { StoredFolder, SyncQueueItem } from './types';
import { getDescendantFolderIds } from './tree-utils';
import { getNextOrder } from './tag-utils';

export interface FoldersService {
  create(folder: StoredFolder): Promise<void>;
  update(id: string, updates: Partial<StoredFolder>): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(): Promise<StoredFolder[]>;
}

const STORAGE_KEY = 'divnotes_folders';

// ==================== LOCAL SERVICE ====================
export class LocalFoldersService implements FoldersService {
  private async getAllFolders(): Promise<StoredFolder[]> {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || [];
  }

  private async setAllFolders(folders: StoredFolder[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: folders });
  }

  async create(folder: StoredFolder): Promise<void> {
    const all = await this.getAllFolders();
    all.push(folder);
    await this.setAllFolders(all);
  }

  async update(id: string, updates: Partial<StoredFolder>): Promise<void> {
    const all = await this.getAllFolders();
    const idx = all.findIndex(f => f.id === id);
    if (idx > -1) {
      all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
      await this.setAllFolders(all);
    }
  }

  async delete(id: string): Promise<void> {
    const all = await this.getAllFolders();
    const descendantIds = getDescendantFolderIds(id, all);
    const toRemove = new Set([id, ...descendantIds]);
    const filtered = all.filter(f => !toRemove.has(f.id));
    await this.setAllFolders(filtered);

    // Move notes in deleted folders to Inbox
    const notesResult = await chrome.storage.local.get(['divnotes_notes']);
    const notes = notesResult.divnotes_notes || [];
    let changed = false;
    for (const note of notes) {
      if (note.folderId && toRemove.has(note.folderId)) {
        note.folderId = null;
        changed = true;
      }
    }
    if (changed) {
      await chrome.storage.local.set({ divnotes_notes: notes });
    }
  }

  async getAll(): Promise<StoredFolder[]> {
    return this.getAllFolders();
  }
}

// ==================== CLOUD SERVICE ====================
export class CloudFoldersService implements FoldersService {
  private local: LocalFoldersService;
  private userId: string;

  constructor(userId: string) {
    this.local = new LocalFoldersService();
    this.userId = userId;
  }

  private async queueOperation(action: 'save' | 'update' | 'delete', entityId: string, payload?: any) {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get(['divnotes_sync_queue'], (res) => {
        const queue: SyncQueueItem[] = res.divnotes_sync_queue || [];
        queue.push({
          id: crypto.randomUUID(),
          entityType: 'folder',
          action,
          entityId,
          payload,
          timestamp: Date.now()
        });
        chrome.storage.local.set({ divnotes_sync_queue: queue }, resolve);
      });
    });
  }

  async create(folder: StoredFolder): Promise<void> {
    await this.local.create(folder);
    try {
      const { error } = await supabase.from('folders').insert({
        id: folder.id,
        user_id: this.userId,
        name: folder.name,
        parent_id: folder.parentId,
        color: folder.color,
        pinned: folder.pinned || false,
        order: folder.order,
        created_at: folder.createdAt,
        updated_at: folder.updatedAt,
      });
      if (error) throw error;
    } catch {
      await this.queueOperation('save', folder.id, folder);
    }
  }

  async update(id: string, updates: Partial<StoredFolder>): Promise<void> {
    await this.local.update(id, updates);
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.pinned !== undefined) dbUpdates.pinned = updates.pinned;
    if (updates.order !== undefined) dbUpdates.order = updates.order;

    try {
      const { error } = await supabase.from('folders')
        .update(dbUpdates).eq('id', id).eq('user_id', this.userId);
      if (error) throw error;
    } catch {
      await this.queueOperation('update', id, dbUpdates);
    }
  }

  async delete(id: string): Promise<void> {
    await this.local.delete(id);
    try {
      const { error } = await supabase.from('folders')
        .delete().eq('id', id).eq('user_id', this.userId);
      if (error) throw error;
    } catch {
      await this.queueOperation('delete', id);
    }
  }

  async getAll(): Promise<StoredFolder[]> {
    try {
      const { data, error } = await supabase.from('folders')
        .select('*').eq('user_id', this.userId).order('order');
      if (error) throw error;
      if (data) {
        const folders: StoredFolder[] = data.map(row => ({
          id: row.id,
          name: row.name,
          parentId: row.parent_id,
          order: row.order,
          color: row.color,
          pinned: row.pinned || false,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        await chrome.storage.local.set({ [STORAGE_KEY]: folders });
        return folders;
      }
    } catch {
      console.warn('[DivNotes] Offline — using local folder cache');
    }
    return this.local.getAll();
  }
}

// ==================== FACTORY ====================
let _service: FoldersService | null = null;

export async function getFoldersService(): Promise<FoldersService> {
  if (_service) return _service;
  const result = await chrome.storage.local.get(['divnotes_auth']);
  const auth = result.divnotes_auth as { mode: string } | undefined;
  if (auth?.mode === 'authenticated') {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      _service = new CloudFoldersService(session.user.id);
      return _service;
    }
  }
  _service = new LocalFoldersService();
  return _service;
}

export function resetFoldersService() { _service = null; }
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/folders-service.ts
git commit -m "feat: add folders service with local and cloud support"
```

---

## Task 4: Tags Service (Local + Cloud)

**Files:**
- Create: `src/lib/tags-service.ts`

- [ ] **Step 1: Create `src/lib/tags-service.ts`**

```typescript
import { supabase } from './supabase';
import type { StoredTag, SyncQueueItem } from './types';
import { assignRandomColor } from './tag-utils';

export interface TagsService {
  create(tag: StoredTag): Promise<void>;
  update(id: string, updates: Partial<StoredTag>): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(): Promise<StoredTag[]>;
  /** Find or create a tag by name (case-insensitive). Returns the tag. */
  findOrCreate(name: string): Promise<StoredTag>;
  /** Set the tags for a note (replaces existing). */
  setNoteTags(noteId: string, tagIds: string[]): Promise<void>;
}

const STORAGE_KEY = 'divnotes_tags';

// ==================== LOCAL SERVICE ====================
export class LocalTagsService implements TagsService {
  private async getAllTags(): Promise<StoredTag[]> {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || [];
  }

  private async setAllTags(tags: StoredTag[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: tags });
  }

  async create(tag: StoredTag): Promise<void> {
    const all = await this.getAllTags();
    all.push(tag);
    await this.setAllTags(all);
  }

  async update(id: string, updates: Partial<StoredTag>): Promise<void> {
    const all = await this.getAllTags();
    const idx = all.findIndex(t => t.id === id);
    if (idx > -1) {
      all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
      await this.setAllTags(all);
    }
  }

  async delete(id: string): Promise<void> {
    const all = await this.getAllTags();
    await this.setAllTags(all.filter(t => t.id !== id));

    // Remove tag from all notes
    const notesResult = await chrome.storage.local.get(['divnotes_notes']);
    const notes = notesResult.divnotes_notes || [];
    let changed = false;
    for (const note of notes) {
      if (note.tags?.includes(id)) {
        note.tags = note.tags.filter((t: string) => t !== id);
        changed = true;
      }
    }
    if (changed) {
      await chrome.storage.local.set({ divnotes_notes: notes });
    }
  }

  async getAll(): Promise<StoredTag[]> {
    return this.getAllTags();
  }

  async findOrCreate(name: string): Promise<StoredTag> {
    const all = await this.getAllTags();
    const normalized = name.toLowerCase();
    const existing = all.find(t => t.name.toLowerCase() === normalized);
    if (existing) return existing;

    const now = new Date().toISOString();
    const tag: StoredTag = {
      id: crypto.randomUUID(),
      name: normalized,
      color: assignRandomColor(),
      createdAt: now,
      updatedAt: now,
    };
    await this.create(tag);
    return tag;
  }

  async setNoteTags(noteId: string, tagIds: string[]): Promise<void> {
    const notesResult = await chrome.storage.local.get(['divnotes_notes']);
    const notes = notesResult.divnotes_notes || [];
    const idx = notes.findIndex((n: any) => n.id === noteId);
    if (idx > -1) {
      notes[idx].tags = tagIds;
      await chrome.storage.local.set({ divnotes_notes: notes });
    }
  }
}

// ==================== CLOUD SERVICE ====================
export class CloudTagsService implements TagsService {
  private local: LocalTagsService;
  private userId: string;

  constructor(userId: string) {
    this.local = new LocalTagsService();
    this.userId = userId;
  }

  private async queueOperation(
    action: 'save' | 'update' | 'delete',
    entityId: string,
    payload?: any,
    entityType: 'tag' | 'note_tag' = 'tag'
  ) {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get(['divnotes_sync_queue'], (res) => {
        const queue: SyncQueueItem[] = res.divnotes_sync_queue || [];
        queue.push({
          id: crypto.randomUUID(),
          entityType,
          action,
          entityId,
          payload,
          timestamp: Date.now()
        });
        chrome.storage.local.set({ divnotes_sync_queue: queue }, resolve);
      });
    });
  }

  async create(tag: StoredTag): Promise<void> {
    await this.local.create(tag);
    try {
      const { error } = await supabase.from('tags').insert({
        id: tag.id, user_id: this.userId,
        name: tag.name, color: tag.color,
        created_at: tag.createdAt, updated_at: tag.updatedAt,
      });
      if (error) throw error;
    } catch {
      await this.queueOperation('save', tag.id, tag);
    }
  }

  async update(id: string, updates: Partial<StoredTag>): Promise<void> {
    await this.local.update(id, updates);
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    try {
      const { error } = await supabase.from('tags')
        .update(dbUpdates).eq('id', id).eq('user_id', this.userId);
      if (error) throw error;
    } catch {
      await this.queueOperation('update', id, dbUpdates);
    }
  }

  async delete(id: string): Promise<void> {
    await this.local.delete(id);
    try {
      const { error } = await supabase.from('tags')
        .delete().eq('id', id).eq('user_id', this.userId);
      if (error) throw error;
    } catch {
      await this.queueOperation('delete', id);
    }
  }

  async getAll(): Promise<StoredTag[]> {
    try {
      const { data, error } = await supabase.from('tags')
        .select('*').eq('user_id', this.userId).order('name');
      if (error) throw error;
      if (data) {
        const tags: StoredTag[] = data.map(row => ({
          id: row.id, name: row.name, color: row.color,
          createdAt: row.created_at, updatedAt: row.updated_at,
        }));
        await chrome.storage.local.set({ [STORAGE_KEY]: tags });
        return tags;
      }
    } catch {
      console.warn('[DivNotes] Offline — using local tag cache');
    }
    return this.local.getAll();
  }

  async findOrCreate(name: string): Promise<StoredTag> {
    // Check local first
    const tag = await this.local.findOrCreate(name);
    // If it was just created locally, sync to cloud
    try {
      await supabase.from('tags').upsert({
        id: tag.id, user_id: this.userId,
        name: tag.name, color: tag.color,
        created_at: tag.createdAt, updated_at: tag.updatedAt,
      });
    } catch {
      await this.queueOperation('save', tag.id, tag);
    }
    return tag;
  }

  async setNoteTags(noteId: string, tagIds: string[]): Promise<void> {
    // Get current tags for diff
    const notesResult = await chrome.storage.local.get(['divnotes_notes']);
    const notes = notesResult.divnotes_notes || [];
    const note = notes.find((n: any) => n.id === noteId);
    const oldTagIds: string[] = note?.tags || [];

    // Update locally
    await this.local.setNoteTags(noteId, tagIds);

    // Sync diff to cloud
    const added = tagIds.filter(id => !oldTagIds.includes(id));
    const removed = oldTagIds.filter(id => !tagIds.includes(id));

    for (const tagId of added) {
      try {
        await supabase.from('note_tags').insert({ note_id: noteId, tag_id: tagId });
      } catch {
        await this.queueOperation('save', `${noteId}:${tagId}`, { note_id: noteId, tag_id: tagId }, 'note_tag');
      }
    }
    for (const tagId of removed) {
      try {
        await supabase.from('note_tags').delete()
          .eq('note_id', noteId).eq('tag_id', tagId);
      } catch {
        await this.queueOperation('delete', `${noteId}:${tagId}`, { note_id: noteId, tag_id: tagId }, 'note_tag');
      }
    }
  }
}

// ==================== FACTORY ====================
let _service: TagsService | null = null;

export async function getTagsService(): Promise<TagsService> {
  if (_service) return _service;
  const result = await chrome.storage.local.get(['divnotes_auth']);
  const auth = result.divnotes_auth as { mode: string } | undefined;
  if (auth?.mode === 'authenticated') {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      _service = new CloudTagsService(session.user.id);
      return _service;
    }
  }
  _service = new LocalTagsService();
  return _service;
}

export function resetTagsService() { _service = null; }
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tags-service.ts
git commit -m "feat: add tags service with local and cloud support"
```

---

## Task 5: Add shadcn/ui Components (dropdown-menu, popover, tooltip)

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/popover.tsx`
- Create: `src/components/ui/tooltip.tsx`

These are needed for context menus, pickers, and breadcrumb tooltips.

- [ ] **Step 1: Install Radix UI dependencies**

`@radix-ui/react-dropdown-menu` and `@radix-ui/react-tooltip` are already in `package.json`. Only `@radix-ui/react-popover` is missing:

```bash
npm install @radix-ui/react-popover
```

- [ ] **Step 2: Create the three components**

Use `npx shadcn@latest add dropdown-menu popover tooltip` if it works with the project setup, otherwise manually create them following shadcn/ui patterns from the existing components in `src/components/ui/`. Reference `./components.json` (project root) for style settings (Tailwind CSS, `cn()` utility, path aliases).

Each component should follow the exact same pattern as the existing `button.tsx`, `card.tsx`, etc. — Radix primitives wrapped with Tailwind classes via `cn()`.

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx src/components/ui/popover.tsx src/components/ui/tooltip.tsx package.json package-lock.json
git commit -m "feat: add dropdown-menu, popover, and tooltip shadcn components"
```

---

## Task 6: Segmented Control & Sidebar Shell

**Files:**
- Create: `src/sidepanel/components/SegmentedControl.tsx`
- Modify: `src/sidepanel/App.tsx`

Refactors App.tsx from one monolithic component into a shell with view switching.

- [ ] **Step 1: Create `src/sidepanel/components/SegmentedControl.tsx`**

```typescript
import React from 'react';
import { Globe, FolderTree, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'sites' | 'folders' | 'tags';

interface SegmentedControlProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const items: { value: ViewMode; label: string; icon: React.ElementType }[] = [
  { value: 'sites', label: 'Sites', icon: Globe },
  { value: 'folders', label: 'Folders', icon: FolderTree },
  { value: 'tags', label: 'Tags', icon: Tags },
];

export function SegmentedControl({ value, onChange }: SegmentedControlProps) {
  return (
    <div className="flex bg-muted/50 rounded-lg p-0.5">
      {items.map(item => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium rounded-md transition-all',
            value === item.value
              ? 'bg-primary/20 text-primary font-semibold'
              : 'text-muted-foreground/40 hover:text-muted-foreground/60'
          )}
        >
          <item.icon className="w-3.5 h-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Refactor `src/sidepanel/App.tsx` into a shell**

Replace the entire file. The new App.tsx:
- Keeps the header, search bar, export button, and screen share banner
- Adds `SegmentedControl` between header and search
- Loads notes, folders, and tags from chrome.storage.local
- Passes data down to the active view component
- For now, Sites view renders a placeholder `<div>Sites view TODO</div>`, same for Folders and Tags (actual view components built in subsequent tasks)

Key state:
```typescript
const [viewMode, setViewMode] = useState<ViewMode>('sites');
const [notes, setNotes] = useState<StoredNote[]>([]);
const [folders, setFolders] = useState<StoredFolder[]>([]);
const [tags, setTags] = useState<StoredTag[]>([]);
const [searchQuery, setSearchQuery] = useState('');
```

Storage listener watches `divnotes_notes`, `divnotes_folders`, and `divnotes_tags` for changes.

- [ ] **Step 3: Build and verify the shell renders**

Run: `npm run build`
Load the extension, open the sidepanel. Expected: header + segmented control + search bar visible, clicking tabs switches the placeholder text.

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/components/SegmentedControl.tsx src/sidepanel/App.tsx
git commit -m "feat: add segmented control and refactor sidepanel into view shell"
```

---

## Task 7: Shared Components (NoteCard, TagPill, PinnedSection)

**Files:**
- Create: `src/sidepanel/components/NoteCard.tsx`
- Create: `src/sidepanel/components/TagPill.tsx`
- Create: `src/sidepanel/components/PinnedSection.tsx`

Reusable across all three views.

- [ ] **Step 1: Create `NoteCard.tsx`**

Displays a single note in the tree. Shows: element tag badge, content preview (2 lines), tag pills (max 2 + overflow), date. Click to expand (shows full markdown-rendered content + action buttons). Props: `note`, `tags` (for resolving tag IDs to names/colors), `onDelete`, `onNavigate`, `onTogglePin`, `showFolderPath?`, `folderPath?`.

Use the existing markdown rendering pattern from the current `App.tsx` (DOMPurify + marked).

- [ ] **Step 2: Create `TagPill.tsx`**

Small colored pill showing a tag name. Props: `tag: StoredTag`, `onClick?`, `onRemove?`, `size?: 'sm' | 'md'`. The `sm` size is for inline display in notes, `md` for the tag cloud.

```typescript
import { cn } from '@/lib/utils';
import { Tag, X } from 'lucide-react';
import type { StoredTag } from '@/lib/types';

interface TagPillProps {
  tag: StoredTag;
  onClick?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  active?: boolean;
}

export function TagPill({ tag, onClick, onRemove, size = 'sm', active }: TagPillProps) {
  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium cursor-pointer transition-all',
        size === 'sm' ? 'text-[8px] px-1.5 py-0.5' : 'text-[10px] px-2.5 py-1',
        active && 'ring-1',
      )}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        borderColor: active ? `${tag.color}60` : undefined,
      }}
    >
      {size === 'md' && <Tag className="w-2.5 h-2.5" />}
      {tag.name}
      {onRemove && (
        <X
          className="w-2.5 h-2.5 opacity-60 hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        />
      )}
    </span>
  );
}
```

- [ ] **Step 3: Create `PinnedSection.tsx`**

Shows starred notes and folders at the top of any view. Props: `pinnedNotes`, `pinnedFolders?`, `tags`, `onNoteClick`, `onFolderClick?`. Renders a collapsible section with `Star` icon header.

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/components/NoteCard.tsx src/sidepanel/components/TagPill.tsx src/sidepanel/components/PinnedSection.tsx
git commit -m "feat: add shared NoteCard, TagPill, and PinnedSection components"
```

---

## Task 8: Sites View

**Files:**
- Create: `src/sidepanel/components/SitesView.tsx`
- Modify: `src/sidepanel/App.tsx` (replace placeholder)

Extract the existing domain > page > notes grouping logic from the old App.tsx into its own component, enhanced with pinned section and folder-filing icon.

- [ ] **Step 1: Create `SitesView.tsx`**

Port the `groupedDomains` memo and domain/page tree rendering from the old `App.tsx`. Add:
- `PinnedSection` at the top for pinned notes
- A small `Folder` icon on hover for each note row that opens `FolderPicker` (Task 12)
- Uses `NoteCard` for note rendering

Props: `notes`, `folders`, `tags`, `searchQuery`, `notesService`, `foldersService`.

- [ ] **Step 2: Wire into `App.tsx`**

Replace the Sites placeholder with `<SitesView ... />` passing the required props.

- [ ] **Step 3: Build and test**

Run: `npm run build`
Load extension, open sidepanel. Sites view should look identical to the old sidebar (with the addition of the segmented control above it).

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/components/SitesView.tsx src/sidepanel/App.tsx
git commit -m "feat: extract Sites view from monolithic sidepanel"
```

---

## Task 9: Folders View (Tree Rendering)

**Files:**
- Create: `src/sidepanel/components/FoldersView.tsx`
- Create: `src/sidepanel/components/FolderTreeNode.tsx`
- Modify: `src/sidepanel/App.tsx` (replace placeholder)

- [ ] **Step 1: Create `FolderTreeNode.tsx`**

Recursive component that renders a single folder row + its children. Props: `node: FolderTreeNode`, `depth: number`, `tags`, `expandedFolders`, `onToggle`, `onNoteClick`, `onFolderAction`. Visual indent caps at depth 6. Shows: chevron, colored `Folder` icon, name, note count badge. Children render recursively. Notes within the folder render as `NoteCard` items with tag pills.

- [ ] **Step 2: Create `FoldersView.tsx`**

Uses `buildFolderTree()` to construct the tree. Renders:
1. `PinnedSection` (pinned folders + pinned notes)
2. Inbox row with `Inbox` icon and unfiled note count badge (uses `getUnfiledNotes()`)
3. "Folders" section label
4. `FolderTreeNode` for each root node
5. `FolderPlus` button in header to create new root folder (calls `foldersService.create()`)

Props: `notes`, `folders`, `tags`, `searchQuery`, `foldersService`, `notesService`.

- [ ] **Step 3: Wire into `App.tsx`**

Replace the Folders placeholder.

- [ ] **Step 4: Build and test**

Run: `npm run build`
Load extension, switch to Folders tab. Should show Inbox with all notes (since no folders exist yet). Create a folder via the + button, verify it appears.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/components/FoldersView.tsx src/sidepanel/components/FolderTreeNode.tsx src/sidepanel/App.tsx
git commit -m "feat: add Folders view with tree rendering and Inbox"
```

---

## Task 10: Tags View

**Files:**
- Create: `src/sidepanel/components/TagsView.tsx`
- Modify: `src/sidepanel/App.tsx` (replace placeholder)

- [ ] **Step 1: Create `TagsView.tsx`**

Renders:
1. Tag cloud: all tags as `TagPill` (size `md`) with note counts. Clicking toggles the tag as an active filter. Multiple tags = AND filter.
2. Active filter bar: shows selected tags as dismissible chips (with `X` to remove)
3. Filtered note list: all notes that have ALL selected tags. Each note rendered as `NoteCard` with `showFolderPath` enabled (using `getAncestorPath()`).
4. Settings icon (`Settings` from lucide) in the section header — placeholder for tag management (Task 14).

Props: `notes`, `folders`, `tags`, `searchQuery`, `tagsService`.

- [ ] **Step 2: Wire into `App.tsx`**

Replace the Tags placeholder.

- [ ] **Step 3: Build and test**

Run: `npm run build`
Load extension, switch to Tags tab. Should show empty state since no tags exist yet.

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/components/TagsView.tsx src/sidepanel/App.tsx
git commit -m "feat: add Tags view with tag cloud and filtering"
```

---

## Task 11: Context Menus

**Files:**
- Create: `src/sidepanel/components/ContextMenu.tsx`
- Modify: `src/sidepanel/components/FolderTreeNode.tsx`
- Modify: `src/sidepanel/components/NoteCard.tsx`

- [ ] **Step 1: Create `ContextMenu.tsx`**

Two exported components: `FolderContextMenu` and `NoteContextMenu`. Built with Radix `DropdownMenu`. Each renders the menu items from the spec with Lucide icons.

`FolderContextMenu` props: `folder`, `onNewSubfolder`, `onNewNote`, `onRename`, `onChangeColor`, `onTogglePin`, `onDelete`.

`NoteContextMenu` props: `note`, `onOpenOnPage`, `onEdit`, `onMoveToFolder`, `onAddTags`, `onTogglePin`, `onDuplicate`, `onDelete`.

- [ ] **Step 2: Integrate into `FolderTreeNode` and `NoteCard`**

Wrap folder rows and note cards with the context menu trigger (right-click). Wire up the action handlers.

- [ ] **Step 3: Implement the action handlers**

In `FoldersView.tsx`, implement:
- `handleNewSubfolder`: prompt for name, call `foldersService.create()` with `parentId`
- `handleRename`: inline text input replacing the folder name
- `handleChangeColor`: small color picker popover with preset colors
- `handleTogglePin`: update folder/note `pinned` field
- `handleDeleteFolder`: confirmation dialog, then `foldersService.delete()`

- [ ] **Step 4: Build and test**

Run: `npm run build`
Right-click a folder → context menu appears. Test: create subfolder, rename, delete.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/components/ContextMenu.tsx src/sidepanel/components/FolderTreeNode.tsx src/sidepanel/components/NoteCard.tsx src/sidepanel/components/FoldersView.tsx
git commit -m "feat: add context menus for folders and notes"
```

---

## Task 12: Folder Picker & Tag Picker Popovers

**Files:**
- Create: `src/sidepanel/components/FolderPicker.tsx`
- Create: `src/sidepanel/components/TagPicker.tsx`

- [ ] **Step 1: Create `FolderPicker.tsx`**

A Radix `Popover` that shows a mini folder tree for selecting a destination folder. Props: `folders`, `currentFolderId`, `onSelect`, `onCreateFolder`. Shows the tree using `buildFolderTree()` in a scrollable container (max 200px). Includes "New Folder" button at the bottom. Used by: NoteContextMenu "Move to Folder...", Sites view filing icon, and later the content script (adapted to pure DOM).

- [ ] **Step 2: Create `TagPicker.tsx`**

A Radix `Popover` with an autocomplete input. Props: `tags` (all available), `selectedTagIds`, `onToggleTag`, `onCreateTag`. Shows existing tags filtered by input, with a "Create [name]" option if no match. Each tag shown as a `TagPill` with a checkbox state.

- [ ] **Step 3: Wire TagPicker into NoteContextMenu "Add Tags..."**

When "Add Tags..." is clicked, open `TagPicker` popover anchored to the menu item position.

- [ ] **Step 4: Build and test**

Run: `npm run build`
Test: right-click note → "Move to Folder..." → picker appears → select folder → note moves. Right-click note → "Add Tags..." → picker appears → create tag → tag appears on note.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/components/FolderPicker.tsx src/sidepanel/components/TagPicker.tsx
git commit -m "feat: add folder and tag picker popovers"
```

---

## Task 13: Service Worker Message Handlers

**Files:**
- Modify: `src/background/service-worker.js`

- [ ] **Step 1: Add `SYNC_NOTE_TAGS` handler**

**Note:** The service worker is plain JS copied without a build step, so it cannot import from `src/lib/types.ts`. The `TAG_COLORS` array is intentionally duplicated here. If the palette changes in `types.ts`, it must also be updated in `service-worker.js`.

```javascript
if (message.type === 'SYNC_NOTE_TAGS') {
  const { noteId, tagNames } = message;
  // Resolve tag names to IDs, creating new tags if needed
  chrome.storage.local.get(['divnotes_tags', 'divnotes_notes'], (result) => {
    const tags = result.divnotes_tags || [];
    const notes = result.divnotes_notes || [];
    const resolvedTagIds = [];

    for (const name of tagNames) {
      const normalized = name.toLowerCase();
      let tag = tags.find(t => t.name.toLowerCase() === normalized);
      if (!tag) {
        // Duplicated from src/lib/types.ts TAG_COLORS — keep in sync
        const TAG_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#6366f1','#a855f7','#ec4899'];
        tag = {
          id: crypto.randomUUID(),
          name: normalized,
          color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        tags.push(tag);
      }
      resolvedTagIds.push(tag.id);
    }

    // Update note's tags array
    const noteIdx = notes.findIndex(n => n.id === noteId);
    if (noteIdx > -1) {
      notes[noteIdx].tags = resolvedTagIds;
    }

    chrome.storage.local.set({
      divnotes_tags: tags,
      divnotes_notes: notes,
    }, () => sendResponse({ success: true, tagIds: resolvedTagIds }));
  });
  return true;
}
```

- [ ] **Step 2: Add `CREATE_FOLDER` handler**

```javascript
if (message.type === 'CREATE_FOLDER') {
  const { name, parentId } = message;
  chrome.storage.local.get(['divnotes_folders'], (result) => {
    const folders = result.divnotes_folders || [];
    const siblings = folders.filter(f => f.parentId === parentId);
    const order = siblings.length > 0 ? Math.max(...siblings.map(f => f.order)) + 1 : 0;
    const folder = {
      id: crypto.randomUUID(),
      name,
      parentId: parentId || null,
      order,
      color: null,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    folders.push(folder);
    chrome.storage.local.set({ divnotes_folders: folders }, () => {
      sendResponse({ success: true, folder });
    });
  });
  return true;
}
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Service worker now handles the two new message types.

- [ ] **Step 4: Commit**

```bash
git add src/background/service-worker.js
git commit -m "feat: add SYNC_NOTE_TAGS and CREATE_FOLDER message handlers to service worker"
```

---

## Task 14: Content Script — Folder Picker & Hashtag Extraction

**Files:**
- Modify: `src/content/index.tsx`

- [ ] **Step 1: Add folder picker to the note editor**

In the `showNoteEditor` function (around line 665, before the action buttons), add a folder picker row:
- Read `divnotes_folders` and `divnotes_notes` from `chrome.storage.local`
- Run auto-suggest logic: count notes per folder for current domain, pick the folder with >50% share, or null (Inbox)
- Render a dropdown showing the suggested folder name (or "Inbox") with a "Change" button
- "Change" opens a scrollable mini tree (pure DOM, max 200px height) built from the flat folder list
- "New Folder" at the bottom sends `CREATE_FOLDER` message to service worker, adds the returned folder to the picker
- Store selected `folderId` in a closure variable

- [ ] **Step 2: Include `folderId` in note save**

In the save button click handler (line 746), add `folderId` to the `StoredNote` object created in `saveNotesToStorage`. In the `storedNotes` mapping (line 940-954), include:
```typescript
folderId: note.folderId || null,
tags: note.tags || [],
pinned: note.pinned || false,
```

Also store the selected `folderId` on the `SavedNote` interface (add the field).

- [ ] **Step 3: Add hashtag extraction on save**

After `saveNotesToStorage()` is called in the save handler (line 776), extract hashtags and send to service worker:

```typescript
const hashtags = extractHashtagsFromContent(val);
if (hashtags.length > 0) {
  chrome.runtime.sendMessage({
    type: 'SYNC_NOTE_TAGS',
    noteId: note.id,
    tagNames: hashtags,
  });
}
```

Add the extraction function at the top of the content script (cannot import from lib, so inline it):
```typescript
function extractHashtagsFromContent(content: string): string[] {
  const regex = /(?:^|(?<=\s))#([a-zA-Z0-9_-]{1,50})(?=\s|$)/g;
  const tags = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags);
}
```

- [ ] **Step 4: Build and test end-to-end**

Run: `npm run build`
Load extension. Navigate to a page, create a note with `#exam-review` in the content and select a folder. Verify:
1. Folder picker shows in editor
2. Note saved with `folderId` set
3. Tag appears in sidepanel Tags view
4. Note shows in the correct folder in Folders view

- [ ] **Step 5: Commit**

```bash
git add src/content/index.tsx
git commit -m "feat: add folder picker and hashtag extraction to content script"
```

---

## Task 15: Tag Management Panel

**Files:**
- Create: `src/sidepanel/components/TagManager.tsx`
- Modify: `src/sidepanel/components/TagsView.tsx`

- [ ] **Step 1: Create `TagManager.tsx`**

A panel/dialog accessed from the Settings icon in the Tags view. Shows all tags in a list with:
- Inline rename (click tag name to edit)
- Color picker (click color dot to change)
- Delete button (with confirmation)
- Merge: select two tags via checkboxes, "Merge" button combines them

Props: `tags`, `tagsService`, `onClose`.

- [ ] **Step 2: Wire into TagsView**

The Settings icon in the TagsView header opens `TagManager` as a slide-over or dialog.

- [ ] **Step 3: Build and test**

Run: `npm run build`
Test: create two tags, rename one, change color, merge them, delete one.

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/components/TagManager.tsx src/sidepanel/components/TagsView.tsx
git commit -m "feat: add tag management panel with rename, color, merge, and delete"
```

---

## Task 16: Keyboard Navigation

**Files:**
- Create: `src/sidepanel/hooks/useTreeKeyboard.ts`
- Modify: `src/sidepanel/components/FoldersView.tsx`
- Modify: `src/sidepanel/components/SitesView.tsx`

- [ ] **Step 1: Create `useTreeKeyboard.ts`**

A hook that manages focus state for a tree of items. Maintains a `focusedId` and handles:
- `ArrowUp/Down`: move focus to prev/next visible item (respects collapsed folders)
- `ArrowRight`: expand focused folder
- `ArrowLeft`: collapse focused folder or move to parent
- `Enter`: toggle expand or open note
- `Space`: toggle selection
- `Delete`: trigger delete callback
- `F2`: trigger rename callback
- `/`: focus search input

Takes: `flatVisibleItems` (ordered list of visible item IDs), callbacks for expand/collapse/select/delete/rename.

Returns: `focusedId`, `onKeyDown` handler to attach to the container.

- [ ] **Step 2: Integrate into FoldersView and SitesView**

Add `onKeyDown={onKeyDown}` and `tabIndex={0}` to the tree container div. Highlight the focused row with a ring or background change.

- [ ] **Step 3: Build and test**

Run: `npm run build`
Test: click into the folder tree, use arrow keys to navigate, Enter to expand, F2 to rename.

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/hooks/useTreeKeyboard.ts src/sidepanel/components/FoldersView.tsx src/sidepanel/components/SitesView.tsx
git commit -m "feat: add keyboard navigation for tree views"
```

---

## Task 17: Multi-Select & Bulk Actions

**Files:**
- Create: `src/sidepanel/hooks/useMultiSelect.ts`
- Create: `src/sidepanel/components/BulkActionBar.tsx`
- Modify: `src/sidepanel/components/FoldersView.tsx`

- [ ] **Step 1: Create `useMultiSelect.ts`**

Hook managing a `Set<string>` of selected item IDs. Handles:
- `toggleItem(id, event)`: Cmd+Click toggles, Shift+Click selects range
- `selectAll(visibleIds)`: Cmd+A
- `clearSelection()`
- Returns: `selectedIds`, `isSelected(id)`, event handlers

- [ ] **Step 2: Create `BulkActionBar.tsx`**

Fixed bar at the bottom of the sidepanel, visible when `selectedIds.size > 1`. Shows count + buttons: "Move to..." (opens FolderPicker), "Tag..." (opens TagPicker), "Pin" (toggle), "Delete" (with confirmation). Props: `selectedIds`, `notes`, `folders`, `tags`, `onMoveToFolder`, `onAddTags`, `onTogglePin`, `onDelete`, `onClear`.

- [ ] **Step 3: Integrate into FoldersView**

Add click handlers that call `useMultiSelect` methods. Show `BulkActionBar` when selection is active. Selected items get `bg-primary/10` highlight.

- [ ] **Step 4: Build and test**

Run: `npm run build`
Test: Cmd+click two notes → bulk bar appears → "Move to..." → select folder → both notes move.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/hooks/useMultiSelect.ts src/sidepanel/components/BulkActionBar.tsx src/sidepanel/components/FoldersView.tsx
git commit -m "feat: add multi-select and bulk action bar"
```

---

## Task 18: Drag and Drop

**Files:**
- Create: `src/sidepanel/hooks/useDragAndDrop.ts`
- Modify: `src/sidepanel/components/FolderTreeNode.tsx`
- Modify: `src/sidepanel/components/FoldersView.tsx`

- [ ] **Step 1: Create `useDragAndDrop.ts`**

Hook using native HTML5 drag/drop API (no library dependency). Manages:
- `draggedItem`: the note or folder being dragged
- `dropTarget`: the folder or position being hovered
- `dropPosition`: `'inside' | 'before' | 'after'`

Handlers: `onDragStart`, `onDragOver` (determine drop target/position from mouse Y relative to element midpoint), `onDragEnd`, `onDrop`.

On drop:
- Note → folder: update `note.folderId` via `notesService.update()`
- Folder → folder: update `folder.parentId` via `foldersService.update()` (prevent dropping into own descendants)
- Reorder: update `order` fields of affected siblings

- [ ] **Step 2: Add drag attributes to `FolderTreeNode`**

Add `draggable`, `onDragStart`, `onDragOver`, `onDragEnd`, `onDrop` to folder and note rows. Show a 2px purple indicator line at the drop position.

- [ ] **Step 3: Build and test**

Run: `npm run build`
Test: drag a note onto a folder → note moves. Drag a folder into another → reparents. Drag between folders → reorders.

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/hooks/useDragAndDrop.ts src/sidepanel/components/FolderTreeNode.tsx src/sidepanel/components/FoldersView.tsx
git commit -m "feat: add drag and drop for folders and notes"
```

---

## Task 19: Sync Queue Processing for Folders & Tags

**Files:**
- Modify: `src/lib/notes-service.ts` (extend `processSyncQueue`)

- [ ] **Step 1: Update `processSyncQueue` to route by entity type**

In the `processSyncQueue` method of `CloudNotesService`, update the loop to check `item.entityType`:

```typescript
for (const item of queue) {
  try {
    const entityType = item.entityType || 'note';

    if (entityType === 'note') {
      // existing note sync logic (unchanged)
    } else if (entityType === 'folder') {
      if (item.action === 'save' && item.payload) {
        const f = item.payload;
        await supabase.from('folders').upsert({
          id: f.id, user_id: this.userId, name: f.name,
          parent_id: f.parentId, color: f.color, order: f.order,
          created_at: f.createdAt, updated_at: f.updatedAt,
        });
      } else if (item.action === 'update' && item.payload) {
        await supabase.from('folders').update(item.payload)
          .eq('id', item.entityId).eq('user_id', this.userId);
      } else if (item.action === 'delete') {
        await supabase.from('folders').delete()
          .eq('id', item.entityId).eq('user_id', this.userId);
      }
    } else if (entityType === 'tag') {
      // same pattern for tags table
    } else if (entityType === 'note_tag') {
      if (item.action === 'save' && item.payload) {
        await supabase.from('note_tags').upsert(item.payload);
      } else if (item.action === 'delete' && item.payload) {
        await supabase.from('note_tags').delete()
          .eq('note_id', item.payload.note_id)
          .eq('tag_id', item.payload.tag_id);
      }
    }
  } catch (err) {
    failedQueue.push(item);
  }
}
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Offline folder/tag operations now sync on reconnect.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notes-service.ts
git commit -m "feat: extend sync queue to process folder, tag, and note_tag operations"
```

---

## Task 20: Supabase Migration SQL

**Files:**
- Create: `supabase/migrations/001_folders_tags.sql`

**Note:** This task is placed at the end because the extension is local-first — all features work without the migration via chrome.storage.local. However, if you need to test cloud sync functionality during development, apply this migration to your Supabase project first (before Tasks 3-4). The local-only path is always functional without it.

- [ ] **Step 1: Write the migration file**

```sql
-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES auth.users NOT NULL,
  name        text NOT NULL,
  parent_id   uuid REFERENCES folders(id) ON DELETE CASCADE,
  color       text,
  pinned      boolean DEFAULT false,
  "order"     integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id          uuid PRIMARY KEY,
  user_id     uuid REFERENCES auth.users NOT NULL,
  name        text NOT NULL,
  color       text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Create note_tags junction table
CREATE TABLE IF NOT EXISTS note_tags (
  note_id     uuid REFERENCES notes(id) ON DELETE CASCADE,
  tag_id      uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- Add new columns to notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;

-- RLS policies for folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY folders_user_policy ON folders FOR ALL USING (user_id = auth.uid());

-- RLS policies for tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_user_policy ON tags FOR ALL USING (user_id = auth.uid());

-- RLS for note_tags (user must own the note)
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY note_tags_user_policy ON note_tags FOR ALL
  USING (note_id IN (SELECT id FROM notes WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/001_folders_tags.sql
git commit -m "feat: add Supabase migration for folders, tags, and note_tags tables"
```

---

## Task 21: Final Integration & Polish

**Files:**
- Modify: `src/sidepanel/App.tsx`
- Modify: `src/popup/Dashboard.tsx`

- [ ] **Step 1: Wire resetFoldersService and resetTagsService into logout**

In `src/popup/App.tsx` `handleLogout`, import and call `resetFoldersService()` and `resetTagsService()` alongside the existing `resetNotesService()`.

- [ ] **Step 2: Update popup Dashboard to show folder/tag counts**

In `Dashboard.tsx`, read `divnotes_folders` and `divnotes_tags` from storage. Show folder count and tag count alongside the existing note count.

- [ ] **Step 3: Update export/import to include folders and tags**

In `Dashboard.tsx` `handleExport`: include `divnotes_folders` and `divnotes_tags` in the export JSON.

In `handleImport`: read folders and tags from the import file, merge with existing (deduplicate by id), write back to chrome.storage.

- [ ] **Step 4: Full build and end-to-end test**

Run: `npm run build`
Load extension. Test the complete flow:
1. Create notes on different pages
2. Open sidepanel → Sites view shows domain grouping
3. Switch to Folders → Inbox shows all notes
4. Create folders, move notes
5. Add tags via hashtags and via picker
6. Switch to Tags → filter by tag
7. Pin a folder, verify it appears at top
8. Right-click context menus work
9. Keyboard navigation works
10. Multi-select + bulk move works
11. Drag and drop works
12. Export includes folders/tags, import restores them

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/App.tsx src/popup/App.tsx src/popup/Dashboard.tsx
git commit -m "feat: complete sidebar redesign integration and polish"
```
