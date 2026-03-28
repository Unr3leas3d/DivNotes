# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Canopy

Canopy is a Chrome Extension (Manifest V3) that lets users select any DOM element on a webpage and attach rich markdown notes to it. It supports two modes: local-only (Chrome storage) and authenticated (Supabase cloud sync with offline fallback).

## Build & Development

```bash
npm run build          # Full build: pages + content script + service worker
npm run build:pages    # Vite build for popup and sidepanel entry points
npm run build:content  # Vite build for content script (separate config)
npm run build:sw       # Copies service-worker.js to dist/background/
npm run dev            # Alias for npm run build (no watch mode)
```

To test: load `dist/` as an unpacked extension in `chrome://extensions` (enable Developer Mode).

There are no automated tests, linters, or formatters configured.

## Architecture

### Extension entry points

The extension has four separate execution contexts, each with its own build pipeline:

- **Popup** (`src/popup/`) — React app rendered in the browser action popup (380px wide). Handles auth flow and the notes dashboard. Entry: `src/popup/index.html`.
- **Side Panel** (`src/sidepanel/`) — React app for the Chrome side panel. Entry: `src/sidepanel/index.html`.
- **Content Script** (`src/content/index.tsx`) — Injected into all pages. Pure DOM manipulation (no React). Handles the element inspector overlay, note badges, inline note editor, and presentation mode. Built with a separate Vite config (`vite.content.config.ts`).
- **Service Worker** (`src/background/service-worker.js`) — Plain JS, copied to dist without bundling. Handles keyboard commands, context menu, and message routing between popup/content.

### Auth & data layer

Auth mode (`AuthMode`) is stored in `chrome.storage.local` under `divnotes_auth` and determines which `NotesService` implementation is used:

- `LocalNotesService` — reads/writes notes as an array in `chrome.storage.local`.
- `CloudNotesService` — writes to Supabase `notes` table with local cache fallback. Failed operations are queued in `divnotes_sync_queue` and retried.

The factory `getNotesService()` in `src/lib/notes-service.ts` returns a singleton service based on current auth state. Call `resetNotesService()` on login/logout.

Supabase client (`src/lib/supabase.ts`) uses a custom `chromeStorageAdapter` instead of `localStorage` since the extension context doesn't support `localStorage`.

### Message passing

Communication between contexts uses `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`. Key message types: `ACTIVATE_INSPECTOR`, `TOGGLE_NOTES`, `TOGGLE_SCREEN_SHARE`, `ADD_SELECTION_NOTE`, `SAVE_NOTE`, `DELETE_NOTE`, `UPDATE_NOTE`.

### UI components

`src/components/ui/` contains shadcn/ui components (Radix UI + Tailwind + class-variance-authority). Path alias `@/*` maps to `./src/*`.

### Landing page

`landing/` is a separate Vite + React project for the marketing site. It has its own `package.json` and `node_modules`.

## Key Constraints

- The content script cannot use React or import shared modules — it's a standalone bundle that manipulates the DOM directly.
- The service worker is plain JS with no build step (just file copy).
- Supabase credentials (public anon key) are hardcoded in `src/lib/supabase.ts` — this is expected for a Chrome extension with RLS.
- The popup has a fixed width of 380px; UI must fit within this constraint.
- `chrome.*` APIs are only available in extension contexts, not in the landing page.
