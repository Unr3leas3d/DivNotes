import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FolderPlus, StickyNote, Pencil, Palette, Star,
  Trash2, ExternalLink, Folder, Tag, Copy, MoreVertical,
} from 'lucide-react';
import type { StoredFolder, StoredNote } from '@/lib/types';

interface FolderContextMenuProps {
  folder: StoredFolder;
  onNewSubfolder: () => void;
  onNewNote?: () => void;
  onRename: () => void;
  onChangeColor: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export function FolderContextMenu({
  folder, onNewSubfolder, onNewNote, onRename, onChangeColor, onTogglePin, onDelete, children
}: FolderContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuItem onClick={onNewSubfolder}>
          <FolderPlus className="w-3.5 h-3.5 mr-2" /> New Subfolder
        </DropdownMenuItem>
        {onNewNote && (
          <DropdownMenuItem onClick={onNewNote}>
            <StickyNote className="w-3.5 h-3.5 mr-2" /> New Note
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onChangeColor}>
          <Palette className="w-3.5 h-3.5 mr-2" /> Change Color
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onTogglePin}>
          <Star className="w-3.5 h-3.5 mr-2" /> {folder.pinned ? 'Unpin' : 'Pin to Top'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface NoteContextMenuProps {
  note: StoredNote;
  onOpenOnPage: () => void;
  onEdit?: () => void;
  onMoveToFolder: () => void;
  onAddTags: () => void;
  onTogglePin: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

export function NoteContextMenu({
  note, onOpenOnPage, onEdit, onMoveToFolder, onAddTags, onTogglePin, onDuplicate, onDelete, children
}: NoteContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuItem onClick={onOpenOnPage}>
          <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open on Page
        </DropdownMenuItem>
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Note
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onMoveToFolder}>
          <Folder className="w-3.5 h-3.5 mr-2" /> Move to Folder...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddTags}>
          <Tag className="w-3.5 h-3.5 mr-2" /> Add Tags...
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onTogglePin}>
          <Star className="w-3.5 h-3.5 mr-2" /> {note.pinned ? 'Unpin' : 'Pin to Top'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Note
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
