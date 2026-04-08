# Shadcn Preset Theme (b1sTXSqbi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the shadcn preset `b1sTXSqbi` (radix-vega style, mist base color, Inter font, hugeicons, oklch colors) across the entire Canopy Chrome extension — popup, sidepanel, content script, and all shared components.

**Architecture:** The migration is layered: (1) foundation — CSS variables, Tailwind config, fonts, dependencies; (2) shared UI components — all 11 shadcn components updated to radix-vega style; (3) page-level — hardcoded colors replaced with theme tokens; (4) content script — inline DOM styles updated to new palette. We stay on Tailwind v3 but adopt oklch color values.

**Tech Stack:** Tailwind CSS v3, oklch color space, Inter Variable font (`@fontsource-variable/inter`), `@hugeicons/react` icon library, existing Radix UI primitives

**Key Decision — Tailwind v3 Compatibility:** The preset was scaffolded with Tailwind v4, but upgrading Tailwind is out of scope. We port the oklch color values into CSS custom properties and change `tailwind.config.js` to reference `var(--xxx)` instead of `hsl(var(--xxx))`. Chrome fully supports oklch.

---

## Color Palette Reference

### Light Mode (from preset)
| Token | Value |
|-------|-------|
| background | `oklch(1 0 0)` |
| foreground | `oklch(0.148 0.004 228.8)` |
| card | `oklch(1 0 0)` |
| primary | `oklch(0.508 0.118 165.612)` |
| primary-foreground | `oklch(0.979 0.021 166.113)` |
| secondary | `oklch(0.967 0.001 286.375)` |
| secondary-foreground | `oklch(0.21 0.006 285.885)` |
| muted | `oklch(0.963 0.002 197.1)` |
| muted-foreground | `oklch(0.56 0.021 213.5)` |
| accent | `oklch(0.963 0.002 197.1)` |
| accent-foreground | `oklch(0.218 0.008 223.9)` |
| destructive | `oklch(0.577 0.245 27.325)` |
| border | `oklch(0.925 0.005 214.3)` |
| input | `oklch(0.925 0.005 214.3)` |
| ring | `oklch(0.723 0.014 214.4)` |

### Dark Mode (from preset)
| Token | Value |
|-------|-------|
| background | `oklch(0.148 0.004 228.8)` |
| foreground | `oklch(0.987 0.002 197.1)` |
| card | `oklch(0.218 0.008 223.9)` |
| primary | `oklch(0.432 0.095 166.913)` |
| primary-foreground | `oklch(0.979 0.021 166.113)` |
| secondary | `oklch(0.274 0.006 286.033)` |
| secondary-foreground | `oklch(0.985 0 0)` |
| muted | `oklch(0.275 0.011 216.9)` |
| muted-foreground | `oklch(0.723 0.014 214.4)` |
| accent | `oklch(0.275 0.011 216.9)` |
| accent-foreground | `oklch(0.987 0.002 197.1)` |
| destructive | `oklch(0.704 0.191 22.216)` |
| border | `oklch(1 0 0 / 10%)` |
| input | `oklch(1 0 0 / 15%)` |
| ring | `oklch(0.56 0.021 213.5)` |

### Content Script Palette Mapping
The content script uses hardcoded colors. Here is the old → new mapping:
| Old Color | Purpose | New Color |
|-----------|---------|-----------|
| `#052415` / `rgba(5,36,21,...)` | Dark green (primary dark) | `oklch(0.148 0.004 228.8)` → approx `#1e2a30` |
| `#173628` | Foreground text | `oklch(0.148 0.004 228.8)` → `#1e2a30` |
| `#1a5c2e` | Primary accent | `oklch(0.508 0.118 165.612)` → `#1a8a6e` (teal) |
| `#ABFFC0` / `rgba(171,255,192,...)` | Light green accent | `oklch(0.865 0.127 207.078)` → `#7dd3c8` (light teal) |
| `#F5EFE9` | Light foreground on dark | `oklch(0.979 0.021 166.113)` → `#ebf5f0` |
| `#FAFAF7` / `#fcfbf7` | Background surface | `oklch(1 0 0)` → `#ffffff` |
| `#f3f1eb` / `#f8f6f1` | Muted bg | `oklch(0.963 0.002 197.1)` → `#f2f4f5` |
| `#e7e2d8` / `#ece7de` | Border | `oklch(0.925 0.005 214.3)` → `#e3e8ea` |
| `#637267` / `#7a867e` | Muted foreground | `oklch(0.56 0.021 213.5)` → `#7e8f96` |
| `#b91c1c` / `rgba(220,38,38,...)` | Destructive | `oklch(0.577 0.245 27.325)` → `#dc4a2f` |

---

## Icon Mapping (lucide-react → @hugeicons/react)

