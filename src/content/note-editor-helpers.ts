import type { StoredNote } from '../lib/types.ts';

type DomainNoteLike = Pick<StoredNote, 'hostname' | 'folderId'>;

type FolderPickerElement = {
  id: string;
  textContent: string | null;
  style: { cssText: string };
  appendChild(child: unknown): unknown;
  addEventListener(type: string, listener: (event: Event) => void): void;
  setAttribute?(name: string, value: string): void;
  children?: unknown[];
};

type FolderPickerDocument = {
  createElement(tagName: string): FolderPickerElement;
  createElementNS?(namespace: string, tagName: string): FolderPickerElement;
};

type SavedNoteForStorage = {
  id: string;
  element: Pick<HTMLElement, 'tagName'>;
  elementSelector: string;
  elementInfo: string;
  content: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
  createdAt: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
};

type StorageLike = {
  get(
    keys: string[],
    callback: (items: { divnotes_notes?: StoredNote[] }) => void
  ): void;
  set(items: { divnotes_notes: StoredNote[] }, callback?: () => void): void;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function appendChildren(parent: FolderPickerElement, children: FolderPickerElement[]) {
  children.forEach((child) => parent.appendChild(child));
}

export function getSuggestedFolderIdForDomain(
  allNotes: readonly DomainNoteLike[],
  hostname: string
): string | null {
  const domainNotes = allNotes.filter((note) => note.hostname === hostname);
  if (domainNotes.length === 0) {
    return null;
  }

  const folderCounts: Record<string, number> = {};
  for (const note of domainNotes) {
    if (!note.folderId) {
      continue;
    }
    folderCounts[note.folderId] = (folderCounts[note.folderId] || 0) + 1;
  }

  for (const [folderId, count] of Object.entries(folderCounts)) {
    if (count / domainNotes.length > 0.5) {
      return folderId;
    }
  }

  return null;
}

export function getInitialSelectedFolderId({
  isNew,
  existingFolderId,
  suggestedFolderId,
}: {
  isNew: boolean;
  existingFolderId: string | null | undefined;
  suggestedFolderId: string | null;
}): string | null {
  if (isNew) {
    return suggestedFolderId ?? null;
  }

  return existingFolderId ?? suggestedFolderId ?? null;
}

export function createFolderPickerHeader(
  doc: FolderPickerDocument,
  displayName: string
) {
  const header = doc.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 12px;';

  const icon = doc.createElementNS
    ? doc.createElementNS(SVG_NS, 'svg')
    : doc.createElement('span');
  icon.style.cssText = 'color:#a1a1aa;flex-shrink:0;';
  icon.setAttribute?.('width', '12');
  icon.setAttribute?.('height', '12');
  icon.setAttribute?.('viewBox', '0 0 24 24');
  icon.setAttribute?.('fill', 'none');
  icon.setAttribute?.('stroke', 'currentColor');
  icon.setAttribute?.('stroke-width', '2');

  if (doc.createElementNS) {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute?.(
      'd',
      'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'
    );
    icon.appendChild(path);
  } else {
    icon.textContent = ' ';
  }

  const nameEl = doc.createElement('span');
  nameEl.id = 'canopy-folder-name';
  nameEl.style.cssText = 'font-size:11px;color:#d4d4d8;flex:1;';
  nameEl.textContent = displayName;

  const changeBtn = doc.createElement('button');
  changeBtn.id = 'canopy-folder-change';
  changeBtn.style.cssText = [
    'font-size:10px',
    'color:#7c3aed',
    'background:none',
    'border:none',
    'cursor:pointer',
    'padding:2px 6px',
    "font-family:'Inter',sans-serif",
  ].join(';');
  changeBtn.textContent = 'Change';

  appendChildren(header, [icon, nameEl, changeBtn]);

  return { header, nameEl, changeBtn };
}

function mapSavedNotesToStoredNotes({
  savedNotes,
  pageUrl,
  hostname,
  pageTitle,
}: {
  savedNotes: readonly SavedNoteForStorage[];
  pageUrl: string;
  hostname: string;
  pageTitle: string;
}): StoredNote[] {
  return savedNotes.map((note) => ({
    id: note.id,
    url: pageUrl,
    hostname,
    pageTitle,
    elementSelector: note.elementSelector,
    elementTag: note.element.tagName.toLowerCase(),
    elementInfo: note.elementInfo,
    content: note.content,
    elementXPath: note.elementXPath,
    elementTextHash: note.elementTextHash,
    elementPosition: note.elementPosition,
    selectedText: note.selectedText,
    createdAt: note.createdAt,
    folderId: note.folderId,
    tags: note.tags,
    pinned: note.pinned,
  }));
}

export function savePageNotesToStorage({
  savedNotes,
  pageUrl,
  hostname,
  pageTitle,
  storage,
  updateBadgeCount,
}: {
  savedNotes: readonly SavedNoteForStorage[];
  pageUrl: string;
  hostname: string;
  pageTitle: string;
  storage: StorageLike;
  updateBadgeCount: () => void;
}): Promise<StoredNote[]> {
  const storedNotes = mapSavedNotesToStoredNotes({
    savedNotes,
    pageUrl,
    hostname,
    pageTitle,
  });

  return new Promise((resolve) => {
    storage.get(['divnotes_notes'], (result) => {
      const allNotes: StoredNote[] = result.divnotes_notes || [];
      const otherPageNotes = allNotes.filter((note) => note.url !== pageUrl);
      const merged = [...otherPageNotes, ...storedNotes];

      storage.set({ divnotes_notes: merged }, () => {
        updateBadgeCount();
        resolve(merged);
      });
    });
  });
}
