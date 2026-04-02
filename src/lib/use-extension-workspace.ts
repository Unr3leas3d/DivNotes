import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildStoredAccountState, type StoredAccountState } from './account-state';
import { getFoldersService, resetFoldersService } from './folders-service';
import { getNotesService, resetNotesService } from './notes-service';
import { getTagsService, resetTagsService } from './tags-service';
import { supabase } from './supabase';
import {
  buildFolderSummaries,
  buildTagSummaries,
  buildViewCounts,
  groupNotesByHostname,
  selectThisPageNotes,
} from './extension-selectors';
import {
  createExtensionWorkspaceActions,
  readCloudWorkspaceSnapshot,
  refreshStoredAccountStateFromSession,
  resetSyncQueue,
  uploadWorkspaceSnapshotDiff,
} from './extension-workspace-actions';
import {
  buildCurrentPageState,
  emptyCurrentPageState,
  emptyWorkspaceData,
  getCurrentTab,
  readExtensionWorkspaceStorage,
} from './extension-workspace-helpers';
import {
  reconcileWorkspaceData,
  type ReconciliationConflict,
  type ReconciliationResult,
  type WorkspaceSnapshot,
} from './sync-reconciliation';
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
} from './extension-workspace-types';

export type WorkspaceView = 'this-page' | 'all-notes' | 'folders' | 'tags' | 'settings';

interface StoredWorkspaceAuth {
  mode?: AuthMode;
  email?: string;
}

function buildStoredAccountFallback(
  storedAuth: StoredWorkspaceAuth | null | undefined,
  fallbackEmail = ''
): StoredAccountState {
  if (storedAuth?.mode === 'local') {
    return buildStoredAccountState({
      authMode: 'local',
      email: '',
      profile: null,
    });
  }

  if (storedAuth?.mode === 'authenticated') {
    return buildStoredAccountState({
      authMode: 'authenticated',
      email: fallbackEmail || storedAuth.email || '',
      profile: null,
    });
  }

  return buildStoredAccountState({
    authMode: 'login',
    email: '',
    profile: null,
  });
}

function buildLoginAuth(): WorkspaceAuth {
  return {
    mode: 'login',
    email: '',
    label: '',
    isLocalMode: false,
    isAuthenticated: false,
    plan: null,
    entitlementStatus: null,
    billingProvider: null,
    subscriptionInterval: null,
    cloudSyncEnabled: false,
  };
}

function buildWorkspaceAuth(
  storedAuth: StoredWorkspaceAuth | null | undefined,
  storedAccount: StoredAccountState | null | undefined,
  fallbackEmail = ''
): WorkspaceAuth {
  const account = storedAccount ?? buildStoredAccountFallback(storedAuth, fallbackEmail);

  if (account.authMode === 'local') {
    return {
      mode: 'local',
      email: '',
      label: 'Local Mode',
      isLocalMode: true,
      isAuthenticated: true,
      plan: null,
      entitlementStatus: null,
      billingProvider: null,
      subscriptionInterval: null,
      cloudSyncEnabled: false,
    };
  }

  if (account.authMode === 'authenticated') {
    const email = account.email || fallbackEmail || storedAuth?.email || '';
    return {
      mode: 'authenticated',
      email,
      label: email,
      isLocalMode: false,
      isAuthenticated: true,
      plan: account.plan,
      entitlementStatus: account.entitlementStatus,
      billingProvider: account.billingProvider,
      subscriptionInterval: account.subscriptionInterval,
      cloudSyncEnabled: account.cloudSyncEnabled,
    };
  }

  return buildLoginAuth();
}

function resetWorkspaceServices() {
  resetNotesService();
  resetFoldersService();
  resetTagsService();
}

const popupAllowedViews: WorkspaceView[] = [
  'this-page',
  'all-notes',
  'folders',
  'tags',
  'settings',
];

const sidePanelAllowedViews: WorkspaceView[] = ['all-notes', 'folders', 'tags', 'settings'];

function buildWorkspaceSnapshot(data: WorkspaceData): WorkspaceSnapshot {
  return {
    notes: data.notes,
    folders: data.folders,
    tags: data.tags,
    noteTags: data.notes.flatMap((note) =>
      note.tags.map((tagId) => ({ noteId: note.id, tagId }))
    ),
  };
}

function upsertById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function applyDownloadedNoteTags(
  notes: WorkspaceData['notes'],
  noteTags: WorkspaceSnapshot['noteTags']
) {
  const notesById = new Map(
    notes.map((note) => [note.id, { ...note, tags: [...note.tags] }])
  );

  for (const link of noteTags) {
    const note = notesById.get(link.noteId);
    if (!note) {
      continue;
    }

    if (!note.tags.includes(link.tagId)) {
      note.tags = [...note.tags, link.tagId];
    }
  }

  return [...notesById.values()];
}

