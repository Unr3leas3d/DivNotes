import assert from 'node:assert/strict';
import test from 'node:test';

import {
  computeAnchoredOverlayPosition,
  watchAnchorPosition,
} from './anchored-overlay.ts';

test('computeAnchoredOverlayPosition places overlay below-start when space is available', () => {
  const result = computeAnchoredOverlayPosition({
    anchorRect: { top: 100, left: 200, right: 240, bottom: 140, width: 40, height: 40 },
    overlaySize: { width: 300, height: 260 },
    viewport: { width: 1024, height: 768 },
    offset: 12,
  });

  assert.equal(result.top, 152);
  assert.equal(result.left, 200);
  assert.equal(result.placement, 'below-start');
});

test('computeAnchoredOverlayPosition keeps cards inside the viewport while staying attached to the target', () => {
  const result = computeAnchoredOverlayPosition({
    anchorRect: { top: 580, left: 980, right: 1020, bottom: 620, width: 40, height: 40 },
    overlaySize: { width: 300, height: 260 },
    viewport: { width: 1024, height: 640 },
    offset: 12,
  });

  assert.equal(result.top, 308);
  assert.equal(result.left, 708);
  assert.equal(result.placement, 'above-start');
});

test('computeAnchoredOverlayPosition clamps left to minimum margin when anchor is near left edge', () => {
  const result = computeAnchoredOverlayPosition({
    anchorRect: { top: 100, left: 2, right: 42, bottom: 140, width: 40, height: 40 },
    overlaySize: { width: 300, height: 100 },
    viewport: { width: 1024, height: 768 },
    offset: 12,
  });

  assert.equal(result.left, 8);
});

test('computeAnchoredOverlayPosition clamps top to minimum margin when near top edge', () => {
  const result = computeAnchoredOverlayPosition({
    anchorRect: { top: 10, left: 200, right: 240, bottom: 50, width: 40, height: 40 },
    overlaySize: { width: 300, height: 260 },
    viewport: { width: 1024, height: 300 },
    offset: 12,
  });

  // Not enough room below (50+12+260=322 > 300) and not above (10-260-12 < 0)
  assert.equal(result.top, 8);
});

test('watchAnchorPosition emits a new position when the page scrolls', () => {
  let calls = 0;
  const listeners: Record<string, (() => void)[]> = {};

  const fakeWindow = {
    addEventListener(type: string, handler: () => void) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    removeEventListener(type: string, handler: () => void) {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((h) => h !== handler);
      }
    },
  };

  const fakeElement = {
    getBoundingClientRect() {
      return { top: 100, left: 200, right: 240, bottom: 140, width: 40, height: 40 };
    },
  };

  const stop = watchAnchorPosition(
    fakeWindow as unknown as Window,
    fakeElement as unknown as Element,
    () => {
      calls += 1;
    }
  );

  // Fire scroll
  listeners['scroll']?.forEach((h) => h());
  assert.equal(calls, 1);

  // Fire resize
  listeners['resize']?.forEach((h) => h());
  assert.equal(calls, 2);

  // After stop, no more calls
  stop();
  assert.deepEqual(listeners['scroll'], []);
  assert.deepEqual(listeners['resize'], []);
});
