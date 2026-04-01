# Security Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all action items from the 2026-03-31 security audit report and prepare for Chrome Web Store submission.

**Architecture:** Seven independent tasks: (1) harden service worker message validation, (2) tighten DOMPurify config, (3) add CSP to manifest and narrow web-accessible resources, (4) verify Supabase RLS, (5) run dependency audit and add Dependabot, (6) create privacy policy page on landing site, (7) write Chrome Web Store listing copy and permissions justification.

**Tech Stack:** Chrome Extension (MV3), plain JS service worker, TypeScript/React, Supabase, Vite

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/background/service-worker.js` | Add URL validation and payload checks |
| Modify | `src/content/index.tsx` | Remove `style` from DOMPurify ALLOWED_ATTR |
| Modify | `public/manifest.json` | Add CSP, narrow web_accessible_resources |
| Create | `supabase/migrations/002_notes_rls_verify.sql` | Ensure notes table has RLS |
| Create | `.github/dependabot.yml` | Automated dependency scanning |
| Create | `landing/src/pages/PrivacyPolicy.tsx` | Privacy policy page |
| Modify | `landing/src/App.tsx` | Add route to privacy policy |
| Create | `docs/chrome-web-store-listing.md` | Store description + permissions justification |

---

### Task 1: Harden Service Worker Message Validation

**Files:**
- Modify: `src/background/service-worker.js:68-136`

This task adds URL validation to the `OPEN_NOTE_TARGET` handler to prevent navigation to `javascript:`, `data:`, `file:`, or other dangerous URL schemes. It also adds basic payload shape checks.

- [ ] **Step 1: Add URL validation helper above the message listener**

At line 66 in `src/background/service-worker.js` (after the `pendingNoteTargets` declaration), add:

```javascript
/**
 * Validate a URL is safe for tab navigation.
 * Only allows http: and https: schemes.
 */
function isSafeUrl(url) {
    if (typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}
```

- [ ] **Step 2: Add payload validation to OPEN_NOTE_TARGET handler**

Replace the current `OPEN_NOTE_TARGET` block (lines 80-136) with:

```javascript
    if (message.type === 'OPEN_NOTE_TARGET') {
        const note = message.note;

        // Validate note payload shape
        if (!note || typeof note !== 'object' || !isSafeUrl(note.url)) {
            sendResponse({ success: false, error: 'Invalid note target' });
            return true;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) {
                sendResponse({ success: false });
                return;
            }

            if (normalizeUrl(tab.url || '') === normalizeUrl(note.url)) {
                // Already on the right page — send directly
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SCROLL_TO_NOTE',
                    selector: note.elementSelector,
                    note: {
                        elementSelector: note.elementSelector,
                        elementXPath: note.elementXPath,
                        elementTextHash: note.elementTextHash,
                        elementPosition: note.elementPosition,
                        elementTag: note.elementTag,
                        url: note.url,
                    },
                });
                sendResponse({ success: true });
                return;
            }

            // Navigate and replay after load
            pendingNoteTargets.set(tab.id, note);
            chrome.tabs.update(tab.id, { url: note.url });

            const onUpdated = (tabId, changeInfo) => {
                if (tabId === tab.id && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(onUpdated);
                    const pending = pendingNoteTargets.get(tabId);
                    if (pending) {
                        pendingNoteTargets.delete(tabId);
                        chrome.tabs.sendMessage(tabId, {
                            type: 'SCROLL_TO_NOTE',
                            selector: pending.elementSelector,
                            note: {
                                elementSelector: pending.elementSelector,
                                elementXPath: pending.elementXPath,
                                elementTextHash: pending.elementTextHash,
                                elementPosition: pending.elementPosition,
                                elementTag: pending.elementTag,
                                url: pending.url,
                            },
                        });
                    }
                }
            };
            chrome.tabs.onUpdated.addListener(onUpdated);
            sendResponse({ success: true });
        });
        return true;
    }
