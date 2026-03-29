import React, { useMemo } from 'react';
import { Pin, Trash2 } from 'lucide-react';

import { WorkspaceNoteCard } from '@/components/workspace/WorkspaceNoteCard';
import type { StoredNote, StoredTag } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NoteCardProps {
  note: StoredNote;
  tags: StoredTag[];
  onDelete: (noteId: string) => void;
  onNavigate: (note: StoredNote) => void;
  onTogglePin?: (noteId: string) => void;
  showFolderPath?: boolean;
  folderPath?: string;
  selected?: boolean;
  onSelectClick?: (noteId: string, meta: { shift?: boolean; cmd?: boolean }) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function NoteCard({
  note,
  tags,
  onDelete,
  onNavigate,
  onTogglePin,
  showFolderPath,
  folderPath,
  selected = false,
  onSelectClick,
  draggable = false,
  onDragStart,
  onDragEnd,
}: NoteCardProps) {
  const tagNames = useMemo(
    () =>
      note.tags
        .map((tagId) => tags.find((tag) => tag.id === tagId)?.name)
        .filter(Boolean) as string[],
    [note.tags, tags]
  );

  return (
    <div
      className={cn(
        'rounded-[16px] transition-shadow',
        selected ? 'ring-2 ring-[#173628] ring-offset-2 ring-offset-[#fcfbf7]' : undefined
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClickCapture={(event) => {
        if (!onSelectClick || (!event.metaKey && !event.ctrlKey && !event.shiftKey)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onSelectClick(note.id, {
          shift: event.shiftKey,
          cmd: event.metaKey || event.ctrlKey,
        });
      }}
    >
      <WorkspaceNoteCard
        note={note}
        density="comfortable"
        folderName={showFolderPath ? folderPath || null : null}
        tagNames={tagNames}
        onOpen={onNavigate}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onNavigate(note);
              }}
              className="inline-flex items-center justify-center rounded-[10px] bg-[#173628] px-3 py-1.5 text-[11px] font-semibold text-[#f5efe9] transition-colors hover:bg-[#0f2d20]"
            >
              Scroll to element
            </button>
            {onTogglePin ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePin(note.id);
                }}
                className="inline-flex items-center gap-1 rounded-[10px] border border-[#e7e2d8] bg-[#f8f6f1] px-3 py-1.5 text-[11px] font-medium text-[#526357] transition-colors hover:bg-[#f1eee7]"
              >
                <Pin className={cn('h-3.5 w-3.5', note.pinned ? 'fill-current' : undefined)} />
                {note.pinned ? 'Unpin' : 'Pin'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(note.id);
              }}
              className="ml-auto inline-flex items-center gap-1 rounded-[10px] border border-[rgba(220,38,38,0.14)] bg-[rgba(254,242,242,0.7)] px-3 py-1.5 text-[11px] font-medium text-[#b91c1c] transition-colors hover:bg-[rgba(254,226,226,0.92)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        }
      />
    </div>
  );
}
