import test from 'node:test';
import assert from 'node:assert/strict';

function createEvent() {
  const listeners = [];

  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    },
  };
}

function createChromeStub() {
  const storageState = {};

  return {
    storageState,
    chrome: {
      runtime: {
        lastError: null,
        onInstalled: createEvent(),
        onMessage: createEvent(),
      },
      contextMenus: {
        onClicked: createEvent(),
        create(_properties, callback) {
          callback?.();
        },
        removeAll(callback) {
          callback?.();
        },
      },
      commands: {
        onCommand: createEvent(),
      },
      tabs: {
        onActivated: createEvent(),
        query: async () => [],
        sendMessage() {},
      },
      windows: {
        getCurrent: async () => ({}),
      },
      sidePanel: {
        open() {},
      },
      action: {
        setBadgeText() {},
        setBadgeBackgroundColor() {},
        setBadgeTextColor() {},
      },
      storage: {
        local: {
          get(keys, callback) {
            if (Array.isArray(keys)) {
              const result = {};
              for (const key of keys) {
                result[key] = storageState[key];
              }
              callback(result);
              return;
            }

            callback({ ...storageState });
          },
          set(items, callback) {
            Object.assign(storageState, items);
            callback?.();
          },
        },
      },
    },
  };
}

async function sendRuntimeMessage(chrome, message, sender = {}) {
  const [listener] = chrome.runtime.onMessage.listeners;

  assert.equal(typeof listener, 'function');

  return new Promise((resolve) => {
    const keepChannelOpen = listener(message, sender, (response) => resolve(response));
    assert.equal(keepChannelOpen, true);
  });
}

test('SYNC_NOTE_TAGS removes stale note_tag links and queues durable deletes', async () => {
  const { chrome, storageState } = createChromeStub();
  globalThis.chrome = chrome;

  storageState.divnotes_tags = [
    {
      id: 'tag-keep',
      name: 'keep',
      color: '#22c55e',
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    },
    {
      id: 'tag-remove',
      name: 'remove',
      color: '#ef4444',
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
    },
  ];
  storageState.divnotes_notes = [
    {
      id: 'note-1',
      tags: ['keep'],
    },
  ];
  storageState.divnotes_sync_queue = [];

  await import(new URL(`../src/background/service-worker.js?test=${Date.now()}`, import.meta.url));

  const response = await sendRuntimeMessage(chrome, {
    type: 'SYNC_NOTE_TAGS',
    noteId: 'note-1',
    tagNames: ['keep'],
    previousTagNames: ['keep', 'remove'],
  });

  assert.deepEqual(response, { success: true, tagIds: ['tag-keep'] });
  assert.deepEqual(storageState.divnotes_notes[0].tags, ['keep']);
  assert.equal(storageState.divnotes_sync_queue.length, 1);
  assert.deepEqual(
    storageState.divnotes_sync_queue[0],
    {
      id: storageState.divnotes_sync_queue[0].id,
      entityType: 'note_tag',
      action: 'delete',
      entityId: 'note-1:tag-remove',
      payload: { note_id: 'note-1', tag_id: 'tag-remove' },
      timestamp: storageState.divnotes_sync_queue[0].timestamp,
    }
  );
});
