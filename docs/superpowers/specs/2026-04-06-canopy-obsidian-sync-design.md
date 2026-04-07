# Canopy Obsidian Sync — Design Spec

**Date:** 2026-04-06
**Status:** Draft
**Feature gate:** Premium subscription only

## Overview

Two-way sync between the Canopy Chrome extension and Obsidian via a dedicated Obsidian community plugin. Supabase is the shared data source — no new backend services. Notes authored in Canopy appear as `.md` files in the user's Obsidian vault, and content edits made in Obsidian push back to Supabase.

## Architecture

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────────┐
│  Canopy Chrome   │──push──▶│   Supabase   │◀──push──│  Canopy Obsidian    │
│  Extension       │         │  notes table │         │  Plugin             │
│                  │◀─cache──│  (realtime)  │──ws────▶│                     │
└─────────────────┘         └──────────────┘         └──────┬──────────────┘
                                                            │
                                                     ┌──────▼──────────────┐
                                                     │  Obsidian Vault     │
                                                     │  /Canopy/           │
                                                     │    Sites/           │
                                                     │    Research/        │
                                                     │      note-1.md     │
                                                     │    Unfiled/         │
                                                     │      note-2.md     │
                                                     └─────────────────────┘
```

**Canopy Chrome Extension** — No changes to core note CRUD. The existing `CloudNotesService` already writes to Supabase with `updated_at` on every mutation.

**Canopy Obsidian Plugin** — New TypeScript codebase. An Obsidian community plugin that:
1. Authenticates with Supabase using the user's Canopy credentials
2. Subscribes to Realtime changes on the `notes` table (filtered by `user_id`)
3. Writes/updates/deletes `.md` files in the vault
4. Watches for local `.md` file edits and pushes changes back to Supabase
5. Maintains backlinks and domain index notes for graph integration
6. Queues failed pushes for retry when offline

**No new backend services.** Supabase handles auth, data, and realtime. The plugin talks directly to Supabase using the same project URL and anon key as the extension.

## Authentication

### Dual provider support

The plugin settings page shows two sign-in options:

1. **"Sign in with Google"** — Opens system browser to Supabase's Google OAuth URL → user completes Google sign-in → Supabase redirects to `obsidian://canopy-auth?access_token=...&refresh_token=...` → Obsidian catches the protocol handler → plugin calls `supabase.auth.setSession()` with the tokens.

2. **"Sign in with email"** — Email and password fields directly in the plugin settings. Plugin calls `supabase.auth.signInWithPassword()` inline — no browser needed.

Both paths produce a valid Supabase session stored in Obsidian's plugin data (`this.saveData()`). Everything downstream is identical regardless of sign-in method.

### Redirect URL setup

Requires adding `obsidian://canopy-auth` to the Supabase project's allowed redirect URLs in the dashboard — one-time configuration.

### Supabase client config

The plugin bundles its own `@supabase/supabase-js` instance with a custom storage adapter backed by Obsidian's `this.loadData()`/`this.saveData()` (mirroring the extension's `chromeStorageAdapter` pattern). Same anon key and project URL as the extension. RLS on `user_id` ensures a user only accesses their own notes.

### Session lifecycle

- On plugin load: restore session → refresh if expired → subscribe to Realtime → run initial full sync
- Supabase JS client handles automatic token refresh
- On refresh failure (e.g., revoked session): plugin shows "Re-authenticate" prompt in settings
- On network loss: Realtime auto-reconnects; reconciliation sync on reconnect

## File Format & Mapping

### `.md` file structure

```markdown
---
canopy_id: "uuid-of-the-note"
url: "https://example.com/page"
hostname: "example.com"
page_title: "Example Page Title"
element_selector: "div.article > p:nth-child(3)"
element_tag: "p"
selected_text: "the highlighted text, if any"
color: "#7c3aed"
tags:
  - tag-uuid-1
  - tag-uuid-2
pinned: true
created_at: "2026-04-01T12:00:00Z"
updated_at: "2026-04-06T15:30:00Z"
---

The actual note content here. This is the `content` field from StoredNote, written as-is since it's already markdown.
```

### File naming

`{pageTitle} - {first 6 chars of id}.md`

The ID suffix prevents collisions when multiple notes share the same page title. Example: `Example Page Title - a3f2c1.md`

### Folder mapping — Mirrored mode (default)

```
Vault/
  Canopy/
    Sites/                         ← auto-generated domain index notes
      example.com.md
    Research/                      ← StoredFolder "Research"
      ML Papers/                   ← nested child folder
        Attention Paper - a3f2c1.md
    Unfiled/                       ← notes with folderId: null
      Some Note - b7d4e2.md
```

### Folder mapping — Flat mode

```
Vault/
  Canopy/
    Sites/                         ← always present, plugin-managed (not affected by folder mode)
      example.com.md
    Attention Paper - a3f2c1.md    ← frontmatter includes `folder: Research/ML Papers`
    Some Note - b7d4e2.md          ← frontmatter includes `folder: Unfiled`
```

### Metadata exclusions

