import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNewFolderName } from './dialog-state.ts';

test('validateNewFolderName rejects empty or whitespace-only values', () => {
  assert.deepEqual(validateNewFolderName(''), {
    valid: false,
    error: 'Please enter a folder name.',
  });

  assert.deepEqual(validateNewFolderName('   '), {
    valid: false,
    error: 'Please enter a folder name.',
  });
});

test('validateNewFolderName trims accepted values', () => {
  assert.deepEqual(validateNewFolderName('  Project Alpha  '), {
    valid: true,
    value: 'Project Alpha',
  });
});
