# Canopy Obsidian Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian community plugin that two-way syncs Canopy notes between the Chrome extension and an Obsidian vault via Supabase.

**Architecture:** The plugin is a standalone TypeScript project (`obsidian-plugin/`) in this repo. It authenticates with Supabase (Google OAuth via system browser or email/password), subscribes to Realtime for Canopy→Obsidian sync, watches vault file modifications for Obsidian→Canopy sync, and manages an offline queue for failed pushes. Notes are written as `.md` files with YAML frontmatter.

**Tech Stack:** Obsidian Plugin API, `@supabase/supabase-js`, TypeScript, esbuild (standard Obsidian plugin bundler)

**Spec:** `docs/superpowers/specs/2026-04-06-canopy-obsidian-sync-design.md`

---

## File Structure

```
obsidian-plugin/
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── manifest.json                 # Obsidian plugin manifest
├── src/
│   ├── main.ts                   # Plugin entry — onload/onunload, orchestration
│   ├── settings.ts               # PluginSettingTab — auth UI, folder config, sync status
│   ├── supabase-client.ts        # Supabase client factory with Obsidian storage adapter
│   ├── auth.ts                   # Dual-provider auth (Google OAuth + email/password)
│   ├── sync-engine.ts            # Initial sync, realtime handler, file-watch handler
│   ├── file-mapper.ts            # StoredNote ↔ .md file conversion (frontmatter + content)
│   ├── backlinks.ts              # Domain index notes + same-page cross-links
│   ├── offline-queue.ts          # Persistent queue for failed Supabase pushes
│   └── types.ts                  # Shared types (settings, queue entries, note shape)
```

---

### Task 1: Scaffold Obsidian plugin project

**Files:**
- Create: `obsidian-plugin/package.json`
- Create: `obsidian-plugin/tsconfig.json`
- Create: `obsidian-plugin/esbuild.config.mjs`
- Create: `obsidian-plugin/manifest.json`
- Create: `obsidian-plugin/src/main.ts`
- Create: `obsidian-plugin/src/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "canopy-obsidian-sync",
  "version": "0.1.0",
  "description": "Two-way sync between Canopy web annotations and Obsidian",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.97.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "builtin-modules": "^4.0.0",
    "esbuild": "^0.24.0",
    "obsidian": "latest",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES2022",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "bundler",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["DOM", "ES2022"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create esbuild.config.mjs**

```javascript
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
}).catch(() => process.exit(1));
```

- [ ] **Step 4: Create manifest.json**

```json
{
  "id": "canopy-sync",
  "name": "Canopy Sync",
  "version": "0.1.0",
  "minAppVersion": "1.0.0",
  "description": "Two-way sync between Canopy web annotations and your Obsidian vault",
  "author": "Canopy",
  "isDesktopOnly": true
}
```

- [ ] **Step 5: Create src/types.ts**

```typescript
export interface CanopyPluginSettings {
  vaultFolder: string;
  folderMode: 'mirrored' | 'flat';
  email: string | null;
  syncStatus: 'disconnected' | 'connected' | 'syncing' | 'offline' | 'auth_expired';
  lastSyncedAt: string | null;
}

