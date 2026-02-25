// DivNotes Content Script
// Pure DOM for inspector, note editor, and note badges
import DOMPurify from 'dompurify';
import { marked } from 'marked';

console.log('[DivNotes] Content script loaded');

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
  createdAt: string;
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
  createdAt: string;
}

// ==================== STYLES ====================
const highlightStyle = document.createElement('style');
highlightStyle.id = 'divnotes-styles';
highlightStyle.textContent = `
  .divnotes-highlight {
    outline: 2px solid rgba(139, 92, 246, 0.8) !important;
    outline-offset: 2px !important;
    background-color: rgba(139, 92, 246, 0.08) !important;
    transition: outline 0.15s ease, background-color 0.15s ease !important;
    cursor: crosshair !important;
  }
  .divnotes-selected {
    outline: 2px solid rgba(139, 92, 246, 1) !important;
    outline-offset: 2px !important;
    background-color: rgba(139, 92, 246, 0.12) !important;
  }
  .divnotes-has-note {
    position: relative !important;
  }
  ::highlight(divnotes-text-selection) {
    background-color: rgba(139, 92, 246, 0.3) !important;
    border-bottom: 2px dashed rgba(139, 92, 246, 0.8);
    color: inherit;
  }
  @keyframes divnotes-pulse {
    0%, 100% { box-shadow: 0 2px 12px rgba(124,58,237,0.4); }
    50% { box-shadow: 0 2px 16px rgba(124,58,237,0.7); }
  }
  @keyframes divnotes-fadein {
    from { opacity: 0; transform: scale(0.8) translateY(4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
`;
document.head.appendChild(highlightStyle);

// CSS highlights namespace
const divNotesHighlight = typeof Highlight !== 'undefined' ? new Highlight() : null;
if (divNotesHighlight && CSS.highlights) {
  CSS.highlights.set('divnotes-text-selection', divNotesHighlight);
}

function applyTextHighlight(note: SavedNote) {
  if (!note.selectedText || !divNotesHighlight) return;
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
      divNotesHighlight.add(range);
      idx = nodeText.indexOf(text, idx + text.length);
    }
    node = walker.nextNode();
  }
}

function clearTextHighlight(note: SavedNote) {
  // To clear specifically for one note, we'd need a mapping of ranges.
  // For simplicity, we just rebuild all highlights or let them be.
  // A robust approach clears all and re-applies the remaining notes.
  if (divNotesHighlight) {
    divNotesHighlight.clear();
    savedNotes.forEach(applyTextHighlight);
  }
}

// ==================== STATE ====================
let isInspecting = false;
let selectedElement: HTMLElement | null = null;
let statusBanner: HTMLElement | null = null;
let noteEditorContainer: HTMLElement | null = null;
const savedNotes: SavedNote[] = [];
let notesVisible = true;
let screenShareMode = false;

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
  try {
    chrome.runtime.sendMessage({
      type: 'UPDATE_BADGE_COUNT',
      count: savedNotes.length,
    });
  } catch { /* extension context may be invalid */ }
}

// ==================== INSPECTOR ====================
function activateInspector() {
  if (isInspecting) return;
  isInspecting = true;
  console.log('[DivNotes] Inspector activated');
  showStatusBanner();
  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
}

function deactivateInspector() {
  isInspecting = false;
  hideStatusBanner();
  document.removeEventListener('mouseover', onMouseOver, true);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKeyDown, true);
  document.querySelectorAll('.divnotes-highlight').forEach(el => {
    el.classList.remove('divnotes-highlight');
  });
}

function onMouseOver(e: Event) {
  if (!isInspecting) return;
  const target = e.target as HTMLElement;
  if (target.closest('#divnotes-root') || target.closest('#divnotes-banner') || target.closest('.divnotes-badge') || target.closest('.divnotes-note-card')) return;
  document.querySelectorAll('.divnotes-highlight').forEach(el => {
    el.classList.remove('divnotes-highlight');
  });
  target.classList.add('divnotes-highlight');
}

