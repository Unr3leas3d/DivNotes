# Landing Page Redesign — Design Spec

## Overview

Redesign the Canopy landing page (`landing/`) to showcase all features with Playwright-captured screenshots, add a pricing section with monthly/yearly toggle, dark mode support, and highlight the new Obsidian plugin integration.

## Page Structure

Single long-scroll page. No separate routes except existing `#/privacy`.

### 1. Nav Bar (sticky)

- Logo (existing Canopy SVG tree icon) + "Canopy" wordmark (Georgia serif)
- Links: Features (anchor), Pricing (anchor)
- Dark mode toggle: `Sun03Icon` / `Moon02Icon` from `@hugeicons/core-free-icons`, rendered via `HugeiconsIcon` from `@hugeicons/react`. 32×32 bordered button, `strokeWidth: 1.8`
- "Add to Chrome" CTA button (primary)

### 2. Hero

- Headline: "Think on top of the web."
- Subtitle: "Select any element on any webpage and attach notes directly to it. Stay local for free, or upgrade to Pro for cloud sync."
- Two CTAs: "Add to Chrome — Free" (primary), "See How It Works" (secondary, scrolls to features)
- Social proof stats: 2,400+ Users, 50,000+ Notes, 4.8★ Rating

### 3. Hero Screenshot

- Full-width Playwright screenshot of the content script overlay on a real webpage (element inspector highlighting + note badges)
- Wrapped in rounded card with shadow-hero

### 4. Features — Bento Grid

Section label "Features" + heading "Everything you need to annotate the web."

**Layout:** Popup Dashboard spans full width as lead card. Remaining 6 features in a 3×2 grid (responsive: 1 column on mobile, 2 on tablet, 3 on desktop).

Each card contains:
- HugeIcon in a 32×32 rounded container with `secondary` background
- Feature title (bold)
- 1-2 line description
- Playwright screenshot in a rounded container

**7 Feature Cards:**

| Feature | HugeIcon | Description |
|---------|----------|-------------|
| Popup Dashboard | `DashboardSquare01Icon` | See all notes for the current page. Switch between This Page, All Notes, Folders, Tags. |
| Side Panel | `LeftToRightBlockQuoteIcon` | Full workspace alongside any page. Bulk actions, search, and rich note cards. |
| Folders | `Folder01Icon` | Color-coded folders. Open any folder as a Chrome tab group. |
| Tags | `Tag01Icon` | Tag notes with custom labels. Filter across your entire workspace. |
| Cloud Sync | `CloudIcon` | Sync across devices with offline fallback. Never lose a note. |
| Element Inspector | `CursorInWindowIcon` | Hover to highlight any element. Click to attach a note right there. |
| Obsidian Plugin | `FileEditIcon` | Two-way sync to your Obsidian vault. Notes become markdown files with backlinks and domain indexes. |

The Obsidian Plugin card has a "New" badge (accent background, primary text).

### 5. Pricing

Section label "Pricing" + heading "Simple, transparent pricing."

**Monthly/Yearly Toggle Pill** — top-right of section header:
- Two segments: "Monthly" and "Yearly -17%"
- Active segment: primary background, primary-foreground text
- Inactive: muted-foreground text
- State managed via React useState, defaults to yearly

**Two pricing cards side-by-side (1 col on mobile):**

**Free Card** (card background, border):
- Tier: "Free"
- Price: $0/month
- Description: "Everything you need to annotate the web, stored locally in your browser."
- Features: Unlimited local notes, Folders & tags, Element inspector, Side panel workspace, Export & import
- CTA: "Add to Chrome — Free" (secondary/outlined button)

**Pro Card** (primary background, primary-foreground text, elevated shadow):
- "Popular" badge (accent bg, primary text, top-right)
- Tier: "Pro"
- Monthly view: $10/month
- Yearly view: $8.33/month, "Billed $100/year" subtitle
- Description: "Sync notes across every device with cloud backup and real-time sync."
- Features: Everything in Free, Cloud sync across devices, Automatic backup, Offline fallback & sync queue, Priority support
- CTA: "Upgrade to Pro" (accent background, primary text, bold)

