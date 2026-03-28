# DivNotes Full Visual Redesign — Eden Bright

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Complete visual overhaul of all extension UI + landing page

## Overview

Full redesign of DivNotes using a design system inspired by Eden.so, adapted into a brighter, light-first variant ("Eden Bright"). Replaces the current purple-dominant dark theme with a warm off-white background, forest green accents, and serif/sans-serif typography pairing.

## Design System Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#FAFAF7` (warm off-white) | App background, page background |
| `--surface` | `#FFFFFF` | Cards, inputs, modals |
| `--primary` | `#052415` (forest green) | Headings, primary buttons, active tabs, logo mark |
| `--primary-light` | `#1a5c2e` | Hover states, links, secondary accents |
| `--primary-mid` | `#6ead71` | Tertiary accents, gradient endpoints |
| `--accent` | `#ABFFC0` (mint) | Badges, status dots, pinned indicators, brand highlight |
| `--accent-subtle` | `rgba(171,255,192,0.15)` | Icon backgrounds, feature cards |
| `--muted` | `rgba(5,36,21,0.04)` | Inactive tab backgrounds, tag backgrounds |
| `--text-primary` | `#052415` | Headings, labels, card titles |
| `--text-secondary` | `#7a8a7d` (sage) | Body text, descriptions, timestamps |
| `--text-tertiary` | `#4a5a4d` | Tags, metadata |
| `--text-on-primary` | `#F5EFE9` (warm cream) | Text on dark green backgrounds (buttons, active tabs, badges) |
| `--border` | `rgba(5,36,21,0.06)` | Card borders, dividers, section separators |
| `--border-strong` | `rgba(5,36,21,0.1)` | Input borders, form field borders |
| `--shadow-card` | `0 2px 8px rgba(5,36,21,0.04)` | Note cards, folder cards |
| `--shadow-elevated` | `0 8px 32px rgba(5,36,21,0.12)` | Inline editor popover, modals |
| `--shadow-hero` | `0 16px 64px rgba(5,36,21,0.08)` | Browser mockup, hero elements |
| `--destructive` | `#dc2626` (red-600) | Delete actions, error states |
| `--destructive-subtle` | `rgba(220,38,38,0.08)` | Error backgrounds |

### Typography

| Role | Font | Weight | Size | Details |
|------|------|--------|------|---------|
| Logo | Georgia, serif | 400 | 15-17px | `letter-spacing: -0.3px` |
| Section headings (landing) | Georgia, serif | 400 | 36-56px | `letter-spacing: -1.2px to -1.8px` |
| Card headings (extension) | System UI, sans-serif | 600 | 12-13px | — |
| Body text | System UI, sans-serif | 400 | 10.5-12px | `line-height: 1.5-1.6` |
| Labels | System UI, sans-serif | 600 | 10px | `uppercase, letter-spacing: 0.5px` |
| Tags | System UI, sans-serif | 500 | 9px | — |
| Section labels (landing) | System UI, sans-serif | 600 | 11px | `uppercase, letter-spacing: 1.2px, color: #1a5c2e` |

### Spacing & Layout

| Element | Value |
|---------|-------|
| Card border-radius | `14px` |
| Button border-radius | `10px` |
| Input border-radius | `10px` |
| Tag border-radius | `6-8px` |
| Tab pill border-radius | `10px` |
| Popup width | `380px` (unchanged) |
| Card padding | `14-16px` |
| Section padding (popup) | `12-18px` horizontal |
| Card gap | `10px` |

### Note Icon Gradients

Notes use gradient-filled icon squares (18-20px, 6px radius). Variant is assigned by index within the visible list, cycling through the three options:

| Variant | Gradient | Assignment |
|---------|----------|------------|
| Primary | `linear-gradient(135deg, #052415, #1a5c2e)` | Notes at index 0, 3, 6... |
| Secondary | `linear-gradient(135deg, #1a5c2e, #6ead71)` | Notes at index 1, 4, 7... |
| Tertiary | `linear-gradient(135deg, #6ead71, #ABFFC0)` | Notes at index 2, 5, 8... |

### Tag Colors