function onClick(e: Event) {
  if (!isInspecting) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  const target = e.target as HTMLElement;
  if (target.closest('#divnotes-root') || target.closest('#divnotes-banner') || target.closest('.divnotes-badge') || target.closest('.divnotes-note-card')) return;
  document.querySelectorAll('.divnotes-highlight').forEach(el => {
    el.classList.remove('divnotes-highlight');
  });
  target.classList.add('divnotes-selected');
  selectedElement = target;
  deactivateInspector();
  showNoteEditor(target);
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    if (noteEditorContainer) {
      closeNoteEditor();
    } else {
      deactivateInspector();
    }
  }
}

// ==================== STATUS BANNER ====================
function showStatusBanner() {
  if (statusBanner) return;
  statusBanner = document.createElement('div');
  statusBanner.id = 'divnotes-banner';
  statusBanner.innerHTML = `
    <span style="width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px rgba(74,222,128,0.6);display:inline-block;"></span>
    <span>Select an element · Press ESC to cancel</span>
  `;
  Object.assign(statusBanner.style, {
    position: 'fixed', top: '16px', right: '16px',
    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: 'white',
    padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '500',
    fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', alignItems: 'center',
    gap: '8px', boxShadow: '0 4px 20px rgba(124,58,237,0.4)', zIndex: '2147483647',
  });
  document.body.appendChild(statusBanner);
}

