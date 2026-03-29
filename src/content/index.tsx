// Canopy Content Script
// Pure DOM for inspector, note editor, and note badges
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { StoredFolder, StoredTag } from '../lib/types.ts';
import { createEditorSurface, createTagRow } from './editor-surface.ts';
import {
  buildEditorTagNames,
  formatEditorContent,
  getFolderChipLabel,
  getInitialManualTags,
  getInitialSelectedFolderId,
  getSuggestedFolderIdForDomain,
  getTagChipLabels,
  hasMeaningfulEditorContent,
  parseEditorDraft,
  resolveStoredTagLabels,
  savePageNotesToStorage,
} from './note-editor-helpers.ts';
import {
  createHoverSelectorPill,
  createNotePreviewCardShell,
  createPageNoteCountPill,
  createPlacedNoteBadge,
  createSelectionConfirmationPill,
  createSelectorGuide,
} from './overlay-ui.ts';

console.log('[Canopy] Content script loaded');

// ==================== TYPES ====================
interface SavedNote {
  id: string;
  element: HTMLElement;
  content: string;
  elementInfo: string;
  elementSelector: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
  badgeEl: HTMLElement | null;
  expandedEl: HTMLElement | null;
}

interface StoredNote {
  id: string;
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  content: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
  folderId?: string | null;
  tags?: string[];
  pinned?: boolean;
  createdAt: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
}

function extractHashtagsFromContent(content: string): string[] {
  const regex = /(?:^|(?<=\s))#([a-zA-Z0-9_-]{1,50})(?=\s|$)/g;
  const tags = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags);
}

// ==================== STYLES ====================
const highlightStyle = document.createElement('style');
highlightStyle.id = 'canopy-styles';
highlightStyle.textContent = `
  .canopy-highlight {
    outline: 2px solid rgba(26, 92, 46, 0.8) !important;
    outline-offset: 2px !important;
    background-color: rgba(171, 255, 192, 0.08) !important;
    transition: outline 0.15s ease, background-color 0.15s ease !important;
    cursor: crosshair !important;
  }
  .canopy-selected {
    outline: 2px solid #1a5c2e !important;
    outline-offset: 2px !important;
    background-color: rgba(171, 255, 192, 0.12) !important;
  }
  .canopy-has-note {
    position: relative !important;
    outline: 1px solid rgba(171, 255, 192, 0.28) !important;
    outline-offset: 1px !important;
  }
  ::highlight(canopy-text-selection) {
    background-color: rgba(171, 255, 192, 0.3) !important;
    border-bottom: 2px dashed rgba(26, 92, 46, 0.8);
    color: inherit;
  }
  @keyframes canopy-pulse {
    0%, 100% { box-shadow: 0 2px 8px rgba(5,36,21,0.2); }
    50% { box-shadow: 0 2px 12px rgba(5,36,21,0.4); }
  }
  @keyframes canopy-fadein {
    from { opacity: 0; transform: scale(0.8) translateY(4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
`;
document.head.appendChild(highlightStyle);

// CSS highlights namespace
const canopyHighlight = typeof Highlight !== 'undefined' ? new Highlight() : null;
if (canopyHighlight && CSS.highlights) {
  CSS.highlights.set('canopy-text-selection', canopyHighlight);
}

function applyTextHighlight(note: SavedNote) {
  if (!note.selectedText || !canopyHighlight) return;
  const text = note.selectedText.trim();
  if (!text) return;

  const walker = document.createTreeWalker(note.element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const nodeText = node.textContent || '';
    let idx = nodeText.indexOf(text);
    while (idx !== -1) {
      const range = new Range();
      range.setStart(node, idx);
      range.setEnd(node, idx + text.length);
      canopyHighlight.add(range);
      idx = nodeText.indexOf(text, idx + text.length);
    }
    node = walker.nextNode();
  }
}

function clearTextHighlight(note: SavedNote) {
  // To clear specifically for one note, we'd need a mapping of ranges.
  // For simplicity, we just rebuild all highlights or let them be.
  // A robust approach clears all and re-applies the remaining notes.
  if (canopyHighlight) {
    canopyHighlight.clear();
    savedNotes.forEach(applyTextHighlight);
  }
}

// ==================== STATE ====================
let isInspecting = false;
let selectedElement: HTMLElement | null = null;
let selectorGuide: HTMLElement | null = null;
let selectorPill: HTMLElement | null = null;
let pageNoteCountPill: HTMLElement | null = null;
let noteEditorContainer: HTMLElement | null = null;
let noteEditorKeydownHandler: ((event: KeyboardEvent) => void) | null = null;
const savedNotes: SavedNote[] = [];
let notesVisible = true;
let screenShareMode = false;
let pendingEditorOpenTimeout: ReturnType<typeof setTimeout> | null = null;

const INSPECTOR_GUIDE_TEXT = 'Click to add a note · ESC to cancel';
const SELECTED_CONFIRMATION_TEXT = 'Element selected · Opening note editor…';

// ==================== URL NORMALIZATION ====================
function getPageUrl(): string {
  // Strip hash and query params for more reliable note matching
  return window.location.origin + window.location.pathname;
}

