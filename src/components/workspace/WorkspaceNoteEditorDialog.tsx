import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getNotesService } from '@/lib/notes-service';
import type { StoredFolder, StoredNote, StoredTag } from '@/lib/types';

interface WorkspaceNoteEditorDialogProps {
  note: StoredNote;
  folders: StoredFolder[];
  tags: StoredTag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function WorkspaceNoteEditorDialog({
  note,
  folders,
  tags,
  open,
  onOpenChange,
  onSaved,
}: WorkspaceNoteEditorDialogProps) {
  const [draft, setDraft] = useState(note.content);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(note.folderId ?? '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(note.tags);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(note.content);
    setSelectedFolderId(note.folderId ?? '');
    setSelectedTagIds(note.tags);
    setError(null);
  }, [note, open]);

  const sortedFolders = useMemo(
    () => [...folders].sort((left, right) => left.name.localeCompare(right.name)),
    [folders]
  );

  const sortedTags = useMemo(
    () => [...tags].sort((left, right) => left.name.localeCompare(right.name)),
    [tags]
  );

  const toggleTagId = (tagId: string) => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const notesService = await getNotesService();
      await notesService.update(note.id, {
        content: draft,
        folderId: selectedFolderId || null,
        tags: selectedTagIds,
      });
      onSaved();
      onOpenChange(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSaving && !nextOpen) {
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="max-w-[420px]"
        showCloseButton
        closeButtonDisabled={isSaving}
        onEscapeKeyDown={(event) => {
          if (isSaving) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isSaving) {
            event.preventDefault();
          }
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit note</DialogTitle>
            <DialogDescription>Update this note without leaving Canopy.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="workspace-note-editor-content"
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b968f]"
              >
                Note
              </label>
              <Textarea
                id="workspace-note-editor-content"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-[160px] rounded-[14px] border-[#e7e2d8] bg-white text-[13px] leading-[1.6] text-[#173628] focus-visible:ring-[#173628]/30"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="workspace-note-editor-folder"
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b968f]"
              >
                Folder
              </label>
              <select
                id="workspace-note-editor-folder"
                value={selectedFolderId}
                onChange={(event) => setSelectedFolderId(event.target.value)}
                className="flex h-10 w-full rounded-[11px] border border-[#e7e2d8] bg-white px-3 text-[13px] text-[#173628] outline-none transition-colors focus:border-[#173628]/30"
              >
                <option value="">No folder</option>
                {sortedFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b968f]">Tags</p>
              <div className="flex flex-wrap gap-2">
                {sortedTags.length === 0 ? (
                  <span className="text-[12px] text-[#8b968f]">No tags available yet.</span>
                ) : (
                  sortedTags.map((tag) => {
                    const active = selectedTagIds.includes(tag.id);

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTagId(tag.id)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors',
                          active
                            ? 'border-[#173628] bg-[#173628] text-[#f5efe9]'
                            : 'border-[#e7e2d8] bg-white text-[#637267] hover:bg-[#f8f6f1]'
                        )}
                      >
                        {tag.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {error ? (
              <p className="rounded-[10px] border border-[rgba(220,38,38,0.15)] bg-[rgba(254,242,242,0.75)] px-2.5 py-2 text-[11px] text-[#b91c1c]">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-[11px] border-[#e7e2d8] bg-white text-[#445348] hover:bg-[#f8f6f1]"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="h-9 rounded-[11px] bg-[#173628] text-[#f5efe9] hover:bg-[#10271d]"
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
