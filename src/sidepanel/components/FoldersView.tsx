import React, { useState, useMemo, useCallback } from 'react';
import { FolderPlus, Inbox, ChevronDown, ChevronRight, Search, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PinnedSection } from './PinnedSection';
import { FolderTreeNodeItem } from './FolderTreeNodeItem';
import { NoteCard } from './NoteCard';
import { buildFolderTree, getUnfiledNotes, countNotesInTree } from '@/lib/tree-utils';
import { getNextOrder } from '@/lib/tag-utils';
import { getFoldersService } from '@/lib/folders-service';
import type { StoredNote, StoredFolder, StoredTag, FolderTreeNode } from '@/lib/types';

interface FoldersViewProps {
  notes: StoredNote[];
  folders: StoredFolder[];
  tags: StoredTag[];
  searchQuery: string;
  onDeleteNote: (noteId: string) => void;
  onNavigateNote: (note: StoredNote) => void;
}

export function FoldersView({
  notes,
  folders,
  tags,
  searchQuery,
  onDeleteNote,
  onNavigateNote,
}: FoldersViewProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [inboxExpanded, setInboxExpanded] = useState(false);

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

  return (
    <div className="px-3 py-3">
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
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
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
          onToggleExpand={toggleExpand}
          onDeleteNote={onDeleteNote}
          onNavigateNote={onNavigateNote}
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