// ==================== SHARED SCROLL LISTENER ====================
function updateAllBadgePositions() {
  savedNotes.forEach(note => {
    if (!note.badgeEl) return;
    const newPos = getBadgePosition(note.element);
    note.badgeEl.style.top = `${newPos.top}px`;
    note.badgeEl.style.left = `${newPos.left}px`;
  });
}
window.addEventListener('scroll', updateAllBadgePositions, { passive: true });
window.addEventListener('resize', updateAllBadgePositions, { passive: true });

// ==================== NOTE COUNT BADGE ====================
function updateNoteBadgeCount() {
  syncPageNoteCountPill();
  try {
    chrome.runtime.sendMessage({
      type: 'UPDATE_BADGE_COUNT',
      count: savedNotes.length,
    });
  } catch { /* extension context may be invalid */ }
}

function syncPageNoteCountPill() {
  if (pageNoteCountPill) {
    pageNoteCountPill.remove();
    pageNoteCountPill = null;
  }

  if (!notesVisible || screenShareMode || savedNotes.length === 0) {
    return;
  }

  pageNoteCountPill = createPageNoteCountPill(document, savedNotes.length);
  document.body.appendChild(pageNoteCountPill);
}

function isCanopyUiTarget(target: HTMLElement) {
  return Boolean(target.closest('#canopy-root') || target.closest('[data-canopy-overlay]'));
}

function getSelectorOverlayPosition(element: HTMLElement, overlay: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const overlayWidth = overlay.offsetWidth || 220;
  const overlayHeight = overlay.offsetHeight || 34;
  let top = rect.top - overlayHeight - 10;
  let left = rect.left;

  if (top < 8) {
    top = rect.bottom + 10;
  }

  if (left + overlayWidth > window.innerWidth - 8) {
    left = window.innerWidth - overlayWidth - 8;
  }

  if (left < 8) {
    left = 8;
  }

  return { top, left };
}

function removeSelectorPill() {
  if (selectorPill) {
    selectorPill.remove();
    selectorPill = null;
  }
}

function clearSelectedElement() {
  if (selectedElement) {
    selectedElement.classList.remove('canopy-selected');
    selectedElement = null;
  }
}

function showSelectorGuide(text = INSPECTOR_GUIDE_TEXT, confirmation = false) {
  if (selectorGuide) {
    selectorGuide.remove();
  }

  selectorGuide = confirmation
    ? createSelectionConfirmationPill(document, text)
    : createSelectorGuide(document, text);

  document.body.appendChild(selectorGuide);
}

function hideSelectorGuide() {
  if (selectorGuide) {
    selectorGuide.remove();
    selectorGuide = null;
  }
}

function showHoverSelectorPill(target: HTMLElement) {
  removeSelectorPill();
  selectorPill = createHoverSelectorPill(document, {
    tagLabel: target.tagName.toLowerCase(),
    selectorLabel: getCssSelector(target),
  });
  document.body.appendChild(selectorPill);

  const pos = getSelectorOverlayPosition(target, selectorPill);
  selectorPill.style.top = `${pos.top}px`;
  selectorPill.style.left = `${pos.left}px`;
}

// ==================== INSPECTOR ====================
function activateInspector() {
  if (isInspecting) return;
  if (pendingEditorOpenTimeout) {
    clearTimeout(pendingEditorOpenTimeout);
    pendingEditorOpenTimeout = null;
  }
  isInspecting = true;
  console.log('[Canopy] Inspector activated');
  showSelectorGuide();
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
}

function deactivateInspector() {
  isInspecting = false;
  if (pendingEditorOpenTimeout) {
    clearTimeout(pendingEditorOpenTimeout);
    pendingEditorOpenTimeout = null;
  }
  hideSelectorGuide();
  removeSelectorPill();
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  document.querySelectorAll('.canopy-highlight').forEach(el => {
    el.classList.remove('canopy-highlight');
  });
  clearSelectedElement();
}

function onMouseOver(e: Event) {
  if (!isInspecting) return;
  const target = e.target as HTMLElement;
  if (isCanopyUiTarget(target)) return;
  document.querySelectorAll('.canopy-highlight').forEach(el => {
    el.classList.remove('canopy-highlight');
  });
  target.classList.add('canopy-highlight');
  showHoverSelectorPill(target);
}

function onClick(e: Event) {
  if (!isInspecting) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  const target = e.target as HTMLElement;
  if (isCanopyUiTarget(target)) return;
  document.querySelectorAll('.canopy-highlight').forEach(el => {
    el.classList.remove('canopy-highlight');
  });
  target.classList.add('canopy-selected');
  selectedElement = target;
  isInspecting = false;
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('click', onClick, true);
  removeSelectorPill();
  showSelectorGuide(SELECTED_CONFIRMATION_TEXT, true);
  if (pendingEditorOpenTimeout) {
    clearTimeout(pendingEditorOpenTimeout);
  }
  pendingEditorOpenTimeout = setTimeout(() => {
    document.removeEventListener('keydown', onKeyDown, true);
    hideSelectorGuide();
    pendingEditorOpenTimeout = null;
    showNoteEditor(target);
  }, 120);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    if (pendingEditorOpenTimeout) {
      clearTimeout(pendingEditorOpenTimeout);
      pendingEditorOpenTimeout = null;
    }
    if (noteEditorContainer) {
      closeNoteEditor();
    } else {
      deactivateInspector();
    }
  }
}