| lucide-react | @hugeicons/react | Used in |
|-------------|-----------------|---------|
| `FilePlus2` | `FileAdd01Icon` | sidepanel/App, sidepanel/ThisPageView |
| `Search` | `Search01Icon` | sidepanel/App, popup/AllNotesView |
| `Settings2` | `Settings02Icon` | sidepanel/App, popup/Dashboard |
| `LogIn` | `Login01Icon` | sidepanel/App |
| `PanelsTopLeft` | `LeftToRightBlockQuoteIcon` | popup/Dashboard |
| `Folder` | `Folder01Icon` | sidepanel/PinnedSection, FolderPicker, FolderTreeNodeItem, BulkActionBar, popup/FoldersView |
| `FolderPlus` | `FolderAddIcon` | sidepanel/FoldersView, FolderTreeNodeItem |
| `FolderOpen` | `FolderOpenIcon` | popup/FoldersView, WorkspaceNoteCard |
| `Inbox` | `Inbox01Icon` | sidepanel/FolderPicker, FoldersView |
| `Pin` | `Pin01Icon` | sidepanel/NoteCard, WorkspaceNoteCard |
| `Trash2` | `Delete02Icon` | sidepanel/NoteCard, TagManager, BulkActionBar |
| `Tag` | `Tag01Icon` | sidepanel/TagPicker, TagPill, BulkActionBar |
| `Star` | `FavouriteIcon` | sidepanel/PinnedSection, BulkActionBar |
| `X` | `Cancel01Icon` | dialog, TagManager, TagPill, BulkActionBar |
| `ChevronDown` | `ArrowDown01Icon` | PinnedSection, FoldersView, WorkspaceNoteCard |
| `ChevronRight` | `ArrowRight01Icon` | PinnedSection, FoldersView, FolderTreeNodeItem, WorkspaceNoteCard |
| `Hash` | `HashtagIcon` | WorkspaceNoteCard, WorkspaceTagFilterBar |
| `Check` | `Tick02Icon` | dropdown-menu, FolderPicker, TagPicker, TagManager |
| `Circle` | `RadioIcon` | dropdown-menu |
| `ArrowLeft` | `ArrowLeft01Icon` | PopupShell, SidePanelShell |
| `StickyNote` | `StickyNote01Icon` | sidepanel/AllNotesView, FoldersView, popup/AllNotesView |
| `FileText` | `File01Icon` | popup/ThisPageView |
| `ExternalLink` | `LinkSquare02Icon` | FolderTreeNodeItem, popup/FoldersView, popup/SettingsView, WorkspaceNoteCard |
| `MoreVertical` | `MoreVerticalIcon` | FolderTreeNodeItem |
| `Tags` | `Tag01Icon` | popup/TagsView, sidepanel/TagsView |
| `Plus` | `Add01Icon` | sidepanel/TagPicker |
| `CreditCard` | `CreditCardIcon` | popup/SettingsView |
| `Database` | `Database01Icon` | popup/SettingsView |
| `HardDrive` | `HardDriveIcon` | popup/SettingsView |
| `UserRound` | `UserCircle02Icon` | popup/SettingsView |
| `LoaderCircle` | `Loading03Icon` | WorkspaceEmptyState |
| `MapPinned` | `MapsLocation01Icon` | sidepanel/ThisPageView |
| `GitMerge` | `GitMergeIcon` | sidepanel/TagManager |

> **Note:** Verify each icon name exists in `@hugeicons/react` after install. Run `node -e "const h = require('@hugeicons/react'); console.log(Object.keys(h).filter(k => k.includes('Search')))"` to check available names. Adjust as needed.

---

## File Structure

### Files to modify
| File | Responsibility |
|------|---------------|
| `package.json` | Add `@fontsource-variable/inter`, `@hugeicons/react`; remove `lucide-react` |
| `src/styles/globals.css` | Replace HSL variables with oklch preset palette |
| `tailwind.config.js` | Update color refs from `hsl(var(--xxx))` to `var(--xxx)`, update font, radius |
| `components.json` | Update to radix-vega style, mist base, hugeicons |
| `src/components/ui/button.tsx` | Radix-vega button variants |
| `src/components/ui/card.tsx` | Minor class updates |
| `src/components/ui/input.tsx` | Updated focus ring style |
| `src/components/ui/textarea.tsx` | Updated focus ring style |
| `src/components/ui/dialog.tsx` | Replace hardcoded colors with tokens, swap X icon |
| `src/components/ui/dropdown-menu.tsx` | Swap lucide icons |
| `src/components/ui/tabs.tsx` | Subtle style refresh |
| `src/components/ui/tooltip.tsx` | Minor class updates |
| `src/components/ui/popover.tsx` | Minor class updates |
| `src/components/ui/separator.tsx` | No changes needed |
| `src/components/ui/label.tsx` | No changes needed |
| `src/popup/App.tsx` | Replace hardcoded colors with theme tokens |
| `src/popup/LoginForm.tsx` | Replace hardcoded colors, swap inline SVGs for hugeicons |
| `src/popup/Dashboard.tsx` | Swap lucide icons, update button colors |
| `src/popup/components/PopupShell.tsx` | Swap icon, update colors |
| `src/popup/components/ThisPageView.tsx` | Swap icon, update colors |
| `src/popup/components/AllNotesView.tsx` | Swap icons, update colors |
| `src/popup/components/FoldersView.tsx` | Swap icons, update colors |
| `src/popup/components/TagsView.tsx` | Swap icon |
| `src/popup/components/SettingsView.tsx` | Swap icons, update colors |
| `src/sidepanel/App.tsx` | Swap icons, update colors |
| `src/sidepanel/components/SidePanelShell.tsx` | Swap icon |
| `src/sidepanel/components/NoteCard.tsx` | Swap icons, update colors |
| `src/sidepanel/components/AllNotesView.tsx` | Swap icon |
| `src/sidepanel/components/FoldersView.tsx` | Swap icons, update colors |
| `src/sidepanel/components/TagsView.tsx` | Swap icon |
| `src/sidepanel/components/ThisPageView.tsx` | Swap icons |
| `src/sidepanel/components/PinnedSection.tsx` | Swap icons |
| `src/sidepanel/components/ContextMenu.tsx` | Swap icons |
| `src/sidepanel/components/FolderPicker.tsx` | Swap icons |
| `src/sidepanel/components/FolderTreeNodeItem.tsx` | Swap icons |
| `src/sidepanel/components/TagPicker.tsx` | Swap icons |
| `src/sidepanel/components/TagPill.tsx` | Swap icons |
| `src/sidepanel/components/TagManager.tsx` | Swap icons |
| `src/sidepanel/components/BulkActionBar.tsx` | Swap icons |
| `src/sidepanel/components/SegmentedControl.tsx` | Update colors |
| `src/components/workspace/TopNavPills.tsx` | Replace hardcoded colors with tokens |
| `src/components/workspace/WorkspaceNoteCard.tsx` | Swap icons, replace hardcoded colors |
| `src/components/workspace/WorkspaceEmptyState.tsx` | Swap icon |
| `src/components/workspace/WorkspaceActionDialog.tsx` | Update colors |
| `src/components/workspace/WorkspaceNoteEditorDialog.tsx` | Update colors |
| `src/components/workspace/WorkspaceTagFilterBar.tsx` | Swap icon |
| `src/content/index.tsx` | Update all inline CSS colors |
| `src/content/overlay-ui.ts` | Update all inline style colors |
| `src/content/editor-surface.ts` | Update all inline style colors |
| `src/popup/main.tsx` | Add Inter font import |
| `src/sidepanel/main.tsx` | Add Inter font import |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new dependencies**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm install @fontsource-variable/inter @hugeicons/react
```

- [ ] **Step 2: Verify install succeeded**

```bash
ls node_modules/@fontsource-variable/inter/index.css
ls node_modules/@hugeicons/react/package.json
```

- [ ] **Step 3: Verify hugeicons icon names exist**

Run this to validate the icon mapping. Fix any icons that don't exist.

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
node -e "
const icons = [
  'FileAdd01Icon', 'Search01Icon', 'Settings02Icon', 'Login01Icon',
  'LeftToRightBlockQuoteIcon', 'Folder01Icon', 'FolderAddIcon', 'FolderOpenIcon',
  'Inbox01Icon', 'Pin01Icon', 'Delete02Icon', 'Tag01Icon', 'FavouriteIcon',
  'Cancel01Icon', 'ArrowDown01Icon', 'ArrowRight01Icon', 'HashtagIcon',
  'Tick02Icon', 'RadioIcon', 'ArrowLeft01Icon', 'StickyNote01Icon',
  'File01Icon', 'LinkSquare02Icon', 'MoreVerticalIcon', 'Add01Icon',
  'CreditCardIcon', 'Database01Icon', 'HardDriveIcon', 'UserCircle02Icon',
  'Loading03Icon', 'MapsLocation01Icon', 'GitMergeIcon'
];
const pkg = require('@hugeicons/react');
const missing = icons.filter(i => !pkg[i]);
if (missing.length) {
  console.log('MISSING ICONS:', missing);
  // Search for alternatives
  missing.forEach(m => {
    const base = m.replace(/\d+Icon$/, '').replace(/Icon$/, '');
    const alts = Object.keys(pkg).filter(k => k.toLowerCase().includes(base.toLowerCase())).slice(0, 5);
    console.log('  ' + m + ' alternatives:', alts);
  });
} else {
  console.log('ALL ICONS FOUND');
}
"
```

