import React, { useMemo } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, FolderOpen, Hash, Pin } from 'lucide-react';

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
  interactionMode?: 'open' | 'toggle';
  expanded?: boolean;
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
  interactionMode = 'open',
  expanded = false,
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
    interactionMode === 'open' && onEdit ? (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(note);
          }}
          className="inline-flex items-center justify-center rounded-[10px] border border-[#e7e2d8] bg-white px-3 py-1.5 text-[11px] font-medium text-[#526357] transition-colors hover:bg-[#f8f6f1]"
        >
          Edit note
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(note);
          }}
          className="inline-flex items-center justify-center rounded-[10px] bg-[#173628] px-3 py-1.5 text-[11px] font-semibold text-[#f5efe9] transition-colors hover:bg-[#0f2d20]"
        >
          Go to note
        </button>
      </div>
    ) : undefined
  );

  return (
    <div
      className={cn(
        'w-full rounded-[16px] border border-[#e7e2d8] bg-white text-left shadow-[0_1px_2px_rgba(5,36,21,0.04)] transition-colors hover:bg-[#fbfaf6]',
        resolvedAction ? 'overflow-hidden' : undefined
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(note)}
        aria-expanded={interactionMode === 'toggle' ? expanded : undefined}
        aria-label={interactionMode === 'toggle' ? (expanded ? 'Collapse note details' : 'Expand note details') : 'Open note'}
        className={cn(
          'w-full text-left transition-colors hover:bg-[#fbfaf6]',
          density === 'compact' ? 'px-3 py-3' : 'px-3.5 py-3.5'
        )}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-[#f3f1eb] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#6e7c72]">
                {note.elementTag}
              </span>
              <span className="truncate text-[10px] text-[#88938c]">{note.hostname}</span>
              {note.pinned ? <Pin className="ml-auto h-3 w-3 text-[#6ead71]" /> : null}
            </div>

            {title ? (
              <>
                <h3 className="mt-2 text-[13px] font-semibold leading-[1.35] text-[#173628]">{title}</h3>
                <p
                  className={cn(
                    'mt-1 text-[#5f6d63]',
                    density === 'compact'
                      ? 'line-clamp-2 text-[12px] leading-[1.45]'
                      : 'line-clamp-3 text-[12px] leading-[1.55]'
                  )}
                >
                  {resolvedPreview || 'Open the note to read more.'}
                </p>
              </>
            ) : (
              <p
                className={cn(
                  'mt-2 text-[#1f3528]',
                  density === 'compact'
                    ? 'line-clamp-2 text-[12px] leading-[1.45]'
                    : 'line-clamp-3 text-[12.5px] leading-[1.55]'
                )}
              >
                {resolvedPreview || 'Untitled note'}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#8b968e]">
              <span className="truncate">{note.pageTitle || note.hostname}</span>
              {folderName ? (
                <span className="inline-flex items-center gap-1 truncate">
                  <FolderOpen className="h-3 w-3" />
                  {folderName}
                </span>
              ) : null}
              {visibleTags.map((tagName) => (
                <span key={tagName} className="inline-flex items-center gap-1 truncate">
                  <Hash className="h-3 w-3" />
                  {tagName}
                </span>
              ))}
              {overflowTagCount > 0 ? <span>+{overflowTagCount} more</span> : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 text-[#95a097]">
            {interactionMode === 'toggle' ? (
              expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            <span className="text-[10px]">{formatTimestamp(note.createdAt)}</span>
          </div>
        </div>
      </button>
      {details ? <div className="border-t border-[#f0ece4] px-3.5 py-3">{details}</div> : null}
      {resolvedAction ? <div className="border-t border-[#f0ece4] px-3.5 py-2.5">{resolvedAction}</div> : null}
    </div>
  );
}