// ==================== NOTE BADGES ====================
function getElementInfo(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const cls = element.className && typeof element.className === 'string'
    ? '.' + element.className.split(' ').filter(Boolean).slice(0, 2).join('.')
    : '';
  return `<${tag}${id}${cls}>`;
}

function getBadgePosition(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top - 6,
    left: rect.right - 6,
  };
}

function getNotePreviewTitle(note: SavedNote) {
  const source = note.selectedText?.trim() || note.content.trim().split('\n').find(Boolean) || 'Untitled note';
  const plainText = source.replace(/[#*_`>\-\[\]\(\)]/g, '').replace(/\s+/g, ' ').trim();
  return plainText.length > 56 ? `${plainText.slice(0, 53)}...` : plainText;
}

function createNoteBadge(note: SavedNote) {
  if (note.badgeEl) note.badgeEl.remove();
  if (note.expandedEl) note.expandedEl.remove();

  const pos = getBadgePosition(note.element);
  const badge = createPlacedNoteBadge(document);
  badge.style.top = `${pos.top}px`;
  badge.style.left = `${pos.left}px`;
  note.element.classList.add('canopy-has-note');

  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

  badge.addEventListener('mouseenter', () => {
    badge.style.transform = 'scale(1.1)';
    badge.style.boxShadow = '0 4px 16px rgba(5,36,21,0.3)';
    hoverTimeout = setTimeout(() => showNoteCard(note), 150);
  });
  badge.addEventListener('mouseleave', () => {
    badge.style.transform = 'scale(1)';
    badge.style.boxShadow = '0 2px 8px rgba(5,36,21,0.2)';
    if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null; }
    // Grace period — don't close if cursor moves to the card
    setTimeout(() => {
      if (note.expandedEl && !note.expandedEl.matches(':hover') && !badge.matches(':hover')) {
        note.expandedEl.remove();
        note.expandedEl = null;
      }
    }, 200);
  });

  badge.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.body.appendChild(badge);
  note.badgeEl = badge;
}

function showNoteCard(note: SavedNote) {
  // Already showing
  if (note.expandedEl) return;

  // Close any other expanded cards
  savedNotes.forEach(n => {
    if (n.expandedEl) { n.expandedEl.remove(); n.expandedEl = null; }
  });

  const rect = note.element.getBoundingClientRect();
  const cardWidth = 300;
  const cardHeight = 260;

  let top = rect.top + 20;
  let left = rect.right - cardWidth + 10;
  if (top + cardHeight > window.innerHeight) top = rect.top - cardHeight - 10;
  if (left < 8) left = 8;
  if (left + cardWidth > window.innerWidth) left = window.innerWidth - cardWidth - 8;
  if (top < 8) top = 8;

  const displayDate = note.createdAt.includes('T')
    ? new Date(note.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : note.createdAt;
  const card = createNotePreviewCardShell(document, {
    elementInfo: note.elementInfo,
    displayDate,
    title: getNotePreviewTitle(note),
    previewText: note.content,
    tags: note.tags.length > 0 ? note.tags : extractHashtagsFromContent(note.content),
  });
  card.style.top = `${top}px`;
  card.style.left = `${left}px`;

  const previewBody = card.querySelector('[data-canopy-preview-body]') as HTMLElement | null;
  if (previewBody) {
    previewBody.innerHTML = simpleMarkdown(note.content);
  }

  const moveButton = card.querySelector('[data-canopy-move]') as HTMLButtonElement | null;
  const editButton = card.querySelector('[data-canopy-edit]') as HTMLButtonElement | null;
  const deleteButton = card.querySelector('[data-canopy-delete]') as HTMLButtonElement | null;

  moveButton?.addEventListener('click', (e) => {
    e.stopPropagation();
    card.remove();
    note.expandedEl = null;
    moveNote(note);
  });

  editButton?.addEventListener('click', (e) => {
    e.stopPropagation();
    card.remove();
    note.expandedEl = null;
    showNoteEditor(note.element, note);
  });

  deleteButton?.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteNote(note.id);
  });

  // Hover effects on buttons
  [moveButton, editButton].filter(Boolean).forEach(btn => {
    btn.addEventListener('mouseenter', (e) => {
      (e.target as HTMLElement).style.color = '#052415';
      (e.target as HTMLElement).style.background = 'rgba(5,36,21,0.04)';
    });
    btn.addEventListener('mouseleave', (e) => {
      (e.target as HTMLElement).style.color = '#7a8a7d';
      (e.target as HTMLElement).style.background = 'transparent';
    });
  });
  deleteButton?.addEventListener('mouseenter', (e) => {
    (e.target as HTMLElement).style.opacity = '1';
    (e.target as HTMLElement).style.background = 'rgba(220,38,38,0.08)';
  });
  deleteButton?.addEventListener('mouseleave', (e) => {
    (e.target as HTMLElement).style.opacity = '0.7';
    (e.target as HTMLElement).style.background = 'transparent';
  });

  card.addEventListener('click', (e) => e.stopPropagation());
  card.addEventListener('mousedown', (e) => e.stopPropagation());

  // Auto-close when cursor leaves the card (with grace period for badge)
  card.addEventListener('mouseleave', () => {
    setTimeout(() => {
      if (note.expandedEl && !card.matches(':hover') && (!note.badgeEl || !note.badgeEl.matches(':hover'))) {
        card.remove();
        note.expandedEl = null;
      }
    }, 300);
  });

  document.body.appendChild(card);
  note.expandedEl = card;
}

