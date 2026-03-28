import type { MutableRefObject } from 'react';

import { resetFoldersService } from './folders-service';
import { resetNotesService } from './notes-service';
import { resetTagsService } from './tags-service';
import { supabase } from './supabase';
import {
  getCurrentTab,
  mergeImportedWorkspaceData,
  readExtensionWorkspaceStorage,
} from './extension-workspace-helpers';
import type { AuthMode, WorkspaceAuth, WorkspaceData } from './extension-workspace-types';

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
        await chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
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
