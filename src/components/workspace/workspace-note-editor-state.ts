import { getAncestorPath } from '../../lib/tree-utils.ts';
import type { StoredFolder } from '../../lib/types.ts';

interface WorkspaceNoteEditorResetArgs {
  previousOpen: boolean;
  nextOpen: boolean;
  previousNoteId: string;
  nextNoteId: string;
}

export interface WorkspaceNoteFolderOption {
  value: string;
  label: string;
}

export function shouldReinitializeWorkspaceNoteEditor({
  previousOpen,
  nextOpen,
  previousNoteId,
  nextNoteId,
}: WorkspaceNoteEditorResetArgs) {
  if (!nextOpen) {
    return false;
  }

  return !previousOpen || previousNoteId !== nextNoteId;
}

export function buildWorkspaceNoteFolderOptions(
  folders: StoredFolder[]
): WorkspaceNoteFolderOption[] {
  return folders
    .map((folder) => ({
      value: folder.id,
      label: getAncestorPath(folder.id, folders)
        .map((ancestor) => ancestor.name)
        .join(' / '),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}