async function deleteNote(id: string, skipStorage = false) {
  const idx = savedNotes.findIndex(n => n.id === id);
  if (idx > -1) {
    const note = savedNotes[idx];
    if (note.badgeEl) note.badgeEl.remove();
    if (note.expandedEl) note.expandedEl.remove();
    note.badgeEl = null;
    note.expandedEl = null;
    note.element.classList.remove('canopy-has-note');
    clearTextHighlight(note);
    savedNotes.splice(idx, 1);
    updateNoteBadgeCount();

    if (!skipStorage) {
      try {
        await saveNotesToStorage();
      } catch (error) {
        savedNotes.splice(idx, 0, note);
        note.element.classList.add('canopy-has-note');
        createNoteBadge(note);
        if (note.selectedText) applyTextHighlight(note);
        updateNoteBadgeCount();
        console.error('[Canopy] Failed to delete note', error);
        return;
      }
    }

    console.log('[Canopy] Note deleted');
  }
}

function moveNote(note: SavedNote) {
  console.log('[Canopy] Move mode activated');

  const banner = createSelectorGuide(document, 'Move note · Click a new element · ESC to cancel');
  document.body.appendChild(banner);

  const onHover = (e: Event) => {
    const t = e.target as HTMLElement;
    if (isCanopyUiTarget(t)) return;
    t.classList.add('canopy-highlight');
    removeSelectorPill();
    const movePill = createHoverSelectorPill(document, {
      tagLabel: t.tagName.toLowerCase(),
      selectorLabel: getCssSelector(t),
    });
    document.body.appendChild(movePill);
    const pos = getSelectorOverlayPosition(t, movePill);
    movePill.style.top = `${pos.top}px`;
    movePill.style.left = `${pos.left}px`;
    selectorPill = movePill;
  };
  const onOut = (e: Event) => {
    (e.target as HTMLElement).classList.remove('canopy-highlight');
    removeSelectorPill();
  };
  const onPick = async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const newEl = e.target as HTMLElement;
    if (isCanopyUiTarget(newEl)) return;
    newEl.classList.remove('canopy-highlight');
    cleanup();

    const previousElement = note.element;
    const previousSelector = note.elementSelector;
    const previousInfo = note.elementInfo;

    // Re-attach note to new element
    note.element.classList.remove('canopy-has-note');
    note.element = newEl;
    note.elementSelector = getCssSelector(newEl);
    const tag = newEl.tagName.toLowerCase();
    const id = newEl.id ? `#${newEl.id}` : '';
    const cls = newEl.className && typeof newEl.className === 'string'
      ? '.' + newEl.className.split(' ').filter(Boolean).slice(0, 2).join('.')
      : '';
    note.elementInfo = `<${tag}${id}${cls}>`;

    // Move badge
    if (note.badgeEl) note.badgeEl.remove();
    createNoteBadge(note);
    try {
      await saveNotesToStorage();
    } catch (error) {
      note.element.classList.remove('canopy-has-note');
      note.element = previousElement;
      note.elementSelector = previousSelector;
      note.elementInfo = previousInfo;
      createNoteBadge(note);
      console.error('[Canopy] Failed to move note', error);
      return;
    }
    console.log('[Canopy] Note moved to', note.elementSelector);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { cleanup(); }
  };
  const cleanup = () => {
    banner.remove();
    removeSelectorPill();
    document.body.style.cursor = '';
    document.removeEventListener('mouseover', onHover, true);
    document.removeEventListener('mouseout', onOut, true);
    document.removeEventListener('click', onPick, true);
    document.removeEventListener('keydown', onKey, true);
  };

  document.body.style.cursor = 'crosshair';
  document.addEventListener('mouseover', onHover, true);
  document.addEventListener('mouseout', onOut, true);
  document.addEventListener('click', onPick, true);
  document.addEventListener('keydown', onKey, true);
}

function toggleAllNotes() {
  notesVisible = !notesVisible;
  savedNotes.forEach(note => {
    if (note.badgeEl) {
      note.badgeEl.style.display = notesVisible ? 'flex' : 'none';
    }
    if (!notesVisible && note.expandedEl) {
      note.expandedEl.remove();
      note.expandedEl = null;
    }
  });
  syncPageNoteCountPill();
  console.log('[Canopy] Notes visibility:', notesVisible);
}

function toggleScreenShareMode() {
  screenShareMode = !screenShareMode;
  console.log('[Canopy] Screen Share Mode:', screenShareMode ? 'ON' : 'OFF');

  savedNotes.forEach(note => {
    if (note.badgeEl) {
      note.badgeEl.style.display = screenShareMode ? 'none' : 'flex';
    }
    if (note.expandedEl) {
      note.expandedEl.remove();
      note.expandedEl = null;
    }
  });

  closeNoteEditor();

  // Persist state for side panel to read
  syncPageNoteCountPill();
  chrome.storage.local.set({ divnotes_screen_share: screenShareMode });
}

function clearAllBadges() {
  if (canopyHighlight) canopyHighlight.clear();
  savedNotes.forEach(note => {
    if (note.badgeEl) { note.badgeEl.remove(); note.badgeEl = null; }
    if (note.expandedEl) { note.expandedEl.remove(); note.expandedEl = null; }
    note.element.classList.remove('canopy-has-note');
  });
  savedNotes.length = 0;
  updateNoteBadgeCount();
}

