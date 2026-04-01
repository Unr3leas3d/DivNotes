import type { StoredNote } from './types';

// ==================== STATE ====================

export interface EditorState {
  mode: 'new' | 'edit';
  noteId: string | null;

  // Visible fields
  body: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;

  // Folder selector
  folderSelectorOpen: boolean;
  folderCreating: boolean;
  folderDraftName: string;
  folderDraftParentId: string | null;

  // UI state
  saving: boolean;
  saveDisabled: boolean;
  errorMessage: string;

  // Hidden (used for save, not rendered)
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
}

// ==================== ACTIONS ====================

export type EditorAction =
  | { type: 'SET_BODY'; body: string }
  | { type: 'SET_FOLDER'; folderId: string | null }
  | { type: 'ADD_TAG'; tag: string }
  | { type: 'REMOVE_TAG'; tag: string }
  | { type: 'TOGGLE_PIN' }
  | { type: 'OPEN_FOLDER_SELECTOR' }
  | { type: 'CLOSE_FOLDER_SELECTOR' }
  | { type: 'SET_FOLDER_DRAFT'; name: string; parentId: string | null }
  | { type: 'FOLDER_CREATED'; folderId: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR'; message: string }
  | { type: 'DELETE_START' }
  | { type: 'DELETE_SUCCESS' };

// ==================== INITIALIZER ====================

export interface TargetInfo {
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
  suggestedFolderId?: string | null;
}

export function createEditorState(
  targetInfo: TargetInfo,
  note?: StoredNote | null
): EditorState {
  const isEdit = !!note;
  return {
    mode: isEdit ? 'edit' : 'new',
    noteId: note?.id ?? null,
    body: note?.content ?? '',
    folderId: note?.folderId ?? targetInfo.suggestedFolderId ?? null,
    tags: note?.tags ? [...note.tags] : [],
    pinned: note?.pinned ?? false,
    folderSelectorOpen: false,
    folderCreating: false,
    folderDraftName: '',
    folderDraftParentId: null,
    saving: false,
    saveDisabled: isEdit ? false : true,
    errorMessage: '',
    url: targetInfo.url,
    hostname: targetInfo.hostname,
    pageTitle: targetInfo.pageTitle,
    elementSelector: targetInfo.elementSelector,
    elementTag: targetInfo.elementTag,
    elementInfo: targetInfo.elementInfo,
    elementXPath: targetInfo.elementXPath,
    elementTextHash: targetInfo.elementTextHash,
    elementPosition: targetInfo.elementPosition,
    selectedText: targetInfo.selectedText,
  };
}

// ==================== REDUCER ====================

function isBodyMeaningful(body: string): boolean {
  return body.trim().length > 0;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_BODY':
      return {
        ...state,
        body: action.body,
        saveDisabled: !isBodyMeaningful(action.body),
        errorMessage: '',
      };
    case 'SET_FOLDER':
      return {
        ...state,
        folderId: action.folderId,
        folderSelectorOpen: false,
      };
    case 'ADD_TAG': {
      const normalized = action.tag.trim().replace(/^#+/, '').toLowerCase();
      if (!normalized || state.tags.includes(normalized)) return state;
      return { ...state, tags: [...state.tags, normalized] };
    }
    case 'REMOVE_TAG':
      return { ...state, tags: state.tags.filter((t) => t !== action.tag) };
    case 'TOGGLE_PIN':
      return { ...state, pinned: !state.pinned };
    case 'OPEN_FOLDER_SELECTOR':
      return { ...state, folderSelectorOpen: true };
    case 'CLOSE_FOLDER_SELECTOR':
      return { ...state, folderSelectorOpen: false, folderCreating: false, folderDraftName: '' };
    case 'SET_FOLDER_DRAFT':
      return {
        ...state,
        folderCreating: true,
        folderDraftName: action.name,
        folderDraftParentId: action.parentId,
      };
    case 'FOLDER_CREATED':
      return {
        ...state,
        folderId: action.folderId,
        folderSelectorOpen: false,
        folderCreating: false,
        folderDraftName: '',
        folderDraftParentId: null,
      };
    case 'SAVE_START':
      return { ...state, saving: true, errorMessage: '' };
    case 'SAVE_SUCCESS':
      return { ...state, saving: false };
    case 'SAVE_ERROR':
      return { ...state, saving: false, errorMessage: action.message };
    case 'DELETE_START':
      return { ...state, saving: true };
    case 'DELETE_SUCCESS':
      return { ...state, saving: false };
    default:
      return state;
  }
}

// ==================== SAVE PAYLOAD ====================

export interface SavePayload {
  content: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
  selectedText?: string;
}

export function buildSavePayload(state: EditorState): SavePayload {
  return {
    content: state.body,
    folderId: state.folderId,
    tags: state.tags,
    pinned: state.pinned,
    url: state.url,
    hostname: state.hostname,
    pageTitle: state.pageTitle,
    elementSelector: state.elementSelector,
    elementTag: state.elementTag,
    elementInfo: state.elementInfo,
    elementXPath: state.elementXPath,
    elementTextHash: state.elementTextHash,
    elementPosition: state.elementPosition,
    selectedText: state.selectedText,
  };
}
