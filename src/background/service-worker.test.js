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
        },
    };
}

test('re-registering the install menu does not recreate a duplicate context-menu id', async () => {
    const { chrome, menuIds } = createChromeStub();
    globalThis.chrome = chrome;

    await import(new URL(`./service-worker.js?test=${Date.now()}`, import.meta.url));

    const [installHandler] = chrome.runtime.onInstalled.listeners;

    assert.equal(typeof installHandler, 'function');

    installHandler();

    assert.doesNotThrow(() => installHandler());
    assert.deepEqual([...menuIds], ['divnotes-add-note']);
});
