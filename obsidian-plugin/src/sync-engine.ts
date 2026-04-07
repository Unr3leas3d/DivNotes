import {
  type EventRef,
  TFile,
  TFolder,
  Vault,
  normalizePath
} from "obsidian";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  Session,
  SupabaseClient
} from "@supabase/supabase-js";
import type CanopyPlugin from "./main";
import type { NoteFrontmatter, SupabaseFolderRow, SupabaseNoteRow } from "./types";
import { BacklinkManager } from "./backlinks";
import {
  noteFilePath,
  noteToMarkdown,
  parseMarkdownNote,
  stripManagedRelatedSection
} from "./file-mapper";
import { OfflineQueue } from "./offline-queue";

const FILE_WATCH_DEBOUNCE_MS = 2000;

export class SyncEngine {
  private plugin: CanopyPlugin;
  private supabase: SupabaseClient;
  private userId: string;
  private vault: Vault;
  private backlinks: BacklinkManager;
  private offlineQueue: OfflineQueue;
  private channel: RealtimeChannel | null = null;
  private fileWatchRef: EventRef | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private folders: SupabaseFolderRow[] = [];
  private allNotes: SupabaseNoteRow[] = [];
  private writingFiles = new Set<string>();

  constructor(plugin: CanopyPlugin, supabase: SupabaseClient, userId: string) {
    this.plugin = plugin;
    this.supabase = supabase;
    this.userId = userId;
    this.vault = plugin.app.vault;
    this.backlinks = new BacklinkManager(this.vault, plugin.settings.vaultFolder);
    this.offlineQueue = new OfflineQueue(plugin, supabase, userId);
  }

  async start(): Promise<void> {
    await this.offlineQueue.load();
    await this.initialSync();
    this.subscribeRealtime();
    this.watchFileChanges();
  }

  async stop(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    if (this.fileWatchRef) {
      this.vault.offref(this.fileWatchRef);
      this.fileWatchRef = null;
    }

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private async initialSync(): Promise<void> {
    this.plugin.settings.syncStatus = "syncing";
    await this.plugin.saveSettings();

    try {
      const { data: folderData, error: folderError } = await this.supabase
        .from("folders")
        .select("*")
        .eq("user_id", this.userId);

      if (folderError) {
        throw folderError;
      }
      this.folders = (folderData ?? []) as SupabaseFolderRow[];

      const { data: noteData, error: noteError } = await this.supabase
        .from("notes")
        .select("*, note_tags(tag_id)")
        .eq("user_id", this.userId)
        .order("created_at", { ascending: false });

      if (noteError) {
        throw noteError;
      }
      this.allNotes = (noteData ?? []) as SupabaseNoteRow[];

      const localFiles = await this.getCanopyFiles();
      const localById = new Map<string, { file: TFile; frontmatter: NoteFrontmatter }>();
      for (const entry of localFiles) {
        if (entry.frontmatter?.canopy_id) {
          localById.set(entry.frontmatter.canopy_id, {
            file: entry.file,
            frontmatter: entry.frontmatter
          });
        }
      }

      const remoteIds = new Set<string>();
      for (const note of this.allNotes) {
        remoteIds.add(note.id);
        const local = localById.get(note.id);

        if (!local) {
          await this.writeNoteFile(note);
          continue;
        }

        const remoteUpdated = new Date(note.updated_at || note.created_at).getTime();
        const localUpdated = new Date(local.frontmatter.updated_at).getTime();

        if (remoteUpdated > localUpdated) {
          await this.writeNoteFile(note);
          continue;
        }

        if (localUpdated > remoteUpdated) {
          const markdown = await this.vault.read(local.file);
          const parsed = parseMarkdownNote(markdown);
          const pushed = await this.pushContentToSupabase(note.id, stripManagedRelatedSection(parsed.content), local.frontmatter.updated_at);
          if (pushed) {
            note.content = stripManagedRelatedSection(parsed.content);
            note.updated_at = local.frontmatter.updated_at;
          }
        }
      }

      for (const entry of localFiles) {
        if (entry.frontmatter?.canopy_id && !remoteIds.has(entry.frontmatter.canopy_id)) {
          await this.vault.delete(entry.file);
        }
      }

      await this.backlinks.rebuild(this.allNotes);
      await this.offlineQueue.drain();

      this.plugin.settings.syncStatus = "connected";
      this.plugin.settings.lastSyncedAt = new Date().toISOString();
      await this.plugin.saveSettings();
    } catch (error) {
      console.error("[Canopy] Initial sync failed:", error);
      this.plugin.settings.syncStatus = "offline";
      await this.plugin.saveSettings();
    }
  }

  private subscribeRealtime(): void {
    this.channel = this.supabase
      .channel("canopy-notes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${this.userId}`
        },
        async (payload) => {
          try {
            await this.handleRealtimeEvent(
              payload as RealtimePostgresChangesPayload<Record<string, unknown>>
            );
            await this.offlineQueue.drain();
          } catch (error) {
            console.error("[Canopy] Realtime handler error:", error);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.plugin.settings.syncStatus = "connected";
          void this.plugin.saveSettings();
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.plugin.settings.syncStatus = "offline";
          void this.plugin.saveSettings();
        }
      });
  }

