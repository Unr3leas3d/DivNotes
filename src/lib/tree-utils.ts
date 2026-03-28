import type { StoredFolder, StoredNote, FolderTreeNode } from './types';

/** Build a tree from a flat folder list. Returns root-level nodes. */
export function buildFolderTree(
  folders: StoredFolder[],
  notes: StoredNote[]
): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  // Create nodes
  for (const folder of folders) {
    map.set(folder.id, { folder, children: [], notes: [] });
  }

  // Assign notes to folders
  for (const note of notes) {
    if (note.folderId && map.has(note.folderId)) {
      map.get(note.folderId)!.notes.push(note);
    }
  }

  // Build tree
  for (const node of map.values()) {
    if (node.folder.parentId && map.has(node.folder.parentId)) {
      map.get(node.folder.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by order
  const sortChildren = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.folder.order - b.folder.order);
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

/** Get all descendant folder IDs (recursive). */
export function getDescendantFolderIds(
  folderId: string,
  folders: StoredFolder[]
): string[] {
  const ids: string[] = [];
  const stack = [folderId];
  while (stack.length) {
    const current = stack.pop()!;
    const children = folders.filter(f => f.parentId === current);
    for (const child of children) {
      ids.push(child.id);
      stack.push(child.id);
    }
  }
  return ids;
}

/** Get ancestor path from root to the given folder (for breadcrumbs). */
export function getAncestorPath(
  folderId: string,
  folders: StoredFolder[]
): StoredFolder[] {
  const path: StoredFolder[] = [];
  let current = folders.find(f => f.id === folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? folders.find(f => f.id === current!.parentId)
      : undefined;
  }
  return path;
}

/** Get unfiled notes (folderId is null or undefined). */
export function getUnfiledNotes(notes: StoredNote[]): StoredNote[] {
  return notes.filter(n => !n.folderId);
}

/** Count total notes in a folder and all descendants. */
export function countNotesInTree(node: FolderTreeNode): number {
  let count = node.notes.length;
  for (const child of node.children) {
    count += countNotesInTree(child);
  }
  return count;
}