If any icons are missing, find the closest match and update the mapping in subsequent tasks. Document substitutions in a commit message.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Inter font and hugeicons dependencies for preset theme"
```

---

### Task 2: Update CSS Theme Variables

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Replace globals.css with oklch preset theme**

Replace the entire file with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.148 0.004 228.8);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.148 0.004 228.8);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.148 0.004 228.8);
    --primary: oklch(0.508 0.118 165.612);
    --primary-foreground: oklch(0.979 0.021 166.113);
    --secondary: oklch(0.967 0.001 286.375);
    --secondary-foreground: oklch(0.21 0.006 285.885);
    --muted: oklch(0.963 0.002 197.1);
    --muted-foreground: oklch(0.56 0.021 213.5);
    --accent: oklch(0.963 0.002 197.1);
    --accent-foreground: oklch(0.218 0.008 223.9);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.985 0 0);
    --border: oklch(0.925 0.005 214.3);
    --input: oklch(0.925 0.005 214.3);
    --ring: oklch(0.723 0.014 214.4);
    --radius: 0.45rem;
    --chart-1: oklch(0.865 0.127 207.078);
    --chart-2: oklch(0.715 0.143 215.221);
    --chart-3: oklch(0.609 0.126 221.723);
    --chart-4: oklch(0.52 0.105 223.128);
    --chart-5: oklch(0.45 0.085 224.283);
    --sidebar: oklch(0.987 0.002 197.1);
    --sidebar-foreground: oklch(0.148 0.004 228.8);
    --sidebar-primary: oklch(0.596 0.145 163.225);
    --sidebar-primary-foreground: oklch(0.979 0.021 166.113);
    --sidebar-accent: oklch(0.963 0.002 197.1);
    --sidebar-accent-foreground: oklch(0.218 0.008 223.9);
    --sidebar-border: oklch(0.925 0.005 214.3);
    --sidebar-ring: oklch(0.723 0.014 214.4);
  }

  .dark {
    --background: oklch(0.148 0.004 228.8);
    --foreground: oklch(0.987 0.002 197.1);
    --card: oklch(0.218 0.008 223.9);
    --card-foreground: oklch(0.987 0.002 197.1);
    --popover: oklch(0.218 0.008 223.9);
    --popover-foreground: oklch(0.987 0.002 197.1);
    --primary: oklch(0.432 0.095 166.913);
    --primary-foreground: oklch(0.979 0.021 166.113);
    --secondary: oklch(0.274 0.006 286.033);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.275 0.011 216.9);
    --muted-foreground: oklch(0.723 0.014 214.4);
    --accent: oklch(0.275 0.011 216.9);
    --accent-foreground: oklch(0.987 0.002 197.1);
    --destructive: oklch(0.704 0.191 22.216);
    --destructive-foreground: oklch(0.985 0 0);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.56 0.021 213.5);
    --chart-1: oklch(0.865 0.127 207.078);
    --chart-2: oklch(0.715 0.143 215.221);
    --chart-3: oklch(0.609 0.126 221.723);
    --chart-4: oklch(0.52 0.105 223.128);
    --chart-5: oklch(0.45 0.085 224.283);
    --sidebar: oklch(0.218 0.008 223.9);
    --sidebar-foreground: oklch(0.987 0.002 197.1);
    --sidebar-primary: oklch(0.696 0.17 162.48);
    --sidebar-primary-foreground: oklch(0.262 0.051 172.552);
    --sidebar-accent: oklch(0.275 0.011 216.9);
    --sidebar-accent-foreground: oklch(0.987 0.002 197.1);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.56 0.021 213.5);
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
```

- [ ] **Step 2: Verify CSS parses without errors**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm run build 2>&1 | tail -5
```

Build should succeed. The `hsl()` wrapper in tailwind config won't work with oklch values — that gets fixed in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: replace HSL color palette with oklch mist preset"
```

---

### Task 3: Update Tailwind Config

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Update tailwind.config.js**

Replace the entire config. Key changes:
- Colors now use `var(--xxx)` instead of `hsl(var(--xxx))` since CSS vars contain full oklch values
- Font changed to Inter Variable
- Border radius updated to 0.45rem base
- Keep existing keyframes/animations (they work with any color scheme)

