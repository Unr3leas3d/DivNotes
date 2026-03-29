import React, { useMemo } from 'react';
import { Hash, Tags } from 'lucide-react';

import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import { WorkspaceNoteCard } from '@/components/workspace/WorkspaceNoteCard';
import type { TagSummary } from '@/lib/extension-selectors';
import type { StoredFolder, StoredNote, StoredTag } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TagsViewProps {
  tagSummaries: TagSummary[];
  selectedTagId: string | null;
  notes: StoredNote[];
  foldersById: Map<string, StoredFolder>;
  tagsById: Map<string, StoredTag>;
  loading: boolean;
  error: string | null;
  onSelectTag: (tagId: string | null) => void;
  onOpenNote: (note: StoredNote) => void;
}

export function TagsView({
  tagSummaries,
  selectedTagId,
  notes,
  foldersById,
  tagsById,
  loading,
  error,
  onSelectTag,
  onOpenNote,
}: TagsViewProps) {
  const filteredNotes = useMemo(() => {
    if (!selectedTagId) {
      return notes.filter((note) => note.tags.length > 0);
    }

    return notes.filter((note) => note.tags.includes(selectedTagId));
  }, [notes, selectedTagId]);

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
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectTag(null)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
            selectedTagId === null
              ? 'border-[#173628] bg-[#173628] text-[#f5efe9]'
              : 'border-[#e7e2d8] bg-white text-[#637267] hover:bg-[#f8f6f1]'
          )}
        >
          All Tags
        </button>
        {tagSummaries.map((summary) => (
          <button
            key={summary.tag.id}
            type="button"
            onClick={() => onSelectTag(summary.tag.id)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
              selectedTagId === summary.tag.id
                ? 'border-[#173628] bg-[#173628] text-[#f5efe9]'
                : 'border-[#e7e2d8] bg-white text-[#637267] hover:bg-[#f8f6f1]'
            )}
          >
            <Hash className="h-3 w-3" />
            {summary.tag.name}
            <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] leading-none">
              {summary.count}
            </span>
          </button>
        ))}
      </div>

      {filteredNotes.length === 0 ? (
        <WorkspaceEmptyState
          icon={<Tags className="h-5 w-5" />}
          title="No notes match this tag"
          description="Choose another tag or clear the filter."
        />
      ) : (
        <div className="space-y-2.5">
          {filteredNotes.map((note) => (
            <WorkspaceNoteCard
              key={note.id}
              density="compact"
              note={note}
              onOpen={onOpenNote}
              folderName={note.folderId ? foldersById.get(note.folderId)?.name || null : null}
              tagNames={note.tags
                .map((tagId) => tagsById.get(tagId)?.name)
                .filter(Boolean) as string[]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
