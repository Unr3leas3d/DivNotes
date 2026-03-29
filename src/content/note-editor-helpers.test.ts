import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEditorTagNames,
  createFolderPickerHeader,
  formatEditorContent,
  getFolderChipLabel,
  getInitialManualTags,
  getInitialSelectedFolderId,
  getTagChipLabels,
  hasMeaningfulEditorContent,
  parseEditorDraft,
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

test('hasMeaningfulEditorContent disables save when title and body are blank', () => {
  assert.equal(
    hasMeaningfulEditorContent({
      title: '   ',
      body: '\n\n  ',
    }),
    false
  );
  assert.equal(
    hasMeaningfulEditorContent({
      title: 'CTA follow-up',
      body: '   ',
    }),
    true
  );
  assert.equal(
    hasMeaningfulEditorContent({
      title: '   ',
      body: 'Body copy only',
    }),
    true
  );
});

test('formatEditorContent and parseEditorDraft round-trip title and body', () => {
  const content = formatEditorContent({
    title: 'Launch checklist',
    body: 'Tighten the hero copy before handoff.',
  });

  assert.equal(content, '# Launch checklist\n\nTighten the hero copy before handoff.');
  assert.deepEqual(parseEditorDraft(content), {
    title: 'Launch checklist',
    body: 'Tighten the hero copy before handoff.',
  });
});

test('formatEditorContent and parseEditorDraft preserve titled body indentation and trailing whitespace', () => {
  const original = {
    title: 'Code sample',
    body: '    const answer = 42;\n    return answer;  \n',
  };

  const content = formatEditorContent(original);

  assert.equal(content, '# Code sample\n\n    const answer = 42;\n    return answer;  \n');
  assert.deepEqual(parseEditorDraft(content), original);
  assert.equal(formatEditorContent(parseEditorDraft(content)), content);
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

test('getInitialSelectedFolderId uses the suggested folder for new notes', () => {
  assert.equal(
    getInitialSelectedFolderId({
      isNew: true,
      existingFolderId: 'existing-folder',
      suggestedFolderId: 'suggested-folder',
    }),
    'suggested-folder'
  );
  assert.equal(
    getInitialSelectedFolderId({
      isNew: true,
      existingFolderId: null,
      suggestedFolderId: null,
    }),
    null
  );
});

test('getFolderChipLabel returns the selected folder name and falls back to Inbox', () => {
  assert.equal(
    getFolderChipLabel(
      [
        { id: 'folder-1', name: 'Product' },
        { id: 'folder-2', name: 'QA' },
      ],
      'folder-2'
    ),
    'QA'
  );
  assert.equal(
    getFolderChipLabel([{ id: 'folder-1', name: 'Product' }], 'missing-folder'),
    'Inbox'
  );
  assert.equal(getFolderChipLabel([], null), 'Inbox');
});

test('getTagChipLabels normalizes chip labels for display', () => {
  assert.deepEqual(getTagChipLabels(['launch', '#copy', 'launch', '']), ['#launch', '#copy']);
});

test('getInitialManualTags excludes hashtags already present in the saved note body', () => {
  assert.deepEqual(
    getInitialManualTags(['manual-tag', 'body-tag'], '# Title\n\nBody with #body-tag'),
    ['manual-tag']
  );
});

test('buildEditorTagNames reflects the current body hashtags without permanently accumulating prior body tags', () => {
  const manualTags = getInitialManualTags(['manual-tag', 'old-body-tag'], '# Title\n\nBody with #old-body-tag');

  assert.deepEqual(
    buildEditorTagNames(manualTags, {
      title: 'Title',
      body: 'Body after editing without the removed hashtag',
    }),
    ['manual-tag']
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

test('savePageNotesToStorage preserves notes from other pages when the current page is cleared', async () => {
  const storageState = {
    divnotes_notes: [
      {
        id: 'other-page-note',
        url: 'https://example.com/other',
        hostname: 'example.com',
        pageTitle: 'Other',
        elementSelector: '.other',
        elementTag: 'div',
        elementInfo: 'Other',
        content: 'Keep me',
        createdAt: '2026-03-27T00:00:00.000Z',
        folderId: 'folder-2',
        tags: ['tag-9'],
        pinned: false,
      },
      {
        id: 'current-page-note',
        url: 'https://example.com/current',
        hostname: 'example.com',
        pageTitle: 'Current',
        elementSelector: '.current',
        elementTag: 'article',
        elementInfo: 'Current',
        content: 'Remove me',
        createdAt: '2026-03-27T00:00:00.000Z',
        folderId: null,
        tags: [],
        pinned: false,
      },
    ],
  };

  const merged = await savePageNotesToStorage({
    savedNotes: [],
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
        callback?.();
      },
    },
    updateBadgeCount() {},
  });

  assert.deepEqual(
    merged.map((note) => note.id),
    ['other-page-note']
  );
  assert.deepEqual(
    storageState.divnotes_notes.map((note: { id: string }) => note.id),
    ['other-page-note']
  );
});
