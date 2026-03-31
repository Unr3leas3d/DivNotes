import React, { useMemo } from 'react';
import { Tags } from 'lucide-react';

import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import { WorkspaceNoteCard } from '@/components/workspace/WorkspaceNoteCard';
import { WorkspaceTagFilterBar } from '@/components/workspace/WorkspaceTagFilterBar';
import { createTagResolver, type TagSummary } from '@/lib/extension-selectors';
import type { StoredFolder, StoredNote } from '@/lib/types';

interface TagsViewProps {
  tagSummaries: TagSummary[];
  selectedTagIds: string[];
  notes: StoredNote[];
  foldersById: Map<string, StoredFolder>;
  loading: boolean;
  error: string | null;
  onToggleTag: (tagId: string) => void;
  onClearFilters: () => void;
  onOpenNote: (note: StoredNote) => void;
  onEditNote: (note: StoredNote) => void;
}

export function TagsView({
  tagSummaries,
  selectedTagIds,
  notes,
  foldersById,
  loading,
  error,
  onToggleTag,
  onClearFilters,
  onOpenNote,
  onEditNote,
}: TagsViewProps) {
  const tags = useMemo(() => tagSummaries.map((summary) => summary.tag), [tagSummaries]);
  const tagResolver = useMemo(() => createTagResolver(tags), [tags]);
  const filteredNotes = useMemo(() => {
    if (selectedTagIds.length === 0) {
      return [];
    }

    return notes.filter((note) => tagResolver.noteHasAllTagValues(note, selectedTagIds));
  }, [notes, selectedTagIds, tagResolver]);

  if (loading) {
    return (
      <WorkspaceEmptyState
        loading
        icon={<Tags className="h-5 w-5" />}
        title="Loading tags"
        description="Preparing the latest tag filters."
      />
    );
  }

  if (error) {
    return (
      <WorkspaceEmptyState
        icon={<Tags className="h-5 w-5" />}
        title="Tags are unavailable"
        description={error}
      />
    );
  }

  if (tagSummaries.length === 0) {
    return (
      <WorkspaceEmptyState
        icon={<Tags className="h-5 w-5" />}
        title="Tag your notes for easy filtering"
        description="Tags are added when you create notes."
      />
    );
  }

  return (
    <div className="space-y-4">
      <WorkspaceTagFilterBar
        tagSummaries={tagSummaries}
        selectedTagIds={selectedTagIds}
        onToggleTag={onToggleTag}
        onClearFilters={onClearFilters}
      />

      {selectedTagIds.length === 0 ? (
        <WorkspaceEmptyState
          icon={<Tags className="h-5 w-5" />}
          title="Select tags to see matching notes"
          description="Pick one or more tags above to filter the notes list."
        />
      ) : filteredNotes.length === 0 ? (
        <WorkspaceEmptyState
          icon={<Tags className="h-5 w-5" />}
          title="No notes match these tags"
          description="Choose another tag combination or clear the filters."
          action={
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-[12px] border border-[#e7e2d8] bg-white px-3 py-1.5 text-[11px] font-medium text-[#526357] transition-colors hover:bg-[#f8f6f1]"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filteredNotes.map((note) => (
            <WorkspaceNoteCard
              key={note.id}
              density="compact"
              note={note}
              onOpen={onOpenNote}
              onEdit={onEditNote}
              folderName={note.folderId ? foldersById.get(note.folderId)?.name || null : null}
              tagNames={tagResolver.resolveStoredTagLabels(note.tags)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
