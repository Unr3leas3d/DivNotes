import React, { useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ExternalLink, Star, Trash2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TagPill } from './TagPill';
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
}

function stripMarkdown(text: string): string {
  return text
    .replace(/[#*_~`>\-\[\]()!]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function renderMarkdown(text: string): string {
  try {
    const rawHtml = marked.parse(text, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'code', 'pre', 'br', 'span', 'div', 'blockquote'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
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
  selected,
  onSelectClick,
}: NoteCardProps) {
  const [expanded, setExpanded] = useState(false);

  const resolvedTags = useMemo(() => {
    if (!note.tags || note.tags.length === 0) return [];
    return note.tags
      .map((tagId) => tags.find((t) => t.id === tagId))
      .filter((t): t is StoredTag => t !== undefined);
  }, [note.tags, tags]);

  const visibleTags = resolvedTags.slice(0, 2);
  const overflowCount = resolvedTags.length - 2;

  const preview = useMemo(() => {
    const stripped = stripMarkdown(note.content);
    return stripped.length > 120 ? stripped.slice(0, 120) + '...' : stripped;
  }, [note.content]);

  const renderedContent = useMemo(() => {
    if (!expanded) return '';
    return renderMarkdown(note.content);
  }, [expanded, note.content]);

  const dateStr = useMemo(() => {
    const d = new Date(note.createdAt);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }, [note.createdAt]);

  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all hover:shadow-md border-border/50',
        expanded && 'ring-1 ring-primary/20',
        selected && 'ring-2 ring-primary bg-primary/5',
      )}
      onClick={(e: React.MouseEvent) => {
        if (onSelectClick && (e.metaKey || e.ctrlKey || e.shiftKey)) {
          e.stopPropagation();
          onSelectClick(note.id, { shift: e.shiftKey, cmd: e.metaKey || e.ctrlKey });
          return;
        }
        setExpanded(!expanded);
      }}
    >
      <CardContent className="p-3">
        {/* Header row: element tag + date + pin indicator */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
            {'<' + note.elementTag + '>'}
          </span>
          {note.pinned && (
            <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
          )}
          <span className="ml-auto text-[9px] text-muted-foreground/60">
            {dateStr}
          </span>
        </div>

        {/* Folder path breadcrumb */}
        {showFolderPath && folderPath && (
          <div className="flex items-center gap-0.5 mb-1.5 text-[9px] text-muted-foreground/50">
            <ChevronRight className="w-2.5 h-2.5" />
            <span className="truncate">{folderPath}</span>
          </div>
        )}

        {/* Content preview */}
        <p className="text-[11px] text-foreground/80 line-clamp-2 leading-relaxed mb-2">
          {preview}
        </p>

        {/* Tag pills */}
        {resolvedTags.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {visibleTags.map((tag) => (
              <TagPill key={tag.id} tag={tag} size="sm" />
            ))}
            {overflowCount > 0 && (
              <span className="text-[8px] text-muted-foreground/60 font-medium">
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        {/* Expanded content */}
        {expanded && (
          <>
            <Separator className="my-2" />
            <div
              className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-[11px] leading-relaxed [&_p]:mb-1.5 [&_ul]:mb-1.5 [&_ol]:mb-1.5 [&_pre]:text-[10px] [&_code]:text-[10px]"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
            <Separator className="my-2" />
            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate(note); }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Go to note
              </button>
              {onTogglePin && (
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePin(note.id); }}
                  className={cn(
                    'flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors',
                    note.pinned
                      ? 'text-yellow-500 hover:bg-yellow-500/10'
                      : 'text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10',
                  )}
                >
                  <Star className={cn('w-3 h-3', note.pinned && 'fill-current')} />
                  {note.pinned ? 'Unpin' : 'Pin'}
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors ml-auto"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
