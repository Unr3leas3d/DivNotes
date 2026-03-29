import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveStoredTagLabels } from './note-editor-helpers.ts';

test('resolveStoredTagLabels maps canonical tag ids to display names', () => {
  const labels = resolveStoredTagLabels(
    ['tag-1', 'research', 'tag-1'],
    [
      {
        id: 'tag-1',
        name: 'research',
      },
    ]
  );

  assert.deepEqual(labels, ['research']);
});

test('resolveStoredTagLabels preserves unknown tag values', () => {
  assert.deepEqual(resolveStoredTagLabels(['orphan-tag'], []), ['orphan-tag']);
});