function hideStatusBanner() {
  if (statusBanner) { statusBanner.remove(); statusBanner = null; }
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

function createNoteBadge(note: SavedNote) {
  if (note.badgeEl) note.badgeEl.remove();
  if (note.expandedEl) note.expandedEl.remove();

  const pos = getBadgePosition(note.element);

  const badge = document.createElement('div');
  badge.className = 'divnotes-badge';
  Object.assign(badge.style, {
    position: 'fixed',
    top: `${pos.top}px`,
    left: `${pos.left}px`,
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, #a78bfa 0%, #7c3aed 50%, #6d28d9 100%)',
    border: '2px solid rgba(255,255,255,0.9)',
    cursor: 'pointer',
    zIndex: '2147483645',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    animation: 'divnotes-pulse 2s infinite, divnotes-fadein 0.25s ease-out',
    boxShadow: '0 0 8px rgba(139,92,246,0.6), 0 0 20px rgba(139,92,246,0.3)',
    pointerEvents: 'auto',
  });
  badge.title = 'DivNotes';

  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

  badge.addEventListener('mouseenter', () => {
    badge.style.transform = 'scale(1.4)';
    badge.style.boxShadow = '0 0 12px rgba(139,92,246,0.8), 0 0 30px rgba(139,92,246,0.5)';
    hoverTimeout = setTimeout(() => showNoteCard(note), 150);
  });
  badge.addEventListener('mouseleave', () => {
    badge.style.transform = 'scale(1)';
    badge.style.boxShadow = '0 0 8px rgba(139,92,246,0.6), 0 0 20px rgba(139,92,246,0.3)';
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

  const card = document.createElement('div');
  card.className = 'divnotes-note-card';
  Object.assign(card.style, {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${cardWidth}px`,
    zIndex: '2147483646',
    fontFamily: "'Inter', system-ui, sans-serif",
    animation: 'divnotes-fadein 0.15s ease-out',
    pointerEvents: 'auto',
  });

  const displayDate = note.createdAt.includes('T')
    ? new Date(note.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : note.createdAt;

  card.innerHTML = `
    <div style="
      background: #18181b; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.15);
      overflow: hidden; width: 340px;
    ">
      <div style="padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size:10px;font-family:'SF Mono',monospace;color:#71717a;background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:3px;">
          ${DOMPurify.sanitize(note.elementInfo)}
        </span>
        <span style="font-size:10px;color:#3f3f46;">${displayDate}</span>
      </div>

      <div style="padding: 14px; font-size: 13px; line-height: 1.7; color: #e4e4e7; max-height: 200px; overflow-y: auto;">
        ${simpleMarkdown(note.content)}
      </div>

      <div style="padding: 8px 14px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px; justify-content: flex-end;">
        <button class="divnotes-move-btn" style="
          font-size:11px; color:#71717a; background:transparent; border:none;
          cursor:pointer; padding:4px 10px; border-radius:4px; font-family:'Inter',sans-serif;
        ">Move</button>
        <button class="divnotes-edit-btn" style="
          font-size:11px; color:#71717a; background:transparent; border:none;
          cursor:pointer; padding:4px 10px; border-radius:4px; font-family:'Inter',sans-serif;
        ">Edit</button>
        <button class="divnotes-delete-btn" style="
          font-size:11px; color:#ef4444; background:transparent; border:none;
          cursor:pointer; padding:4px 10px; border-radius:4px; font-family:'Inter',sans-serif; opacity:0.7;
        ">Delete</button>
      </div>
    </div>
  `;

  card.querySelector('.divnotes-move-btn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    card.remove();
    note.expandedEl = null;
    moveNote(note);
  });

  card.querySelector('.divnotes-edit-btn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    card.remove();
    note.expandedEl = null;
    showNoteEditor(note.element, note);
  });

  card.querySelector('.divnotes-delete-btn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteNote(note.id);
  });

  // Hover effects on buttons
  card.querySelectorAll('.divnotes-move-btn, .divnotes-edit-btn').forEach(btn => {
    btn.addEventListener('mouseenter', (e) => {
      (e.target as HTMLElement).style.color = '#fafafa';
      (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
    });
    btn.addEventListener('mouseleave', (e) => {
      (e.target as HTMLElement).style.color = '#71717a';
      (e.target as HTMLElement).style.background = 'transparent';
    });
  });
  card.querySelector('.divnotes-delete-btn')!.addEventListener('mouseenter', (e) => {
    (e.target as HTMLElement).style.opacity = '1';
    (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
  });
  card.querySelector('.divnotes-delete-btn')!.addEventListener('mouseleave', (e) => {
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
    note.element.classList.remove('divnotes-has-note');
    clearTextHighlight(note);
    savedNotes.splice(idx, 1);
    if (!skipStorage) saveNotesToStorage();
    console.log('[DivNotes] Note deleted');
  }
}

function moveNote(note: SavedNote) {
  console.log('[DivNotes] Move mode activated');

  // Show a move-specific banner
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'fixed', top: '0', left: '0', right: '0',
    zIndex: '2147483647', padding: '10px 16px',
    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    color: '#fff', fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '13px', fontWeight: '500', textAlign: 'center',
    boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
  });
  banner.textContent = '🔀 Move note — click a new element (ESC to cancel)';
  document.body.appendChild(banner);

  const onHover = (e: Event) => {
    const t = e.target as HTMLElement;
    if (t === banner || t.classList.contains('divnotes-badge')) return;
    t.classList.add('divnotes-highlight');
  };
  const onOut = (e: Event) => {
    (e.target as HTMLElement).classList.remove('divnotes-highlight');
  };
  const onPick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const newEl = e.target as HTMLElement;
    if (newEl === banner || newEl.classList.contains('divnotes-badge')) return;
    newEl.classList.remove('divnotes-highlight');
    cleanup();

    // Re-attach note to new element
    note.element.classList.remove('divnotes-has-note');
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
    console.log('[DivNotes] Note moved to', note.elementSelector);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { cleanup(); }
  };
  const cleanup = () => {
    banner.remove();
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
  console.log('[DivNotes] Notes visibility:', notesVisible);
}

function toggleScreenShareMode() {
  screenShareMode = !screenShareMode;
  console.log('[DivNotes] Screen Share Mode:', screenShareMode ? 'ON' : 'OFF');

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
  chrome.storage.local.set({ divnotes_screen_share: screenShareMode });
}

function clearAllBadges() {
  if (divNotesHighlight) divNotesHighlight.clear();
  savedNotes.forEach(note => {
    if (note.badgeEl) { note.badgeEl.remove(); note.badgeEl = null; }
    if (note.expandedEl) { note.expandedEl.remove(); note.expandedEl = null; }
    note.element.classList.remove('divnotes-has-note');
  });
  savedNotes.length = 0;
}

// ==================== SPA ROUTE DETECTION ====================
let lastSpaUrl = getPageUrl();
function checkUrlChange() {
  const currentUrl = getPageUrl();
  if (currentUrl !== lastSpaUrl) {
    console.log('[DivNotes] SPA navigation:', lastSpaUrl, '→', currentUrl);
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
  selectedElement.classList.add('divnotes-selected');

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
  noteEditorContainer.id = 'divnotes-root';
  Object.assign(noteEditorContainer.style, {
    position: 'fixed', top: `${top}px`, left: `${left}px`,
    width: `${editorWidth}px`, zIndex: '2147483647',
    fontFamily: "'Inter', system-ui, sans-serif",
  });

  const prefillContent = existingNote ? existingNote.content : '';

  noteEditorContainer.innerHTML = `
    <div style="
      background: #18181b; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px; box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.2);
      overflow: hidden; animation: divnotes-fadein 0.15s ease-out;
    ">
      <div style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 8px;">
        <div style="width: 6px; height: 6px; border-radius: 50%; background: #8b5cf6; box-shadow: 0 0 8px rgba(139,92,246,0.5);"></div>
        <span style="font-size: 11px; font-family: 'SF Mono','Fira Code',monospace; color: #a1a1aa; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">
          ${elInfo}
        </span>
        <span style="flex: 1;"></span>
        <span style="font-size: 10px; color: #52525b;">${window.location.hostname}</span>
      </div>
      
      <div style="display: flex; padding: 4px 12px 0; gap: 2px;" id="divnotes-tabs">
        <button data-tab="write" style="padding:6px 14px;font-size:12px;font-weight:500;color:#fafafa;background:rgba(255,255,255,0.08);border:none;border-radius:6px 6px 0 0;cursor:pointer;font-family:'Inter',sans-serif;">Write</button>
        <button data-tab="preview" style="padding:6px 14px;font-size:12px;font-weight:500;color:#71717a;background:transparent;border:none;border-radius:6px 6px 0 0;cursor:pointer;font-family:'Inter',sans-serif;">Preview</button>
      </div>

      <div style="padding: 6px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; gap: 2px;" id="divnotes-toolbar">
        <button data-md="**" title="Bold" style="width:30px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#a1a1aa;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer;">B</button>
        <button data-md="_" title="Italic" style="width:30px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-style:italic;color:#a1a1aa;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer;">I</button>
        <button data-md="\`" title="Code" style="width:30px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-family:'SF Mono',monospace;color:#a1a1aa;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer;">&lt;&gt;</button>
        <button data-md="## " data-prefix="true" title="Heading" style="width:30px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#a1a1aa;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer;">H</button>
        <button data-md="- " data-prefix="true" title="List" style="width:30px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#a1a1aa;background:transparent;border:1px solid transparent;border-radius:4px;cursor:pointer;">•</button>
      </div>

      <div style="padding: 12px;" id="divnotes-write">
        <textarea id="divnotes-textarea" placeholder="Write your note in Markdown..." style="
          width:100%;min-height:140px;max-height:300px;background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;font-size:13px;
          font-family:'Inter',system-ui,sans-serif;color:#fafafa;outline:none;resize:vertical;
          line-height:1.6;box-sizing:border-box;
        ">${prefillContent}</textarea>
      </div>

      <div style="padding: 12px; display: none;" id="divnotes-preview">
        <div id="divnotes-preview-content" style="
          min-height:140px;padding:12px;font-size:13px;line-height:1.7;color:#e4e4e7;
          background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.08);
        "><span style="color:#52525b">Nothing to preview</span></div>
      </div>

      <div style="padding: 8px 12px 12px; display: flex; justify-content: flex-end; gap: 8px;">
        <button id="divnotes-cancel" style="
          padding:7px 16px;font-size:12px;font-weight:500;color:#a1a1aa;
          background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);
          border-radius:7px;cursor:pointer;font-family:'Inter',sans-serif;
        ">Cancel</button>
        <button id="divnotes-save" style="
          padding:7px 20px;font-size:12px;font-weight:600;color:white;
          background:${prefillContent ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : '#27272a'};
          border:none;border-radius:7px;
          cursor:${prefillContent ? 'pointer' : 'not-allowed'};
          font-family:'Inter',sans-serif;
          opacity:${prefillContent ? '1' : '0.5'};
          box-shadow:${prefillContent ? '0 2px 12px rgba(124,58,237,0.3)' : 'none'};
        ">${existingNote ? 'Update Note' : 'Save Note'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(noteEditorContainer);

  const textarea = document.getElementById('divnotes-textarea') as HTMLTextAreaElement;
  const saveBtn = document.getElementById('divnotes-save') as HTMLButtonElement;
  const cancelBtn = document.getElementById('divnotes-cancel') as HTMLButtonElement;
  const writeArea = document.getElementById('divnotes-write')!;
  const previewArea = document.getElementById('divnotes-preview')!;
  const previewContent = document.getElementById('divnotes-preview-content')!;
  const toolbar = document.getElementById('divnotes-toolbar')!;
  const tabsContainer = document.getElementById('divnotes-tabs')!;

  setTimeout(() => textarea.focus(), 50);

  textarea.addEventListener('input', () => {
    const hasContent = textarea.value.trim().length > 0;
    saveBtn.style.background = hasContent ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#27272a';
    saveBtn.style.cursor = hasContent ? 'pointer' : 'not-allowed';
    saveBtn.style.opacity = hasContent ? '1' : '0.5';
    saveBtn.style.boxShadow = hasContent ? '0 2px 12px rgba(124,58,237,0.3)' : 'none';
  });

  textarea.addEventListener('focus', () => { textarea.style.borderColor = 'rgba(139,92,246,0.5)'; });
  textarea.addEventListener('blur', () => { textarea.style.borderColor = 'rgba(255,255,255,0.08)'; });

  tabsContainer.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    const tab = btn.getAttribute('data-tab');
    tabsContainer.querySelectorAll('button').forEach(b => {
      (b as HTMLElement).style.color = '#71717a';
      (b as HTMLElement).style.background = 'transparent';
    });
    btn.style.color = '#fafafa';
    btn.style.background = 'rgba(255,255,255,0.08)';
    if (tab === 'write') {
      writeArea.style.display = 'block'; previewArea.style.display = 'none'; toolbar.style.display = 'flex';
    } else {
      writeArea.style.display = 'none'; previewArea.style.display = 'block'; toolbar.style.display = 'none';
      const md = textarea.value;
      previewContent.innerHTML = md.trim() ? simpleMarkdown(md) : '<span style="color:#52525b">Nothing to preview</span>';
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
      createdAt: new Date().toISOString(),
      badgeEl: null,
      expandedEl: null,
    };
    note.content = val;

    if (isNew) {
      savedNotes.push(note);
      createNoteBadge(note);
      if (note.selectedText) applyTextHighlight(note);
      saveNotesToStorage();
      console.log('[DivNotes] Note saved! Total:', savedNotes.length);
    } else {
      // update
      if (note.expandedEl) {
        note.expandedEl.remove();
        note.expandedEl = null;
      }
      saveNotesToStorage();
      console.log('[DivNotes] Note updated');
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
  if (selectedElement) { selectedElement.classList.remove('divnotes-selected'); selectedElement = null; }
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
    console.error('[DivNotes] Markdown parsing error', e);
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
      const classes = current.className.trim().split(/\s+/).filter(c => !c.startsWith('divnotes')).slice(0, 2);
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
    console.log('[DivNotes] Loading', pageNotes.length, 'notes for this page');

    pageNotes.forEach(stored => {
      try {
        const el = findMatchingElement(stored);
        if (!el) {
          console.warn('[DivNotes] Element not found for note (all strategies failed):', stored.id);
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
          createdAt: stored.createdAt,
          badgeEl: null,
          expandedEl: null,
        };
        savedNotes.push(note);
        createNoteBadge(note);
        if (note.selectedText) applyTextHighlight(note);
      } catch (err) {
        console.warn('[DivNotes] Error restoring note:', err);
      }
    });
    updateNoteBadgeCount();
  });
}

// ==================== MESSAGE LISTENER ====================
chrome.runtime.onMessage.addListener((message) => {
  console.log('[DivNotes] Message:', message.type);
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
        el.style.outline = '2px solid rgba(139, 92, 246, 0.9)';
        el.style.outlineOffset = '3px';
        el.style.backgroundColor = 'rgba(139, 92, 246, 0.08)';
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
      console.warn('[DivNotes] Could not scroll to element:', err);
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
        console.log('[DivNotes] Note removed externally:', note.id);
        deleteNote(note.id, true); // skip storage sync as storage is already updated
      }
    });

    // Check for NEW notes (sync across tabs or from dashboard)
    // For simplicity, we only handle deletions in real-time. 
    // New notes are loaded on page refresh or client-side navigation.

    updateNoteBadgeCount();
  }
});

console.log('[DivNotes] Content script ready');
