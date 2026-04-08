# Canopy Manual Smoke Tests

Use this file for fast pre-release checks. It is intentionally smaller than the full workflow plan and focuses on the highest-risk user paths across auth, capture, workspace navigation, portability, and Obsidian sync.

For broader coverage, use [manual-workflow-tests.md](/Users/ayubmohamed/Vibe%20Coding%20Projects/DivNotes/docs/manual-workflow-tests.md).

## Test Environment

| Field | Value |
| --- | --- |
| Test date |  |
| Tester |  |
| App build / commit |  |
| Chrome version |  |
| OS |  |
| Supabase project / environment |  |
| Obsidian version |  |
| Obsidian vault used |  |
| Notes |  |

Status suggestions: `Not Run`, `Pass`, `Fail`, `Blocked`, `Needs Retest`.

## 1. Auth And First-Use Smoke

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SMOKE-AUTH-01 | Popup first-run login surface | Extension built and loaded in Chrome | 1. Open popup in a clean browser profile.<br>2. Wait for bootstrap. | Popup leaves loading state and shows Google, Email, and Local-only entry options. | Not Run |  |  |
| SMOKE-AUTH-02 | Local-only dashboard entry | No active session | 1. Open popup.<br>2. Choose `Use Local Only`.<br>3. Reopen popup. | User reaches the dashboard and the local-mode state persists across popup reopen. | Not Run |  |  |
| SMOKE-AUTH-03 | Authenticated sign-in and sign-out | Test account available | 1. Sign in with Google or email from popup.<br>2. Confirm dashboard loads.<br>3. Sign out from settings.<br>4. Reopen popup. | Authenticated state is established, then fully cleared on logout. | Not Run |  |  |

## 2. Core Capture And Retrieval Smoke

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SMOKE-CAP-01 | Create a note from popup inspector | User is in local or authenticated mode on a standard web page | 1. Open popup on a page.<br>2. Start add-note flow.<br>3. Select an element.<br>4. Save note content. | Inline editor opens on the page and saved note appears on-page plus in popup views. | Not Run |  |  |
| SMOKE-CAP-02 | Open note target from workspace | At least one saved note exists | 1. Open popup or side panel.<br>2. Open a saved note target. | Chrome navigates to the correct page context and scrolls to the note target. | Not Run |  |  |
| SMOKE-CAP-03 | Toggle notes and screen share mode | Page has at least one saved note | 1. Toggle notes visibility with shortcut.<br>2. Toggle back on.<br>3. Enable screen share mode.<br>4. Disable it. | Note visibility responds correctly and screen share mode hides page notes without deleting data. | Not Run |  |  |

## 3. Popup And Side Panel Workspace Smoke

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SMOKE-WS-01 | Popup `This Page` and `All Notes` basic navigation | Multiple notes exist across at least one page | 1. Open popup.<br>2. Verify `This Page` on current tab.<br>3. Switch to `All Notes`.<br>4. Open or edit a note. | Popup navigation works, notes are visible in the expected view, and edit/open actions succeed. | Not Run |  |  |
| SMOKE-WS-02 | Side panel all-notes search and edit | Side panel available and notes exist | 1. Open side panel.<br>2. Search for a known note.<br>3. Edit it and save. | Search narrows results and edits persist in the side panel after save. | Not Run |  |  |
| SMOKE-WS-03 | Folder and tag filter essentials | Workspace has folders and tags | 1. In popup or side panel, open folders and verify a folder detail view.<br>2. Open tags and apply at least one filter.<br>3. Clear filters. | Folder detail opens correctly and tag filtering/clearing behaves without stale state. | Not Run |  |  |

## 4. Data Portability Smoke

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SMOKE-DATA-01 | Export notes to JSON | Workspace contains notes, folders, and tags | 1. Export notes from settings.<br>2. Inspect the downloaded file. | Export succeeds and JSON contains top-level workspace payload fields. | Not Run |  |  |
| SMOKE-DATA-02 | Import valid JSON into a test workspace | Valid Canopy export file available | 1. Import the file from settings.<br>2. Reopen popup or side panel. | Imported notes, folders, and tags appear and remain available after reload. | Not Run |  |  |
| SMOKE-DATA-03 | Malformed import fails safely | Invalid JSON file available | 1. Trigger import.<br>2. Select malformed file.<br>3. Recheck existing workspace data. | Import surfaces an error and does not corrupt or wipe existing workspace data. | Not Run |  |  |

## 5. Billing And Settings Smoke

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SMOKE-BILL-01 | Settings account state reflects plan | Signed-in test account available | 1. Open popup or side panel settings.<br>2. Check account label, billing text, and actions. | Settings match the current account state and show the expected upgrade or manage-billing controls. | Not Run |  |  |
| SMOKE-BILL-02 | Open side panel and external links from settings | Popup dashboard available | 1. Open popup settings.<br>2. Use `Open Side Panel`.<br>3. Open a settings external link. | Side panel opens correctly and external links launch without breaking popup state. | Not Run |  |  |

## 6. Obsidian Sync Smoke

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SMOKE-OBS-01 | Plugin install and sign-in | Obsidian desktop, plugin build, and configured Supabase redirect available | 1. Install plugin into a test vault.<br>2. Open plugin settings.<br>3. Sign in with Google or email. | Plugin loads, signs in, and shows account plus sync status controls. | Not Run |  |  |
| SMOKE-OBS-02 | Initial sync creates markdown notes | Signed-in plugin and remote Canopy notes available | 1. Start or wait for sync.<br>2. Inspect the configured Canopy vault folder. | Synced notes are written into the vault and sync status reaches connected. | Not Run |  |  |
| SMOKE-OBS-03 | Round-trip content update | Same account signed into extension and Obsidian plugin | 1. Edit a synced note in Obsidian and verify it in the extension.<br>2. Edit a synced note in the extension and verify it in Obsidian. | Basic two-way sync works in both directions without manual export/import. | Not Run |  |  |

## 7. Cross-Surface Final Check

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SMOKE-X-01 | Create in one surface, edit in another, verify everywhere | Popup, side panel, page, and optionally Obsidian available | 1. Create a note from the page or popup.<br>2. Edit it in side panel.<br>3. Reopen it on the page.<br>4. If using Obsidian, confirm the synced file. | Core surfaces converge on the same note content and metadata without manual cleanup. | Not Run |  |  |
