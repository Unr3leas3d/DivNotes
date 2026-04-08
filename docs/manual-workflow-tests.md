# Canopy Manual Workflow Tests

Use this file as a living regression checklist. Keep `Status`, `Observed Result`, and `Follow-up` updated as you test.

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

## 1. Onboarding And Authentication

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | First-run popup loads login choices | Extension built and loaded in Chrome | 1. Open the extension popup in a fresh profile.<br>2. Wait for bootstrap to finish. | Popup leaves loading state and shows `Continue with Google`, `Continue with Email`, and `Use Local Only`. | Not Run |  |  |
| AUTH-02 | Local-only entry path | No existing authenticated session | 1. Open popup.<br>2. Choose `Use Local Only`.<br>3. Reopen popup. | User lands in the dashboard, auth state persists, and settings show local mode messaging instead of a signed-in email. | Not Run |  |  |
| AUTH-03 | Google sign-in path from popup | Test Google account available and OAuth redirect configured | 1. Open popup.<br>2. Click `Continue with Google`.<br>3. Complete the browser auth flow.<br>4. Return to popup. | Popup resolves to authenticated dashboard, signed-in email is shown, and auth survives popup reopen. | Not Run |  |  |
| AUTH-04 | Email sign-up then sign-in path | Valid test email available | 1. Open popup.<br>2. Open email auth.<br>3. Create a new account or use an existing one.<br>4. Complete any confirmation needed.<br>5. Sign in. | Popup authenticates successfully and the account state is stored for future popup loads. | Not Run |  |  |
| AUTH-05 | Authenticated logout path | User is signed in | 1. Open popup or side panel settings.<br>2. Click `Log Out`.<br>3. Reopen popup and side panel. | Auth session is cleared, popup returns to login, and side panel no longer shows authenticated workspace content. | Not Run |  |  |
| AUTH-06 | Side panel requires sign-in for cloud usage | User is logged out | 1. Open side panel directly.<br>2. Observe empty state.<br>3. Sign in through popup.<br>4. Return to side panel. | Side panel first prompts the user to sign in through popup, then becomes usable after auth is established. | Not Run |  |  |

## 2. Content Capture And On-Page Note Workflows

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CAP-01 | Start inspector from popup | User is in local or authenticated mode and on a normal web page | 1. Open popup.<br>2. From `This Page`, click add note.<br>3. Select a page element. | Popup closes, inspector activates on the page, target element highlights, and the inline note editor opens anchored to the selected element. | Not Run |  |  |
| CAP-02 | Start inspector from side panel | User is in local or authenticated mode and side panel is open | 1. Open side panel.<br>2. Click the add note action.<br>3. Select a page element. | Inspector activates without requiring popup interaction, and the inline editor opens on the page. | Not Run |  |  |
| CAP-03 | Create note from selected text context menu | Extension installed and a normal page open | 1. Select text on the page.<br>2. Use right-click context menu `Add Canopy Note`.<br>3. Save a note. | Selection-based note creation opens with selected text preserved and saved note appears on the page and in workspace views. | Not Run |  |  |
| CAP-04 | Save note with folder, tags, and pinned state | At least one folder and one tag exist or can be created inline | 1. Create a new note on a page.<br>2. Assign folder, tags, and pin state.<br>3. Save.<br>4. Reopen the note. | Saved note persists all selected metadata and renders consistently in page, popup, and side panel views. | Not Run |  |  |
| CAP-05 | Cancel inspector with keyboard | Inspector is active | 1. Activate inspector.<br>2. Press `Esc` before selecting an element. | Inspector exits cleanly, page overlays disappear, and no draft note is created. | Not Run |  |  |
| CAP-06 | Toggle note visibility on current page | Page has at least one Canopy note | 1. Use the keyboard shortcut for `Toggle all notes on current page`.<br>2. Use it again. | On-page badges and note UI hide, then return, without deleting note data. | Not Run |  |  |
| CAP-07 | Screen Share Mode hides on-page notes | Page has at least one Canopy note and side panel available | 1. Trigger screen share mode with `Cmd/Ctrl+Shift+P`.<br>2. Check the page and side panel banner.<br>3. Trigger it again to turn it off. | Notes are hidden on the page while enabled, the side panel shows status messaging, and normal visibility returns when disabled. | Not Run |  |  |
| CAP-08 | Open saved note target from workspace | At least one saved note exists for another page or another DOM position | 1. From popup or side panel, open a saved note.<br>2. If needed, allow Canopy to switch tabs or open a new one. | Chrome reuses an existing matching tab when possible or opens a new one, then scrolls to the note target on page load. | Not Run |  |  |

