import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthIntentGuard } from './auth-intent.ts';

test('createAuthIntentGuard invalidates stale auth results after a newer intent begins', () => {
  const guard = createAuthIntentGuard();
  const firstIntent = guard.beginIntent();
  const secondIntent = guard.beginIntent();

  assert.equal(guard.isCurrentIntent(firstIntent), false);
  assert.equal(guard.isCurrentIntent(secondIntent), true);
});

test('createAuthIntentGuard invalidates in-flight auth when intent is cancelled', () => {
  const guard = createAuthIntentGuard();
  const activeIntent = guard.beginIntent();

  guard.invalidateCurrentIntent();

  assert.equal(guard.isCurrentIntent(activeIntent), false);
});
