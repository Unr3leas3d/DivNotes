import type { StoredFolder, StoredNote, StoredTag } from './types';
import type { CurrentPageState, WorkspaceData } from './extension-workspace-types';

export async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

export function getHostname(url: string | null): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function buildCurrentPageState(tab: chrome.tabs.Tab | null): CurrentPageState {
  const url = tab?.url || null;

  return {
    url,
    title: tab?.title || '',
    hostname: getHostname(url),
  };
}

export function emptyCurrentPageState(): CurrentPageState {
  return {
    url: null,
    title: '',
    hostname: null,
  };
}

export function emptyWorkspaceData(): WorkspaceData {
  return {
    notes: [],
    folders: [],
    tags: [],
  };
}

export function readExtensionWorkspaceStorage(): Promise<WorkspaceData> {
  return chrome.storage.local
    .get(['divnotes_notes', 'divnotes_folders', 'divnotes_tags'])
    .then((result) => ({
      notes: result.divnotes_notes || [],
      folders: result.divnotes_folders || [],
      tags: result.divnotes_tags || [],
    }));
}

function normalizeImportArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return [...map.values()];
}

function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

function buildCanonicalTagLookup(tags: StoredTag[]): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const tag of tags) {
    lookup.set(tag.id, tag.id);
    lookup.set(normalizeTagName(tag.name), tag.id);
  }

  return lookup;
}

function canonicalizeNoteTags(note: StoredNote, tagLookup: Map<string, string>): StoredNote {
  const canonicalTagIds = new Set<string>();

  for (const tagValue of note.tags) {
    const canonicalTagId = tagLookup.get(tagValue) || tagLookup.get(normalizeTagName(tagValue));
    canonicalTagIds.add(canonicalTagId || tagValue);
  }

  return {
    ...note,
    tags: [...canonicalTagIds],
  };
}

export function mergeImportedWorkspaceData(
  existing: WorkspaceData,
  parsed: { notes?: unknown; folders?: unknown; tags?: unknown }
): WorkspaceData {
  const notes = dedupeById([
    ...existing.notes,
    ...normalizeImportArray<StoredNote>(parsed.notes),
  ]);
  const folders = dedupeById([
    ...existing.folders,
    ...normalizeImportArray<StoredFolder>(parsed.folders),
  ]);
  const tags = dedupeById([
    ...existing.tags,
    ...normalizeImportArray<StoredTag>(parsed.tags),
  ]);
  const canonicalTagLookup = buildCanonicalTagLookup(tags);

  return {
    notes: notes.map((note) => canonicalizeNoteTags(note, canonicalTagLookup)),
    folders,
    tags,
  };
}
