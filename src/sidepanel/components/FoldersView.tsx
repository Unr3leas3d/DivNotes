import React, { useState, useMemo, useCallback, useRef } from 'react';
import { FolderPlus, Inbox, ChevronDown, ChevronRight, Search, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PinnedSection } from './PinnedSection';
import { FolderTreeNodeItem } from './FolderTreeNodeItem';
import { NoteCard } from './NoteCard';
import { buildFolderTree, getUnfiledNotes, countNotesInTree } from '@/lib/tree-utils';
import { getNextOrder } from '@/lib/tag-utils';
import { getFoldersService } from '@/lib/folders-service';
import { getNotesService } from '@/lib/notes-service';
import { useTreeKeyboard } from '../hooks/useTreeKeyboard';
import type { StoredNote, StoredFolder, StoredTag, FolderTreeNode } from '@/lib/types';
import { TAG_COLORS } from '@/lib/types';

interface FoldersViewProps {
  notes: StoredNote[];
  folders: StoredFolder[];
  tags: StoredTag[];
  searchQuery: string;
  onDeleteNote: (noteId: string) => void;
  onNavigateNote: (note: StoredNote) => void;
  onRefresh?: () => void;
}

export function FoldersView({
  notes,
  folders,
  tags,
  searchQuery,
  onDeleteNote,
  onNavigateNote,
  onRefresh,
}: FoldersViewProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [inboxExpanded, setInboxExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the folder tree
  const tree = useMemo(() => buildFolderTree(folders, notes), [folders, notes]);
  const unfiledNotes = useMemo(() => getUnfiledNotes(notes), [notes]);
  const pinnedNotes = useMemo(() => notes.filter(n => n.pinned), [notes]);
  const pinnedFolders = useMemo(() => folders.filter(f => f.pinned), [folders]);

  // Search filtering
  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;
    const q = searchQuery.toLowerCase();

    const filterNode = (node: FolderTreeNode): FolderTreeNode | null => {
      const matchingNotes = node.notes.filter(
        n =>
          n.content.toLowerCase().includes(q) ||
          n.elementInfo.toLowerCase().includes(q)
      );
      const matchingChildren = node.children
        .map(filterNode)
        .filter((c): c is FolderTreeNode => c !== null);

      const folderNameMatches = node.folder.name.toLowerCase().includes(q);

      if (matchingNotes.length > 0 || matchingChildren.length > 0 || folderNameMatches) {
        return {
          folder: node.folder,
          children: matchingChildren,
          notes: folderNameMatches ? node.notes : matchingNotes,
        };
      }
      return null;
    };

    return tree.map(filterNode).filter((n): n is FolderTreeNode => n !== null);
  }, [tree, searchQuery]);

  const filteredUnfiledNotes = useMemo(() => {
    if (!searchQuery) return unfiledNotes;
    const q = searchQuery.toLowerCase();
    return unfiledNotes.filter(
      n =>
        n.content.toLowerCase().includes(q) ||
        n.elementInfo.toLowerCase().includes(q)
    );
  }, [unfiledNotes, searchQuery]);

  const toggleExpand = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const handleNewFolder = useCallback(async () => {
    const name = window.prompt('New folder name:');
    if (!name || !name.trim()) return;

    const order = getNextOrder(folders.filter(f => !f.parentId));
    const newFolder: StoredFolder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      parentId: null,
      order,
      color: null,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const service = await getFoldersService();
    await service.create(newFolder);
  }, [folders]);

  const handleFolderClick = useCallback((folderId: string) => {
    toggleExpand(folderId);
  }, [toggleExpand]);

  const handleNewSubfolder = useCallback(async (parentId: string) => {
    const name = window.prompt('New subfolder name:');
    if (!name || !name.trim()) return;

    const siblings = folders.filter(f => f.parentId === parentId);
    const order = getNextOrder(siblings);
    const newFolder: StoredFolder = {
      id: crypto.randomUUID(),
      name: name.trim(),
      parentId,
      order,
      color: null,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const service = await getFoldersService();
    await service.create(newFolder);
    // Expand parent so the new subfolder is visible
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.add(parentId);
      return next;
    });
    onRefresh?.();
  }, [folders, onRefresh]);

  const handleRenameFolder = useCallback(async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const newName = window.prompt('Rename folder:', folder.name);
    if (!newName || !newName.trim() || newName.trim() === folder.name) return;

    const service = await getFoldersService();
    await service.update(folderId, { name: newName.trim() });
    onRefresh?.();
  }, [folders, onRefresh]);

  const handleChangeFolderColor = useCallback(async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const colorOptions = TAG_COLORS.map((c, i) => `${i + 1}: ${c}`).join('\n');
    const choice = window.prompt(
      `Choose a color (1-${TAG_COLORS.length}):\n${colorOptions}\n\nEnter 0 to remove color.`
    );
    if (choice === null) return;

    const num = parseInt(choice, 10);
    let color: string | null = null;
    if (num >= 1 && num <= TAG_COLORS.length) {
      color = TAG_COLORS[num - 1];
    }

    const service = await getFoldersService();
    await service.update(folderId, { color });
    onRefresh?.();
  }, [folders, onRefresh]);

  const handleToggleFolderPin = useCallback(async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const service = await getFoldersService();
    await service.update(folderId, { pinned: !folder.pinned });
    onRefresh?.();
  }, [folders, onRefresh]);

  const handleDeleteFolder = useCallback(async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const confirmed = window.confirm(
      `Delete folder "${folder.name}"? Notes inside will be moved to Inbox.`
    );
    if (!confirmed) return;

    const service = await getFoldersService();
    await service.delete(folderId);
    onRefresh?.();
  }, [folders, onRefresh]);

  const handleToggleNotePin = useCallback(async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const service = await getNotesService();
    await service.update(noteId, { pinned: !note.pinned });
    onRefresh?.();
  }, [notes, onRefresh]);

  // Build a flat list of visible tree items for keyboard navigation
  const flatTreeItems = useMemo(() => {
    const items: { id: string; type: 'folder' | 'note'; parentId?: string | null; hasChildren: boolean }[] = [];

    // Inbox as a virtual folder
    items.push({ id: '__inbox__', type: 'folder', parentId: null, hasChildren: filteredUnfiledNotes.length > 0 });
    if (inboxExpanded) {
      filteredUnfiledNotes.forEach(note => {
        items.push({ id: note.id, type: 'note', parentId: '__inbox__', hasChildren: false });
      });
    }

    // Recursively flatten the folder tree
    const flattenNode = (node: FolderTreeNode) => {
      const hasContent = node.children.length > 0 || node.notes.length > 0;
      items.push({
        id: node.folder.id,
        type: 'folder',
        parentId: node.folder.parentId,
        hasChildren: hasContent,
      });
      if (expandedFolders.has(node.folder.id)) {
        node.children.forEach(flattenNode);
        node.notes.forEach(note => {
          items.push({ id: note.id, type: 'note', parentId: node.folder.id, hasChildren: false });
        });
      }
    };
    filteredTree.forEach(flattenNode);

    return items;
  }, [filteredTree, filteredUnfiledNotes, expandedFolders, inboxExpanded]);

  const handleKeyboardSelect = useCallback((id: string) => {
    const note = notes.find(n => n.id === id);
    if (note) onNavigateNote(note);
  }, [notes, onNavigateNote]);

  const { focusedId } = useTreeKeyboard({
    items: flatTreeItems,
    expandedIds: expandedFolders,
    onToggleExpand: (id: string) => {
      if (id === '__inbox__') setInboxExpanded(prev => !prev);
      else toggleExpand(id);
    },
    onSelect: handleKeyboardSelect,
    onDelete: (id: string) => {
      const note = notes.find(n => n.id === id);
      if (note) onDeleteNote(note.id);
      else handleDeleteFolder(id);
    },
    onRename: (id: string) => {
      if (folders.find(f => f.id === id)) handleRenameFolder(id);
    },
    containerRef,
  });

  return (
    <div ref={containerRef} tabIndex={0} className="px-3 py-3 outline-none">
      {/* Pinned Section */}
      <PinnedSection
        pinnedNotes={pinnedNotes}
        pinnedFolders={pinnedFolders}
        tags={tags}
        onNoteClick={onNavigateNote}
        onFolderClick={handleFolderClick}
        onDeleteNote={onDeleteNote}
      />

      {/* Header with New Folder button */}
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
          Folders
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={handleNewFolder}
          title="New folder"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Inbox row */}
      <div className="mb-1">
        <button
          onClick={() => setInboxExpanded(!inboxExpanded)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left",
            focusedId === '__inbox__' && "ring-2 ring-primary/50 bg-muted/30"
          )}
        >
          {filteredUnfiledNotes.length > 0 ? (
            inboxExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )
          ) : (
            <span className="w-3.5 h-3.5 shrink-0" />
          )}
          <Inbox className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium flex-1">Inbox</span>
          {filteredUnfiledNotes.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filteredUnfiledNotes.length}
            </span>
          )}
        </button>

        {/* Inbox notes */}
        {inboxExpanded && filteredUnfiledNotes.length > 0 && (
          <div className="space-y-1.5 px-2 py-1 ml-7">
            {filteredUnfiledNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                tags={tags}
                onDelete={onDeleteNote}
                onNavigate={onNavigateNote}
              />
            ))}
          </div>
        )}
      </div>

      {/* Folder tree */}
      {filteredTree.map((node) => (
        <FolderTreeNodeItem
          key={node.folder.id}
          node={node}
          depth={0}
          tags={tags}
          expandedFolders={expandedFolders}
          focusedId={focusedId}
          onToggleExpand={toggleExpand}
          onDeleteNote={onDeleteNote}
          onNavigateNote={onNavigateNote}
          onToggleNotePin={handleToggleNotePin}
          onNewSubfolder={handleNewSubfolder}
          onRenameFolder={handleRenameFolder}
          onChangeColor={handleChangeFolderColor}
          onToggleFolderPin={handleToggleFolderPin}
          onDeleteFolder={handleDeleteFolder}
        />
      ))}

      {/* Empty state: no notes at all */}
      {notes.length === 0 && folders.length === 0 && (
        <div className="text-center py-16">
          <StickyNote className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notes or folders yet</p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">
            Create a folder above or add notes to get started
          </p>
        </div>
      )}

      {/* Empty state: no search results */}
      {filteredTree.length === 0 && filteredUnfiledNotes.length === 0 && notes.length > 0 && searchQuery && (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No notes match "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}