```js
/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        './src/**/*.{ts,tsx,html}',
    ],
    theme: {
        extend: {
            colors: {
                border: 'var(--border)',
                input: 'var(--input)',
                ring: 'var(--ring)',
                background: 'var(--background)',
                foreground: 'var(--foreground)',
                primary: {
                    DEFAULT: 'var(--primary)',
                    foreground: 'var(--primary-foreground)',
                },
                secondary: {
                    DEFAULT: 'var(--secondary)',
                    foreground: 'var(--secondary-foreground)',
                },
                destructive: {
                    DEFAULT: 'var(--destructive)',
                    foreground: 'var(--destructive-foreground)',
                },
                muted: {
                    DEFAULT: 'var(--muted)',
                    foreground: 'var(--muted-foreground)',
                },
                accent: {
                    DEFAULT: 'var(--accent)',
                    foreground: 'var(--accent-foreground)',
                },
                popover: {
                    DEFAULT: 'var(--popover)',
                    foreground: 'var(--popover-foreground)',
                },
                card: {
                    DEFAULT: 'var(--card)',
                    foreground: 'var(--card-foreground)',
                },
                chart: {
                    1: 'var(--chart-1)',
                    2: 'var(--chart-2)',
                    3: 'var(--chart-3)',
                    4: 'var(--chart-4)',
                    5: 'var(--chart-5)',
                },
                sidebar: {
                    DEFAULT: 'var(--sidebar)',
                    foreground: 'var(--sidebar-foreground)',
                    primary: 'var(--sidebar-primary)',
                    'primary-foreground': 'var(--sidebar-primary-foreground)',
                    accent: 'var(--sidebar-accent)',
                    'accent-foreground': 'var(--sidebar-accent-foreground)',
                    border: 'var(--sidebar-border)',
                    ring: 'var(--sidebar-ring)',
                },
            },
            borderRadius: {
                '4xl': 'calc(var(--radius) * 2.6)',
                '3xl': 'calc(var(--radius) * 2.2)',
                '2xl': 'calc(var(--radius) * 1.8)',
                xl: 'calc(var(--radius) * 1.4)',
                lg: 'var(--radius)',
                md: 'calc(var(--radius) * 0.8)',
                sm: 'calc(var(--radius) * 0.6)',
            },
            fontFamily: {
                sans: ['Inter Variable', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
                serif: ['Georgia', 'serif'],
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(24px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'scale-in': {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                'slide-up': {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'float-slow': {
                    '0%, 100%': { transform: 'translateY(-20px) rotate(-1deg)' },
                    '50%': { transform: 'translateY(20px) rotate(1deg)' },
                },
                'float-medium': {
                    '0%, 100%': { transform: 'translateY(-14px)' },
                    '50%': { transform: 'translateY(14px)' },
                },
                'float-fast': {
                    '0%, 100%': { transform: 'translateY(-8px)' },
                    '50%': { transform: 'translateY(8px)' },
                },
            },
            animation: {
                'fade-in': 'fade-in 0.8s ease',
                'scale-in': 'scale-in 0.15s ease-out',
                'slide-up': 'slide-up 0.25s ease-out',
                'float-slow': 'float-slow 8s ease-in-out infinite',
                'float-medium': 'float-medium 6s ease-in-out infinite',
                'float-fast': 'float-fast 4s ease-in-out infinite',
            },
            boxShadow: {
                'card': '0 2px 8px oklch(0.148 0.004 228.8 / 0.04)',
                'elevated': '0 8px 32px oklch(0.148 0.004 228.8 / 0.12)',
                'hero': '0 16px 64px oklch(0.148 0.004 228.8 / 0.08)',
            },
        },
    },
    plugins: [],
};
```

- [ ] **Step 2: Build and verify**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm run build 2>&1 | tail -5
```

Expected: Build succeeds. Colors now resolve from oklch CSS variables.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.js
git commit -m "feat: update tailwind config for oklch colors, Inter font, and new radius scale"
```

---

### Task 4: Update components.json and Add Font Import

**Files:**
- Modify: `components.json`
- Modify: `src/popup/main.tsx`
- Modify: `src/sidepanel/main.tsx`

- [ ] **Step 1: Update components.json**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-vega",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles/globals.css",
    "baseColor": "mist",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "hugeicons",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 2: Add Inter font import to popup entry**

In `src/popup/main.tsx`, add at the top of imports:

```typescript
import '@fontsource-variable/inter';
```

- [ ] **Step 3: Add Inter font import to sidepanel entry**

In `src/sidepanel/main.tsx`, add at the top of imports:

```typescript
import '@fontsource-variable/inter';
```

- [ ] **Step 4: Build and verify**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add components.json src/popup/main.tsx src/sidepanel/main.tsx
git commit -m "feat: configure radix-vega style with Inter font"
```

---

### Task 5: Update Shadcn UI Components

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/dropdown-menu.tsx`
- Modify: `src/components/ui/tabs.tsx`
- Modify: `src/components/ui/tooltip.tsx`
- Modify: `src/components/ui/popover.tsx`

- [ ] **Step 1: Update button.tsx to radix-vega style**

Replace the entire file:

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outline:
          'border-border bg-background shadow-xs hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-9 gap-1.5 px-2.5 has-[>svg:only-child]:pr-2 has-[>svg:first-child]:pl-2',
        xs: 'h-6 gap-1 rounded-sm px-2 text-xs has-[>svg:only-child]:pr-1.5 has-[>svg:first-child]:pl-1.5 [&_svg:not([class*=\'size-\'])]:size-3',
        sm: 'h-8 gap-1 rounded-[calc(var(--radius)*0.8)] px-2.5 has-[>svg:only-child]:pr-1.5 has-[>svg:first-child]:pl-1.5',
        lg: 'h-10 gap-1.5 px-2.5 has-[>svg:only-child]:pr-2 has-[>svg:first-child]:pl-2',
        icon: 'size-9',
        'icon-xs': 'size-6 rounded-sm [&_svg:not([class*=\'size-\'])]:size-3',
        'icon-sm': 'size-8 rounded-[calc(var(--radius)*0.8)]',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 2: Update input.tsx**

Replace the className string:

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Input.displayName = 'Input';

export { Input };
```

- [ ] **Step 3: Update textarea.tsx**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    'flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Textarea.displayName = 'Textarea';

export { Textarea };
```

- [ ] **Step 4: Update dialog.tsx — replace hardcoded colors with theme tokens**

```tsx
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Cancel01Icon } from '@hugeicons/react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]', className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
    closeButtonDisabled?: boolean;
  }
>(({ className, children, showCloseButton = true, closeButtonDisabled = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-elevated',
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
          disabled={closeButtonDisabled}
        >
          <Cancel01Icon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('space-y-1.5 pr-8', className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-5 flex items-center justify-end gap-2', className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-[16px] font-semibold tracking-[-0.01em] text-foreground', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-[13px] leading-[1.5] text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
```

