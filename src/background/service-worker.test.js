import test from 'node:test';
import assert from 'node:assert/strict';

function createEvent() {
    const listeners = [];

    return {
        listeners,
        addListener(listener) {
            listeners.push(listener);
        },
        removeListener(listener) {
            const index = listeners.indexOf(listener);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        },
    };
}

function createStorageArea(initialValues = {}) {
    const store = { ...initialValues };

    const resolveResult = (keys) => {
        if (keys == null) {
            return { ...store };
        }

        const keyList = Array.isArray(keys)
            ? keys
            : typeof keys === 'string'
                ? [keys]
                : Object.keys(keys);
        const result = {};

        for (const key of keyList) {
            if (Object.prototype.hasOwnProperty.call(store, key)) {
                result[key] = store[key];
            } else if (keys && typeof keys === 'object' && !Array.isArray(keys) && typeof keys[key] !== 'undefined') {
                result[key] = keys[key];
            }
        }

        return result;
    };

    return {
        store,
        get(keys, callback) {
            const result = resolveResult(keys);
            if (callback) {
                callback(result);
                return;
            }
            return Promise.resolve(result);
        },
        set(values, callback) {
            Object.assign(store, values);
            callback?.();
            return Promise.resolve();
        },
        remove(keys, callback) {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const key of keyList) {
                delete store[key];
            }
            callback?.();
            return Promise.resolve();
        },
    };
}

function createChromeStub(options = {}) {
    const menuIds = new Set();
    const storageArea = createStorageArea(options.storage);
    const tabs = [...(options.tabs || [])];
    let nextTabId = options.nextTabId || 100;
    let nextGroupId = options.nextGroupId || 900;
    const runtime = {
        lastError: null,
        onInstalled: createEvent(),
        onMessage: createEvent(),
    };

    return {
        menuIds,
        storageData: storageArea.store,
        tabs,
        chrome: {
            runtime,
            storage: {
                local: storageArea,
            },
            contextMenus: {
                onClicked: createEvent(),
                create(properties, callback) {
                    if (menuIds.has(properties.id)) {
                        runtime.lastError = new Error(
                            `Cannot create item with duplicate id ${properties.id}`
                        );
                        callback?.();
                        throw runtime.lastError;
                    }

                    runtime.lastError = null;
                    menuIds.add(properties.id);
                    callback?.();
                },
                removeAll(callback) {
                    menuIds.clear();
                    callback?.();
                },
            },
            commands: {
                onCommand: createEvent(),
            },
            tabs: {
                onActivated: createEvent(),
                onUpdated: createEvent(),
                query(queryInfo, callback) {
                    let result = [...tabs];
                    if (queryInfo?.active) {
                        result = result.filter((tab) => Boolean(tab.active) === Boolean(queryInfo.active));
                    }
                    if (queryInfo?.currentWindow) {
                        result = result.filter((tab) => tab.windowId === 1);
                    }
                    callback?.(result);
                    return Promise.resolve(result);
                },
                create(props, callback) {
                    const tab = {
                        id: nextTabId++,
                        url: props.url,
                        windowId: props.windowId || 1,
                        groupId: -1,
                    };
                    tabs.push(tab);
                    callback?.(tab);
                    return Promise.resolve(tab);
                },
                groupCalls: [],
                group(params, callback) {
                    this.groupCalls.push(params);
                    const groupId = params.groupId ?? nextGroupId++;
                    for (const tab of tabs) {
                        if (params.tabIds.includes(tab.id)) {
                            tab.groupId = groupId;
                        }
                    }
                    callback?.(groupId);
                    return Promise.resolve(groupId);
                },
                createCalls: [],
                sendMessage() {},
                update() {},
            },
            windows: {
                getCurrent: async () => ({}),
            },
            tabGroups: {
                updateCalls: [],
                update(groupId, props, callback) {
                    this.updateCalls.push({ groupId, props });
                    callback?.({ id: groupId, ...props });
                    return Promise.resolve({ id: groupId, ...props });
                },
            },
            sidePanel: {
                open() {},
            },
            action: {
                setBadgeText() {},
                setBadgeBackgroundColor() {},
                setBadgeTextColor() {},
            },
        },
    };
}

test('OPEN_NOTE_TARGET opens a new tab and replays the note target after tab load', async () => {
    const { chrome } = createChromeStub();

    // Extend stub for this test
    chrome.tabs.createCalls = [];
    chrome.tabs.create = (props, callback) => {
        chrome.tabs.createCalls.push(props);
        callback?.({ id: 34, url: props.url, windowId: 1 });
    };
    chrome.tabs.sendMessageCalls = [];
    chrome.tabs.sendMessage = (tabId, payload) => {
        chrome.tabs.sendMessageCalls.push({ tabId, payload });
    };
    chrome.tabs.onUpdated = createEvent();
    chrome.tabs.query = (_query, callback) => {
        if (callback) callback([{ id: 12, url: 'https://other.com', windowId: 1 }]);
        return Promise.resolve([{ id: 12, url: 'https://other.com', windowId: 1 }]);
    };

    globalThis.chrome = chrome;
    await import(new URL(`./service-worker.js?test=${Date.now()}`, import.meta.url));

    const [messageHandler] = chrome.runtime.onMessage.listeners;
    const tabId = 12;

    await new Promise((resolve) => {
        messageHandler(
            { type: 'OPEN_NOTE_TARGET', note: { url: 'https://ign.com/article', elementSelector: '#headline' } },
            { tab: { id: 12, windowId: 1 } },
            resolve
        );
    });

    assert.equal(chrome.tabs.createCalls[0].url, 'https://ign.com/article');
    assert.equal(chrome.tabs.onUpdated.listeners.length > 0, true);

    chrome.tabs.onUpdated.listeners[0](34, { status: 'complete' });

    assert.deepEqual(chrome.tabs.sendMessageCalls[0], {
        tabId: 34,
        payload: {
            type: 'SCROLL_TO_NOTE',
            selector: '#headline',
            note: {
                elementSelector: '#headline',
                elementXPath: undefined,
                elementTextHash: undefined,
                elementPosition: undefined,
                elementTag: undefined,
                url: 'https://ign.com/article',
            },
        },
    });
});

