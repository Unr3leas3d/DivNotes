import React, { useState } from 'react';
import { Star, ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NoteCard } from './NoteCard';
import type { StoredNote, StoredFolder, StoredTag } from '@/lib/types';

interface PinnedSectionProps {
  pinnedNotes: StoredNote[];
  pinnedFolders?: StoredFolder[];
  tags: StoredTag[];
  onNoteClick?: (note: StoredNote) => void;
  onEditNote?: (note: StoredNote) => void;
  onFolderClick?: (folderId: string) => void;
  onDeleteNote?: (noteId: string) => void;
  onTogglePin?: (noteId: string) => void;
}

export function PinnedSection({
  pinnedNotes,
  pinnedFolders = [],
  tags,
  onNoteClick,
  onEditNote,
  onFolderClick,
  onDeleteNote,
  onTogglePin,
}: PinnedSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const hasPinnedItems = pinnedNotes.length > 0 || pinnedFolders.length > 0;

  if (!hasPinnedItems) return null;

  return (
    <div className="mb-3">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-1.5 w-full px-1 py-1 text-[10px] font-semibold text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
        Pinned
        <span className="text-[9px] font-normal text-muted-foreground/50 ml-auto">
          {pinnedFolders.length + pinnedNotes.length}
        </span>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="mt-1 space-y-1.5">
          {/* Pinned folders */}
          {pinnedFolders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onFolderClick?.(folder.id)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] text-foreground/80 hover:bg-muted/50 transition-colors"
            >
              <Folder
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: folder.color || undefined }}
              />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}

          {/* Pinned notes */}
          {pinnedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              tags={tags}
              onDelete={onDeleteNote || (() => {})}
              onNavigate={onNoteClick || (() => {})}
              onEdit={onEditNote}
              onTogglePin={onTogglePin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
