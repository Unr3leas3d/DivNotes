export type NewFolderValidationResult =
  | { valid: true; value: string }
  | { valid: false; error: string };

export function validateNewFolderName(name: string): NewFolderValidationResult {
  const value = name.trim();
  if (!value) {
    return { valid: false, error: 'Please enter a folder name.' };
  }

  return { valid: true, value };
}
