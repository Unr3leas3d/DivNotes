import { useState, useCallback, useEffect } from 'react';

interface TreeItem {
  id: string;
  type: 'folder' | 'note';
  parentId?: string | null;
  hasChildren: boolean;
}

interface UseTreeKeyboardOptions {
  items: TreeItem[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function useTreeKeyboard({
  items,
  expandedIds,
  onToggleExpand,
  onSelect,
  onDelete,
  onRename,
  containerRef,
}: UseTreeKeyboardOptions) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!items.length) return;

    const currentIndex = focusedId ? items.findIndex(i => i.id === focusedId) : -1;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex = currentIndex + 1 < items.length ? currentIndex + 1 : 0;
        setFocusedId(items[nextIndex].id);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        setFocusedId(items[prevIndex].id);
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (focusedId) {
          const item = items.find(i => i.id === focusedId);
          if (item?.type === 'folder' && item.hasChildren && !expandedIds.has(focusedId)) {
            onToggleExpand(focusedId);
          }
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (focusedId) {
          const item = items.find(i => i.id === focusedId);
          if (item?.type === 'folder' && expandedIds.has(focusedId)) {
            onToggleExpand(focusedId);
          } else if (item?.parentId) {
            setFocusedId(item.parentId);
          }
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (focusedId) {
          const item = items.find(i => i.id === focusedId);
          if (item?.type === 'folder') onToggleExpand(focusedId);
          else onSelect?.(focusedId);
        }
        break;
      }
      case ' ': {
        e.preventDefault();
        if (focusedId) onSelect?.(focusedId);
        break;
      }
      case 'Delete':
      case 'Backspace': {
        if (focusedId && (!e.target || (e.target as HTMLElement).tagName !== 'INPUT')) {
          e.preventDefault();
          onDelete?.(focusedId);
        }
        break;
      }
      case 'F2': {
        e.preventDefault();
        if (focusedId) onRename?.(focusedId);
        break;
      }
      case '/': {
        e.preventDefault();
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        searchInput?.focus();
        break;
      }
    }
  }, [items, focusedId, expandedIds, onToggleExpand, onSelect, onDelete, onRename]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, handleKeyDown]);

  return { focusedId, setFocusedId };
}