async function applyDownloadedSnapshot(snapshot: WorkspaceSnapshot) {
  const current = await readExtensionWorkspaceStorage();
  const notes = applyDownloadedNoteTags(upsertById(current.notes, snapshot.notes), snapshot.noteTags);
  const folders = upsertById(current.folders, snapshot.folders);
  const tags = upsertById(current.tags, snapshot.tags);

  await chrome.storage.local.set({
    divnotes_notes: notes,
    divnotes_folders: folders,
    divnotes_tags: tags,
  });
}

function hasReconciliationWork(result: ReconciliationResult) {
  return (
    result.conflicts.length > 0 ||
    result.upload.notes.length > 0 ||
    result.upload.folders.length > 0 ||
    result.upload.tags.length > 0 ||
    result.upload.noteTags.length > 0 ||
    result.download.notes.length > 0 ||
    result.download.folders.length > 0 ||
    result.download.tags.length > 0 ||
    result.download.noteTags.length > 0
  );
}

export function useExtensionWorkspace(options: { shell: ShellType }) {
  const allowedViews = useMemo(
    () => (options.shell === 'popup' ? popupAllowedViews : sidePanelAllowedViews),
    [options.shell]
  );
  const defaultView = options.shell === 'popup' ? 'this-page' : 'all-notes';

  const [auth, setAuth] = useState<WorkspaceAuth>({
    ...buildLoginAuth(),
    mode: 'loading',
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
  const [activeView, setActiveView] = useState<WorkspaceView>(defaultView);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [reconciliationDialog, setReconciliationDialog] = useState<{
    open: boolean;
    conflicts: ReconciliationConflict[];
    error: string | null;
    isSubmitting: boolean;
  }>({
    open: false,
    conflicts: [],
    error: null,
    isSubmitting: false,
  });
  const authModeRef = useRef<AuthMode>('loading');
  const dataRef = useRef<WorkspaceData>(emptyWorkspaceData());
  const previousCloudSyncEnabledRef = useRef<boolean | null>(null);
  const pendingReconciliationRef = useRef<ReconciliationResult | null>(null);

  const clearActionError = useCallback(() => {
    setError((current) => ({ ...current, actions: null }));
  }, []);

  const setActionError = useCallback((message: string) => {
    setError((current) => ({ ...current, actions: message }));
  }, []);

  const applyReconciliationResult = useCallback(async (result: ReconciliationResult) => {
    setReconciliationDialog((current) => ({
      ...current,
      isSubmitting: true,
      error: null,
    }));

    try {
      clearActionError();
      await resetSyncQueue();
      await uploadWorkspaceSnapshotDiff(result.upload);
      await applyDownloadedSnapshot(result.download);
      pendingReconciliationRef.current = null;
      setReconciliationDialog({
        open: false,
        conflicts: [],
        error: null,
        isSubmitting: false,
      });
    } catch (caughtError) {
      setReconciliationDialog((current) => ({
        ...current,
        isSubmitting: false,
        error:
          caughtError instanceof Error ? caughtError.message : 'Failed to reconcile workspace data',
      }));
      throw caughtError;
    }
  }, [clearActionError]);

  const runEntitlementReconciliation = useCallback(async () => {
    try {
      const [localData, cloudSnapshot] = await Promise.all([
        readExtensionWorkspaceStorage(),
        readCloudWorkspaceSnapshot(),
      ]);
      const result = reconcileWorkspaceData({
        local: buildWorkspaceSnapshot(localData),
        cloud: cloudSnapshot,
      });

      if (!hasReconciliationWork(result)) {
        await resetSyncQueue();
        return;
      }

      if (result.conflicts.length > 0) {
        pendingReconciliationRef.current = result;
        setReconciliationDialog({
          open: true,
          conflicts: result.conflicts,
          error: null,
          isSubmitting: false,
        });
        return;
      }

      await applyReconciliationResult(result);
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to reconcile local and cloud workspace data'
      );
    }
  }, [applyReconciliationResult, setActionError]);

  useEffect(() => {
    authModeRef.current = auth.mode;
  }, [auth.mode]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (auth.mode !== 'authenticated') {
      return;
    }

    const refreshAccountState = () => {
      void refreshStoredAccountStateFromSession().catch(() => {
        // Keep the cached state if the refresh fails. The UI already has a fallback snapshot.
      });
    };

    refreshAccountState();
    window.addEventListener('focus', refreshAccountState);

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        refreshAccountState();
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);
    return () => {
      window.removeEventListener('focus', refreshAccountState);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [auth.mode]);

  useEffect(() => {
    if (auth.mode === 'loading') {
      return;
    }

    if (previousCloudSyncEnabledRef.current === null) {
      previousCloudSyncEnabledRef.current = auth.cloudSyncEnabled;
      return;
    }

    const previousCloudSyncEnabled = previousCloudSyncEnabledRef.current;
    previousCloudSyncEnabledRef.current = auth.cloudSyncEnabled;

    if (!previousCloudSyncEnabled && auth.cloudSyncEnabled) {
      void runEntitlementReconciliation();
    }
  }, [auth.cloudSyncEnabled, auth.mode, runEntitlementReconciliation]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      setLoading((current) => ({ ...current, auth: true }));
      setError((current) => ({ ...current, auth: null }));

      try {
        const result = await chrome.storage.local.get(['divnotes_auth', 'divnotes_account']);
        const storedAuth = result.divnotes_auth as StoredWorkspaceAuth | undefined;
        const storedAccount = result.divnotes_account as StoredAccountState | undefined;
        if (cancelled) {
          return;
        }

        if (storedAuth?.mode === 'local') {
          const account =
            storedAccount?.authMode === 'local'
              ? storedAccount
              : buildStoredAccountFallback(storedAuth);
          setAuth(buildWorkspaceAuth(storedAuth, account));
          if (storedAccount?.authMode !== 'local') {
            await chrome.storage.local.set({ divnotes_account: account });
          }
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) {
          return;
        }

        if (storedAuth?.mode === 'authenticated') {
          const email = session?.user?.email || storedAccount?.email || storedAuth.email || '';
          const account =
            storedAccount?.authMode === 'authenticated'
              ? { ...storedAccount, email }
              : buildStoredAccountFallback(storedAuth, email);
          setAuth(buildWorkspaceAuth(storedAuth, account, email));
          if (session?.user) {
            await chrome.storage.local.set({
              divnotes_auth: { mode: 'authenticated', email },
              divnotes_account: account,
            });
          }
        } else if (session?.user) {
          const email = session.user.email || '';
          const account =
            storedAccount?.authMode === 'authenticated'
              ? { ...storedAccount, email }
              : buildStoredAccountState({
                  authMode: 'authenticated',
                  email,
                  profile: null,
                });
          setAuth(buildWorkspaceAuth({ mode: 'authenticated', email }, account, email));
          await chrome.storage.local.set({
            divnotes_auth: { mode: 'authenticated', email },
            divnotes_account: account,
          });
        } else {
          setAuth(buildLoginAuth());
        }
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setAuth(buildLoginAuth());
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

      if (authModeRef.current === 'local') {
        return;
      }

      if (session?.user) {
        const email = session.user.email || '';
        const account = buildStoredAccountState({
          authMode: 'authenticated',
          email,
          profile: null,
        });
        void chrome.storage.local.set({
          divnotes_auth: { mode: 'authenticated', email },
          divnotes_account: account,
        });
        setAuth(buildWorkspaceAuth({ mode: 'authenticated', email }, account, email));
      } else if (authModeRef.current === 'authenticated') {
        void chrome.storage.local.remove(['divnotes_auth', 'divnotes_account']);
        setAuth(buildLoginAuth());
      }
    });

    const storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (
        cancelled ||
        areaName !== 'local' ||
        (!changes.divnotes_auth && !changes.divnotes_account)
      ) {
        return;
      }

      void (async () => {
        resetWorkspaceServices();
        setError((current) => ({ ...current, auth: null }));

        const result = await chrome.storage.local.get(['divnotes_auth', 'divnotes_account']);
        if (cancelled) {
          return;
        }

        setAuth(
          buildWorkspaceAuth(
            result.divnotes_auth as StoredWorkspaceAuth | undefined,
            result.divnotes_account as StoredAccountState | undefined
          )
        );
        setLoading((current) => ({ ...current, auth: false }));
      })();
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      chrome.storage.onChanged.removeListener(storageListener);
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

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'local') {
        return;
      }

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
  }, [auth.mode]);

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

  const setView = useCallback(
    (nextView: WorkspaceView) => {
      setActiveView(allowedViews.includes(nextView) ? nextView : defaultView);
    },
    [allowedViews, defaultView]
  );

  const actions = useMemo(
    () =>
      createExtensionWorkspaceActions({
        authModeRef,
        dataRef,
        clearActionError,
        setActionError,
        setAuth,
        setSelectedFolderId,
        setSelectedTagIds,
      }),
    [clearActionError, setActionError]
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
      tagId: selectedTagIds[0] ?? null,
      tagIds: selectedTagIds,
    } satisfies ViewState,
    setView,
    actions,
    reconciliation: {
      open: reconciliationDialog.open,
      conflicts: reconciliationDialog.conflicts,
      error: reconciliationDialog.error,
      isSubmitting: reconciliationDialog.isSubmitting,
      confirm: async () => {
        const pending = pendingReconciliationRef.current;
        if (!pending) {
          setReconciliationDialog({
            open: false,
            conflicts: [],
            error: null,
            isSubmitting: false,
          });
          return;
        }

        try {
          await applyReconciliationResult(pending);
        } catch {
          // Keep the dialog open and surface the error inline.
        }
      },
      cancel: () => {
        pendingReconciliationRef.current = null;
        setReconciliationDialog({
          open: false,
          conflicts: [],
          error: null,
          isSubmitting: false,
        });
        setActionError(
          'Cloud sync is active, but reconciliation was canceled before local and cloud data were merged.'
        );
      },
      description:
        'Local and cloud changed the same items. Newest updatedAt wins for each conflict.',
    },
  };
}