The following fields are internal anchoring data with no user value in Obsidian. They stay in Supabase only and are NOT written to frontmatter:
- `elementInfo`
- `elementXPath`
- `elementTextHash`
- `elementPosition`

### Vault folder auto-creation

On first sync, the plugin creates the root folder (e.g., `Canopy/`) if it doesn't exist, along with any subfolder structure needed. New Canopy folders that appear later are created on the fly during sync.

## Sync Engine

### Conflict resolution

**`updated_at`-latest wins**, fully automated. Whichever side (Canopy or Obsidian) has the more recent `updated_at` timestamp overwrites the other. No manual conflict resolution.

### Initial sync (on first connection or reconnect)

1. Plugin fetches all notes from Supabase for the user (`select * from notes where user_id = ?`)
2. Reads all `.md` files in the Canopy vault folder
3. Builds a map of `canopy_id` (from frontmatter) → local file
4. For each note: compare `updated_at` from Supabase vs `updated_at` from frontmatter
   - Supabase is newer → overwrite local file
   - Local is newer → push to Supabase
   - Equal → skip
5. Notes in Supabase with no local file → create `.md` file
6. Local files with a `canopy_id` not in Supabase → delete local file (note was deleted from Canopy)

### Realtime sync (Canopy → Obsidian, ongoing)

- Plugin subscribes to Supabase Realtime on the `notes` table filtered by `user_id`
- `INSERT` event → create new `.md` file
- `UPDATE` event → compare `updated_at` with local frontmatter; if Supabase is newer, overwrite file
- `DELETE` event → delete local `.md` file

### File-watch sync (Obsidian → Canopy, ongoing)

- Plugin registers Obsidian's `vault.on('modify', callback)` event
- On file modify: check if it's in the Canopy folder and has `canopy_id` frontmatter
- Extract content (body below frontmatter) and compare against last-known content hash
- If content changed: update `updated_at` to now, push to Supabase, update frontmatter `updated_at`
- If only frontmatter was edited (e.g., user changed tags): ignore — metadata is Canopy-owned
- Debounce: 2 second delay after last keystroke before pushing

### Edge cases

- **File renamed/moved by user in Obsidian** — `canopy_id` in frontmatter is the source of truth, not the filename. File still syncs correctly.
- **Folder deleted in Canopy** — Notes in that folder get `folderId: null`. Next sync moves their `.md` files to `Unfiled/`.
- **Rapid edits** — File-watch debounces pushes (2 second delay) to avoid spamming Supabase.

## Offline Queue (Obsidian → Supabase)

When a push to Supabase fails (network error, timeout), the edit is added to a persistent queue stored in Obsidian's plugin data (`this.saveData()`).

### Queue entry format

```typescript
interface QueueEntry {
  canopy_id: string;
  content: string;
  updated_at: string;
  retries: number;
}
```

### Queue behavior

- On reconnect or next successful Realtime event, the plugin drains the queue
- Each pending edit is pushed with its **original `updated_at` timestamp** so the `updated_at`-wins logic stays correct
- Queue items that fail after 10 retries are surfaced in the sync status as "X edits failed to sync"

## Backlinks & Graph Integration

### Domain index notes

The plugin generates a lightweight index note per domain inside `Canopy/Sites/`. Example `Canopy/Sites/example.com.md`:

```markdown
---
canopy_type: domain_index
domain: "example.com"
---

# example.com

- [[Example Page Title - a3f2c1]]
- [[Another Article - d8e9f0]]
```

These index notes are auto-maintained on sync — new notes add links, deleted notes remove them.

### Cross-linking same-page notes

Notes anchored on the same URL cross-link to each other. Each file includes a "Related notes" section at the bottom:

```markdown
---
(frontmatter)
---

The note content.

## Related
- [[Other Note On Same Page - b7d4e2]]
- [[Third Note On Same Page - c3a1f5]]
```

### Hostname wikilinks

Each note file includes a `[[hostname]]` wikilink in its Related section at the bottom of the file, clustering notes by domain in Obsidian's graph view. This resolves to the corresponding domain index note in `Canopy/Sites/`.

## Plugin Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Account** | — | Sign in with Google / Sign in with email. Shows connected email when authenticated. Sign out button. |
| **Vault folder** | `Canopy` | Root folder name in the vault where notes are written |
| **Folder mode** | `Mirrored` | `Mirrored` (subdirectories match Canopy folders) or `Flat` (all notes in root, folder in frontmatter) |
| **Sync status** | — | Read-only indicator: "Connected", "Syncing...", "Offline — will retry", "Auth expired — re-authenticate" |
| **Last synced** | — | Timestamp of last successful sync |

## Out of Scope (v1)

- **Obsidian → Canopy note creation** — Editing existing notes works, but new `.md` files in the Canopy folder do NOT create notes in Canopy. Notes must originate from the extension (they need web-anchoring context).
- **Tag name resolution** — Frontmatter stores tag UUIDs, not human-readable names. Can be added later by syncing the `tags` table.
- **Attachment / image sync** — Notes are text-only markdown.
- **Bulk import/export** — No "export all to JSON" or "import from markdown."
- **Multi-vault support** — Plugin works with one vault at a time.
