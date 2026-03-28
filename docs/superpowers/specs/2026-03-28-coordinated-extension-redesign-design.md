# Coordinated Extension Redesign Design

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Popup tabs, popup settings, side panel, content element selector, placed-note states, and content inline editor redesign

## Overview

Redesign the main extension surfaces as one coordinated Eden.so-inspired system instead of a set of loosely related screens. The redesign covers:

- Popup logged-in views: `This Page`, `All Notes`, `Folders`, `Tags`
- Popup settings view
- Side panel top-level views and header actions
- Content-script element selector and placed-note overlay states
- Content-script inline note editor

The popup remains lightweight. Note creation and editing continue to happen primarily through the page inspector and inline editor, with the side panel acting as the richer workspace. The redesign should implement the missing UI flows implied by the attached references, not just restyle the current screens.

## Reference Assets

Use these references as the visual targets for planning and implementation:

- Popup — This Page: `/Users/ayubmohamed/Desktop/Screenshot 2026-03-28 at 12.57.12 PM.png`
- Popup — All Notes: `/Users/ayubmohamed/Desktop/Screenshot 2026-03-28 at 12.57.18 PM.png`
- Popup — Folders: `/Users/ayubmohamed/Desktop/Screenshot 2026-03-28 at 12.57.27 PM.png`
- Popup — Tags: `/Users/ayubmohamed/Desktop/Screenshot 2026-03-28 at 12.57.34 PM.png`
- Side Panel — Notes List: `/Users/ayubmohamed/Desktop/Screenshot 2026-03-28 at 12.57.47 PM.png`
- Popup — Settings: `/Users/ayubmohamed/Desktop/Screenshot 2026-03-28 at 12.57.57 PM.png`
- Content — Inline Editor: attached thread image labeled `Content — Inline Editor`
- Approved browser mockups:
  - `.superpowers/brainstorm/83652-1774716907/05-final-direction-mockups.html`
  - `.superpowers/brainstorm/83652-1774716907/06-pill-nav-revision.html`
  - `.superpowers/brainstorm/83652-1774716907/07-folder-tag-mockups.html`
  - `.superpowers/brainstorm/83652-1774716907/08-element-selector.html`
  - `.superpowers/brainstorm/83652-1774716907/09-note-placed-state.html`

## Goals

- Match the attached references more faithfully across all logged-in surfaces
- Use Eden.so as the visual direction: warm off-white surfaces, restrained borders, forest-green accents, calm typography, soft card shadows, and generous spacing
- Unify popup and side panel behavior through a shared view model and shared presentational components
- Keep the popup fast and lightweight while moving deeper editing into the side panel and inline editor
- Replace the current inline editor with a simpler, cleaner edit surface closer to the provided design

## Out of Scope

- New backend or sync architecture
- Full app routing framework or external state-management library
- Full markdown authoring overhaul beyond what is needed for the new inline editor
- New collaboration, sharing, billing, or account-plan functionality
- Unrelated content-script or landing-page redesign work

## Visual System

The redesign continues the existing Eden Bright token foundation already present in the repo, but applies it more systematically.

### Core Visual Direction

- Backgrounds: warm cream / off-white
- Primary action color: deep forest green
- Accent color: mint green used sparingly for active dots, pinned state, and small emphasis
- Surfaces: white or near-white cards with very light borders and subtle depth
- Typography:
  - serif for product name and selective display headings
  - system sans-serif for controls, labels, metadata, and body copy
- Corners:
  - 12px buttons and pill controls
  - 14px to 18px cards and editor shell

### Density Rules

- Popup is compact and decision-oriented
- Side panel is roomier and content-oriented
- Inline editor is focused and distraction-free
- Settings is sparse, sectioned, and utility-first

## Architecture

The redesign moves from ad hoc screen ownership to a coordinated UI architecture with shared state and shared view concepts.

### Shared UI Model

Create a shared controller/view-model layer that exposes:

- auth/session state
- active navigation state
- notes, folders, and tags data
- current-tab context
- loading and error states
- derived selectors for:
  - current-page notes
  - grouped all-notes listings
  - folder tree structures
  - tag-filtered note lists
  - per-view counts and badges

Popup and side panel both consume this layer. The popup renders the compact version of each view, while the side panel renders the expanded version.

### Shell Split

- **Popup shell:** compact frame with branded header, action buttons, tab row, and a single routed view region
- **Side panel shell:** same view keys and shared data model, but with a richer header and more content depth
- **Content editor module:** split away from the current monolithic content-script editor logic so the inspector/badge mechanics and the editor surface are not tangled together

### View Keys

Standardize top-level extension view state to:

- `this-page`
- `all-notes`
- `folders`
- `tags`
- `settings`

Popup and side panel should use the same view identifiers even if the layouts differ.

