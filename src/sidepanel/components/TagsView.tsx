import React, { useState, useMemo } from 'react';
import { Hash, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import { buildTagSummaries, createTagResolver } from '@/lib/extension-selectors';
import { NoteCard } from './NoteCard';
import { TagPill } from './TagPill';
import { TagManager } from './TagManager';
import { getAncestorPath } from '@/lib/tree-utils';
import type { StoredNote, StoredFolder, StoredTag } from '@/lib/types';

interface TagsViewProps {
  notes: StoredNote[];
  folders: StoredFolder[];
  tags: StoredTag[];
  searchQuery: string;
  onDeleteNote: (noteId: string) => void;
  onNavigateNote: (note: StoredNote) => void;
  onEditNote: (note: StoredNote) => void;
}

export function TagsView({
  notes,
  folders,
  tags,
  searchQuery,
  onDeleteNote,
  onNavigateNote,
  onEditNote,
}: TagsViewProps) {
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set());
  const [showManager, setShowManager] = useState(false);
  const tagResolver = useMemo(() => createTagResolver(tags), [tags]);

  const tagNoteCounts = useMemo(() => {
    return new Map(buildTagSummaries(tags, notes).map((summary) => [summary.tag.id, summary.count]));
  }, [notes, tags]);

  // Toggle a tag in the active filter
  const toggleTag = (tagId: string) => {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const removeTag = (tagId: string) => {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      next.delete(tagId);
      return next;
    });
  };

  const filteredNotes = useMemo(() => {
    let result = notes;

    if (activeTagIds.size > 0) {
      result = result.filter((note) => tagResolver.noteHasAllTagValues(note, activeTagIds));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (note) =>
          note.content.toLowerCase().includes(q) ||
          note.elementInfo.toLowerCase().includes(q)
      );
    }

    return result;
  }, [notes, activeTagIds, searchQuery, tagResolver]);

  const getFolderPath = (note: StoredNote): string | undefined => {
    if (!note.folderId) return undefined;
    const ancestors = getAncestorPath(note.folderId, folders);
    if (ancestors.length === 0) return undefined;
    return ancestors.map((f) => f.name).join(' / ');
  };

  const activeTags = useMemo(
    () => tags.filter((t) => activeTagIds.has(t.id)),
    [tags, activeTagIds]
  );

  // Empty state: no tags at all
  if (tags.length === 0) {
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
      {/* Tag Manager overlay */}
      {showManager && (
        <TagManager tags={tags} onClose={() => setShowManager(false)} />
      )}

      {/* Header */}
      <div className="rounded-[20px] border border-[#ece7de] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(5,36,21,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f1eb] text-[#6d7b70]">
              <Tags className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa294]">Tags</p>
              <p className="text-[13px] font-semibold text-[#173628]">
                {tags.length} {tags.length === 1 ? 'tag' : 'tags'}
              </p>
            </div>
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

        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#f8f6f1] pr-2"
            >
              <TagPill
                tag={tag}
                size="md"
                active={activeTagIds.has(tag.id)}
                onClick={() => toggleTag(tag.id)}
              />
              <span className="text-[10px] font-medium text-[#8b968e]">
                {tagNoteCounts.get(tag.id) || 0}
              </span>
            </span>
          ))}
        </div>

        {activeTags.length > 0 ? (
          <div className="mt-4 rounded-[16px] bg-[#f8f6f1] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa294]">
              Filtering by
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeTags.map((tag) => (
                <TagPill
                  key={tag.id}
                  tag={tag}
                  size="sm"
                  active
                  onRemove={() => removeTag(tag.id)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {filteredNotes.length === 0 && activeTagIds.size > 0 ? (
        <WorkspaceEmptyState
          icon={<Hash className="h-5 w-5" />}
          title="No notes match the selected tags"
          description="Choose another tag or clear the filter."
        />
      ) : filteredNotes.length === 0 && searchQuery.trim() ? (
        <WorkspaceEmptyState
          icon={<Hash className="h-5 w-5" />}
          title="No notes match your search"
          description={`Nothing matched "${searchQuery}".`}
        />
      ) : (
        <div className="space-y-3">
          {filteredNotes.map((note) => (
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
