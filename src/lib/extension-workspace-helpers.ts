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

export function mergeImportedWorkspaceData(
  existing: WorkspaceData,
  parsed: { notes?: unknown; folders?: unknown; tags?: unknown }
): WorkspaceData {
  return {
    notes: dedupeById([
      ...existing.notes,
      ...normalizeImportArray<StoredNote>(parsed.notes),
    ]),
    folders: dedupeById([
      ...existing.folders,
      ...normalizeImportArray<StoredFolder>(parsed.folders),
    ]),
    tags: dedupeById([
      ...existing.tags,
      ...normalizeImportArray<StoredTag>(parsed.tags),
    ]),
  };
}
