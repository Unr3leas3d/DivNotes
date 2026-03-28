import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getFoldersService, resetFoldersService } from './folders-service';
import { getNotesService, resetNotesService } from './notes-service';
import { getTagsService, resetTagsService } from './tags-service';
import { supabase } from './supabase';
import type { StoredFolder, StoredNote, StoredTag } from './types';
import {
  buildFolderSummaries,
  buildTagSummaries,
  buildViewCounts,
  groupNotesByHostname,
  selectThisPageNotes,
} from './extension-selectors';

export type WorkspaceView = 'this-page' | 'all-notes' | 'folders' | 'tags' | 'settings';

type ShellType = 'popup' | 'sidepanel';
type AuthMode = 'loading' | 'login' | 'local' | 'authenticated';

interface WorkspaceAuth {
  mode: AuthMode;
  email: string;
  label: string;
  isLocalMode: boolean;
  isAuthenticated: boolean;
}

interface CurrentPageState {
  url: string | null;
  title: string;
  hostname: string | null;
}

interface WorkspaceData {
  notes: StoredNote[];
  folders: StoredFolder[];
  tags: StoredTag[];
}

interface WorkspaceDerived {
  thisPageNotes: StoredNote[];
  groupedNotes: ReturnType<typeof groupNotesByHostname>;
  folderSummaries: ReturnType<typeof buildFolderSummaries>;
  tagSummaries: ReturnType<typeof buildTagSummaries>;
}

interface LoadingState {
  auth: boolean;
  currentPage: boolean;
  data: boolean;
}

interface ErrorState {
  auth: string | null;
  currentPage: string | null;
  data: string | null;
  actions: string | null;
}

interface ViewState {
  active: WorkspaceView;
  folderId: string | null;
  tagId: string | null;
}

async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

function getHostname(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function readLocalStorage(): Promise<WorkspaceData> {
  return chrome.storage.local
    .get(['divnotes_notes', 'divnotes_folders', 'divnotes_tags'])
    .then((result) => ({
      notes: result.divnotes_notes || [],
      folders: result.divnotes_folders || [],
      tags: result.divnotes_tags || [],
    }));
}

function normalizeImportArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return [...map.values()];
}

