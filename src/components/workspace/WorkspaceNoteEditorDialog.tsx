import React, { useEffect, useMemo, useReducer, useRef } from 'react';

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
import { createEditorState, editorReducer, buildSavePayload } from '@/lib/editor-controller';
import { getNotesService } from '@/lib/notes-service';
import type { StoredFolder, StoredNote } from '@/lib/types';
import {
  buildWorkspaceNoteFolderOptions,
  shouldReinitializeWorkspaceNoteEditor,
} from './workspace-note-editor-state';

interface WorkspaceNoteEditorDialogProps {
  note: StoredNote;
  folders: StoredFolder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function WorkspaceNoteEditorDialog({
  note,
  folders,
  open,
  onOpenChange,
  onSaved,
}: WorkspaceNoteEditorDialogProps) {
  const [state, dispatch] = useReducer(
    editorReducer,
    null,
    () => createEditorState({
      url: note.url,
      hostname: note.hostname,
      pageTitle: note.pageTitle,
      elementSelector: note.elementSelector,
      elementTag: note.elementTag,
      elementInfo: note.elementInfo,
      elementXPath: note.elementXPath,
      elementTextHash: note.elementTextHash,
      elementPosition: note.elementPosition,
      selectedText: note.selectedText,
    }, note)
  );

  const previousStateRef = useRef({
    open: false,
    noteId: note.id,
  });

  useEffect(() => {
    if (
      shouldReinitializeWorkspaceNoteEditor({
        previousOpen: previousStateRef.current.open,
        nextOpen: open,
        previousNoteId: previousStateRef.current.noteId,
        nextNoteId: note.id,
      })
    ) {
      dispatch({ type: 'SET_BODY', body: note.content });
      dispatch({ type: 'SET_FOLDER', folderId: note.folderId ?? null });
    }

    previousStateRef.current = {
      open,
      noteId: note.id,
    };
  }, [note.content, note.folderId, note.id, open]);

  const folderOptions = useMemo(() => buildWorkspaceNoteFolderOptions(folders), [folders]);

  const handleSave = async () => {
    dispatch({ type: 'SAVE_START' });

    try {
      const notesService = await getNotesService();
      const payload = buildSavePayload(state);
      await notesService.update(note.id, {
        content: payload.content,
        folderId: payload.folderId,
      });
      dispatch({ type: 'SAVE_SUCCESS' });
      onSaved();
      onOpenChange(false);
    } catch (caughtError) {
      dispatch({
        type: 'SAVE_ERROR',
        message: caughtError instanceof Error ? caughtError.message : 'Failed to save note',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (state.saving && !nextOpen) {
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="max-w-[420px]"
        showCloseButton
        closeButtonDisabled={state.saving}
        onEscapeKeyDown={(event) => {
          if (state.saving) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (state.saving) {
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
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Note
              </label>
              <Textarea
                id="workspace-note-editor-content"
                value={state.body}
                onChange={(event) => dispatch({ type: 'SET_BODY', body: event.target.value })}
                className="min-h-[160px] rounded-[14px] border-border bg-card text-[13px] leading-[1.6] text-foreground"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="workspace-note-editor-folder"
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
              >
                Folder
              </label>
              <select
                id="workspace-note-editor-folder"
                value={state.folderId ?? ''}
                onChange={(event) => dispatch({ type: 'SET_FOLDER', folderId: event.target.value || null })}
                className="flex h-10 w-full rounded-[11px] border border-border bg-card px-3 text-[13px] text-foreground outline-none transition-colors focus:border-ring"
              >
                <option value="">No folder</option>
                {folderOptions.map((folder) => (
                  <option key={folder.value} value={folder.value}>
                    {folder.label}
                  </option>
                ))}
              </select>
            </div>

            {state.errorMessage ? (
              <p className="rounded-[10px] border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-[11px] text-destructive">
                {state.errorMessage}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-[11px] border-border bg-card text-foreground hover:bg-muted"
              onClick={() => onOpenChange(false)}
              disabled={state.saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={state.saving}
              className="h-9 rounded-[11px] bg-primary text-primary-foreground hover:bg-primary/80"
            >
              {state.saving ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