```

- [ ] **Step 3: Build and manually verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

Load the extension in Chrome and test: click a note in the side panel that targets a different page. Verify it still navigates correctly.

- [ ] **Step 4: Commit**

```bash
git add src/background/service-worker.js
git commit -m "security: add URL validation to OPEN_NOTE_TARGET handler

Validates note.url is http/https before navigating tabs to prevent
javascript: or data: URL injection via message payloads."
```

---

### Task 2: Remove `style` from DOMPurify ALLOWED_ATTR

**Files:**
- Modify: `src/content/index.tsx:1194`

The `style` attribute in the DOMPurify allowlist lets note content inject arbitrary CSS, which could be used for visual spoofing (e.g., overlaying fake UI elements). The side panel's `NoteCard.tsx` already excludes `style` — this makes the content script match.

- [ ] **Step 1: Remove `style` from ALLOWED_ATTR in simpleMarkdown**

In `src/content/index.tsx`, line 1194, change:

```typescript
      ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class'],
```

to:

```typescript
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

Manual test: create a note with markdown content, verify it renders correctly in the on-page preview (styles like bold, italic, headings should still work via CSS classes, not inline styles).

- [ ] **Step 3: Commit**

```bash
git add src/content/index.tsx
git commit -m "security: remove style from DOMPurify ALLOWED_ATTR in content script

Prevents CSS injection for visual spoofing. Aligns content script
sanitizer with the side panel NoteCard sanitizer."
```

---

### Task 3: Add CSP to Manifest and Narrow Web-Accessible Resources

**Files:**
- Modify: `public/manifest.json`

Two changes: (1) add an explicit Content Security Policy as defense-in-depth, (2) narrow `web_accessible_resources` to only the files that actually need to be web-accessible.

- [ ] **Step 1: Add content_security_policy to manifest.json**

In `public/manifest.json`, add the following field after the `"background"` block (after line 25):

```json
    "content_security_policy": {
        "extension_pages": "script-src 'self'; object-src 'none'"
    },
```

- [ ] **Step 2: Narrow web_accessible_resources**

The `dist/content/` directory only contains `content.js` (the content script bundle). The `dist/assets/` directory contains the popup/sidepanel JS bundles and a shared CSS file. The content script does not need to load any of these as web-accessible resources — it's injected by the manifest. Only CSS files referenced by the content script need to be web-accessible.

Replace the current `web_accessible_resources` block:

```json
    "web_accessible_resources": [
        {
            "resources": [
                "assets/*.css"
            ],
            "matches": [
                "<all_urls>"
            ]
        }
    ]
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

Load extension in Chrome. Test:
1. Open popup - should render correctly
2. Open side panel - should render correctly
3. Navigate to any page - content script overlay/badges should display with proper styling
4. If any styles are broken, widen the resource pattern (e.g., add `"assets/*"` back)

- [ ] **Step 4: Commit**

```bash
git add public/manifest.json
git commit -m "security: add explicit CSP and narrow web-accessible resources

Adds defense-in-depth CSP for extension pages. Restricts
web_accessible_resources to CSS files only, reducing extension
fingerprinting surface."
```

---

### Task 4: Verify Supabase RLS on Notes Table

**Files:**
- Create: `supabase/migrations/002_notes_rls_verify.sql`

The `001_folders_tags.sql` migration has RLS on folders, tags, and note_tags. The `notes` table was created before these migrations (likely via Supabase UI or an earlier untracked migration). We need to ensure it has RLS enabled. This migration is idempotent — it's safe to run even if RLS is already enabled.

- [ ] **Step 1: Check current RLS status on the notes table**

Run this SQL via the Supabase dashboard (SQL Editor) or `supabase db` CLI:

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'notes';
```

If `relrowsecurity` is `true`, RLS is already enabled. If `false`, proceed to step 2.

- [ ] **Step 2: Create idempotent RLS migration**

Create `supabase/migrations/002_notes_rls_verify.sql`:

