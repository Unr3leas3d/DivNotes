// StoredFolder
export interface StoredFolder {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  color: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// StoredTag
export interface StoredTag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

// Extended StoredNote (replaces the one in notes-service.ts)
export interface StoredNote {
  id: string;
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  content: string;
  color?: string;
  tagLabel?: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
  createdAt: string;
  // New fields
  folderId: string | null;
  tags: string[];
  pinned: boolean;
}

// Updated SyncQueueItem
export interface SyncQueueItem {
  id: string;
  entityType: 'note' | 'folder' | 'tag' | 'note_tag';
  action: 'save' | 'update' | 'delete';
  entityId: string;
  payload?: any;
  timestamp: number;
}

// Tree node for UI rendering
export interface FolderTreeNode {
  folder: StoredFolder;
  children: FolderTreeNode[];
  notes: StoredNote[];
}

// Tag color palette
export const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
] as const;
