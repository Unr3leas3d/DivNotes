import assert from 'node:assert/strict';
import test from 'node:test';

import { pruneUnusedTags } from './tag-cleanup.ts';
import type { StoredNote, StoredTag } from './types.ts';

const sampleTags: StoredTag[] = [
  {
    id: 'tag-1',
    name: 'important',
    color: '#052415',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'tag-2',
    name: 'research',
    color: '#1a5c2e',
    createdAt: '2026-03-02T00:00:00.000Z',
    updatedAt: '2026-03-02T00:00:00.000Z',
  },
];

const baseNote: Omit<StoredNote, 'id' | 'tags'> = {
  url: 'https://example.com/page',
  hostname: 'example.com',
  pageTitle: 'Page',
  elementSelector: '#note',
  elementTag: 'div',
  elementInfo: 'Info',
  content: 'Body',
  createdAt: '2026-03-10T10:00:00.000Z',
  updatedAt: '2026-03-10T10:00:00.000Z',
  folderId: null,
  pinned: false,
};

test('pruneUnusedTags removes tags that no note references', () => {
  const notes: StoredNote[] = [
    {
      ...baseNote,
      id: 'note-1',
      tags: ['tag-1'],
    },
  ];

  const result = pruneUnusedTags(sampleTags, notes);

  assert.deepEqual(result.remainingTags.map((tag) => tag.id), ['tag-1']);
  assert.deepEqual(result.removedTags.map((tag) => tag.id), ['tag-2']);
});

test('pruneUnusedTags resolves note tag names against the current tag catalog', () => {
  const notes: StoredNote[] = [
    {
      ...baseNote,
      id: 'note-1',
      tags: ['research'],
    },
  ];

  const result = pruneUnusedTags(sampleTags, notes);

  assert.deepEqual(result.remainingTags.map((tag) => tag.id), ['tag-2']);
  assert.deepEqual(result.removedTags.map((tag) => tag.id), ['tag-1']);
});
