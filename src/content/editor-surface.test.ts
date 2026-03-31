import assert from 'node:assert/strict';
import test from 'node:test';

import { createEditorSurface } from './editor-surface.ts';

class FakeElement {
  tagName: string;
  children: FakeElement[] = [];
  style: Record<string, string> = {};
  textContent: string | null = null;
  id = '';
  className = '';
  dataset: Record<string, string> = {};
  placeholder = '';
  value = '';
  checked = false;
  disabled = false;
  type = '';
  parentElement: FakeElement | null = null;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  appendChild(child: FakeElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      if (matchesSelector(child, selector)) {
        return child;
      }
      const nested = child.querySelector(selector);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  setAttribute(name: string, value: string) {
    if (name === 'id') {
      this.id = value;
      return;
    }

    if (name === 'class') {
      this.className = value;
      return;
    }

    if (name === 'placeholder') {
      this.placeholder = value;
      return;
    }

    if (name === 'type') {
      this.type = value;
      return;
    }

    if (name.startsWith('data-')) {
      this.dataset[toDatasetKey(name)] = value;
    }
  }

  set innerHTML(_value: string) {
    throw new Error('innerHTML must not be used');
  }
}

function toDatasetKey(name: string) {
  return name
    .slice(5)
    .split('-')
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function matchesSelector(element: FakeElement, selector: string) {
  if (selector.startsWith('#')) {
    return element.id === selector.slice(1);
  }

  const dataMatch = selector.match(/^\[data-([a-z0-9-]+)\]$/i);
  if (dataMatch) {
    return toDatasetKey(`data-${dataMatch[1]}`) in element.dataset;
  }

  return false;
}

function createFakeDocument() {
  return {
    createElement(tagName: string) {
      return new FakeElement(tagName);
    },
  };
}

const sampleState = {
  isNew: false,
  title: 'Launch CTA copy',
  body: 'Tighten the supporting sentence before release.',
  elementInfo: '<button.primary>',
  folderLabel: 'Inbox',
  tagLabels: ['#launch', '#copy'],
  pinned: true,
  errorMessage: 'Could not save note.',
  saveDisabled: false,
};

test('createEditorSurface renders header actions for an existing note and keeps the footer focused on save', () => {
  const fakeDocument = createFakeDocument();

  const surface = createEditorSurface(fakeDocument, sampleState);

  assert.equal(surface.querySelector?.('[data-canopy-editor-shell]')?.tagName, 'DIV');
  assert.equal(
    surface.querySelector?.('[data-canopy-editor-heading]')?.textContent,
    'Edit Note'
  );
  assert.equal(
    surface.querySelector?.('[data-canopy-editor-element-info]')?.textContent,
    sampleState.elementInfo
  );
  assert.equal(
    surface.querySelector?.('[data-canopy-editor-header]')?.querySelector?.('[data-canopy-delete]')
      ?.textContent,
    'Delete'
  );
  assert.equal(
    surface.querySelector?.('[data-canopy-editor-header]')?.querySelector?.('[data-canopy-close]')
      ?.textContent,
    'Close'
  );
  assert.equal(surface.querySelector?.('[data-canopy-editor-title]')?.value, sampleState.title);
  assert.equal(
    surface.querySelector?.('[data-canopy-editor-title]')?.placeholder,
    'Title'
  );
  assert.equal(surface.querySelector?.('[data-canopy-editor-body]')?.value, sampleState.body);
  assert.equal(
    surface.querySelector?.('[data-canopy-editor-body]')?.placeholder,
    'Write your note in Markdown...'
  );
  assert.equal(
    surface.querySelector?.('[data-canopy-folder-label]')?.textContent,
    sampleState.folderLabel
  );
  assert.equal(
    surface.querySelector?.('[data-canopy-folder-control]')?.querySelector?.(
      '[data-canopy-folder-change]'
    )?.textContent,
    'Change'
  );
  assert.equal(
    surface.querySelector?.('[data-canopy-tag-row]')?.querySelector?.('[data-canopy-tag-chip]')
      ?.textContent,
    '#launch'
  );
  assert.equal(
    surface.querySelector?.('[data-canopy-add-tag]')?.textContent,
    '+ Tag'
  );
  assert.equal(
    surface.querySelector?.('[data-canopy-pinned-row]')?.querySelector?.('[data-canopy-pinned-input]')
      ?.checked,
    true
  );
  assert.equal(
    surface.querySelector?.('[data-canopy-error]')?.textContent,
    sampleState.errorMessage
  );
  assert.equal(surface.querySelector?.('[data-canopy-save]')?.textContent, 'Update Note');
  assert.equal(surface.querySelector?.('[data-canopy-footer]')?.querySelector?.('[data-canopy-save]')
    ?.textContent, 'Update Note');
  assert.equal(surface.querySelector?.('[data-canopy-footer]')?.querySelector?.('[data-canopy-delete]'), null);
  assert.equal(surface.querySelector?.('[data-canopy-footer]')?.querySelector?.('[data-canopy-cancel]'), null);
});

test('createEditorSurface renders inline tag entry controls instead of relying on browser prompts', () => {
  const fakeDocument = createFakeDocument();

  const surface = createEditorSurface(fakeDocument, sampleState);
  assert.equal(surface.querySelector('[data-canopy-tag-input]')?.tagName, 'INPUT');
  assert.equal(surface.querySelector('[data-canopy-add-tag-confirm]')?.textContent, 'Add tag');
});

test('createEditorSurface disables save, omits delete for new notes, and still provides header close', () => {
  const fakeDocument = createFakeDocument();

  const surface = createEditorSurface(fakeDocument, {
    ...sampleState,
    isNew: true,
    errorMessage: '',
    saveDisabled: true,
  });

  assert.equal(
    surface.querySelector?.('[data-canopy-editor-heading]')?.textContent,
    'New Note'
  );
  assert.equal(surface.querySelector?.('[data-canopy-save]')?.textContent, 'Save Note');
  assert.equal(surface.querySelector?.('[data-canopy-save]')?.disabled, true);
  assert.equal(surface.querySelector?.('[data-canopy-editor-header]')?.querySelector?.('[data-canopy-delete]'), null);
  assert.equal(surface.querySelector?.('[data-canopy-editor-header]')?.querySelector?.('[data-canopy-close]')
    ?.textContent, 'Close');
  assert.equal(surface.querySelector?.('[data-canopy-error]')?.textContent, '');
});
