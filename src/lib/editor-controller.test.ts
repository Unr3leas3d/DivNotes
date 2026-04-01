import { describe, it, expect } from 'vitest';
import {
  createEditorState,
  editorReducer,
  buildSavePayload,
  type TargetInfo,
} from './editor-controller';
import type { StoredNote } from './types';

const baseTarget: TargetInfo = {
  url: 'https://example.com/page',
  hostname: 'example.com',
  pageTitle: 'Test Page',
  elementSelector: '#main',
  elementTag: 'div',
  elementInfo: '<div#main>',
};

describe('createEditorState', () => {
  it('creates new note state with saveDisabled true', () => {
    const state = createEditorState(baseTarget);
    expect(state.mode).toBe('new');
    expect(state.noteId).toBeNull();
    expect(state.body).toBe('');
    expect(state.saveDisabled).toBe(true);
    expect(state.saving).toBe(false);
  });

  it('creates edit state from existing note', () => {
    const note: StoredNote = {
      id: 'note-1',
      url: 'https://example.com/page',
      hostname: 'example.com',
      pageTitle: 'Test Page',
      elementSelector: '#main',
      elementTag: 'div',
      elementInfo: '<div#main>',
      content: 'Hello world',
      createdAt: '2026-01-01T00:00:00Z',
      folderId: 'folder-1',
      tags: ['tag-a'],
      pinned: true,
    };
    const state = createEditorState(baseTarget, note);
    expect(state.mode).toBe('edit');
    expect(state.noteId).toBe('note-1');
    expect(state.body).toBe('Hello world');
    expect(state.folderId).toBe('folder-1');
    expect(state.tags).toEqual(['tag-a']);
    expect(state.pinned).toBe(true);
    expect(state.saveDisabled).toBe(false);
  });

  it('uses suggestedFolderId for new notes', () => {
    const state = createEditorState({ ...baseTarget, suggestedFolderId: 'sug-1' });
    expect(state.folderId).toBe('sug-1');
  });

  it('prefers note folderId over suggestedFolderId', () => {
    const note: StoredNote = {
      id: 'n1', url: '', hostname: '', pageTitle: '', elementSelector: '',
      elementTag: '', elementInfo: '', content: '', createdAt: '',
      folderId: 'note-folder', tags: [], pinned: false,
    };
    const state = createEditorState({ ...baseTarget, suggestedFolderId: 'sug-1' }, note);
    expect(state.folderId).toBe('note-folder');
  });
});

