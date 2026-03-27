import React, { useState, useMemo } from 'react';
import { Tags, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

export function TagsView({
  notes,
  folders,
  tags,
  searchQuery,
  onDeleteNote,
  onNavigateNote,
}: TagsViewProps) {
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set());
  const [showManager, setShowManager] = useState(false);

  // Count notes per tag
  const tagNoteCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tag of tags) {
      counts.set(tag.id, 0);
    }
    for (const note of notes) {
      if (note.tags) {
        for (const tagId of note.tags) {
          if (counts.has(tagId)) {
            counts.set(tagId, counts.get(tagId)! + 1);
          }
        }
      }
    }
    return counts;
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

  // Remove a tag from the active filter
  const removeTag = (tagId: string) => {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      next.delete(tagId);
      return next;
    });
  };

  // Filter notes: must have ALL active tags (AND filter) + search query
  const filteredNotes = useMemo(() => {
    let result = notes;

    // AND filter: note must contain every active tag
    if (activeTagIds.size > 0) {
      result = result.filter((note) => {
        if (!note.tags) return false;
        for (const tagId of activeTagIds) {
          if (!note.tags.includes(tagId)) return false;
        }
        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (note) =>
          note.content.toLowerCase().includes(q) ||
          note.elementInfo.toLowerCase().includes(q)
      );
    }

    return result;
  }, [notes, activeTagIds, searchQuery]);

  // Build folder path for a note
  const getFolderPath = (note: StoredNote): string | undefined => {
    if (!note.folderId) return undefined;
    const ancestors = getAncestorPath(note.folderId, folders);
    if (ancestors.length === 0) return undefined;
    return ancestors.map((f) => f.name).join(' / ');
  };

  // Active tags resolved
  const activeTags = useMemo(
    () => tags.filter((t) => activeTagIds.has(t.id)),
    [tags, activeTagIds]
  );

  // Empty state: no tags at all
  if (tags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
          <Tags className="w-6 h-6 text-muted-foreground/40" />
        </div>
        <p className="text-sm font-medium text-muted-foreground mb-1">No tags yet</p>
        <p className="text-xs text-muted-foreground/60">
          Add tags to your notes to organize them by topic
        </p>
      </div>
    );
  }

  return (
    <div className="relative px-3 py-3 space-y-3">
      {/* Tag Manager overlay */}
      {showManager && (
        <TagManager tags={tags} onClose={() => setShowManager(false)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Tags className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {tags.length} {tags.length === 1 ? 'tag' : 'tags'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          title="Manage tags"
          onClick={() => setShowManager(true)}
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Tag cloud */}
      <div className="flex flex-wrap gap-1.5 px-1">
        {tags.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-1">
            <TagPill
              tag={tag}
              size="md"
              active={activeTagIds.has(tag.id)}
              onClick={() => toggleTag(tag.id)}
            />
            <span className="text-[9px] text-muted-foreground/50 font-medium -ml-0.5">
              {tagNoteCounts.get(tag.id) || 0}
            </span>
          </span>
        ))}
      </div>

      {/* Active filter bar */}
      {activeTags.length > 0 && (
        <div className="flex items-center gap-1.5 px-1 py-1.5 bg-muted/30 rounded-lg">
          <span className="text-[9px] text-muted-foreground/60 font-medium mr-0.5">
            Filtering:
          </span>
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
      )}

      {/* Filtered notes */}
      {filteredNotes.length === 0 && activeTagIds.size > 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-xs text-muted-foreground">No notes match the selected tags</p>
        </div>
      ) : filteredNotes.length === 0 && searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-xs text-muted-foreground">No notes match your search</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              tags={tags}
              onDelete={onDeleteNote}
              onNavigate={onNavigateNote}
              showFolderPath
              folderPath={getFolderPath(note)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
