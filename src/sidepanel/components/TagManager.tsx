import React, { useState, useCallback, useEffect } from 'react';
import { X, Trash2, Check, GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkspaceActionDialog } from '@/components/workspace/WorkspaceActionDialog';
import { getTagsService } from '@/lib/tags-service';
import { TAG_COLORS } from '@/lib/types';
import type { StoredTag } from '@/lib/types';

interface TagManagerProps {
  tags: StoredTag[];
  onClose: () => void;
}

type TagDialogState =
  | { type: 'delete'; tagId: string; error: string | null }
  | { type: 'merge'; keepId: string; removeId: string; error: string | null };

export function TagManager({ tags, onClose }: TagManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localTags, setLocalTags] = useState<StoredTag[]>(tags);
  const [noteCounts, setNoteCounts] = useState<Map<string, number>>(new Map());
  const [dialogState, setDialogState] = useState<TagDialogState | null>(null);
  const [dialogSubmitting, setDialogSubmitting] = useState(false);

  // Sync local tags with prop changes
  useEffect(() => {
    setLocalTags(tags);
  }, [tags]);

  // Compute note counts
  useEffect(() => {
    chrome.storage.local.get(['divnotes_notes'], (res) => {
      const notes = res.divnotes_notes || [];
      const counts = new Map<string, number>();
      for (const tag of localTags) {
        counts.set(tag.id, 0);
      }
      for (const note of notes) {
        if (note.tags) {
          for (const tagId of note.tags) {
            if (counts.has(tagId)) {
              counts.set(tagId, counts.get(tagId)! + 1);
            }
          }
        }
      }
      setNoteCounts(counts);
    });
  }, [localTags]);

  const cycleColor = useCallback(async (tag: StoredTag) => {
    const currentIdx = TAG_COLORS.indexOf(tag.color as typeof TAG_COLORS[number]);
    const nextIdx = (currentIdx + 1) % TAG_COLORS.length;
    const newColor = TAG_COLORS[nextIdx];

    const service = await getTagsService();
    await service.update(tag.id, { color: newColor });

    setLocalTags((prev) =>
      prev.map((t) => (t.id === tag.id ? { ...t, color: newColor } : t))
    );
  }, []);

  const startEdit = useCallback((tag: StoredTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) {
      setEditingId(null);
      return;
    }

    const service = await getTagsService();
    await service.update(editingId, { name: editName.trim() });

    setLocalTags((prev) =>
      prev.map((t) => (t.id === editingId ? { ...t, name: editName.trim() } : t))
    );
    setEditingId(null);
  }, [editingId, editName]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        saveEdit();
      } else if (e.key === 'Escape') {
        setEditingId(null);
      }
    },
    [saveEdit]
  );

  const deleteTag = useCallback((tag: StoredTag) => {
    setDialogState({ type: 'delete', tagId: tag.id, error: null });
  }, []);

  const toggleSelection = useCallback((tagId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  const mergeTags = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length !== 2) return;
    const [keepId, removeId] = ids;
    setDialogState({ type: 'merge', keepId, removeId, error: null });
  }, [selectedIds]);

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
      if (dialogState.type === 'delete') {
        const service = await getTagsService();
        await service.delete(dialogState.tagId);

        setLocalTags((prev) => prev.filter((tag) => tag.id !== dialogState.tagId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(dialogState.tagId);
          return next;
        });
        setDialogState(null);
        return;
      }

      const keepTag = localTags.find((tag) => tag.id === dialogState.keepId);
      const removeTag = localTags.find((tag) => tag.id === dialogState.removeId);
      if (!keepTag || !removeTag) {
        setCurrentDialogError('One of the selected tags is no longer available.');
        return;
      }

      const service = await getTagsService();
      const result = await chrome.storage.local.get(['divnotes_notes']);
      const notes = result.divnotes_notes || [];

      for (const note of notes) {
        if (note.tags?.includes(dialogState.removeId)) {
          const newTags = note.tags.filter((tagId: string) => tagId !== dialogState.removeId);
          if (!newTags.includes(dialogState.keepId)) {
            newTags.push(dialogState.keepId);
          }
          await service.setNoteTags(note.id, newTags);
        }
      }

      await service.delete(dialogState.removeId);

      setLocalTags((prev) => prev.filter((tag) => tag.id !== dialogState.removeId));
      setSelectedIds(new Set());
      setDialogState(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The action could not be completed.';
      setCurrentDialogError(message);
    } finally {
      setDialogSubmitting(false);
    }
  }, [dialogState, localTags]);

  const dialogDeleteTag =
    dialogState?.type === 'delete'
      ? localTags.find((tag) => tag.id === dialogState.tagId) ?? null
      : null;
  const dialogKeepTag =
    dialogState?.type === 'merge'
      ? localTags.find((tag) => tag.id === dialogState.keepId) ?? null
      : null;
  const dialogRemoveTag =
    dialogState?.type === 'merge'
      ? localTags.find((tag) => tag.id === dialogState.removeId) ?? null
      : null;

  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Manage Tags</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Merge bar */}
      {selectedIds.size === 2 && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
          <span className="text-xs text-muted-foreground">
            2 tags selected
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={mergeTags}
          >
            <GitMerge className="w-3 h-3" />
            Merge
          </Button>
        </div>
      )}

      {/* Tag list */}
      <div className="flex-1 overflow-y-auto">
        {localTags.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            No tags to manage
          </div>
        ) : (
          <div className="divide-y">
            {localTags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(tag.id)}
                  onChange={() => toggleSelection(tag.id)}
                  className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                />

                {/* Color dot */}
                <button
                  className="w-4 h-4 rounded-full shrink-0 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  style={{ backgroundColor: tag.color }}
                  onClick={() => cycleColor(tag)}
                  title="Click to change color"
                />

                {/* Name or edit input */}
                {editingId === tag.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={saveEdit}
                      className="h-6 text-xs px-2"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={saveEdit}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="flex-1 text-left text-xs font-medium truncate hover:text-primary transition-colors"
                    onClick={() => startEdit(tag)}
                    title="Click to rename"
                  >
                    {tag.name}
                  </button>
                )}

                {/* Note count */}
                <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">
                  {noteCounts.get(tag.id) || 0}
                </span>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => deleteTag(tag)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {dialogState ? (
        <WorkspaceActionDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialogState(null);
            }
          }}
          title={dialogState.type === 'delete' ? 'Delete Tag?' : 'Merge Tags?'}
          description={
            dialogState.type === 'delete'
              ? dialogDeleteTag
                ? `Delete tag "${dialogDeleteTag.name}"? It will be removed from all notes.`
                : 'Delete this tag? It will be removed from all notes.'
              : dialogKeepTag && dialogRemoveTag
                ? `Merge "${dialogRemoveTag.name}" into "${dialogKeepTag.name}"? Notes from "${dialogRemoveTag.name}" will be reassigned to "${dialogKeepTag.name}", then "${dialogRemoveTag.name}" will be deleted.`
                : 'Merge these tags? Notes from one tag will be reassigned to the other before deletion.'
          }
          confirmLabel={dialogState.type === 'delete' ? 'Delete Tag' : 'Merge Tags'}
          destructive
          inlineError={dialogState.error}
          onConfirm={() => void handleDialogConfirm()}
          isSubmitting={dialogSubmitting}
        />
      ) : null}
    </div>
  );
}