```sql
-- Ensure RLS is enabled on the notes table (idempotent)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't already exist
-- Uses DO blocks to check for existing policies before creating
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_user_select'
    ) THEN
        EXECUTE 'CREATE POLICY notes_user_select ON notes FOR SELECT USING (user_id = auth.uid())';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_user_insert'
    ) THEN
        EXECUTE 'CREATE POLICY notes_user_insert ON notes FOR INSERT WITH CHECK (user_id = auth.uid())';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_user_update'
    ) THEN
        EXECUTE 'CREATE POLICY notes_user_update ON notes FOR UPDATE USING (user_id = auth.uid())';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'notes_user_delete'
    ) THEN
        EXECUTE 'CREATE POLICY notes_user_delete ON notes FOR DELETE USING (user_id = auth.uid())';
    END IF;
END $$;
```

- [ ] **Step 3: Apply the migration**

Run via Supabase CLI or dashboard SQL editor. Verify with:

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'notes';
```

Expected: Four policies (SELECT, INSERT, UPDATE, DELETE) each scoped to `user_id = auth.uid()`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_notes_rls_verify.sql
git commit -m "security: add idempotent RLS verification for notes table

Ensures notes table has row-level security enabled with per-user
policies. Safe to run even if RLS is already configured."
```

---

### Task 5: Dependency Audit and Dependabot Setup

**Files:**
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Run npm audit**

Run: `npm audit`

If any vulnerabilities are found, run: `npm audit fix`

If `npm audit fix` cannot resolve issues automatically, evaluate each vulnerability:
- If it's in a devDependency only used at build time, the risk is lower
- If it's in a runtime dependency, update to a patched version manually

- [ ] **Step 2: Create Dependabot configuration**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "npm"
    directory: "/landing"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
```

- [ ] **Step 3: Commit**

```bash
git add .github/dependabot.yml
git commit -m "ci: add Dependabot for automated dependency security alerts

Monitors both the extension and landing page npm dependencies
with weekly checks. Groups minor/patch updates together."
```

---

### Task 6: Create Privacy Policy Page

**Files:**
- Create: `landing/src/pages/PrivacyPolicy.tsx`
- Modify: `landing/src/App.tsx`

The privacy policy must be hosted at a public URL and linked in the Chrome Web Store listing. The landing site is the natural place for it.

- [ ] **Step 1: Create the PrivacyPolicy component**

Create `landing/src/pages/PrivacyPolicy.tsx`:

```tsx
export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Effective date: March 31, 2026</p>

        <div className="prose prose-gray max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">What Canopy Does</h2>
            <p>
              Canopy is a browser extension that lets you attach notes to elements on any webpage.
              It works in two modes: local-only (all data stays on your device) and authenticated
              (data syncs to the cloud via your account).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Data We Collect</h2>
            <h3 className="text-lg font-medium mt-4 mb-2">Local Mode (no account)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your notes and their content</li>
              <li>The URLs and element selectors where notes are attached</li>
              <li>Tags and folders you create</li>
            </ul>
            <p className="mt-2">
              All of this data is stored exclusively in your browser using Chrome's local
              storage API. It never leaves your device. We cannot access it.
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">Authenticated Mode (cloud sync)</h3>
            <p>When you sign in with Google, we additionally collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your email address (for account identification)</li>
              <li>Your notes, tags, and folders are synced to our cloud database</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">How We Store Your Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Local storage:</strong> Chrome's extension storage API, sandboxed to the
                extension and inaccessible to websites or other extensions.
              </li>
              <li>
                <strong>Cloud storage:</strong> Supabase (hosted on AWS), secured with row-level
                security policies that ensure you can only access your own data.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Third-Party Services</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Supabase</strong> — database and authentication.{' '}
                <a href="https://supabase.com/privacy" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                  Supabase Privacy Policy
                </a>
              </li>
              <li>
                <strong>Google OAuth</strong> — sign-in only. We request your email address and
                profile name. We do not access your Google Drive, Gmail, or any other Google
                service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Permissions Explained</h2>
            <p>
              Canopy requests access to all websites (<code>&lt;all_urls&gt;</code>) because notes
              can be attached to any webpage. The extension needs to read page structure to
              identify elements and display note badges. It does not read, collect, or transmit
              page content beyond the CSS selectors and XPaths needed to re-attach notes to
              elements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Data Retention and Deletion</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Local data:</strong> Deleted when you uninstall the extension or clear
                extension data in Chrome settings.
              </li>
              <li>
                <strong>Cloud data:</strong> You can delete individual notes, tags, and folders at
                any time. To delete all data and your account, contact us at the email below.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Analytics and Tracking</h2>
            <p>
              Canopy does not include any analytics, telemetry, or tracking. We do not use
              cookies. We do not sell or share your data with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Changes to This Policy</h2>
            <p>
              If we make material changes to this policy, we will update the effective date at the
              top and notify users through the extension or our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">Contact</h2>
            <p>
              Questions about this policy? Email us at{' '}
              <a href="mailto:privacy@canopy.so" className="text-blue-600 underline">
                privacy@canopy.so
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

