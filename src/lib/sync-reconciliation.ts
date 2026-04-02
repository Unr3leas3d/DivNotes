import type { StoredFolder, StoredNote, StoredTag } from './types';

type NoteTagLink = { noteId: string; tagId: string };

export interface WorkspaceSnapshot {
  notes: StoredNote[];
  folders: StoredFolder[];
  tags: StoredTag[];
  noteTags: NoteTagLink[];
}

export interface ReconciliationConflict {
  entityType: 'note' | 'folder' | 'tag';
  entityId: string;
  localUpdatedAt: string;
  cloudUpdatedAt: string;
  winningSide: 'local' | 'cloud';
}

export interface ReconciliationResult {
  upload: WorkspaceSnapshot;
  download: WorkspaceSnapshot;
  conflicts: ReconciliationConflict[];
}

type TimestampedEntity = {
  id: string;
  updatedAt: string;
};

function createEmptySnapshot(): WorkspaceSnapshot {
  return {
    notes: [],
    folders: [],
    tags: [],
    noteTags: [],
  };
}

function getTimestampValue(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function reconcileTimestampedEntities<T extends TimestampedEntity>(
  params: {
    entityType: ReconciliationConflict['entityType'];
    local: T[];
    cloud: T[];
    pushUpload: (entity: T) => void;
    pushDownload: (entity: T) => void;
    conflicts: ReconciliationConflict[];
  }
) {
  const localById = new Map(params.local.map((entity) => [entity.id, entity]));
  const cloudById = new Map(params.cloud.map((entity) => [entity.id, entity]));
  const entityIds = new Set([...localById.keys(), ...cloudById.keys()]);

  for (const entityId of entityIds) {
    const localEntity = localById.get(entityId);
    const cloudEntity = cloudById.get(entityId);

    if (localEntity && !cloudEntity) {
      params.pushUpload(localEntity);
      continue;
    }

    if (!localEntity && cloudEntity) {
      params.pushDownload(cloudEntity);
      continue;
    }

    if (!localEntity || !cloudEntity) {
      continue;
    }

    if (localEntity.updatedAt === cloudEntity.updatedAt) {
      continue;
    }

    const localTimestamp = getTimestampValue(localEntity.updatedAt);
    const cloudTimestamp = getTimestampValue(cloudEntity.updatedAt);
    const winningSide = localTimestamp >= cloudTimestamp ? 'local' : 'cloud';

    params.conflicts.push({
      entityType: params.entityType,
      entityId,
      localUpdatedAt: localEntity.updatedAt,
      cloudUpdatedAt: cloudEntity.updatedAt,
      winningSide,
    });

    if (winningSide === 'local') {
      params.pushUpload(localEntity);
      continue;
    }

    params.pushDownload(cloudEntity);
  }
}

function reconcileNoteTags(local: NoteTagLink[], cloud: NoteTagLink[], result: ReconciliationResult) {
  const localById = new Map(local.map((link) => [`${link.noteId}:${link.tagId}`, link]));
  const cloudById = new Map(cloud.map((link) => [`${link.noteId}:${link.tagId}`, link]));
  const linkIds = new Set([...localById.keys(), ...cloudById.keys()]);

  for (const linkId of linkIds) {
    const localLink = localById.get(linkId);
    const cloudLink = cloudById.get(linkId);

    if (localLink && !cloudLink) {
      result.upload.noteTags.push(localLink);
      continue;
    }

    if (!localLink && cloudLink) {
      result.download.noteTags.push(cloudLink);
    }
  }
}

export function reconcileWorkspaceData(params: {
  local: WorkspaceSnapshot;
  cloud: WorkspaceSnapshot;
}): ReconciliationResult {
  const result: ReconciliationResult = {
    upload: createEmptySnapshot(),
    download: createEmptySnapshot(),
    conflicts: [],
  };

  reconcileTimestampedEntities({
    entityType: 'note',
    local: params.local.notes,
    cloud: params.cloud.notes,
    pushUpload: (entity) => result.upload.notes.push(entity),
    pushDownload: (entity) => result.download.notes.push(entity),
    conflicts: result.conflicts,
  });

  reconcileTimestampedEntities({
    entityType: 'folder',
    local: params.local.folders,
    cloud: params.cloud.folders,
    pushUpload: (entity) => result.upload.folders.push(entity),
    pushDownload: (entity) => result.download.folders.push(entity),
    conflicts: result.conflicts,
  });

  reconcileTimestampedEntities({
    entityType: 'tag',
    local: params.local.tags,
    cloud: params.cloud.tags,
    pushUpload: (entity) => result.upload.tags.push(entity),
    pushDownload: (entity) => result.download.tags.push(entity),
    conflicts: result.conflicts,
  });

  reconcileNoteTags(params.local.noteTags, params.cloud.noteTags, result);

  return result;
}
