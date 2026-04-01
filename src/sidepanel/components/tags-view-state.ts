export type SidepanelTagsEmptyStateMode = 'select-tags' | 'tag-empty' | 'search-empty' | null;

interface ResolveSidepanelTagsEmptyStateInput {
  selectedTagIds: string[];
  searchQuery: string;
  notesMatchingTagsCount: number;
  searchFilteredNotesCount: number;
}

export function resolveSidepanelTagsEmptyState({
  selectedTagIds,
  searchQuery,
  notesMatchingTagsCount,
  searchFilteredNotesCount,
}: ResolveSidepanelTagsEmptyStateInput): SidepanelTagsEmptyStateMode {
  if (selectedTagIds.length === 0) {
    return 'select-tags';
  }

  if (notesMatchingTagsCount === 0) {
    return 'tag-empty';
  }

  if (searchQuery.trim() && searchFilteredNotesCount === 0) {
    return 'search-empty';
  }

  return null;
}