  private async handleRealtimeEvent(
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>
  ): Promise<void> {
    if (payload.eventType === "INSERT") {
      const note = await this.withNoteTags(payload.new as unknown as SupabaseNoteRow);
      await this.writeNoteFile(note);
      this.allNotes.push(note);
      await this.backlinks.rebuild(this.allNotes);
    }

    if (payload.eventType === "UPDATE") {
      const note = await this.withNoteTags(payload.new as unknown as SupabaseNoteRow);
      const localFile = await this.findFileByCanopyId(note.id);
      if (localFile) {
        const localContent = await this.vault.read(localFile);
        const localFrontmatter = parseMarkdownNote(localContent).frontmatter;
        if (localFrontmatter) {
          const localUpdated = new Date(localFrontmatter.updated_at).getTime();
          const remoteUpdated = new Date(note.updated_at || note.created_at).getTime();
          if (remoteUpdated <= localUpdated) {
            return;
          }
        }
      }

      await this.writeNoteFile(note);
      this.allNotes = this.allNotes.map((existing) => (existing.id === note.id ? note : existing));
      await this.backlinks.rebuild(this.allNotes);
    }

    if (payload.eventType === "DELETE") {
      const oldNote = payload.old as { id?: string };
      if (!oldNote.id) {
        return;
      }

      const file = await this.findFileByCanopyId(oldNote.id);
      if (file) {
        await this.vault.delete(file);
      }
      this.allNotes = this.allNotes.filter((note) => note.id !== oldNote.id);
      await this.backlinks.rebuild(this.allNotes);
    }

    this.plugin.settings.lastSyncedAt = new Date().toISOString();
    await this.plugin.saveSettings();
  }

  private watchFileChanges(): void {
    this.fileWatchRef = this.vault.on("modify", (file) => {
      if (!(file instanceof TFile)) {
        return;
      }
      if (!file.path.startsWith(`${this.plugin.settings.vaultFolder}/`)) {
        return;
      }
      if (file.path.includes("/Sites/")) {
        return;
      }
      if (this.writingFiles.has(file.path)) {
        return;
      }

      const existingTimer = this.debounceTimers.get(file.path);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      this.debounceTimers.set(
        file.path,
        setTimeout(() => {
          this.debounceTimers.delete(file.path);
          void this.handleFileModified(file);
        }, FILE_WATCH_DEBOUNCE_MS)
      );
    });
  }

