export type NewFolderValidationResult =
  | { valid: true; value: string }
  | { valid: false; error: string };

export interface ClearAllDialogState {
  type: 'clear-all';
  error: string | null;
}

export function validateNewFolderName(name: string): NewFolderValidationResult {
  const value = name.trim();
  if (!value) {
    return { valid: false, error: 'Please enter a folder name.' };
  }

  return { valid: true, value };
}

export function getInitialClearAllDialogState(): ClearAllDialogState {
  return { type: 'clear-all', error: null };
}

export function prepareClearAllDialogForSubmit(
  state: ClearAllDialogState
): ClearAllDialogState {
  return { ...state, error: null };
}

export function resolveClearAllDialogError(caughtError: unknown): string {
  return caughtError instanceof Error ? caughtError.message : 'Failed to clear all notes';
}
