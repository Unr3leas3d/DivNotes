import React, { useMemo } from 'react';
import {
  FolderOpenIcon,
  HashtagIcon,
  LinkSquare02Icon,
  MapPinIcon,
} from '@hugeicons/core-free-icons';

import { HugeIcon } from '@/components/ui/huge-icon';
import type { StoredNote } from '@/lib/types';
import { cn } from '@/lib/utils';

type CardDensity = 'compact' | 'comfortable';

interface WorkspaceNoteCardProps {
  note: StoredNote;
  density?: CardDensity;
  title?: string | null;
  preview?: string | null;
  folderName?: string | null;
  tagNames?: string[];
  onOpen: (note: StoredNote) => void;
  onEdit?: (note: StoredNote) => void;
  details?: React.ReactNode;
  action?: React.ReactNode;
}

function stripMarkdown(text: string) {
  return text.replace(/[#*_~`>\-\[\]()!]/g, '').replace(/\s+/g, ' ').trim();
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function WorkspaceNoteCard({
  note,
  density = 'comfortable',
  title,
  preview,
  folderName,
  tagNames = [],
  onOpen,
  onEdit,
  details,
  action,
}: WorkspaceNoteCardProps) {
  const derivedPreview = useMemo(() => {
    const flattened = stripMarkdown(note.content);
    const limit = density === 'compact' ? 96 : 148;

    if (flattened.length <= limit) {
      return flattened;
    }

    return `${flattened.slice(0, limit).trimEnd()}...`;
  }, [density, note.content]);

  const resolvedPreview = preview ?? derivedPreview;
  const visibleTags = tagNames.slice(0, density === 'compact' ? 1 : 2);
  const overflowTagCount = tagNames.length - visibleTags.length;
  const resolvedAction = action ?? (
    onEdit ? (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(note);
          }}
          className="inline-flex items-center justify-center rounded-[10px] border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          Edit note
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(note);
          }}
          className="inline-flex items-center justify-center rounded-[10px] bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
        >
          Go to note
        </button>
      </div>
    ) : undefined
  );

  return (
    <div
      className={cn(
        'w-full rounded-[16px] border border-border bg-card text-left shadow-card transition-colors',
        resolvedAction ? 'overflow-hidden' : undefined
      )}
    >
      <div
        className={cn(
          density === 'compact' ? 'px-3 py-3' : 'px-3.5 py-3.5'
        )}
      >
        {/* Row 1: Tag pill + hostname + link icon */}
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            {note.elementTag}
          </span>
          <span className="truncate text-[10px] text-muted-foreground">{note.hostname}</span>
          {note.pinned ? (
            <HugeIcon icon={MapPinIcon} className="ml-auto h-3 w-3 text-primary" />
          ) : (
            <HugeIcon icon={LinkSquare02Icon} className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        {/* Row 2: Title + date */}
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-[13px] font-semibold leading-[1.35] text-foreground">
            {title || resolvedPreview || 'Untitled note'}
          </h3>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatTimestamp(note.createdAt)}
          </span>
        </div>

        {/* Row 3: Page title */}
        <p className="mt-1 truncate text-[12px] leading-[1.45] text-muted-foreground">
          {note.pageTitle || note.hostname}
        </p>

        {/* Row 4: Folders & tags */}
        {(folderName || visibleTags.length > 0) ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
            {folderName ? (
              <span className="inline-flex items-center gap-1 truncate">
                <HugeIcon icon={FolderOpenIcon} className="h-3 w-3" />
                {folderName}
              </span>
            ) : null}
            {visibleTags.map((tagName) => (
              <span key={tagName} className="inline-flex items-center gap-1 truncate">
                <HugeIcon icon={HashtagIcon} className="h-3 w-3" />
                {tagName}
              </span>
            ))}
            {overflowTagCount > 0 ? <span>+{overflowTagCount} more</span> : null}
          </div>
        ) : null}
      </div>
      {details ? <div className="border-t border-border px-3.5 py-3">{details}</div> : null}
      {resolvedAction ? <div className="border-t border-border px-3.5 py-2.5">{resolvedAction}</div> : null}
    </div>
  );
}
