export interface CanopyPluginSettings {
  vaultFolder: string;
  folderMode: "mirrored" | "flat";
  email: string | null;
  syncStatus: "disconnected" | "connected" | "syncing" | "offline" | "auth_expired";
  lastSyncedAt: string | null;
}

export const DEFAULT_SETTINGS: CanopyPluginSettings = {
  vaultFolder: "Canopy",
  folderMode: "mirrored",
  email: null,
  syncStatus: "disconnected",
  lastSyncedAt: null
};

export interface CanopyNote {
  id: string;
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  content: string;
  color: string;
  tagLabel: string | null;
  elementXPath: string | null;
  elementTextHash: string | null;
  elementPosition: string | null;
  selectedText: string | null;
  createdAt: string;
  updatedAt: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
}

export interface SupabaseNoteRow {
  id: string;
  user_id: string;
  page_url: string;
  page_title: string;
  page_domain: string;
  element_selector: string;
  element_tag: string;
  element_info: string;
  content: string;
  color: string;
  tag_label: string | null;
  element_xpath: string | null;
  element_text_hash: string | null;
  element_position: string | null;
  selected_text: string | null;
  created_at: string;
  updated_at: string;
  folder_id: string | null;
  pinned: boolean;
  note_tags?: Array<{ tag_id: string }>;
}

export interface SupabaseFolderRow {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  order: number;
  color: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueueEntry {
  canopyId: string;
  content: string;
  updatedAt: string;
  retries: number;
}

export interface NoteFrontmatter {
  canopy_id: string;
  url: string;
  hostname: string;
  page_title: string;
  element_selector: string;
  element_tag: string;
  selected_text: string | null;
  color: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
  folder?: string;
}

export interface PluginPersistedData extends Partial<CanopyPluginSettings> {
  _supabase?: Record<string, string>;
  _offlineQueue?: QueueEntry[];
  _offlineFailures?: number;
}
