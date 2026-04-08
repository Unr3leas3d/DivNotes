import React, { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Pin, Trash2 } from '@/lib/icon-aliases';

import { WorkspaceNoteCard } from '@/components/workspace/WorkspaceNoteCard';
import { createTagResolver } from '@/lib/extension-selectors';
import { cn } from '@/lib/utils';
import type { StoredNote, StoredTag } from '@/lib/types';

interface NoteCardProps {
  note: StoredNote;
  tags: StoredTag[];
  onDelete: (noteId: string) => void;
  onNavigate: (note: StoredNote) => void;
  onEdit?: (note: StoredNote) => void;
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
  onEdit,
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
  const tagResolver = useMemo(() => createTagResolver(tags), [tags]);

  const title = useMemo(() => deriveTitle(note.content), [note.content]);
  const preview = useMemo(() => derivePreview(note.content, title), [note.content, title]);
  const renderedContent = useMemo(() => (expanded ? renderMarkdown(note.content) : ''), [expanded, note.content]);
  const tagNames = useMemo(
    () => tagResolver.resolveStoredTagLabels(note.tags),
    [note.tags, tagResolver]
  );

  return (
    <div
      className={cn(
        selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : undefined
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
        interactionMode="toggle"
        expanded={expanded}
        details={
          expanded ? (
            <div
              className="prose prose-sm max-w-none text-[12px] leading-[1.65] text-foreground prose-headings:text-foreground prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-a:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          ) : undefined
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {onEdit ? (
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
            ) : null}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onNavigate(note);
              }}
              className="inline-flex items-center justify-center rounded-[10px] bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              Go to note
            </button>
            {onTogglePin ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePin(note.id);
                }}
                className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-secondary px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/80"
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
              className="ml-auto inline-flex items-center gap-1 rounded-[10px] border border-destructive/20 bg-destructive/5 px-3 py-1.5 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/10"
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
