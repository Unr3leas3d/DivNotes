import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getFoldersService } from './folders-service';
import { getNotesService } from './notes-service';
import { getTagsService } from './tags-service';
import { supabase } from './supabase';
import {
  buildFolderSummaries,
  buildTagSummaries,
  buildViewCounts,
  groupNotesByHostname,
  selectThisPageNotes,
} from './extension-selectors';
import { createExtensionWorkspaceActions } from './extension-workspace-actions';
import {
  buildCurrentPageState,
  emptyCurrentPageState,
  emptyWorkspaceData,
  getCurrentTab,
  readExtensionWorkspaceStorage,
} from './extension-workspace-helpers';
import type {
  AuthMode,
  CurrentPageState,
  ErrorState,
  LoadingState,
  ShellType,
  ViewState,
  WorkspaceAuth,
  WorkspaceData,
  WorkspaceDerived,
  WorkspaceView,
} from './extension-workspace-types';

export type { WorkspaceView } from './extension-workspace-types';

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
  const [data, setData] = useState<WorkspaceData>(emptyWorkspaceData);
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

        setCurrentPage(buildCurrentPageState(tab));
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setCurrentPage(emptyCurrentPageState());
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
          readExtensionWorkspaceStorage(),
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

        setData(emptyWorkspaceData());
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

  const actions = useMemo(
    () =>
      createExtensionWorkspaceActions({
        authMode: auth.mode,
        data,
        clearActionError,
        setActionError,
        setAuth,
        setSelectedFolderId,
        setSelectedTagId,
      }),
    [auth.mode, clearActionError, data, setActionError]
  );

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
    actions,
  };
}