- [ ] **Step 5: Update dropdown-menu.tsx — swap lucide icons**

In `src/components/ui/dropdown-menu.tsx`, change the import line:

Old: `import { Check, ChevronRight, Circle } from "lucide-react"`
New: `import { Tick02Icon, ArrowRight01Icon, RadioIcon } from '@hugeicons/react'`

Then replace all usages:
- `<Check className="h-4 w-4" />` → `<Tick02Icon className="h-4 w-4" />`
- `<ChevronRight className="ml-auto" />` → `<ArrowRight01Icon className="ml-auto" />`
- `<Circle className="h-2 w-2 fill-current" />` → `<RadioIcon className="h-2 w-2 fill-current" />`

- [ ] **Step 6: Update tabs.tsx — refresh styling**

No icon changes needed. Update the `TabsList` background to be slightly more consistent:

In `TabsList`, change:
Old: `'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground'`
New: `'inline-flex h-9 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground'`

- [ ] **Step 7: Build and verify**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm run build 2>&1 | tail -10
```

Expected: Build succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/
git commit -m "feat: update all shadcn UI components to radix-vega style"
```

---

### Task 6: Swap Icon Library in Popup Pages

**Files:**
- Modify: `src/popup/Dashboard.tsx`
- Modify: `src/popup/components/PopupShell.tsx`
- Modify: `src/popup/components/ThisPageView.tsx`
- Modify: `src/popup/components/AllNotesView.tsx`
- Modify: `src/popup/components/FoldersView.tsx`
- Modify: `src/popup/components/TagsView.tsx`
- Modify: `src/popup/components/SettingsView.tsx`

- [ ] **Step 1: Update Dashboard.tsx**

Old import: `import { PanelsTopLeft, Settings2 } from 'lucide-react';`
New import: `import { LeftToRightBlockQuoteIcon, Settings02Icon } from '@hugeicons/react';`

Replace usages:
- `<PanelsTopLeft className="h-4 w-4" />` → `<LeftToRightBlockQuoteIcon className="h-4 w-4" />`
- `<Settings2 className="h-4 w-4" />` → `<Settings02Icon className="h-4 w-4" />`

- [ ] **Step 2: Update PopupShell.tsx**

Old import: `import { ArrowLeft } from 'lucide-react';`
New import: `import { ArrowLeft01Icon } from '@hugeicons/react';`

Replace: `<ArrowLeft .../>` → `<ArrowLeft01Icon .../>`

- [ ] **Step 3: Update ThisPageView.tsx (popup)**

Old import: `import { FileText } from 'lucide-react';`
New import: `import { File01Icon } from '@hugeicons/react';`

Replace: `<FileText .../>` → `<File01Icon .../>`

- [ ] **Step 4: Update AllNotesView.tsx (popup)**

Old import: `import { Search, StickyNote } from 'lucide-react';`
New import: `import { Search01Icon, StickyNote01Icon } from '@hugeicons/react';`

Replace all usages.

- [ ] **Step 5: Update FoldersView.tsx (popup)**

Old import: `import { ExternalLink, Folder, FolderOpen } from 'lucide-react';`
New import: `import { LinkSquare02Icon, Folder01Icon, FolderOpenIcon } from '@hugeicons/react';`

Replace all usages.

- [ ] **Step 6: Update TagsView.tsx (popup)**

Old import: `import { Tags } from 'lucide-react';`
New import: `import { Tag01Icon } from '@hugeicons/react';`

Replace: `<Tags .../>` → `<Tag01Icon .../>`

- [ ] **Step 7: Update SettingsView.tsx (popup)**

Old import: `import { CreditCard, Database, ExternalLink, HardDrive, UserRound } from 'lucide-react';`
New import: `import { CreditCardIcon, Database01Icon, LinkSquare02Icon, HardDriveIcon, UserCircle02Icon } from '@hugeicons/react';`

Replace all usages.

