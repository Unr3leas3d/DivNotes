# Canopy Shell And Login Design

**Date:** 2026-03-29
**Status:** Approved
**Scope:** Batch 1 of the reported Canopy improvements: Google login flow, popup login copy/layout, popup sticky header behavior, sidepanel shell behavior, and shell-level view boundaries

## Overview

This spec covers the first implementation batch from the latest user feedback. The goal is to fix the broken Google sign-in path and tighten the top-level popup and sidepanel shells before moving on to note-management, folder, tag, and content-script issues.

This batch keeps the existing shared workspace model and Eden-inspired visual system, but corrects the extension-level behaviors that currently make the popup and sidepanel feel unstable:

- `Continue with Google` does not complete reliably
- popup header content scrolls with the page instead of staying fixed
- sidepanel still exposes `This Page` even though it should act as the note-management surface
- sidepanel content stretches poorly when the panel is widened
- popup login copy and hierarchy do not match the validated direction

## Goals

- Replace the current popup-contained Google OAuth attempt with an extension-native browser auth handoff that completes reliably
- Keep the popup as the post-login landing surface and return authenticated users to `This Page`
- Make popup and sidepanel headers sticky while the content region below them scrolls independently
- Keep `This Page` as a popup-only root view
- Reduce the sidepanel root navigation to `All Notes`, `Folders`, and `Tags`
- Preserve a compact, icon-driven popup header with a sidepanel launcher and settings action
- Keep `Add note` as a primary sidepanel header action
- Constrain widened sidepanel layouts to a centered fixed-width content column
- Remove browser dialogs from login and shell-level flows in this batch

## Out Of Scope

- Grouped all-notes behavior changes
- In-app note editing in popup or sidepanel
- Folder creation, recoloring, subfolder, and reorder redesign
- Tag filtering redesign
- Scroll-to-note targeting fixes
- Content-script placed-note and inline-editor redesign beyond anything strictly required by the auth/shell work
- Backend schema changes unrelated to session establishment

## Approved Product Decisions

- Recommended Google auth UX: open the Google flow in a real browser auth surface and return control to the extension automatically
- Successful Google sign-in lands the user back in the popup on `This Page`
- Popup keeps `This Page`, `All Notes`, `Folders`, and `Tags` as root views
- Sidepanel removes `This Page` and keeps only `All Notes`, `Folders`, and `Tags` as root views
- Popup header uses balanced icon utilities rather than a labeled `Open Sidebar` CTA
- Sidepanel keeps `Add note` as a primary header action
- Widened sidepanel layouts use a centered fixed-width content column
- Login keeps Google as the primary action, with Email and Local Only visible as secondary options on the first screen

## Existing Context

The extension already has:

- a shared `useExtensionWorkspace()` hook for auth, data, and view state
- popup and sidepanel shells with similar Eden-style branding
- a Chrome-storage-backed Supabase client
- service-worker actions for opening the sidepanel, popup, and page inspector

The current Google sign-in implementation calls `supabase.auth.signInWithOAuth()` directly from the popup with a `chrome.identity.getRedirectURL()` redirect, but it still relies on the popup staying alive through the OAuth launch. That makes the sign-in path brittle in extension UX terms and is the main bug to resolve in this batch.

## Architecture

This batch should keep the shared workspace model but tighten shell-specific boundaries.

### Shared Workspace Model

`useExtensionWorkspace()` remains the single source of truth for:

- auth/session state
- current page state
- notes, folders, and tags data
- shell action errors
- active view state

The hook needs shell-aware root view guards:

- popup allowed root views: `this-page`, `all-notes`, `folders`, `tags`, `settings`
- sidepanel allowed root views: `all-notes`, `folders`, `tags`, `settings`

The sidepanel must not route back into `this-page` through default state, segmented-control options, or any shared helper that assumes both shells expose the same root views.

### Shell Structure

Popup and sidepanel should keep separate shell components, but both should follow the same structural rules:

- header region is sticky
- header stays visible while content scrolls below it
- shell-level errors render inline inside the app chrome
- navigation lives in the header region
- the scroll container is the body beneath the header, not the entire shell

This keeps the current component split but makes the visible behavior consistent.

