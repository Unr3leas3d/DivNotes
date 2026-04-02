import { canUseCloudSync, readStoredAccountState } from './account-state.ts';
import { supabase } from './supabase.ts';
import type { StoredNote, SyncQueueItem } from './types.ts';
export type { StoredNote, SyncQueueItem };

export function withNoteDefaults(note: Partial<StoredNote> & { id: string }): StoredNote {
    const createdAt = note.createdAt ?? new Date().toISOString();
    const updatedAt = note.updatedAt ?? createdAt;
    return {
        ...note,
        createdAt,
        updatedAt,
        folderId: note.folderId ?? null,
        tags: note.tags ?? [],
        pinned: note.pinned ?? false,
    } as StoredNote;
}

async function isCloudSyncEnabled() {
    const account = await readStoredAccountState();
    const cloudSyncEnabled = canUseCloudSync(account);
    return cloudSyncEnabled;
}

// ==================== INTERFACE ====================
export interface NotesService {
    save(note: StoredNote): Promise<void>;
    update(id: string, updates: Partial<StoredNote>): Promise<void>;
    delete(id: string): Promise<void>;
    getForPage(url: string): Promise<StoredNote[]>;
    getAll(): Promise<StoredNote[]>;
}

// ==================== LOCAL SERVICE ====================
// Uses chrome.storage.local — same as Phase 1
export class LocalNotesService implements NotesService {
    private key = 'divnotes_notes';

    private async getAllNotes(): Promise<StoredNote[]> {
        const result = await chrome.storage.local.get([this.key]);
        return ((result[this.key] || []) as StoredNote[]).map((note) => withNoteDefaults(note));
    }

    private async setAllNotes(notes: StoredNote[]): Promise<void> {
        await chrome.storage.local.set({ [this.key]: notes });
    }

    async save(note: StoredNote): Promise<void> {
        const all = await this.getAllNotes();
        all.push(withNoteDefaults(note));
        await this.setAllNotes(all);
    }

    async update(id: string, updates: Partial<StoredNote>): Promise<void> {
        const all = await this.getAllNotes();
        const idx = all.findIndex(n => n.id === id);
        if (idx > -1) {
            all[idx] = withNoteDefaults({
                ...all[idx],
                ...updates,
                id,
                updatedAt: updates.updatedAt ?? new Date().toISOString(),
            });
            await this.setAllNotes(all);
        }
    }

    async delete(id: string): Promise<void> {
        const all = await this.getAllNotes();
        const filtered = all.filter(n => n.id !== id);
        await this.setAllNotes(filtered);
    }

    async getForPage(url: string): Promise<StoredNote[]> {
        const all = await this.getAllNotes();
        return all.filter(n => n.url === url);
    }

    async getAll(): Promise<StoredNote[]> {
        return this.getAllNotes();
    }
}

// ==================== CLOUD SERVICE ====================
// Uses Supabase with local cache fallback for offline
export class CloudNotesService implements NotesService {
    private local: LocalNotesService;
    private userId: string;
    private syncP: Promise<void> | null = null;

    constructor(userId: string) {
        this.local = new LocalNotesService();
        this.userId = userId;
        // Schedule sync queue processing shortly after initialization
        setTimeout(() => this.processSyncQueue(), 1000);
    }

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

