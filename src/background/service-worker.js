// Canopy Service Worker (Background Script)
// Plain JS — copied directly to dist (no build step)

const ADD_NOTE_MENU_ID = 'canopy-add-note';

function registerSelectionContextMenu() {
    chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) {
            console.warn('Failed to clear Canopy context menus:', chrome.runtime.lastError.message);
        }

        chrome.contextMenus.create(
            {
                id: ADD_NOTE_MENU_ID,
                title: 'Add Canopy Note',
                contexts: ['selection'],
            },
            () => {
                if (chrome.runtime.lastError) {
                    console.warn(
                        'Failed to create Canopy context menu:',
                        chrome.runtime.lastError.message
                    );
                }
            }
        );
    });
}

// Handle extension install — create context menu
chrome.runtime.onInstalled.addListener(() => {
    console.log('Canopy installed');

    registerSelectionContextMenu();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === ADD_NOTE_MENU_ID && tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
            type: 'ADD_SELECTION_NOTE',
            selectionText: info.selectionText || '',
        });
    }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (command === 'toggle-notes') {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_NOTES' });
    } else if (command === 'activate-inspector') {
        chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_INSPECTOR' });
    } else if (command === 'presentation-mode') {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SCREEN_SHARE' });
        const win = await chrome.windows.getCurrent();
        if (chrome.sidePanel && win.id) {
            chrome.sidePanel.open({ windowId: win.id });
        }
    }
});

// Pending note targets keyed by tab id (for cross-page navigation)
const pendingNoteTargets = new Map();

