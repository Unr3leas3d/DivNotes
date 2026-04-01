import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { FolderPlus, Inbox, ChevronDown, ChevronRight, Search, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WorkspaceActionDialog } from '@/components/workspace/WorkspaceActionDialog';
import { PinnedSection } from './PinnedSection';
import { FolderTreeNodeItem } from './FolderTreeNodeItem';
import { NoteCard } from './NoteCard';
import { BulkActionBar } from './BulkActionBar';
import { buildFolderTree, getUnfiledNotes, countNotesInTree } from '@/lib/tree-utils';
import { getNextOrder } from '@/lib/tag-utils';
import { getFoldersService } from '@/lib/folders-service';
import { getNotesService } from '@/lib/notes-service';
import { getTagsService } from '@/lib/tags-service';
import { useTreeKeyboard } from '../hooks/useTreeKeyboard';
import { useMultiSelect } from '../hooks/useMultiSelect';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import type { StoredNote, StoredFolder, StoredTag, FolderTreeNode } from '@/lib/types';
import { FOLDER_COLORS } from '@/lib/types';

interface FoldersViewProps {
  notes: StoredNote[];
  folders: StoredFolder[];
  tags: StoredTag[];
  searchQuery: string;
  onDeleteNote: (noteId: string) => void;
  onNavigateNote: (note: StoredNote) => void;
  onEditNote: (note: StoredNote) => void;
  onRefresh?: () => void;
}

type FolderDialogState =
  | { type: 'new-folder'; value: string; error: string | null }
  | { type: 'new-subfolder'; parentId: string; value: string; error: string | null }
  | { type: 'rename-folder'; folderId: string; value: string; error: string | null }
  | { type: 'change-color'; folderId: string; selectedColor: string | null; error: string | null }
  | { type: 'delete-folder'; folderId: string; error: string | null }
  | { type: 'bulk-move'; value: string; error: string | null }
  | { type: 'bulk-tag'; value: string; error: string | null }
  | { type: 'bulk-delete'; error: string | null };

interface FolderDialogConfig {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  promptLabel?: string;
  promptPlaceholder?: string;
}