describe('editorReducer', () => {
  const initial = createEditorState(baseTarget);

  it('SET_BODY updates body and saveDisabled', () => {
    const next = editorReducer(initial, { type: 'SET_BODY', body: 'content' });
    expect(next.body).toBe('content');
    expect(next.saveDisabled).toBe(false);
  });

  it('SET_BODY with empty string disables save', () => {
    const withContent = editorReducer(initial, { type: 'SET_BODY', body: 'x' });
    const empty = editorReducer(withContent, { type: 'SET_BODY', body: '   ' });
    expect(empty.saveDisabled).toBe(true);
  });

  it('SET_BODY clears errorMessage', () => {
    const withError = editorReducer(initial, { type: 'SAVE_ERROR', message: 'fail' });
    const next = editorReducer(withError, { type: 'SET_BODY', body: 'x' });
    expect(next.errorMessage).toBe('');
  });

  it('SET_FOLDER updates folderId and closes selector', () => {
    const opened = editorReducer(initial, { type: 'OPEN_FOLDER_SELECTOR' });
    const next = editorReducer(opened, { type: 'SET_FOLDER', folderId: 'f-1' });
    expect(next.folderId).toBe('f-1');
    expect(next.folderSelectorOpen).toBe(false);
  });

  it('ADD_TAG normalizes and deduplicates', () => {
    let state = editorReducer(initial, { type: 'ADD_TAG', tag: ' #MyTag ' });
    expect(state.tags).toEqual(['mytag']);
    state = editorReducer(state, { type: 'ADD_TAG', tag: 'mytag' });
    expect(state.tags).toEqual(['mytag']);
  });

  it('ADD_TAG ignores empty strings', () => {
    const state = editorReducer(initial, { type: 'ADD_TAG', tag: '  ' });
    expect(state.tags).toEqual([]);
  });

  it('REMOVE_TAG removes by value', () => {
    let state = editorReducer(initial, { type: 'ADD_TAG', tag: 'a' });
    state = editorReducer(state, { type: 'ADD_TAG', tag: 'b' });
    state = editorReducer(state, { type: 'REMOVE_TAG', tag: 'a' });
    expect(state.tags).toEqual(['b']);
  });

  it('TOGGLE_PIN flips pinned', () => {
    const next = editorReducer(initial, { type: 'TOGGLE_PIN' });
    expect(next.pinned).toBe(true);
    expect(editorReducer(next, { type: 'TOGGLE_PIN' }).pinned).toBe(false);
  });

  it('folder creation flow: SET_FOLDER_DRAFT -> FOLDER_CREATED', () => {
    let state = editorReducer(initial, { type: 'OPEN_FOLDER_SELECTOR' });
    expect(state.folderSelectorOpen).toBe(true);
    state = editorReducer(state, { type: 'SET_FOLDER_DRAFT', name: 'New', parentId: null });
    expect(state.folderCreating).toBe(true);
    expect(state.folderDraftName).toBe('New');
    state = editorReducer(state, { type: 'FOLDER_CREATED', folderId: 'new-id' });
    expect(state.folderId).toBe('new-id');
    expect(state.folderCreating).toBe(false);
    expect(state.folderSelectorOpen).toBe(false);
  });

  it('CLOSE_FOLDER_SELECTOR resets folder draft state', () => {
    let state = editorReducer(initial, { type: 'OPEN_FOLDER_SELECTOR' });
    state = editorReducer(state, { type: 'SET_FOLDER_DRAFT', name: 'Draft', parentId: 'p1' });
    state = editorReducer(state, { type: 'CLOSE_FOLDER_SELECTOR' });
    expect(state.folderSelectorOpen).toBe(false);
    expect(state.folderCreating).toBe(false);
    expect(state.folderDraftName).toBe('');
  });

  it('SAVE_START/SAVE_SUCCESS lifecycle', () => {
    let state = editorReducer(initial, { type: 'SAVE_START' });
    expect(state.saving).toBe(true);
    expect(state.errorMessage).toBe('');
    state = editorReducer(state, { type: 'SAVE_SUCCESS' });
    expect(state.saving).toBe(false);
  });

  it('SAVE_START/SAVE_ERROR lifecycle', () => {
    let state = editorReducer(initial, { type: 'SAVE_START' });
    state = editorReducer(state, { type: 'SAVE_ERROR', message: 'Network error' });
    expect(state.saving).toBe(false);
    expect(state.errorMessage).toBe('Network error');
  });

  it('DELETE_START/DELETE_SUCCESS lifecycle', () => {
    let state = editorReducer(initial, { type: 'DELETE_START' });
    expect(state.saving).toBe(true);
    state = editorReducer(state, { type: 'DELETE_SUCCESS' });
    expect(state.saving).toBe(false);
  });
});

describe('buildSavePayload', () => {
  it('extracts all fields from state', () => {
    const state = createEditorState(baseTarget);
    const updated = editorReducer(
      editorReducer(state, { type: 'SET_BODY', body: 'my note' }),
      { type: 'SET_FOLDER', folderId: 'f-1' }
    );
    const payload = buildSavePayload(updated);
    expect(payload.content).toBe('my note');
    expect(payload.folderId).toBe('f-1');
    expect(payload.url).toBe('https://example.com/page');
    expect(payload.elementSelector).toBe('#main');
    expect(payload.elementTag).toBe('div');
    expect(payload.hostname).toBe('example.com');
  });

  it('includes optional fields when present', () => {
    const target: TargetInfo = {
      ...baseTarget,
      elementXPath: '/html/body/div',
      elementTextHash: 'abc123',
      elementPosition: '0,1,2',
      selectedText: 'some text',
    };
    const state = createEditorState(target);
    const payload = buildSavePayload(state);
    expect(payload.elementXPath).toBe('/html/body/div');
    expect(payload.elementTextHash).toBe('abc123');
    expect(payload.elementPosition).toBe('0,1,2');
    expect(payload.selectedText).toBe('some text');
  });
});
