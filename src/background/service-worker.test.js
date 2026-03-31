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
    const menuIds = new Set();
    const runtime = {
        lastError: null,
        onInstalled: createEvent(),
        onMessage: createEvent(),
    };

    return {
        menuIds,
        chrome: {
            runtime,
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
                query: async () => [],
                sendMessage() {},
                update() {},
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
        },
    };
}

test('OPEN_NOTE_TARGET navigates and replays the note target after tab load', async () => {
    const { chrome } = createChromeStub();

    // Extend stub for this test
    chrome.tabs.updateCalls = [];
    const originalUpdate = chrome.tabs.update;
    chrome.tabs.update = (tabId, props) => {
        chrome.tabs.updateCalls.push({ tabId, url: props.url });
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
            { tab: { id: tabId, windowId: 1 } },
            resolve
        );
    });

    assert.equal(chrome.tabs.updateCalls[0].url, 'https://ign.com/article');
    assert.equal(chrome.tabs.onUpdated.listeners.length > 0, true);
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
