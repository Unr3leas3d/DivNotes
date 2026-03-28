import type { StoredFolder, StoredNote, StoredTag } from './types';

export interface DomainGroup {
  hostname: string;
  count: number;
  noteIds: string[];
  pageTitle: string;
  latestNoteAt: string;
}

export interface FolderSummary {
  folder: StoredFolder;
  count: number;
  noteIds: string[];
}

export interface TagSummary {
  tag: StoredTag;
  count: number;
  noteIds: string[];
}

export interface ViewCountInput {
  notes: StoredNote[];
  folders: StoredFolder[];
  tags: StoredTag[];
  currentPageUrl: string | null;
}

function sortNotesNewestFirst(notes: StoredNote[]): StoredNote[] {
  return [...notes].sort((left, right) => {
    const createdDiff = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return right.id.localeCompare(left.id);
  });
}

function normalizeUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const normalizedPath =
      parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, '') : parsed.pathname;

    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return null;
  }
}

export function selectThisPageNotes(notes: StoredNote[], pageUrl: string | null): StoredNote[] {
  const normalizedPageUrl = normalizeUrl(pageUrl);
  if (!normalizedPageUrl) {
    return [];
  }

  return sortNotesNewestFirst(
    notes.filter((note) => normalizeUrl(note.url) === normalizedPageUrl)
  );
}

export function groupNotesByHostname(notes: StoredNote[]): DomainGroup[] {
  const groups = new Map<string, StoredNote[]>();

  for (const note of notes) {
    const hostname = note.hostname || 'unknown';
    const existing = groups.get(hostname);
    if (existing) {
      existing.push(note);
    } else {
      groups.set(hostname, [note]);
    }
  }

  return [...groups.entries()]
    .map(([hostname, groupedNotes]) => {
      const sortedNotes = sortNotesNewestFirst(groupedNotes);
      return {
        hostname,
        count: sortedNotes.length,
        noteIds: sortedNotes.map((note) => note.id),
        pageTitle: sortedNotes[0]?.pageTitle || hostname,
        latestNoteAt: sortedNotes[0]?.createdAt || '',
      };
    })
    .sort((left, right) => {
      const countDiff = right.count - left.count;
      if (countDiff !== 0) {
        return countDiff;
      }

      return left.hostname.localeCompare(right.hostname);
    });
}

export function buildFolderSummaries(
  notes: StoredNote[],
  folders: StoredFolder[]
): FolderSummary[] {
  return [...folders]
    .map((folder) => {
      const folderNotes = sortNotesNewestFirst(notes.filter((note) => note.folderId === folder.id));
      return {
        folder,
        count: folderNotes.length,
        noteIds: folderNotes.map((note) => note.id),
      };
    })
    .sort((left, right) => {
      const countDiff = right.count - left.count;
      if (countDiff !== 0) {
        return countDiff;
      }

      const orderDiff = left.folder.order - right.folder.order;
      if (orderDiff !== 0) {
        return orderDiff;
      }

      return left.folder.name.localeCompare(right.folder.name);
    });
}

export function buildTagSummaries(tags: StoredTag[], notes: StoredNote[]): TagSummary[] {
  return [...tags]
    .map((tag) => {
      const taggedNotes = sortNotesNewestFirst(notes.filter((note) => note.tags.includes(tag.id)));
      return {
        tag,
        count: taggedNotes.length,
        noteIds: taggedNotes.map((note) => note.id),
      };
    })
    .sort((left, right) => {
      const countDiff = right.count - left.count;
      if (countDiff !== 0) {
        return countDiff;
      }

      return left.tag.name.localeCompare(right.tag.name);
    });
}

export function buildViewCounts(
  input: ViewCountInput
): Record<'this-page' | 'all-notes' | 'folders' | 'tags', number> {
  return {
    'this-page': selectThisPageNotes(input.notes, input.currentPageUrl).length,
    'all-notes': input.notes.length,
    folders: input.folders.length,
    tags: input.tags.length,
  };
}

export function filterNotesBySearch(notes: StoredNote[], query: string): StoredNote[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return sortNotesNewestFirst(notes);
  }

  return sortNotesNewestFirst(
    notes.filter((note) =>
      [
        note.content,
        note.hostname,
        note.pageTitle,
        note.elementInfo,
        note.elementTag,
        note.selectedText,
        note.tagLabel,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery))
    )
  );
}