  private async handleFileModified(file: TFile): Promise<void> {
    try {
      const parsed = parseMarkdownNote(await this.vault.read(file));
      if (!parsed.frontmatter?.canopy_id) {
        return;
      }

      const currentNote = this.allNotes.find((note) => note.id === parsed.frontmatter?.canopy_id);
      if (!currentNote) {
        return;
      }

      const localBody = stripManagedRelatedSection(parsed.content);
      if (localBody === currentNote.content) {
        return;
      }

      const updatedAt = new Date().toISOString();
      const success = await this.pushContentToSupabase(
        parsed.frontmatter.canopy_id,
        localBody,
        updatedAt
      );

      if (!success) {
        return;
      }

      currentNote.content = localBody;
      currentNote.updated_at = updatedAt;

      this.writingFiles.add(file.path);
      try {
        const rewritten = (await this.vault.read(file)).replace(
          /updated_at: "[^"]*"/,
          `updated_at: "${updatedAt}"`
        );
        await this.vault.modify(file, rewritten);
      } finally {
        this.writingFiles.delete(file.path);
      }
    } catch (error) {
      console.error("[Canopy] File watch handler error:", error);
    }
  }

  private async pushContentToSupabase(
    canopyId: string,
    content: string,
    updatedAt: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("notes")
        .update({
          content,
          updated_at: updatedAt
        })
        .eq("id", canopyId)
        .eq("user_id", this.userId);

      if (error) {
        throw error;
      }

      return true;
    } catch {
      await this.offlineQueue.enqueue({
        canopyId,
        content,
        updatedAt
      });
      this.plugin.settings.syncStatus = "offline";
      await this.plugin.saveSettings();
      return false;
    }
  }

  private async writeNoteFile(note: SupabaseNoteRow): Promise<void> {
    const targetPath = normalizePath(
      noteFilePath(
        note,
        this.plugin.settings.vaultFolder,
        this.plugin.settings.folderMode,
        this.folders
      )
    );

    await this.ensureFolderExists(targetPath.slice(0, targetPath.lastIndexOf("/")));
    const markdown = noteToMarkdown(note, this.plugin.settings.folderMode, this.folders);
    const existingFile = await this.findFileByCanopyId(note.id);

    this.writingFiles.add(targetPath);
    try {
      if (existingFile && existingFile.path !== targetPath) {
        await this.vault.delete(existingFile);
        await this.vault.create(targetPath, markdown);
        return;
      }

      if (existingFile) {
        await this.vault.modify(existingFile, markdown);
        return;
      }

      await this.vault.create(targetPath, markdown);
    } finally {
      this.writingFiles.delete(targetPath);
    }
  }

  private async findFileByCanopyId(canopyId: string): Promise<TFile | null> {
    const files = await this.getCanopyFiles();
    for (const entry of files) {
      if (entry.frontmatter?.canopy_id === canopyId) {
        return entry.file;
      }
    }
    return null;
  }

  private async getCanopyFiles(): Promise<Array<{ file: TFile; frontmatter: NoteFrontmatter | null }>> {
    const rootFolder = this.vault.getAbstractFileByPath(this.plugin.settings.vaultFolder);
    if (!(rootFolder instanceof TFolder)) {
      return [];
    }

    const files: TFile[] = [];
    const visit = (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFolder) {
          visit(child);
          continue;
        }

        if (child instanceof TFile && child.extension === "md" && !child.path.includes("/Sites/")) {
          files.push(child);
        }
      }
    };
    visit(rootFolder);

    const results: Array<{ file: TFile; frontmatter: NoteFrontmatter | null }> = [];
    for (const file of files) {
      results.push({
        file,
        frontmatter: parseMarkdownNote(await this.vault.read(file)).frontmatter
      });
    }
    return results;
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (!normalized) {
      return;
    }

    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.vault.getAbstractFileByPath(current)) {
        await this.vault.createFolder(current);
      }
    }
  }

  private async withNoteTags(note: SupabaseNoteRow): Promise<SupabaseNoteRow> {
    const { data } = await this.supabase.from("note_tags").select("tag_id").eq("note_id", note.id);
    return {
      ...note,
      note_tags: (data ?? []) as Array<{ tag_id: string }>
    };
  }
}
