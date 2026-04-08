# Inline Overlay Popup-Parity Dark Design

**Goal:** Bring the content-script hover preview and anchored inline editor into visual alignment with the shadcn preset used by the popup and sidepanel, while preserving the current anchored behavior and editing flows.

**Scope:** Content-script hover preview card, note badge-adjacent preview state, and anchored inline editor presentation.

**Out of Scope:** New capabilities, interaction model changes, popup/sidepanel redesign, selector-inspector behavior changes, or any visual direction borrowed from the previously rejected `C` concept.

## Approved Direction

The inline content surfaces should keep their current behavior but adopt a more premium floating-sheet presentation based on the worktree's dark-mode shadcn tokens:

- Background: `oklch(0.148 0.004 228.8)`
- Card: `oklch(0.218 0.008 223.9)`
- Primary: `oklch(0.432 0.095 166.913)`
- Muted: `oklch(0.275 0.011 216.9)`
- Muted foreground: `oklch(0.723 0.014 214.4)`
- Border: `oklch(1 0 0 / 10%)`
- Input: `oklch(1 0 0 / 15%)`
- Ring: `oklch(0.56 0.021 213.5)`
- Destructive: `oklch(0.704 0.191 22.216)`

The result should feel like a continuation of the popup design system, not a separate floating utility.

## Hover Preview

The hover state remains compact and anchored near the selected element, but its content hierarchy changes:

- Remove the HTML selector tag pill from the card itself.
- Remove the top metadata header strip.
- Remove the note title from the hover card.
- Keep only:
  - the preview body
  - folder/tag chips if present
  - footer actions for `Move`, `Edit`, and `Delete`

Presentation rules:

- The preview card uses a dark `card` surface with soft border and elevated shadow.
- Actions sit in a footer row separated by a subtle top border.
- `Delete` uses a muted destructive treatment rather than raw red text on transparent background.
- Tags/folder chips should read as supporting metadata, not the main focal point.

## Inline Editor

The anchored editor remains the same interaction model, but its shell should match popup parity more closely:

- Header uses the Canopy accent mark, strong title text, and grouped header actions.
- Existing notes show `Delete` and `Close` in the header.
- New notes keep only `Close` in the header.
- Textarea becomes the dominant field with:
  - darker input surface
  - larger radius
  - ring-led focus treatment
  - stronger internal padding
- Folder and tags render as structured muted rows rather than loose inline controls.
- Pinned remains a simple supporting row.
- Save action remains the single primary footer action.

## Behavioral Constraints

- Keep current anchored placement and follow-on-scroll behavior.
- Do not reintroduce a visible title field or raw element-info header into the editor.
- Do not add new workflows or capability changes.
- Do not alter popup or sidepanel logic.
- Keep the content script self-contained in the worktree.

## Files Affected

- `src/content/overlay-ui.ts`
- `src/content/overlay-ui.test.ts`
- `src/content/editor-surface.ts`
- `src/content/editor-surface.test.ts`
- `src/content/index.tsx` only if wiring or state labels must change to support the presentation update
- `tests/shadcn-preset-theme.test.mjs` if static assertions need to reflect the new markers/styles

## Verification

- DOM-builder tests should prove the hover card removes the old selector/title header structure and exposes the new footer/button treatment.
- DOM-builder tests should prove the editor keeps the existing behavior markers while exposing the new shell structure and styling hooks.
- Content static regression coverage should continue to assert the shadcn-preset styling is present in the emitted content build.
- `npm run build` must still succeed from the worktree.
