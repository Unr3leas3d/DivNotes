import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWorkspaceNoteFolderOptions,
  shouldReinitializeWorkspaceNoteEditor,
} from './workspace-note-editor-state.ts';
import type { StoredFolder } from '../../lib/types.ts';

test('does not rehydrate draft when the same note id refreshes while open', () => {
  const shouldReset = shouldReinitializeWorkspaceNoteEditor({
    previousOpen: true,
    nextOpen: true,
    previousNoteId: 'note-1',
    nextNoteId: 'note-1',
  });

  assert.equal(shouldReset, false);
});

test('rehydrates draft when opening or switching to a different note id', () => {
  assert.equal(
    shouldReinitializeWorkspaceNoteEditor({
      previousOpen: false,
      nextOpen: true,
      previousNoteId: 'note-1',
      nextNoteId: 'note-1',
    }),
    true
  );

  assert.equal(
    shouldReinitializeWorkspaceNoteEditor({
      previousOpen: true,
      nextOpen: true,
      previousNoteId: 'note-1',
      nextNoteId: 'note-2',
    }),
    true
  );
});

test('nested folders with duplicate leaf names get distinct path labels', () => {
  const folders: StoredFolder[] = [
    {
      id: 'root-a',
      name: 'Projects',
      parentId: null,
      order: 2,
      color: null,
      pinned: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'root-b',
      name: 'Archive',
      parentId: null,
      order: 1,
      color: null,
      pinned: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'child-a',
      name: 'Sprint',
      parentId: 'root-a',
      order: 1,
      color: null,
      pinned: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'child-b',
      name: 'Sprint',
      parentId: 'root-b',
      order: 1,
      color: null,
      pinned: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const options = buildWorkspaceNoteFolderOptions(folders);

  assert.deepEqual(options, [
    { value: 'root-b', label: 'Archive' },
    { value: 'child-b', label: 'Archive / Sprint' },
    { value: 'root-a', label: 'Projects' },
    { value: 'child-a', label: 'Projects / Sprint' },
  ]);
});
