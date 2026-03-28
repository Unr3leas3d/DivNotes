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
