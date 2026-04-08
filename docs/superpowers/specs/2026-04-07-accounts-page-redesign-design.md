# Accounts Page Redesign

## Overview

Redesign the SettingsView into a unified single-card accounts page with a profile-centric header, billing messaging, data management, and about section. The page sources user profile data (name, avatar) from Supabase `user_metadata` provided by Google auth.

## Layout

Everything lives in **one card** (`rounded-[18px] border border-border bg-card shadow-card`), with horizontal dividers separating sections.

### 1. Profile Header

- **Avatar**: 72px circular image from `session.user.user_metadata.avatar_url`. Fallback: initials derived from `full_name` (or first letter of email) in a `bg-secondary` circle.
- **Sync status dot**: 14px circle at bottom-right of avatar, with a 2.5px card-colored border.
  - Green (`#34d399`) when `cloudSyncEnabled === true` (Pro + active entitlement).
  - Muted (`bg-muted-foreground/40`) otherwise.
- **Name**: `session.user.user_metadata.full_name`, bold, centered below avatar. Falls back to email if no name.
- **Plan label**: "Free Plan" or "Pro Plan" in muted text below name. Derived from `account.plan`.
- **Logout button**: Small ghost button in top-right corner of the profile header area. Styled: `bg-secondary border border-border rounded-[10px] text-[11px] font-semibold text-muted-foreground`.

### 2. Billing Message

Sits below profile header, inside a `bg-secondary/50 border border-border rounded-[14px]` box, centered text.

**Free plan:**
- Line 1: "Signed in to the Free plan"
- Line 2: "Cloud sync requires Pro billing"
- CTA: "Purchase Pro Plan" — primary button (`bg-primary text-primary-foreground rounded-[11px] h-[38px]`)

**Pro plan:**
- Line 1: "Signed in to the Pro plan"
- Line 2: "Cloud sync is active"
- CTA: "Contact Support" — same primary button style for visual consistency

### 3. Data Section

Separated by a horizontal divider. Section title: "DATA" (uppercase, `text-[10px] tracking-[0.16em] text-muted-foreground`).

- **Stats grid**: 3-column grid showing note count, folder count, tag count. Each cell: `bg-secondary rounded-[14px]` with bold value and uppercase label.
- **Action buttons** (stacked, 8px gap):
  - Export Notes — secondary style
  - Import Notes — secondary style
  - Clear All Notes — destructive style

### 4. About Section

Separated by a horizontal divider. Section title: "ABOUT".

- **Version row**: `bg-secondary rounded-[14px]` with "Version" label and bold version value.
- **Chrome Web Store**: Link row with external arrow icon (`↗`), opens in new tab.
- **Privacy Policy**: Link row with external arrow icon, opens in new tab.

## Data Flow

### User metadata access

The Supabase session object (`supabase.auth.getSession()`) returns `session.user.user_metadata` which includes:
- `full_name` — from Google auth
- `avatar_url` — from Google auth
- `email` — from Google auth

No changes to the `profiles` table or `account-state.ts` types are needed. The component reads `user_metadata` directly from the session at render time.

### Sync status

Derived from existing `StoredAccountState.cloudSyncEnabled` boolean, already computed by `buildStoredAccountState()` in `account-state.ts`.

### Billing CTA actions

- **Purchase Pro Plan**: Opens Polar checkout URL (same as existing `onUpgradeMonthly`/`onUpgradeYearly` — consolidated to a single action since pricing page handles plan selection).
- **Contact Support**: Opens support URL (e.g., mailto or external link).

## Component Changes

### `src/popup/components/SettingsView.tsx`

Rewrite the component to the single-card layout. Key prop changes:
- Add: `avatarUrl: string | null`, `fullName: string | null`, `cloudSyncEnabled: boolean`
- Remove: `showSidePanelAction`, `onOpenSidePanel`, `onUpgradeYearly` (consolidate to single `onUpgrade`)
- Rename: `onUpgradeMonthly` → `onUpgrade`, add `onContactSupport`
- Remove: `sectionTitles` and `labels` props — hardcode strings since they aren't i18n'd anywhere

### Callers

Update both popup and sidepanel callers to pass `avatarUrl`, `fullName`, and `cloudSyncEnabled` from the Supabase session and account state.

## Scope Exclusions

- No Obsidian plugin connection status tracking.
- No changes to auth flow or profile schema.
- No i18n — strings are hardcoded (matching current pattern).