## 3. Popup Workspace

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POP-01 | This Page view reflects current tab notes | Current page has at least one note | 1. Open popup on the annotated page.<br>2. Stay on `This Page`.<br>3. Open a note and edit a note from this view. | Only notes for the active page are shown, open-target works, and edit changes persist after save. | Not Run |  |  |
| POP-02 | All Notes view groups by hostname and opens notes | Multiple notes exist across domains | 1. Open popup.<br>2. Switch to `All Notes`.<br>3. Expand or collapse groups as needed.<br>4. Open one note from another site. | Notes are grouped by site, groups behave predictably, and selecting a note navigates to the correct page target. | Not Run |  |  |
| POP-03 | Folders root flow creates a new top-level folder | Popup is open and user has workspace access | 1. Open popup.<br>2. Go to `Folders`.<br>3. Create a folder from the root action.<br>4. Return to the folder list. | New folder is created without browser-native prompts and appears immediately in folder summaries. | Not Run |  |  |
| POP-04 | Folder detail flow shows notes and open-as-tab-group action | At least one folder contains notes | 1. Open popup `Folders`.<br>2. Open a folder detail view.<br>3. Open a note from that folder.<br>4. Trigger the tab-group action if available. | Folder detail view lists that folder’s notes, navigation works, and opening as a tab group succeeds or fails with a visible error state. | Not Run |  |  |
| POP-05 | Tags view supports multi-tag filtering | At least three tags exist across different notes | 1. Open popup `Tags`.<br>2. Select one tag, then add a second tag filter.<br>3. Clear filters. | Notes stay hidden until filters are chosen, multi-tag filtering narrows results correctly, and clear filters resets the view. | Not Run |  |  |
| POP-06 | Settings actions from popup | Popup authenticated or local mode active | 1. Open popup settings.<br>2. Verify note, folder, and tag counts.<br>3. Use `Open Side Panel`.<br>4. Verify external links open correctly. | Settings counts match current data, side panel opens, and external links launch without breaking popup state. | Not Run |  |  |

## 4. Side Panel Workspace

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SIDE-01 | All Notes search and edit flow | Multiple notes exist | 1. Open side panel.<br>2. Stay on `All Notes`.<br>3. Search for a known note.<br>4. Edit it and save. | Search narrows results, edit dialog saves successfully, and updated content persists after refresh. | Not Run |  |  |
| SIDE-02 | Delete note from side panel | At least one note exists | 1. Open side panel `All Notes`.<br>2. Delete a note.<br>3. Refresh the panel or reopen it. | Note is removed from the workspace and from related views without leaving stale UI state. | Not Run |  |  |
| SIDE-03 | Folder management in side panel | Workspace has at least one folder and enough notes to organize | 1. Open `Folders` in side panel.<br>2. Create a subfolder if supported.<br>3. Change folder color.<br>4. Reorder folders via drag and drop. | Folder actions complete without native browser prompts, color changes persist, and reorder updates are reflected after reload. | Not Run |  |  |
| SIDE-04 | Tag browsing and clear-filters flow | Several tags and tagged notes exist | 1. Open `Tags` in side panel.<br>2. Apply one or more tag filters.<br>3. Search within filtered results.<br>4. Clear filters. | Filter chips and filtered result counts behave correctly, and clear filters returns the section to its default state. | Not Run |  |  |
| SIDE-05 | Settings import, export, and clear-all entry points | Side panel open with existing notes | 1. Open side panel settings.<br>2. Export notes.<br>3. Import a known file.<br>4. Open clear-all confirmation, then cancel. | Export downloads a JSON file, import is accepted through the file picker, and clear-all can be dismissed safely without data loss. | Not Run |  |  |
| SIDE-06 | Clear-all destructive path in side panel | Side panel open with non-empty data set | 1. Open settings.<br>2. Click `Clear All Notes`.<br>3. Confirm the action.<br>4. Recheck all primary views. | Notes are removed from storage and all note-driven surfaces update to empty states without crashing. | Not Run |  |  |

