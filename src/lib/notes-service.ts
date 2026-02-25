import { supabase } from './supabase';

export interface SyncQueueItem {
    id: string;
    action: 'save' | 'update' | 'delete';
    noteId: string;
    payload?: any;
    timestamp: number;
}

// Shared note type used by storage and UI
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
        return result[this.key] || [];
    }

    private async setAllNotes(notes: StoredNote[]): Promise<void> {
        await chrome.storage.local.set({ [this.key]: notes });
    }

    async save(note: StoredNote): Promise<void> {
        const all = await this.getAllNotes();
        all.push(note);
        await this.setAllNotes(all);
    }

    async update(id: string, updates: Partial<StoredNote>): Promise<void> {
        const all = await this.getAllNotes();
        const idx = all.findIndex(n => n.id === id);
        if (idx > -1) {
            all[idx] = { ...all[idx], ...updates };
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

    private async queueOperation(action: 'save' | 'update' | 'delete', noteId: string, payload?: any) {
        return new Promise<void>((resolve) => {
            chrome.storage.local.get(['divnotes_sync_queue'], (res) => {
                const queue: SyncQueueItem[] = res.divnotes_sync_queue || [];
                queue.push({
                    id: crypto.randomUUID(),
                    action,
                    noteId,
                    payload,
                    timestamp: Date.now()
                });
                chrome.storage.local.set({ divnotes_sync_queue: queue }, resolve);
            });
        });
    }

    async processSyncQueue() {
        if (this.syncP) return this.syncP;

        this.syncP = new Promise((resolve) => {
            chrome.storage.local.get(['divnotes_sync_queue'], async (res) => {
                const queue: SyncQueueItem[] = res.divnotes_sync_queue || [];
                if (queue.length === 0) {
                    this.syncP = null;
                    return resolve();
                }

                console.log(`[DivNotes] Processing ${queue.length} offline sync operations...`);
                const failedQueue: SyncQueueItem[] = [];

                for (const item of queue) {
                    try {
                        if (item.action === 'save' && item.payload) {
                            const { error } = await supabase.from('notes').upsert(this.storedToDb(item.payload));
                            if (error) throw error;
                        } else if (item.action === 'update' && item.payload) {
                            const { error } = await supabase.from('notes')
                                .update(item.payload)
                                .eq('id', item.noteId)
                                .eq('user_id', this.userId);
                            if (error) throw error;
                        } else if (item.action === 'delete') {
                            const { error } = await supabase.from('notes')
                                .delete()
                                .eq('id', item.noteId)
                                .eq('user_id', this.userId);
                            if (error) throw error;
                        }
                    } catch (err) {
                        console.warn(`[DivNotes] Sync operation [${item.action}] failed, keeping in queue`, err);
                        failedQueue.push(item);
                    }
                }

                await new Promise<void>(r => chrome.storage.local.set({ divnotes_sync_queue: failedQueue }, r));
                if (failedQueue.length === 0 && queue.length > 0) {
                    console.log('[DivNotes] Sync queue processed successfully.');
                }
                this.syncP = null;
                resolve();
            });
        });
        return this.syncP;
    }

    private storedToDb(note: StoredNote) {
        return {
            id: note.id,
            user_id: this.userId,
            page_url: note.url,
            page_title: note.pageTitle,
            page_domain: note.hostname,
            element_selector: note.elementSelector,
            element_tag: note.elementTag,
            element_info: note.elementInfo,
            content: note.content,
            color: note.color || '#7c3aed',
            tag_label: note.tagLabel || null,
            element_xpath: note.elementXPath || null,
            element_text_hash: note.elementTextHash || null,
            element_position: note.elementPosition || null,
            selected_text: note.selectedText || null,
            created_at: note.createdAt,
        };
    }

    async save(note: StoredNote): Promise<void> {
        // Save locally first (cache)
        await this.local.save(note);

        // Then sync to Supabase
        try {
            const { error } = await supabase.from('notes').insert({
                id: note.id,
                user_id: this.userId,
                page_url: note.url,
                page_title: note.pageTitle,
                page_domain: note.hostname,
                element_selector: note.elementSelector,
                element_tag: note.elementTag,
                element_info: note.elementInfo,
                content: note.content,
                color: note.color || '#7c3aed',
                tag_label: note.tagLabel || null,
                element_xpath: note.elementXPath || null,
                element_text_hash: note.elementTextHash || null,
                element_position: note.elementPosition || null,
                selected_text: note.selectedText || null,
                created_at: note.createdAt,
            });
            if (error) throw error;
            // Optionally flush queue if we just succeeded online
            this.processSyncQueue();
        } catch (err) {
            console.warn('[DivNotes] Offline — queuing save for later');
            await this.queueOperation('save', note.id, note);
        }
    }

    async update(id: string, updates: Partial<StoredNote>): Promise<void> {
        // Update locally first
        await this.local.update(id, updates);

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
        dbUpdates.updated_at = new Date().toISOString();

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
            console.warn('[DivNotes] Offline — queuing update for later');
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
            console.warn('[DivNotes] Offline — queuing delete for later');
            await this.queueOperation('delete', id);
        }
    }

    async getForPage(url: string): Promise<StoredNote[]> {
        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('user_id', this.userId)
                .eq('page_url', url);

            if (error) throw error;
            if (data) {
                const notes = data.map(this.dbToStored);
                // Update local cache
                const allLocal = await this.local.getAll();
                const otherPages = allLocal.filter(n => n.url !== url);
                const merged = [...otherPages, ...notes];
                await chrome.storage.local.set({ divnotes_notes: merged });
                return notes;
            }
        } catch {
            console.warn('[DivNotes] Offline — using local cache');
        }
        return this.local.getForPage(url);
    }

    async getAll(): Promise<StoredNote[]> {
        try {
            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('user_id', this.userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                const notes = data.map(this.dbToStored);
                // Update full local cache
                await chrome.storage.local.set({ divnotes_notes: notes });
                return notes;
            }
        } catch {
            console.warn('[DivNotes] Offline — using local cache');
        }
        return this.local.getAll();
    }

    private dbToStored(row: Record<string, unknown>): StoredNote {
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
        };
    }
}

// ==================== FACTORY ====================
let _service: NotesService | null = null;

export async function getNotesService(): Promise<NotesService> {
    if (_service) return _service;

    // Check auth mode
    const result = await chrome.storage.local.get(['divnotes_auth']);

    const auth = result.divnotes_auth as { mode: string; email?: string } | undefined;

    if (auth?.mode === 'authenticated') {
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
