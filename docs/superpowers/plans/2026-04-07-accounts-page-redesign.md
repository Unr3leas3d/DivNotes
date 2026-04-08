# Accounts Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign SettingsView into a unified single-card accounts page with profile avatar, sync status dot, billing CTA, and consolidated data/about sections.

**Architecture:** Add `avatarUrl` and `fullName` fields to `WorkspaceAuth`, populated from Supabase `session.user.user_metadata`. Rewrite `SettingsView` component to single-card layout. Update both popup and sidepanel callers to pass new props.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase Auth (`user_metadata`)

---

### Task 1: Add `avatarUrl` and `fullName` to WorkspaceAuth

**Files:**
- Modify: `src/lib/extension-workspace-types.ts:18-29`
- Modify: `src/lib/use-extension-workspace.ts:81-135`

- [ ] **Step 1: Add fields to WorkspaceAuth interface**

In `src/lib/extension-workspace-types.ts`, add two fields to `WorkspaceAuth`:

```typescript
export interface WorkspaceAuth {
  mode: AuthMode;
  email: string;
  label: string;
  isLocalMode: boolean;
  isAuthenticated: boolean;
  plan: StoredAccountState['plan'];
  entitlementStatus: EntitlementStatus | null;
  billingProvider: BillingProvider;
  subscriptionInterval: SubscriptionInterval;
  cloudSyncEnabled: boolean;
  avatarUrl: string | null;
  fullName: string | null;
}
```

- [ ] **Step 2: Update buildLoginAuth to include new fields**

In `src/lib/use-extension-workspace.ts`, update `buildLoginAuth()`:

```typescript
function buildLoginAuth(): WorkspaceAuth {
  return {
    mode: 'login',
    email: '',
    label: '',
    isLocalMode: false,
    isAuthenticated: false,
    plan: null,
    entitlementStatus: null,
    billingProvider: null,
    subscriptionInterval: null,
    cloudSyncEnabled: false,
    avatarUrl: null,
    fullName: null,
  };
}
```

- [ ] **Step 3: Update buildWorkspaceAuth to accept and pass user_metadata**

Change the signature and both return branches in `buildWorkspaceAuth`:

```typescript
function buildWorkspaceAuth(
  storedAuth: StoredWorkspaceAuth | null | undefined,
  storedAccount: StoredAccountState | null | undefined,
  fallbackEmail = '',
  userMetadata?: { avatar_url?: string; full_name?: string } | null,
): WorkspaceAuth {
  const account = storedAccount ?? buildStoredAccountFallback(storedAuth, fallbackEmail);

  if (account.authMode === 'local') {
    return {
      mode: 'local',
      email: '',
      label: 'Local Mode',
      isLocalMode: true,
      isAuthenticated: true,
      plan: null,
      entitlementStatus: null,
      billingProvider: null,
      subscriptionInterval: null,
      cloudSyncEnabled: false,
      avatarUrl: null,
      fullName: null,
    };
  }

  if (account.authMode === 'authenticated') {
    const email = account.email || fallbackEmail || storedAuth?.email || '';
    return {
      mode: 'authenticated',
      email,
      label: email,
      isLocalMode: false,
      isAuthenticated: true,
      plan: account.plan,
      entitlementStatus: account.entitlementStatus,
      billingProvider: account.billingProvider,
      subscriptionInterval: account.subscriptionInterval,
      cloudSyncEnabled: account.cloudSyncEnabled,
      avatarUrl: userMetadata?.avatar_url ?? null,
      fullName: userMetadata?.full_name ?? null,
    };
  }

  return buildLoginAuth();
}
```

- [ ] **Step 4: Pass user_metadata from session in all callsites**

In `src/lib/use-extension-workspace.ts`, update every call to `buildWorkspaceAuth` that has access to a session to pass `session?.user?.user_metadata`. There are several callsites:

