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

// Tag color palette — Eden Bright green variants
export const TAG_COLORS = [
  '#052415', '#1a5c2e', '#3d8b5e', '#6ead71',
  '#ABFFC0', '#0d9488', '#65784c', '#84cc16',
] as const;

export const FOLDER_COLORS = [
  TAG_COLORS[0],
  TAG_COLORS[1],
  TAG_COLORS[2],
  TAG_COLORS[3],
  TAG_COLORS[4],
  TAG_COLORS[6],
  TAG_COLORS[7],
] as const;