## Google Auth Flow

Google auth should be rebuilt as an extension-native browser handoff rather than a popup-contained flow.

### Desired Flow

1. User clicks `Continue with Google` in the popup login screen.
2. Canopy starts an auth handshake built for Chrome extensions.
3. The Google sign-in flow opens in a real browser auth surface instead of trying to complete inside the popup.
4. The callback is exchanged into a Supabase session that is persisted through the existing Chrome storage adapter.
5. Popup auth state rehydrates automatically and lands the user on the logged-in popup experience.
6. The first logged-in popup view is `This Page`.
7. Sidepanel and other extension surfaces pick up the same stored session through the existing shared auth hydration path.

### UX Rules

- Disable duplicate login clicks while the Google flow is in progress.
- If the auth flow is cancelled or fails, remain on the login screen and show one inline error.
- Do not use browser `alert`, `prompt`, or `confirm`.
- Do not require the user to manually reopen or refresh the popup after a successful sign-in.

### Implementation Direction

Use Chrome extension auth primitives for the handoff and treat Supabase as the session destination, not as the popup’s in-place OAuth controller. The exact implementation can use `chrome.identity.launchWebAuthFlow` with a Supabase-compatible redirect/callback exchange, but the important architectural requirement is that the browser auth flow survives popup closure and writes back to the same Supabase session store the app already reads.

If Chrome identity permissions are required in the manifest, they are in scope for this batch.

## Popup Login Screen

The logged-out popup remains a single-screen auth choice surface.

### Content Changes

- Keep `Think on top of the web.` centered.
- Increase it by one size step relative to the current implementation.
- Increase the weight so it reads as the primary headline.
- Remove the `Sign in to sync across devices` sentence.
- Keep the existing calm legal footer treatment unless implementation constraints require light cleanup.

### Action Hierarchy

- Primary: `Continue with Google`
- Secondary visible options:
  - `Continue with Email`
  - `Use Local Only`

The first screen should not hide email or local-only mode behind a second step.

## Popup Shell

The popup remains the quick-entry surface and the home of `This Page`.

### Root Views

- `This Page`
- `All Notes`
- `Folders`
- `Tags`
- `Settings`

### Header Behavior

The popup header should be sticky and contain:

- Canopy mark
- Canopy wordmark
- more prominent centered tagline treatment
- utility icons on the right:
  - open sidepanel
  - open settings
- tab pills beneath the top row

The approved utility pattern is compact icon buttons, not a labeled sidebar CTA.

### Scroll Behavior

The area below the header is the only scrollable region. Header movement during content scroll is a bug in this batch.

## Sidepanel Shell

The sidepanel becomes the note-management surface rather than a page-summary surface.

### Root Views

- `All Notes`
- `Folders`
- `Tags`
- `Settings`

`This Page` is removed from sidepanel root navigation, default state, and any empty/auth states that currently refer to it as a first-class sidepanel view.

### Header Behavior

The sidepanel header remains sticky and management-oriented:

- primary header action: `Add note`
- secondary utility action: settings
- no `Open popup` action in the header
- search only on views that need it
- top navigation remains in the header region

### Layout Constraint

When the sidepanel is widened, the content should sit inside a centered fixed-width column. The goal is to prevent note cards, trees, filters, and forms from stretching across the full panel width.

The header can span the panel, but the main working surface should feel anchored and readable.

## Error Handling

Shell-level failures in this batch should be surfaced inline in the popup or sidepanel UI.

This includes:

- Google auth start/failure/cancel states
- popup/sidepanel launch failures from shell actions
- auth hydration failures that affect entry experience

No login or shell behavior in this batch should rely on browser dialogs.

## Testing Expectations

Implementation planning for this spec should include:

- auth-flow tests for successful Google sign-in, cancellation, and failure handling
- popup shell tests validating sticky-header / scroll-container structure
- sidepanel navigation tests confirming `This Page` is no longer an available root view
- layout regression checks for widened sidepanel rendering
- login-screen rendering checks for updated headline hierarchy and removed sync copy

Where automated UI verification is limited by the current repo setup, the plan should still specify targeted regression coverage and manual extension verification steps in Chrome.