// ==================== SPA ROUTE DETECTION ====================
let lastSpaUrl = getPageUrl();
function checkUrlChange() {
  const currentUrl = getPageUrl();
  if (currentUrl !== lastSpaUrl) {
    console.log('[Canopy] SPA navigation:', lastSpaUrl, '→', currentUrl);
    lastSpaUrl = currentUrl;
    clearAllBadges();
    loadNotesFromStorage();
  }
}

// Monkey-patch History API for SPA frameworks
const origPushState = history.pushState.bind(history);
const origReplaceState = history.replaceState.bind(history);
history.pushState = function (...args: Parameters<typeof history.pushState>) {
  origPushState(...args);
  setTimeout(checkUrlChange, 0);
};
history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
  origReplaceState(...args);
  setTimeout(checkUrlChange, 0);
};
window.addEventListener('popstate', () => setTimeout(checkUrlChange, 0));

// ==================== NOTE EDITOR (Pure DOM) ====================
function applySaveButtonState(button: HTMLButtonElement, enabled: boolean) {
  button.disabled = !enabled;
  button.style.background = enabled ? '#052415' : 'rgba(5,36,21,0.1)';
  button.style.cursor = enabled ? 'pointer' : 'not-allowed';
  button.style.opacity = enabled ? '1' : '0.5';
  button.style.color = enabled ? '#F5EFE9' : '#7a8a7d';
}

function getStorageRuntimeError(): Error | undefined {
  const runtimeError = chrome.runtime.lastError;
  if (!runtimeError) {
    return undefined;
  }

  return new Error(runtimeError.message);
}

function persistSavedNotes(notesToSave: readonly SavedNote[]) {
  return savePageNotesToStorage({
    savedNotes: notesToSave,
    pageUrl: getPageUrl(),
    hostname: window.location.hostname,
    pageTitle: document.title,
    storage: chrome.storage.local,
    updateBadgeCount() {},
    getLastError: getStorageRuntimeError,
  });
}

