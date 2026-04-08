// Canopy Content Script
// Pure DOM for inspector, note editor, and note badges
import interFontCss from '@fontsource-variable/inter/index.css?inline';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { StoredFolder, StoredTag } from '../lib/types.ts';
import {
  createEditorState,
  editorReducer,
  buildSavePayload,
  type EditorState,
  type TargetInfo,
} from '../lib/editor-controller.ts';
import { computeAnchoredOverlayPosition, watchAnchorPosition } from './anchored-overlay.ts';
import { createEditorSurface, createTagRow } from './editor-surface.ts';
import {
  buildEditorTagNames,
  buildFolderSelectionTree,
  getFolderChipLabel,
  getInitialManualTags,
  getSuggestedFolderIdForDomain,
  getTagChipLabels,
  hasMeaningfulEditorContent,
  resolveStoredTagLabels,
  savePageNotesToStorage,
} from './note-editor-helpers.ts';
import { findMatchingElement } from './note-targeting.ts';
import {
  createHoverSelectorPill,
  createNotePreviewCardShell,
  createPageNoteCountPill,
  createPlacedNoteBadge,
  createSelectionConfirmationPill,
  createSelectorGuide,
} from './overlay-ui.ts';

const CONTENT_FONT_STYLE_ID = 'canopy-content-fonts';

function ensureContentFontStyles() {
  if (document.getElementById(CONTENT_FONT_STYLE_ID)) {
    return;
  }

  const fontStyle = document.createElement('style');
  fontStyle.id = CONTENT_FONT_STYLE_ID;
  fontStyle.textContent = interFontCss;
  (document.head ?? document.documentElement).appendChild(fontStyle);
}

