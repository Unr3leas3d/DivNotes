import assert from 'node:assert/strict';
import test from 'node:test';

import type { StoredNote, StoredTag } from './types.ts';
import { mergeImportedWorkspaceData } from './extension-workspace-helpers.ts';

test('mergeImportedWorkspaceData canonicalizes imported note tags to tag ids', () => {
  const importedNote: StoredNote = {
    id: 'note-1',
    url: 'https://example.com',
    hostname: 'example.com',
    pageTitle: 'Example',
    elementSelector: '#note-1',
    elementTag: 'div',
    elementInfo: 'Imported note',
    content: 'Imported content',
    createdAt: '2026-03-29T00:00:00.000Z',
    folderId: null,
    tags: ['research'],
    pinned: false,
  };

  const catalogTag: StoredTag = {
    id: 'tag-1',
    name: 'research',
    color: '#052415',
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:00.000Z',
  };

  const merged = mergeImportedWorkspaceData(
    {
      notes: [],
      folders: [],
      tags: [catalogTag],
    },
    {
      notes: [importedNote],
      folders: [],
      tags: [],
    }
  );

  assert.deepEqual(merged.notes[0]?.tags, ['tag-1']);
});