The landing page currently uses hash-based section navigation. We need to add a simple URL-based route for the privacy policy. Since the landing site doesn't use React Router, we'll use a minimal hash route.

In `landing/src/App.tsx`, add the import at the top:

```tsx
import PrivacyPolicy from './pages/PrivacyPolicy';
```

Then wrap the existing return in a conditional. Find the main `return (` statement in the `App` component and change it to:

```tsx
  if (window.location.hash === '#/privacy') {
    return <PrivacyPolicy />;
  }

  return (
    // ... existing JSX unchanged
```

- [ ] **Step 3: Create the pages directory**

Run: `mkdir -p landing/src/pages`

- [ ] **Step 4: Build and verify**

Run (from the landing directory):
```bash
cd landing && npm run build
```
Expected: Build succeeds.

Run: `cd landing && npm run dev`
Navigate to `http://localhost:5173/#/privacy` — privacy policy page should render.

- [ ] **Step 5: Commit**

```bash
git add landing/src/pages/PrivacyPolicy.tsx landing/src/App.tsx
git commit -m "feat: add privacy policy page to landing site

Required for Chrome Web Store submission. Covers data collection,
storage, third-party services, permissions justification, and
data deletion."
```

---

### Task 7: Chrome Web Store Listing Copy and Permissions Justification

**Files:**
- Create: `docs/chrome-web-store-listing.md`

This document serves as the source of truth for all Chrome Web Store submission fields. Copy from this document when filling out the Chrome Developer Dashboard.

- [ ] **Step 1: Create the listing document**

Create `docs/chrome-web-store-listing.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/chrome-web-store-listing.md
git commit -m "docs: add Chrome Web Store listing copy and permissions justification

Includes detailed description, permissions justifications for
<all_urls>/tabs/identity, privacy policy URL, and screenshot list."
```

---

## Summary of Tasks

| Task | Finding(s) Addressed | Severity | Files Changed |
|------|---------------------|----------|---------------|
| 1 | #3 Message validation | MEDIUM | `service-worker.js` |
| 2 | #2 DOMPurify style attr | LOW | `content/index.tsx` |
| 3 | #5 Missing CSP, #6 Web resources | LOW | `manifest.json` |
| 4 | #1 Supabase RLS verification | INFO | `002_notes_rls_verify.sql` |
| 5 | #9 Dependency security | LOW | `.github/dependabot.yml` |
| 6 | CWS Privacy policy | REQUIRED | `landing/src/pages/PrivacyPolicy.tsx`, `landing/src/App.tsx` |
| 7 | CWS Listing + permissions | REQUIRED | `docs/chrome-web-store-listing.md` |

**Remaining manual actions (not automatable):**
- Capture 4-5 screenshots for the store listing
- Deploy the landing site with the privacy policy page
- Submit to Chrome Web Store via Developer Dashboard
- Test full install flow in a clean Chrome profile
