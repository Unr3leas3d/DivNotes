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

    // Always send response for unhandled messages to avoid port closure errors
    sendResponse({ unhandled: true });
    return false;
});

// Update badge color on tab switch
chrome.tabs.onActivated.addListener(() => {
    chrome.action.setBadgeBackgroundColor({ color: '#7c3aed' });
    chrome.action.setBadgeTextColor({ color: '#ffffff' });
});
