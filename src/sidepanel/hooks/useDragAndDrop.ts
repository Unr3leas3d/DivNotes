import { useState, useCallback, DragEvent } from 'react';
import type { StoredFolder } from '@/lib/types';
import { getDescendantFolderIds } from '@/lib/tree-utils';

interface DragItem {
  type: 'note' | 'folder';
  id: string;
}

type FolderDropPosition = 'before' | 'into' | 'after';

export function useDragAndDrop(options: {
  onMoveNote: (noteId: string, folderId: string | null) => void;
  onMoveFolder: (folderId: string, newParentId: string | null) => void;
  onReorderFolder: (folderId: string, targetFolderId: string, position: 'before' | 'after') => void;
  folders: StoredFolder[];
}) {
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<FolderDropPosition>('into');

  const handleDragStart = useCallback((e: DragEvent, type: 'note' | 'folder', id: string) => {
    setDragItem({ type, id });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
    // Make drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: DragEvent) => {
    setDragItem(null);
    setDropTargetId(null);
    setDropPosition('into');
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetFolderId);
    if (dragItem?.type === 'folder' && targetFolderId && e.currentTarget instanceof HTMLElement) {
      const bounds = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - bounds.top;
      if (offsetY < bounds.height * 0.28) {
        setDropPosition('before');
      } else if (offsetY > bounds.height * 0.72) {
        setDropPosition('after');
      } else {
        setDropPosition('into');
      }
      return;
    }
    setDropPosition('into');
  }, [dragItem]);

  const handleDragLeave = useCallback(() => {
    setDropTargetId(null);
    setDropPosition('into');
  }, []);

  const handleDrop = useCallback((e: DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDropTargetId(null);
    setDropPosition('into');

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain')) as DragItem;
      if (data.type === 'note') {
        options.onMoveNote(data.id, targetFolderId);
      } else if (data.type === 'folder') {
        // Prevent dropping folder onto itself or its descendants (would create cycle)
        const descendantIds = getDescendantFolderIds(data.id, options.folders);
        if (data.id !== targetFolderId && (!targetFolderId || !descendantIds.includes(targetFolderId))) {
          if (targetFolderId && dropPosition !== 'into') {
            options.onReorderFolder(data.id, targetFolderId, dropPosition);
            return;
          }
          options.onMoveFolder(data.id, targetFolderId);
        }
      }
    } catch {}
  }, [dropPosition, options]);

  return {
    dragItem,
    dropTargetId,
    dropPosition,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