    async processSyncQueue() {
        if (this.syncP) return this.syncP;

        this.syncP = new Promise((resolve) => {
            chrome.storage.local.get(['divnotes_sync_queue'], async (res) => {
                const cloudSyncEnabled = await isCloudSyncEnabled();
                if (!cloudSyncEnabled) {
                    this.syncP = null;
                    return resolve();
                }

                const queue: SyncQueueItem[] = res.divnotes_sync_queue || [];
                if (queue.length === 0) {
                    this.syncP = null;
                    return resolve();
                }

                // Migrate legacy items that lack entityType
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

                console.log(`[Canopy] Processing ${migratedQueue.length} offline sync operations...`);
                const failedQueue: SyncQueueItem[] = [];

                for (const item of migratedQueue) {
                    try {
                        const entityType = item.entityType || 'note';

                        if (entityType === 'note') {
                            if (item.action === 'save' && item.payload) {
                                const { error } = await supabase.from('notes').upsert(this.storedToDb(item.payload));
                                if (error) throw error;
                            } else if (item.action === 'update' && item.payload) {
                                const { error } = await supabase.from('notes')
                                    .update(item.payload)
                                    .eq('id', item.entityId)
                                    .eq('user_id', this.userId);
                                if (error) throw error;
                            } else if (item.action === 'delete') {
                                const { error } = await supabase.from('notes')
                                    .delete()
                                    .eq('id', item.entityId)
                                    .eq('user_id', this.userId);
                                if (error) throw error;
                            }
                        } else if (entityType === 'folder') {
                            if (item.action === 'save' && item.payload) {
                                const f = item.payload;
                                const { error } = await supabase.from('folders').upsert({
                                    id: f.id, user_id: this.userId, name: f.name,
                                    parent_id: f.parentId, color: f.color, pinned: f.pinned || false,
                                    order: f.order, created_at: f.createdAt, updated_at: f.updatedAt,
                                });
                                if (error) throw error;
                            } else if (item.action === 'update' && item.payload) {
                                const { error } = await supabase.from('folders')
                                    .update(item.payload)
                                    .eq('id', item.entityId)
                                    .eq('user_id', this.userId);
                                if (error) throw error;
                            } else if (item.action === 'delete') {
                                const { error } = await supabase.from('folders')
                                    .delete()
                                    .eq('id', item.entityId)
                                    .eq('user_id', this.userId);
                                if (error) throw error;
                            }
                        } else if (entityType === 'tag') {
                            if (item.action === 'save' && item.payload) {
                                const t = item.payload;
                                const { error } = await supabase.from('tags').upsert({
                                    id: t.id, user_id: this.userId, name: t.name,
                                    color: t.color, created_at: t.createdAt, updated_at: t.updatedAt,
                                });
                                if (error) throw error;
                            } else if (item.action === 'update' && item.payload) {
                                const { error } = await supabase.from('tags')
                                    .update(item.payload)
                                    .eq('id', item.entityId)
                                    .eq('user_id', this.userId);
                                if (error) throw error;
                            } else if (item.action === 'delete') {
                                const { error } = await supabase.from('tags')
                                    .delete()
                                    .eq('id', item.entityId)
                                    .eq('user_id', this.userId);
                                if (error) throw error;
                            }
                        } else if (entityType === 'note_tag') {
                            if (item.action === 'save' && item.payload) {
                                const { error } = await supabase.from('note_tags').upsert(item.payload);
                                if (error) throw error;
                            } else if (item.action === 'delete' && item.payload) {
                                const { error } = await supabase.from('note_tags')
                                    .delete()
                                    .eq('note_id', item.payload.note_id)
                                    .eq('tag_id', item.payload.tag_id);
                                if (error) throw error;
                            }
                        }
                    } catch (err) {
                        console.warn(`[Canopy] Sync operation [${item.entityType}:${item.action}] failed, keeping in queue`, err);
                        failedQueue.push(item);
                    }
                }

                await new Promise<void>(r => chrome.storage.local.set({ divnotes_sync_queue: failedQueue }, r));
                if (failedQueue.length === 0 && queue.length > 0) {
                    console.log('[Canopy] Sync queue processed successfully.');
                }
                this.syncP = null;
                resolve();
            });
        });
        return this.syncP;
    }

    private storedToDb(note: StoredNote) {
        const normalizedNote = withNoteDefaults(note);
        return {
            id: normalizedNote.id,
            user_id: this.userId,
            page_url: normalizedNote.url,
            page_title: normalizedNote.pageTitle,
            page_domain: normalizedNote.hostname,
            element_selector: normalizedNote.elementSelector,
            element_tag: normalizedNote.elementTag,
            element_info: normalizedNote.elementInfo,
            content: normalizedNote.content,
            color: normalizedNote.color || '#7c3aed',
            tag_label: normalizedNote.tagLabel || null,
            element_xpath: normalizedNote.elementXPath || null,
            element_text_hash: normalizedNote.elementTextHash || null,
            element_position: normalizedNote.elementPosition || null,
            selected_text: normalizedNote.selectedText || null,
            created_at: normalizedNote.createdAt,
            updated_at: normalizedNote.updatedAt,
            folder_id: normalizedNote.folderId || null,
            pinned: normalizedNote.pinned || false,
        };
    }

    async save(note: StoredNote): Promise<void> {
        const normalizedNote = withNoteDefaults(note);
        // Save locally first (cache)
        await this.local.save(normalizedNote);

        // Then sync to Supabase
        try {
            const { error } = await supabase.from('notes').insert({
                id: normalizedNote.id,
                user_id: this.userId,
                page_url: normalizedNote.url,
                page_title: normalizedNote.pageTitle,
                page_domain: normalizedNote.hostname,
                element_selector: normalizedNote.elementSelector,
                element_tag: normalizedNote.elementTag,
                element_info: normalizedNote.elementInfo,
                content: normalizedNote.content,
                color: normalizedNote.color || '#7c3aed',
                tag_label: normalizedNote.tagLabel || null,
                element_xpath: normalizedNote.elementXPath || null,
                element_text_hash: normalizedNote.elementTextHash || null,
                element_position: normalizedNote.elementPosition || null,
                selected_text: normalizedNote.selectedText || null,
                created_at: normalizedNote.createdAt,
                updated_at: normalizedNote.updatedAt,
                folder_id: normalizedNote.folderId || null,
                pinned: normalizedNote.pinned || false,
            });
            if (error) throw error;
            // Optionally flush queue if we just succeeded online
            this.processSyncQueue();
        } catch (err) {
            console.warn('[Canopy] Offline — queuing save for later');
            await this.queueOperation('save', normalizedNote.id, normalizedNote);
        }
    }