ensureContentFontStyles();

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
  updatedAt: string;
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
  updatedAt: string;
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
    outline: 2px solid oklch(0.508 0.118 165.612 / 0.8) !important;
    outline-offset: 2px !important;
    background-color: oklch(0.865 0.127 207.078 / 0.08) !important;
    transition: outline 0.15s ease, background-color 0.15s ease !important;
    cursor: crosshair !important;
  }
  .canopy-selected {
    outline: 2px solid oklch(0.508 0.118 165.612) !important;
    outline-offset: 2px !important;
    background-color: oklch(0.865 0.127 207.078 / 0.12) !important;
  }
  .canopy-has-note {
    position: relative !important;
    outline: 1px solid oklch(0.865 0.127 207.078 / 0.28) !important;
    outline-offset: 1px !important;
  }
  ::highlight(canopy-text-selection) {
    background-color: oklch(0.865 0.127 207.078 / 0.3) !important;
    border-bottom: 2px dashed oklch(0.508 0.118 165.612 / 0.8);
    color: inherit;
  }
  @keyframes canopy-pulse {
    0%, 100% { box-shadow: 0 2px 8px oklch(0.148 0.004 228.8 / 0.2); }
    50% { box-shadow: 0 2px 12px oklch(0.148 0.004 228.8 / 0.4); }
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
let stopEditorAnchorWatch: (() => void) | null = null;
let stopCardAnchorWatch: (() => void) | null = null;
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

// ==================== NOTE COUNT PILL ====================
function updateNoteBadgeCount() {
  syncPageNoteCountPill();
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

function getNoteTargetKey(
  note: Pick<SavedNote, 'elementSelector' | 'elementXPath' | 'elementTextHash' | 'elementPosition'>
) {
  return [
    note.elementSelector || '',
    note.elementXPath || '',
    note.elementTextHash || '',
    note.elementPosition || '',
  ].join('::');
}

function getNotesForTarget(
  target:
    | string
    | Pick<SavedNote, 'elementSelector' | 'elementXPath' | 'elementTextHash' | 'elementPosition'>
) {
  const targetKey = typeof target === 'string' ? target : getNoteTargetKey(target);
  return savedNotes.filter((note) => getNoteTargetKey(note) === targetKey);
}

function getSharedBadge(notes: SavedNote[]) {
  return notes.find((note) => note.badgeEl)?.badgeEl ?? null;
}

function getSharedCard(notes: SavedNote[]) {
  return notes.find((note) => note.expandedEl)?.expandedEl ?? null;
}

function clearGroupedCard(notes: SavedNote[]) {
  const sharedCard = getSharedCard(notes);
  if (sharedCard) {
    sharedCard.remove();
  }
  if (sharedCard && stopCardAnchorWatch) {
    stopCardAnchorWatch();
    stopCardAnchorWatch = null;
  }
  notes.forEach((groupNote) => {
    groupNote.expandedEl = null;
  });
}

function clearGroupedBadge(notes: SavedNote[]) {
  const sharedBadge = getSharedBadge(notes);
  if (sharedBadge) {
    sharedBadge.remove();
  }
  notes.forEach((groupNote) => {
    groupNote.badgeEl = null;
  });
}

function resetGroupedVisuals(notes: SavedNote[]) {
  clearGroupedCard(notes);
  clearGroupedBadge(notes);
  notes.forEach((groupNote) => {
    groupNote.element.classList.remove('canopy-has-note');
  });
}

function createNoteBadge(note: SavedNote) {
  const targetKey = getNoteTargetKey(note);
  const groupedNotes = getNotesForTarget(targetKey);
  if (groupedNotes.length === 0) {
    return;
  }

  resetGroupedVisuals(groupedNotes);

  const anchorNote = groupedNotes[0];
  const pos = getBadgePosition(anchorNote.element);
  const badge = createPlacedNoteBadge(document, groupedNotes.length);
  badge.style.top = `${pos.top}px`;
  badge.style.left = `${pos.left}px`;
  badge.style.display = notesVisible && !screenShareMode ? 'flex' : 'none';
  groupedNotes.forEach((groupNote) => {
    groupNote.element.classList.add('canopy-has-note');
  });

  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

  badge.addEventListener('mouseenter', () => {
    badge.style.transform = 'scale(1.1)';
    badge.style.boxShadow = '0 4px 16px oklch(0.148 0.004 228.8 / 0.3)';
    hoverTimeout = setTimeout(() => showNoteCard(anchorNote), 150);
  });
  badge.addEventListener('mouseleave', () => {
    badge.style.transform = 'scale(1)';
    badge.style.boxShadow = '0 2px 8px oklch(0.148 0.004 228.8 / 0.2)';
    if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null; }
    // Grace period — don't close if cursor moves to the card
    setTimeout(() => {
      const currentGroup = getNotesForTarget(targetKey);
      const sharedCard = getSharedCard(currentGroup);
      if (sharedCard && !sharedCard.matches(':hover') && !badge.matches(':hover')) {
        clearGroupedCard(currentGroup);
      }
    }, 200);
  });

  badge.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.body.appendChild(badge);
  groupedNotes.forEach((groupNote) => {
    groupNote.badgeEl = badge;
  });
}

function showNoteCard(note: SavedNote) {
  const targetKey = getNoteTargetKey(note);
  const groupedNotes = getNotesForTarget(targetKey);
  if (groupedNotes.length === 0) {
    return;
  }

  // Already showing
  if (groupedNotes.some((groupNote) => groupNote.expandedEl)) return;

  // Close any other expanded cards
  if (stopCardAnchorWatch) { stopCardAnchorWatch(); stopCardAnchorWatch = null; }
  savedNotes.forEach((savedNote) => {
    if (savedNote.expandedEl) { savedNote.expandedEl.remove(); savedNote.expandedEl = null; }
  });

  const anchorNote = groupedNotes[0];
  const rect = anchorNote.element.getBoundingClientRect();
  const cardWidth = 340;
  const cardHeight = Math.min(440, 200 + groupedNotes.length * 120);

  const pos = computeAnchoredOverlayPosition({
    anchorRect: rect,
    overlaySize: { width: cardWidth, height: cardHeight },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    offset: 12,
  });

  const card = createNotePreviewCardShell(document, {
    notes: groupedNotes.map((groupNote) => ({
      id: groupNote.id,
      elementInfo: groupNote.elementInfo,
      displayDate: groupNote.createdAt.includes('T')
        ? new Date(groupNote.createdAt).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : groupNote.createdAt,
      title: getNotePreviewTitle(groupNote),
      previewText: groupNote.content,
      tags:
        groupNote.tags.length > 0
          ? groupNote.tags
          : extractHashtagsFromContent(groupNote.content),
    })),
  });
  card.style.top = `${pos.top}px`;
  card.style.left = `${pos.left}px`;

  // Watch anchor position so the card follows the element on scroll/resize
  if (stopCardAnchorWatch) stopCardAnchorWatch();
  stopCardAnchorWatch = watchAnchorPosition(window, anchorNote.element, (newRect) => {
    const updated = computeAnchoredOverlayPosition({
      anchorRect: newRect,
      overlaySize: { width: cardWidth, height: cardHeight },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      offset: 12,
    });
    card.style.top = `${updated.top}px`;
    card.style.left = `${updated.left}px`;
  });

  const previewBodies = card.querySelectorAll('[data-canopy-preview-body]');
  groupedNotes.forEach((groupNote, index) => {
    const previewBody = previewBodies[index] as HTMLElement | undefined;
    if (previewBody) {
      previewBody.innerHTML = simpleMarkdown(groupNote.content);
    }
  });

  const handleActionClick = (
    selector: string,
    action: (targetNote: SavedNote, event: MouseEvent) => void
  ) => {
    card.querySelectorAll(selector).forEach((buttonNode) => {
      const button = buttonNode as HTMLButtonElement;
      const noteId = button.dataset.canopyNoteId;
      const targetNote = groupedNotes.find((groupNote) => groupNote.id === noteId);
      if (!targetNote) {
        return;
      }
      button.addEventListener('click', (event) => action(targetNote, event));
    });
  };

  handleActionClick('[data-canopy-move]', (targetNote, event) => {
    event.stopPropagation();
    clearGroupedCard(groupedNotes);
    moveNote(targetNote);
  });

  handleActionClick('[data-canopy-edit]', (targetNote, event) => {
    event.stopPropagation();
    clearGroupedCard(groupedNotes);
    showNoteEditor(targetNote.element, targetNote);
  });

  handleActionClick('[data-canopy-delete]', (targetNote, event) => {
    event.stopPropagation();
    deleteNote(targetNote.id);
  });

  // Hover effects on buttons
  card.querySelectorAll('[data-canopy-move], [data-canopy-edit]').forEach((buttonNode) => {
    const button = buttonNode as HTMLElement;
    button.addEventListener('mouseenter', (event) => {
      (event.target as HTMLElement).style.color = 'oklch(0.987 0.002 197.1)';
      (event.target as HTMLElement).style.background = 'oklch(0.148 0.004 228.8 / 0.34)';
    });
    button.addEventListener('mouseleave', (event) => {
      (event.target as HTMLElement).style.color = 'oklch(0.987 0.002 197.1)';
      (event.target as HTMLElement).style.background = 'oklch(0.274 0.006 286.033)';
    });
  });
  card.querySelectorAll('[data-canopy-delete]').forEach((buttonNode) => {
    const button = buttonNode as HTMLElement;
    button.addEventListener('mouseenter', (event) => {
      (event.target as HTMLElement).style.background = 'oklch(0.704 0.191 22.216 / 0.22)';
    });
    button.addEventListener('mouseleave', (event) => {
      (event.target as HTMLElement).style.background = 'oklch(0.704 0.191 22.216 / 0.14)';
    });
  });

  card.addEventListener('click', (e) => e.stopPropagation());
  card.addEventListener('mousedown', (e) => e.stopPropagation());

  // Auto-close when cursor leaves the card (with grace period for badge)
  card.addEventListener('mouseleave', () => {
    setTimeout(() => {
      const currentGroup = getNotesForTarget(targetKey);
      const sharedBadge = getSharedBadge(currentGroup);
      if (getSharedCard(currentGroup) && !card.matches(':hover') && (!sharedBadge || !sharedBadge.matches(':hover'))) {
        clearGroupedCard(currentGroup);
      }
    }, 300);
  });

  document.body.appendChild(card);
  groupedNotes.forEach((groupNote) => {
    groupNote.expandedEl = card;
  });
}

async function deleteNote(id: string, skipStorage = false) {
  const idx = savedNotes.findIndex(n => n.id === id);
  if (idx > -1) {
    const note = savedNotes[idx];
    const targetKey = getNoteTargetKey(note);
    const groupedNotes = getNotesForTarget(targetKey);
    resetGroupedVisuals(groupedNotes);
    clearTextHighlight(note);
    savedNotes.splice(idx, 1);
    const remainingGroupedNotes = getNotesForTarget(targetKey);
    if (remainingGroupedNotes.length > 0) {
      createNoteBadge(remainingGroupedNotes[0]);
    }
    updateNoteBadgeCount();

    if (!skipStorage) {
      try {
        await saveNotesToStorage();
      } catch (error) {
        savedNotes.splice(idx, 0, note);
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
    const previousXPath = note.elementXPath;
    const previousTextHash = note.elementTextHash;
    const previousPosition = note.elementPosition;
    const previousInfo = note.elementInfo;
    const previousTargetKey = getNoteTargetKey(note);
    const previousGroupedNotes = getNotesForTarget(previousTargetKey);
    resetGroupedVisuals(previousGroupedNotes);

    // Re-attach note to new element
    note.element = newEl;
    note.elementSelector = getCssSelector(newEl);
    note.elementXPath = getXPath(newEl);
    note.elementTextHash = getTextHash(newEl);
    note.elementPosition = getPosition(newEl);
    const tag = newEl.tagName.toLowerCase();
    const id = newEl.id ? `#${newEl.id}` : '';
    const cls = newEl.className && typeof newEl.className === 'string'
      ? '.' + newEl.className.split(' ').filter(Boolean).slice(0, 2).join('.')
      : '';
    note.elementInfo = `<${tag}${id}${cls}>`;

    const nextTargetKey = getNoteTargetKey(note);
    try {
      await saveNotesToStorage();
    } catch (error) {
      note.element = previousElement;
      note.elementSelector = previousSelector;
      note.elementXPath = previousXPath;
      note.elementTextHash = previousTextHash;
      note.elementPosition = previousPosition;
      note.elementInfo = previousInfo;
      createNoteBadge(note);
      console.error('[Canopy] Failed to move note', error);
      return;
    }
    const remainingPreviousGroupedNotes = getNotesForTarget(previousTargetKey);
    if (remainingPreviousGroupedNotes.length > 0) {
      createNoteBadge(remainingPreviousGroupedNotes[0]);
    }
    createNoteBadge(note);
    if (previousTargetKey !== nextTargetKey) {
      updateNoteBadgeCount();
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
  button.style.background = enabled
    ? 'oklch(0.432 0.095 166.913)'
    : 'oklch(0.148 0.004 228.8 / 0.18)';
  button.style.cursor = enabled ? 'pointer' : 'not-allowed';
  button.style.opacity = enabled ? '1' : '0.5';
  button.style.color = enabled ? 'oklch(0.979 0.021 166.113)' : 'oklch(0.723 0.014 214.4)';
  button.style.boxShadow = enabled ? '0 14px 26px oklch(0.432 0.095 166.913 / 0.18)' : 'none';
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
  const editorWidth = 308;
  const editorHeight = 385;

  const editorPos = computeAnchoredOverlayPosition({
    anchorRect: rect,
    overlaySize: { width: editorWidth, height: editorHeight },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    offset: 8,
  });

  const targetInfo: TargetInfo = {
    url: getPageUrl(),
    hostname: window.location.hostname,
    pageTitle: document.title,
    elementSelector: getCssSelector(element),
    elementTag: element.tagName.toLowerCase(),
    elementInfo: getElementInfo(element),
    elementXPath: existingNote?.elementXPath ?? getXPath(element),
    elementTextHash: existingNote?.elementTextHash ?? getTextHash(element),
    elementPosition: existingNote?.elementPosition ?? getPosition(element),
    selectedText,
  };
  let editorState = createEditorState(targetInfo, existingNote ?? null);
  let availableFolders: StoredFolder[] = [];
  let manualTags = getInitialManualTags(existingNote?.tags ?? [], editorState.body);

  noteEditorContainer = createEditorSurface(document as unknown as Parameters<typeof createEditorSurface>[0], {
    isNew: !existingNote,
    body: editorState.body,
    folderLabel: 'All Notes',
    tagLabels: getTagChipLabels(buildEditorTagNames(manualTags, { title: '', body: editorState.body })),
    pinned: editorState.pinned,
    errorMessage: '',
    saveDisabled: editorState.saveDisabled,
  }) as unknown as HTMLElement;

  Object.assign(noteEditorContainer.style, {
    position: 'fixed',
    top: `${editorPos.top}px`,
    left: `${editorPos.left}px`,
    width: `${editorWidth}px`,
    zIndex: '2147483647',
    fontFamily: 'Inter Variable, system-ui, sans-serif',
  });

  document.body.appendChild(noteEditorContainer);

  // Watch anchor position so the editor follows the element on scroll/resize
  if (stopEditorAnchorWatch) stopEditorAnchorWatch();
  stopEditorAnchorWatch = watchAnchorPosition(window, element, (newRect) => {
    const updated = computeAnchoredOverlayPosition({
      anchorRect: newRect,
      overlaySize: { width: editorWidth, height: editorHeight },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      offset: 8,
    });
    if (noteEditorContainer) {
      noteEditorContainer.style.top = `${updated.top}px`;
      noteEditorContainer.style.left = `${updated.left}px`;
    }
  });

  const currentEditor = noteEditorContainer;
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

  if (!bodyTextarea || !folderControl || !folderLabel || !folderChangeButton || !pinnedInput || !errorEl || !saveBtn || !closeBtn) {
    closeNoteEditor();
    return;
  }

  let tagRow = currentEditor.querySelector('[data-canopy-tag-row]') as HTMLElement | null;
  let folderDropdown: HTMLElement | null = null;
  const defaultSaveLabel = existingNote ? 'Update Note' : 'Save Note';

  const updateFolderLabel = () => {
    folderLabel.textContent = getFolderChipLabel(availableFolders, editorState.folderId);
  };

  const updateSaveState = () => {
    applySaveButtonState(saveBtn, !editorState.saveDisabled);
  };

  const applyHoverState = (
    element: HTMLElement,
    active: { background?: string; color?: string; borderColor?: string; boxShadow?: string },
    idle: { background?: string; color?: string; borderColor?: string; boxShadow?: string }
  ) => {
    element.addEventListener('mouseenter', () => {
      if (active.background) {
        element.style.background = active.background;
      }
      if (active.color) {
        element.style.color = active.color;
      }
      if (active.borderColor) {
        element.style.borderColor = active.borderColor;
      }
      if (active.boxShadow) {
        element.style.boxShadow = active.boxShadow;
      }
    });

    element.addEventListener('mouseleave', () => {
      if (idle.background) {
        element.style.background = idle.background;
      }
      if (idle.color) {
        element.style.color = idle.color;
      }
      if (idle.borderColor) {
        element.style.borderColor = idle.borderColor;
      }
      if (idle.boxShadow) {
        element.style.boxShadow = idle.boxShadow;
      }
    });
  };

  const closeFolderDropdown = () => {
    if (folderDropdown) {
      folderDropdown.remove();
      folderDropdown = null;
    }
  };

  const selectFolder = (folderId: string | null) => {
    editorState = editorReducer(editorState, { type: 'SET_FOLDER', folderId });
    updateFolderLabel();
    closeFolderDropdown();
  };

  const createFolderOption = (label: string, folderId: string | null) => {
    const option = document.createElement('button');
    Object.assign(option.style, {
      display: 'block',
      width: '100%',
      padding: '9px 11px',
      border: '1px solid transparent',
      borderRadius: '12px',
      background:
        editorState.folderId === folderId
          ? 'oklch(0.148 0.004 228.8 / 0.34)'
          : 'transparent',
      color: 'oklch(0.987 0.002 197.1)',
      fontSize: '12px',
      fontWeight: '600',
      cursor: 'pointer',
      fontFamily: 'Inter Variable, system-ui, sans-serif',
      textAlign: 'left',
    });
    option.textContent = label;
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      selectFolder(folderId);
    });
    return option;
  };

  const createNewFolderRow = (parentId: string | null, parentLabel: string) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 0 0',
    });

    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.setAttribute('placeholder', parentLabel ? `Subfolder in ${parentLabel}` : 'New folder name');
    Object.assign(input.style, {
      all: 'initial',
      boxSizing: 'border-box',
      flex: '1',
      padding: '9px 11px',
      border: '1px solid oklch(1 0 0 / 15%)',
      borderRadius: '12px',
      fontSize: '12px',
      color: 'oklch(0.987 0.002 197.1)',
      fontFamily: 'Inter Variable, system-ui, sans-serif',
      lineHeight: '1.3',
      background: 'oklch(0.148 0.004 228.8 / 0.62)',
      appearance: 'none',
      outline: 'none',
      boxShadow: 'none',
      transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
    });

    input.addEventListener('focus', () => {
      input.style.borderColor = 'oklch(0.432 0.095 166.913 / 0.75)';
      input.style.boxShadow = '0 0 0 3px oklch(0.56 0.021 213.5 / 0.22)';
      input.style.background = 'oklch(0.148 0.004 228.8 / 0.72)';
    });

    input.addEventListener('blur', () => {
      input.style.borderColor = 'oklch(1 0 0 / 15%)';
      input.style.boxShadow = 'none';
      input.style.background = 'oklch(0.148 0.004 228.8 / 0.62)';
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Create';
    Object.assign(confirmBtn.style, {
      all: 'initial',
      boxSizing: 'border-box',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '36px',
      padding: '0 14px',
      border: '1px solid oklch(1 0 0 / 10%)',
      borderRadius: '12px',
      background: 'oklch(0.432 0.095 166.913)',
      color: 'oklch(0.979 0.021 166.113)',
      fontSize: '12px',
      fontWeight: '700',
      cursor: 'pointer',
      fontFamily: 'Inter Variable, system-ui, sans-serif',
      lineHeight: '1',
      appearance: 'none',
    });

    const doCreate = () => {
      const name = input.value.trim();
      if (!name) return;
      editorState = editorReducer(editorState, {
        type: 'SET_FOLDER_DRAFT',
        name,
        parentId,
      });
      chrome.runtime.sendMessage(
        { type: 'CREATE_FOLDER', name, parentId },
        (response) => {
          if (response?.success && response.folder) {
            availableFolders = [...availableFolders, response.folder];
            editorState = editorReducer(editorState, {
              type: 'FOLDER_CREATED',
              folderId: response.folder.id,
            });
            updateFolderLabel();
            closeFolderDropdown();
          }
        }
      );
    };

    confirmBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      doCreate();
    });
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') doCreate();
      if (event.key === 'Escape') closeFolderDropdown();
    });

    row.appendChild(input);
    row.appendChild(confirmBtn);
    return { row, input };
  };

  const openFolderDropdown = () => {
    if (folderDropdown) {
      closeFolderDropdown();
      return;
    }

    folderDropdown = document.createElement('div');
    folderDropdown.id = 'canopy-folder-dropdown';
    Object.assign(folderDropdown.style, {
      maxHeight: '240px',
      overflow: 'auto',
      background: 'oklch(0.218 0.008 223.9)',
      border: '1px solid oklch(1 0 0 / 10%)',
      borderRadius: '16px',
      marginTop: '8px',
      padding: '8px',
      width: '100%',
      boxShadow: '0 18px 48px oklch(0 0 0 / 0.28)',
    });

    // Inbox option (null folder)
    folderDropdown.appendChild(createFolderOption('All Notes', null));

    // Build flat selection tree with nested labels
    const tree = buildFolderSelectionTree(availableFolders);
    for (const option of tree) {
      folderDropdown.appendChild(createFolderOption(option.label, option.id));
    }

    // Separator
    const sep = document.createElement('div');
    Object.assign(sep.style, {
      height: '1px',
      background: 'oklch(1 0 0 / 10%)',
      margin: '8px 0',
    });
    folderDropdown.appendChild(sep);

    // Create folder row
    const { row: createRow, input: createInput } = createNewFolderRow(null, '');
    folderDropdown.appendChild(createRow);

    folderControl.appendChild(folderDropdown);

    // Auto-focus the create input
    setTimeout(() => createInput.focus(), 0);
  };

  const bindTagRow = () => {
    const addTagButton = tagRow?.querySelector('[data-canopy-add-tag]') as HTMLButtonElement | null;
    const tagInput = tagRow?.querySelector('[data-canopy-tag-input]') as HTMLInputElement | null;
    const confirmButton = tagRow?.querySelector('[data-canopy-add-tag-confirm]') as HTMLButtonElement | null;

    const commitTag = () => {
      if (!tagInput) return;
      const normalized = tagInput.value.trim().replace(/^#+/, '').toLowerCase();
      tagInput.value = '';
      if (tagInput) tagInput.style.display = 'none';
      if (confirmButton) confirmButton.style.display = 'none';
      if (addTagButton) addTagButton.style.display = '';

      if (!normalized) return;

      if (!manualTags.includes(normalized)) {
        manualTags = [...manualTags, normalized];
      }
      renderTagRow();
    };

    const cancelTag = () => {
      if (tagInput) {
        tagInput.value = '';
        tagInput.style.display = 'none';
      }
      if (confirmButton) confirmButton.style.display = 'none';
      if (addTagButton) addTagButton.style.display = '';
    };

    addTagButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (addTagButton) addTagButton.style.display = 'none';
      if (tagInput) {
        tagInput.style.display = '';
        tagInput.focus();
      }
      if (confirmButton) confirmButton.style.display = '';
    });

    tagInput?.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        commitTag();
      } else if (event.key === 'Escape') {
        cancelTag();
      }
    });

    tagInput?.addEventListener('focus', () => {
      if (!tagInput) return;
      tagInput.style.borderColor = 'oklch(0.432 0.095 166.913 / 0.75)';
      tagInput.style.boxShadow = '0 0 0 3px oklch(0.56 0.021 213.5 / 0.22)';
      tagInput.style.background = 'oklch(0.148 0.004 228.8 / 0.72)';
    });

    tagInput?.addEventListener('blur', () => {
      if (!tagInput) return;
      tagInput.style.borderColor = 'oklch(1 0 0 / 15%)';
      tagInput.style.boxShadow = 'none';
      tagInput.style.background = 'oklch(0.148 0.004 228.8 / 0.62)';
    });

    confirmButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      commitTag();
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
          title: '',
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

  bodyTextarea.addEventListener('focus', () => {
    bodyTextarea.style.borderColor = 'oklch(0.432 0.095 166.913 / 0.75)';
    bodyTextarea.style.boxShadow = '0 0 0 4px oklch(0.56 0.021 213.5 / 0.18)';
    bodyTextarea.style.background = 'oklch(0.148 0.004 228.8 / 0.72)';
  });

  bodyTextarea.addEventListener('blur', () => {
    bodyTextarea.style.borderColor = 'oklch(1 0 0 / 15%)';
    bodyTextarea.style.boxShadow = '0 0 0 4px oklch(0.56 0.021 213.5 / 0.12)';
    bodyTextarea.style.background = 'oklch(0.148 0.004 228.8 / 0.62)';
  });

  applyHoverState(
    folderChangeButton,
    {
      background: 'oklch(0.148 0.004 228.8 / 0.34)',
      color: 'oklch(0.987 0.002 197.1)',
    },
    {
      background: 'transparent',
      color: 'oklch(0.432 0.095 166.913)',
    }
  );

  applyHoverState(
    closeBtn,
    {
      background: 'oklch(0.148 0.004 228.8 / 0.34)',
      color: 'oklch(0.987 0.002 197.1)',
      borderColor: 'oklch(1 0 0 / 14%)',
    },
    {
      background: 'oklch(0.274 0.006 286.033)',
      color: 'oklch(0.987 0.002 197.1)',
      borderColor: 'oklch(1 0 0 / 10%)',
    }
  );

  deleteBtn &&
    applyHoverState(
      deleteBtn,
      {
        background: 'oklch(0.704 0.191 22.216 / 0.22)',
        color: 'oklch(0.704 0.191 22.216)',
      },
      {
        background: 'oklch(0.704 0.191 22.216 / 0.14)',
        color: 'oklch(0.704 0.191 22.216)',
      }
    );

  applyHoverState(
    saveBtn,
    {
      background: saveBtn.disabled ? 'oklch(0.148 0.004 228.8 / 0.18)' : 'oklch(0.508 0.118 165.612)',
      color: saveBtn.disabled ? 'oklch(0.723 0.014 214.4)' : 'oklch(0.979 0.021 166.113)',
      boxShadow: saveBtn.disabled ? 'none' : '0 16px 30px oklch(0.432 0.095 166.913 / 0.24)',
    },
    {
      background: saveBtn.disabled ? 'oklch(0.148 0.004 228.8 / 0.18)' : 'oklch(0.432 0.095 166.913)',
      color: saveBtn.disabled ? 'oklch(0.723 0.014 214.4)' : 'oklch(0.979 0.021 166.113)',
      boxShadow: saveBtn.disabled ? 'none' : '0 14px 26px oklch(0.432 0.095 166.913 / 0.18)',
    }
  );

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

    if (!editorState.folderId && suggestedFolderId) {
      editorState = editorReducer(editorState, {
        type: 'SET_FOLDER',
        folderId: suggestedFolderId,
      });
    }

    updateFolderLabel();
  });

  bodyTextarea.addEventListener('input', () => {
    editorState = editorReducer(editorState, { type: 'SET_BODY', body: bodyTextarea.value });
    errorEl.textContent = '';
    updateSaveState();
    renderTagRow();
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

    editorState = editorReducer(editorState, { type: 'SET_BODY', body: bodyTextarea.value });

    if (editorState.saveDisabled) {
      updateSaveState();
      return;
    }

    const payload = buildSavePayload(editorState);
    const nextTags = buildEditorTagNames(manualTags, { title: '', body: payload.content });
    const nextPinned = pinnedInput.checked;
    const previousTags = existingNote ? [...existingNote.tags] : [];

    editorState = editorReducer(editorState, { type: 'SAVE_START' });
    errorEl.textContent = '';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (!existingNote) {
        const timestamp = new Date().toISOString();
        const note: SavedNote = {
          id: crypto.randomUUID(),
          element,
          elementSelector: payload.elementSelector,
          elementXPath: payload.elementXPath,
          elementTextHash: payload.elementTextHash,
          elementPosition: payload.elementPosition,
          elementInfo: payload.elementInfo,
          content: payload.content,
          selectedText: payload.selectedText,
          folderId: payload.folderId,
          tags: nextTags,
          pinned: nextPinned,
          createdAt: timestamp,
          updatedAt: timestamp,
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
        const updatedAt = new Date().toISOString();
        const nextSavedNotes = savedNotes.map((note) =>
          note.id === existingNote.id
            ? {
                ...note,
                content: payload.content,
                folderId: payload.folderId,
                tags: nextTags,
                pinned: nextPinned,
                updatedAt,
              }
            : note
        );

        await persistSavedNotes(nextSavedNotes);
        existingNote.content = payload.content;
        existingNote.folderId = payload.folderId;
        existingNote.tags = nextTags;
        existingNote.pinned = nextPinned;
        existingNote.updatedAt = updatedAt;
        clearGroupedCard(getNotesForTarget(existingNote));
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
      editorState = editorReducer(editorState, {
        type: 'SAVE_ERROR',
        message: 'Could not save note. Try again.',
      });
      errorEl.textContent = editorState.errorMessage;
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
      bodyTextarea.focus();
    }
  }, 50);
}

