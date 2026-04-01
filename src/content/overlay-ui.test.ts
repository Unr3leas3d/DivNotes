import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createHoverSelectorPill,
  createNotePreviewCardShell,
  createPageNoteCountPill,
  createPlacedNoteBadge,
  createSelectionConfirmationPill,
  createSelectorGuide,
} from './overlay-ui.ts';

class FakeElement {
  tagName: string;
  children: FakeElement[] = [];
  style = { cssText: '' };
  textContent: string | null = null;
  id = '';
  className = '';
  dataset: Record<string, string> = {};
  title = '';
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
      const match = child.querySelector(selector);
      if (match) {
        return match;
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

  if (selector.startsWith('.')) {
    return element.className.split(/\s+/).includes(selector.slice(1));
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

test('createSelectorGuide renders bottom-center guidance pill text', () => {
  const fakeDocument = createFakeDocument();

  const guide = createSelectorGuide(fakeDocument, 'Click to add a note · ESC to cancel');

  assert.equal(guide.textContent, 'Click to add a note · ESC to cancel');
  assert.equal(guide.dataset.canopyOverlay, 'selector-guide');
  assert.equal(guide.style.pointerEvents, 'auto');
});

test('createHoverSelectorPill renders the element tag and selector path', () => {
  const fakeDocument = createFakeDocument();

  const pill = createHoverSelectorPill(fakeDocument, {
    tagLabel: 'BUTTON',
    selectorLabel: 'main > section.cta > button.primary',
  });

  assert.equal(pill.dataset.canopyOverlay, 'selector-pill');
  assert.equal(pill.querySelector('[data-canopy-tag]')?.textContent, 'BUTTON');
  assert.equal(
    pill.querySelector('[data-canopy-selector]')?.textContent,
    'main > section.cta > button.primary'
  );
});

test('createSelectionConfirmationPill renders the selected-state copy', () => {
  const fakeDocument = createFakeDocument();

  const pill = createSelectionConfirmationPill(
    fakeDocument,
    'Element selected · Opening note editor…'
  );

  assert.equal(pill.dataset.canopyOverlay, 'selector-confirmation');
  assert.equal(pill.textContent, 'Element selected · Opening note editor…');
});

test('createPlacedNoteBadge renders a compact dark badge without innerHTML', () => {
  const fakeDocument = createFakeDocument();

  const badge = createPlacedNoteBadge(fakeDocument, '1');

  assert.equal(badge.tagName, 'DIV');
  assert.equal(badge.dataset.canopyOverlay, 'placed-note-badge');
  assert.equal(badge.textContent, '1');
  assert.equal(badge.title, 'DivNotes note');
});

test('createPageNoteCountPill renders the bottom-right note count copy', () => {
  const fakeDocument = createFakeDocument();

  const pill = createPageNoteCountPill(fakeDocument, 3);

  assert.equal(pill.dataset.canopyOverlay, 'page-note-count');
  assert.equal(pill.textContent, '3 notes on this page');
});

test('createNotePreviewCardShell renders metadata, tags, preview, and actions', () => {
  const fakeDocument = createFakeDocument();

  const card = createNotePreviewCardShell(fakeDocument, {
    elementInfo: '<button.primary>',
    displayDate: 'Mar 29, 10:15 AM',
    title: 'Primary CTA',
    previewText: 'Follow up on the button copy before launch.',
    tags: ['launch', 'copy'],
  });

  assert.equal(card.dataset.canopyOverlay, 'note-preview-card');
  assert.equal(card.querySelector('[data-canopy-element-info]')?.textContent, '<button.primary>');
  assert.equal(card.querySelector('[data-canopy-preview-date]')?.textContent, 'Mar 29, 10:15 AM');
  assert.equal(card.querySelector('[data-canopy-preview-title]')?.textContent, 'Primary CTA');
  assert.equal(
    card.querySelector('[data-canopy-preview-body]')?.textContent,
    'Follow up on the button copy before launch.'
  );
  assert.equal(card.querySelector('[data-canopy-preview-tags]')?.textContent, '#launch #copy');
  assert.equal(card.querySelector('[data-canopy-move]')?.textContent, 'Move');
  assert.equal(card.querySelector('[data-canopy-edit]')?.textContent, 'Edit');
  assert.equal(card.querySelector('[data-canopy-delete]')?.textContent, 'Delete');
  assert.equal(card.querySelector('[data-canopy-preview-panel]')?.dataset.canopyPreviewPanel, '');
});

test('createNotePreviewCardShell keeps edit and move actions in the footer', () => {
  const fakeDocument = createFakeDocument();

  const card = createNotePreviewCardShell(fakeDocument, {
    elementInfo: '<div.hero>',
    displayDate: 'Mar 30, 2:00 PM',
    title: 'Hero section',
    previewText: 'Check spacing',
    tags: [],
  });

  assert.equal(card.querySelector('[data-canopy-edit]')?.textContent, 'Edit');
  assert.equal(card.querySelector('[data-canopy-move]')?.textContent, 'Move');
});
