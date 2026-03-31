# Canopy Remaining Fixes Design

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Decompose the remaining Canopy UX and behavior issues into three independently executable implementation tracks: management surfaces, inline editor and page-note anchoring, and auth plus note-navigation stability.

## Overview

Batch 1 fixed the top-level popup and sidepanel shell, but the rest of the user feedback still spans three different systems:

- popup and sidepanel note-management workflows
- content-script placed-note and editor behavior
- authentication and note-navigation reliability

Trying to land all of that as one implementation batch would mix unrelated regressions, make testing noisy, and create avoidable rework. The remaining work should be split into three plans that can each ship working software on their own.

## Goals

- Make popup and sidepanel note-management usable without bouncing users back to the page for basic edit and organization work.
- Make placed notes and the inline editor feel attached to their target element instead of floating and drifting.
- Make Google auth and note navigation resilient on modern SPA pages where selectors alone are not stable enough.
- Eliminate remaining browser prompt and confirm flows from user-facing Canopy surfaces.

## Track Breakdown

### Track 1: Management Surfaces

This track covers popup and sidepanel workspace behavior:

- all-notes grouped by site and collapsible
- remove the misleading second line under grouped site headers
- allow note editing inside popup and sidepanel
- tags should not list notes until one or more tags are actively filtered
- provide clear-filter affordances in popup and sidepanel
- keep folder creation/editing in-app
- improve folder color, subfolder, hover, and reorder UX

This track stays inside the React workspace surfaces and shared workspace state.

### Track 2: Inline Editor And Page-Note Anchoring

This track covers the content-script editor and placed-note overlays:

- hover cards clipping on the page edges
- edit jumping to a disconnected position
- note UI failing to stay attached while the page scrolls
- raw HTML-ish element info visible in edit mode
- remove the title field from the inline editor
- replace the folder expansion UI with a focused selector flow
- allow folder creation while creating or editing a note

This track should extract anchoring and positioning logic from the monolithic content script so overlay movement is testable and maintainable.

### Track 3: Auth And Note-Navigation Stability

This track covers failures that block or misdirect users:

- `Continue with Google` still failing in real extension use
- note navigation using CSS selector only instead of URL plus selector plus XPath plus fallback metadata
- React and SPA pages such as IGN failing to scroll to the correct target
- rename `Scroll to element` to `Go to note`
- remove remaining browser prompt usage still present in content note flows

This track should harden the auth and note-navigation path without waiting for the deeper inline editor redesign.

## Recommended Execution Order

1. **Auth And Note-Navigation Stability**
   Fixes the most blocking failures first: login and note targeting.
2. **Management Surfaces**
   Improves popup and sidepanel usability once navigation and auth are dependable.
3. **Inline Editor And Page-Note Anchoring**
   Lands the deeper content-script redesign after the lower-risk stability work is out of the way.

## Boundaries

- Track 1 owns popup and sidepanel React surfaces plus shared workspace filter and dialog behavior.
- Track 2 owns content-script overlay positioning and inline editor structure.
- Track 3 owns popup auth handoff diagnostics, note-navigation payloads, SPA target resolution, and the remaining browser prompt cleanup that is still outside the React workspace surfaces.

There is one intentional touchpoint between Tracks 2 and 3: Track 3 may need to reuse or lightly extend the content target-resolution helpers that Track 2 also depends on. The plans should keep that dependency explicit instead of hiding it.

## Success Criteria

- Each track has its own implementation plan and test gate.
- No plan assumes hidden context from the others.
- A future execution session can pick any plan and start implementing without re-scoping the entire request.