**Callsite ~line 416** (storedAuth without session — offline/cached):
```typescript
setAuth(buildWorkspaceAuth(storedAuth, account));
```
No session available here, leave as-is (avatarUrl/fullName will be null, which is fine for offline fallback).

**Callsite ~line 437** (storedAuth authenticated with session):
```typescript
setAuth(buildWorkspaceAuth(storedAuth, account, email, session?.user?.user_metadata));
```

**Callsite ~line 454** (session.user exists, no storedAuth):
```typescript
setAuth(buildWorkspaceAuth({ mode: 'authenticated', email }, account, email, session.user.user_metadata));
```

**In `onAuthStateChange` callback** — find the calls to `buildWorkspaceAuth` inside `supabase.auth.onAuthStateChange` and pass `session?.user?.user_metadata` where session is available.

- [ ] **Step 5: Build and verify no type errors**

Run: `npm run build:pages 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/extension-workspace-types.ts src/lib/use-extension-workspace.ts
git commit -m "feat: add avatarUrl and fullName to WorkspaceAuth from user_metadata"
```

---

### Task 2: Rewrite SettingsView component

**Files:**
- Modify: `src/popup/components/SettingsView.tsx` (full rewrite)

- [ ] **Step 1: Rewrite SettingsView with new props and single-card layout**

Replace the entire contents of `src/popup/components/SettingsView.tsx` with the new component. Key changes from the old component:

**New props interface:**
```typescript
interface SettingsViewProps {
  email: string;
  avatarUrl: string | null;
  fullName: string | null;
  isLocalMode: boolean;
  billingStatusLabel: 'Free' | 'Pro' | 'Inactive';
  cloudSyncEnabled: boolean;
  version: string;
  noteCount: number;
  folderCount: number;
  tagCount: number;
  chromeWebStoreUrl: string;
  privacyPolicyUrl: string;
  onLogout: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onImport: () => void | Promise<void>;
  onClearAll: () => void | Promise<void>;
  onUpgrade: () => void | Promise<void>;
  onContactSupport: () => void | Promise<void>;
}
```

**Removed props:** `sectionTitles`, `labels`, `billingStatusText`, `showSidePanelAction`, `onOpenSidePanel`, `onUpgradeMonthly`, `onUpgradeYearly`, `onManageBilling`.

**Added props:** `avatarUrl`, `fullName`, `cloudSyncEnabled`, `onUpgrade`, `onContactSupport`.

**Full component implementation:**