Replace the existing `TAG_COLORS` array in `types.ts` with green-palette variants:

| Name | Value | Usage |
|------|-------|-------|
| Forest | `#052415` | Default / first tag |
| Emerald | `#1a5c2e` | — |
| Green | `#3d8b5e` | — |
| Sage | `#6ead71` | — |
| Mint | `#ABFFC0` | — |
| Teal | `#0d9488` | — |
| Olive | `#65784c` | — |
| Lime | `#84cc16` | — |

### Animations

| Animation | Duration | Easing | Details |
|-----------|----------|--------|---------|
| Fade in | `0.8s` | ease | `opacity 0→1, translateY 24px→0` |
| Float slow | `8s` | ease-in-out | `translateY ±20px, rotate ±1deg` (infinite) |
| Float medium | `6s` | ease-in-out | `translateY ±14px` (infinite) |
| Float fast | `4s` | ease-in-out | `translateY ±8px` (infinite) |

## Screens

### 1. Popup — Notes Dashboard

**Navigation:** 4 tab pills — `This Page | All Notes | Folders | Tags`
- Active tab: `background: var(--primary), color: var(--text-on-primary)`
- Inactive tab: `background: var(--muted), color: var(--text-primary)`

**Header bar:** Logo mark (dark green square, mint "D") + serif "DivNotes" + action buttons area (right side):
- **Inspector button** (grid icon): Activates element selection mode. `background: var(--muted)`, icon stroke `var(--primary)`. When active: `background: var(--primary)`, icon stroke `var(--accent)`.
- **Settings button** (gear icon): Opens settings view.

**Page context bar:** Favicon dot + truncated URL + note count (below tabs, on "This Page" view)

**Note cards:** White background, 14px radius, subtle shadow + border. Contains:
- Gradient note icon (18x18px, 6px radius)
- Title (12-13px, weight 600)
- Pinned indicator (5px mint dot with glow shadow)
- Preview text (10.5px, sage color)
- Tags row (9px pills with muted background)
- Timestamp (9px, right-aligned)

**"+ Add Note" button:** Full-width, dark green background, centered text, 10px radius

### 2. Popup — All Notes View

Same header and tabs. Adds:
- **Search bar:** White input with border, search icon, "Search all notes..." placeholder
- **Grouped by domain:** Uppercase section headers (9px, sage, letter-spacing 0.5px) showing domain + note count
- **Compact note rows:** White cards with color dot + title + timestamp

### 3. Popup — Folders View

**Folder list cards:** White background, 14px radius. Contains:
- Gradient folder icon (36x36px, 10px radius) with SVG folder stroke
- Folder name (13px, weight 600)
- Subtitle: note count + last updated
- Chevron right arrow

**"New Folder" button:** Dashed border (1.5px, rgba(5,36,21,0.12)), centered + icon + text

**Inside a folder:** Back arrow navigation + folder name + note count + kebab menu. Sort pills (Recent / By Site). Full note cards with source domain shown.

### 4. Popup — Tags View

**Tag chips grid:** Wrap layout of tag pills. Each has:
- Color dot (8x8px, 3px radius)
- Tag name (11px, weight 600)
- Note count badge (9px, muted background)

**Selected tag state:** Dark green pill with mint text + × dismiss. Filtered notes below as compact cards with domain + timestamp.

### 5. Popup — Login / Auth

**Welcome screen:**
- Centered logo mark (48px, 14px radius)
- Serif tagline: "Your notes, right where you left them."
- Subtitle text
- "Continue with Google" button (white card, Google SVG icon)
- "Continue with Email" button (white card, mail icon)
- "or" divider
- "Use Local Only" card (subtle background, centered text)
- Terms/Privacy footer (9px)

**Email sign-in form:**
- Back arrow header
- Email + Password fields (white, border, 10px radius, labeled)
- "Forgot password?" link (green)
- Dark green "Sign In" button
- "Sign Up" link
- "or continue with" divider + Google/GitHub icon-only buttons

### 6. Content Script — Element Inspector

