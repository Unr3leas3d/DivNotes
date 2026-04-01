# Chrome Web Store Listing — Canopy

## Extension Name
Canopy — Notes on Any Webpage

## Short Description (132 characters max)
Select any element on a webpage and attach rich notes to it. Organize with tags and folders. Sync across devices or keep local.

## Detailed Description

Canopy lets you attach markdown notes directly to elements on any webpage. Select a heading, paragraph, image, or any element — then write a note that stays anchored to it.

**Key features:**
- Element-level notes — click any element to attach a note with the built-in inspector
- Rich markdown — write notes with headings, lists, code blocks, and links
- Tags and folders — organize notes with color-coded tags and nested folders
- Side panel — browse and manage all your notes without leaving the page
- Presentation mode — clean display of notes for screen sharing
- Right-click to note — select text and add a note from the context menu
- Keyboard shortcuts — Cmd+Shift+N to toggle notes, Cmd+Shift+S to select elements

**Two modes:**
- Local mode: all notes stay on your device in Chrome storage. No account needed.
- Cloud sync: sign in with Google to sync notes across devices. Your data is encrypted in transit and protected by row-level security.

**Privacy-first:** No analytics, no tracking, no ads. Your notes are yours.

## Category
Productivity

## Language
English

---

## Permissions Justification

### Host Permissions: `<all_urls>`
**Justification:** Canopy's core functionality is attaching notes to elements on any webpage the user visits. The content script must run on every page to: (1) display note badges on elements that have notes, (2) activate the element inspector overlay for selecting elements, and (3) present notes in presentation mode. Without access to all URLs, notes would only work on a limited set of pre-defined sites, which defeats the purpose of a general-purpose web annotation tool.

### `tabs`
**Justification:** Required to query the active tab for note navigation. When a user clicks a note in the side panel that belongs to a different page, the extension navigates the active tab to that page and scrolls to the noted element.

### `storage`
**Justification:** Stores user notes, tags, folders, and authentication state in Chrome's extension storage API. This is the primary data persistence mechanism for local mode.

### `sidePanel`
**Justification:** The extension provides a side panel interface for browsing and managing all notes across all pages.

### `contextMenus`
**Justification:** Adds an "Add Canopy Note" item to the right-click context menu when text is selected, providing a quick way to create notes from selected text.

### `identity`
**Justification:** Used for Google OAuth sign-in via `chrome.identity.launchWebAuthFlow()`. This enables the optional cloud sync feature where users can sync notes across devices.

---

## Privacy Policy URL
https://canopy.so/#/privacy

## Single Purpose
Web page annotation: attach, organize, and review notes anchored to specific elements on any webpage.

---

## Screenshots Needed
1. **Element inspector** — showing the blue overlay highlighting a page element (1280x800)
2. **Note editor** — inline note editor open on a page with markdown content (1280x800)
3. **Side panel** — side panel showing organized notes with tags and folders (1280x800)
4. **Presentation mode** — clean note display during screen sharing (1280x800)
5. **Popup** — login/dashboard view in the popup (640x400)
