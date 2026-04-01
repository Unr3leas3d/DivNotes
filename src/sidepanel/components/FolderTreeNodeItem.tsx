import React, { DragEvent } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderPlus, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NoteCard } from './NoteCard';
import { FolderContextMenu } from './ContextMenu';
import { countNotesInTree } from '@/lib/tree-utils';
import type { FolderTreeNode, StoredTag, StoredNote } from '@/lib/types';

interface FolderTreeNodeItemProps {
  node: FolderTreeNode;
  depth: number;
  tags: StoredTag[];
  expandedFolders: Set<string>;
  focusedId?: string | null;
  onToggleExpand: (folderId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onNavigateNote: (note: StoredNote) => void;
  onEditNote: (note: StoredNote) => void;
  onToggleNotePin?: (noteId: string) => void;
  onNewSubfolder?: (parentId: string) => void;
  onRenameFolder?: (folderId: string) => void;
  onChangeColor?: (folderId: string) => void;
  onToggleFolderPin?: (folderId: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  selectedNoteIds?: Set<string>;
  onNoteSelectClick?: (noteId: string, meta: { shift?: boolean; cmd?: boolean }) => void;
  // Drag and drop
  dropTargetId?: string | null;
  dropPosition?: 'before' | 'into' | 'after';
  dragItem?: { type: 'note' | 'folder'; id: string } | null;
  onDragStart?: (e: DragEvent, type: 'note' | 'folder', id: string) => void;
  onDragEnd?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent, targetFolderId: string | null) => void;
  onDragLeave?: () => void;
  onDrop?: (e: DragEvent, targetFolderId: string | null) => void;
}

export function FolderTreeNodeItem({
  node,
  depth,
  tags,
  expandedFolders,
  focusedId,
  onToggleExpand,
  onDeleteNote,
  onNavigateNote,
  onEditNote,
  onToggleNotePin,
  onNewSubfolder,
  onRenameFolder,
  onChangeColor,
  onToggleFolderPin,
  onDeleteFolder,
  selectedNoteIds,
  onNoteSelectClick,
  dropTargetId,
  dropPosition,
  dragItem,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderTreeNodeItemProps) {
  const isExpanded = expandedFolders.has(node.folder.id);
  const hasContent = node.children.length > 0 || node.notes.length > 0;
  const noteCount = countNotesInTree(node);
  const indent = Math.min(depth, 6) * 16 + 8;
  const isFocused = focusedId === node.folder.id;
  const isDropTarget = dropTargetId === node.folder.id;
  const isBeforeDropTarget = isDropTarget && dragItem?.type === 'folder' && dropPosition === 'before';
  const isIntoDropTarget = isDropTarget && dropPosition === 'into';
  const isAfterDropTarget = isDropTarget && dragItem?.type === 'folder' && dropPosition === 'after';

  return (
    <div>
      {/* Folder row */}
      <div
        className={cn(
          "group rounded-[14px] overflow-hidden transition-colors",
          isIntoDropTarget && "bg-primary/5 ring-1 ring-primary/25",
          isBeforeDropTarget && "shadow-[inset_0_2px_0_0_hsl(var(--primary))]",
          isAfterDropTarget && "shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
        )}
        style={{ paddingLeft: `${indent}px` }}
        draggable
        onDragStart={(e) => onDragStart?.(e, 'folder', node.folder.id)}
        onDragEnd={(e) => onDragEnd?.(e)}
        onDragOver={(e) => onDragOver?.(e, node.folder.id)}
        onDragLeave={() => onDragLeave?.()}
        onDrop={(e) => onDrop?.(e, node.folder.id)}
      >
        <div className="flex w-full items-center gap-1 pr-1">
          <button
            onClick={() => onToggleExpand(node.folder.id)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-[14px] px-2 py-1.5 text-left transition-colors hover:bg-muted/50",
              isFocused && "bg-muted/30 ring-2 ring-primary/50"
            )}
          >
            {/* Chevron */}
            {hasContent ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="h-3.5 w-3.5 shrink-0" />
            )}

            {/* Folder icon */}
            <Folder
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: node.folder.color || undefined }}
            />

            {/* Folder name */}
            <span className="flex-1 truncate text-sm font-medium">
              {node.folder.name}
            </span>

            {/* Note count badge */}
            {noteCount > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {noteCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#526357] transition-colors hover:bg-muted"
            onClick={(event) => {
              event.stopPropagation();
              onNewSubfolder?.(node.folder.id);
            }}
            aria-label="Add subfolder"
            title="Add subfolder"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>

          {/* More button with context menu */}
          <FolderContextMenu
            folder={node.folder}
            onNewSubfolder={() => onNewSubfolder?.(node.folder.id)}
            onRename={() => onRenameFolder?.(node.folder.id)}
            onChangeColor={() => onChangeColor?.(node.folder.id)}
            onTogglePin={() => onToggleFolderPin?.(node.folder.id)}
            onDelete={() => onDeleteFolder?.(node.folder.id)}
          >
            <button
              className="shrink-0 rounded-[10px] p-1 transition-colors hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </FolderContextMenu>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && hasContent && (
        <div>
          {/* Child folders */}
          {node.children.map((child) => (
            <FolderTreeNodeItem
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              tags={tags}
              expandedFolders={expandedFolders}
              focusedId={focusedId}
              onToggleExpand={onToggleExpand}
              onDeleteNote={onDeleteNote}
              onNavigateNote={onNavigateNote}
              onEditNote={onEditNote}
              onToggleNotePin={onToggleNotePin}
              onNewSubfolder={onNewSubfolder}
              onRenameFolder={onRenameFolder}
              onChangeColor={onChangeColor}
              onToggleFolderPin={onToggleFolderPin}
              onDeleteFolder={onDeleteFolder}
              selectedNoteIds={selectedNoteIds}
              onNoteSelectClick={onNoteSelectClick}
              dropTargetId={dropTargetId}
              dropPosition={dropPosition}
              dragItem={dragItem}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}

          {/* Notes in this folder */}
          {node.notes.length > 0 && (
            <div
              className="space-y-1.5 py-1"
              style={{ paddingLeft: `${Math.min(depth + 1, 6) * 16 + 8}px`, paddingRight: '8px' }}
            >
              {node.notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  tags={tags}
                  onDelete={onDeleteNote}
                  onNavigate={onNavigateNote}
                  onEdit={onEditNote}
                  onTogglePin={onToggleNotePin}
                  selected={selectedNoteIds?.has(note.id)}
                  onSelectClick={onNoteSelectClick}
                  draggable
                  onDragStart={(e) => onDragStart?.(e, 'note', note.id)}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
