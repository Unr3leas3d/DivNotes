import React, { useState, useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { buildFolderTree } from '@/lib/tree-utils';
import type { StoredFolder, FolderTreeNode } from '@/lib/types';
import { Folder, FolderPlus, Inbox, Check } from 'lucide-react';

interface FolderPickerProps {
  folders: StoredFolder[];
  currentFolderId?: string | null;
  onSelect: (folderId: string | null) => void;
  onCreateFolder?: (name: string, parentId: string | null) => void;
  trigger: React.ReactNode;
}

function FolderRow({
  node,
  depth,
  currentFolderId,
  onSelect,
}: {
  node: FolderTreeNode;
  depth: number;
  currentFolderId?: string | null;
  onSelect: (folderId: string | null) => void;
}) {
  const isActive = currentFolderId === node.folder.id;

  return (
    <>
      <button
        onClick={() => onSelect(node.folder.id)}
        className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md transition-colors hover:bg-accent ${
          isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <Folder className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate flex-1 text-left">{node.folder.name}</span>
        {isActive && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
      </button>
      {node.children.map((child) => (
        <FolderRow
          key={child.folder.id}
          node={child}
          depth={depth + 1}
          currentFolderId={currentFolderId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

export function FolderPicker({
  folders,
  currentFolderId,
  onSelect,
  onCreateFolder,
  trigger,
}: FolderPickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const tree = useMemo(() => buildFolderTree(folders, []), [folders]);

  const handleSelect = (folderId: string | null) => {
    onSelect(folderId);
    setOpen(false);
  };

  const handleCreate = () => {
    const name = newFolderName.trim();
    if (name && onCreateFolder) {
      onCreateFolder(name, null);
      setNewFolderName('');
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      setCreating(false);
      setNewFolderName('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-1.5" align="start">
        <div className="max-h-[200px] overflow-y-auto">
          {/* Inbox option */}
          <button
            onClick={() => handleSelect(null)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md transition-colors hover:bg-accent ${
              !currentFolderId ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground'
            }`}
          >
            <Inbox className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-left">Inbox</span>
            {!currentFolderId && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
          </button>

          {/* Folder tree */}
          {tree.map((node) => (
            <FolderRow
              key={node.folder.id}
              node={node}
              depth={0}
              currentFolderId={currentFolderId}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {/* New Folder */}
        {onCreateFolder && (
          <div className="border-t mt-1.5 pt-1.5">
            {creating ? (
              <div className="flex items-center gap-1 px-1">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    if (!newFolderName.trim()) {
                      setCreating(false);
                    }
                  }}
                  placeholder="Folder name..."
                  className="flex-1 h-7 text-xs px-2 rounded-md border border-input bg-transparent outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newFolderName.trim()}
                  className="h-7 px-2 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Folder</span>
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
