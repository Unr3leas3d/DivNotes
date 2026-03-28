import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isTagNameConflictError,
  remapTagConflictState,
} from './tag-sync-utils.ts';

test('isTagNameConflictError matches unique name conflicts', () => {
  assert.equal(
    isTagNameConflictError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "idx_tags_user_name"',
    }),
    true
  );

  assert.equal(
    isTagNameConflictError({
      code: '22001',
      message: 'some other database error',
    }),
    false
  );
});

test('remapTagConflictState rewrites notes and queued note-tag associations to the canonical tag id', () => {
  const result = remapTagConflictState({
    localTagId: 'local-tag',
    canonicalTag: {
      id: 'canonical-tag',
      name: 'work',
      color: '#22c55e',
      createdAt: '2026-03-27T00:00:00.000Z',
      updatedAt: '2026-03-27T00:00:00.000Z',
    },
    tags: [
      {
        id: 'local-tag',
        name: 'work',
        color: '#ef4444',
        createdAt: '2026-03-27T00:00:00.000Z',
        updatedAt: '2026-03-27T00:00:00.000Z',
      },
    ],
    notes: [
      {
        id: 'note-1',
        url: 'https://example.com',
        hostname: 'example.com',
        pageTitle: 'Example',
        elementSelector: '.note-1',
        elementTag: 'div',
        elementInfo: 'Example',
        content: '#work',
        createdAt: '2026-03-27T00:00:00.000Z',
        folderId: null,
        tags: ['local-tag', 'keep-tag'],
        pinned: false,
      },
    ],
    queue: [
      {
        id: 'queue-tag-save',
        entityType: 'tag',
        action: 'save',
        entityId: 'local-tag',
        payload: { id: 'local-tag', name: 'work' },
        timestamp: 1,
      },
      {
        id: 'queue-tag-update',
        entityType: 'tag',
        action: 'update',
        entityId: 'local-tag',
        payload: { id: 'local-tag', color: '#ef4444' },
        timestamp: 2,
      },
      {
        id: 'queue-note-tag-local',
        entityType: 'note_tag',
        action: 'save',
        entityId: 'note-1:local-tag',
        payload: { note_id: 'note-1', tag_id: 'local-tag' },
        timestamp: 3,
      },
      {
        id: 'queue-note-tag-canonical',
        entityType: 'note_tag',
        action: 'save',
        entityId: 'note-1:canonical-tag',
        payload: { note_id: 'note-1', tag_id: 'canonical-tag' },
        timestamp: 4,
      },
    ],
  });

  assert.deepEqual(result.tags.map((tag) => tag.id), ['canonical-tag']);
  assert.deepEqual(result.notes[0].tags, ['canonical-tag', 'keep-tag']);

  assert.equal(
    result.queue.some(
      (item) =>
        item.entityType === 'tag' &&
        item.action === 'save' &&
        item.entityId === 'local-tag'
    ),
    false
  );

  assert.equal(
    result.queue.some(
      (item) =>
        item.entityType === 'tag' &&
        item.action === 'update' &&
        item.entityId === 'canonical-tag' &&
        item.payload?.id === 'canonical-tag'
    ),
    true
  );

  assert.equal(
    result.queue.filter(
      (item) =>
        item.entityType === 'note_tag' &&
        item.action === 'save' &&
        item.entityId === 'note-1:canonical-tag'
    ).length,
    1
  );
});