export const DEFAULT_SETTINGS: CanopyPluginSettings = {
  vaultFolder: 'Canopy',
  folderMode: 'mirrored',
  email: null,
  syncStatus: 'disconnected',
  lastSyncedAt: null,
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
```

- [ ] **Step 6: Create src/main.ts (skeleton)**

```typescript
import { Plugin } from 'obsidian';
import { CanopyPluginSettings, DEFAULT_SETTINGS } from './types';

export default class CanopyPlugin extends Plugin {
  settings: CanopyPluginSettings;

  async onload() {
    await this.loadSettings();
  }

  async onunload() {
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
```

- [ ] **Step 7: Install dependencies and verify build**

Run:
```bash
cd obsidian-plugin && npm install && npm run build
```
Expected: `main.js` is generated in `obsidian-plugin/` with no errors.

- [ ] **Step 8: Commit**

```bash
git add obsidian-plugin/
git commit -m "feat(obsidian): scaffold plugin project with types and build pipeline"
```

---

### Task 2: Supabase client with Obsidian storage adapter

**Files:**
- Create: `obsidian-plugin/src/supabase-client.ts`

- [ ] **Step 1: Create supabase-client.ts**

The Obsidian storage adapter mirrors the Chrome extension's `chromeStorageAdapter` pattern but uses Obsidian's `plugin.loadData()`/`plugin.saveData()`. Since `loadData`/`saveData` persist a single JSON object, we namespace Supabase keys under a `_supabase` key within that object.

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type CanopyPlugin from './main';

const SUPABASE_URL = 'https://zqdaairthppjdioddatv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxZGFhaXJ0aHBwamRpb2RkYXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5Nzg3NDYsImV4cCI6MjA4NzU1NDc0Nn0.xdXncyCwiiAh4I666oRauqh0q_t3tTTPV0GHWVQSJW4';

function createObsidianStorageAdapter(plugin: CanopyPlugin) {
  return {
    getItem: async (key: string): Promise<string | null> => {
      const data = await plugin.loadData();
      return data?._supabase?.[key] ?? null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      const data = (await plugin.loadData()) || {};
      if (!data._supabase) data._supabase = {};
      data._supabase[key] = value;
      await plugin.saveData(data);
    },
    removeItem: async (key: string): Promise<void> => {
      const data = (await plugin.loadData()) || {};
      if (data._supabase) {
        delete data._supabase[key];
        await plugin.saveData(data);
      }
    },
  };
}

let client: SupabaseClient | null = null;

export function getSupabaseClient(plugin: CanopyPlugin): SupabaseClient {
  if (client) return client;

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: createObsidianStorageAdapter(plugin),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  return client;
}

export function resetSupabaseClient() {
  client = null;
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd obsidian-plugin && npm run build
```
Expected: Builds with no errors.

- [ ] **Step 3: Commit**

```bash
git add obsidian-plugin/src/supabase-client.ts
git commit -m "feat(obsidian): add Supabase client with Obsidian storage adapter"
```

---

### Task 3: Authentication — dual provider (Google OAuth + email/password)

**Files:**
- Create: `obsidian-plugin/src/auth.ts`
- Modify: `obsidian-plugin/src/main.ts`

- [ ] **Step 1: Create auth.ts**

```typescript
import { Notice } from 'obsidian';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import type CanopyPlugin from './main';

export class CanopyAuth {
  private plugin: CanopyPlugin;
  private supabase: SupabaseClient;

  constructor(plugin: CanopyPlugin, supabase: SupabaseClient) {
    this.plugin = plugin;
    this.supabase = supabase;
  }

  async signInWithEmail(email: string, password: string): Promise<Session | null> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      new Notice(`Sign in failed: ${error.message}`);
      return null;
    }

    this.plugin.settings.email = data.session?.user?.email ?? null;
    await this.plugin.saveSettings();
    new Notice('Signed in to Canopy');
    return data.session;
  }

  async signInWithGoogle(): Promise<void> {
    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: 'obsidian://canopy-auth',
      },
    });

    if (error) {
      new Notice(`Google sign in failed: ${error.message}`);
      return;
    }

    if (data.url) {
      window.open(data.url);
    }
  }

  async handleOAuthCallback(params: Record<string, string>): Promise<Session | null> {
    const accessToken = params['access_token'];
    const refreshToken = params['refresh_token'];

    if (!accessToken || !refreshToken) {
      new Notice('OAuth callback missing tokens');
      return null;
    }

    const { data, error } = await this.supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      new Notice(`OAuth session failed: ${error.message}`);
      return null;
    }

    this.plugin.settings.email = data.session?.user?.email ?? null;
    await this.plugin.saveSettings();
    new Notice('Signed in to Canopy via Google');
    return data.session;
  }

  async restoreSession(): Promise<Session | null> {
    const { data, error } = await this.supabase.auth.getSession();
    if (error || !data.session) return null;
    return data.session;
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.plugin.settings.email = null;
    this.plugin.settings.syncStatus = 'disconnected';
    this.plugin.settings.lastSyncedAt = null;
    await this.plugin.saveSettings();
    new Notice('Signed out of Canopy');
  }

  getUserId(session: Session): string {
    return session.user.id;
  }
}
```

- [ ] **Step 2: Update main.ts to register protocol handler and init auth**

Replace the contents of `src/main.ts` with:

```typescript
import { Plugin } from 'obsidian';
import { CanopyPluginSettings, DEFAULT_SETTINGS } from './types';
import { getSupabaseClient } from './supabase-client';
import { CanopyAuth } from './auth';

export default class CanopyPlugin extends Plugin {
  settings: CanopyPluginSettings;
  auth: CanopyAuth;

  async onload() {
    await this.loadSettings();

    const supabase = getSupabaseClient(this);
    this.auth = new CanopyAuth(this, supabase);

    // Register obsidian://canopy-auth protocol handler for Google OAuth callback
    this.registerObsidianProtocolHandler('canopy-auth', async (params) => {
      const session = await this.auth.handleOAuthCallback(params);
      if (session) {
        this.settings.syncStatus = 'connected';
        await this.saveSettings();
        // Sync engine will be started here in a later task
      }
    });

    // Attempt to restore existing session
    const session = await this.auth.restoreSession();
    if (session) {
      this.settings.email = session.user.email ?? null;
      this.settings.syncStatus = 'connected';
      await this.saveSettings();
      // Sync engine will be started here in a later task
    }
  }

  async onunload() {
    // Cleanup will be added in later tasks
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    const data = (await this.loadData()) || {};
    Object.assign(data, this.settings);
    await this.saveData(data);
  }
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd obsidian-plugin && npm run build
```
Expected: Builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add obsidian-plugin/src/auth.ts obsidian-plugin/src/main.ts
git commit -m "feat(obsidian): add dual-provider auth (Google OAuth + email/password)"
```

---

### Task 4: Plugin settings tab

**Files:**
- Create: `obsidian-plugin/src/settings.ts`
- Modify: `obsidian-plugin/src/main.ts`

- [ ] **Step 1: Create settings.ts**

```typescript
import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type CanopyPlugin from './main';

export class CanopySettingTab extends PluginSettingTab {
  plugin: CanopyPlugin;

  constructor(app: App, plugin: CanopyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Canopy Sync' });

    // ── Account section ──
    containerEl.createEl('h3', { text: 'Account' });

    if (this.plugin.settings.email) {
      new Setting(containerEl)
        .setName('Signed in as')
        .setDesc(this.plugin.settings.email)
        .addButton((btn) =>
          btn.setButtonText('Sign out').onClick(async () => {
            await this.plugin.auth.signOut();
            await this.plugin.stopSync();
            this.display(); // Re-render
          })
        );
    } else {
      // Google OAuth button
      new Setting(containerEl)
        .setName('Sign in with Google')
        .setDesc('Opens your browser to complete sign-in')
        .addButton((btn) =>
          btn.setButtonText('Google').setCta().onClick(async () => {
            await this.plugin.auth.signInWithGoogle();
          })
        );

      // Email/password sign-in
      let emailValue = '';
      let passwordValue = '';

      new Setting(containerEl)
        .setName('Sign in with email')
        .addText((text) =>
          text.setPlaceholder('Email').onChange((value) => {
            emailValue = value;
          })
        )
        .addText((text) => {
          text.setPlaceholder('Password').onChange((value) => {
            passwordValue = value;
          });
          text.inputEl.type = 'password';
        })
        .addButton((btn) =>
          btn.setButtonText('Sign in').setCta().onClick(async () => {
            if (!emailValue || !passwordValue) {
              new Notice('Please enter email and password');
              return;
            }
            const session = await this.plugin.auth.signInWithEmail(emailValue, passwordValue);
            if (session) {
              await this.plugin.startSync(session);
              this.display(); // Re-render
            }
          })
        );
    }

    // ── Sync settings ──
    containerEl.createEl('h3', { text: 'Sync' });

    new Setting(containerEl)
      .setName('Vault folder')
      .setDesc('Root folder in your vault where Canopy notes are stored')
      .addText((text) =>
        text
          .setPlaceholder('Canopy')
          .setValue(this.plugin.settings.vaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.vaultFolder = value || 'Canopy';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Folder mode')
      .setDesc('How Canopy folders map to your vault')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('mirrored', 'Mirrored (subdirectories)')
          .addOption('flat', 'Flat (frontmatter metadata)')
          .setValue(this.plugin.settings.folderMode)
          .onChange(async (value: 'mirrored' | 'flat') => {
            this.plugin.settings.folderMode = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Status ──
    containerEl.createEl('h3', { text: 'Status' });

    const statusMap: Record<string, string> = {
      disconnected: 'Disconnected',
      connected: 'Connected',
      syncing: 'Syncing...',
      offline: 'Offline — will retry',
      auth_expired: 'Auth expired — re-authenticate',
    };

    new Setting(containerEl)
      .setName('Sync status')
      .setDesc(statusMap[this.plugin.settings.syncStatus] || 'Unknown');

    if (this.plugin.settings.lastSyncedAt) {
      new Setting(containerEl)
        .setName('Last synced')
        .setDesc(new Date(this.plugin.settings.lastSyncedAt).toLocaleString());
    }
  }
}
```

- [ ] **Step 2: Register settings tab in main.ts**

Add this import at the top of `src/main.ts`:

```typescript
import { CanopySettingTab } from './settings';
```

Add this line inside `onload()`, after the `auth` initialization:

```typescript
    this.addSettingTab(new CanopySettingTab(this.app, this));
```

Add stub methods to the `CanopyPlugin` class (these will be implemented in the sync engine task):

```typescript
  async startSync(_session: import('@supabase/supabase-js').Session): Promise<void> {
    // Implemented in Task 6
  }

  async stopSync(): Promise<void> {
    // Implemented in Task 6
  }
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd obsidian-plugin && npm run build
```
Expected: Builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add obsidian-plugin/src/settings.ts obsidian-plugin/src/main.ts
git commit -m "feat(obsidian): add settings tab with auth UI, folder config, and sync status"
```

---

### Task 5: File mapper — StoredNote ↔ `.md` file conversion

**Files:**
- Create: `obsidian-plugin/src/file-mapper.ts`

- [ ] **Step 1: Create file-mapper.ts**

This module handles converting between Supabase note rows and `.md` files with YAML frontmatter. It also resolves folder paths for mirrored mode.

```typescript
import type { SupabaseNoteRow, SupabaseFolderRow, NoteFrontmatter } from './types';

/**
 * Convert a Supabase note row to a .md file string (frontmatter + content body).
 * When folderMode is 'flat', includes a `folder` field in frontmatter.
 */
export function noteToMarkdown(
  row: SupabaseNoteRow,
  folderMode: 'mirrored' | 'flat' = 'mirrored',
  folders: SupabaseFolderRow[] = []
): string {
  const fm: NoteFrontmatter = {
    canopy_id: row.id,
    url: row.page_url,
    hostname: row.page_domain,
    page_title: row.page_title || '',
    element_selector: row.element_selector,
    element_tag: row.element_tag,
    selected_text: row.selected_text || null,
    color: row.color || '#7c3aed',
    tags: (row.note_tags || []).map((nt) => nt.tag_id),
    pinned: row.pinned || false,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    folder: folderMode === 'flat'
      ? (row.folder_id ? resolveFolderPath(row.folder_id, folders) : 'Unfiled')
      : undefined,
  };

  const yamlLines = [
    '---',
    `canopy_id: "${fm.canopy_id}"`,
    `url: "${fm.url}"`,
    `hostname: "${fm.hostname}"`,
    `page_title: "${escapeFrontmatterString(fm.page_title)}"`,
    `element_selector: "${escapeFrontmatterString(fm.element_selector)}"`,
    `element_tag: "${fm.element_tag}"`,
    fm.selected_text !== null
      ? `selected_text: "${escapeFrontmatterString(fm.selected_text)}"`
      : 'selected_text: null',
    `color: "${fm.color}"`,
    `tags:`,
    ...fm.tags.map((t) => `  - "${t}"`),
    `pinned: ${fm.pinned}`,
    `created_at: "${fm.created_at}"`,
    `updated_at: "${fm.updated_at}"`,
  ];

  if (folderMode === 'flat' && fm.folder) {
    yamlLines.push(`folder: "${fm.folder}"`);
  }

  yamlLines.push('---');

  return yamlLines.join('\n') + '\n\n' + (row.content || '');
}

/**
 * Parse a .md file string back into frontmatter + content body.
 */
export function parseMarkdownNote(fileContent: string): {
  frontmatter: NoteFrontmatter | null;
  content: string;
} {
  const fmMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) return { frontmatter: null, content: fileContent };

  const yamlBlock = fmMatch[1];
  const content = fileContent.slice(fmMatch[0].length).replace(/^\n/, '');

  const frontmatter = parseYamlFrontmatter(yamlBlock);
  return { frontmatter, content };
}

function parseYamlFrontmatter(yaml: string): NoteFrontmatter {
  const lines = yaml.split('\n');
  const result: Record<string, unknown> = {};
  const tags: string[] = [];
  let currentKey = '';

  for (const line of lines) {
    const tagMatch = line.match(/^\s+-\s+"?([^"]*)"?$/);
    if (tagMatch && currentKey === 'tags') {
      tags.push(tagMatch[1]);
      continue;
    }

    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let value: unknown = kvMatch[2];

      // Remove surrounding quotes
      if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      // Handle null
      if (value === 'null') value = null;
      // Handle booleans
      if (value === 'true') value = true;
      if (value === 'false') value = false;

      result[currentKey] = value;
    }
  }

  result['tags'] = tags;

  return result as unknown as NoteFrontmatter;
}

/**
 * Generate the file path for a note within the vault.
 */
export function noteFilePath(
  row: SupabaseNoteRow,
  vaultFolder: string,
  folderMode: 'mirrored' | 'flat',
  folders: SupabaseFolderRow[]
): string {
  const fileName = sanitizeFileName(row.page_title || 'Untitled') + ` - ${row.id.slice(0, 6)}.md`;

  if (folderMode === 'flat') {
    return `${vaultFolder}/${fileName}`;
  }

  // Mirrored mode: resolve folder path
  const folderPath = row.folder_id
    ? resolveFolderPath(row.folder_id, folders)
    : 'Unfiled';

  return `${vaultFolder}/${folderPath}/${fileName}`;
}

/**
 * Build the full path from a folder ID up to the root.
 */
export function resolveFolderPath(folderId: string, folders: SupabaseFolderRow[]): string {
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const parts: string[] = [];
  let current = folderMap.get(folderId);

  while (current) {
    parts.unshift(sanitizeFileName(current.name));
    current = current.parent_id ? folderMap.get(current.parent_id) : undefined;
  }

  return parts.length > 0 ? parts.join('/') : 'Unfiled';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled';
}

function escapeFrontmatterString(value: string): string {
  return value.replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd obsidian-plugin && npm run build
```
Expected: Builds with no errors.

- [ ] **Step 3: Commit**

```bash
git add obsidian-plugin/src/file-mapper.ts
git commit -m "feat(obsidian): add file mapper for StoredNote to markdown conversion"
```

---

### Task 6: Offline queue

**Files:**
- Create: `obsidian-plugin/src/offline-queue.ts`

- [ ] **Step 1: Create offline-queue.ts**

```typescript
import type CanopyPlugin from './main';
import type { QueueEntry } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_RETRIES = 10;
const QUEUE_DATA_KEY = '_offlineQueue';

export class OfflineQueue {
  private plugin: CanopyPlugin;
  private supabase: SupabaseClient;
  private userId: string;
  private queue: QueueEntry[] = [];
  private draining = false;

  constructor(plugin: CanopyPlugin, supabase: SupabaseClient, userId: string) {
    this.plugin = plugin;
    this.supabase = supabase;
    this.userId = userId;
  }

  async load(): Promise<void> {
    const data = (await this.plugin.loadData()) || {};
    this.queue = data[QUEUE_DATA_KEY] || [];
  }

  private async persist(): Promise<void> {
    const data = (await this.plugin.loadData()) || {};
    data[QUEUE_DATA_KEY] = this.queue;
    await this.plugin.saveData(data);
  }

  async enqueue(entry: Omit<QueueEntry, 'retries'>): Promise<void> {
    // Replace existing entry for same note (latest edit wins)
    this.queue = this.queue.filter((e) => e.canopyId !== entry.canopyId);
    this.queue.push({ ...entry, retries: 0 });
    await this.persist();
  }

  async drain(): Promise<void> {
    if (this.draining || this.queue.length === 0) return;
    this.draining = true;

    const remaining: QueueEntry[] = [];

    for (const entry of this.queue) {
      const { error } = await this.supabase
        .from('notes')
        .update({
          content: entry.content,
          updated_at: entry.updatedAt,
        })
        .eq('id', entry.canopyId)
        .eq('user_id', this.userId);

      if (error) {
        const retries = entry.retries + 1;
        if (retries < MAX_RETRIES) {
          remaining.push({ ...entry, retries });
        }
        // Entries exceeding MAX_RETRIES are dropped from queue
      }
    }

    this.queue = remaining;
    await this.persist();
    this.draining = false;
  }

  getFailedCount(): number {
    return this.queue.filter((e) => e.retries >= MAX_RETRIES).length;
  }

  getPendingCount(): number {
    return this.queue.length;
  }
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd obsidian-plugin && npm run build
```
Expected: Builds with no errors.

- [ ] **Step 3: Commit**

```bash
git add obsidian-plugin/src/offline-queue.ts
git commit -m "feat(obsidian): add persistent offline queue for failed Supabase pushes"
```

---

### Task 7: Backlinks — domain index notes and same-page cross-links

**Files:**
- Create: `obsidian-plugin/src/backlinks.ts`

- [ ] **Step 1: Create backlinks.ts**

```typescript
import { Vault, TFile, TFolder } from 'obsidian';
import type { SupabaseNoteRow } from './types';

/**
 * Maintain domain index notes in Canopy/Sites/ and cross-link notes on the same page.
 */
export class BacklinkManager {
  private vault: Vault;
  private vaultFolder: string;

  constructor(vault: Vault, vaultFolder: string) {
    this.vault = vault;
    this.vaultFolder = vaultFolder;
  }

  /**
   * Rebuild all domain index notes and same-page cross-links.
   * Called after initial sync and after realtime changes.
   */
  async rebuild(notes: SupabaseNoteRow[]): Promise<void> {
    await this.rebuildDomainIndexes(notes);
    await this.updateCrossLinks(notes);
  }

  private async rebuildDomainIndexes(notes: SupabaseNoteRow[]): Promise<void> {
    const sitesFolder = `${this.vaultFolder}/Sites`;
    await this.ensureFolder(sitesFolder);

    // Group notes by hostname
    const byDomain = new Map<string, SupabaseNoteRow[]>();
    for (const note of notes) {
      const domain = note.page_domain;
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain)!.push(note);
    }

    // Get existing domain index files
    const sitesDir = this.vault.getAbstractFileByPath(sitesFolder);
    const existingFiles = new Set<string>();
    if (sitesDir instanceof TFolder) {
      for (const child of sitesDir.children) {
        if (child instanceof TFile && child.extension === 'md') {
          existingFiles.add(child.path);
        }
      }
    }

    // Create/update domain index for each domain
    for (const [domain, domainNotes] of byDomain) {
      const filePath = `${sitesFolder}/${sanitizeDomainFileName(domain)}.md`;
      const content = this.buildDomainIndex(domain, domainNotes);
      await this.writeFile(filePath, content);
      existingFiles.delete(filePath);
    }

    // Remove domain indexes for domains with no notes
    for (const stale of existingFiles) {
      const file = this.vault.getAbstractFileByPath(stale);
      if (file instanceof TFile) {
        await this.vault.delete(file);
      }
    }
  }

  private buildDomainIndex(domain: string, notes: SupabaseNoteRow[]): string {
    const lines = [
      '---',
      'canopy_type: domain_index',
      `domain: "${domain}"`,
      '---',
      '',
      `# ${domain}`,
      '',
    ];

    for (const note of notes) {
      const title = note.page_title || 'Untitled';
      const linkName = `${title} - ${note.id.slice(0, 6)}`;
      lines.push(`- [[${linkName}]]`);
    }

    return lines.join('\n');
  }

  async updateCrossLinks(notes: SupabaseNoteRow[]): Promise<void> {
    // Group notes by URL (same page)
    const byUrl = new Map<string, SupabaseNoteRow[]>();
    for (const note of notes) {
      if (!byUrl.has(note.page_url)) byUrl.set(note.page_url, []);
      byUrl.get(note.page_url)!.push(note);
    }

    // For each group with 2+ notes, build cross-links
    for (const [, pageNotes] of byUrl) {
      if (pageNotes.length < 2) continue;

      for (const note of pageNotes) {
        const siblings = pageNotes.filter((n) => n.id !== note.id);
        const relatedSection = this.buildRelatedSection(note, siblings);

        // Find the note's file and append/update the Related section
        await this.updateRelatedSection(note, relatedSection);
      }
    }
  }

  private buildRelatedSection(
    note: SupabaseNoteRow,
    siblings: SupabaseNoteRow[]
  ): string {
    const domain = note.page_domain;
    const lines = [
      '',
      '## Related',
      `- [[${sanitizeDomainFileName(domain)}|${domain}]]`,
    ];

    for (const sibling of siblings) {
      const title = sibling.page_title || 'Untitled';
      const linkName = `${title} - ${sibling.id.slice(0, 6)}`;
      lines.push(`- [[${linkName}]]`);
    }

    return lines.join('\n');
  }

  async updateRelatedSection(
    note: SupabaseNoteRow,
    relatedSection: string
  ): Promise<void> {
    // Find the file by scanning for canopy_id in frontmatter
    const noteFileName = `${note.page_title || 'Untitled'} - ${note.id.slice(0, 6)}.md`;
    const files = this.vault.getMarkdownFiles().filter((f) =>
      f.path.startsWith(this.vaultFolder + '/') && f.name === noteFileName
    );

    if (files.length === 0) return;

    const file = files[0];
    const content = await this.vault.read(file);

    // Remove existing Related section if present
    const withoutRelated = content.replace(/\n## Related\n[\s\S]*$/, '');
    const newContent = withoutRelated.trimEnd() + '\n' + relatedSection + '\n';

    await this.vault.modify(file, newContent);
  }

  private async ensureFolder(path: string): Promise<void> {
    const existing = this.vault.getAbstractFileByPath(path);
    if (!existing) {
      await this.vault.createFolder(path);
    }
  }

  private async writeFile(path: string, content: string): Promise<void> {
    const existing = this.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.vault.modify(existing, content);
    } else {
      await this.vault.create(path, content);
    }
  }
}

function sanitizeDomainFileName(domain: string): string {
  return domain.replace(/[\\/:*?"<>|]/g, '-');
}
```

- [ ] **Step 2: Verify build**

Run:
```bash
cd obsidian-plugin && npm run build
```
Expected: Builds with no errors.

- [ ] **Step 3: Commit**

```bash
git add obsidian-plugin/src/backlinks.ts
git commit -m "feat(obsidian): add backlink manager for domain indexes and cross-links"
```

---

### Task 8: Sync engine — initial sync, realtime, and file-watch

**Files:**
- Create: `obsidian-plugin/src/sync-engine.ts`
- Modify: `obsidian-plugin/src/main.ts`

This is the core orchestrator. It wires together the file mapper, backlink manager, and offline queue.

- [ ] **Step 1: Create sync-engine.ts**

```typescript
import { Vault, TFile, TFolder, EventRef } from 'obsidian';
import type { SupabaseClient, RealtimeChannel, Session } from '@supabase/supabase-js';
import type CanopyPlugin from './main';
import type { SupabaseNoteRow, SupabaseFolderRow, NoteFrontmatter } from './types';
import { noteToMarkdown, parseMarkdownNote, noteFilePath } from './file-mapper';
import { BacklinkManager } from './backlinks';
import { OfflineQueue } from './offline-queue';

const FILE_WATCH_DEBOUNCE_MS = 2000;

export class SyncEngine {
  private plugin: CanopyPlugin;
  private supabase: SupabaseClient;
  private userId: string;
  private vault: Vault;
  private backlinks: BacklinkManager;
  private offlineQueue: OfflineQueue;
  private channel: RealtimeChannel | null = null;
  private fileWatchRef: EventRef | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private folders: SupabaseFolderRow[] = [];
  private allNotes: SupabaseNoteRow[] = [];
  // Track files we're currently writing to so file-watch ignores our own writes
  private writingFiles = new Set<string>();

  constructor(plugin: CanopyPlugin, supabase: SupabaseClient, userId: string) {
    this.plugin = plugin;
    this.supabase = supabase;
    this.userId = userId;
    this.vault = plugin.app.vault;
    this.backlinks = new BacklinkManager(this.vault, plugin.settings.vaultFolder);
    this.offlineQueue = new OfflineQueue(plugin, supabase, userId);
  }

  async start(): Promise<void> {
    await this.offlineQueue.load();
    await this.initialSync();
    this.subscribeRealtime();
    this.watchFileChanges();
  }

  async stop(): Promise<void> {
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.fileWatchRef) {
      this.vault.offref(this.fileWatchRef);
      this.fileWatchRef = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  // ── Initial Sync ──

  private async initialSync(): Promise<void> {
    this.plugin.settings.syncStatus = 'syncing';
    await this.plugin.saveSettings();

    try {
      // Fetch folders for path resolution
      const { data: folderData } = await this.supabase
        .from('folders')
        .select('*')
        .eq('user_id', this.userId);
      this.folders = folderData || [];

      // Fetch all notes
      const { data: noteData, error } = await this.supabase
        .from('notes')
        .select('*, note_tags(tag_id)')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.allNotes = noteData || [];

      // Build map of canopy_id -> local file
      const localFiles = await this.getCanopyFiles();
      const localByCanopyId = new Map<string, { file: TFile; frontmatter: NoteFrontmatter }>();
      for (const { file, frontmatter } of localFiles) {
        if (frontmatter) {
          localByCanopyId.set(frontmatter.canopy_id, { file, frontmatter });
        }
      }

      const remoteIds = new Set<string>();

      // Sync each remote note
      for (const note of this.allNotes) {
        remoteIds.add(note.id);
        const local = localByCanopyId.get(note.id);

        if (!local) {
          // Note exists in Supabase but not locally — create file
          await this.writeNoteFile(note);
        } else {
          const remoteUpdated = new Date(note.updated_at || note.created_at).getTime();
          const localUpdated = new Date(local.frontmatter.updated_at).getTime();

          if (remoteUpdated > localUpdated) {
            // Supabase is newer — overwrite local
            await this.writeNoteFile(note);
          } else if (localUpdated > remoteUpdated) {
            // Local is newer — push to Supabase
            const content = await this.vault.read(local.file);
            const { content: body } = parseMarkdownNote(content);
            await this.pushContentToSupabase(note.id, body, local.frontmatter.updated_at);
          }
          // Equal — skip
        }
      }

      // Delete local files for notes no longer in Supabase
      for (const { file, frontmatter } of localFiles) {
        if (frontmatter && !remoteIds.has(frontmatter.canopy_id)) {
          await this.vault.delete(file);
        }
      }

      // Rebuild backlinks
      await this.backlinks.rebuild(this.allNotes);

      // Drain offline queue
      await this.offlineQueue.drain();

      this.plugin.settings.syncStatus = 'connected';
      this.plugin.settings.lastSyncedAt = new Date().toISOString();
      await this.plugin.saveSettings();
    } catch (err) {
      console.error('[Canopy] Initial sync failed:', err);
      this.plugin.settings.syncStatus = 'offline';
      await this.plugin.saveSettings();
    }
  }

  // ── Realtime Subscription ──

  private subscribeRealtime(): void {
    this.channel = this.supabase
      .channel('canopy-notes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${this.userId}`,
        },
        async (payload) => {
          try {
            await this.handleRealtimeEvent(payload);
            // Drain offline queue on any successful realtime event
            await this.offlineQueue.drain();
          } catch (err) {
            console.error('[Canopy] Realtime handler error:', err);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.plugin.settings.syncStatus = 'connected';
          this.plugin.saveSettings();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.plugin.settings.syncStatus = 'offline';
          this.plugin.saveSettings();
        }
      });
  }

  private async handleRealtimeEvent(
    payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }
  ): Promise<void> {
    if (payload.eventType === 'INSERT') {
      const note = payload.new as unknown as SupabaseNoteRow;
      // Fetch note_tags separately since realtime doesn't include joins
      const { data: tagData } = await this.supabase
        .from('note_tags')
        .select('tag_id')
        .eq('note_id', note.id);
      note.note_tags = tagData || [];

      await this.writeNoteFile(note);
      this.allNotes.push(note);
      await this.backlinks.rebuild(this.allNotes);
    } else if (payload.eventType === 'UPDATE') {
      const note = payload.new as unknown as SupabaseNoteRow;
      const { data: tagData } = await this.supabase
        .from('note_tags')
        .select('tag_id')
        .eq('note_id', note.id);
      note.note_tags = tagData || [];

      // Compare with local
      const localFile = await this.findFileByCanopyId(note.id);
      if (localFile) {
        const localContent = await this.vault.read(localFile);
        const { frontmatter } = parseMarkdownNote(localContent);
        if (frontmatter) {
          const remoteUpdated = new Date(note.updated_at || note.created_at).getTime();
          const localUpdated = new Date(frontmatter.updated_at).getTime();
          if (remoteUpdated <= localUpdated) return; // Local is newer, skip
        }
      }

      await this.writeNoteFile(note);
      this.allNotes = this.allNotes.map((n) => (n.id === note.id ? note : n));
      await this.backlinks.rebuild(this.allNotes);
    } else if (payload.eventType === 'DELETE') {
      const oldNote = payload.old as unknown as { id: string };
      const file = await this.findFileByCanopyId(oldNote.id);
      if (file) {
        await this.vault.delete(file);
      }
      this.allNotes = this.allNotes.filter((n) => n.id !== oldNote.id);
      await this.backlinks.rebuild(this.allNotes);
    }

    this.plugin.settings.lastSyncedAt = new Date().toISOString();
    await this.plugin.saveSettings();
  }

  // ── File Watch ──

  private watchFileChanges(): void {
    this.fileWatchRef = this.vault.on('modify', (file) => {
      if (!(file instanceof TFile)) return;
      if (!file.path.startsWith(this.plugin.settings.vaultFolder + '/')) return;
      if (file.path.includes('/Sites/')) return; // Ignore domain index files
      if (this.writingFiles.has(file.path)) return; // Ignore our own writes

      // Debounce
      const existing = this.debounceTimers.get(file.path);
      if (existing) clearTimeout(existing);

      this.debounceTimers.set(
        file.path,
        setTimeout(async () => {
          this.debounceTimers.delete(file.path);
          await this.handleFileModified(file);
        }, FILE_WATCH_DEBOUNCE_MS)
      );
    });
  }

  private async handleFileModified(file: TFile): Promise<void> {
    try {
      const content = await this.vault.read(file);
      const { frontmatter, content: body } = parseMarkdownNote(content);

      if (!frontmatter?.canopy_id) return; // Not a Canopy note

      const now = new Date().toISOString();

      // Push content to Supabase
      const success = await this.pushContentToSupabase(frontmatter.canopy_id, body, now);

      if (success) {
        // Update frontmatter updated_at
        this.writingFiles.add(file.path);
        const newFm = content.replace(
          /updated_at: "[^"]*"/,
          `updated_at: "${now}"`
        );
        await this.vault.modify(file, newFm);
        this.writingFiles.delete(file.path);
      }
    } catch (err) {
      console.error('[Canopy] File watch handler error:', err);
    }
  }

  // ── Helpers ──

  private async pushContentToSupabase(
    canopyId: string,
    content: string,
    updatedAt: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notes')
        .update({ content, updated_at: updatedAt })
        .eq('id', canopyId)
        .eq('user_id', this.userId);

      if (error) throw error;
      return true;
    } catch {
      await this.offlineQueue.enqueue({ canopyId, content, updatedAt });
      this.plugin.settings.syncStatus = 'offline';
      await this.plugin.saveSettings();
      return false;
    }
  }

  private async writeNoteFile(note: SupabaseNoteRow): Promise<void> {
    const filePath = noteFilePath(
      note,
      this.plugin.settings.vaultFolder,
      this.plugin.settings.folderMode,
      this.folders
    );

    // Ensure parent directories exist
    const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
    await this.ensureFolderExists(parentDir);

    const markdown = noteToMarkdown(note, this.plugin.settings.folderMode, this.folders);

    // Check if file already exists (maybe at a different path due to folder changes)
    const existingFile = await this.findFileByCanopyId(note.id);

    this.writingFiles.add(filePath);

    if (existingFile && existingFile.path !== filePath) {
      // Note moved to a different folder — delete old, create new
      await this.vault.delete(existingFile);
      await this.vault.create(filePath, markdown);
    } else if (existingFile) {
      await this.vault.modify(existingFile, markdown);
    } else {
      await this.vault.create(filePath, markdown);
    }

    this.writingFiles.delete(filePath);
  }

  private async findFileByCanopyId(canopyId: string): Promise<TFile | null> {
    const files = await this.getCanopyFiles();
    for (const { file, frontmatter } of files) {
      if (frontmatter?.canopy_id === canopyId) return file;
    }
    return null;
  }

  private async getCanopyFiles(): Promise<
    Array<{ file: TFile; frontmatter: NoteFrontmatter | null }>
  > {
    const results: Array<{ file: TFile; frontmatter: NoteFrontmatter | null }> = [];
    const rootFolder = this.vault.getAbstractFileByPath(this.plugin.settings.vaultFolder);

    if (!(rootFolder instanceof TFolder)) return results;

    const collectFiles = (folder: TFolder) => {
      for (const child of folder.children) {
        if (child instanceof TFile && child.extension === 'md') {
          // Skip domain index files
          if (!child.path.includes('/Sites/')) {
            results.push({ file: child, frontmatter: null });
          }
        } else if (child instanceof TFolder) {
          collectFiles(child);
        }
      }
    };

    collectFiles(rootFolder);

    // Parse frontmatter for each file
    for (const entry of results) {
      const content = await this.vault.read(entry.file);
      const { frontmatter } = parseMarkdownNote(content);
      entry.frontmatter = frontmatter;
    }

    return results;
  }

  private async ensureFolderExists(path: string): Promise<void> {
    const parts = path.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.vault.getAbstractFileByPath(current);
      if (!existing) {
        await this.vault.createFolder(current);
      }
    }
  }
}
```

- [ ] **Step 2: Wire up SyncEngine in main.ts**

Replace the `startSync` and `stopSync` stubs and update `onload`/`onunload` in `src/main.ts`:

```typescript
import { Plugin } from 'obsidian';
import type { Session } from '@supabase/supabase-js';
import { CanopyPluginSettings, DEFAULT_SETTINGS } from './types';
import { getSupabaseClient, resetSupabaseClient } from './supabase-client';
import { CanopyAuth } from './auth';
import { CanopySettingTab } from './settings';
import { SyncEngine } from './sync-engine';

export default class CanopyPlugin extends Plugin {
  settings: CanopyPluginSettings;
  auth: CanopyAuth;
  private syncEngine: SyncEngine | null = null;

  async onload() {
    await this.loadSettings();

    const supabase = getSupabaseClient(this);
    this.auth = new CanopyAuth(this, supabase);

    this.addSettingTab(new CanopySettingTab(this.app, this));

    // Register obsidian://canopy-auth protocol handler for Google OAuth callback
    this.registerObsidianProtocolHandler('canopy-auth', async (params) => {
      const session = await this.auth.handleOAuthCallback(params);
      if (session) {
        await this.startSync(session);
      }
    });

    // Attempt to restore existing session
    const session = await this.auth.restoreSession();
    if (session) {
      this.settings.email = session.user.email ?? null;
      await this.saveSettings();
      await this.startSync(session);
    }
  }

  async onunload() {
    await this.stopSync();
    resetSupabaseClient();
  }

  async startSync(session: Session): Promise<void> {
    await this.stopSync();

    const supabase = getSupabaseClient(this);
    const userId = this.auth.getUserId(session);

    this.syncEngine = new SyncEngine(this, supabase, userId);
    await this.syncEngine.start();
  }

  async stopSync(): Promise<void> {
    if (this.syncEngine) {
      await this.syncEngine.stop();
      this.syncEngine = null;
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    const data = (await this.loadData()) || {};
    Object.assign(data, this.settings);
    await this.saveData(data);
  }
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd obsidian-plugin && npm run build
```
Expected: Builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add obsidian-plugin/src/sync-engine.ts obsidian-plugin/src/main.ts
git commit -m "feat(obsidian): add sync engine with initial sync, realtime, and file-watch"
```

---

### Task 9: Supabase configuration — enable Realtime and add redirect URL

**Files:**
- No code files. This is Supabase dashboard configuration.

- [ ] **Step 1: Enable Realtime on the `notes` table**

In the Supabase dashboard:
1. Go to **Database → Replication**
2. Find the `notes` table
3. Toggle **Realtime** ON for the `notes` table

This is required for the Obsidian plugin's Realtime subscription to receive `INSERT`, `UPDATE`, and `DELETE` events.

- [ ] **Step 2: Add OAuth redirect URL**

In the Supabase dashboard:
1. Go to **Authentication → URL Configuration**
2. Under **Redirect URLs**, add: `obsidian://canopy-auth`
3. Save

This allows the Google OAuth flow to redirect back to Obsidian after sign-in.

- [ ] **Step 3: Commit a note documenting the configuration**

Create `obsidian-plugin/SETUP.md`:

```markdown
# Canopy Obsidian Plugin — Setup Notes

## Supabase Configuration Required

1. **Realtime** must be enabled on the `notes` table (Database → Replication)
2. **Redirect URL** `obsidian://canopy-auth` must be added to Authentication → URL Configuration
```

```bash
git add obsidian-plugin/SETUP.md
git commit -m "docs(obsidian): add Supabase configuration setup notes"
```

---

### Task 10: End-to-end manual test

**Files:** None (manual verification)

- [ ] **Step 1: Build the plugin**

```bash
cd obsidian-plugin && npm run build
```

- [ ] **Step 2: Install in Obsidian**

1. Create a folder in your Obsidian vault: `.obsidian/plugins/canopy-sync/`
2. Copy `obsidian-plugin/main.js` and `obsidian-plugin/manifest.json` into that folder
3. In Obsidian, go to Settings → Community plugins → Reload → Enable "Canopy Sync"

- [ ] **Step 3: Test email sign-in**

1. Open Canopy Sync settings in Obsidian
2. Enter your Canopy email and password
3. Click "Sign in"
4. Expected: "Signed in to Canopy" notice, status shows "Connected"

- [ ] **Step 4: Verify initial sync**

1. Check that a `Canopy/` folder was created in the vault
2. Check that `.md` files exist for each of your Canopy notes
3. Open a note file — verify frontmatter has `canopy_id`, `url`, etc.
4. Verify `Canopy/Sites/` has domain index notes with wikilinks
5. Check notes on the same page have `## Related` sections with cross-links

- [ ] **Step 5: Test Canopy → Obsidian realtime sync**

1. Open the Canopy Chrome extension on a webpage
2. Create a new note
3. Expected: Within a few seconds, a new `.md` file appears in the Obsidian vault

- [ ] **Step 6: Test Obsidian → Canopy sync**

1. Edit the content of a Canopy note in Obsidian
2. Wait ~3 seconds (debounce)
3. Open the Canopy popup or side panel
4. Expected: The note's content reflects the edit made in Obsidian

- [ ] **Step 7: Test offline queue**

1. Disconnect from the internet
2. Edit a Canopy note in Obsidian
3. Reconnect to the internet
4. Expected: The edit syncs to Supabase on reconnect

- [ ] **Step 8: Commit any fixes**

```bash
git add -A && git commit -m "fix(obsidian): fixes from manual testing"
```
