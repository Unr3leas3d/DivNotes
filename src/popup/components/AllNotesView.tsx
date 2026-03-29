import React, { useMemo, useState } from 'react';
import { Globe, Search, StickyNote } from 'lucide-react';

import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import { WorkspaceNoteCard } from '@/components/workspace/WorkspaceNoteCard';
import { filterNotesBySearch, groupNotesByHostname, type DomainGroup } from '@/lib/extension-selectors';
import type { StoredFolder, StoredNote, StoredTag } from '@/lib/types';

interface AllNotesViewProps {
  groupedNotes: DomainGroup[];
  notes: StoredNote[];
  foldersById: Map<string, StoredFolder>;
  tagsById: Map<string, StoredTag>;
  loading: boolean;
  error: string | null;
  onOpenNote: (note: StoredNote) => void;
}

export function AllNotesView({
  groupedNotes,
  notes,
  foldersById,
  tagsById,
  loading,
  error,
  onOpenNote,
}: AllNotesViewProps) {
  const [query, setQuery] = useState('');
  const tags = useMemo(() => [...tagsById.values()], [tagsById]);

  const filteredNotes = useMemo(() => filterNotesBySearch(notes, query, tags), [notes, query, tags]);
  const visibleGroups = useMemo(
    () => (query.trim() ? groupNotesByHostname(filteredNotes) : groupedNotes),
    [filteredNotes, groupedNotes, query]
  );
  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);

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

  return (
    <div className="space-y-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#95a097]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search all notes"
          className="h-[42px] w-full rounded-[14px] border border-[#e7e2d8] bg-white pl-10 pr-3 text-[13px] text-[#173628] outline-none transition-colors placeholder:text-[#a0a89f] focus:border-[#c9d3ca]"
        />
      </label>

      {visibleGroups.length === 0 ? (
        <WorkspaceEmptyState
          icon={<StickyNote className="h-5 w-5" />}
          title={query.trim() ? 'No notes match that search' : 'Your notes will appear here'}
          description={
            query.trim()
              ? 'Try another phrase or clear the search.'
              : 'Start by selecting an element on any page.'
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((group) => (
            <section
              key={group.hostname}
              className="rounded-[18px] border border-[#ece7de] bg-[#f8f6f1] p-3"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#6d7b70]">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[13px] font-semibold text-[#173628]">{group.hostname}</h3>
                  <p className="truncate text-[11px] text-[#8c978f]">{group.pageTitle}</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[#6d7b70]">
                  {group.count}
                </span>
              </div>

              <div className="space-y-2">
                {group.noteIds.map((noteId) => {
                  const note = notesById.get(noteId);
                  if (!note) {
                    return null;
                  }

                  return (
                    <WorkspaceNoteCard
                      key={note.id}
                      density="compact"
                      note={note}
                      folderName={note.folderId ? foldersById.get(note.folderId)?.name || null : null}
                      tagNames={note.tags
                        .map((tagId) => tagsById.get(tagId)?.name)
                        .filter(Boolean) as string[]}
                      onOpen={onOpenNote}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
