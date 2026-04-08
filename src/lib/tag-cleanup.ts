import { noteHasTagValue } from './extension-selectors.ts';
import type { StoredNote, StoredTag } from './types.ts';

export interface PruneUnusedTagsResult {
  remainingTags: StoredTag[];
  removedTags: StoredTag[];
}

export function pruneUnusedTags(
  tags: readonly StoredTag[],
  notes: readonly StoredNote[]
): PruneUnusedTagsResult {
  const remainingTags: StoredTag[] = [];
  const removedTags: StoredTag[] = [];

  for (const tag of tags) {
    if (notes.some((note) => noteHasTagValue(note, tag.id, tags))) {
      remainingTags.push(tag);
      continue;
    }

    removedTags.push(tag);
  }

  return { remainingTags, removedTags };
}
