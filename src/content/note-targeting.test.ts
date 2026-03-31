import assert from 'node:assert/strict';
import test from 'node:test';

import { findMatchingElement, urlsMatchNoteTarget } from './note-targeting.ts';

// ---------- helpers to build a fake Document ----------

function makeFakeElement(id: string, tag: string, textContent: string) {
  return {
    id,
    tagName: tag.toUpperCase(),
    textContent,
    children: [] as any[],
  };
}

function buildFakeDocument() {
  const headline = makeFakeElement('headline', 'h1', 'Launch coverage');
  const paragraph = makeFakeElement('p1', 'p', 'Some body text');
  const nested = makeFakeElement('nested', 'div', 'Nested child');

  // body > [0] = div wrapper
  //   wrapper > [0] = paragraph
  //   wrapper > [1] = (empty)
  //   wrapper > [2] = inner
  //     inner > [1] = headline (via structural position "0,2,1")
  const spacer = makeFakeElement('spacer', 'span', '');
  const inner = makeFakeElement('inner', 'div', '');
  inner.children = [nested, headline];
  const wrapper = makeFakeElement('wrapper', 'div', '');
  wrapper.children = [paragraph, spacer, inner];

  const body = {
    children: [wrapper],
  };

  const doc = {
    querySelector(sel: string) {
      // Only match if selector is NOT '.missing'
      if (sel === '.missing') return null;
      if (sel === '#headline') return headline;
      return null;
    },
    evaluate(
      _xpath: string,
      _ctx: any,
      _resolver: any,
      _type: number,
      _result: any
    ) {
      // Simulate XPath that matches headline
      if (_xpath === '//*[@id="headline"]') {
        return { singleNodeValue: headline };
      }
      return { singleNodeValue: null };
    },
    getElementsByTagName(tag: string) {
      const all: any[] = [headline, paragraph, nested, spacer, inner, wrapper];
      return all.filter((el) => el.tagName === tag.toUpperCase());
    },
    body,
  };

  return { doc, headline };
}

// ---------- findMatchingElement ----------

test('findMatchingElement tries selector, xpath, text hash, and structural position in order', () => {
  const { doc, headline } = buildFakeDocument();

  const element = findMatchingElement(doc as any, {
    url: 'https://ign.com/articles/foo',
    elementSelector: '.missing',
    elementXPath: '//*[@id="headline"]',
    elementTextHash: 'Launch coverage',
    elementPosition: '0,2,1',
    elementTag: 'h1',
  });

  assert.equal(element?.id, 'headline');
});

test('findMatchingElement falls back to text hash when selector and xpath miss', () => {
  const { doc, headline } = buildFakeDocument();

  const element = findMatchingElement(doc as any, {
    url: 'https://example.com',
    elementSelector: '.missing',
    elementXPath: '//*[@id="nope"]',
    elementTextHash: 'Launch coverage',
    elementPosition: '99,99',
    elementTag: 'h1',
  });

  assert.equal(element?.id, 'headline');
});

test('findMatchingElement falls back to structural position as last resort', () => {
  const { doc, headline } = buildFakeDocument();

  const element = findMatchingElement(doc as any, {
    url: 'https://example.com',
    elementSelector: '.missing',
    elementXPath: '//*[@id="nope"]',
    elementTextHash: 'No match text',
    elementPosition: '0,2,1',
    elementTag: 'h1',
  });

  assert.equal(element?.id, 'headline');
});

test('findMatchingElement returns null when nothing matches', () => {
  const { doc } = buildFakeDocument();

  const element = findMatchingElement(doc as any, {
    url: 'https://example.com',
    elementSelector: '.missing',
    elementXPath: '//*[@id="nope"]',
    elementTextHash: 'No match text',
    elementPosition: '99,99,99',
    elementTag: 'h1',
  });

  assert.equal(element, null);
});

// ---------- urlsMatchNoteTarget ----------

test('urlsMatchNoteTarget ignores trailing slashes and non-essential query noise', () => {
  assert.equal(
    urlsMatchNoteTarget(
      'https://ign.com/article/',
      'https://ign.com/article?utm_source=nav'
    ),
    true
  );
});

test('urlsMatchNoteTarget strips hash fragments', () => {
  assert.equal(
    urlsMatchNoteTarget(
      'https://example.com/page#section1',
      'https://example.com/page'
    ),
    true
  );
});

test('urlsMatchNoteTarget preserves meaningful query params', () => {
  assert.equal(
    urlsMatchNoteTarget(
      'https://example.com/page?id=42',
      'https://example.com/page?id=42&utm_medium=email'
    ),
    true
  );
});

test('urlsMatchNoteTarget returns false for different paths', () => {
  assert.equal(
    urlsMatchNoteTarget('https://example.com/page-a', 'https://example.com/page-b'),
    false
  );
});

test('urlsMatchNoteTarget returns false for invalid URLs', () => {
  assert.equal(urlsMatchNoteTarget('not-a-url', 'https://example.com'), false);
});