export function FoldersView({
  notes,
  folders,
  tags,
  searchQuery,
  onDeleteNote,
  onNavigateNote,
  onEditNote,
  onRefresh,
}: FoldersViewProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [inboxExpanded, setInboxExpanded] = useState(false);
  const [dialogState, setDialogState] = useState<FolderDialogState | null>(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [bulkActionError, setBulkActionError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the folder tree
  const tree = useMemo(() => buildFolderTree(folders, notes), [folders, notes]);
  const unfiledNotes = useMemo(() => getUnfiledNotes(notes), [notes]);
  const pinnedNotes = useMemo(() => notes.filter(n => n.pinned), [notes]);
  const pinnedFolders = useMemo(() => folders.filter(f => f.pinned), [folders]);

  // Multi-select support
  const allNoteIds = useMemo(() => notes.map(n => n.id), [notes]);
  const { selectedIds, toggleSelect, selectAll, clearSelection } = useMultiSelect(allNoteIds);

  // Clear selection when note count changes (e.g., after bulk delete)
  const prevNoteCount = useRef(notes.length);
  useEffect(() => {
    if (prevNoteCount.current !== notes.length) {
      clearSelection();
      prevNoteCount.current = notes.length;
    }
  }, [notes.length, clearSelection]);

  useEffect(() => {
    if (selectedIds.size < 2 && bulkActionError) {
      setBulkActionError(null);
    }
  }, [bulkActionError, selectedIds.size]);

  // Drag and drop support
  const handleMoveNote = useCallback(async (noteId: string, folderId: string | null) => {
    const service = await getNotesService();
    await service.update(noteId, { folderId });
    onRefresh?.();
  }, [onRefresh]);

  const handleMoveFolder = useCallback(async (folderId: string, newParentId: string | null) => {
    const siblings = folders.filter((folder) => folder.parentId === newParentId && folder.id !== folderId);
    const service = await getFoldersService();
    await service.update(folderId, {
      parentId: newParentId,
      order: getNextOrder(siblings),
    });
    onRefresh?.();
  }, [folders, onRefresh]);

  const handleReorderFolder = useCallback(async (folderId: string, targetFolderId: string, position: 'before' | 'after') => {
    const service = await getFoldersService();
    await service.reorder(folderId, targetFolderId, position);
    onRefresh?.();
  }, [onRefresh]);

  const {
    dragItem,
    dropTargetId,
    dropPosition,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useDragAndDrop({
    onMoveNote: handleMoveNote,
    onMoveFolder: handleMoveFolder,
    onReorderFolder: handleReorderFolder,
    folders,
  });

  const handleBulkMoveToFolder = useCallback(() => {
    setBulkActionError(null);
    setDialogState({ type: 'bulk-move', value: '', error: null });
  }, []);

  const handleBulkAddTags = useCallback(() => {
    setBulkActionError(null);
    setDialogState({ type: 'bulk-tag', value: '', error: null });
  }, []);

  const handleBulkPin = useCallback(async () => {
    const service = await getNotesService();
    for (const noteId of selectedIds) {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        await service.update(noteId, { pinned: !note.pinned });
      }
    }
    clearSelection();
    onRefresh?.();
  }, [selectedIds, notes, clearSelection, onRefresh]);

  const handleBulkDelete = useCallback(() => {
    setBulkActionError(null);
    setDialogState({ type: 'bulk-delete', error: null });
  }, []);

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

  const handleNewFolder = useCallback(() => {
    setDialogState({ type: 'new-folder', value: '', error: null });
  }, []);

  const handleFolderClick = useCallback((folderId: string) => {
    toggleExpand(folderId);
  }, [toggleExpand]);

  const handleNewSubfolder = useCallback((parentId: string) => {
    setDialogState({ type: 'new-subfolder', parentId, value: '', error: null });
  }, []);

  const handleRenameFolder = useCallback((folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    setDialogState({
      type: 'rename-folder',
      folderId,
      value: folder.name,
      error: null,
    });
  }, [folders]);

  const handleChangeFolderColor = useCallback((folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    setDialogState({
      type: 'change-color',
      folderId,
      selectedColor: folder.color,
      error: null,
    });
  }, [folders]);

  const handleToggleFolderPin = useCallback(async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    const service = await getFoldersService();
    await service.update(folderId, { pinned: !folder.pinned });
    onRefresh?.();
  }, [folders, onRefresh]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    setDialogState({ type: 'delete-folder', folderId, error: null });
  }, [folders]);

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

  const handleContainerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      selectAll();
    }
    if (e.key === 'Escape' && selectedIds.size > 0) {
      e.preventDefault();
      clearSelection();
    }
  }, [selectAll, clearSelection, selectedIds.size]);

  const handleDialogPromptChange = useCallback((value: string) => {
    setDialogState((current) => {
      if (!current || !('value' in current)) {
        return current;
      }

      return {
        ...current,
        value,
        error: null,
      };
    });
  }, []);

  const handleDialogConfirm = useCallback(async () => {
    if (!dialogState) {
      return;
    }

    const setCurrentDialogError = (message: string) => {
      setDialogState((current) => {
        if (!current || current.type !== dialogState.type) {
          return current;
        }

        return {
          ...current,
          error: message,
        };
      });
    };

    setDialogSubmitting(true);

    try {
      switch (dialogState.type) {
        case 'new-folder': {
          const name = dialogState.value.trim();
          if (!name) {
            setCurrentDialogError('Enter a folder name.');
            return;
          }

          const order = getNextOrder(folders.filter((folder) => !folder.parentId));
          const timestamp = new Date().toISOString();
          const newFolder: StoredFolder = {
            id: crypto.randomUUID(),
            name,
            parentId: null,
            order,
            color: null,
            pinned: false,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          const service = await getFoldersService();
          await service.create(newFolder);
          setDialogState(null);
          onRefresh?.();
          return;
        }
        case 'new-subfolder': {
          const name = dialogState.value.trim();
          if (!name) {
            setCurrentDialogError('Enter a folder name.');
            return;
          }

          const siblings = folders.filter((folder) => folder.parentId === dialogState.parentId);
          const order = getNextOrder(siblings);
          const timestamp = new Date().toISOString();
          const newFolder: StoredFolder = {
            id: crypto.randomUUID(),
            name,
            parentId: dialogState.parentId,
            order,
            color: null,
            pinned: false,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          const service = await getFoldersService();
          await service.create(newFolder);
          setExpandedFolders((prev) => {
            const next = new Set(prev);
            next.add(dialogState.parentId);
            return next;
          });
          setDialogState(null);
          onRefresh?.();
          return;
        }
        case 'rename-folder': {
          const name = dialogState.value.trim();
          const folder = folders.find((item) => item.id === dialogState.folderId);
          if (!folder) {
            setCurrentDialogError('This folder is no longer available.');
            return;
          }
          if (!name) {
            setCurrentDialogError('Enter a folder name.');
            return;
          }
          if (name === folder.name) {
            setDialogState(null);
            return;
          }

          const service = await getFoldersService();
          await service.update(dialogState.folderId, { name });
          setDialogState(null);
          onRefresh?.();
          return;
        }
        case 'change-color': {
          const service = await getFoldersService();
          await service.update(dialogState.folderId, { color: dialogState.selectedColor });
          setDialogState(null);
          onRefresh?.();
          return;
        }
        case 'delete-folder': {
          const service = await getFoldersService();
          await service.delete(dialogState.folderId);
          setDialogState(null);
          onRefresh?.();
          return;
        }
        case 'bulk-move': {
          const folderName = dialogState.value.trim();
          if (!folderName) {
            setCurrentDialogError('Enter a folder name.');
            return;
          }

          const targetFolder = folders.find(
            (folder) => folder.name.toLowerCase() === folderName.toLowerCase()
          );
          if (!targetFolder) {
            setBulkActionError(`Folder "${folderName}" not found. Please create it first.`);
            setDialogState(null);
            return;
          }

          const service = await getNotesService();
          for (const noteId of selectedIds) {
            await service.update(noteId, { folderId: targetFolder.id });
          }
          clearSelection();
          setBulkActionError(null);
          setDialogState(null);
          onRefresh?.();
          return;
        }
        case 'bulk-tag': {
          const tagName = dialogState.value.trim();
          if (!tagName) {
            setCurrentDialogError('Enter a tag name.');
            return;
          }

          const targetTag = tags.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
          if (!targetTag) {
            setBulkActionError(`Tag "${tagName}" not found. Please create it first in Tag Manager.`);
            setDialogState(null);
            return;
          }

          const tagsService = await getTagsService();
          for (const noteId of selectedIds) {
            const note = notes.find((item) => item.id === noteId);
            if (!note) {
              continue;
            }

            const currentTags = note.tags || [];
            if (!currentTags.includes(targetTag.id)) {
              await tagsService.setNoteTags(noteId, [...new Set([...currentTags, targetTag.id])]);
            }
          }
          clearSelection();
          setBulkActionError(null);
          setDialogState(null);
          onRefresh?.();
          return;
        }
        case 'bulk-delete': {
          const service = await getNotesService();
          for (const noteId of selectedIds) {
            await service.delete(noteId);
          }
          clearSelection();
          setBulkActionError(null);
          setDialogState(null);
          onRefresh?.();
          return;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The action could not be completed.';
      setCurrentDialogError(message);
    } finally {
      setDialogSubmitting(false);
    }
  }, [clearSelection, dialogState, folders, notes, onRefresh, selectedIds, tags]);

  const dialogFolder = useMemo(() => {
    if (!dialogState) {
      return null;
    }
    if ('folderId' in dialogState) {
      return folders.find((folder) => folder.id === dialogState.folderId) ?? null;
    }
    if (dialogState.type === 'new-subfolder') {
      return folders.find((folder) => folder.id === dialogState.parentId) ?? null;
    }
    return null;
  }, [dialogState, folders]);
  const dialogPromptValue = dialogState && 'value' in dialogState ? dialogState.value : '';
  const dialogValidationError =
    dialogState && 'value' in dialogState ? dialogState.error : null;
  const dialogInlineError =
    dialogState && !('value' in dialogState) ? dialogState.error : null;
  const handleDialogSelectedColorChange = useCallback((selectedColor: string | null) => {
    setDialogState((current) => {
      if (!current || current.type !== 'change-color') {
        return current;
      }

      return {
        ...current,
        selectedColor,
        error: null,
      };
    });
  }, []);
  const dialogConfig = useMemo<FolderDialogConfig | null>(() => {
    if (!dialogState) {
      return null;
    }

    switch (dialogState.type) {
      case 'new-folder':
        return {
          title: 'Create Folder',
          description: 'Give this folder a clear name so notes stay easy to find.',
          confirmLabel: 'Create Folder',
          promptLabel: 'Folder Name',
          promptPlaceholder: 'Folder name',
          destructive: false,
        };
      case 'new-subfolder':
        return {
          title: 'Create Subfolder',
          description: dialogFolder
            ? `Add a subfolder inside "${dialogFolder.name}".`
            : 'Add a subfolder inside this folder.',
          confirmLabel: 'Create Subfolder',
          promptLabel: 'Subfolder Name',
          promptPlaceholder: 'Subfolder name',
          destructive: false,
        };
      case 'rename-folder':
        return {
          title: 'Rename Folder',
          description: 'Update the folder name without changing its notes or position.',
          confirmLabel: 'Save Name',
          promptLabel: 'Folder Name',
          promptPlaceholder: 'Folder name',
          destructive: false,
        };
      case 'change-color':
        return {
          title: 'Choose Folder Color',
          description: 'Pick a folder color in-app so the change is easy to preview.',
          confirmLabel: 'Apply Color',
          destructive: false,
        };
      case 'delete-folder':
        return {
          title: 'Delete Folder?',
          description: dialogFolder
            ? `Delete "${dialogFolder.name}"? Notes inside will be moved to Inbox.`
            : 'Delete this folder? Notes inside will be moved to Inbox.',
          confirmLabel: 'Delete Folder',
          destructive: true,
        };
      case 'bulk-move':
        return {
          title: 'Move Selected Notes',
          description: `Move ${selectedIds.size} selected notes into an existing folder.`,
          confirmLabel: 'Move Notes',
          promptLabel: 'Folder Name',
          promptPlaceholder: 'Existing folder name',
          destructive: false,
        };
      case 'bulk-tag':
        return {
          title: 'Add Tag To Selected Notes',
          description: `Apply an existing tag to ${selectedIds.size} selected notes.`,
          confirmLabel: 'Add Tag',
          promptLabel: 'Tag Name',
          promptPlaceholder: 'Existing tag name',
          destructive: false,
        };
      case 'bulk-delete':
        return {
          title: 'Delete Selected Notes?',
          description: `Delete ${selectedIds.size} selected notes? This cannot be undone.`,
          confirmLabel: 'Delete Notes',
          destructive: true,
        };
    }
  }, [dialogFolder, dialogState, selectedIds.size]);

  return (
    <div ref={containerRef} tabIndex={0} className="outline-none" onKeyDown={handleContainerKeyDown}>
      {/* Pinned Section */}
      <PinnedSection
        pinnedNotes={pinnedNotes}
        pinnedFolders={pinnedFolders}
        tags={tags}
        onNoteClick={onNavigateNote}
        onEditNote={onEditNote}
        onFolderClick={handleFolderClick}
        onDeleteNote={onDeleteNote}
      />

      {/* Header with New Folder button */}
      <div className="mb-4 rounded-[20px] border border-[#ece7de] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(5,36,21,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3f1eb] text-[#6d7b70]">
              <Inbox className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9aa294]">Folders</p>
              <p className="text-[13px] font-semibold text-[#173628]">
                {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="h-9 rounded-[12px] border border-[#e7e2d8] bg-[#f8f6f1] px-3 text-[12px] font-medium text-[#526357] hover:bg-[#f1eee7]"
            onClick={handleNewFolder}
            title="New folder"
          >
            <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
            New Folder
          </Button>
        </div>
      </div>

      {/* Inbox row */}
      <div
        className="mb-1"
        onDragOver={(e) => handleDragOver(e, null)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        <button
          onClick={() => setInboxExpanded(!inboxExpanded)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left",
            focusedId === '__inbox__' && "ring-2 ring-primary/50 bg-muted/30",
            dropTargetId === null && dragItem !== null && "border-l-2 border-l-primary bg-primary/5"
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
                onEdit={onEditNote}
                selected={selectedIds.has(note.id)}
                onSelectClick={toggleSelect}
                draggable
                onDragStart={(e) => handleDragStart(e, 'note', note.id)}
                onDragEnd={handleDragEnd}
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
          onEditNote={onEditNote}
          onToggleNotePin={handleToggleNotePin}
          onNewSubfolder={handleNewSubfolder}
          onRenameFolder={handleRenameFolder}
          onChangeColor={handleChangeFolderColor}
          onToggleFolderPin={handleToggleFolderPin}
          onDeleteFolder={handleDeleteFolder}
          selectedNoteIds={selectedIds}
          onNoteSelectClick={toggleSelect}
          dropTargetId={dropTargetId}
          dropPosition={dropPosition}
          dragItem={dragItem}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
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

      {selectedIds.size >= 2 ? (
        <div className="pb-14 pt-3">
          {bulkActionError ? (
            <p
              aria-live="polite"
              className="rounded-[12px] border border-[rgba(220,38,38,0.15)] bg-[rgba(254,242,242,0.92)] px-3 py-2 text-[11px] text-[#b91c1c]"
            >
              {bulkActionError}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Bulk action bar */}
      <BulkActionBar
        count={selectedIds.size}
        onMoveToFolder={handleBulkMoveToFolder}
        onAddTags={handleBulkAddTags}
        onPin={handleBulkPin}
        onDelete={handleBulkDelete}
        onClear={clearSelection}
      />

      {dialogConfig ? (
        <WorkspaceActionDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialogState(null);
            }
          }}
          title={dialogConfig.title}
          description={dialogConfig.description}
          confirmLabel={dialogConfig.confirmLabel}
          destructive={dialogConfig.destructive}
          promptLabel={dialogConfig.promptLabel}
          promptPlaceholder={dialogConfig.promptPlaceholder}
          promptValue={dialogPromptValue}
          validationError={dialogValidationError}
          inlineError={dialogInlineError}
          contentClassName={
            dialogState?.type === 'bulk-move' ||
            dialogState?.type === 'bulk-tag' ||
            dialogState?.type === 'bulk-delete'
              ? 'max-w-[420px]'
              : undefined
          }
          onPromptChange={handleDialogPromptChange}
          onConfirm={() => void handleDialogConfirm()}
          isSubmitting={dialogSubmitting}
        >
          {dialogState?.type === 'change-color' ? (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b968f]">
                Folder color
              </p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  className={cn(
                    'col-span-2 rounded-[12px] border px-3 py-2 text-left text-[12px] font-medium transition-colors',
                    dialogState.selectedColor === null
                      ? 'border-[#173628] bg-[#f1eee7] text-[#173628]'
                      : 'border-[#e7e2d8] bg-white text-[#526357] hover:bg-[#f8f6f1]'
                  )}
                  onClick={() => handleDialogSelectedColorChange(null)}
                >
                  No color
                </button>
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Select folder color ${color}`}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-[12px] border transition-transform hover:scale-[1.02]',
                      dialogState.selectedColor === color
                        ? 'border-[#173628] ring-2 ring-[#173628]/20'
                        : 'border-[#e7e2d8]'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => handleDialogSelectedColorChange(color)}
                  >
                    <span className="sr-only">{color}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </WorkspaceActionDialog>
      ) : null}
    </div>
  );
}