```tsx
import React from 'react';
import { LinkSquare02Icon, Database01Icon } from '@hugeicons/core-free-icons';
import { HugeIcon } from '@/components/ui/huge-icon';

interface SettingsViewProps {
  email: string;
  avatarUrl: string | null;
  fullName: string | null;
  isLocalMode: boolean;
  billingStatusLabel: 'Free' | 'Pro' | 'Inactive';
  cloudSyncEnabled: boolean;
  version: string;
  noteCount: number;
  folderCount: number;
  tagCount: number;
  chromeWebStoreUrl: string;
  privacyPolicyUrl: string;
  onLogout: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onImport: () => void | Promise<void>;
  onClearAll: () => void | Promise<void>;
  onUpgrade: () => void | Promise<void>;
  onContactSupport: () => void | Promise<void>;
}

function getInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts[0]) return parts[0][0].toUpperCase();
  }
  return email ? email[0].toUpperCase() : '?';
}

function ActionButton({
  label,
  onClick,
  destructive = false,
}: {
  label: string;
  onClick: () => void | Promise<void>;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => { void onClick(); }}
      className={
        destructive
          ? 'flex h-[40px] w-full items-center justify-center rounded-[12px] border border-destructive/20 bg-destructive/5 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/10'
          : 'flex h-[40px] w-full items-center justify-center rounded-[12px] border border-border bg-secondary text-[12px] font-semibold text-foreground transition-colors hover:bg-secondary/80'
      }
    >
      {label}
    </button>
  );
}

export function SettingsView({
  email,
  avatarUrl,
  fullName,
  isLocalMode,
  billingStatusLabel,
  cloudSyncEnabled,
  version,
  noteCount,
  folderCount,
  tagCount,
  chromeWebStoreUrl,
  privacyPolicyUrl,
  onLogout,
  onExport,
  onImport,
  onClearAll,
  onUpgrade,
  onContactSupport,
}: SettingsViewProps) {
  const displayName = fullName || email || 'Local Mode';
  const planLabel = isLocalMode ? 'Local Mode' : billingStatusLabel === 'Pro' ? 'Pro Plan' : 'Free Plan';
  const isPro = billingStatusLabel === 'Pro';

  return (
    <section className="rounded-[18px] border border-border bg-card shadow-card">
      {/* Profile Header */}
      <div className="relative flex flex-col items-center px-5 pb-5 pt-7">
        {!isLocalMode && (
          <button
            type="button"
            onClick={() => { void onLogout(); }}
            className="absolute right-4 top-4 rounded-[10px] border border-border bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/80"
          >
            Log Out
          </button>
        )}

        {/* Avatar with sync dot */}
        <div className="relative mb-3.5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-[72px] w-[72px] rounded-full border-[2.5px] border-border object-cover"
            />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[2.5px] border-border bg-secondary text-[22px] font-bold text-muted-foreground">
              {getInitials(fullName, email)}
            </div>
          )}
          {!isLocalMode && (
            <span
              className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-card ${
                cloudSyncEnabled ? 'bg-emerald-400' : 'bg-muted-foreground/40'
              }`}
            />
          )}
        </div>

        <p className="text-[17px] font-bold text-foreground">{displayName}</p>
        <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">{planLabel}</p>
      </div>

      {/* Billing Message */}
      {!isLocalMode && (
        <div className="px-5 pb-5">
          <div className="rounded-[14px] border border-border bg-secondary/50 px-4 py-3.5 text-center">
            <p className="text-[12px] font-medium text-foreground">
              Signed in to the {isPro ? 'Pro' : 'Free'} plan
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isPro ? 'Cloud sync is active' : 'Cloud sync requires Pro billing'}
            </p>
            <button
              type="button"
              onClick={() => { void (isPro ? onContactSupport() : onUpgrade()); }}
              className="mt-3.5 flex h-[38px] w-full items-center justify-center rounded-[11px] bg-primary text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
            >
              {isPro ? 'Contact Support' : 'Purchase Pro Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mx-5 h-px bg-border" />

      {/* Data Section */}
      <div className="px-5 py-[18px]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Data</p>
        <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[14px] bg-secondary px-2 py-3">
            <p className="text-[15px] font-semibold text-foreground">{noteCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Notes</p>
          </div>
          <div className="rounded-[14px] bg-secondary px-2 py-3">
            <p className="text-[15px] font-semibold text-foreground">{folderCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Folders</p>
          </div>
          <div className="rounded-[14px] bg-secondary px-2 py-3">
            <p className="text-[15px] font-semibold text-foreground">{tagCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Tags</p>
          </div>
        </div>
        <div className="mt-3.5 space-y-2">
          <ActionButton label="Export Notes" onClick={onExport} />
          <ActionButton label="Import Notes" onClick={onImport} />
          <ActionButton label="Clear All Notes" onClick={onClearAll} destructive />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-border" />

      {/* About Section */}
      <div className="px-5 py-[18px]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">About</p>
        <div className="mt-3.5 space-y-2">
          <div className="flex items-center gap-2 rounded-[14px] bg-secondary px-3 py-3 text-[12px] text-muted-foreground">
            <HugeIcon icon={Database01Icon} className="h-3.5 w-3.5" />
            <span>
              Version: <strong className="font-semibold text-foreground">{version}</strong>
            </span>
          </div>
          <a
            href={chromeWebStoreUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-[14px] border border-border bg-secondary px-3 py-3 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary/80"
          >
            <span>Chrome Web Store</span>
            <HugeIcon icon={LinkSquare02Icon} className="h-3.5 w-3.5" />
          </a>
          <a
            href={privacyPolicyUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-[14px] border border-border bg-secondary px-3 py-3 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary/80"
          >
            <span>Privacy Policy</span>
            <HugeIcon icon={LinkSquare02Icon} className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build and verify no type errors in SettingsView itself**

Run: `npx tsc --noEmit --pretty 2>&1 | grep SettingsView | head -20`
Expected: Errors only from callers (Dashboard.tsx, sidepanel App.tsx) due to changed props — that's expected, we fix those in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/popup/components/SettingsView.tsx
git commit -m "feat: rewrite SettingsView to single-card accounts page layout"
```

---

### Task 3: Update popup Dashboard caller

**Files:**
- Modify: `src/popup/Dashboard.tsx:340-363`

- [ ] **Step 1: Remove old settings constants**

Delete the `settingsSectionTitles` and `settingsLabels` constants (around lines 41-57). They are no longer needed.

- [ ] **Step 2: Update SettingsView usage**

Replace the SettingsView render block (inside `case 'settings':`) with:

```tsx
case 'settings':
    return (
        <SettingsView
            email={email}
            avatarUrl={workspace.auth.avatarUrl}
            fullName={workspace.auth.fullName}
            isLocalMode={isLocalMode}
            billingStatusLabel={billingStatusLabel}
            cloudSyncEnabled={workspace.auth.cloudSyncEnabled}
            version={chrome.runtime.getManifest().version}
            noteCount={workspace.data.notes.length}
            folderCount={workspace.data.folders.length}
            tagCount={workspace.data.tags.length}
            chromeWebStoreUrl={chromeWebStoreUrl}
            privacyPolicyUrl={privacyPolicyUrl}
            onLogout={onLogout}
            onExport={workspace.actions.exportNotes}
            onImport={workspace.actions.importNotes}
            onClearAll={() => setDialogState(getInitialClearAllDialogState())}
            onUpgrade={() => void workspace.actions.startUpgrade('monthly')}
            onContactSupport={() => {
                window.open('mailto:support@divnotes.com', '_blank');
            }}
        />
    );
```

- [ ] **Step 3: Clean up unused billingStatusText**

The `billingStatusText` variable computed around lines 93-99 is no longer used. Remove it.

- [ ] **Step 4: Clean up unused imports**

Remove the `settingsSectionTitles` and `settingsLabels` references. Check if `CreditCardIcon`, `HardDriveIcon`, `UserCircle02Icon` were imported in Dashboard — if so, remove unused ones.

- [ ] **Step 5: Build and verify**

Run: `npm run build:pages 2>&1 | tail -5`
Expected: May still show errors from sidepanel caller (fixed in Task 4). Check that popup-specific errors are resolved.

- [ ] **Step 6: Commit**

```bash
git add src/popup/Dashboard.tsx
git commit -m "feat: update popup Dashboard to use new SettingsView props"
```

---

### Task 4: Update sidepanel caller

**Files:**
- Modify: `src/sidepanel/components/SettingsView.tsx` (full rewrite — thin wrapper)
- Modify: `src/sidepanel/App.tsx:274-296`

- [ ] **Step 1: Rewrite sidepanel SettingsView wrapper**

Replace the contents of `src/sidepanel/components/SettingsView.tsx`:

```tsx
import React from 'react';
import { SettingsView as WorkspaceSettingsView } from '@/popup/components/SettingsView';

interface SettingsViewProps {
  email: string;
  avatarUrl: string | null;
  fullName: string | null;
  isLocalMode: boolean;
  billingStatusLabel: 'Free' | 'Pro' | 'Inactive';
  cloudSyncEnabled: boolean;
  version: string;
  noteCount: number;
  folderCount: number;
  tagCount: number;
  chromeWebStoreUrl: string;
  privacyPolicyUrl: string;
  onLogout: () => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onImport: () => void | Promise<void>;
  onClearAll: () => void | Promise<void>;
  onUpgrade: () => void | Promise<void>;
  onContactSupport: () => void | Promise<void>;
}

export function SettingsView(props: SettingsViewProps) {
  return <WorkspaceSettingsView {...props} />;
}
```

- [ ] **Step 2: Update sidepanel App.tsx SettingsView usage**

Replace the SettingsView render block (around lines 274-296):

```tsx
{workspace.view.active === 'settings' ? (
  <SettingsView
    email={workspace.auth.email}
    avatarUrl={workspace.auth.avatarUrl}
    fullName={workspace.auth.fullName}
    isLocalMode={workspace.auth.isLocalMode}
    billingStatusLabel={billingStatusLabel}
    cloudSyncEnabled={workspace.auth.cloudSyncEnabled}
    version={chrome.runtime.getManifest().version}
    noteCount={workspace.data.notes.length}
    folderCount={workspace.data.folders.length}
    tagCount={workspace.data.tags.length}
    chromeWebStoreUrl={chromeWebStoreUrl}
    privacyPolicyUrl={privacyPolicyUrl}
    onLogout={workspace.actions.logout}
    onExport={workspace.actions.exportNotes}
    onImport={workspace.actions.importNotes}
    onClearAll={() => {
      setClearAllDialogError(null);
      setClearAllDialogOpen(true);
    }}
    onUpgrade={() => void workspace.actions.startUpgrade('monthly')}
    onContactSupport={() => {
      window.open('mailto:support@divnotes.com', '_blank');
    }}
  />
) : null}
```

- [ ] **Step 3: Clean up unused billingStatusText in App.tsx**

Remove the `billingStatusText` variable (around lines 67-73) — no longer used.

- [ ] **Step 4: Build and verify everything compiles**

Run: `npm run build:pages 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/components/SettingsView.tsx src/sidepanel/App.tsx
git commit -m "feat: update sidepanel to use new SettingsView props"
```

---

### Task 5: Pass user_metadata through onAuthStateChange

**Files:**
- Modify: `src/lib/use-extension-workspace.ts` (onAuthStateChange callback, ~line 484+)

- [ ] **Step 1: Find and update onAuthStateChange callback**

Inside the `supabase.auth.onAuthStateChange` callback, find all calls to `buildWorkspaceAuth` and pass `session?.user?.user_metadata` as the fourth argument. The callback receives `(_event, session)` so `session?.user?.user_metadata` is available.

Look for patterns like:
```typescript
setAuth(buildWorkspaceAuth(someStoredAuth, someAccount, email));
```
And update to:
```typescript
setAuth(buildWorkspaceAuth(someStoredAuth, someAccount, email, session?.user?.user_metadata));
```

- [ ] **Step 2: Build and verify**

Run: `npm run build:pages 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/use-extension-workspace.ts
git commit -m "feat: pass user_metadata through onAuthStateChange for avatar/name"
```

---

### Task 6: Final build verification and manual test

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: All three build steps succeed (pages, content, service worker).

- [ ] **Step 2: Manual test checklist**

Load the `dist/` folder as an unpacked extension:

1. Open popup → navigate to Settings → verify single-card layout renders
2. Check avatar shows initials (if local mode) or Google profile image (if authenticated)
3. Check sync dot: green for Pro+active, gray otherwise
4. Check "Purchase Pro Plan" CTA for free users
5. Check "Contact Support" CTA for pro users (both use primary green style)
6. Check logout button in top-right corner works
7. Check data section: note/folder/tag counts, export, import, clear all buttons work
8. Check about section: version, Chrome Web Store link, Privacy Policy link
9. Open side panel → navigate to Settings → verify same layout

- [ ] **Step 3: Commit any fixes if needed**
