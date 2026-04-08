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
  storageState.divnotes_account = {
    authMode: 'authenticated',
    email: 'pro@example.com',
    plan: 'pro',
    entitlementStatus: 'active',
    billingProvider: 'polar',
    subscriptionInterval: 'monthly',
    currentPeriodEnd: null,
    providerSubscriptionStatus: 'active',
    cloudSyncEnabled: true,
  };
  storageState.divnotes_sync_queue = [];

  await import(new URL(`../src/background/service-worker.js?test=${Date.now()}`, import.meta.url));

  const response = await sendRuntimeMessage(chrome, {
    type: 'SYNC_NOTE_TAGS',
    noteId: 'note-1',
    tagNames: ['keep'],
    previousTagNames: ['keep', 'remove'],
  });

  assert.deepEqual(response, { success: true, tagIds: ['tag-keep'] });
  assert.deepEqual(storageState.divnotes_notes[0].tags, ['tag-keep']);
  assert.deepEqual(storageState.divnotes_tags.map((tag) => tag.id), ['tag-keep']);
  assert.deepEqual(
    storageState.divnotes_sync_queue.map((item) => ({
      entityType: item.entityType,
      action: item.action,
      entityId: item.entityId,
      payload: item.payload,
    })),
    [
      {
        entityType: 'note_tag',
        action: 'delete',
        entityId: 'note-1:tag-remove',
        payload: { note_id: 'note-1', tag_id: 'tag-remove' },
      },
      {
        entityType: 'tag',
        action: 'delete',
        entityId: 'tag-remove',
        payload: undefined,
      },
    ]
  );
});

test('SYNC_NOTE_TAGS deletes a tag when its note count drops to zero', async () => {
  const { chrome, storageState } = createChromeStub();
  globalThis.chrome = chrome;

  storageState.divnotes_tags = [
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
      tags: ['tag-remove'],
    },
  ];
  storageState.divnotes_account = {
    authMode: 'authenticated',
    email: 'pro@example.com',
    plan: 'pro',
    entitlementStatus: 'active',
    billingProvider: 'polar',
    subscriptionInterval: 'monthly',
    currentPeriodEnd: null,
    providerSubscriptionStatus: 'active',
    cloudSyncEnabled: true,
  };
  storageState.divnotes_sync_queue = [];

  await import(new URL(`../src/background/service-worker.js?test=${Date.now()}`, import.meta.url));

  const response = await sendRuntimeMessage(chrome, {
    type: 'SYNC_NOTE_TAGS',
    noteId: 'note-1',
    tagNames: [],
    previousTagNames: ['remove'],
  });

  assert.deepEqual(response, { success: true, tagIds: [] });
  assert.deepEqual(storageState.divnotes_notes[0].tags, []);
  assert.deepEqual(storageState.divnotes_tags, []);

  const queuedDeletes = storageState.divnotes_sync_queue.map((item) => ({
    entityType: item.entityType,
    action: item.action,
    entityId: item.entityId,
    payload: item.payload,
  }));

  assert.deepEqual(queuedDeletes, [
    {
      entityType: 'note_tag',
      action: 'delete',
      entityId: 'note-1:tag-remove',
      payload: { note_id: 'note-1', tag_id: 'tag-remove' },
    },
    {
      entityType: 'tag',
      action: 'delete',
      entityId: 'tag-remove',
      payload: undefined,
    },
  ]);
});