- **Highlight border:** `2px solid #1a5c2e` with `background: rgba(171,255,192,0.08)`
- **Element label:** Dark green pill (`#052415`, mint text) positioned top-left showing tag + selector in monospace
- **Bottom tooltip:** Dark green pill centered at bottom: "Click to add a note · ESC to cancel" with mint + icon

### 7. Content Script — Note Badges

- **Badge:** 22x22px dark green (`#052415`) rounded square (7px radius), positioned top-right of element, mint note count, `box-shadow: 0 2px 8px rgba(5,36,21,0.2)`
- **Left border accent:** 3px wide, mint/green, on elements with notes
- **Page summary pill:** Bottom-right floating, dark green, "N notes on this page" with mint dot

### 8. Content Script — Inline Editor

- **Popover:** `#FAFAF7` background, 14px radius, elevated shadow, max-width 380px
- **Header:** Note gradient icon + "Edit Note" + delete/close icons
- **Fields:** Title input + content textarea (white, 8px radius, subtle border)
- **Toolbar:** Folder pill + tag pills + "+ tag" button
- **Footer:** Pin toggle (mint accent) + dark green "Save" button

### 9. Side Panel

Full-height browser panel. Same 4-tab navigation as popup (`This Page | All Notes | Folders | Tags`) plus additional header buttons:
- **Inspector toggle** (grid icon): Same as popup
- **Open in popup** (external link icon): Opens the popup view
- **Settings** (gear icon): Opens settings

**Notes list:** Expanded cards with:
- Larger note icon (20px)
- Full preview text with inline code formatting
- "Scroll to element" link (green, with arrow icon + monospace selector)

**Edit view:** Back navigation, labeled form fields:
- Title, Note (with markdown hint), Folder dropdown, Tags with removable chips, Pin toggle switch (green)
- "Attached to element" info box (mint tinted background, selector shown)
- Cancel + Save Changes bottom bar

### 10. Landing Page

**Nav:** Sticky, blurred background. Logo + links + "Add to Chrome" button.

**Hero:** Serif headline (56px), subline, dual CTA buttons. Below: layered parallax composition:
- Center: Browser mockup showing extension in action (badges + side panel)
- Left (floating, offset): Popup folders view mockup
- Right (floating, offset): Inline editor mockup
- Three layers float at different speeds for depth

**Social proof bar:** Stats (users, notes, rating) separated by vertical dividers

**How It Works:** Three steps, alternating left/right layout with matching app mockups:
- Step 1 (inspector mockup) → Step 2 (inline editor mockup, reversed) → Step 3 (badges mockup)
- Mockups float with parallax animation

**Features:** 3×2 grid, mint icon backgrounds, off-white cards

**Pricing:** Two-card layout:
- Free ($0/forever): White card, outline CTA. Unlimited notes, markdown, folders/tags, inspector, presentation mode, local storage.
- Pro ($5/month): Dark green card, "Popular" badge, mint glow accent. Everything in Free + cloud sync, automatic backups, offline auto-sync, priority support.

**CTA section:** Dark green background, serif headline, dual buttons

**Footer:** Dark green, logo + links

### 11. Settings View

Accessible from gear icon in popup/side panel header. Uses back-arrow navigation.

**Sections:**
- **Account:** Shows email + avatar if signed in, or "Local Mode" badge. "Sign Out" button (destructive outline style). "Sign In" link if in local mode.
- **Data:** "Export Notes" button (secondary style). "Import Notes" button. "Clear All Notes" button (destructive, requires confirmation dialog).
- **About:** Version number, links to Chrome Web Store, GitHub, Privacy Policy.

**Layout:** Stacked sections with uppercase labels (10px, `--text-secondary`), separated by border dividers.

### 12. Presentation / Screen Share Mode

Activated via keyboard shortcut or context menu. Overlay that walks through notes on the current page.

- **Overlay backdrop:** `rgba(5,36,21,0.5)` semi-transparent overlay
- **Spotlight:** Active element highlighted with a clear cutout in the overlay
- **Note card:** Floating card (same style as inline editor but read-only) positioned near the highlighted element
- **Navigation bar:** Bottom-center dark green pill with left/right arrows + "2 of 5" counter + close button
- **Typography:** Same card treatment as inline editor without edit controls

### 13. Empty States

