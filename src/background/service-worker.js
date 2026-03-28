// DivNotes Service Worker (Background Script)
// Plain JS — copied directly to dist (no build step)

// Handle extension install — create context menu
chrome.runtime.onInstalled.addListener(() => {
    console.log('DivNotes installed');

    // Context menu for text selection
    chrome.contextMenus.create({
        id: 'divnotes-add-note',
        title: 'Add DivNote',
        contexts: ['selection'],
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'divnotes-add-note' && tab?.id) {
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

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

    if (message.type === 'UPDATE_BADGE_COUNT') {
        const count = message.count || 0;
        chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
        chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
        chrome.action.setBadgeTextColor({ color: '#ffffff' });
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'SYNC_NOTE_TAGS') {
        const { noteId, tagNames } = message;
        chrome.storage.local.get(['divnotes_tags', 'divnotes_notes'], (result) => {
            const tags = result.divnotes_tags || [];
            const notes = result.divnotes_notes || [];
            const resolvedTagIds = [];

            for (const name of tagNames) {
                const normalized = name.toLowerCase();
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
                }
                resolvedTagIds.push(tag.id);
            }

            const noteIdx = notes.findIndex(n => n.id === noteId);
            if (noteIdx > -1) {
                // Merge with existing tags (don't overwrite manually-added tags)
                const existingTags = notes[noteIdx].tags || [];
                const merged = [...new Set([...existingTags, ...resolvedTagIds])];
                notes[noteIdx].tags = merged;
            }

            chrome.storage.local.set({
                divnotes_tags: tags,
                divnotes_notes: notes,
            }, () => {
                // Enqueue cloud sync for new tags and note_tag associations
                chrome.storage.local.get(['divnotes_sync_queue'], (syncRes) => {
                    const queue = syncRes.divnotes_sync_queue || [];
                    for (const tag of tags) {
                        // Queue save for any newly created tags
                        if (resolvedTagIds.includes(tag.id)) {
                            queue.push({
                                id: crypto.randomUUID(),
                                entityType: 'tag',
                                action: 'save',
                                entityId: tag.id,
                                payload: tag,
                                timestamp: Date.now(),
                            });
                        }
                    }
                    for (const tagId of resolvedTagIds) {
                        queue.push({
                            id: crypto.randomUUID(),
                            entityType: 'note_tag',
                            action: 'save',
                            entityId: `${noteId}:${tagId}`,
                            payload: { note_id: noteId, tag_id: tagId },
                            timestamp: Date.now(),
                        });
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

// Update badge color on tab switch
chrome.tabs.onActivated.addListener(() => {
    chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
    chrome.action.setBadgeTextColor({ color: '#ffffff' });
});
