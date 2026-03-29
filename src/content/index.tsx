// Canopy Content Script
// Pure DOM for inspector, note editor, and note badges
import DOMPurify from 'dompurify';
import { marked } from 'marked';
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

function deleteNote(id: string, skipStorage = false) {
  const idx = savedNotes.findIndex(n => n.id === id);
  if (idx > -1) {
    const note = savedNotes[idx];
    if (note.badgeEl) note.badgeEl.remove();
    if (note.expandedEl) note.expandedEl.remove();
    note.element.classList.remove('canopy-has-note');
    clearTextHighlight(note);
    savedNotes.splice(idx, 1);
    if (!skipStorage) saveNotesToStorage();
    updateNoteBadgeCount();
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
  const onPick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const newEl = e.target as HTMLElement;
    if (isCanopyUiTarget(newEl)) return;
    newEl.classList.remove('canopy-highlight');
    cleanup();

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
    saveNotesToStorage();
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

  // Hide any open editor
  if (noteEditorContainer) {
    noteEditorContainer.remove();
    noteEditorContainer = null;
  }

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
function showNoteEditor(element: HTMLElement, existingNote?: SavedNote, selectedText?: string) {
  if (noteEditorContainer) noteEditorContainer.remove();

  selectedElement = element;
  selectedElement.classList.add('canopy-selected');

  const rect = element.getBoundingClientRect();
  const editorWidth = 380;
  const editorHeight = 380;

  let top = rect.bottom + 8;
  let left = rect.left;
  if (top + editorHeight > window.innerHeight) top = rect.top - editorHeight - 8;
  if (left + editorWidth > window.innerWidth) left = window.innerWidth - editorWidth - 16;
  if (left < 8) left = 8;
  if (top < 8) top = 8;

  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const cls = element.className && typeof element.className === 'string'
    ? '.' + element.className.split(' ').filter(Boolean).slice(0, 2).join('.')
    : '';
  const elInfo = `<${tag}${id}${cls}>${selectedText ? ` — selection: "${selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"` : ''}`;

  noteEditorContainer = document.createElement('div');
  noteEditorContainer.id = 'canopy-root';
  Object.assign(noteEditorContainer.style, {
    position: 'fixed', top: `${top}px`, left: `${left}px`,
    width: `${editorWidth}px`, zIndex: '2147483647',
    fontFamily: 'system-ui, sans-serif',
  });

  let selectedFolderId: string | null = existingNote?.folderId ?? null;

  const prefillContent = existingNote ? existingNote.content : '';

  noteEditorContainer.innerHTML = `
    <div style="
      background: #FAFAF7; border: 1px solid rgba(5,36,21,0.06);
      border-radius: 14px; box-shadow: 0 8px 32px rgba(5,36,21,0.12);
      overflow: hidden; animation: canopy-fadein 0.15s ease-out;
    ">
      <div style="padding: 12px 16px; border-bottom: 1px solid rgba(5,36,21,0.06); display: flex; align-items: center; gap: 8px;">
        <div style="width: 18px; height: 18px; border-radius: 6px; background: linear-gradient(135deg, #052415, #1a5c2e);"></div>
        <span style="font-size: 12px; font-weight: 600; color: #052415; flex: 1;">
          ${existingNote ? 'Edit Note' : 'New Note'}
        </span>
        <span style="font-size: 10px; font-family: 'SF Mono',monospace; color: #7a8a7d; background: rgba(5,36,21,0.04); padding: 2px 8px; border-radius: 4px;">
          ${elInfo}
        </span>
      </div>
      
      <div style="display: flex; padding: 4px 12px 0; gap: 2px;" id="canopy-tabs">
        <button data-tab="write" style="padding:6px 14px;font-size:12px;font-weight:500;color:#052415;background:rgba(5,36,21,0.04);border:none;border-radius:6px 6px 0 0;cursor:pointer;font-family:system-ui,sans-serif;">Write</button>
        <button data-tab="preview" style="padding:6px 14px;font-size:12px;font-weight:500;color:#7a8a7d;background:transparent;border:none;border-radius:6px 6px 0 0;cursor:pointer;font-family:system-ui,sans-serif;">Preview</button>
      </div>

      <div style="padding: 6px 12px; border-bottom: 1px solid rgba(5,36,21,0.06); display: flex; gap: 2px;" id="canopy-toolbar">
        <button data-md="**" title="Bold" style="width:30px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#7a8a7d;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer;">B</button>
        <button data-md="_" title="Italic" style="width:30px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-style:italic;color:#7a8a7d;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer;">I</button>
        <button data-md="\`" title="Code" style="width:30px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-family:'SF Mono',monospace;color:#7a8a7d;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer;">&lt;&gt;</button>
        <button data-md="## " data-prefix="true" title="Heading" style="width:30px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#7a8a7d;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer;">H</button>
        <button data-md="- " data-prefix="true" title="List" style="width:30px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#7a8a7d;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer;">•</button>
      </div>

      <div style="padding: 12px;" id="canopy-write">
        <textarea id="canopy-textarea" placeholder="Write your note in Markdown..." style="
          width:100%;min-height:140px;max-height:300px;background:#FFFFFF;
          border:1px solid rgba(5,36,21,0.1);border-radius:8px;padding:12px;font-size:13px;
          font-family:system-ui,sans-serif;color:#052415;outline:none;resize:vertical;
          line-height:1.6;box-sizing:border-box;
        ">${prefillContent}</textarea>
      </div>

      <div style="padding: 12px; display: none;" id="canopy-preview">
        <div id="canopy-preview-content" style="
          min-height:140px;padding:12px;font-size:13px;line-height:1.7;color:#052415;
          background:#FFFFFF;border-radius:8px;border:1px solid rgba(5,36,21,0.1);
        "><span style="color:#7a8a7d">Nothing to preview</span></div>
      </div>

      <div id="canopy-folder-picker" style="border-top:1px solid rgba(5,36,21,0.06);"></div>

      <div style="padding: 8px 12px 12px; display: flex; justify-content: flex-end; gap: 8px;">
        <button id="canopy-cancel" style="
          padding:7px 16px;font-size:12px;font-weight:500;color:#7a8a7d;
          background:rgba(5,36,21,0.04);border:1px solid rgba(5,36,21,0.06);
          border-radius:10px;cursor:pointer;font-family:system-ui,sans-serif;
        ">Cancel</button>
        <button id="canopy-save" style="
          padding:7px 20px;font-size:12px;font-weight:600;color:#F5EFE9;
          background:${prefillContent ? '#052415' : 'rgba(5,36,21,0.1)'};
          border:none;border-radius:10px;
          cursor:${prefillContent ? 'pointer' : 'not-allowed'};
          font-family:system-ui,sans-serif;
          opacity:${prefillContent ? '1' : '0.5'};
          box-shadow:${prefillContent ? '0 2px 8px rgba(5,36,21,0.2)' : 'none'};
        ">${existingNote ? 'Update Note' : 'Save Note'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(noteEditorContainer);

  // Load folders and auto-suggest
  chrome.storage.local.get(['divnotes_folders', 'divnotes_notes'], (result) => {
    const folders = result.divnotes_folders || [];
    const allNotes = result.divnotes_notes || [];

    // Auto-suggest: count notes per folder for current domain
    const domainNotes = allNotes.filter((n: any) => n.hostname === window.location.hostname);
    const folderCounts: Record<string, number> = {};
    for (const n of domainNotes) {
      if (n.folderId) {
        folderCounts[n.folderId] = (folderCounts[n.folderId] || 0) + 1;
      }
    }

    // Pick folder with >50% of domain notes
    const total = domainNotes.length;
    let suggestedFolderId: string | null = null;
    if (total > 0) {
      for (const [fId, count] of Object.entries(folderCounts)) {
        if ((count as number) / total > 0.5) {
          suggestedFolderId = fId;
          break;
        }
      }
    }

    selectedFolderId = suggestedFolderId || (existingNote?.folderId ?? null);

    // Build folder picker UI
    const pickerContainer = document.getElementById('canopy-folder-picker');
    if (pickerContainer && folders.length > 0) {
      const selectedFolder = folders.find((f: any) => f.id === selectedFolderId);
      const displayName = selectedFolder ? selectedFolder.name : 'Inbox';

      pickerContainer.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;padding:4px 12px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#a1a1aa;flex-shrink:0;">
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
          </svg>
          <span id="canopy-folder-name" style="font-size:11px;color:#052415;flex:1;">${displayName}</span>
          <button id="canopy-folder-change" style="font-size:10px;color:#1a5c2e;background:none;border:none;cursor:pointer;padding:2px 6px;font-family:system-ui,sans-serif;">Change</button>
        </div>
      `;

      // "Change" button opens folder tree dropdown
      const changeBtn = document.getElementById('canopy-folder-change');
      changeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const existing = document.getElementById('canopy-folder-dropdown');
        if (existing) { existing.remove(); return; }

        const dropdown = document.createElement('div');
        dropdown.id = 'canopy-folder-dropdown';
        Object.assign(dropdown.style, {
          maxHeight: '200px', overflow: 'auto',
          background: '#FFFFFF', border: '1px solid rgba(5,36,21,0.1)',
          borderRadius: '6px', margin: '4px 12px',
          padding: '4px 0',
        });

        // Inbox option
        const inboxRow = document.createElement('button');
        Object.assign(inboxRow.style, {
          display: 'flex', alignItems: 'center', gap: '6px',
          width: '100%', padding: '6px 10px', border: 'none',
          background: selectedFolderId === null ? 'rgba(171,255,192,0.15)' : 'transparent',
          color: '#052415', fontSize: '11px', cursor: 'pointer',
          fontFamily: 'system-ui,sans-serif', textAlign: 'left',
        });
        inboxRow.textContent = 'Inbox';
        inboxRow.addEventListener('click', () => {
          selectedFolderId = null;
          const nameEl = document.getElementById('canopy-folder-name');
          if (nameEl) nameEl.textContent = 'Inbox';
          dropdown.remove();
        });
        dropdown.appendChild(inboxRow);

        // Render folders (flat, indented by parentId depth)
        const renderFolder = (folder: any, depth: number) => {
          const row = document.createElement('button');
          Object.assign(row.style, {
            display: 'flex', alignItems: 'center', gap: '6px',
            width: '100%', padding: '6px 10px', border: 'none',
            paddingLeft: `${10 + depth * 16}px`,
            background: selectedFolderId === folder.id ? 'rgba(171,255,192,0.15)' : 'transparent',
            color: '#052415', fontSize: '11px', cursor: 'pointer',
            fontFamily: 'system-ui,sans-serif', textAlign: 'left',
          });
          row.textContent = folder.name;
          row.addEventListener('click', () => {
            selectedFolderId = folder.id;
            const nameEl = document.getElementById('canopy-folder-name');
            if (nameEl) nameEl.textContent = folder.name;
            dropdown.remove();
          });
          dropdown.appendChild(row);

          // Render children
          const children = folders.filter((f: any) => f.parentId === folder.id);
          children.sort((a: any, b: any) => a.order - b.order);
          for (const child of children) renderFolder(child, depth + 1);
        };

        // Root folders
        const roots = folders.filter((f: any) => !f.parentId);
        roots.sort((a: any, b: any) => a.order - b.order);
        for (const root of roots) renderFolder(root, 0);

        pickerContainer.appendChild(dropdown);
      });
    }
  });

  const textarea = document.getElementById('canopy-textarea') as HTMLTextAreaElement;
  const saveBtn = document.getElementById('canopy-save') as HTMLButtonElement;
  const cancelBtn = document.getElementById('canopy-cancel') as HTMLButtonElement;
  const writeArea = document.getElementById('canopy-write')!;
  const previewArea = document.getElementById('canopy-preview')!;
  const previewContent = document.getElementById('canopy-preview-content')!;
  const toolbar = document.getElementById('canopy-toolbar')!;
  const tabsContainer = document.getElementById('canopy-tabs')!;

  setTimeout(() => textarea.focus(), 50);

  textarea.addEventListener('input', () => {
    const hasContent = textarea.value.trim().length > 0;
    saveBtn.style.background = hasContent ? '#052415' : 'rgba(5,36,21,0.1)';
    saveBtn.style.cursor = hasContent ? 'pointer' : 'not-allowed';
    saveBtn.style.opacity = hasContent ? '1' : '0.5';
    saveBtn.style.boxShadow = hasContent ? '0 2px 8px rgba(5,36,21,0.2)' : 'none';
    saveBtn.style.color = hasContent ? '#F5EFE9' : '#7a8a7d';
  });

  textarea.addEventListener('focus', () => { textarea.style.borderColor = 'rgba(26,92,46,0.5)'; });
  textarea.addEventListener('blur', () => { textarea.style.borderColor = 'rgba(5,36,21,0.1)'; });

  tabsContainer.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const tab = btn.getAttribute('data-tab');
    tabsContainer.querySelectorAll('button').forEach(b => {
      (b as HTMLElement).style.color = '#7a8a7d';
      (b as HTMLElement).style.background = 'transparent';
    });
    btn.style.color = '#052415';
    btn.style.background = 'rgba(5,36,21,0.04)';
    if (tab === 'write') {
      writeArea.style.display = 'block'; previewArea.style.display = 'none'; toolbar.style.display = 'flex';
    } else {
      writeArea.style.display = 'none'; previewArea.style.display = 'block'; toolbar.style.display = 'none';
      const md = textarea.value;
      previewContent.innerHTML = md.trim() ? simpleMarkdown(md) : '<span style="color:#7a8a7d">Nothing to preview</span>';
    }
  });

  toolbar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const md = btn.getAttribute('data-md') || '';
    const isPrefix = btn.getAttribute('data-prefix') === 'true';
    if (isPrefix) {
      textarea.value += '\n' + md;
    } else {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const sel = textarea.value.substring(start, end);
      textarea.value = textarea.value.substring(0, start) + md + sel + md + textarea.value.substring(end);
    }
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  });

  cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); closeNoteEditor(); });

  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Save note
    const val = textarea.value.trim();
    if (!val) {
      closeNoteEditor();
      return;
    }

    const isNew = !existingNote;
    const hashtags = extractHashtagsFromContent(val);
    const note: SavedNote = existingNote || {
      id: crypto.randomUUID(),
      element,
      elementSelector: getCssSelector(element),
      elementXPath: getXPath(element),
      elementTextHash: getTextHash(element),
      elementPosition: getPosition(element),
      elementInfo: elInfo,
      content: '',
      selectedText: selectedText,
      folderId: null,
      tags: [],
      pinned: false,
      createdAt: new Date().toISOString(),
      badgeEl: null,
      expandedEl: null,
    };
    note.content = val;
    note.folderId = selectedFolderId;
    note.tags = hashtags;

    if (isNew) {
      savedNotes.push(note);
      createNoteBadge(note);
      if (note.selectedText) applyTextHighlight(note);
      updateNoteBadgeCount();
      saveNotesToStorage();
      console.log('[Canopy] Note saved! Total:', savedNotes.length);

      // Extract and sync hashtags
      if (hashtags.length > 0) {
        chrome.runtime.sendMessage({
          type: 'SYNC_NOTE_TAGS',
          noteId: note.id,
          tagNames: hashtags,
        });
      }
    } else {
      // update
      if (note.expandedEl) {
        note.expandedEl.remove();
        note.expandedEl = null;
      }
      saveNotesToStorage();
      console.log('[Canopy] Note updated');

      // Extract and sync hashtags
      if (hashtags.length > 0) {
        chrome.runtime.sendMessage({
          type: 'SYNC_NOTE_TAGS',
          noteId: note.id,
          tagNames: hashtags,
        });
      }
    }

    closeNoteEditor();
  });

  noteEditorContainer.addEventListener('click', (e) => e.stopPropagation());
  noteEditorContainer.addEventListener('mousedown', (e) => e.stopPropagation());

  const editorKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeNoteEditor();
      document.removeEventListener('keydown', editorKeyDown, true);
    }
  };
  document.addEventListener('keydown', editorKeyDown, true);
}