function normalizeUrl(url) {
    try {
        const u = new URL(url);
        u.hash = '';
        return u.href;
    } catch {
        return url;
    }
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_NOTE_TARGET') {
        const note = message.note;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) {
                sendResponse({ success: false });
                return;
            }

            if (normalizeUrl(tab.url || '') === normalizeUrl(note.url)) {
                // Already on the right page — send directly
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SCROLL_TO_NOTE',
                    selector: note.elementSelector,
                    note: {
                        elementSelector: note.elementSelector,
                        elementXPath: note.elementXPath,
                        elementTextHash: note.elementTextHash,
                        elementPosition: note.elementPosition,
                        elementTag: note.elementTag,
                        url: note.url,
                    },
                });
                sendResponse({ success: true });
                return;
            }

            // Navigate and replay after load
            pendingNoteTargets.set(tab.id, note);
            chrome.tabs.update(tab.id, { url: note.url });

            const onUpdated = (tabId, changeInfo) => {
                if (tabId === tab.id && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(onUpdated);
                    const pending = pendingNoteTargets.get(tabId);
                    if (pending) {
                        pendingNoteTargets.delete(tabId);
                        chrome.tabs.sendMessage(tabId, {
                            type: 'SCROLL_TO_NOTE',
                            selector: pending.elementSelector,
                            note: {
                                elementSelector: pending.elementSelector,
                                elementXPath: pending.elementXPath,
                                elementTextHash: pending.elementTextHash,
                                elementPosition: pending.elementPosition,
                                elementTag: pending.elementTag,
                                url: pending.url,
                            },
                        });
                    }
                }
            };
            chrome.tabs.onUpdated.addListener(onUpdated);
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.type === 'ACTIVATE_INSPECTOR') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'ACTIVATE_INSPECTOR' });
            }
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.type === 'TOGGLE_NOTES') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_NOTES' });
            }
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.type === 'OPEN_SIDE_PANEL') {
        const windowId = message.windowId || sender.tab?.windowId;
        if (chrome.sidePanel && windowId) {
            chrome.sidePanel.open({ windowId });
        }
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'OPEN_POPUP') {
        if (!chrome.action?.openPopup) {
            sendResponse({ success: false, error: 'Popup opening is not supported in this browser context.' });
            return true;
        }

        Promise.resolve(chrome.action.openPopup())
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to open popup.',
                });
            });
        return true;
    }

    if (message.type === 'UPDATE_BADGE_COUNT') {
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'SYNC_NOTE_TAGS') {
        const { noteId, tagNames, previousTagNames } = message;
        chrome.storage.local.get(['divnotes_tags', 'divnotes_notes'], (result) => {
            const tags = result.divnotes_tags || [];
            const notes = result.divnotes_notes || [];
            const resolvedTagIds = [];
            const newlyCreatedTagIds = new Set();
            const normalizedTagNames = [...new Set(
                (Array.isArray(tagNames) ? tagNames : [])
                    .map((name) => typeof name === 'string' ? name.trim().toLowerCase() : '')
                    .filter(Boolean)
            )];

            const resolveExistingTagIds = (values) => {
                const resolved = [];
                const seen = new Set();

                for (const value of Array.isArray(values) ? values : []) {
                    if (typeof value !== 'string') {
                        continue;
                    }

                    const normalized = value.trim().toLowerCase();
                    if (!normalized) {
                        continue;
                    }

                    const tag = tags.find((candidate) =>
                        candidate.id === value || candidate.name.toLowerCase() === normalized
                    );
                    if (!tag || seen.has(tag.id)) {
                        continue;
                    }

                    seen.add(tag.id);
                    resolved.push(tag.id);
                }

                return resolved;
            };

            for (const normalized of normalizedTagNames) {
                let tag = tags.find(t => t.name.toLowerCase() === normalized);
                if (!tag) {
                    // Duplicated from src/lib/types.ts TAG_COLORS — keep in sync
                    const TAG_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#6366f1','#a855f7','#ec4899'];
                    tag = {
                        id: crypto.randomUUID(),
                        name: normalized,
                        color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };
                    tags.push(tag);
                    newlyCreatedTagIds.add(tag.id);
                }
                resolvedTagIds.push(tag.id);
            }

            const noteIdx = notes.findIndex(n => n.id === noteId);
            const existingTags = resolveExistingTagIds(
                Array.isArray(previousTagNames)
                    ? previousTagNames
                    : (noteIdx > -1 ? (notes[noteIdx].tags || []) : [])
            );
            if (noteIdx > -1) {
                notes[noteIdx].tags = resolvedTagIds;
            }

            // Compute which note_tag associations are actually new
            const newAssociations = resolvedTagIds.filter(id => !existingTags.includes(id));
            const removedAssociations = existingTags.filter(id => !resolvedTagIds.includes(id));

            chrome.storage.local.set({
                divnotes_tags: tags,
                divnotes_notes: notes,
            }, () => {
                // Enqueue cloud sync only for new items
                chrome.storage.local.get(['divnotes_sync_queue'], (syncRes) => {
                    const queue = syncRes.divnotes_sync_queue || [];

                    // De-duplicate helper: skip if queue already has matching entry
                    const hasEntry = (entityType, action, entityId) =>
                        queue.some(q => q.entityType === entityType && q.action === action && q.entityId === entityId);

                    // Only enqueue tag:save for newly created tags
                    for (const tagId of newlyCreatedTagIds) {
                        if (!hasEntry('tag', 'save', tagId)) {
                            const tag = tags.find(t => t.id === tagId);
                            queue.push({
                                id: crypto.randomUUID(),
                                entityType: 'tag',
                                action: 'save',
                                entityId: tagId,
                                payload: tag,
                                timestamp: Date.now(),
                            });
                        }
                    }
                    // Only enqueue note_tag:save for associations that didn't exist before
                    for (const tagId of newAssociations) {
                        const entityId = `${noteId}:${tagId}`;
                        if (!hasEntry('note_tag', 'save', entityId)) {
                            queue.push({
                                id: crypto.randomUUID(),
                                entityType: 'note_tag',
                                action: 'save',
                                entityId,
                                payload: { note_id: noteId, tag_id: tagId },
                                timestamp: Date.now(),
                            });
                        }
                    }
                    for (const tagId of removedAssociations) {
                        const entityId = `${noteId}:${tagId}`;
                        if (!hasEntry('note_tag', 'delete', entityId)) {
                            queue.push({
                                id: crypto.randomUUID(),
                                entityType: 'note_tag',
                                action: 'delete',
                                entityId,
                                payload: { note_id: noteId, tag_id: tagId },
                                timestamp: Date.now(),
                            });
                        }
                    }
                    chrome.storage.local.set({ divnotes_sync_queue: queue }, () => {
                        sendResponse({ success: true, tagIds: resolvedTagIds });
                    });
                });
            });
        });
        return true;
    }

    if (message.type === 'CREATE_FOLDER') {
        const { name, parentId } = message;
        chrome.storage.local.get(['divnotes_folders'], (result) => {
            const folders = result.divnotes_folders || [];
            const siblings = folders.filter(f => f.parentId === parentId);
            const order = siblings.length > 0 ? Math.max(...siblings.map(f => f.order)) + 1 : 0;
            const folder = {
                id: crypto.randomUUID(),
                name,
                parentId: parentId || null,
                order,
                color: null,
                pinned: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            folders.push(folder);
            chrome.storage.local.set({ divnotes_folders: folders }, () => {
                // Enqueue cloud sync for the new folder
                chrome.storage.local.get(['divnotes_sync_queue'], (syncRes) => {
                    const queue = syncRes.divnotes_sync_queue || [];
                    queue.push({
                        id: crypto.randomUUID(),
                        entityType: 'folder',
                        action: 'save',
                        entityId: folder.id,
                        payload: folder,
                        timestamp: Date.now(),
                    });
                    chrome.storage.local.set({ divnotes_sync_queue: queue }, () => {
                        sendResponse({ success: true, folder });
                    });
                });
            });
        });
        return true;
    }

    // Always send response for unhandled messages to avoid port closure errors
    sendResponse({ unhandled: true });
    return false;
});

