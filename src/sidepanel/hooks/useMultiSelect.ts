import { useState, useCallback } from 'react';

export function useMultiSelect(itemIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const toggleSelect = useCallback((id: string, meta: { shift?: boolean; cmd?: boolean }) => {
    setSelectedIds(prev => {
      const next = new Set(prev);

      if (meta.shift && lastSelectedId) {
        // Range select
        const startIdx = itemIds.indexOf(lastSelectedId);
        const endIdx = itemIds.indexOf(id);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          for (let i = from; i <= to; i++) {
            next.add(itemIds[i]);
          }
        }
      } else if (meta.cmd) {
        // Toggle individual
        if (next.has(id)) next.delete(id);
        else next.add(id);
      } else {
        // Single select (clear others)
        next.clear();
        next.add(id);
      }

      return next;
    });
    setLastSelectedId(id);
  }, [itemIds, lastSelectedId]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(itemIds));
  }, [itemIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  return { selectedIds, toggleSelect, selectAll, clearSelection };
}