function showNoteEditor(element: HTMLElement, existingNote?: SavedNote, selectedText?: string) {
  closeNoteEditor();

  selectedElement = element;
  selectedElement.classList.add('canopy-selected');

  const rect = element.getBoundingClientRect();
  const editorWidth = 380;
  const editorHeight = 430;

  let top = rect.bottom + 8;
  let left = rect.left;
  if (top + editorHeight > window.innerHeight) top = rect.top - editorHeight - 8;
  if (left + editorWidth > window.innerWidth) left = window.innerWidth - editorWidth - 16;
  if (left < 8) left = 8;
  if (top < 8) top = 8;

  const draft = existingNote ? parseEditorDraft(existingNote.content) : { title: '', body: '' };
  let selectedFolderId: string | null = existingNote?.folderId ?? null;
  let availableFolders: StoredFolder[] = [];
  let folderSelectionTouched = false;
  let manualTags = getInitialManualTags(existingNote?.tags ?? [], existingNote?.content ?? '');

  const elInfo = `${getElementInfo(element)}${
    selectedText
      ? ` - selection: "${selectedText.length > 20 ? `${selectedText.substring(0, 20)}...` : selectedText}"`
      : ''
  }`;

  noteEditorContainer = createEditorSurface(document as unknown as Parameters<typeof createEditorSurface>[0], {
    isNew: !existingNote,
    title: draft.title,
    body: draft.body,
    elementInfo: elInfo,
    folderLabel: 'Inbox',
    tagLabels: getTagChipLabels(buildEditorTagNames(manualTags, draft)),
    pinned: existingNote?.pinned ?? false,
    errorMessage: '',
    saveDisabled: !hasMeaningfulEditorContent(draft),
  }) as unknown as HTMLElement;

  Object.assign(noteEditorContainer.style, {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${editorWidth}px`,
    zIndex: '2147483647',
    fontFamily: 'system-ui, sans-serif',
  });

  document.body.appendChild(noteEditorContainer);

  const currentEditor = noteEditorContainer;
  const titleInput = currentEditor.querySelector(
    '[data-canopy-editor-title]'
  ) as HTMLInputElement | null;
  const bodyTextarea = currentEditor.querySelector(
    '[data-canopy-editor-body]'
  ) as HTMLTextAreaElement | null;
  const folderControl = currentEditor.querySelector(
    '[data-canopy-folder-control]'
  ) as HTMLElement | null;
  const folderLabel = currentEditor.querySelector(
    '[data-canopy-folder-label]'
  ) as HTMLElement | null;
  const folderChangeButton = currentEditor.querySelector(
    '[data-canopy-folder-change]'
  ) as HTMLButtonElement | null;
  const pinnedInput = currentEditor.querySelector(
    '[data-canopy-pinned-input]'
  ) as HTMLInputElement | null;
  const errorEl = currentEditor.querySelector('[data-canopy-error]') as HTMLElement | null;
  const saveBtn = currentEditor.querySelector('[data-canopy-save]') as HTMLButtonElement | null;
  const closeBtn = currentEditor.querySelector('[data-canopy-close]') as HTMLButtonElement | null;
  const deleteBtn = currentEditor.querySelector('[data-canopy-delete]') as HTMLButtonElement | null;

  if (!titleInput || !bodyTextarea || !folderControl || !folderLabel || !folderChangeButton || !pinnedInput || !errorEl || !saveBtn || !closeBtn) {
    closeNoteEditor();
    return;
  }

  let tagRow = currentEditor.querySelector('[data-canopy-tag-row]') as HTMLElement | null;
  let folderDropdown: HTMLElement | null = null;
  const defaultSaveLabel = existingNote ? 'Update Note' : 'Save Note';

  const updateFolderLabel = () => {
    folderLabel.textContent = getFolderChipLabel(availableFolders, selectedFolderId);
  };

  const updateSaveState = () => {
    applySaveButtonState(
      saveBtn,
      hasMeaningfulEditorContent({
        title: titleInput.value,
        body: bodyTextarea.value,
      })
    );
  };

  const closeFolderDropdown = () => {
    if (folderDropdown) {
      folderDropdown.remove();
      folderDropdown = null;
    }
  };

  const selectFolder = (folderId: string | null) => {
    folderSelectionTouched = true;
    selectedFolderId = folderId;
    updateFolderLabel();
    closeFolderDropdown();
  };

  const createFolderOption = (label: string, folderId: string | null, depth = 0) => {
    const option = document.createElement('button');
    Object.assign(option.style, {
      display: 'block',
      width: '100%',
      padding: '6px 10px',
      paddingLeft: `${10 + depth * 16}px`,
      border: 'none',
      background: selectedFolderId === folderId ? 'rgba(171,255,192,0.15)' : 'transparent',
      color: '#052415',
      fontSize: '11px',
      cursor: 'pointer',
      fontFamily: 'system-ui,sans-serif',
      textAlign: 'left',
    });
    option.textContent = label;
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      selectFolder(folderId);
    });
    return option;
  };

  const openFolderDropdown = () => {
    if (folderDropdown) {
      closeFolderDropdown();
      return;
    }

    folderDropdown = document.createElement('div');
    folderDropdown.id = 'canopy-folder-dropdown';
    Object.assign(folderDropdown.style, {
      maxHeight: '200px',
      overflow: 'auto',
      background: '#FFFFFF',
      border: '1px solid rgba(5,36,21,0.1)',
      borderRadius: '6px',
      marginTop: '8px',
      padding: '4px 0',
      width: '100%',
    });

    folderDropdown.appendChild(createFolderOption('Inbox', null));

    const appendFolders = (parentId: string | null, depth: number) => {
      const children = availableFolders
        .filter((folder) => folder.parentId === parentId)
        .sort((a, b) => a.order - b.order);

      children.forEach((folder) => {
        folderDropdown?.appendChild(createFolderOption(folder.name, folder.id, depth));
        appendFolders(folder.id, depth + 1);
      });
    };

    appendFolders(null, 0);
    folderControl.appendChild(folderDropdown);
  };

  const bindTagRow = () => {
    const addTagButton = tagRow?.querySelector('[data-canopy-add-tag]') as HTMLButtonElement | null;
    addTagButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      const nextTag = window.prompt('Add a tag', '');
      if (!nextTag) {
        return;
      }

      const normalized = nextTag.trim().replace(/^#+/, '').toLowerCase();
      if (!normalized) {
        return;
      }

      if (!manualTags.includes(normalized)) {
        manualTags = [...manualTags, normalized];
      }
      renderTagRow();
    });
  };

  const renderTagRow = () => {
    if (!tagRow) {
      return;
    }

    const nextTagRow = createTagRow(
      document as unknown as Parameters<typeof createTagRow>[0],
      getTagChipLabels(
        buildEditorTagNames(manualTags, {
          title: titleInput.value,
          body: bodyTextarea.value,
        })
      )
    ) as unknown as HTMLElement;
    tagRow.replaceWith(nextTagRow);
    tagRow = nextTagRow;
    bindTagRow();
  };

  updateFolderLabel();
  bindTagRow();
  updateSaveState();

  chrome.storage.local.get(['divnotes_folders', 'divnotes_notes'], (result) => {
    if (noteEditorContainer !== currentEditor) {
      return;
    }

    const storageError = getStorageRuntimeError();
    if (storageError) {
      errorEl.textContent = 'Could not load folders.';
      return;
    }

    availableFolders = (result.divnotes_folders || []) as StoredFolder[];
    const allNotes = (result.divnotes_notes || []) as StoredNote[];
    const suggestedFolderId = getSuggestedFolderIdForDomain(
      allNotes,
      window.location.hostname
    );

    if (!folderSelectionTouched) {
      selectedFolderId = getInitialSelectedFolderId({
        isNew: !existingNote,
        existingFolderId: existingNote?.folderId,
        suggestedFolderId,
      });
    }

    updateFolderLabel();
  });

  [titleInput, bodyTextarea].forEach((field) => {
    field.addEventListener('input', () => {
      errorEl.textContent = '';
      updateSaveState();
      renderTagRow();
    });
  });

  folderChangeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openFolderDropdown();
  });

  closeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    closeNoteEditor();
  });

  deleteBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!existingNote) {
      return;
    }

    deleteNote(existingNote.id);
    closeNoteEditor();
  });

  saveBtn.addEventListener('click', async (event) => {
    event.stopPropagation();

    const nextDraft = {
      title: titleInput.value,
      body: bodyTextarea.value,
    };

    if (!hasMeaningfulEditorContent(nextDraft)) {
      updateSaveState();
      return;
    }

    const formattedContent = formatEditorContent(nextDraft);
    const nextTags = buildEditorTagNames(manualTags, nextDraft);
    const nextPinned = pinnedInput.checked;
    const previousTags = existingNote ? [...existingNote.tags] : [];

    errorEl.textContent = '';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (!existingNote) {
        const note: SavedNote = {
          id: crypto.randomUUID(),
          element,
          elementSelector: getCssSelector(element),
          elementXPath: getXPath(element),
          elementTextHash: getTextHash(element),
          elementPosition: getPosition(element),
          elementInfo: elInfo,
          content: formattedContent,
          selectedText,
          folderId: selectedFolderId,
          tags: nextTags,
          pinned: nextPinned,
          createdAt: new Date().toISOString(),
          badgeEl: null,
          expandedEl: null,
        };

        await persistSavedNotes([...savedNotes, note]);
        savedNotes.push(note);
        createNoteBadge(note);
        if (note.selectedText) {
          applyTextHighlight(note);
        }
        updateNoteBadgeCount();
        console.log('[Canopy] Note saved! Total:', savedNotes.length);

        chrome.runtime.sendMessage({
          type: 'SYNC_NOTE_TAGS',
          noteId: note.id,
          tagNames: nextTags,
          previousTagNames: [],
        });
      } else {
        const nextSavedNotes = savedNotes.map((note) =>
          note.id === existingNote.id
            ? {
                ...note,
                content: formattedContent,
                folderId: selectedFolderId,
                tags: nextTags,
                pinned: nextPinned,
              }
            : note
        );

        await persistSavedNotes(nextSavedNotes);
        existingNote.content = formattedContent;
        existingNote.folderId = selectedFolderId;
        existingNote.tags = nextTags;
        existingNote.pinned = nextPinned;
        if (existingNote.expandedEl) {
          existingNote.expandedEl.remove();
          existingNote.expandedEl = null;
        }
        updateNoteBadgeCount();
        console.log('[Canopy] Note updated');

        chrome.runtime.sendMessage({
          type: 'SYNC_NOTE_TAGS',
          noteId: existingNote.id,
          tagNames: nextTags,
          previousTagNames: previousTags,
        });
      }

      closeNoteEditor();
    } catch (error) {
      console.error('[Canopy] Failed to save note', error);
      errorEl.textContent = 'Could not save note. Try again.';
      saveBtn.textContent = defaultSaveLabel;
      updateSaveState();
    }
  });

  currentEditor.addEventListener('click', (event) => event.stopPropagation());
  currentEditor.addEventListener('mousedown', (event) => event.stopPropagation());

  if (noteEditorKeydownHandler) {
    document.removeEventListener('keydown', noteEditorKeydownHandler, true);
  }
  noteEditorKeydownHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeNoteEditor();
    }
  };
  document.addEventListener('keydown', noteEditorKeydownHandler, true);

  setTimeout(() => {
    if (document.activeElement === document.body) {
      (titleInput.value ? bodyTextarea : titleInput).focus();
    }
  }, 50);
}

function closeNoteEditor() {
  if (noteEditorKeydownHandler) {
    document.removeEventListener('keydown', noteEditorKeydownHandler, true);
    noteEditorKeydownHandler = null;
  }
  if (noteEditorContainer) {
    noteEditorContainer.remove();
    noteEditorContainer = null;
  }
  clearSelectedElement();
}

// Safely render markdown
function simpleMarkdown(text: string): string {
  try {
    const rawHtml = marked.parse(text, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'code', 'pre', 'br', 'span', 'div', 'blockquote'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
    });
  } catch (e) {
    console.error('[Canopy] Markdown parsing error', e);
    return DOMPurify.sanitize(text); // Fallback to raw sanitized text
  }
}

// ==================== FINGERPRINTING ====================
function getCssSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  const path: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      path.unshift(`#${current.id}`);
      break;
    }
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => !c.startsWith('canopy')).slice(0, 2);
      if (classes.length) selector += '.' + classes.join('.');
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${idx})`;
      }
    }
    path.unshift(selector);
    current = current.parentElement;
  }
  return path.join(' > ');
}

function getXPath(el: HTMLElement): string {
  if (el.id) return `//*[@id="${el.id}"]`;
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 0;
    let sibling = current.previousSibling;
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    const tagName = current.nodeName.toLowerCase();
    const pathIndex = index ? `[${index + 1}]` : '';
    parts.unshift(`${tagName}${pathIndex}`);
    current = current.parentNode as HTMLElement | null;
  }
  return parts.length ? '/' + parts.join('/') : '';
}

