import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';

import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import { WorkspaceNoteCard } from '@/components/workspace/WorkspaceNoteCard';
import { createTagResolver } from '@/lib/extension-selectors';
import type { CurrentPageState } from '@/lib/extension-workspace-types';
import type { StoredNote, StoredTag } from '@/lib/types';

interface ThisPageViewProps {
  currentPage: CurrentPageState;
  notes: StoredNote[];
  loading: boolean;
  error: string | null;
  tagsById: Map<string, StoredTag>;
  onAddNote: () => void;
  onOpenNote: (note: StoredNote) => void;
  onEditNote: (note: StoredNote) => void;
}

export function ThisPageView({
  currentPage,
  notes,
  loading,
  error,
  tagsById,
  onAddNote,
  onOpenNote,
  onEditNote,
}: ThisPageViewProps) {
  const tags = useMemo(() => [...tagsById.values()], [tagsById]);
  const tagResolver = useMemo(() => createTagResolver(tags), [tags]);

  if (loading) {
    return (
      <WorkspaceEmptyState
        loading
        icon={<FileText className="h-5 w-5" />}
        title="Checking this page"
        description="Pulling the current tab and its note summary."
      />
    );
  }

  if (error) {
    return (
      <WorkspaceEmptyState
        icon={<FileText className="h-5 w-5" />}
        title="This page is unavailable"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-[#ece7de] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(5,36,21,0.04)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa294]">This Page</p>
        <h2 className="mt-2 text-[15px] font-semibold leading-[1.35] text-[#173628]">
          {currentPage.title || currentPage.hostname || 'Untitled page'}
        </h2>
        <p className="mt-1 text-[11px] text-[#8c978f]">
          {currentPage.hostname || 'Canopy can add notes when a regular page is open.'}
        </p>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9aa294]">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'} on this page
        </p>
        <button
          type="button"
          onClick={onAddNote}
          className="mt-4 flex h-[46px] w-full items-center justify-center rounded-[14px] bg-[#173628] text-[14px] font-semibold text-[#f5efe9] transition-colors hover:bg-[#0f2d20]"
        >
          + Add Note
        </button>
      </div>

      {notes.length > 0 ? (
        <div className="space-y-2.5">
          {notes.map((note) => (
            <WorkspaceNoteCard
              key={note.id}
              note={note}
              onOpen={onOpenNote}
              onEdit={onEditNote}
              tagNames={tagResolver.resolveStoredTagLabels(note.tags)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