function closeNoteEditor() {
  if (stopEditorAnchorWatch) { stopEditorAnchorWatch(); stopEditorAnchorWatch = null; }
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
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
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
          updatedAt: stored.updatedAt ?? stored.createdAt,
          badgeEl: null,
          expandedEl: null,
        };
        savedNotes.push(note);
      } catch (err) {
        console.warn('[Canopy] Error restoring note:', err);
      }
    });
    const renderedTargets = new Set<string>();
    savedNotes.forEach((note) => {
      const targetKey = getNoteTargetKey(note);
      if (renderedTargets.has(targetKey)) {
        return;
      }
      createNoteBadge(note);
      renderedTargets.add(targetKey);
    });
    savedNotes.forEach((note) => {
      if (note.selectedText) applyTextHighlight(note);
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
  if (message.type === 'SCROLL_TO_NOTE' && (message.selector || message.note)) {
    try {
      const el = (message.note
        ? findMatchingElement(document, message.note)
        : document.querySelector(message.selector)) as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash highlight
        el.style.transition = 'outline 0.3s ease, background-color 0.3s ease';
        el.style.outline = '2px solid oklch(0.508 0.118 165.612 / 0.9)';
        el.style.outlineOffset = '3px';
        el.style.backgroundColor = 'oklch(0.865 0.127 207.078 / 0.08)';
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
