import { describe, expect, it } from 'vitest';

import {
  reconcileWorkspaceData,
  type WorkspaceSnapshot,
} from './sync-reconciliation';

describe('reconcileWorkspaceData', () => {
  it('uploads local-only entities', () => {
    const local: WorkspaceSnapshot = {
      notes: [{ id: 'n1', updatedAt: '2026-04-01T10:00:00Z' }],
      folders: [],
      tags: [],
      noteTags: [],
    } as any;

    const cloud: WorkspaceSnapshot = {
      notes: [],
      folders: [],
      tags: [],
      noteTags: [],
    } as any;

    const result = reconcileWorkspaceData({ local, cloud });
    expect(result.upload.notes.map((note) => note.id)).toEqual(['n1']);
    expect(result.conflicts).toEqual([]);
  });

  it('flags same-id conflicts and records the newest winner', () => {
    const result = reconcileWorkspaceData({
      local: {
        notes: [{ id: 'n1', updatedAt: '2026-04-02T10:00:00Z', content: 'local' }],
        folders: [],
        tags: [],
        noteTags: [],
      } as any,
      cloud: {
        notes: [{ id: 'n1', updatedAt: '2026-04-01T10:00:00Z', content: 'cloud' }],
        folders: [],
        tags: [],
        noteTags: [],
      } as any,
    });

    expect(result.conflicts[0]).toMatchObject({
      entityType: 'note',
      entityId: 'n1',
      winningSide: 'local',
    });
  });
});
