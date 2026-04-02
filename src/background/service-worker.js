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

/**
 * Validate a URL is safe for tab navigation.
 * Only allows http: and https: schemes.
 */
function isSafeUrl(url) {
    if (typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

// Chrome tab group color mapping
const CHROME_COLORS = [
    { name: 'grey',   rgb: [128, 128, 128] },
    { name: 'blue',   rgb: [66, 133, 244] },
    { name: 'red',    rgb: [234, 67, 53] },
    { name: 'yellow', rgb: [251, 188, 4] },
    { name: 'green',  rgb: [52, 168, 83] },
    { name: 'pink',   rgb: [255, 105, 180] },
    { name: 'purple', rgb: [103, 58, 183] },
    { name: 'cyan',   rgb: [0, 188, 212] },
];

function hexToChromeColor(hex) {
    if (!hex) return 'grey';
    const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!match) return 'grey';
    const rgb = [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
    let closest = 'grey';
    let minDist = Infinity;
    for (const entry of CHROME_COLORS) {
        const dist = Math.sqrt(
            (rgb[0] - entry.rgb[0]) ** 2 +
            (rgb[1] - entry.rgb[1]) ** 2 +
            (rgb[2] - entry.rgb[2]) ** 2
        );
        if (dist < minDist) {
            minDist = dist;
            closest = entry.name;
        }
    }
    return closest;
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_NOTE_TARGET') {
        const note = message.note;

        // Validate note payload shape
        if (!note || typeof note !== 'object' || !isSafeUrl(note.url)) {
            sendResponse({ success: false, error: 'Invalid note target' });
            return true;
        }

        const normalizedNoteUrl = normalizeUrl(note.url);
        const scrollPayload = {
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
        };

        // Search all tabs for one already on this URL
        chrome.tabs.query({}, (allTabs) => {
            const matchingTab = allTabs.find(
                (t) => t.url && normalizeUrl(t.url) === normalizedNoteUrl
            );

            if (matchingTab && matchingTab.id) {
                // Tab exists — activate it and scroll to note
                chrome.tabs.update(matchingTab.id, { active: true });
                if (matchingTab.windowId) {
                    chrome.windows.update(matchingTab.windowId, { focused: true });
                }
                chrome.tabs.sendMessage(matchingTab.id, scrollPayload);
                sendResponse({ success: true });
            } else {
                // No matching tab — create a new one (never navigate the current tab away)
                chrome.tabs.create({ url: note.url }, (newTab) => {
                    if (!newTab.id) {
                        sendResponse({ success: false, error: 'Failed to create tab' });
                        return;
                    }
                    pendingNoteTargets.set(newTab.id, note);
                    const onUpdated = (tabId, changeInfo) => {
                        if (tabId === newTab.id && changeInfo.status === 'complete') {
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
            }
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
                chrome.storage.local.get(['divnotes_account', 'divnotes_sync_queue'], (syncRes) => {
                    const cloudSyncEnabled = Boolean(syncRes.divnotes_account?.cloudSyncEnabled);
                    if (!cloudSyncEnabled) {
                        sendResponse({ success: true, tagIds: resolvedTagIds });
                        return;
                    }

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
                chrome.storage.local.get(['divnotes_account', 'divnotes_sync_queue'], (syncRes) => {
                    const cloudSyncEnabled = Boolean(syncRes.divnotes_account?.cloudSyncEnabled);
                    if (!cloudSyncEnabled) {
                        sendResponse({ success: true, folder });
                        return;
                    }

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

    if (message.type === 'OPEN_FOLDER_AS_GROUP') {
        const { folderId } = message;
        chrome.storage.local.get(['divnotes_folders', 'divnotes_notes'], async (result) => {
            const folders = result.divnotes_folders || [];
            const notes = result.divnotes_notes || [];
            const folder = folders.find(f => f.id === folderId);
            if (!folder) {
                sendResponse({ success: false, error: 'Folder not found' });
                return;
            }

            // Determine if parent (has children) or leaf
            const hasChildren = folders.some(f => f.parentId === folderId);

            // Collect target folder IDs
            const targetFolderIds = [folderId];
            if (hasChildren) {
                const stack = [folderId];
                while (stack.length) {
                    const current = stack.pop();
                    const children = folders.filter(f => f.parentId === current);
                    for (const child of children) {
                        targetFolderIds.push(child.id);
                        stack.push(child.id);
                    }
                }
            }

            // Collect notes from target folders, deduplicate URLs
            const seen = new Set();
            const uniqueUrls = [];
            for (const note of notes) {
                if (!note.folderId || !targetFolderIds.includes(note.folderId)) continue;
                if (!note.url || !isSafeUrl(note.url)) continue;
                const normalized = normalizeUrl(note.url);
                if (!seen.has(normalized)) {
                    seen.add(normalized);
                    uniqueUrls.push(note.url);
                }
            }

            if (uniqueUrls.length === 0) {
                sendResponse({ success: false, error: 'No notes with valid URLs in this folder' });
                return;
            }

            try {
                // Create tabs
                const tabIds = [];
                for (const url of uniqueUrls) {
                    const tab = await chrome.tabs.create({ url });
                    if (tab.id) tabIds.push(tab.id);
                }

                if (tabIds.length === 0) {
                    sendResponse({ success: false, error: 'Failed to create tabs' });
                    return;
                }

                // Group tabs
                const groupId = await chrome.tabs.group({ tabIds });

                // Style the group
                await chrome.tabGroups.update(groupId, {
                    title: folder.name,
                    color: hexToChromeColor(folder.color),
                });

                sendResponse({ success: true, tabCount: tabIds.length });
            } catch (err) {
                sendResponse({ success: false, error: err.message || 'Failed to create tab group' });
            }
        });
        return true;
    }

    // Always send response for unhandled messages to avoid port closure errors
    sendResponse({ unhandled: true });
    return false;
});