Footer note: "Install Canopy first, then upgrade from within the extension."

### 6. Footer

- Logo + wordmark
- Links: Privacy Policy, Chrome Web Store, support@divnotes.com
- Copyright line

## Dark Mode

### Implementation
- Toggle button in nav using `Sun03Icon` (light mode shown) / `Moon02Icon` (dark mode shown)
- Add `.dark` class to `<html>` element
- Persist preference in `localStorage` key `canopy-theme`
- On load: check localStorage first, fall back to `prefers-color-scheme: media query`
- `darkMode: 'class'` already configured in `tailwind.config.js`

### Dark Mode CSS Variables (add to `index.css`)
Deep forest green theme to match Canopy brand:
- `--background`: deep forest green (~`#0d1f14`)
- `--foreground`: light sage (~`#e8f0ea`)
- `--card`: slightly lighter green (~`#142a1c`)
- `--primary`: mint accent (`hsl(140, 100%, 80%)`) — inverted from light
- `--primary-foreground`: deep green (`hsl(152, 75%, 8%)`)
- `--secondary`: white at 4% opacity
- `--muted-foreground`: muted sage (~`#5b7a62`)
- `--accent`: mint green (same as primary in dark)
- `--border`: white at 6% opacity

## Screenshots (Playwright)

### Approach
Create 7 high-fidelity HTML mockup pages that replicate the extension UI using the actual design tokens and component styles. Use Playwright to screenshot each at appropriate dimensions.

### Mockup Pages to Create

Each mockup is a standalone HTML file in `landing/screenshots/mockups/` that uses Tailwind + the extension's design tokens to render realistic UI with demo data.

| Mockup | Dimensions | Content |
|--------|-----------|---------|
| popup-dashboard.html | 380×500 | Popup shell with "This Page" tab, 3-4 sample notes with colored badges |
| side-panel.html | 400×600 | Side panel with All Notes view, multiple note cards, bulk action bar |
| folders.html | 380×500 | Popup folders view with 4-5 color-coded folders, note counts |
| tags.html | 380×500 | Popup tags view with tag pills, filtered notes |
| cloud-sync.html | 400×600 | Side panel showing sync status indicator, cross-device badge |
| element-inspector.html | 800×500 | Simulated webpage with Canopy overlay, highlighted element, note badge, inline editor |
| obsidian-vault.html | 600×400 | Simulated Obsidian-style vault showing Canopy folder, markdown notes with frontmatter |

### Playwright Script
`landing/screenshots/capture.ts` — opens each mockup, waits for render, takes PNG screenshot, saves to `landing/public/screenshots/`.

### Screenshot Output
- `landing/public/screenshots/popup-dashboard.png`
- `landing/public/screenshots/side-panel.png`
- `landing/public/screenshots/folders.png`
- `landing/public/screenshots/tags.png`
- `landing/public/screenshots/cloud-sync.png`
- `landing/public/screenshots/element-inspector.png`
- `landing/public/screenshots/obsidian-vault.png`

## Dependencies to Add (landing/package.json)

- `@hugeicons/core-free-icons` — icon SVG data
- `@hugeicons/react` — React icon renderer
- `playwright` (devDependency) — screenshot capture

## File Changes

### New Files
- `landing/src/components/ThemeToggle.tsx` — dark mode toggle button
- `landing/src/components/PricingSection.tsx` — pricing with toggle
- `landing/src/components/FeatureGrid.tsx` — bento grid of feature cards
- `landing/src/components/Footer.tsx` — footer component
- `landing/screenshots/mockups/*.html` — 7 mockup pages
- `landing/screenshots/capture.ts` — Playwright screenshot script
- `landing/public/screenshots/*.png` — captured screenshots

### Modified Files
- `landing/src/App.tsx` — rewrite to single-scroll layout with all sections
- `landing/src/index.css` — add dark mode CSS variables
- `landing/package.json` — add dependencies

## Design System

All styling uses the landing page's existing shadcn-style CSS variables. No hardcoded colors. Dark mode achieved purely through variable overrides in `.dark` class.

Icon rendering: `HugeiconsIcon` component with `strokeWidth: 1.8`, `color: "currentColor"`.
