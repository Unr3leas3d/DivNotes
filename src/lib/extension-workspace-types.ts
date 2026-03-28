import type { StoredFolder, StoredNote, StoredTag } from './types';
import type {
  buildFolderSummaries,
  buildTagSummaries,
  groupNotesByHostname,
} from './extension-selectors';

export type WorkspaceView = 'this-page' | 'all-notes' | 'folders' | 'tags' | 'settings';
export type ShellType = 'popup' | 'sidepanel';
export type AuthMode = 'loading' | 'login' | 'local' | 'authenticated';

export interface WorkspaceAuth {
  mode: AuthMode;
  email: string;
  label: string;
  isLocalMode: boolean;
  isAuthenticated: boolean;
}

export interface CurrentPageState {
  url: string | null;
  title: string;
  hostname: string | null;
}

export interface WorkspaceData {
  notes: StoredNote[];
  folders: StoredFolder[];
  tags: StoredTag[];
}

export interface WorkspaceDerived {
  thisPageNotes: StoredNote[];
  groupedNotes: ReturnType<typeof groupNotesByHostname>;
  folderSummaries: ReturnType<typeof buildFolderSummaries>;
  tagSummaries: ReturnType<typeof buildTagSummaries>;
}

export interface LoadingState {
  auth: boolean;
  currentPage: boolean;
  data: boolean;
}

export interface ErrorState {
  auth: string | null;
  currentPage: string | null;
  data: string | null;
  actions: string | null;
}

export interface ViewState {
  active: WorkspaceView;
  folderId: string | null;
  tagId: string | null;
}
