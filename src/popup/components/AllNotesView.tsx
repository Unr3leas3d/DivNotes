import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown01Icon, ArrowRight01Icon, Search01Icon, StickyNote01Icon } from '@hugeicons/core-free-icons';

import { HugeIcon } from '@/components/ui/huge-icon';
import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import { WorkspaceNoteCard } from '@/components/workspace/WorkspaceNoteCard';
import { reconcileWorkspaceGroupExpansion } from '@/components/workspace/workspace-group-expansion';
import {
  createTagResolver,
  filterNotesBySearch,
  groupNotesByHostname,
  type DomainGroup,
} from '@/lib/extension-selectors';
import type { StoredFolder, StoredNote, StoredTag } from '@/lib/types';

interface AllNotesViewProps {
  groupedNotes: DomainGroup[];
  notes: StoredNote[];
  foldersById: Map<string, StoredFolder>;
  tagsById: Map<string, StoredTag>;
  loading: boolean;
  error: string | null;
  onOpenNote: (note: StoredNote) => void;
  onEditNote: (note: StoredNote) => void;
}

export function AllNotesView({
  groupedNotes,
  notes,
  foldersById,
  tagsById,
  loading,
  error,
  onOpenNote,
  onEditNote,
}: AllNotesViewProps) {
  const [query, setQuery] = useState('');
  const tags = useMemo(() => [...tagsById.values()], [tagsById]);
  const tagResolver = useMemo(() => createTagResolver(tags), [tags]);

  const filteredNotes = useMemo(() => filterNotesBySearch(notes, query, tags), [notes, query, tags]);
  const visibleGroups = useMemo(
    () => (query.trim() ? groupNotesByHostname(filteredNotes) : groupedNotes),
    [filteredNotes, groupedNotes, query]
  );
  const visibleHostnames = useMemo(
    () => visibleGroups.map((group) => group.hostname),
    [visibleGroups]
  );
  const [expandedHostnames, setExpandedHostnames] = useState<Set<string>>(
    () => reconcileWorkspaceGroupExpansion(visibleHostnames, new Set())
  );
  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);

  useEffect(() => {
    setExpandedHostnames((current) => reconcileWorkspaceGroupExpansion(visibleHostnames, current));
  }, [visibleHostnames]);

  if (loading) {
    return (
      <WorkspaceEmptyState
        loading
        icon={<HugeIcon icon={StickyNote01Icon} className="h-5 w-5" />}
        title="Loading notes"
        description="Grouping every saved note by site."
      />
    );
  }

  if (error) {
    return (
      <WorkspaceEmptyState
        icon={<HugeIcon icon={StickyNote01Icon} className="h-5 w-5" />}
        title="Notes are unavailable"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-4">
      <label className="relative block">
        <HugeIcon icon={Search01Icon} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search all notes"
          className="h-[42px] w-full rounded-[14px] border border-border bg-card pl-10 pr-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
      </label>

      {visibleGroups.length === 0 ? (
        <WorkspaceEmptyState
          icon={<HugeIcon icon={StickyNote01Icon} className="h-5 w-5" />}
          title={query.trim() ? 'No notes match that search' : 'Your notes will appear here'}
          description={
            query.trim()
              ? 'Try another phrase or clear the search.'
              : 'Start by selecting an element on any page.'
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((group) => {
            const isExpanded = expandedHostnames.has(group.hostname);

            return (
              <section
                key={group.hostname}
                className="rounded-[18px] border border-border bg-muted p-3"
              >
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
                  className="flex w-full items-center justify-between gap-3 rounded-[14px] bg-card px-3 py-2 text-left"
                >
                  <HugeIcon
                    icon={isExpanded ? ArrowDown01Icon : ArrowRight01Icon}
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform"
                  />
                  <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                    {group.hostname}
                  </h3>
                  <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                    {group.count}
                  </span>
                </button>

                {isExpanded ? (
                  <div className="mt-3 space-y-2">
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
                          tagNames={tagResolver.resolveStoredTagLabels(note.tags)}
                          onOpen={onOpenNote}
                          onEdit={onEditNote}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
