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