test('OPEN_FOLDER_AS_GROUP reuses an existing folder tab group instead of creating a duplicate group', async () => {
    const { chrome } = createChromeStub({
        storage: {
            divnotes_folders: [
                {
                    id: 'folder-1',
                    name: 'Projects',
                    parentId: null,
                    order: 0,
                    color: '#1a5c2e',
                    pinned: false,
                    createdAt: '2026-04-07T00:00:00.000Z',
                    updatedAt: '2026-04-07T00:00:00.000Z',
                },
            ],
            divnotes_notes: [
                { id: 'note-1', folderId: 'folder-1', url: 'https://example.com/one' },
                { id: 'note-2', folderId: 'folder-1', url: 'https://example.com/two' },
            ],
            divnotes_folder_tab_groups: {
                'folder-1': 77,
            },
        },
        tabs: [
            { id: 12, url: 'https://example.com/existing', windowId: 9, groupId: 77 },
        ],
    });

    chrome.tabs.createCalls = [];
    const originalCreate = chrome.tabs.create;
    chrome.tabs.create = (props, callback) => {
        chrome.tabs.createCalls.push(props);
        return originalCreate.call(chrome.tabs, props, callback);
    };

    globalThis.chrome = chrome;
    await import(new URL(`./service-worker.js?test=${Date.now()}`, import.meta.url));

    const [messageHandler] = chrome.runtime.onMessage.listeners;

    const response = await new Promise((resolve) => {
        messageHandler(
            {
                type: 'OPEN_FOLDER_AS_GROUP',
                folderId: 'folder-1',
                folderName: 'Projects',
                folderColor: '#1a5c2e',
            },
            {},
            resolve
        );
    });

    assert.deepEqual(chrome.tabs.createCalls, [
        { url: 'https://example.com/one', windowId: 9 },
        { url: 'https://example.com/two', windowId: 9 },
    ]);
    assert.deepEqual(chrome.tabs.groupCalls, [
        { groupId: 77, tabIds: [100, 101] },
    ]);
    assert.deepEqual(chrome.tabGroups.updateCalls, [
        {
            groupId: 77,
            props: {
                title: 'Projects',
                color: 'green',
            },
        },
    ]);
    assert.deepEqual(response, { success: true, tabCount: 2 });
});

test('OPEN_FOLDER_AS_GROUP prefers caller folder metadata for the tab-group title', async () => {
    const { chrome, storageData } = createChromeStub({
        storage: {
            divnotes_folders: [
                {
                    id: 'folder-1',
                    name: 'stale local name',
                    parentId: null,
                    order: 0,
                    color: null,
                    pinned: false,
                    createdAt: '2026-04-07T00:00:00.000Z',
                    updatedAt: '2026-04-07T00:00:00.000Z',
                },
            ],
            divnotes_notes: [
                { id: 'note-1', folderId: 'folder-1', url: 'https://example.com/cloud' },
            ],
        },
        nextGroupId: 501,
    });

    globalThis.chrome = chrome;
    await import(new URL(`./service-worker.js?test=${Date.now()}`, import.meta.url));

    const [messageHandler] = chrome.runtime.onMessage.listeners;

    const response = await new Promise((resolve) => {
        messageHandler(
            {
                type: 'OPEN_FOLDER_AS_GROUP',
                folderId: 'folder-1',
                folderName: 'Cloud folder',
                folderColor: '#3d8b5e',
            },
            {},
            resolve
        );
    });

    assert.deepEqual(chrome.tabGroups.updateCalls, [
        {
            groupId: 501,
            props: {
                title: 'Cloud folder',
                color: 'green',
            },
        },
    ]);
    assert.deepEqual(storageData.divnotes_folder_tab_groups, {
        'folder-1': 501,
    });
    assert.deepEqual(response, { success: true, tabCount: 1 });
});

test('re-registering the install menu does not recreate a duplicate context-menu id', async () => {
    const { chrome, menuIds } = createChromeStub();
    globalThis.chrome = chrome;

    await import(new URL(`./service-worker.js?test=${Date.now()}`, import.meta.url));

    const [installHandler] = chrome.runtime.onInstalled.listeners;

    assert.equal(typeof installHandler, 'function');

    installHandler();

    assert.doesNotThrow(() => installHandler());
    assert.deepEqual([...menuIds], ['canopy-add-note']);
});