### Relationship to Earlier Sidebar Spec

This spec supersedes the top-level side-panel information architecture from [docs/superpowers/specs/2026-03-25-sidebar-folders-tags-design.md](/Users/ayubmohamed/Vibe%20Coding%20Projects/DivNotes/docs/superpowers/specs/2026-03-25-sidebar-folders-tags-design.md), which used `Sites`, `Folders`, and `Tags` as the side-panel root views.

For this redesign:

- the old top-level `Sites` view is replaced by two top-level views: `This Page` and `All Notes`
- the earlier folder/tree power-user behaviors remain in scope where they still fit the new design, including:
  - folder hierarchies
  - drag-and-drop
  - multi-select
  - keyboard/tree interactions
  - context menus
- if a previous side-panel behavior conflicts directly with the attached 2026-03-28 references, the attached references win

## Popup Design

### Popup Header

The popup header should match the attached references:

- small Canopy mark on the left
- serif `Canopy` wordmark
- right-side utility actions that change by view:
  - search where appropriate
  - settings entry
  - inspector or quick workspace action when relevant

The old single-screen dashboard layout should be removed in favor of a proper shell with per-view rendering.

### Popup Navigation

The top navigation becomes a 4-tab pill group:

- `This Page`
- `All Notes`
- `Folders`
- `Tags`

Navigation styling must match the screenshots closely:

- one shared muted container behind all four tabs
- a single dark active pill inside that shared container
- inactive tabs render as labels inside the same container, not as independent pills
- popup and side panel use the same treatment; only the width changes
- spacing, radius, and active-state contrast should stay close to the screenshots instead of being loosely “inspired by” them

### Popup: This Page

Purpose: current active-tab summary and fast add flow.

Elements:

- current page / domain context row
- note count for the current page
- compact note cards matching the reference:
  - title
  - short preview
  - tags
  - timestamp
  - optional pinned indicator
- full-width `+ Add Note` button at the bottom

Behavior:

- `+ Add Note` starts the add-note flow defined in `Shared Interaction Model > Add Note Flow`
- clicking a note should navigate or reveal its target behavior using existing note navigation logic
- if the current page cannot be read, show a calm unavailable state instead of breaking the popup

### Popup: All Notes

Purpose: cross-site overview in compact form.

Elements:

- same header and tab shell
- search input
- notes grouped by hostname/domain
- compact list rows with note title, preview, and relative timestamp

Behavior:

- filter notes live as search changes
- use shared grouped selectors so popup and side panel behavior stay aligned

### Popup: Folders

Purpose: compact folder index.

Elements:

- folder cards with gradient or tinted folder icon block
- folder name
- note count and last-updated metadata
- chevron affordance
- `New Folder` dashed card/button

Behavior:

- clicking a folder opens a compact folder-detail state inside the popup shell
- detail state can be simpler than the side panel but must still feel intentionally designed
- folder-detail state uses back navigation to return to the popup folder index
- folder-detail content shows:
  - folder name
  - note count
  - notes belonging to that folder in compact popup-card form

### Popup: Tags

Purpose: quick filtering by tag.

Elements:

- selectable tag chips with note counts
- active chip state in dark green
- filtered note list below

Behavior:

- selecting a tag filters visible notes in-place
- tag chips and filtered notes use shared selector logic with the side panel

### Popup: Settings

Settings becomes a dedicated popup view with back navigation, matching the supplied screenshot.

Sections:

- **Account**
  - signed-in email or local-mode label
  - account status text
  - sign-out action
- **Data**
  - export notes
  - import notes
  - clear all notes
- **About**
  - version
  - Chrome Web Store link
  - Privacy Policy link

Behavior:

- avoid browser-alert feeling where possible
- show lightweight inline feedback for success/failure states

## Side Panel Design

The side panel uses the same top-level views as the popup but is the richer reading and browsing workspace.

### Side Panel Header

Header actions should align to the reference and expose real flows:

- inspector toggle
- open popup
- settings

The existing export-only header action is insufficient for the redesign target.

### Side Panel Views

The side panel should mirror:

- `This Page`
- `All Notes`
- `Folders`
- `Tags`
- `Settings`

Differences from popup:

- denser and taller card layouts
- room for fuller note previews
- note actions such as “scroll to element”
- stronger workspace behavior instead of a compact summary

### Side Panel Navigation

The side panel uses the same top navigation treatment as the popup:

- one muted pill-group container
- one active dark pill
- inactive labels inside the shared container
- same tab order: `This Page`, `All Notes`, `Folders`, `Tags`

### Side Panel Notes Presentation

Side panel note cards should support:

- clearer note title
- preview text with more vertical room
- tags
- pinned marker
- timestamp
- “scroll to element” or equivalent target affordance

