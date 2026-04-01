import React, { useMemo } from 'react';
import { Folder, FolderOpen } from 'lucide-react';

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
        icon={<Folder className="h-5 w-5" />}
        title="Loading folders"
        description="Preparing your folder index."
      />
    );
  }

  if (error) {
    return (
      <WorkspaceEmptyState
        icon={<Folder className="h-5 w-5" />}
        title="Folders are unavailable"
        description={error}
      />
    );
  }

  if (selectedSummary) {
    return (
      <div className="space-y-4">
        <div className="rounded-[20px] border border-[#ece7de] bg-[#f8f6f1] px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa294]">
            Folder Detail
          </p>
          <h2 className="mt-2 text-[16px] font-semibold text-[#173628]">{selectedSummary.folder.name}</h2>
          <p className="mt-1 text-[11px] text-[#8c978f]">
            {selectedSummary.count} {selectedSummary.count === 1 ? 'note' : 'notes'} saved here.
          </p>
        </div>

        {selectedSummary.count === 0 ? (
          <WorkspaceEmptyState
            icon={<FolderOpen className="h-5 w-5" />}
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
          className="flex w-full items-center justify-center rounded-[18px] border border-dashed border-[#d8ddd3] bg-[#f8f6f1] px-4 py-4 text-[13px] font-semibold text-[#536457] transition-colors hover:bg-[#f1eee7]"
        >
          New Folder
        </button>
        <WorkspaceEmptyState
          icon={<Folder className="h-5 w-5" />}
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
        className="flex w-full items-center justify-center rounded-[18px] border border-dashed border-[#d8ddd3] bg-[#f8f6f1] px-4 py-4 text-[13px] font-semibold text-[#536457] transition-colors hover:bg-[#f1eee7]"
      >
        New Folder
      </button>
      {folderSummaries.map((summary) => {
        const parentFolder = summary.folder.parentId ? foldersById.get(summary.folder.parentId) : null;

        return (
          <button
            key={summary.folder.id}
            type="button"
            onClick={() => onSelectFolder(summary.folder.id)}
            className="flex w-full items-center gap-3 rounded-[18px] border border-[#ece7de] bg-white px-4 py-4 text-left shadow-[0_1px_2px_rgba(5,36,21,0.04)] transition-colors hover:bg-[#fbfaf6]"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f1eb] text-[#6e7c72]"
              style={{
                backgroundColor: summary.folder.color ? `${summary.folder.color}22` : undefined,
                color: summary.folder.color || undefined,
              }}
            >
              <Folder className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#173628]">{summary.folder.name}</p>
              <p className="truncate text-[11px] text-[#8c978f]">
                {parentFolder ? `${parentFolder.name} / ` : ''}
                {summary.count} {summary.count === 1 ? 'note' : 'notes'}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-[#6d7b70]">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-[#d9d4ca]"
                  style={{ backgroundColor: summary.folder.color || '#f3f1eb' }}
                />
                <span>
                  Folder color {summary.folder.color ? 'set' : 'not set'}
                </span>
              </div>
            </div>
            <span className="rounded-full bg-[#f3f1eb] px-2 py-1 text-[10px] font-semibold text-[#6d7b70]">
              Open
            </span>
          </button>
        );
      })}
    </div>
  );
}