function closeNoteEditor() {
  if (noteEditorContainer) { noteEditorContainer.remove(); noteEditorContainer = null; }
  if (selectedElement) { selectedElement.classList.remove('canopy-selected'); selectedElement = null; }
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
  const pageUrl = getPageUrl();
  const storedNotes: StoredNote[] = savedNotes.map(n => ({
    id: n.id,
    url: pageUrl,
    hostname: window.location.hostname,
    pageTitle: document.title,
    elementSelector: n.elementSelector,
    elementTag: n.element.tagName.toLowerCase(),
    elementInfo: n.elementInfo,
    content: n.content,
    elementXPath: n.elementXPath,
    elementTextHash: n.elementTextHash,
    elementPosition: n.elementPosition,
    selectedText: n.selectedText,
    createdAt: n.createdAt,
    folderId: n.folderId,
    tags: n.tags,
    pinned: n.pinned,
  }));

  // Merge with notes from other pages
  chrome.storage.local.get(['divnotes_notes'], (result) => {
    const allNotes: StoredNote[] = result.divnotes_notes || [];
    const otherPageNotes = allNotes.filter(n => n.url !== pageUrl);
    const merged = [...otherPageNotes, ...storedNotes];
    chrome.storage.local.set({ divnotes_notes: merged });
    updateNoteBadgeCount();
  });
}

function loadNotesFromStorage() {
  const pageUrl = getPageUrl();
  chrome.storage.local.get(['divnotes_notes'], (result) => {
    const allNotes: StoredNote[] = result.divnotes_notes || [];
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
          tags: stored.tags ?? [],
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
