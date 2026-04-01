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
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b968f]"
              >
                Note
              </label>
              <Textarea
                id="workspace-note-editor-content"
                value={state.body}
                onChange={(event) => dispatch({ type: 'SET_BODY', body: event.target.value })}
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
                value={state.folderId ?? ''}
                onChange={(event) => dispatch({ type: 'SET_FOLDER', folderId: event.target.value || null })}
                className="flex h-10 w-full rounded-[11px] border border-[#e7e2d8] bg-white px-3 text-[13px] text-[#173628] outline-none transition-colors focus:border-[#173628]/30"
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
              <p className="rounded-[10px] border border-[rgba(220,38,38,0.15)] bg-[rgba(254,242,242,0.75)] px-2.5 py-2 text-[11px] text-[#b91c1c]">
                {state.errorMessage}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-[11px] border-[#e7e2d8] bg-white text-[#445348] hover:bg-[#f8f6f1]"
              onClick={() => onOpenChange(false)}
              disabled={state.saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={state.saving}
              className="h-9 rounded-[11px] bg-[#173628] text-[#f5efe9] hover:bg-[#10271d]"
            >
              {state.saving ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