## 5. Data Portability: Import And Export

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DATA-01 | Export current workspace to JSON | Workspace contains notes, folders, and tags | 1. Export notes from popup or side panel settings.<br>2. Open the downloaded file. | Downloaded file is valid JSON and contains `version`, `exportedAt`, `notes`, `folders`, and `tags`. | Not Run |  |  |
| DATA-02 | Import previously exported JSON into local mode | Clean local-mode profile or cleared data set | 1. Enter local mode.<br>2. Import a valid export file.<br>3. Check popup and side panel views. | Imported notes, folders, and tags appear across views and remain available after reopening the extension. | Not Run |  |  |
| DATA-03 | Import merge behavior with existing workspace data | Workspace already contains overlapping and non-overlapping data | 1. Export current data.<br>2. Modify workspace with extra notes.<br>3. Import the older file.<br>4. Inspect merged state. | Import merges data without obvious duplication corruption or loss of unrelated existing records. | Not Run |  |  |
| DATA-04 | Import valid JSON while authenticated | Authenticated account with cloud-enabled workspace or test account | 1. Sign in.<br>2. Import a valid export file.<br>3. Refresh popup, side panel, and signed-in session. | Imported data persists in extension storage and any authenticated persistence path completes without visible sync breakage. | Not Run |  |  |
| DATA-05 | Import invalid or malformed JSON | Test file with bad JSON prepared | 1. Trigger import.<br>2. Select malformed file.<br>3. Observe error state and workspace data after failure. | Import fails safely with visible error messaging and does not wipe or partially corrupt existing workspace data. | Not Run |  |  |

## 6. Account, Billing, And Settings Surface

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BILL-01 | Free account settings messaging | Signed-in account without active Pro access | 1. Sign in with a free or inactive billing account.<br>2. Open popup or side panel settings. | Settings show the correct account label, billing status text, and upgrade actions instead of `Manage Billing`. | Not Run |  |  |
| BILL-02 | Pro account settings messaging | Signed-in Pro account | 1. Sign in with a Pro-enabled account.<br>2. Open settings. | Settings show `Pro`, cloud sync messaging, and `Manage Billing` instead of upgrade CTAs. | Not Run |  |  |
| BILL-03 | Upgrade checkout launch | Signed-in free account | 1. Open settings.<br>2. Click `Upgrade Monthly` and `Upgrade Yearly` in separate runs. | Checkout opens successfully in the browser and the extension surface remains stable if the user returns without completing payment. | Not Run |  |  |
| BILL-04 | Billing portal launch for Pro user | Signed-in Pro account | 1. Open settings.<br>2. Click `Manage Billing`. | Billing portal opens successfully and no extension auth state is lost after returning. | Not Run |  |  |