They should feel visually related to popup cards, not like a separate product.

## Content Overlay Design

### Element Selector

The selector overlay begins after the popup or side panel dispatches inspector activation.

Hover state:

- hovered element gets a crisp green outline
- very light mint surface wash over the element
- dark selector pill sits just above the target element
- selector pill shows:
  - element tag
  - compact selector path in monospace
- bottom-center guidance pill reads:
  `Click to add a note · ESC to cancel`

Selected state:

- selected element keeps the outline and intensifies the mint wash slightly
- bottom-center pill changes to a confirmation transition state such as:
  `Element selected · Opening note editor…`

Tone:

- the selector should feel precise and calm, not loud or game-like
- bottom-center guidance replaces the current top-right status banner style

### Placed Note State

After a note has been attached to an element, the resting page state should be visually quiet but still discoverable.

Resting state:

- compact dark note badge anchored near the element corner
- badge remains approximately the current 22px treatment but aligned to the refined visual system
- subtle green accent stripe or edge marker remains on the element to indicate attached note presence
- page-level note count appears as a dark bottom-right pill, not a loud floating toolbar

Expanded note preview:

- warm card surface with subtle border and elevated shadow
- compact selector metadata at the top
- note title, content preview, tags, and lightweight actions
- edit/delete affordances remain available from the expanded state
- visual language should feel like a continuation of the inline editor and inspector

### Inline Editor Design

The inline editor should be reworked to follow the supplied `Content — Inline Editor` reference.

### Editor Shell

- soft warm background overlay context
- white or near-white rounded editor panel
- subtle border and elevated shadow
- clean header with title on the left and delete / close actions on the right

### Editor Fields

Elements:

- title input
- larger note body textarea
- folder chip / control
- tag chips
- `+ tag` affordance
- pinned row
- save button

### Behavior

- popup and side panel `+ Add Note` actions do not open a form inside those shells; they start the add-note flow that ends in this inline creation flow after element selection
- save disabled until there is meaningful content
- delete only shown for existing notes
- saving updates shared storage/services so popup and side panel refresh through existing listeners
- editor stays open on failure and shows a small inline error
- ESC and close dismiss without leaving stale selection state behind

### Simplification Rule

The old write/preview tabs and markdown mini-toolbar are not part of this redesign target by default. The reference is simpler and the popup is intentionally lightweight, so the editor should prioritize clean direct editing over extra authoring chrome unless implementation reveals a hard dependency.

## Shared Interaction Model

- popup and side panel use shared derived selectors for note/folder/tag organization
- note creation/editing remains centered on inspector + inline editor
- side panel is the deeper workspace for browsing and acting on notes
- popup remains lightweight and quick
- settings exists as a first-class view, not a utility panel embedded in the dashboard

### Add Note Flow

The add-note transition must be implemented consistently across popup and side panel:

1. User clicks `+ Add Note` in the popup or side panel.
2. The shell sends the existing inspector activation message: `chrome.runtime.sendMessage({ type: 'ACTIVATE_INSPECTOR' })`.
3. Popup closes immediately after dispatching inspector activation.
4. Side panel stays open, but it does not render a create form of its own.
5. User selects an element on the page.
6. The content script opens the redesigned inline editor anchored to that selected element.
7. On save:
   - the note is persisted through the existing storage/service path
   - badges/highlights update on the page
   - popup and side panel refresh through storage listeners/shared state
8. On cancel or `Escape`:
   - the inline editor closes
   - selected/highlighted element state is cleared
   - no note is created

## Error Handling

### Popup and Side Panel

- lightweight loading state per shell
- per-view empty states aligned to the design language
- gentle fallback for missing current-tab context
- inline action feedback where possible

### Inline Editor

- disabled save until content exists
- inline error message on save failure
- clean close and escape handling
- no silent dismissal on failed actions

## Testing Requirements

Add or expand regression coverage for:

- popup shell and per-view routing markers
- popup settings screen markers
- side panel shell and header-action markers
- inline editor shell markers in content-script code
- shared selectors/helpers for:
  - current-page notes
  - grouped all-notes views
  - folders
  - tags

Verification must include:

- targeted regression tests for popup, side panel, and content surfaces
- full extension build via `npm run build`
- manual verification of:
  - local mode
  - authenticated mode
  - popup `+ Add Note` -> inspector -> inline editor
  - side panel navigation
  - settings actions
  - cross-surface refresh after save/delete/pin/tag/folder updates

## Implementation Notes

- This is intentionally a deeper UI refactor, not just a restyle
- Shared architecture should be introduced only as far as needed to make the redesign coherent
- Keep storage keys and service interfaces stable unless a concrete blocker appears
- Stay focused on the referenced surfaces and their direct follow-on states instead of drifting into a full product rewrite
