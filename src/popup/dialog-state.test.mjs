import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getInitialClearAllDialogState,
  prepareClearAllDialogForSubmit,
  resolveClearAllDialogError,
  validateNewFolderName,
} from './dialog-state.ts';

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

test('prepareClearAllDialogForSubmit clears stale inline errors before a retry', () => {
  assert.deepEqual(
    prepareClearAllDialogForSubmit({ type: 'clear-all', error: 'Failed to clear all notes' }),
    { type: 'clear-all', error: null }
  );
});

test('resolveClearAllDialogError normalizes unknown failures', () => {
  assert.equal(resolveClearAllDialogError(new Error('Disk is locked')), 'Disk is locked');
  assert.equal(resolveClearAllDialogError('unknown'), 'Failed to clear all notes');
});

test('getInitialClearAllDialogState starts with no inline error', () => {
  assert.deepEqual(getInitialClearAllDialogState(), { type: 'clear-all', error: null });
});