function getTextHash(el: HTMLElement): string {
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
  return text.substring(0, 100);
}

function getPosition(el: HTMLElement): string {
  const parts: number[] = [];
  let current: HTMLElement | null = el;
  while (current && current.parentNode) {
    parts.unshift(Array.from(current.parentNode.children).indexOf(current));
    current = current.parentElement;
  }
  return parts.join(',');
}

function findMatchingElement(stored: Readonly<StoredNote>): HTMLElement | null {
  // Strategy 1: CSS Selector
  if (stored.elementSelector) {
    try {
      const el = document.querySelector(stored.elementSelector) as HTMLElement;
      if (el) return el;
    } catch (e) { }
  }

  // Strategy 2: XPath
  if (stored.elementXPath) {
    try {
      const result = document.evaluate(stored.elementXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      if (result.singleNodeValue) return result.singleNodeValue as HTMLElement;
    } catch (e) { }
  }

  // Strategy 3: Text content hash
  if (stored.elementTextHash) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
    let node = walker.nextNode();
    while (node) {
      const el = node as HTMLElement;
      if (el.tagName.toLowerCase() === stored.elementTag && getTextHash(el) === stored.elementTextHash) {
        return el;
      }
      node = walker.nextNode();
    }
  }

  // Strategy 4: Structural position
  if (stored.elementPosition) {
    try {
      const indices = stored.elementPosition.split(',').map(Number);
      let current: HTMLElement | null = document.documentElement;
      for (const i of indices) {
        if (!current || !current.children[i]) {
          current = null;
          break;
        }
        current = current.children[i] as HTMLElement;
      }
      if (current && current.tagName.toLowerCase() === stored.elementTag) return current;
    } catch (e) { }
  }

  return null;
}

