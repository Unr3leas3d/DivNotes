import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, Search, Settings2, LogIn } from 'lucide-react';

import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WorkspaceActionDialog } from '@/components/workspace/WorkspaceActionDialog';
import { WorkspaceNoteEditorDialog } from '@/components/workspace/WorkspaceNoteEditorDialog';
import { getNotesService } from '@/lib/notes-service';
import { useExtensionWorkspace } from '@/lib/use-extension-workspace';
import type { StoredNote } from '@/lib/types';
import { SegmentedControl, type ViewMode } from './components/SegmentedControl';
import { SidePanelShell } from './components/SidePanelShell';
import { AllNotesView } from './components/AllNotesView';
import { FoldersView } from './components/FoldersView';
import { TagsView } from './components/TagsView';
import { SettingsView } from './components/SettingsView';

type MainSidePanelView = ViewMode;

const chromeWebStoreUrl = 'https://divnotes.com';
const privacyPolicyUrl = 'https://divnotes.com/privacy';

const searchPlaceholders: Record<MainSidePanelView, string> = {
  'all-notes': 'Search all notes',
  folders: 'Search folders and notes',
  tags: 'Search tagged notes',
};

function isMainSidePanelView(view: string): view is MainSidePanelView {
  return view === 'all-notes' || view === 'folders' || view === 'tags';
}

