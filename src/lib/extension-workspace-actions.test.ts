import assert from 'node:assert/strict';
import test from 'node:test';

import type { SyncQueueItem, StoredFolder, StoredNote, StoredTag } from './types.ts';

test('pruneImportedWorkspaceQueueEntries removes stale queue entries for imported entities', async () => {
  const originalChrome = globalThis.chrome;
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalClearInterval = globalThis.clearInterval;

  globalThis.chrome = {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => undefined,
        remove: async () => undefined,
      },
    },
  } as typeof chrome;

  globalThis.setTimeout = ((() => 0) as unknown) as typeof setTimeout;
  globalThis.setInterval = ((() => 0) as unknown) as typeof setInterval;
  globalThis.clearTimeout = ((() => undefined) as unknown) as typeof clearTimeout;
  globalThis.clearInterval = ((() => undefined) as unknown) as typeof clearInterval;

  try {
    const { pruneImportedWorkspaceQueueEntries } = await import(
      './extension-workspace-actions.ts'
    );

    const importedNotes: StoredNote[] = [
      {
        id: 'note-1',
        url: 'https://example.com',
        hostname: 'example.com',
        pageTitle: 'Example',
        elementSelector: '#note-1',
        elementTag: 'div',
        elementInfo: 'Imported note',
        content: 'Imported content',
        createdAt: '2026-03-29T00:00:00.000Z',
        folderId: 'folder-1',
        tags: ['tag-1'],
        pinned: false,
      },
    ];

    const importedFolders: StoredFolder[] = [
      {
        id: 'folder-1',
        name: 'Imported folder',
        parentId: null,
        order: 0,
        color: null,
        pinned: false,
        createdAt: '2026-03-29T00:00:00.000Z',
        updatedAt: '2026-03-29T00:00:00.000Z',
      },
    ];

    const importedTags: StoredTag[] = [
      {
        id: 'tag-1',
        name: 'Imported tag',
        color: '#052415',
        createdAt: '2026-03-29T00:00:00.000Z',
        updatedAt: '2026-03-29T00:00:00.000Z',
      },
    ];

    const queue: SyncQueueItem[] = [
      {
        id: 'note-save',
        entityType: 'note',
        action: 'save',
        entityId: 'note-1',
        payload: { id: 'note-1', content: 'stale note content' },
        timestamp: 1,
      },
      {
        id: 'folder-update',
        entityType: 'folder',
        action: 'update',
        entityId: 'folder-1',
        payload: { id: 'folder-1', name: 'stale folder name' },
        timestamp: 2,
      },
      {
        id: 'tag-delete',
        entityType: 'tag',
        action: 'delete',
        entityId: 'tag-1',
        timestamp: 3,
      },
      {
        id: 'note-tag-save',
        entityType: 'note_tag',
        action: 'save',
        entityId: 'note-1:tag-1',
        payload: { note_id: 'note-1', tag_id: 'tag-1' },
        timestamp: 4,
      },
      {
        id: 'unrelated-note-save',
        entityType: 'note',
        action: 'save',
        entityId: 'note-2',
        payload: { id: 'note-2', content: 'keep me' },
        timestamp: 5,
      },
      {
        id: 'unrelated-note-tag',
        entityType: 'note_tag',
        action: 'delete',
        entityId: 'note-2:tag-2',
        payload: { note_id: 'note-2', tag_id: 'tag-2' },
        timestamp: 6,
      },
    ];

    const result = pruneImportedWorkspaceQueueEntries(queue, {
      notes: importedNotes,
      folders: importedFolders,
      tags: importedTags,
    });

    assert.deepEqual(result.map((item) => item.id), [
      'unrelated-note-save',
      'unrelated-note-tag',
    ]);
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.clearInterval = originalClearInterval;
  }
});
