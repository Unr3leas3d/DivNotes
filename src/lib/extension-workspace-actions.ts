import type { MutableRefObject } from 'react';

import { resetFoldersService } from './folders-service';
import { type SyncQueueItem } from './types';
import { resetNotesService } from './notes-service';
import { resetTagsService } from './tags-service';
import { supabase } from './supabase';
import {
  getCurrentTab,
  mergeImportedWorkspaceData,
  readExtensionWorkspaceStorage,
} from './extension-workspace-helpers';
import type { AuthMode, WorkspaceAuth, WorkspaceData } from './extension-workspace-types';
import type { StoredFolder, StoredNote, StoredTag } from './types';

function normalizeImportedItems<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function noteToDbRow(note: StoredNote, userId: string) {
  return {
    id: note.id,
    user_id: userId,
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
    folder_id: note.folderId || null,
    pinned: note.pinned || false,
  };
}

function folderToDbRow(folder: StoredFolder, userId: string) {
  return {
    id: folder.id,
    user_id: userId,
    name: folder.name,
    parent_id: folder.parentId,
    color: folder.color,
    pinned: folder.pinned || false,
    order: folder.order,
    created_at: folder.createdAt,
    updated_at: folder.updatedAt,
  };
}

function tagToDbRow(tag: StoredTag, userId: string) {
  return {
    id: tag.id,
    user_id: userId,
    name: tag.name,
    color: tag.color,
    created_at: tag.createdAt,
    updated_at: tag.updatedAt,
  };
}

function buildImportedNoteTagOperations(
  existing: WorkspaceData,
  merged: WorkspaceData,
  importedNotes: StoredNote[]
): Array<Pick<SyncQueueItem, 'action' | 'entityId' | 'entityType' | 'payload'>> {
  const existingNotesById = new Map(existing.notes.map((note) => [note.id, note]));
  const mergedNotesById = new Map(merged.notes.map((note) => [note.id, note]));
  const operations: Array<Pick<SyncQueueItem, 'action' | 'entityId' | 'entityType' | 'payload'>> = [];

  for (const importedNote of importedNotes) {
    const previousTagIds = new Set(existingNotesById.get(importedNote.id)?.tags || []);
    const nextTagIds = new Set(mergedNotesById.get(importedNote.id)?.tags || []);

    for (const tagId of nextTagIds) {
      if (!previousTagIds.has(tagId)) {
        operations.push({
          entityType: 'note_tag',
          action: 'save',
          entityId: `${importedNote.id}:${tagId}`,
          payload: { note_id: importedNote.id, tag_id: tagId },
        });
      }
    }

    for (const tagId of previousTagIds) {
      if (!nextTagIds.has(tagId)) {
        operations.push({
          entityType: 'note_tag',
          action: 'delete',
          entityId: `${importedNote.id}:${tagId}`,
          payload: { note_id: importedNote.id, tag_id: tagId },
        });
      }
    }
  }

  return operations;
}

async function enqueueSyncOperations(
  operations: Array<Pick<SyncQueueItem, 'action' | 'entityId' | 'entityType' | 'payload'>>
) {
  if (operations.length === 0) {
    return;
  }

  const result = await chrome.storage.local.get(['divnotes_sync_queue']);
  const existingQueue = (result.divnotes_sync_queue || []) as SyncQueueItem[];
  const queuedOperations: SyncQueueItem[] = operations.map((operation) => ({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...operation,
  }));

  await chrome.storage.local.set({
    divnotes_sync_queue: [...existingQueue, ...queuedOperations],
  });
}

async function persistImportedWorkspaceData(
  existing: WorkspaceData,
  merged: WorkspaceData,
  parsed: { notes?: unknown; folders?: unknown; tags?: unknown }
) {
  const importedNotes = normalizeImportedItems<StoredNote>(parsed.notes);
  const importedFolders = normalizeImportedItems<StoredFolder>(parsed.folders);
  const importedTags = normalizeImportedItems<StoredTag>(parsed.tags);
  const noteTagOperations = buildImportedNoteTagOperations(existing, merged, importedNotes);
  const queuedImportOperations = [
    ...importedFolders.map((folder) => ({
      entityType: 'folder' as const,
      action: 'save' as const,
      entityId: folder.id,
      payload: folder,
    })),
    ...importedTags.map((tag) => ({
      entityType: 'tag' as const,
      action: 'save' as const,
      entityId: tag.id,
      payload: tag,
    })),
    ...importedNotes.map((note) => ({
      entityType: 'note' as const,
      action: 'save' as const,
      entityId: note.id,
      payload: note,
    })),
    ...noteTagOperations,
  ];

  if (importedNotes.length === 0 && importedFolders.length === 0 && importedTags.length === 0) {
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    await enqueueSyncOperations(queuedImportOperations);
    return;
  }

  try {
    if (importedFolders.length > 0) {
      const { error } = await supabase
        .from('folders')
        .upsert(importedFolders.map((folder) => folderToDbRow(folder, session.user.id)));
      if (error) {
        throw error;
      }
    }

    if (importedTags.length > 0) {
      const { error } = await supabase
        .from('tags')
        .upsert(importedTags.map((tag) => tagToDbRow(tag, session.user.id)));
      if (error) {
        throw error;
      }
    }

    if (importedNotes.length > 0) {
      const { error } = await supabase
        .from('notes')
        .upsert(importedNotes.map((note) => noteToDbRow(note, session.user.id)));
      if (error) {
        throw error;
      }
    }

    const addedNoteTags = noteTagOperations.filter((operation) => operation.action === 'save');
    if (addedNoteTags.length > 0) {
      const { error } = await supabase
        .from('note_tags')
        .upsert(addedNoteTags.map((operation) => operation.payload));
      if (error) {
        throw error;
      }
    }

    const removedNoteTags = noteTagOperations.filter((operation) => operation.action === 'delete');
    if (removedNoteTags.length > 0) {
      await Promise.all(
        removedNoteTags.map(async (operation) => {
          const { error } = await supabase
            .from('note_tags')
            .delete()
            .eq('note_id', operation.payload.note_id)
            .eq('tag_id', operation.payload.tag_id);
          if (error) {
            throw error;
          }
        })
      );
    }
  } catch {
    await enqueueSyncOperations(queuedImportOperations);
  }
}

