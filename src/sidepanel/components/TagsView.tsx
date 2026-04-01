import React, { useMemo, useState } from 'react';
import { Tags } from 'lucide-react';

import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import { WorkspaceTagFilterBar } from '@/components/workspace/WorkspaceTagFilterBar';
import { Button } from '@/components/ui/button';
import { createTagResolver, type TagSummary } from '@/lib/extension-selectors';
import type { StoredFolder, StoredNote } from '@/lib/types';
import { NoteCard } from './NoteCard';
import { TagManager } from './TagManager';
import { getAncestorPath } from '@/lib/tree-utils';
import { resolveSidepanelTagsEmptyState } from './tags-view-state';

interface TagsViewProps {
  tagSummaries: TagSummary[];
  selectedTagIds: string[];
  notes: StoredNote[];
  folders: StoredFolder[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onToggleTag: (tagId: string) => void;
  onClearFilters: () => void;
  onDeleteNote: (noteId: string) => void;
  onNavigateNote: (note: StoredNote) => void;
  onEditNote: (note: StoredNote) => void;
}

export function TagsView({
  tagSummaries,
  selectedTagIds,
  notes,
  folders,
  loading,
  error,
  searchQuery,
  onToggleTag,
  onClearFilters,
  onDeleteNote,
  onNavigateNote,
  onEditNote,
}: TagsViewProps) {
  const [showManager, setShowManager] = useState(false);
  const tags = useMemo(() => tagSummaries.map((summary) => summary.tag), [tagSummaries]);
  const tagResolver = useMemo(() => createTagResolver(tags), [tags]);
  const notesMatchingTags = useMemo(() => {
    if (selectedTagIds.length === 0) {
      return [];
    }

    return notes.filter((note) => tagResolver.noteHasAllTagValues(note, selectedTagIds));
  }, [notes, selectedTagIds, tagResolver]);
  const searchFilteredNotes = useMemo(() => {
    if (selectedTagIds.length === 0) {
      return [];
    }

    if (!searchQuery.trim()) {
      return notesMatchingTags;
    }

    const q = searchQuery.toLowerCase();
    return notesMatchingTags.filter(
      (note) =>
        note.content.toLowerCase().includes(q) || note.elementInfo.toLowerCase().includes(q)
    );
  }, [notesMatchingTags, searchQuery, selectedTagIds.length]);
  const emptyStateMode = resolveSidepanelTagsEmptyState({
    selectedTagIds,
    searchQuery,
    notesMatchingTagsCount: notesMatchingTags.length,
    searchFilteredNotesCount: searchFilteredNotes.length,
  });
  const activeTags = useMemo(
    () => tagSummaries.filter((summary) => selectedTagIds.includes(summary.tag.id)),
    [selectedTagIds, tagSummaries]
  );

  const getFolderPath = (note: StoredNote): string | undefined => {
    if (!note.folderId) return undefined;
    const ancestors = getAncestorPath(note.folderId, folders);
    if (ancestors.length === 0) return undefined;
    return ancestors.map((f) => f.name).join(' / ');
  };

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
        title="No tags yet"
        description="Add tags to your notes to organize them by topic."
      />
    );
  }

  return (
    <div className="relative space-y-4">
      {showManager ? <TagManager tags={tags} onClose={() => setShowManager(false)} /> : null}

      <div className="rounded-[20px] border border-[#ece7de] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(5,36,21,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa294]">Tags</p>
            <p className="text-[13px] font-semibold text-[#173628]">
              {tags.length} {tags.length === 1 ? 'tag' : 'tags'}
            </p>
          </div>
          <Button
            variant="ghost"
            className="h-9 rounded-[12px] border border-[#e7e2d8] bg-[#f8f6f1] px-3 text-[12px] font-medium text-[#526357] hover:bg-[#f1eee7]"
            title="Manage tags"
            onClick={() => setShowManager(true)}
          >
            Manage Tags
          </Button>
        </div>

        {activeTags.length > 0 ? (
          <div className="mt-4 rounded-[16px] bg-[#f8f6f1] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa294]">
              Filtering by
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeTags.map((summary) => (
                <span
                  key={summary.tag.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#173628] bg-[#173628] px-3 py-1.5 text-[11px] font-medium text-[#f5efe9]"
                >
                  {summary.tag.name}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <WorkspaceTagFilterBar
        tagSummaries={tagSummaries}
        selectedTagIds={selectedTagIds}
        onToggleTag={onToggleTag}
        onClearFilters={onClearFilters}
        density="compact"
      />

      {emptyStateMode === 'select-tags' ? (
        <WorkspaceEmptyState
          icon={<Tags className="h-5 w-5" />}
          title="Select tags to see matching notes"
          description="Pick one or more tags above to filter the notes list."
        />
      ) : emptyStateMode === 'search-empty' ? (
        <WorkspaceEmptyState
          icon={<Tags className="h-5 w-5" />}
          title="No notes match your search"
          description={`Nothing matched "${searchQuery}".`}
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
      ) : emptyStateMode === 'tag-empty' ? (
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
        <div className="space-y-3">
          {searchFilteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              tags={tags}
              onDelete={onDeleteNote}
              onNavigate={onNavigateNote}
              onEdit={onEditNote}
              showFolderPath
              folderPath={getFolderPath(note)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
