import type { StoredNote, StoredTag, SyncQueueItem } from './types.ts';

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}

export function isTagNameConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as {
    code?: string;
    constraint?: string;
    details?: string;
    message?: string;
  };

  if (maybeError.code !== '23505') {
    return false;
  }

  const haystack = [
    maybeError.constraint,
    maybeError.details,
    maybeError.message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes('idx_tags_user_name') || haystack.includes('lower(name)');
}

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function dedupeQueue(queue: SyncQueueItem[]): SyncQueueItem[] {
  const deduped = new Map<string, SyncQueueItem>();

  for (const item of queue) {
    const key = `${item.entityType}:${item.action}:${item.entityId}`;
    deduped.set(key, item);
  }

  return [...deduped.values()];
}

export function remapTagConflictState({
  localTagId,
  canonicalTag,
  tags,
  notes,
  queue,
}: {
  localTagId: string;
  canonicalTag: StoredTag;
  tags: StoredTag[];
  notes: StoredNote[];
  queue: SyncQueueItem[];
}) {
  const normalizedCanonicalTag: StoredTag = {
    ...canonicalTag,
    name: normalizeTagName(canonicalTag.name),
  };

  const nextTags = new Map<string, StoredTag>();
  tags.forEach((tag) => {
    if (tag.id !== localTagId) {
      nextTags.set(tag.id, tag);
    }
  });
  nextTags.set(normalizedCanonicalTag.id, normalizedCanonicalTag);

  const nextNotes = notes.map((note) => ({
    ...note,
    tags: dedupeIds(
      (note.tags || []).map((tagId) =>
        tagId === localTagId ? normalizedCanonicalTag.id : tagId
      )
    ),
  }));

  const rewrittenQueue = queue
    .map((item) => {
      if (item.entityType === 'tag' && item.entityId === localTagId) {
        if (item.action === 'save') {
          return null;
        }

        return {
          ...item,
          entityId: normalizedCanonicalTag.id,
          payload: item.payload
            ? {
                ...item.payload,
                id: normalizedCanonicalTag.id,
                name: normalizeTagName(item.payload.name ?? normalizedCanonicalTag.name),
              }
            : item.payload,
        };
      }

      if (
        item.entityType === 'note_tag' &&
        item.payload &&
        item.payload.tag_id === localTagId
      ) {
        return {
          ...item,
          entityId: `${item.payload.note_id}:${normalizedCanonicalTag.id}`,
          payload: {
            ...item.payload,
            tag_id: normalizedCanonicalTag.id,
          },
        };
      }

      return item;
    })
    .filter((item): item is SyncQueueItem => item !== null);

  return {
    tags: [...nextTags.values()],
    notes: nextNotes,
    queue: dedupeQueue(rewrittenQueue),
  };
}
