import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFolderSummaries,
  buildTagSummaries,
  buildViewCounts,
  filterNotesBySearch,
  groupNotesByHostname,
  selectThisPageNotes,
} from './extension-selectors';
import type { StoredFolder, StoredNote, StoredTag } from './types';

const sampleNotes: StoredNote[] = [
  {
    id: 'note-1',
    url: 'https://app.example.com/docs/',
    hostname: 'app.example.com',
    pageTitle: 'Docs',
    elementSelector: '#one',
    elementTag: 'div',
    elementInfo: 'First note',
    content: 'Alpha note',
    createdAt: '2026-03-10T10:00:00.000Z',
    folderId: 'folder-1',
    tags: ['tag-1', 'tag-2'],
    pinned: false,
  },
  {
    id: 'note-2',
    url: 'https://app.example.com/docs?ref=nav',
    hostname: 'app.example.com',
    pageTitle: 'Docs',
    elementSelector: '#two',
    elementTag: 'section',
    elementInfo: 'Second note',
    content: 'Beta note',
    createdAt: '2026-03-11T10:00:00.000Z',
    folderId: 'folder-2',
    tags: ['tag-1'],
    pinned: true,
  },
  {
    id: 'note-3',
    url: 'https://another.example.com/home',
    hostname: 'another.example.com',
    pageTitle: 'Home',
    elementSelector: '#three',
    elementTag: 'article',
    elementInfo: 'Third note',
    content: 'Gamma note',
    createdAt: '2026-03-09T10:00:00.000Z',
    folderId: null,
    tags: ['tag-1', 'tag-3'],
    pinned: false,
  },
];

const sampleFolders: StoredFolder[] = [
  {
    id: 'folder-1',
    name: 'Product',
    parentId: null,
    order: 0,
    color: null,
    pinned: false,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'folder-2',
    name: 'Specs',
    parentId: 'folder-1',
    order: 1,
    color: null,
    pinned: false,
    createdAt: '2026-03-02T00:00:00.000Z',
    updatedAt: '2026-03-02T00:00:00.000Z',
  },
  {
    id: 'folder-3',
    name: 'Personal',
    parentId: null,
    order: 2,
    color: null,
    pinned: false,
    createdAt: '2026-03-03T00:00:00.000Z',
    updatedAt: '2026-03-03T00:00:00.000Z',
  },
  {
    id: 'folder-4',
    name: 'Archive',
    parentId: null,
    order: 3,
    color: null,
    pinned: false,
    createdAt: '2026-03-04T00:00:00.000Z',
    updatedAt: '2026-03-04T00:00:00.000Z',
  },
];

const sampleTags: StoredTag[] = [
  {
    id: 'tag-1',
    name: 'important',
    color: '#052415',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'tag-2',
    name: 'research',
    color: '#1a5c2e',
    createdAt: '2026-03-02T00:00:00.000Z',
    updatedAt: '2026-03-02T00:00:00.000Z',
  },
  {
    id: 'tag-3',
    name: 'later',
    color: '#3d8b5e',
    createdAt: '2026-03-03T00:00:00.000Z',
    updatedAt: '2026-03-03T00:00:00.000Z',
  },
];

test('selectThisPageNotes filters by normalized current page url and newest-first order', () => {
  const result = selectThisPageNotes(sampleNotes, 'https://app.example.com/docs');
  assert.deepEqual(result.map((note) => note.id), ['note-2', 'note-1']);
});

test('selectThisPageNotes returns no notes when the current page url is invalid', () => {
  const result = selectThisPageNotes(sampleNotes, 'not a valid url');
  assert.deepEqual(result, []);
});

test('groupNotesByHostname returns compact grouped rows for the all-notes view', () => {
  const groups = groupNotesByHostname(sampleNotes);
  assert.equal(groups[0]?.hostname, 'app.example.com');
  assert.equal(groups[0]?.count, 2);
  assert.equal(groups[0]?.noteIds[0], 'note-2');
  assert.equal('notes' in groups[0]!, false);
});

test('buildTagSummaries computes counts and filtered note ids', () => {
  const summaries = buildTagSummaries(sampleTags, sampleNotes);
  assert.equal(summaries[0]?.count, 3);
  assert.deepEqual(summaries[0]?.noteIds, ['note-2', 'note-1', 'note-3']);
});

test('buildFolderSummaries computes sorted counts and filtered note ids per folder', () => {
  const summaries = buildFolderSummaries(sampleNotes, sampleFolders);
  assert.equal(summaries[0]?.folder.id, 'folder-1');
  assert.equal(summaries[0]?.count, 1);
  assert.deepEqual(summaries[0]?.noteIds, ['note-1']);
  assert.equal(summaries[1]?.folder.id, 'folder-2');
  assert.deepEqual(summaries[1]?.noteIds, ['note-2']);
});

test('filterNotesBySearch matches note metadata and returns newest-first results', () => {
  const byInfo = filterNotesBySearch(sampleNotes, 'second');
  assert.deepEqual(byInfo.map((note) => note.id), ['note-2']);

  const byPageTitle = filterNotesBySearch(sampleNotes, 'docs');
  assert.deepEqual(byPageTitle.map((note) => note.id), ['note-2', 'note-1']);
});

test('buildViewCounts returns shared pill counts for popup and side panel', () => {
  const counts = buildViewCounts({
    notes: sampleNotes,
    folders: sampleFolders,
    tags: sampleTags,
    currentPageUrl: 'https://app.example.com/docs',
  });
  assert.equal(counts['this-page'], 2);
  assert.equal(counts['folders'], 4);
});
