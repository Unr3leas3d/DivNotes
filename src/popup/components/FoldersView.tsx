import React, { useMemo } from 'react';
import { Folder01Icon, FolderOpenIcon, LinkSquare02Icon } from '@hugeicons/core-free-icons';

import { HugeIcon } from '@/components/ui/huge-icon';
import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import { WorkspaceNoteCard } from '@/components/workspace/WorkspaceNoteCard';
import { createTagResolver, type FolderSummary } from '@/lib/extension-selectors';
import type { StoredFolder, StoredNote, StoredTag } from '@/lib/types';

interface FoldersViewProps {
  folderSummaries: FolderSummary[];
  foldersById: Map<string, StoredFolder>;
  notesById: Map<string, StoredNote>;
  tagsById: Map<string, StoredTag>;
  selectedFolderId: string | null;
  loading: boolean;
  error: string | null;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: () => void;
  onOpenNote: (note: StoredNote) => void;
  onEditNote: (note: StoredNote) => void;
  onOpenAsTabGroup?: (folderId: string) => void;
}

export function FoldersView({
  folderSummaries,
  foldersById,
  notesById,
  tagsById,
  selectedFolderId,
  loading,
  error,
  onSelectFolder,
  onCreateFolder,
  onOpenNote,
  onEditNote,
  onOpenAsTabGroup,
}: FoldersViewProps) {
  const selectedSummary = useMemo(
    () => folderSummaries.find((summary) => summary.folder.id === selectedFolderId) || null,
    [folderSummaries, selectedFolderId]
  );
  const tags = useMemo(() => [...tagsById.values()], [tagsById]);
  const tagResolver = useMemo(() => createTagResolver(tags), [tags]);

  if (loading) {
    return (
      <WorkspaceEmptyState
        loading
        icon={<HugeIcon icon={Folder01Icon} className="h-5 w-5" />}
        title="Loading folders"
        description="Preparing your folder index."
      />
    );
  }

  if (error) {
    return (
      <WorkspaceEmptyState
        icon={<HugeIcon icon={Folder01Icon} className="h-5 w-5" />}
        title="Folders are unavailable"
        description={error}
      />
    );
  }

  if (selectedSummary) {
    return (
      <div className="space-y-4">
        <div className="rounded-[20px] border border-border bg-muted px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Folder Detail
          </p>
          <h2 className="mt-2 text-[16px] font-semibold text-foreground">{selectedSummary.folder.name}</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {selectedSummary.count} {selectedSummary.count === 1 ? 'note' : 'notes'} saved here.
          </p>
          {selectedSummary.count > 0 && onOpenAsTabGroup && (
            <button
              type="button"
              onClick={() => {
                if (selectedSummary.count > 15) {
                  const confirmed = window.confirm(`Open ${selectedSummary.count} tabs in a group?`);
                  if (!confirmed) return;
                }
                onOpenAsTabGroup(selectedSummary.folder.id);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              <HugeIcon icon={LinkSquare02Icon} className="h-3 w-3" />
              Open All
            </button>
          )}
        </div>

        {selectedSummary.count === 0 ? (
          <WorkspaceEmptyState
            icon={<HugeIcon icon={FolderOpenIcon} className="h-5 w-5" />}
            title="This folder is empty"
            description="Move notes here from the page editor or keep saving new notes into it."
          />
        ) : (
          <div className="space-y-2.5">
            {selectedSummary.noteIds.map((noteId) => {
              const note = notesById.get(noteId);
              if (!note) {
                return null;
              }

              return (
                <WorkspaceNoteCard
                  key={note.id}
                  note={note}
                  density="compact"
                  onOpen={onOpenNote}
                  onEdit={onEditNote}
                  folderName={selectedSummary.folder.name}
                  tagNames={tagResolver.resolveStoredTagLabels(note.tags)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (folderSummaries.length === 0) {
    return (
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onCreateFolder}
          className="flex w-full items-center justify-center rounded-[18px] border border-dashed border-border bg-muted px-4 py-4 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-secondary"
        >
          New Folder
        </button>
        <WorkspaceEmptyState
          icon={<HugeIcon icon={Folder01Icon} className="h-5 w-5" />}
          title="Organize notes into folders"
          description="Create a folder to keep related notes together."
        />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onCreateFolder}
        className="flex w-full items-center justify-center rounded-[18px] border border-dashed border-border bg-muted px-4 py-4 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-secondary"
      >
        New Folder
      </button>
      {folderSummaries.map((summary) => {
        const parentFolder = summary.folder.parentId ? foldersById.get(summary.folder.parentId) : null;

        return (
          <div key={summary.folder.id} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelectFolder(summary.folder.id)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-4 text-left shadow-card transition-colors hover:bg-muted"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                style={{
                  backgroundColor: summary.folder.color ? `${summary.folder.color}22` : undefined,
                  color: summary.folder.color || undefined,
                }}
              >
                <HugeIcon icon={Folder01Icon} className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">{summary.folder.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {parentFolder ? `${parentFolder.name} / ` : ''}
                  {summary.count} {summary.count === 1 ? 'note' : 'notes'}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-border"
                    style={{ backgroundColor: summary.folder.color || '#f3f1eb' }}
                  />
                  <span>
                    Folder color {summary.folder.color ? 'set' : 'not set'}
                  </span>
                </div>
              </div>
              <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                Open
              </span>
            </button>
            {onOpenAsTabGroup && summary.count > 0 && (
              <button
                type="button"
                onClick={() => onOpenAsTabGroup(summary.folder.id)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] border border-border bg-card text-muted-foreground shadow-card transition-colors hover:bg-muted hover:text-foreground"
                title="Open all as tab group"
              >
                <HugeIcon icon={LinkSquare02Icon} className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