- [ ] **Step 8: Build and verify**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm run build 2>&1 | tail -10
```

- [ ] **Step 9: Commit**

```bash
git add src/popup/
git commit -m "feat: swap lucide-react for hugeicons in popup pages"
```

---

### Task 7: Swap Icon Library in Sidepanel Pages

**Files:**
- Modify: `src/sidepanel/App.tsx`
- Modify: `src/sidepanel/components/SidePanelShell.tsx`
- Modify: `src/sidepanel/components/NoteCard.tsx`
- Modify: `src/sidepanel/components/AllNotesView.tsx`
- Modify: `src/sidepanel/components/FoldersView.tsx`
- Modify: `src/sidepanel/components/TagsView.tsx`
- Modify: `src/sidepanel/components/ThisPageView.tsx`
- Modify: `src/sidepanel/components/PinnedSection.tsx`
- Modify: `src/sidepanel/components/ContextMenu.tsx`
- Modify: `src/sidepanel/components/FolderPicker.tsx`
- Modify: `src/sidepanel/components/FolderTreeNodeItem.tsx`
- Modify: `src/sidepanel/components/TagPicker.tsx`
- Modify: `src/sidepanel/components/TagPill.tsx`
- Modify: `src/sidepanel/components/TagManager.tsx`
- Modify: `src/sidepanel/components/BulkActionBar.tsx`

- [ ] **Step 1: Update sidepanel/App.tsx**

Old import: `import { FilePlus2, Search, Settings2, LogIn } from 'lucide-react';`
New import: `import { FileAdd01Icon, Search01Icon, Settings02Icon, Login01Icon } from '@hugeicons/react';`

Replace all usages: `FilePlus2` → `FileAdd01Icon`, `Search` → `Search01Icon`, `Settings2` → `Settings02Icon`, `LogIn` → `Login01Icon`.

- [ ] **Step 2: Update SidePanelShell.tsx**

Old: `import { ArrowLeft } from 'lucide-react';`
New: `import { ArrowLeft01Icon } from '@hugeicons/react';`

- [ ] **Step 3: Update NoteCard.tsx**

Old: `import { Pin, Trash2 } from 'lucide-react';`
New: `import { Pin01Icon, Delete02Icon } from '@hugeicons/react';`

- [ ] **Step 4: Update AllNotesView.tsx (sidepanel)**

Old: `import { StickyNote } from 'lucide-react';`
New: `import { StickyNote01Icon } from '@hugeicons/react';`

- [ ] **Step 5: Update FoldersView.tsx (sidepanel)**

Old: `import { FolderPlus, Inbox, ChevronDown, ChevronRight, Search, StickyNote } from 'lucide-react';`
New: `import { FolderAddIcon, Inbox01Icon, ArrowDown01Icon, ArrowRight01Icon, Search01Icon, StickyNote01Icon } from '@hugeicons/react';`

- [ ] **Step 6: Update TagsView.tsx (sidepanel)**

Old: `import { Tags } from 'lucide-react';`
New: `import { Tag01Icon } from '@hugeicons/react';`

- [ ] **Step 7: Update ThisPageView.tsx (sidepanel)**

Old: `import { FilePlus2, MapPinned } from 'lucide-react';`
New: `import { FileAdd01Icon, MapsLocation01Icon } from '@hugeicons/react';`

- [ ] **Step 8: Update PinnedSection.tsx**

Old: `import { Star, ChevronDown, ChevronRight, Folder } from 'lucide-react';`
New: `import { FavouriteIcon, ArrowDown01Icon, ArrowRight01Icon, Folder01Icon } from '@hugeicons/react';`

- [ ] **Step 9: Update ContextMenu.tsx**

Read the file first to see all icon imports, then swap each one using the mapping table.

- [ ] **Step 10: Update FolderPicker.tsx**

Old: `import { Folder, FolderPlus, Inbox, Check } from 'lucide-react';`
New: `import { Folder01Icon, FolderAddIcon, Inbox01Icon, Tick02Icon } from '@hugeicons/react';`

- [ ] **Step 11: Update FolderTreeNodeItem.tsx**

Old: `import { ChevronDown, ChevronRight, ExternalLink, Folder, FolderPlus, MoreVertical } from 'lucide-react';`
New: `import { ArrowDown01Icon, ArrowRight01Icon, LinkSquare02Icon, Folder01Icon, FolderAddIcon, MoreVerticalIcon } from '@hugeicons/react';`

- [ ] **Step 12: Update TagPicker.tsx**

Old: `import { Tag, Plus, Check } from 'lucide-react';`
New: `import { Tag01Icon, Add01Icon, Tick02Icon } from '@hugeicons/react';`

- [ ] **Step 13: Update TagPill.tsx**

Old: `import { Tag, X } from 'lucide-react';`
New: `import { Tag01Icon, Cancel01Icon } from '@hugeicons/react';`

- [ ] **Step 14: Update TagManager.tsx**

Old: `import { X, Trash2, Check, GitMerge } from 'lucide-react';`
New: `import { Cancel01Icon, Delete02Icon, Tick02Icon, GitMergeIcon } from '@hugeicons/react';`

- [ ] **Step 15: Update BulkActionBar.tsx**

Old: `import { Folder, Tag, Star, Trash2, X } from 'lucide-react';`
New: `import { Folder01Icon, Tag01Icon, FavouriteIcon, Delete02Icon, Cancel01Icon } from '@hugeicons/react';`

- [ ] **Step 16: Build and verify**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm run build 2>&1 | tail -10
```

- [ ] **Step 17: Commit**

```bash
git add src/sidepanel/
git commit -m "feat: swap lucide-react for hugeicons in sidepanel pages"
```

---

### Task 8: Swap Icons in Workspace Components

**Files:**
- Modify: `src/components/workspace/WorkspaceNoteCard.tsx`
- Modify: `src/components/workspace/WorkspaceEmptyState.tsx`
- Modify: `src/components/workspace/WorkspaceTagFilterBar.tsx`

- [ ] **Step 1: Update WorkspaceNoteCard.tsx**

Old: `import { ChevronDown, ChevronRight, ExternalLink, FolderOpen, Hash, Pin } from 'lucide-react';`
New: `import { ArrowDown01Icon, ArrowRight01Icon, LinkSquare02Icon, FolderOpenIcon, HashtagIcon, Pin01Icon } from '@hugeicons/react';`

Replace all usages.

- [ ] **Step 2: Update WorkspaceEmptyState.tsx**

Old: `import { LoaderCircle } from 'lucide-react';`
New: `import { Loading03Icon } from '@hugeicons/react';`

- [ ] **Step 3: Update WorkspaceTagFilterBar.tsx**

Old: `import { Hash } from 'lucide-react';`
New: `import { HashtagIcon } from '@hugeicons/react';`

