import React, { useEffect, useMemo, useState } from 'react';
import { StickyNote } from 'lucide-react';

import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import { reconcileWorkspaceGroupExpansion } from '@/components/workspace/workspace-group-expansion';
import type { DomainGroup } from '@/lib/extension-selectors';
import { filterNotesBySearch } from '@/lib/extension-selectors';
import type { StoredFolder, StoredNote, StoredTag } from '@/lib/types';
import { NoteCard } from './NoteCard';
import { PinnedSection } from './PinnedSection';

interface AllNotesViewProps {
  groupedNotes: DomainGroup[];
  notes: StoredNote[];
  foldersById: Map<string, StoredFolder>;
  tags: StoredTag[];
  loading: boolean;
  error: string | null;
  query: string;
  onOpenNote: (note: StoredNote) => void;
  onEditNote: (note: StoredNote) => void;
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
  onEditNote,
  onDeleteNote,
}: AllNotesViewProps) {
  const filteredNotes = useMemo(() => filterNotesBySearch(notes, query, tags), [notes, query, tags]);
  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const pinnedNotes = useMemo(
    () => filteredNotes.filter((note) => note.pinned),
    [filteredNotes]
  );
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
  const visibleHostnames = useMemo(
    () => visibleGroups.map((group) => group.hostname),
    [visibleGroups]
  );
  const [expandedHostnames, setExpandedHostnames] = useState<Set<string>>(
    () => reconcileWorkspaceGroupExpansion(visibleHostnames, new Set())
  );

  useEffect(() => {
    setExpandedHostnames((current) => reconcileWorkspaceGroupExpansion(visibleHostnames, current));
  }, [visibleHostnames]);

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
      <PinnedSection
        pinnedNotes={pinnedNotes}
        tags={tags}
        onNoteClick={onOpenNote}
        onEditNote={onEditNote}
        onDeleteNote={onDeleteNote}
      />

      {visibleGroups.map((group) => {
        const isExpanded = expandedHostnames.has(group.hostname);

        return (
          <section key={group.hostname} className="rounded-[20px] border border-[#ece7de] bg-[#f8f6f1] p-4">
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() => {
                setExpandedHostnames((current) => {
                  const next = new Set(current);
                  if (next.has(group.hostname)) {
                    next.delete(group.hostname);
                  } else {
                    next.add(group.hostname);
                  }
                  return next;
                });
              }}
              className="flex w-full items-center justify-between gap-3 rounded-[16px] bg-white px-3 py-2 text-left"
            >
              <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#173628]">
                {group.hostname}
              </h3>
              <span className="rounded-full bg-[#f3f1eb] px-2.5 py-1 text-[10px] font-semibold text-[#6d7b70]">
                {group.count}
              </span>
            </button>

            {isExpanded ? (
              <div className="mt-3 space-y-3">
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
                      onEdit={onEditNote}
                      showFolderPath
                      folderPath={note.folderId ? foldersById.get(note.folderId)?.name : undefined}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
