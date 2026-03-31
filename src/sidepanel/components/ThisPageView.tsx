import React from 'react';
import { FilePlus2, MapPinned } from 'lucide-react';

import { WorkspaceEmptyState } from '@/components/workspace/WorkspaceEmptyState';
import type { CurrentPageState } from '@/lib/extension-workspace-types';
import type { StoredNote, StoredTag } from '@/lib/types';
import { NoteCard } from './NoteCard';

interface ThisPageViewProps {
  currentPage: CurrentPageState;
  notes: StoredNote[];
  tags: StoredTag[];
  loading: boolean;
  error: string | null;
  onAddNote: () => void;
  onOpenNote: (note: StoredNote) => void;
  onDeleteNote: (noteId: string) => void;
}

export function ThisPageView({
  currentPage,
  notes,
  tags,
  loading,
  error,
  onAddNote,
  onOpenNote,
  onDeleteNote,
}: ThisPageViewProps) {
  if (loading) {
    return (
      <WorkspaceEmptyState
        loading
        icon={<MapPinned className="h-5 w-5" />}
        title="Checking this page"
        description="Pulling the current tab and its saved anchors."
      />
    );
  }

  if (error) {
    return (
      <WorkspaceEmptyState
        icon={<MapPinned className="h-5 w-5" />}
        title="This page is unavailable"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-[#ece7de] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(5,36,21,0.04)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa294]">This Page</p>
        <h2 className="mt-2 text-[18px] font-semibold leading-[1.3] text-[#173628]">
          {currentPage.title || currentPage.hostname || 'Untitled page'}
        </h2>
        <p className="mt-1 text-[12px] text-[#8c978f]">
          {currentPage.hostname || 'Open a regular page to save and revisit anchored notes.'}
        </p>
        <div className="mt-4 flex items-center justify-between rounded-[16px] bg-[#f8f6f1] px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9aa294]">Anchors on this page</p>
            <p className="mt-1 text-[22px] font-semibold text-[#173628]">{notes.length}</p>
          </div>
          <button
            type="button"
            onClick={onAddNote}
            className="flex h-[46px] items-center justify-center rounded-[14px] bg-[#173628] px-5 text-[14px] font-semibold text-[#f5efe9] transition-colors hover:bg-[#0f2d20]"
          >
            + Add Note
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <WorkspaceEmptyState
          icon={<FilePlus2 className="h-5 w-5" />}
          title="No notes on this page yet"
          description="Select an element and attach the first note for this page."
          action={
            <button
              type="button"
              onClick={onAddNote}
              className="rounded-[12px] bg-[#173628] px-4 py-2 text-[12px] font-semibold text-[#f5efe9] transition-colors hover:bg-[#0f2d20]"
            >
              + Add Note
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              tags={tags}
              onDelete={onDeleteNote}
              onNavigate={onOpenNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