export function useExtensionWorkspace(options: { shell: ShellType }) {
  const [auth, setAuth] = useState<WorkspaceAuth>({
    mode: 'loading',
    email: '',
    label: '',
    isLocalMode: false,
    isAuthenticated: false,
  });
  const [currentPage, setCurrentPage] = useState<CurrentPageState>({
    url: null,
    title: '',
    hostname: null,
  });
  const [data, setData] = useState<WorkspaceData>({
    notes: [],
    folders: [],
    tags: [],
  });
  const [loading, setLoading] = useState<LoadingState>({
    auth: true,
    currentPage: true,
    data: true,
  });
  const [error, setError] = useState<ErrorState>({
    auth: null,
    currentPage: null,
    data: null,
    actions: null,
  });
  const [activeView, setActiveView] = useState<WorkspaceView>(
    options.shell === 'popup' ? 'this-page' : 'all-notes'
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const authModeRef = useRef<AuthMode>('loading');

  const clearActionError = useCallback(() => {
    setError((current) => ({ ...current, actions: null }));
  }, []);

  const setActionError = useCallback((message: string) => {
    setError((current) => ({ ...current, actions: message }));
  }, []);

  useEffect(() => {
    authModeRef.current = auth.mode;
  }, [auth.mode]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      setLoading((current) => ({ ...current, auth: true }));
      setError((current) => ({ ...current, auth: null }));

      try {
        const result = await chrome.storage.local.get(['divnotes_auth']);
        if (cancelled) {
          return;
        }

        if (result.divnotes_auth?.mode === 'local') {
          setAuth({
            mode: 'local',
            email: '',
            label: 'Local Mode',
            isLocalMode: true,
            isAuthenticated: true,
          });
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (session?.user) {
          const email = session.user.email || '';
          setAuth({
            mode: 'authenticated',
            email,
            label: email,
            isLocalMode: false,
            isAuthenticated: true,
          });
          await chrome.storage.local.set({
            divnotes_auth: { mode: 'authenticated', email },
          });
        } else {
          setAuth({
            mode: 'login',
            email: '',
            label: '',
            isLocalMode: false,
            isAuthenticated: false,
          });
        }
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setAuth({
          mode: 'login',
          email: '',
          label: '',
          isLocalMode: false,
          isAuthenticated: false,
        });
        setError((current) => ({
          ...current,
          auth:
            caughtError instanceof Error ? caughtError.message : 'Failed to determine auth state',
        }));
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, auth: false }));
        }
      }
    }

    void hydrateAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) {
        return;
      }

      if (session?.user) {
        const email = session.user.email || '';
        setAuth({
          mode: 'authenticated',
          email,
          label: email,
          isLocalMode: false,
          isAuthenticated: true,
        });
      } else if (authModeRef.current === 'authenticated') {
        setAuth({
          mode: 'login',
          email: '',
          label: '',
          isLocalMode: false,
          isAuthenticated: false,
        });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCurrentPage() {
      setLoading((current) => ({ ...current, currentPage: true }));
      setError((current) => ({ ...current, currentPage: null }));

      try {
        const tab = await getCurrentTab();
        if (cancelled) {
          return;
        }

        const url = tab?.url || null;
        setCurrentPage({
          url,
          title: tab?.title || '',
          hostname: getHostname(url),
        });
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setCurrentPage({
          url: null,
          title: '',
          hostname: null,
        });
        setError((current) => ({
          ...current,
          currentPage:
            caughtError instanceof Error
              ? caughtError.message
              : 'Failed to determine current tab',
        }));
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, currentPage: false }));
        }
      }
    }

    void hydrateCurrentPage();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateData() {
      setLoading((current) => ({ ...current, data: true }));
      setError((current) => ({ ...current, data: null }));

      try {
        const [storageData, notesService, foldersService, tagsService] = await Promise.all([
          readLocalStorage(),
          getNotesService(),
          getFoldersService(),
          getTagsService(),
        ]);
        const [serviceNotes, serviceFolders, serviceTags] = await Promise.all([
          notesService.getAll().catch(() => storageData.notes),
          foldersService.getAll().catch(() => storageData.folders),
          tagsService.getAll().catch(() => storageData.tags),
        ]);

        if (cancelled) {
          return;
        }

        setData({
          notes: serviceNotes,
          folders: serviceFolders,
          tags: serviceTags,
        });
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setData({ notes: [], folders: [], tags: [] });
        setError((current) => ({
          ...current,
          data: caughtError instanceof Error ? caughtError.message : 'Failed to load workspace data',
        }));
      } finally {
        if (!cancelled) {
          setLoading((current) => ({ ...current, data: false }));
        }
      }
    }

    void hydrateData();

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      setData((current) => ({
        notes: changes.divnotes_notes ? changes.divnotes_notes.newValue || [] : current.notes,
        folders: changes.divnotes_folders
          ? changes.divnotes_folders.newValue || []
          : current.folders,
        tags: changes.divnotes_tags ? changes.divnotes_tags.newValue || [] : current.tags,
      }));
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  const derived = useMemo<WorkspaceDerived>(() => {
    return {
      thisPageNotes: selectThisPageNotes(data.notes, currentPage.url),
      groupedNotes: groupNotesByHostname(data.notes),
      folderSummaries: buildFolderSummaries(data.notes, data.folders),
      tagSummaries: buildTagSummaries(data.tags, data.notes),
    };
  }, [currentPage.url, data.folders, data.notes, data.tags]);

  const counts = useMemo(
    () =>
      buildViewCounts({
        notes: data.notes,
        folders: data.folders,
        tags: data.tags,
        currentPageUrl: currentPage.url,
      }),
    [currentPage.url, data.folders, data.notes, data.tags]
  );

  const setView = useCallback((nextView: WorkspaceView) => {
    setActiveView(nextView);
  }, []);

  const activateInspector = useCallback(async () => {
    clearActionError();
    try {
      await chrome.runtime.sendMessage({ type: 'ACTIVATE_INSPECTOR' });
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error ? caughtError.message : 'Failed to activate inspector'
      );
      throw caughtError;
    }
  }, [clearActionError, setActionError]);

  const openSidePanel = useCallback(async () => {
    clearActionError();
    try {
      const tab = await getCurrentTab();
      const windowId = tab?.windowId;
      await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL', windowId });
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error ? caughtError.message : 'Failed to open side panel'
      );
      throw caughtError;
    }
  }, [clearActionError, setActionError]);

  const openPopup = useCallback(async () => {
    clearActionError();
    try {
      await chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Failed to open popup');
      throw caughtError;
    }
  }, [clearActionError, setActionError]);

  const exportNotes = useCallback(async () => {
    clearActionError();
    try {
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
  }, [clearActionError, data.folders, data.notes, data.tags, setActionError]);

  const importNotes = useCallback(async () => {
    clearActionError();

    return new Promise<void>((resolve, reject) => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) {
            resolve();
            return;
          }

          const reader = new FileReader();
          reader.onload = async () => {
            try {
              const parsed = JSON.parse(String(reader.result || '{}'));
              const existing = await readLocalStorage();
              const mergedNotes = dedupeById([
                ...existing.notes,
                ...normalizeImportArray<StoredNote>(parsed.notes),
              ]);
              const mergedFolders = dedupeById([
                ...existing.folders,
                ...normalizeImportArray<StoredFolder>(parsed.folders),
              ]);
              const mergedTags = dedupeById([
                ...existing.tags,
                ...normalizeImportArray<StoredTag>(parsed.tags),
              ]);

              await chrome.storage.local.set({
                divnotes_notes: mergedNotes,
                divnotes_folders: mergedFolders,
                divnotes_tags: mergedTags,
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
        input.click();
      } catch (caughtError) {
        setActionError(caughtError instanceof Error ? caughtError.message : 'Failed to import notes');
        reject(caughtError);
      }
    });
  }, [clearActionError, setActionError]);

  const clearAllNotes = useCallback(async () => {
    clearActionError();
    try {
      await chrome.storage.local.set({ divnotes_notes: [] });
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error ? caughtError.message : 'Failed to clear all notes'
      );
      throw caughtError;
    }
  }, [clearActionError, setActionError]);

  const logout = useCallback(async () => {
    clearActionError();

    try {
      if (auth.mode === 'authenticated') {
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
  }, [auth.mode, clearActionError, setActionError]);

  return {
    auth,
    currentPage,
    data,
    derived,
    counts,
    loading,
    error,
    view: {
      active: activeView,
      folderId: selectedFolderId,
      tagId: selectedTagId,
    } satisfies ViewState,
    setView,
    actions: {
      activateInspector,
      openSidePanel,
      openPopup,
      exportNotes,
      importNotes,
      clearAllNotes,
      logout,
      setFolderDetail: setSelectedFolderId,
      setTagFilter: setSelectedTagId,
      clearFilters: () => {
        setSelectedFolderId(null);
        setSelectedTagId(null);
      },
    },
  };
}