export default function App() {
  const workspace = useExtensionWorkspace({ shell: 'sidepanel' });
  const previousViewRef = useRef<MainSidePanelView>('all-notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [screenShareMode, setScreenShareMode] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [clearAllDialogError, setClearAllDialogError] = useState<string | null>(null);
  const [clearAllDialogSubmitting, setClearAllDialogSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const foldersById = useMemo(
    () => new Map(workspace.data.folders.map((folder) => [folder.id, folder])),
    [workspace.data.folders]
  );
  const notesById = useMemo(
    () => new Map(workspace.data.notes.map((note) => [note.id, note])),
    [workspace.data.notes]
  );
  const editingNote = editingNoteId ? notesById.get(editingNoteId) ?? null : null;

  const activeMainView =
    workspace.view.active === 'settings'
      ? previousViewRef.current
      : isMainSidePanelView(workspace.view.active)
        ? workspace.view.active
        : 'all-notes';

  useEffect(() => {
    chrome.storage.local.get(['divnotes_screen_share'], (result) => {
      setScreenShareMode(Boolean(result.divnotes_screen_share));
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.divnotes_screen_share) {
        setScreenShareMode(Boolean(changes.divnotes_screen_share.newValue));
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleOpenNote = (note: StoredNote) => {
    chrome.runtime.sendMessage({
      type: 'OPEN_NOTE_TARGET',
      note: {
        url: note.url,
        elementSelector: note.elementSelector,
        elementXPath: note.elementXPath,
        elementTextHash: note.elementTextHash,
        elementPosition: note.elementPosition,
        elementTag: note.elementTag,
      },
    });
  };

  const handleDeleteNote = async (noteId: string) => {
    const service = await getNotesService();
    await service.delete(noteId);
  };

  const handleEditNote = (note: StoredNote) => {
    setEditingNoteId(note.id);
  };

  const handleAddNote = async () => {
    try {
      await workspace.actions.activateInspector();
    } catch {
      // Shared action state already surfaces the failure.
    }
  };

  const handleOpenSettings = () => {
    previousViewRef.current = activeMainView;
    workspace.setView('settings');
  };

  const handleBack = () => {
    workspace.setView(previousViewRef.current);
  };

  const handleViewChange = (nextView: ViewMode) => {
    previousViewRef.current = nextView;
    setSearchQuery('');
    workspace.actions.clearFilters();
    workspace.setView(nextView);
  };

  const headerActions = (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => void handleAddNote()}
        className="h-9 w-9 rounded-[12px] border border-[#e7e2d8] bg-white text-[#637267] hover:bg-[#f8f6f1]"
        aria-label="Add note"
        title="Add note"
      >
        <FilePlus2 className="h-4 w-4" />
      </Button>
      {workspace.view.active !== 'settings' ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleOpenSettings}
          className="h-9 w-9 rounded-[12px] border border-[#e7e2d8] bg-white text-[#637267] hover:bg-[#f8f6f1]"
          aria-label="Open settings"
          title="Open settings"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      ) : null}
    </>
  );

  const toolbar =
    workspace.view.active === 'settings' ? undefined : (
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#95a097]" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={searchPlaceholders[activeMainView]}
          className="h-[42px] rounded-[14px] border border-[#e7e2d8] bg-white pl-10 text-[13px] text-[#173628] placeholder:text-[#a0a89f] focus-visible:ring-0"
        />
      </label>
    );

  const navigation =
    workspace.view.active === 'settings' ? undefined : (
      <SegmentedControl
        value={activeMainView}
        onChange={handleViewChange}
      />
    );

  if (workspace.loading.auth) {
    return (
      <SidePanelShell actions={headerActions}>
        <WorkspaceEmptyState
          loading
          title="Checking your workspace"
          description="Loading your account and saved note data."
        />
      </SidePanelShell>
    );
  }

  if (!workspace.auth.isAuthenticated) {
    return (
      <SidePanelShell actions={headerActions} errorMessage={workspace.error.actions}>
        <WorkspaceEmptyState
          icon={<LogIn className="h-5 w-5" />}
          title="Sign in to use the side panel"
          description="Sign in through the extension popup to continue with Google, email, or local-only mode."
        />
      </SidePanelShell>
    );
  }

  return (
    <>
      <SidePanelShell
        actions={headerActions}
        toolbar={toolbar}
        navigation={navigation}
        statusBanner={
          screenShareMode ? (
            <div className="flex items-center gap-2 rounded-[14px] border border-[rgba(220,38,38,0.14)] bg-[rgba(220,38,38,0.08)] px-3 py-2 text-[11px] font-medium text-[#991b1b]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#dc2626]" />
              Screen Share Mode active. Notes stay hidden on the page until you turn it off.
              <span className="ml-auto text-[10px] font-normal text-[#b45309]">Cmd+Shift+P</span>
            </div>
          ) : null
        }
        backLabel={workspace.view.active === 'settings' ? 'Settings' : undefined}
        onBack={workspace.view.active === 'settings' ? handleBack : undefined}
        errorMessage={workspace.error.actions}
      >
        {workspace.view.active === 'all-notes' ? (
          <AllNotesView
            groupedNotes={workspace.derived.groupedNotes}
            notes={workspace.data.notes}
            foldersById={foldersById}
            tags={workspace.data.tags}
            loading={workspace.loading.data}
            error={workspace.error.data}
            query={searchQuery}
            onOpenNote={handleOpenNote}
            onEditNote={handleEditNote}
            onDeleteNote={(noteId) => void handleDeleteNote(noteId)}
          />
        ) : null}

        {workspace.view.active === 'folders' ? (
          <FoldersView
            notes={workspace.data.notes}
            folders={workspace.data.folders}
            tags={workspace.data.tags}
            searchQuery={searchQuery}
            onDeleteNote={(noteId) => void handleDeleteNote(noteId)}
            onNavigateNote={handleOpenNote}
            onEditNote={handleEditNote}
          />
        ) : null}

        {workspace.view.active === 'tags' ? (
          <TagsView
            tagSummaries={workspace.derived.tagSummaries}
            selectedTagIds={workspace.view.tagIds}
            notes={workspace.data.notes}
            folders={workspace.data.folders}
            loading={workspace.loading.data}
            error={workspace.error.data}
            searchQuery={searchQuery}
            onToggleTag={workspace.actions.toggleTagFilter}
            onClearFilters={workspace.actions.clearFilters}
            onDeleteNote={(noteId) => void handleDeleteNote(noteId)}
            onNavigateNote={handleOpenNote}
            onEditNote={handleEditNote}
          />
        ) : null}

        {workspace.view.active === 'settings' ? (
          <SettingsView
            email={workspace.auth.email}
            isLocalMode={workspace.auth.isLocalMode}
            version={chrome.runtime.getManifest().version}
            noteCount={workspace.data.notes.length}
            folderCount={workspace.data.folders.length}
            tagCount={workspace.data.tags.length}
            chromeWebStoreUrl={chromeWebStoreUrl}
            privacyPolicyUrl={privacyPolicyUrl}
            onLogout={workspace.actions.logout}
            onExport={workspace.actions.exportNotes}
            onImport={workspace.actions.importNotes}
            onClearAll={() => {
              setClearAllDialogError(null);
              setClearAllDialogOpen(true);
            }}
          />
        ) : null}
      </SidePanelShell>

      <WorkspaceActionDialog
        open={clearAllDialogOpen}
        title="Delete all notes?"
        description="This will remove every saved note from this browser and cannot be undone."
        confirmLabel="Delete All Notes"
        destructive
        isSubmitting={clearAllDialogSubmitting}
        inlineError={clearAllDialogError}
        onOpenChange={(open) => {
          if (clearAllDialogSubmitting && !open) {
            return;
          }

          setClearAllDialogOpen(open);
          if (!open) {
            setClearAllDialogError(null);
          }
        }}
        onConfirm={async () => {
          setClearAllDialogSubmitting(true);
          setClearAllDialogError(null);

          try {
            await workspace.actions.clearAllNotes();
            setClearAllDialogOpen(false);
          } catch (caughtError) {
            setClearAllDialogError(
              caughtError instanceof Error ? caughtError.message : 'Failed to clear all notes'
            );
          } finally {
            setClearAllDialogSubmitting(false);
          }
        }}
      />
      {editingNote ? (
        <WorkspaceNoteEditorDialog
          note={editingNote}
          folders={workspace.data.folders}
          open={Boolean(editingNote)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingNoteId(null);
            }
          }}
          onSaved={() => {}}
        />
      ) : null}
    </>
  );
}