## 7. Obsidian Integration

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OBS-01 | Install and configure plugin prerequisites | Obsidian desktop available and plugin built | 1. Install the Canopy plugin in a test vault.<br>2. Confirm Realtime and `obsidian://canopy-auth` redirect are configured for Supabase.<br>3. Open plugin settings. | Plugin loads without startup errors and settings surface is visible with account, sync, and status sections. | Not Run |  |  |
| OBS-02 | Google sign-in from Obsidian | Obsidian plugin installed and Google test account available | 1. Open Canopy plugin settings.<br>2. Start Google sign-in.<br>3. Complete browser auth and return through the custom protocol. | Plugin stores the session, shows the signed-in email, and begins sync automatically. | Not Run |  |  |
| OBS-03 | Email sign-in from Obsidian | Valid email account available | 1. Open plugin settings.<br>2. Sign in with email and password.<br>3. Reopen settings after login. | Plugin signs in successfully, updates status, and shows signed-in account controls. | Not Run |  |  |
| OBS-04 | Initial sync writes Canopy notes into vault | Authenticated plugin and remote Canopy notes available | 1. Start sync in Obsidian.<br>2. Wait for initial sync to complete.<br>3. Inspect vault folder configured for Canopy. | Plugin creates markdown notes under the configured vault folder, note metadata is present in frontmatter, and sync status becomes connected. | Not Run |  |  |
| OBS-05 | Folder mode switch between mirrored and flat | Authenticated plugin with existing synced notes | 1. Set folder mode to `mirrored` and sync.<br>2. Switch to `flat` and sync again.<br>3. Compare resulting vault structure. | File placement reflects the selected folder mode and note content/frontmatter remain coherent after mode changes. | Not Run |  |  |
| OBS-06 | Obsidian-to-Canopy content update | At least one synced note exists in the vault | 1. Open a synced markdown note in Obsidian.<br>2. Edit note body content only.<br>3. Wait for debounce and sync.<br>4. Verify content in Canopy extension. | Local markdown edits propagate back to Canopy and updated content appears in popup or side panel. | Not Run |  |  |
| OBS-07 | Canopy-to-Obsidian realtime update | Authenticated plugin and extension signed into same account | 1. Edit an existing note in the extension.<br>2. Return to Obsidian.<br>3. Wait for realtime sync. | Matching vault note updates without manual export/import and backlink-managed sections remain intact. | Not Run |  |  |
| OBS-08 | Offline queue and recovery path | Authenticated plugin with a synced note and ability to simulate network loss | 1. Disconnect network or break access temporarily.<br>2. Edit a synced note in Obsidian.<br>3. Confirm plugin moves to offline state.<br>4. Restore network and wait. | Plugin reports offline status, queues the update instead of dropping it, then drains queued changes and returns to connected state after recovery. | Not Run |  |  |
| OBS-09 | Sign out from Obsidian plugin | Plugin currently signed in | 1. Open plugin settings.<br>2. Click `Sign out`.<br>3. Reopen settings and inspect vault behavior. | Plugin signs out, stops sync cleanly, and no new sync activity occurs until the user authenticates again. | Not Run |  |  |

## 8. Cross-Surface Regression Checks

| ID | Workflow | Preconditions | Steps | Expected Result | Status | Observed Result | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| XSURF-01 | Popup, side panel, and page stay in sync after create/edit | Extension active with popup, side panel, and a supported page open | 1. Create a note from the page.<br>2. View it in popup.<br>3. Edit it in side panel.<br>4. Recheck the page badge and popup view. | All three surfaces converge on the same note content and metadata without requiring manual refresh. | Not Run |  |  |
| XSURF-02 | Storage survives extension reopen | At least one note, folder, and tag exist | 1. Close popup and side panel.<br>2. Refresh the browser tab if needed.<br>3. Reopen popup and side panel. | Workspace data reloads correctly and no primary surface is stuck in an invalid loading or empty state. | Not Run |  |  |
| XSURF-03 | Failure paths surface actionable errors without breaking navigation | Prepare at least one forced failure path such as bad import JSON, blocked billing session, or unavailable tab target | 1. Trigger the failure.<br>2. Observe the relevant surface.<br>3. Continue using the extension after the error. | Error messaging is visible, scoped to the failed action, and the user can continue navigating the workspace afterward. | Not Run |  |  |