// ==================== STORAGE ====================
function saveNotesToStorage() {
  return persistSavedNotes(savedNotes);
}

function loadNotesFromStorage() {
  const pageUrl = getPageUrl();
  chrome.storage.local.get(['divnotes_notes', 'divnotes_tags'], (result) => {
    const allNotes: StoredNote[] = result.divnotes_notes || [];
    const allTags: StoredTag[] = result.divnotes_tags || [];
    const pageNotes = allNotes.filter(n => n.url === pageUrl);
    console.log('[Canopy] Loading', pageNotes.length, 'notes for this page');

    pageNotes.forEach(stored => {
      try {
        const el = findMatchingElement(stored);
        if (!el) {
          console.warn('[Canopy] Element not found for note (all strategies failed):', stored.id);
          return;
        }
        const note: SavedNote = {
          id: stored.id,
          element: el,
          content: stored.content,
          elementInfo: stored.elementInfo,
          elementSelector: stored.elementSelector,
          elementXPath: stored.elementXPath,
          elementTextHash: stored.elementTextHash,
          elementPosition: stored.elementPosition,
          selectedText: stored.selectedText,
          folderId: stored.folderId ?? null,
          tags: resolveStoredTagLabels(stored.tags ?? [], allTags),
          pinned: stored.pinned ?? false,
          createdAt: stored.createdAt,
          badgeEl: null,
          expandedEl: null,
        };
        savedNotes.push(note);
        createNoteBadge(note);
        if (note.selectedText) applyTextHighlight(note);
      } catch (err) {
        console.warn('[Canopy] Error restoring note:', err);
      }
    });
    updateNoteBadgeCount();
  });
}

// ==================== MESSAGE LISTENER ====================
chrome.runtime.onMessage.addListener((message) => {
  console.log('[Canopy] Message:', message.type);
  if (message.type === 'ACTIVATE_INSPECTOR') activateInspector();
  if (message.type === 'TOGGLE_NOTES') toggleAllNotes();
  if (message.type === 'TOGGLE_SCREEN_SHARE') toggleScreenShareMode();
  if (message.type === 'ADD_SELECTION_NOTE') {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    // Find closest element wrapper
    let node = sel.anchorNode;
    while (node && node.nodeType !== Node.ELEMENT_NODE) {
      node = node.parentNode;
    }
    const el = (node as HTMLElement) || document.body;

    const text = message.selectionText || sel.toString();
    showNoteEditor(el, undefined, text);
    sel.removeAllRanges(); // clear default selection to avoid visual clutter
  }
  if (message.type === 'SCROLL_TO_NOTE' && message.selector) {
    try {
      const el = document.querySelector(message.selector) as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash highlight
        el.style.transition = 'outline 0.3s ease, background-color 0.3s ease';
        el.style.outline = '2px solid rgba(26, 92, 46, 0.9)';
        el.style.outlineOffset = '3px';
        el.style.backgroundColor = 'rgba(171, 255, 192, 0.08)';
        setTimeout(() => {
          el.style.outline = '';
          el.style.outlineOffset = '';
          el.style.backgroundColor = '';
        }, 2000);
        // Auto-open the note card after scroll completes
        setTimeout(() => {
          const matchingNote = savedNotes.find(n => n.element === el);
          if (matchingNote) showNoteCard(matchingNote);
        }, 400);
      }
    } catch (err) {
      console.warn('[Canopy] Could not scroll to element:', err);
    }
  }
});

// ==================== INIT ====================
// Load saved notes when page is ready
loadNotesFromStorage();

// Listen for storage changes from sidepanel/dashboard
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.divnotes_notes) {
    const newAllNotes: StoredNote[] = changes.divnotes_notes.newValue || [];
    const pageUrl = getPageUrl();
    const newPageNoteIds = new Set(newAllNotes.filter(n => n.url === pageUrl).map(n => n.id));

    // For any note currently in DOM that is NOT in new storage, remove it
    savedNotes.forEach(note => {
      if (!newPageNoteIds.has(note.id)) {
        console.log('[Canopy] Note removed externally:', note.id);
        deleteNote(note.id, true); // skip storage sync as storage is already updated
      }
    });

    // Check for NEW notes (sync across tabs or from dashboard)
    // For simplicity, we only handle deletions in real-time. 
    // New notes are loaded on page refresh or client-side navigation.

    updateNoteBadgeCount();
  }
});

console.log('[Canopy] Content script ready');
