import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveSidepanelTagsEmptyState } from './tags-view-state.ts';

test('keeps tag-filter empty state when tags already match zero notes', () => {
  const result = resolveSidepanelTagsEmptyState({
    selectedTagIds: ['tag-1'],
    searchQuery: 'missing terms',
    notesMatchingTagsCount: 0,
    searchFilteredNotesCount: 0,
  });

  assert.equal(result, 'tag-empty');
});

test('shows search empty state when search removes the remaining tag matches', () => {
  const result = resolveSidepanelTagsEmptyState({
    selectedTagIds: ['tag-1'],
    searchQuery: 'missing terms',
    notesMatchingTagsCount: 3,
    searchFilteredNotesCount: 0,
  });

  assert.equal(result, 'search-empty');
});