Each view needs an empty state when no content exists:

| View | Illustration | Message | Action |
|------|-------------|---------|--------|
| This Page (no notes) | Subtle outline icon (note + plus) | "No notes on this page yet" | "Add Note" button (primary) |
| All Notes (no notes anywhere) | Outline icon (stack of notes) | "Your notes will appear here" | "Start by selecting an element on any page" (text hint) |
| Folders (no folders) | Outline icon (folder) | "Organize notes into folders" | "New Folder" button (dashed outline) |
| Tags (no tags) | Outline icon (tag) | "Tag your notes for easy filtering" | "Tags are added when you create notes" (text hint) |

Empty state icons: 48px, stroke-only, `color: rgba(5,36,21,0.15)`. Text: 13px, `--text-secondary`. Centered vertically in the content area.

### 14. Loading & Error States

**Loading spinner:** Simple rotating circle, 20px, stroke `var(--primary-light)`, 2px stroke width. Centered in content area.

**Sync error banner:** Appears at top of notes list. `background: var(--destructive-subtle)`, `border: 1px solid rgba(220,38,38,0.15)`, 10px radius. Red dot + "Sync failed — notes saved locally" + "Retry" link in `var(--destructive)`.

**Login error:** Shake animation on form + red border on invalid field + error message below field in `var(--destructive)`, 10px font size.

### 15. Confirmation Dialogs

Used for destructive actions (delete note, delete folder, clear all notes).

- **Overlay:** `rgba(5,36,21,0.3)` backdrop
- **Dialog card:** White, 16px radius, elevated shadow, max-width 300px, centered
- **Title:** 14px, weight 600, `var(--text-primary)`
- **Message:** 12px, `var(--text-secondary)`
- **Buttons:** "Cancel" (secondary) + "Delete" (destructive: `background: var(--destructive)`, white text)

### 16. Toast Notifications

Non-blocking feedback messages for successful actions.

- **Position:** Bottom-center of popup/side panel, 16px from bottom
- **Style:** `background: var(--primary)`, `color: var(--text-on-primary)`, 10px radius, 12px text
- **Duration:** 3 seconds, fade out
- **Examples:** "Note saved", "Note deleted", "Folder created", "Synced"

## Supersedes

This spec supersedes the purple color values in `2026-03-25-sidebar-folders-tags-design.md`. All purple drop indicators, highlights, and accents from that spec should use the Eden Bright green equivalents:
- Purple indicator line → `var(--primary-light)` (`#1a5c2e`)
- Purple highlights → `var(--accent)` (`#ABFFC0`)
- Content script purple overlays → forest green equivalents as defined in Screens 6-8

The folder/tag architecture and data model from the `2026-03-25` spec remain valid — only the visual treatment changes.

## Key Design Principles

1. **Light-first:** Warm off-white (`#FAFAF7`) as the default. Dark green used for emphasis, not background.
2. **Nature-inspired palette:** Forest green → sage → mint gradient conveys organic warmth.
3. **Serif + sans-serif pairing:** Georgia serif for display/branding, system sans-serif for UI. Creates an editorial feel without sacrificing readability at small sizes.
4. **Subtle depth:** Very light shadows, thin borders, gradient note icons — depth without heaviness.
5. **Consistent card language:** All content in white cards with 14px radius, identical shadow and border treatment.
6. **Mint as highlight:** `#ABFFC0` used sparingly for pinned status, active indicators, and brand accents — never as a background fill.

## Dark Mode

Not included in this redesign. The current dark mode variables should be updated to match this palette when dark mode is addressed separately. Suggested dark mode primary: deep forest green (`#0a1f12`) with lighter green accents.

## Mockups Reference

All HTML mockups are saved in `.superpowers/brainstorm/` for reference:
- `eden-adapted.html` — Initial direction comparison
- `popup-dashboard-v2.html` — Popup with all 4 tabs
- `popup-folders.html` — Folders view
- `popup-auth.html` — Login / auth flow
- `content-overlays.html` — Inspector, badges, inline editor
- `sidepanel.html` — Side panel list + edit views
- `landing-parallax.html` — Full landing page with mockups + parallax
