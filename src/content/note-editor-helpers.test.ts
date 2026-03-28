import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFolderPickerHeader,
  getInitialSelectedFolderId,
  savePageNotesToStorage,
} from './note-editor-helpers.ts';

class FakeElement {
  tagName: string;
  children: FakeElement[] = [];
  style = { cssText: '' };
  textContent: string | null = null;
  id = '';
  listeners = new Map<string, ((event: Event) => void)[]>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: FakeElement) {
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  set innerHTML(_value: string) {
    throw new Error('innerHTML must not be used');
  }
}

function createFakeDocument() {
  return {
    createElement(tagName: string) {
      return new FakeElement(tagName);
    },
    createElementNS(_namespace: string, tagName: string) {
      return new FakeElement(tagName);
    },
  };
}

test('getInitialSelectedFolderId preserves an existing note folder over auto-suggest', () => {
  assert.equal(
    getInitialSelectedFolderId({
      isNew: false,
      existingFolderId: 'existing-folder',
      suggestedFolderId: 'suggested-folder',
    }),
    'existing-folder'
  );
});

test('getInitialSelectedFolderId allows auto-suggest for an unfiled existing note', () => {
  assert.equal(
    getInitialSelectedFolderId({
      isNew: false,
      existingFolderId: null,
      suggestedFolderId: 'suggested-folder',
    }),
    'suggested-folder'
  );
});

test('createFolderPickerHeader uses textContent for the folder name', () => {
  const fakeDocument = createFakeDocument();

  const { header, nameEl, changeBtn } = createFolderPickerHeader(
    fakeDocument,
    '<img src=x onerror=alert(1)>'
  );

  assert.equal((header as FakeElement).children.length, 3);
  assert.equal(nameEl.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(changeBtn.textContent, 'Change');
});

test('savePageNotesToStorage resolves only after the storage write completes', async () => {
  const storageState = {
    divnotes_notes: [
      {
        id: 'other-note',
        url: 'https://example.com/other',
        hostname: 'example.com',
        pageTitle: 'Other',
        elementSelector: '.other',
        elementTag: 'div',
        elementInfo: 'Other',
        content: 'Other page note',
        createdAt: '2026-03-27T00:00:00.000Z',
        folderId: null,
        tags: [],
        pinned: false,
      },
    ],
  };

  let pendingSetCallback: (() => void) | undefined;
  let badgeUpdateCount = 0;

  const savePromise = savePageNotesToStorage({
    savedNotes: [
      {
        id: 'page-note',
        element: { tagName: 'ARTICLE' },
        elementSelector: '.page-note',
        elementInfo: 'Page note',
        content: 'Current page note',
        createdAt: '2026-03-27T00:00:00.000Z',
        folderId: 'folder-1',
        tags: ['tag-1'],
        pinned: true,
      },
    ],
    pageUrl: 'https://example.com/current',
    hostname: 'example.com',
    pageTitle: 'Current',
    storage: {
      get(_keys, callback) {
        callback({ ...storageState });
      },
      set(
        items: { divnotes_notes: typeof storageState.divnotes_notes },
        callback?: () => void
      ) {
        Object.assign(storageState, items);
        pendingSetCallback = callback;
      },
    },
    updateBadgeCount() {
      badgeUpdateCount += 1;
    },
  });

  let resolved = false;
  void savePromise.then(() => {
    resolved = true;
  });

  await Promise.resolve();
  assert.equal(resolved, false);

  if (pendingSetCallback) {
    pendingSetCallback();
  }
  await savePromise;

  assert.equal(resolved, true);
  assert.equal(badgeUpdateCount, 1);
  assert.deepEqual(
    storageState.divnotes_notes.map((note: { id: string }) => note.id),
    ['other-note', 'page-note']
  );
});