- [ ] **Step 4: Build and verify**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/
git commit -m "feat: swap lucide-react for hugeicons in workspace components"
```

---

### Task 9: Replace Hardcoded Colors in Popup Pages

**Files:**
- Modify: `src/popup/App.tsx`
- Modify: `src/popup/LoginForm.tsx`
- Modify: `src/popup/Dashboard.tsx`
- Modify: `src/components/workspace/TopNavPills.tsx`
- Modify: `src/components/workspace/WorkspaceNoteCard.tsx`
- Modify: `src/components/workspace/WorkspaceActionDialog.tsx`
- Modify: `src/components/workspace/WorkspaceNoteEditorDialog.tsx`

These files have extensive hardcoded hex colors from the old green theme. Replace them with Tailwind theme tokens.

- [ ] **Step 1: Update popup/App.tsx**

Replace hardcoded colors with theme tokens:
- `bg-[#fcfbf7]` → `bg-background`
- `text-[#173628]` → `text-foreground`
- `border-[#d9e3dc]` → `border-border`
- `border-t-[#173628]` → `border-t-foreground`
- `text-[#7b5f5f]` → `text-destructive`
- `border-[rgba(185,28,28,0.16)]` → `border-destructive/20`
- `bg-[rgba(254,242,242,0.96)]` → `bg-destructive/5`
- `text-[#b91c1c]` → `text-destructive`

- [ ] **Step 2: Update popup/LoginForm.tsx**

Major color replacements:
- `bg-[#fcfbf7]` → `bg-background`
- `text-[#173628]` → `text-foreground`
- `border-[#e7e2d8]` → `border-border`
- `bg-white` → `bg-card`
- `text-[#314339]` → `text-foreground`
- `hover:bg-[#f8f6f1]` → `hover:bg-muted`
- `hover:bg-[#f1eee7]` → `hover:bg-muted`
- `bg-[#0b2417]` → `bg-primary`
- `text-[#9aa294]` → `text-muted-foreground`
- `bg-[#f3f1eb]` → `bg-secondary`
- `hover:bg-[#ece8df]` → `hover:bg-secondary/80`
- `text-[#aba79c]` → `text-muted-foreground`
- `bg-[#ece7de]` (separator) → `bg-border`
- `text-[#aca89e]` → `text-muted-foreground`

Update the `authOptionBaseClass`:
```typescript
const authOptionBaseClass = 'h-[50px] w-full rounded-lg border border-border bg-card px-4 text-[15px] font-medium text-foreground shadow-xs transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-70';
```

Update the Canopy logo SVG colors:
- `bg-[#0b2417]` → `bg-primary`
- `stroke="#F5EFE9"` → `stroke="currentColor"` (with `text-primary-foreground` on parent)
- `fill="#ABFFC0"` → keep as accent dots, use CSS variable reference

- [ ] **Step 3: Update popup/Dashboard.tsx**

Replace button hardcoded colors:
- `border-[#e7e2d8]` → `border-border`
- `bg-white` → `bg-card`
- `text-[#637267]` → `text-muted-foreground`
- `hover:bg-[#f8f6f1]` → `hover:bg-muted`
- `text-[#5b6a5f]` → `text-muted-foreground`

- [ ] **Step 4: Update TopNavPills.tsx**

Replace all hardcoded colors:
```tsx
export function TopNavPills({ items, value, onChange }: TopNavPillsProps) {
  return (
    <div className="rounded-xl border border-border bg-secondary p-1">
      <div className="flex items-center gap-1">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card/70'
              )}
            >
              <span className="truncate">{item.label}</span>
              {typeof item.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] leading-none',
                    active ? 'bg-white/14 text-primary-foreground/70' : 'bg-card/80 text-muted-foreground'
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update WorkspaceNoteCard.tsx — replace hardcoded colors**

Replace all inline hex colors:
- `border-[#e7e2d8]` → `border-border`
- `bg-white` → `bg-card`
- `hover:bg-[#fbfaf6]` → `hover:bg-muted`
- `bg-[#f3f1eb]` → `bg-secondary`
- `text-[#6e7c72]` → `text-muted-foreground`
- `text-[#88938c]` → `text-muted-foreground`
- `text-[#6ead71]` → `text-primary`
- `text-[#173628]` → `text-foreground`
- `text-[#5f6d63]` → `text-muted-foreground`
- `text-[#1f3528]` → `text-foreground`
- `text-[#8b968e]` → `text-muted-foreground`
- `text-[#95a097]` → `text-muted-foreground`
- `border-[#f0ece4]` → `border-border`
- `text-[#526357]` → `text-muted-foreground`
- `hover:bg-[#f8f6f1]` → `hover:bg-muted`
- `bg-[#173628]` → `bg-primary`
- `text-[#f5efe9]` → `text-primary-foreground`
- `hover:bg-[#0f2d20]` → `hover:bg-primary/80`

- [ ] **Step 6: Update WorkspaceActionDialog.tsx and WorkspaceNoteEditorDialog.tsx**

Read both files, then replace hardcoded colors with theme tokens using the same mapping pattern.

- [ ] **Step 7: Build and verify**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm run build 2>&1 | tail -10
```

- [ ] **Step 8: Commit**

```bash
git add src/popup/ src/components/workspace/
git commit -m "feat: replace hardcoded hex colors with theme tokens in popup and workspace"
```

---

### Task 10: Replace Hardcoded Colors in Sidepanel Pages

**Files:**
- Modify: `src/sidepanel/App.tsx`
- Modify: `src/sidepanel/components/SidePanelShell.tsx`
- Modify: `src/sidepanel/components/NoteCard.tsx`
- Modify: `src/sidepanel/components/SegmentedControl.tsx`
- Modify: all other sidepanel component files with hardcoded colors

- [ ] **Step 1: Read all sidepanel component files for hardcoded colors**

Use grep to find all hardcoded hex patterns:

```bash
grep -n '#[0-9a-fA-F]\{6\}\|rgba(' src/sidepanel/components/*.tsx
```

- [ ] **Step 2: Apply the same color mapping as Task 9**

For each file, replace hardcoded hex/rgba values with Tailwind theme tokens. The mapping is the same as Task 9.

- [ ] **Step 3: Build and verify**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add src/sidepanel/
git commit -m "feat: replace hardcoded hex colors with theme tokens in sidepanel"
```

---

### Task 11: Update Content Script Colors

**Files:**
- Modify: `src/content/index.tsx`
- Modify: `src/content/overlay-ui.ts`
- Modify: `src/content/editor-surface.ts`

The content script uses inline DOM styles (no Tailwind), so we replace hardcoded hex/rgba values with the new teal-based palette. Since the content script injects into arbitrary pages and can't use CSS custom properties from our stylesheet, we use concrete color values that match the preset palette.

**New palette constants** (derive from oklch values for use in inline styles):
```
Primary dark:     #1e2a30  (oklch(0.148 0.004 228.8) ≈ foreground)
Primary teal:     #1a8a6e  (oklch(0.508 0.118 165.612) ≈ primary)
Light teal:       #7dd3c8  (oklch(0.865 0.127 207.078) ≈ chart-1)
Light foreground: #ebf5f0  (oklch(0.979 0.021 166.113) ≈ primary-foreground)
Surface white:    #ffffff  (oklch(1 0 0) ≈ background)
Muted bg:         #f2f4f5  (oklch(0.963 0.002 197.1) ≈ muted)
Border:           #e3e8ea  (oklch(0.925 0.005 214.3) ≈ border)
Muted text:       #7e8f96  (oklch(0.56 0.021 213.5) ≈ muted-foreground)
Destructive:      #dc4a2f  (oklch(0.577 0.245 27.325) ≈ destructive)
```

- [ ] **Step 1: Update content/index.tsx — CSS rules**

In the `highlightStyle.textContent` template literal, replace colors:

```css
.canopy-highlight {
  outline: 2px solid oklch(0.508 0.118 165.612 / 0.8) !important;
  outline-offset: 2px !important;
  background-color: oklch(0.865 0.127 207.078 / 0.08) !important;
  transition: outline 0.15s ease, background-color 0.15s ease !important;
  cursor: crosshair !important;
}
.canopy-selected {
  outline: 2px solid oklch(0.508 0.118 165.612) !important;
  outline-offset: 2px !important;
  background-color: oklch(0.865 0.127 207.078 / 0.12) !important;
}
.canopy-has-note {
  position: relative !important;
  outline: 1px solid oklch(0.865 0.127 207.078 / 0.28) !important;
  outline-offset: 1px !important;
}
::highlight(canopy-text-selection) {
  background-color: oklch(0.865 0.127 207.078 / 0.3) !important;
  border-bottom: 2px dashed oklch(0.508 0.118 165.612 / 0.8);
  color: inherit;
}
@keyframes canopy-pulse {
  0%, 100% { box-shadow: 0 2px 8px oklch(0.148 0.004 228.8 / 0.2); }
  50% { box-shadow: 0 2px 12px oklch(0.148 0.004 228.8 / 0.4); }
}
@keyframes canopy-fadein {
  from { opacity: 0; transform: scale(0.8) translateY(4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
```

- [ ] **Step 2: Update content/overlay-ui.ts**

Replace all inline style color values throughout the file using this mapping:
- `rgba(5,36,21,0.96)` → `oklch(0.148 0.004 228.8 / 0.96)`
- `#F5EFE9` → `oklch(0.979 0.021 166.113)`
- `rgba(171,255,192,0.18)` → `oklch(0.865 0.127 207.078 / 0.18)`
- `rgba(5,36,21,0.22)` → `oklch(0.148 0.004 228.8 / 0.22)`
- `rgba(171,255,192,0.14)` → `oklch(0.865 0.127 207.078 / 0.14)`
- `#ABFFC0` → `oklch(0.865 0.127 207.078)`
- `rgba(245,239,233,0.84)` → `oklch(0.979 0.021 166.113 / 0.84)`
- `rgba(171,255,192,0.16)` → `oklch(0.865 0.127 207.078 / 0.16)`
- `rgba(26,92,46,0.98)` → `oklch(0.508 0.118 165.612 / 0.98)`
- `rgba(171,255,192,0.26)` → `oklch(0.865 0.127 207.078 / 0.26)`
- `rgba(5,36,21,0.28)` → `oklch(0.148 0.004 228.8 / 0.28)`
- `#052415` → `oklch(0.148 0.004 228.8)`
- `rgba(5,36,21,0.2)` → `oklch(0.148 0.004 228.8 / 0.2)`
- `rgba(5,36,21,0.94)` → `oklch(0.148 0.004 228.8 / 0.94)`
- `rgba(171,255,192,0.14)` → `oklch(0.865 0.127 207.078 / 0.14)`
- `rgba(5,36,21,0.18)` → `oklch(0.148 0.004 228.8 / 0.18)`
- `#FAFAF7` → `oklch(1 0 0)`
- `rgba(5,36,21,0.06)` → `oklch(0.148 0.004 228.8 / 0.06)`
- `rgba(5,36,21,0.12)` → `oklch(0.148 0.004 228.8 / 0.12)`

- [ ] **Step 3: Update content/editor-surface.ts**

Apply the same color mapping:
- `#FAFAF7` → `oklch(1 0 0)`
- `rgba(5,36,21,0.06)` → `oklch(0.148 0.004 228.8 / 0.06)`
- `rgba(5,36,21,0.12)` → `oklch(0.148 0.004 228.8 / 0.12)`
- `linear-gradient(135deg,#052415,#1a5c2e)` → `linear-gradient(135deg, oklch(0.148 0.004 228.8), oklch(0.508 0.118 165.612))`
- `#052415` → `oklch(0.148 0.004 228.8)`
- `rgba(220,38,38,0.08)` → `oklch(0.577 0.245 27.325 / 0.08)`
- `#b91c1c` → `oklch(0.577 0.245 27.325)`
- `rgba(5,36,21,0.04)` → `oklch(0.148 0.004 228.8 / 0.04)`
- `#7a8a7d` → `oklch(0.56 0.021 213.5)`
- `#FFFFFF` → `oklch(1 0 0)`
- `rgba(5,36,21,0.1)` → `oklch(0.148 0.004 228.8 / 0.1)`
- `rgba(171,255,192,0.28)` → `oklch(0.865 0.127 207.078 / 0.28)`
- `#1a5c2e` → `oklch(0.508 0.118 165.612)`
- `rgba(5,36,21,0.08)` → `oklch(0.148 0.004 228.8 / 0.08)`
- `#F5EFE9` → `oklch(0.979 0.021 166.113)`
- `#7a867e` → `oklch(0.56 0.021 213.5)`

- [ ] **Step 4: Build and verify**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm run build 2>&1 | tail -10
```

- [ ] **Step 5: Run tests**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
npm test 2>&1 | tail -20
```

The overlay-ui and editor-surface have unit tests. Verify they still pass — they test structure, not colors, so they should be fine.

- [ ] **Step 6: Commit**

```bash
git add src/content/
git commit -m "feat: update content script inline colors to teal oklch palette"
```

---

### Task 12: Remove lucide-react Dependency and Final Verification

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify no remaining lucide-react imports**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
grep -r "lucide-react" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results. If any remain, fix them.

- [ ] **Step 2: Remove lucide-react**

```bash
npm uninstall lucide-react
```

- [ ] **Step 3: Full build**

```bash
npm run build 2>&1
```

Expected: Clean build with no errors.

- [ ] **Step 4: Run all tests**

```bash
npm test 2>&1
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove lucide-react dependency (replaced by @hugeicons/react)"
```

---

### Task 13: Final Review Build

- [ ] **Step 1: Clean build from scratch**

```bash
cd "/Users/ayubmohamed/Vibe Coding Projects/DivNotes/.worktrees/shadcn-preset"
rm -rf dist
npm run build 2>&1
```

- [ ] **Step 2: Verify dist output**

```bash
ls -la dist/
ls -la dist/assets/
```

Check that CSS files contain oklch values and Inter font references.

- [ ] **Step 3: Verify extension loads**

Load `dist/` as unpacked extension in Chrome. Check:
- Popup opens and renders with teal theme
- Sidepanel opens with teal theme
- Content script overlay/badges show teal colors
- Dark mode toggle works (if implemented)
- Icons render correctly

Report any issues for follow-up.
