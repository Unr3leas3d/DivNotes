import React, { useMemo } from 'react';
import { Globe, StickyNote } from 'lucide-react';

import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import type { DomainGroup } from '@/lib/extension-selectors';
import { filterNotesBySearch } from '@/lib/extension-selectors';
import type { StoredFolder, StoredNote, StoredTag } from '@/lib/types';
import { NoteCard } from './NoteCard';

interface AllNotesViewProps {
  groupedNotes: DomainGroup[];
  notes: StoredNote[];
  foldersById: Map<string, StoredFolder>;
  tags: StoredTag[];
  loading: boolean;
  error: string | null;
  query: string;
  onOpenNote: (note: StoredNote) => void;
  onDeleteNote: (noteId: string) => void;
}

export function AllNotesView({
  groupedNotes,
  notes,
  foldersById,
  tags,
  loading,
  error,
  query,
  onOpenNote,
  onDeleteNote,
}: AllNotesViewProps) {
  const filteredNotes = useMemo(() => filterNotesBySearch(notes, query), [notes, query]);
  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const visibleGroups = useMemo(() => {
    if (!query.trim()) {
      return groupedNotes;
    }

    const filteredIds = new Set(filteredNotes.map((note) => note.id));
    return groupedNotes
      .map((group) => ({
        ...group,
        noteIds: group.noteIds.filter((noteId) => filteredIds.has(noteId)),
        count: group.noteIds.filter((noteId) => filteredIds.has(noteId)).length,
      }))
      .filter((group) => group.count > 0);
  }, [filteredNotes, groupedNotes, query]);

  if (loading) {
    return (
      <WorkspaceEmptyState
        loading
        icon={<StickyNote className="h-5 w-5" />}
        title="Loading notes"
        description="Grouping every saved note by site."
      />
    );
  }

  if (error) {
    return (
      <WorkspaceEmptyState
        icon={<StickyNote className="h-5 w-5" />}
        title="Notes are unavailable"
        description={error}
      />
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <WorkspaceEmptyState
        icon={<StickyNote className="h-5 w-5" />}
        title={query.trim() ? 'No notes match that search' : 'Your notes will appear here'}
        description={
          query.trim()
            ? 'Try another phrase or clear the search.'
            : 'Start by selecting an element on any page.'
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {visibleGroups.map((group) => (
        <section key={group.hostname} className="rounded-[20px] border border-[#ece7de] bg-[#f8f6f1] p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6d7b70]">
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[14px] font-semibold text-[#173628]">{group.hostname}</h3>
              <p className="truncate text-[11px] text-[#8c978f]">{group.pageTitle}</p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#6d7b70]">
              {group.count}
            </span>
          </div>

          <div className="space-y-3">
            {group.noteIds.map((noteId) => {
              const note = notesById.get(noteId);
              if (!note) {
                return null;
              }

              return (
                <NoteCard
                  key={note.id}
                  note={note}
                  tags={tags}
                  onDelete={onDeleteNote}
                  onNavigate={onOpenNote}
                  showFolderPath
                  folderPath={note.folderId ? foldersById.get(note.folderId)?.name : undefined}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
