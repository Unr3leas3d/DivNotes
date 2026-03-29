import React, { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ChevronDown, ChevronRight, Pin, Trash2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { StoredNote, StoredTag } from '@/lib/types';
import { TagPill } from './TagPill';

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

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  const visibleTags = resolvedTags.slice(0, 3);
  const overflowCount = resolvedTags.length - visibleTags.length;
  const dateLabel = useMemo(() => formatTimestamp(note.createdAt), [note.createdAt]);

  return (
    <Card
      className={cn(
        'overflow-hidden border-[#e7e2d8] bg-white shadow-[0_1px_2px_rgba(5,36,21,0.04)] transition-all hover:bg-[#fbfaf6]',
        expanded ? 'ring-1 ring-[#173628]/15' : undefined,
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
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="w-full px-4 py-4 text-left transition-colors hover:bg-[#fbfaf6]"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-[#f3f1eb] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[#6e7c72]">
                  {note.elementTag}
                </span>
                <span className="truncate text-[10px] text-[#88938c]">{note.hostname}</span>
                {note.pinned ? <Pin className="ml-auto h-3 w-3 fill-current text-[#6ead71]" /> : null}
              </div>

              {showFolderPath && folderPath ? (
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-[#8b968e]">
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">{folderPath}</span>
                </div>
              ) : null}

              <h3 className="mt-2 text-[13px] font-semibold leading-[1.35] text-[#173628]">{title}</h3>
              <p className="mt-1 line-clamp-2 text-[12px] leading-[1.55] text-[#5f6d63]">
                {preview || 'Open the note to read more.'}
              </p>

              {resolvedTags.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {visibleTags.map((tag) => (
                    <TagPill key={tag.id} tag={tag} size="sm" />
                  ))}
                  {overflowCount > 0 ? (
                    <span className="text-[10px] font-medium text-[#8b968e]">+{overflowCount}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col items-end gap-2 text-[#95a097]">
              <span className="text-[10px]">{dateLabel}</span>
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </div>
        </button>

        {expanded ? (
          <>
            <Separator className="bg-[#f0ece4]" />
            <div className="px-4 py-4">
              <div
                className="prose prose-sm max-w-none text-[12px] leading-[1.65] text-[#314339] prose-headings:text-[#173628] prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-a:text-[#173628] prose-strong:text-[#173628] prose-code:text-[#173628] prose-pre:bg-[#f8f6f1]"
                dangerouslySetInnerHTML={{ __html: renderedContent }}
              />
            </div>
            <Separator className="bg-[#f0ece4]" />
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
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
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