    async update(id: string, updates: Partial<StoredNote>): Promise<void> {
        const nextUpdatedAt = updates.updatedAt ?? new Date().toISOString();
        // Update locally first
        await this.local.update(id, { ...updates, updatedAt: nextUpdatedAt });

        const dbUpdates: Record<string, unknown> = {};
        if (updates.content !== undefined) dbUpdates.content = updates.content;
        if (updates.elementSelector !== undefined) dbUpdates.element_selector = updates.elementSelector;
        if (updates.elementInfo !== undefined) dbUpdates.element_info = updates.elementInfo;
        if (updates.color !== undefined) dbUpdates.color = updates.color;
        if (updates.tagLabel !== undefined) dbUpdates.tag_label = updates.tagLabel;
        if (updates.elementXPath !== undefined) dbUpdates.element_xpath = updates.elementXPath;
        if (updates.elementTextHash !== undefined) dbUpdates.element_text_hash = updates.elementTextHash;
        if (updates.elementPosition !== undefined) dbUpdates.element_position = updates.elementPosition;
        if (updates.selectedText !== undefined) dbUpdates.selected_text = updates.selectedText;
        if (updates.folderId !== undefined) dbUpdates.folder_id = updates.folderId;
        if (updates.pinned !== undefined) dbUpdates.pinned = updates.pinned;
        dbUpdates.updated_at = nextUpdatedAt;

        // Then sync to Supabase
        try {
            const { error } = await supabase
                .from('notes')
                .update(dbUpdates)
                .eq('id', id)
                .eq('user_id', this.userId);
            if (error) throw error;
            this.processSyncQueue();
        } catch (err) {
            console.warn('[Canopy] Offline — queuing update for later');
            // We just queue the dbUpdates payload
            await this.queueOperation('update', id, dbUpdates);
        }
    }

    async delete(id: string): Promise<void> {
        // Delete locally first
        await this.local.delete(id);

        try {
            const { error } = await supabase
                .from('notes')
                .delete()
                .eq('id', id)
                .eq('user_id', this.userId);
            if (error) throw error;
            this.processSyncQueue();
        } catch (err) {
            console.warn('[Canopy] Offline — queuing delete for later');
            await this.queueOperation('delete', id);
        }
    }

    async getForPage(url: string): Promise<StoredNote[]> {
        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*, note_tags(tag_id)')
                .eq('user_id', this.userId)
                .eq('page_url', url);

            if (error) throw error;
            if (data) {
                const notes = data.map(row => this.dbToStored(row));
                // Update local cache
                const allLocal = await this.local.getAll();
                const otherPages = allLocal.filter(n => n.url !== url);
                const merged = [...otherPages, ...notes];
                await chrome.storage.local.set({ divnotes_notes: merged });
                return notes;
            }
        } catch {
            console.warn('[Canopy] Offline — using local cache');
        }
        return this.local.getForPage(url);
    }

    async getAll(): Promise<StoredNote[]> {
        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*, note_tags(tag_id)')
                .eq('user_id', this.userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                const notes = data.map(row => this.dbToStored(row));
                // Update full local cache
                await chrome.storage.local.set({ divnotes_notes: notes });
                return notes;
            }
        } catch {
            console.warn('[Canopy] Offline — using local cache');
        }
        return this.local.getAll();
    }

    private dbToStored(row: Record<string, unknown>): StoredNote {
        const noteTagRows = (row.note_tags as Array<{ tag_id: string }>) || [];
        return {
            id: row.id as string,
            url: row.page_url as string,
            hostname: row.page_domain as string,
            pageTitle: (row.page_title as string) || '',
            elementSelector: row.element_selector as string,
            elementTag: row.element_tag as string,
            elementInfo: (row.element_info as string) || '',
            content: row.content as string,
            color: (row.color as string) || '#7c3aed',
            tagLabel: (row.tag_label as string) || undefined,
            elementXPath: (row.element_xpath as string) || undefined,
            elementTextHash: (row.element_text_hash as string) || undefined,
            elementPosition: (row.element_position as string) || undefined,
            selectedText: (row.selected_text as string) || undefined,
            createdAt: row.created_at as string,
            updatedAt: (row.updated_at as string) || (row.created_at as string),
            folderId: (row.folder_id as string) || null,
            tags: noteTagRows.map(nt => nt.tag_id),
            pinned: (row.pinned as boolean) || false,
        };
    }
}

// ==================== FACTORY ====================
let _service: NotesService | null = null;

export async function getNotesService(): Promise<NotesService> {
    if (_service) return _service;

    // Check auth mode
    const cloudSyncEnabled = await isCloudSyncEnabled();

    if (cloudSyncEnabled) {
        // Get Supabase user ID
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            _service = new CloudNotesService(session.user.id);
            return _service;
        }
    }

    // Default to local
    _service = new LocalNotesService();
    return _service;
}

// Reset service (call on login/logout)
export function resetNotesService() {
    _service = null;
}
