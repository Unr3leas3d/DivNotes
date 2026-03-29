import React, { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Pin, Trash2 } from 'lucide-react';

import { WorkspaceNoteCard } from '@/components/workspace/WorkspaceNoteCard';
import { cn } from '@/lib/utils';
import type { StoredNote, StoredTag } from '@/lib/types';

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

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[#*_~>\-[\]()!]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveTitle(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^#{1,6}\s+/, '').trim())
    .filter(Boolean);

  const firstMeaningfulLine = lines.find((line) => line.replace(/[*_`~]/g, '').trim().length > 0);
  if (!firstMeaningfulLine) {
    return 'Untitled note';
  }

  return firstMeaningfulLine.length > 72
    ? `${firstMeaningfulLine.slice(0, 72).trimEnd()}...`
    : firstMeaningfulLine;
}

function derivePreview(text: string, title: string): string {
  const plainText = stripMarkdown(text);
  const withoutTitle = plainText.startsWith(title) ? plainText.slice(title.length).trim() : plainText;
  const source = withoutTitle || plainText;

  if (source.length <= 180) {
    return source;
  }

  return `${source.slice(0, 180).trimEnd()}...`;
}

function renderMarkdown(text: string): string {
  try {
    const rawHtml = marked.parse(text, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'a',
        'b',
        'blockquote',
        'br',
        'code',
        'div',
        'em',
        'h1',
        'h2',
        'h3',
        'h4',
        'li',
        'ol',
        'p',
        'pre',
        'span',
        'strong',
        'ul',
      ],
      ALLOWED_ATTR: ['class', 'href', 'rel', 'target'],
    });
  } catch {
    return DOMPurify.sanitize(text);
  }
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
  const [expanded, setExpanded] = useState(false);

  const resolvedTags = useMemo(() => {
    if (note.tags.length === 0) {
      return [];
    }

    return note.tags
      .map((tagId) => tags.find((tag) => tag.id === tagId))
      .filter((tag): tag is StoredTag => Boolean(tag));
  }, [note.tags, tags]);

  const title = useMemo(() => deriveTitle(note.content), [note.content]);
  const preview = useMemo(() => derivePreview(note.content, title), [note.content, title]);
  const renderedContent = useMemo(() => (expanded ? renderMarkdown(note.content) : ''), [expanded, note.content]);
  const tagNames = useMemo(() => resolvedTags.map((tag) => tag.name), [resolvedTags]);

  return (
    <div
      className={cn(
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
        title={title}
        preview={preview}
        folderName={showFolderPath ? folderPath || null : null}
        tagNames={tagNames}
        onOpen={() => setExpanded((current) => !current)}
        details={
          expanded ? (
            <div
              className="prose prose-sm max-w-none text-[12px] leading-[1.65] text-[#314339] prose-headings:text-[#173628] prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-a:text-[#173628] prose-strong:text-[#173628] prose-code:text-[#173628] prose-pre:bg-[#f8f6f1]"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          ) : undefined
        }
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