interface CreateExtensionWorkspaceActionsInput {
  authModeRef: MutableRefObject<AuthMode>;
  dataRef: MutableRefObject<WorkspaceData>;
  clearActionError: () => void;
  setActionError: (message: string) => void;
  setAuth: (auth: WorkspaceAuth) => void;
  setSelectedFolderId: (folderId: string | null) => void;
  setSelectedTagId: (tagId: string | null) => void;
}

export function createExtensionWorkspaceActions(
  input: CreateExtensionWorkspaceActionsInput
) {
  const {
    authModeRef,
    dataRef,
    clearActionError,
    setActionError,
    setAuth,
    setSelectedFolderId,
    setSelectedTagId,
  } = input;

  return {
    activateInspector: async () => {
      clearActionError();
      try {
        await chrome.runtime.sendMessage({ type: 'ACTIVATE_INSPECTOR' });
      } catch (caughtError) {
        setActionError(
          caughtError instanceof Error ? caughtError.message : 'Failed to activate inspector'
        );
        throw caughtError;
      }
    },
    openSidePanel: async () => {
      clearActionError();
      try {
        const tab = await getCurrentTab();
        await chrome.runtime.sendMessage({
          type: 'OPEN_SIDE_PANEL',
          windowId: tab?.windowId,
        });
      } catch (caughtError) {
        setActionError(
          caughtError instanceof Error ? caughtError.message : 'Failed to open side panel'
        );
        throw caughtError;
      }
    },
    openPopup: async () => {
      clearActionError();
      try {
        const response = await chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
        if (!response?.success) {
          const message =
            typeof response?.error === 'string' && response.error.length > 0
              ? response.error
              : 'Failed to open popup';
          setActionError(message);
          throw new Error(message);
        }
      } catch (caughtError) {
        setActionError(caughtError instanceof Error ? caughtError.message : 'Failed to open popup');
        throw caughtError;
      }
    },
    exportNotes: async () => {
      clearActionError();
      try {
        const data = dataRef.current;
        const payload = {
          version: 2,
          exportedAt: new Date().toISOString(),
          notes: data.notes,
          folders: data.folders,
          tags: data.tags,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `canopy-export-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (caughtError) {
        setActionError(caughtError instanceof Error ? caughtError.message : 'Failed to export notes');
        throw caughtError;
      }
    },
    importNotes: async () => {
      clearActionError();

      return new Promise<void>((resolve, reject) => {
        try {
          const inputElement = document.createElement('input');
          inputElement.type = 'file';
          inputElement.accept = '.json,application/json';
          inputElement.onchange = () => {
            const file = inputElement.files?.[0];
            if (!file) {
              resolve();
              return;
            }

            const reader = new FileReader();
            reader.onload = async () => {
              try {
                const parsed = JSON.parse(String(reader.result || '{}'));
                const existing = await readExtensionWorkspaceStorage();
                const merged = mergeImportedWorkspaceData(existing, parsed);

                if (authModeRef.current === 'authenticated') {
                  await persistImportedWorkspaceData(existing, merged, parsed);
                }

                await chrome.storage.local.set({
                  divnotes_notes: merged.notes,
                  divnotes_folders: merged.folders,
                  divnotes_tags: merged.tags,
                });
                resolve();
              } catch (caughtError) {
                setActionError(
                  caughtError instanceof Error ? caughtError.message : 'Failed to import notes'
                );
                reject(caughtError);
              }
            };
            reader.onerror = () => {
              const fileError = reader.error || new Error('Failed to read import file');
              setActionError(fileError.message);
              reject(fileError);
            };
            reader.readAsText(file);
          };
          inputElement.click();
        } catch (caughtError) {
          setActionError(caughtError instanceof Error ? caughtError.message : 'Failed to import notes');
          reject(caughtError);
        }
      });
    },
    clearAllNotes: async () => {
      clearActionError();
      try {
        await chrome.storage.local.set({ divnotes_notes: [] });
      } catch (caughtError) {
        setActionError(
          caughtError instanceof Error ? caughtError.message : 'Failed to clear all notes'
        );
        throw caughtError;
      }
    },
    logout: async () => {
      clearActionError();

      try {
        if (authModeRef.current === 'authenticated') {
          await supabase.auth.signOut();
        }
        await chrome.storage.local.remove('divnotes_auth');
        resetNotesService();
        resetFoldersService();
        resetTagsService();
        setAuth({
          mode: 'login',
          email: '',
          label: '',
          isLocalMode: false,
          isAuthenticated: false,
        });
      } catch (caughtError) {
        setActionError(caughtError instanceof Error ? caughtError.message : 'Failed to logout');
        throw caughtError;
      }
    },
    setFolderDetail: setSelectedFolderId,
    setTagFilter: setSelectedTagId,
    clearFilters: () => {
      setSelectedFolderId(null);
      setSelectedTagId(null);
    },
  };
}
