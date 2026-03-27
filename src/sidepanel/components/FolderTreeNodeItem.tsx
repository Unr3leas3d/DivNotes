import React from 'react';
import { ChevronDown, ChevronRight, Folder, MoreVertical } from 'lucide-react';
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
  onToggleNotePin?: (noteId: string) => void;
  onNewSubfolder?: (parentId: string) => void;
  onRenameFolder?: (folderId: string) => void;
  onChangeColor?: (folderId: string) => void;
  onToggleFolderPin?: (folderId: string) => void;
  onDeleteFolder?: (folderId: string) => void;
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
  onToggleNotePin,
  onNewSubfolder,
  onRenameFolder,
  onChangeColor,
  onToggleFolderPin,
  onDeleteFolder,
}: FolderTreeNodeItemProps) {
  const isExpanded = expandedFolders.has(node.folder.id);
  const hasContent = node.children.length > 0 || node.notes.length > 0;
  const noteCount = countNotesInTree(node);
  const indent = Math.min(depth, 6) * 16 + 8;
  const isFocused = focusedId === node.folder.id;

  return (
    <div>
      {/* Folder row */}
      <div
        className="flex items-center group"
        style={{ paddingLeft: `${indent}px`, paddingRight: '8px' }}
      >
        <button
          onClick={() => onToggleExpand(node.folder.id)}
          className={cn(
            "flex-1 flex items-center gap-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left min-w-0",
            isFocused && "ring-2 ring-primary/50 bg-muted/30"
          )}
        >
          {/* Chevron */}
          {hasContent ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )
          ) : (
            <span className="w-3.5 h-3.5 shrink-0" />
          )}

          {/* Folder icon */}
          <Folder
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: node.folder.color || undefined }}
          />

          {/* Folder name */}
          <span className="text-sm font-medium flex-1 truncate">
            {node.folder.name}
          </span>

          {/* Note count badge */}
          {noteCount > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {noteCount}
            </span>
          )}
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
            className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </FolderContextMenu>
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
              onToggleNotePin={onToggleNotePin}
              onNewSubfolder={onNewSubfolder}
              onRenameFolder={onRenameFolder}
              onChangeColor={onChangeColor}
              onToggleFolderPin={onToggleFolderPin}
              onDeleteFolder={onDeleteFolder}
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
                  onTogglePin={onToggleNotePin}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
