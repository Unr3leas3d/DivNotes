import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileWorkspaceGroupExpansion } from './workspace-group-expansion.ts';

test('reconciles visible group expansion state and drops stale hostnames', () => {
  const result = reconcileWorkspaceGroupExpansion(
    ['alpha.example', 'beta.example', 'gamma.example'],
    new Set(['beta.example', 'stale.example'])
  );

  assert.deepEqual([...result], ['beta.example']);
});

test('defaults the first visible hostname when no visible hostnames remain expanded', () => {
  const result = reconcileWorkspaceGroupExpansion(
    ['alpha.example', 'beta.example'],
    new Set(['stale.example'])
  );

  assert.deepEqual([...result], ['alpha.example']);
});
