import type { StoredFolder, StoredNote, StoredTag } from '../lib/types.ts';

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
  updatedAt: string;
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

type EditorDraft = {
  title: string;
  body: string;
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

export function hasMeaningfulEditorContent({ title, body }: EditorDraft): boolean {
  return title.trim().length > 0 || body.trim().length > 0;
}

function normalizeTagName(tag: string): string {
  return tag.trim().replace(/^#+/, '').toLowerCase();
}

function resolveTagLabel(
  tag: string,
  tagCatalog: readonly Pick<StoredTag, 'id' | 'name'>[]
): string {
  const normalized = normalizeTagName(tag);
  if (!normalized) {
    return '';
  }

  const matchedTag = tagCatalog.find(
    (candidate) => candidate.id === tag || normalizeTagName(candidate.name) === normalized
  );

  return matchedTag ? normalizeTagName(matchedTag.name) : normalized;
}

export function formatEditorContent({ title, body }: EditorDraft): string {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    return body;
  }

  if (body.length === 0) {
    return `# ${trimmedTitle}`;
  }

  return `# ${trimmedTitle}\n\n${body}`;
}

export function parseEditorDraft(content: string): EditorDraft {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.trim()) {
    return { title: '', body: '' };
  }

  const firstLineBreak = normalized.indexOf('\n');
  const firstLine = firstLineBreak === -1 ? normalized : normalized.slice(0, firstLineBreak);
  const titleMatch = firstLine.match(/^#\s+(.+?)\s*$/);
  if (!titleMatch) {
    return { title: '', body: normalized };
  }

  let body = firstLineBreak === -1 ? '' : normalized.slice(firstLineBreak + 1);
  if (body.startsWith('\n')) {
    body = body.slice(1);
  }

  return {
    title: titleMatch[1]?.trim() ?? '',
    body,
  };
}

export function getInitialManualTags(
  savedTags: readonly string[],
  content: string
): string[] {
  const contentTags = new Set(extractHashtagsFromEditorContent(content));
  const manualTags: string[] = [];

  for (const tag of savedTags) {
    const normalized = normalizeTagName(tag);
    if (!normalized || contentTags.has(normalized) || manualTags.includes(normalized)) {
      continue;
    }

    manualTags.push(normalized);
  }

  return manualTags;
}

export function resolveStoredTagLabels(
  tags: readonly string[],
  tagCatalog: readonly Pick<StoredTag, 'id' | 'name'>[] = []
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const tag of tags) {
    if (typeof tag !== 'string') {
      continue;
    }

    const resolvedLabel = resolveTagLabel(tag, tagCatalog);
    if (!resolvedLabel || seen.has(resolvedLabel)) {
      continue;
    }

    seen.add(resolvedLabel);
    labels.push(resolvedLabel);
  }

  return labels;
}

function extractHashtagsFromEditorContent(content: string): string[] {
  const regex = /(?:^|(?<=\s))#([a-zA-Z0-9_-]{1,50})(?=\s|$)/g;
  const tags = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }

  return Array.from(tags);
}

export function buildEditorTagNames(
  manualTags: readonly string[],
  draft: EditorDraft
): string[] {
  return Array.from(
    new Set([
      ...manualTags.map(normalizeTagName).filter(Boolean),
      ...extractHashtagsFromEditorContent(formatEditorContent(draft)),
    ])
  );
}

export function getFolderChipLabel(
  folders: ReadonlyArray<Pick<StoredFolder, 'id' | 'name'>>,
  selectedFolderId: string | null
): string {
  if (!selectedFolderId) {
    return 'Inbox';
  }

  return folders.find((folder) => folder.id === selectedFolderId)?.name ?? 'Inbox';
}

export function getTagChipLabels(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const tag of tags) {
    const normalized = normalizeTagName(tag);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    labels.push(`#${normalized}`);
  }

  return labels;
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
    updatedAt: note.updatedAt ?? note.createdAt,
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
  getLastError,
}: {
  savedNotes: readonly SavedNoteForStorage[];
  pageUrl: string;
  hostname: string;
  pageTitle: string;
  storage: StorageLike;
  updateBadgeCount: () => void;
  getLastError?: () => Error | undefined;
}): Promise<StoredNote[]> {
  const storedNotes = mapSavedNotesToStoredNotes({
    savedNotes,
    pageUrl,
    hostname,
    pageTitle,
  });

  return new Promise((resolve, reject) => {
    storage.get(['divnotes_notes'], (result) => {
      const readError = getLastError?.();
      if (readError) {
        reject(readError);
        return;
      }

      const allNotes: StoredNote[] = result.divnotes_notes || [];
      const otherPageNotes = allNotes.filter((note) => note.url !== pageUrl);
      const merged = [...otherPageNotes, ...storedNotes];

      storage.set({ divnotes_notes: merged }, () => {
        const writeError = getLastError?.();
        if (writeError) {
          reject(writeError);
          return;
        }

        updateBadgeCount();
        resolve(merged);
      });
    });
  });
}

// ==================== FOLDER SELECTOR HELPERS ====================

type FolderLike = Pick<StoredFolder, 'id' | 'name' | 'parentId' | 'order'>;

export type FolderSelectionOption = {
  id: string;
  label: string;
  depth: number;
};

export function buildFolderSelectionTree(
  folders: readonly FolderLike[]
): FolderSelectionOption[] {
  const result: FolderSelectionOption[] = [];

  const appendChildren = (parentId: string | null, depth: number, prefix: string) => {
    const children = folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.order - b.order);

    for (const folder of children) {
      const label = prefix ? `${prefix} / ${folder.name}` : folder.name;
      result.push({ id: folder.id, label, depth });
      appendChildren(folder.id, depth + 1, label);
    }
  };

  appendChildren(null, 0, '');
  return result;
}

const FOLDER_COLORS = [
  '#1a5c2e', '#2a8c4e', '#0d7377', '#4a6741',
  '#2d6a4f', '#40916c', '#52b788', '#74c69d',
];

export function createFolderDraft({
  name,
  parentId,
  siblings,
}: {
  name: string;
  parentId: string | null;
  siblings: readonly FolderLike[];
}): StoredFolder {
  const sameLevelSiblings = siblings.filter((f) => f.parentId === parentId);
  const maxOrder = sameLevelSiblings.reduce((max, f) => Math.max(max, f.order), -1);

  return {
    id: crypto.randomUUID(),
    name,
    parentId,
    order: maxOrder + 1,
    color: FOLDER_COLORS[sameLevelSiblings.length % FOLDER_COLORS.length],
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
