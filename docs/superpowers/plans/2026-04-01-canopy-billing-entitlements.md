# Canopy Billing, Entitlements & Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Polar-backed billing and Supabase-backed entitlements so every signed-in user starts on Free, only active Pro accounts can access cloud sync, and upgrade/reactivation reconcile local and cloud data by diff.

**Architecture:** Keep identity in Supabase Auth, add an app-owned `profiles` entitlement layer plus `billing_events`, and enforce paid access in both the extension UI and Supabase RLS. Billing runs through Supabase Edge Functions plus Polar hosted checkout/customer portal, while the extension stays the authenticated trigger surface and the landing site handles pricing/legal copy. Reconciliation logic lives in a pure TypeScript module so upgrade/reactivation behavior is testable outside the UI.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind CSS, Chrome Extension MV3 APIs, Supabase Auth/Postgres/Edge Functions, Polar checkout/webhooks, Vitest, Node `node:test`

---

## Preflight Notes

- Execute this work in a dedicated worktree before touching production code.
- As of 2026-04-01, `npm run build` passes in the current repo and should remain a final gate.
- This repo uses mixed test styles:
  - use `node --test` for `node:test` suites such as `src/lib/google-auth.test.mjs`, `src/popup/auth-bootstrap.test.mjs`, `src/popup/auth-intent.test.mjs`, and `src/lib/extension-workspace-actions.test.ts`
  - use `npx vitest run` for Vitest suites such as `src/lib/editor-controller.test.ts` and new `.test.ts` files in this plan
- Do **not** use `npx vitest run` on the `node:test` files above. It currently reports false `No test suite found` failures even though those tests execute under Node successfully.
- Keep the landing-site scope small in this batch. The site should gain pricing and legal updates, but do **not** introduce a second authenticated web-app surface. Authenticated upgrade/manage-billing actions should still begin in the extension and finish on Polar-hosted pages.
- External configuration checkpoint before manual verification:
  - create one Polar product for `Pro`
  - create two prices: monthly and yearly
  - store the resulting price IDs in Supabase function env vars
  - configure Polar webhook delivery to the deployed `polar-webhook` function

## File Map

- `supabase/migrations/003_profiles_billing.sql`
  Create `profiles`, `billing_events`, profile bootstrap trigger, and profile/table policies.
- `supabase/migrations/004_entitlement_rls_and_note_updated_at.sql`
  Add/backfill `notes.updated_at`, add entitlement helper SQL, and tighten RLS on cloud tables.
- `supabase/functions/_shared/cors.ts`
  Shared CORS response headers for Edge Functions.
- `supabase/functions/_shared/polar.ts`
  Shared Polar fetch helpers, env access, and payload helpers.
- `supabase/functions/create-checkout-session/index.ts`
  Authenticated checkout-session creator for monthly/yearly Pro prices.
- `supabase/functions/create-customer-portal-session/index.ts`
  Authenticated customer-portal launcher.
- `supabase/functions/polar-webhook/index.ts`
  Verified webhook endpoint that logs events and mutates entitlements.
- `src/lib/account-state.ts`
  App-owned account snapshot types, profile-to-account mapping, entitlement helpers, cache helpers.
- `src/lib/account-state.test.ts`
  Pure tests for plan/status mapping and cloud gating.
- `src/lib/sync-reconciliation.ts`
  Pure diff/merge logic for notes, folders, tags, and note-tag links.
- `src/lib/sync-reconciliation.test.ts`
  Pure tests for reconciliation and conflict detection.
- `tests/canopy-billing-source.test.mjs`
  Source-inspection regression checks for migrations, edge-function files, settings CTA copy, and landing-page pricing/legal updates.
- `src/lib/extension-workspace-types.ts`
  Extend workspace auth/account types with plan and entitlement metadata.
- `src/popup/auth-bootstrap.ts`
  Bootstrap popup auth and account state together instead of auth alone.
- `src/popup/auth-bootstrap.test.mjs`
  Add account-state cases to popup bootstrap logic.
- `src/popup/App.tsx`
  Persist/read `divnotes_account`, refresh account state after auth changes and billing returns.
- `src/lib/use-extension-workspace.ts`
  Hydrate richer account state, gate cloud sync, and trigger reconciliation when entitlement turns on.
- `src/lib/extension-workspace-actions.ts`
  Add `Upgrade` and `Manage Billing` actions plus post-checkout refresh hooks.
- `src/lib/types.ts`
  Add `updatedAt` to `StoredNote`.
- `src/lib/notes-service.ts`
  Use note `updatedAt`, respect entitlement state, and stop processing queue when cloud access is inactive.
- `src/lib/folders-service.ts`
  Use entitlement state rather than raw auth mode for cloud service selection.
- `src/lib/tags-service.ts`
  Use entitlement state rather than raw auth mode for cloud service selection.
- `src/background/service-worker.js`
  Ensure any background-created notes/folders/tags carry `updatedAt` and do not enqueue cloud work blindly when entitlement is inactive.
- `src/content/index.tsx`
  Keep content-script-created notes stamping `updatedAt`.
- `src/content/note-editor-helpers.ts`
  Preserve `updatedAt` through local note persistence helpers.
- `src/popup/Dashboard.tsx`
  Pass new billing actions/account props into settings.
- `src/popup/components/SettingsView.tsx`
  Show Free/Pro/Inactive state plus monthly/yearly upgrade CTA and manage-billing CTA.
- `src/sidepanel/components/SettingsView.tsx`
  Mirror the popup settings billing surface.
- `landing/src/App.tsx`
  Add explicit Free vs Pro pricing treatment and note that billing is handled in Polar / the extension.
- `landing/src/pages/PrivacyPolicy.tsx`
  Add Polar as a billing provider and update cloud-sync wording so sign-in no longer implies paid sync.

## Task 1: Supabase Schema, Entitlement RLS, And Note Timestamp Backfill

**Files:**
- Create: `tests/canopy-billing-source.test.mjs`
- Create: `supabase/migrations/003_profiles_billing.sql`
- Create: `supabase/migrations/004_entitlement_rls_and_note_updated_at.sql`

- [ ] **Step 1: Write the failing source-inspection test for the database foundation**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('billing migrations create profile, billing-event, and entitlement-RLS foundations', () => {
  const migration003 = 'supabase/migrations/003_profiles_billing.sql';
  const migration004 = 'supabase/migrations/004_entitlement_rls_and_note_updated_at.sql';

  assert.equal(existsSync(path.join(repoRoot, migration003)), true);
  assert.equal(existsSync(path.join(repoRoot, migration004)), true);

  const profilesSql = read(migration003).toLowerCase();
  const rlsSql = read(migration004).toLowerCase();

  assert.match(profilesSql, /create table if not exists profiles/);
  assert.match(profilesSql, /create table if not exists billing_events/);
  assert.match(profilesSql, /create function.*handle_new_user_profile/s);
  assert.match(rlsSql, /alter table notes add column if not exists updated_at/);
  assert.match(rlsSql, /create or replace function.*has_active_pro_entitlement/s);
  assert.match(rlsSql, /profiles\.plan = 'pro'/);
  assert.match(rlsSql, /profiles\.entitlement_status = 'active'/);
});
```

- [ ] **Step 2: Run the source-inspection test to verify it fails**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: FAIL because the migration files do not exist yet

- [ ] **Step 3: Implement `003_profiles_billing.sql`**

Create `profiles`, `billing_events`, and a trigger that inserts a default Free profile when `auth.users` gets a new row:

```sql
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'free',
  entitlement_status text not null default 'inactive',
  billing_provider text,
  polar_customer_id text,
  polar_subscription_id text,
  subscription_interval text,
  current_period_end timestamptz,
  last_entitlement_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);
```

Also add:

- a `handle_new_user_profile()` trigger function that inserts `plan='free'` and `entitlement_status='inactive'`
- `profiles` RLS that allows only owner `select`
- no direct client mutation policy for billing fields
- no client access policy for `billing_events`

- [ ] **Step 4: Implement `004_entitlement_rls_and_note_updated_at.sql`**

Add/backfill note timestamps and tighten cloud-table access:

```sql
alter table notes add column if not exists updated_at timestamptz default now();
update notes
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

create or replace function public.has_active_pro_entitlement(target_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from profiles
    where profiles.user_id = target_user_id
      and profiles.plan = 'pro'
      and profiles.entitlement_status = 'active'
  );
$$;
```

Then replace/extend the `notes`, `folders`, `tags`, and `note_tags` policies so they require both:

- row ownership by `auth.uid()`
- `public.has_active_pro_entitlement(auth.uid())`

- [ ] **Step 5: Run the source-inspection test to verify it passes**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: PASS with 1 passing test and 0 failures

- [ ] **Step 6: Commit**

```bash
git add tests/canopy-billing-source.test.mjs supabase/migrations/003_profiles_billing.sql supabase/migrations/004_entitlement_rls_and_note_updated_at.sql
git commit -m "feat: add billing profile and entitlement schema"
```

## Task 2: Account State Model And Entitlement Hydration

**Files:**
- Create: `src/lib/account-state.ts`
- Create: `src/lib/account-state.test.ts`
- Modify: `src/lib/extension-workspace-types.ts`
- Modify: `src/popup/auth-bootstrap.ts`
- Modify: `src/popup/auth-bootstrap.test.mjs`
- Modify: `src/popup/App.tsx`
- Modify: `src/lib/use-extension-workspace.ts`

- [ ] **Step 1: Write the failing pure account-state tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildStoredAccountState,
  canUseCloudSync,
  type ProfileRecord,
} from './account-state';

const freeProfile: ProfileRecord = {
  email: 'user@example.com',
  plan: 'free',
  entitlement_status: 'inactive',
  billing_provider: null,
  subscription_interval: null,
};

describe('buildStoredAccountState', () => {
  it('maps a free profile to cloudSyncEnabled false', () => {
    const state = buildStoredAccountState({
      authMode: 'authenticated',
      email: 'user@example.com',
      profile: freeProfile,
    });

    expect(state.plan).toBe('free');
    expect(state.entitlementStatus).toBe('inactive');
    expect(state.cloudSyncEnabled).toBe(false);
  });

  it('only enables cloud sync for authenticated pro users with active entitlement', () => {
    expect(
      canUseCloudSync({
        authMode: 'authenticated',
        email: 'user@example.com',
        plan: 'pro',
        entitlementStatus: 'active',
        billingProvider: 'polar',
        subscriptionInterval: 'monthly',
        cloudSyncEnabled: true,
      })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the new account-state test to verify it fails**

Run: `npx vitest run src/lib/account-state.test.ts`
Expected: FAIL because `src/lib/account-state.ts` does not exist yet

- [ ] **Step 3: Implement `src/lib/account-state.ts`**

Create one focused module for all app-owned account-state mapping and cache helpers:

```ts
export interface ProfileRecord {
  email: string;
  plan: 'free' | 'pro';
  entitlement_status: 'inactive' | 'active' | 'past_due' | 'canceled' | 'expired';
  billing_provider: 'polar' | null;
  subscription_interval: 'monthly' | 'yearly' | null;
}

export interface StoredAccountState {
  authMode: 'login' | 'local' | 'authenticated';
  email: string;
  plan: 'free' | 'pro' | null;
  entitlementStatus: 'inactive' | 'active' | 'past_due' | 'canceled' | 'expired' | null;
  billingProvider: 'polar' | null;
  subscriptionInterval: 'monthly' | 'yearly' | null;
  cloudSyncEnabled: boolean;
}

export function buildStoredAccountState(params: {
  authMode: StoredAccountState['authMode'];
  email: string;
  profile: ProfileRecord | null;
}): StoredAccountState {
  const plan = params.profile?.plan ?? null;
  const entitlementStatus = params.profile?.entitlement_status ?? null;
  const cloudSyncEnabled =
    params.authMode === 'authenticated' && plan === 'pro' && entitlementStatus === 'active';

  return {
    authMode: params.authMode,
    email: params.email,
    plan,
    entitlementStatus,
    billingProvider: params.profile?.billing_provider ?? null,
    subscriptionInterval: params.profile?.subscription_interval ?? null,
    cloudSyncEnabled,
  };
}
```

Also add helpers to:

- read/write `divnotes_account` in `chrome.storage.local`
- normalize missing profile rows to `free/inactive`
- expose `canUseCloudSync(state)`

- [ ] **Step 4: Wire popup bootstrap and workspace hydration to use `divnotes_account`**

Update:

- `src/popup/auth-bootstrap.ts` so authenticated bootstrap fetches the current profile row and returns account state, not only email/session state
- `src/popup/App.tsx` so auth changes persist both `divnotes_auth` and `divnotes_account`
- `src/lib/use-extension-workspace.ts` so workspace auth exposes plan/status/cloud-sync metadata
- `src/lib/extension-workspace-types.ts` so the UI can read plan and billing status cleanly

Use the same rule everywhere:

```ts
const accountState = buildStoredAccountState({
  authMode: 'authenticated',
  email,
  profile,
});
```

- [ ] **Step 5: Extend the popup bootstrap tests**

Add at least:

- authenticated user with no profile row falls back to `free/inactive`
- authenticated user with `pro/active` profile yields `cloudSyncEnabled: true`
- local mode still bypasses profile fetch

- [ ] **Step 6: Run the hydration tests**

Run: `npx vitest run src/lib/account-state.test.ts`
Expected: PASS

Run: `node --test src/popup/auth-bootstrap.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/account-state.ts src/lib/account-state.test.ts src/lib/extension-workspace-types.ts src/popup/auth-bootstrap.ts src/popup/auth-bootstrap.test.mjs src/popup/App.tsx src/lib/use-extension-workspace.ts
git commit -m "feat: add account state and entitlement hydration"
```

## Task 3: Polar Edge Functions And Extension Billing Actions

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/polar.ts`
- Create: `supabase/functions/create-checkout-session/index.ts`
- Create: `supabase/functions/create-customer-portal-session/index.ts`
- Create: `supabase/functions/polar-webhook/index.ts`
- Modify: `tests/canopy-billing-source.test.mjs`
- Modify: `src/lib/extension-workspace-actions.ts`

- [ ] **Step 1: Extend the source-inspection test with billing-function assertions**

Append assertions like:

```js
test('billing edge functions and extension billing actions exist', () => {
  const checkoutFn = read('supabase/functions/create-checkout-session/index.ts');
  const portalFn = read('supabase/functions/create-customer-portal-session/index.ts');
  const webhookFn = read('supabase/functions/polar-webhook/index.ts');
  const actions = read('src/lib/extension-workspace-actions.ts');

  assert.match(checkoutFn, /POLAR_MONTHLY_PRICE_ID/);
  assert.match(checkoutFn, /POLAR_YEARLY_PRICE_ID/);
  assert.match(checkoutFn, /external_id/);
  assert.match(portalFn, /polar_customer_id/);
  assert.match(webhookFn, /customer\.state_changed/);
  assert.match(webhookFn, /billing_events/);
  assert.match(actions, /create-checkout-session/);
  assert.match(actions, /create-customer-portal-session/);
});
```

- [ ] **Step 2: Run the source-inspection test to verify it fails**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: FAIL because the function files and action wiring do not exist yet

- [ ] **Step 3: Implement shared Polar helpers and the checkout/portal functions**

In `supabase/functions/_shared/polar.ts`, centralize env access and authenticated fetch:

```ts
export function polarHeaders() {
  return {
    Authorization: `Bearer ${Deno.env.get('POLAR_ACCESS_TOKEN')}`,
    'Content-Type': 'application/json',
  };
}

export function getPriceId(interval: 'monthly' | 'yearly') {
  return interval === 'yearly'
    ? Deno.env.get('POLAR_YEARLY_PRICE_ID')
    : Deno.env.get('POLAR_MONTHLY_PRICE_ID');
}
```

In `create-checkout-session/index.ts`:

- verify the caller has a Supabase user
- accept `{ interval: 'monthly' | 'yearly' }`
- create a Polar checkout request bound to the current user via `external_id: user.id`
- return `{ url }`

In `create-customer-portal-session/index.ts`:

- verify the caller has a Supabase user
- load `profiles.polar_customer_id`
- create a Polar customer-session / portal URL
- return `{ url }`

- [ ] **Step 4: Implement the webhook function**

In `polar-webhook/index.ts`:

- verify the request signature with `POLAR_WEBHOOK_SECRET`
- insert the event into `billing_events` with `(provider, event_id)` idempotency
- use `customer.state_changed` as the canonical entitlement-sync event
- map the current provider state into `profiles.plan`, `profiles.entitlement_status`, IDs, interval, and `last_entitlement_sync_at`

Use a narrow mapping helper like:

```ts
function mapCustomerStateToEntitlement(state: string) {
  if (state === 'active') return { plan: 'pro', entitlement_status: 'active' };
  return { plan: 'free', entitlement_status: 'inactive' };
}
```

Keep the cancellation tradeoff from the spec explicit in comments: Canopy intentionally cuts off access immediately once cancellation/lapse is observed.

- [ ] **Step 5: Add extension billing actions**

In `src/lib/extension-workspace-actions.ts`, add:

- `startUpgrade(interval: 'monthly' | 'yearly')`
- `manageBilling()`

Each action should:

- call the matching Supabase Edge Function through the shared client
- open the returned URL with `chrome.tabs.create({ url })`
- surface inline action errors instead of using browser dialogs

- [ ] **Step 6: Run the source-inspection test to verify it passes**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/cors.ts supabase/functions/_shared/polar.ts supabase/functions/create-checkout-session/index.ts supabase/functions/create-customer-portal-session/index.ts supabase/functions/polar-webhook/index.ts src/lib/extension-workspace-actions.ts tests/canopy-billing-source.test.mjs
git commit -m "feat: add polar billing edge functions"
```

## Task 4: Cloud Gating And Note `updatedAt` Propagation

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/notes-service.ts`
- Modify: `src/lib/folders-service.ts`
- Modify: `src/lib/tags-service.ts`
- Modify: `src/background/service-worker.js`
- Modify: `src/content/index.tsx`
- Modify: `src/content/note-editor-helpers.ts`
- Modify: `src/popup/Dashboard.tsx`
- Modify: `tests/canopy-billing-source.test.mjs`

- [ ] **Step 1: Extend the source-inspection test for note timestamps and cloud gating**

Add assertions such as:

```js
test('cloud services key off entitlement state and notes carry updatedAt', () => {
  const types = read('src/lib/types.ts');
  const notesService = read('src/lib/notes-service.ts');
  const foldersService = read('src/lib/folders-service.ts');
  const tagsService = read('src/lib/tags-service.ts');

  assert.match(types, /updatedAt: string;/);
  assert.match(notesService, /updated_at/);
  assert.match(notesService, /cloudSyncEnabled/);
  assert.match(foldersService, /cloudSyncEnabled/);
  assert.match(tagsService, /cloudSyncEnabled/);
});
```

- [ ] **Step 2: Run the source-inspection test to verify it fails**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: FAIL because note `updatedAt` is not part of `StoredNote` and the service factories still key off authenticated-only mode

- [ ] **Step 3: Add `updatedAt` to the note model and backfill local write paths**

Update `src/lib/types.ts`:

```ts
export interface StoredNote {
  id: string;
  url: string;
  hostname: string;
  pageTitle: string;
  elementSelector: string;
  elementTag: string;
  elementInfo: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
}
```

Then update:

- `src/lib/notes-service.ts` to persist/read `updated_at`
- `src/content/index.tsx`
- `src/content/note-editor-helpers.ts`
- `src/popup/Dashboard.tsx`
- `src/background/service-worker.js`

Rule:

- on create: `updatedAt = createdAt`
- on edit: bump `updatedAt` to `new Date().toISOString()`
- when loading legacy local notes without `updatedAt`, initialize from `createdAt`

- [ ] **Step 4: Change service factories to respect entitlement**

In `src/lib/notes-service.ts`, `src/lib/folders-service.ts`, and `src/lib/tags-service.ts`, replace the current:

```ts
if (auth?.mode === 'authenticated') {
```

with a cached-account gate like:

```ts
const result = await chrome.storage.local.get(['divnotes_account']);
const account = result.divnotes_account as StoredAccountState | undefined;

if (account?.cloudSyncEnabled) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    // create cloud service
  }
}
```

Also update note queue processing so it returns early while entitlement is inactive.

- [ ] **Step 5: Run the relevant tests**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: PASS

Run: `npx vitest run src/lib/account-state.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/notes-service.ts src/lib/folders-service.ts src/lib/tags-service.ts src/background/service-worker.js src/content/index.tsx src/content/note-editor-helpers.ts src/popup/Dashboard.tsx tests/canopy-billing-source.test.mjs
git commit -m "feat: gate cloud services on active entitlement"
```

## Task 5: Reconciliation Engine And Reactivation Merge Flow

**Files:**
- Create: `src/lib/sync-reconciliation.ts`
- Create: `src/lib/sync-reconciliation.test.ts`
- Modify: `src/lib/use-extension-workspace.ts`
- Modify: `src/lib/extension-workspace-actions.ts`

- [ ] **Step 1: Write the failing reconciliation tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  reconcileWorkspaceData,
  type WorkspaceSnapshot,
} from './sync-reconciliation';

describe('reconcileWorkspaceData', () => {
  it('uploads local-only entities', () => {
    const local: WorkspaceSnapshot = {
      notes: [{ id: 'n1', updatedAt: '2026-04-01T10:00:00Z' }],
      folders: [],
      tags: [],
      noteTags: [],
    } as any;

    const cloud: WorkspaceSnapshot = {
      notes: [],
      folders: [],
      tags: [],
      noteTags: [],
    } as any;

    const result = reconcileWorkspaceData({ local, cloud });
    expect(result.upload.notes.map((note) => note.id)).toEqual(['n1']);
    expect(result.conflicts).toEqual([]);
  });

  it('flags same-id conflicts and records the newest winner', () => {
    const result = reconcileWorkspaceData({
      local: {
        notes: [{ id: 'n1', updatedAt: '2026-04-02T10:00:00Z', content: 'local' }],
        folders: [],
        tags: [],
        noteTags: [],
      } as any,
      cloud: {
        notes: [{ id: 'n1', updatedAt: '2026-04-01T10:00:00Z', content: 'cloud' }],
        folders: [],
        tags: [],
        noteTags: [],
      } as any,
    });

    expect(result.conflicts[0]).toMatchObject({
      entityType: 'note',
      entityId: 'n1',
      winningSide: 'local',
    });
  });
});
```

- [ ] **Step 2: Run the reconciliation test to verify it fails**

Run: `npx vitest run src/lib/sync-reconciliation.test.ts`
Expected: FAIL because `src/lib/sync-reconciliation.ts` does not exist yet

- [ ] **Step 3: Implement the pure reconciliation helper**

Create a pure module with one clear input/output contract:

```ts
export interface WorkspaceSnapshot {
  notes: StoredNote[];
  folders: StoredFolder[];
  tags: StoredTag[];
  noteTags: Array<{ noteId: string; tagId: string }>;
}

export interface ReconciliationResult {
  upload: WorkspaceSnapshot;
  download: WorkspaceSnapshot;
  conflicts: Array<{
    entityType: 'note' | 'folder' | 'tag';
    entityId: string;
    localUpdatedAt: string;
    cloudUpdatedAt: string;
    winningSide: 'local' | 'cloud';
  }>;
}
```

Rules:

- local-only entity -> upload
- cloud-only entity -> download
- same ID, same timestamp -> no-op
- same ID, different timestamp -> conflict + newest winner
- note-tag links compare on composite `noteId:tagId`

- [ ] **Step 4: Wire upgrade/reactivation reconciliation into the workspace**

In `src/lib/use-extension-workspace.ts`:

- detect `cloudSyncEnabled` transitions from false to true
- fetch fresh cloud snapshots through the cloud services
- load local snapshots from storage
- call `reconcileWorkspaceData`
- if `conflicts.length > 0`, surface a confirm dialog through the existing action-dialog pattern with the exact message that newest `updatedAt` wins
- after confirmation, apply upload/download diffs and then resume queue processing

In `src/lib/extension-workspace-actions.ts`:

- add a helper to refresh account/profile state after returning from checkout or portal
- add queue pruning / reset logic so stale pre-entitlement entries do not replay blindly after reconciliation

- [ ] **Step 5: Run the reconciliation tests**

Run: `npx vitest run src/lib/sync-reconciliation.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync-reconciliation.ts src/lib/sync-reconciliation.test.ts src/lib/use-extension-workspace.ts src/lib/extension-workspace-actions.ts
git commit -m "feat: add entitlement reconciliation flow"
```

## Task 6: Settings UI, Pricing Copy, And Legal Updates

**Files:**
- Modify: `src/popup/components/SettingsView.tsx`
- Modify: `src/sidepanel/components/SettingsView.tsx`
- Modify: `src/popup/Dashboard.tsx`
- Modify: `landing/src/App.tsx`
- Modify: `landing/src/pages/PrivacyPolicy.tsx`
- Modify: `tests/canopy-billing-source.test.mjs`

- [ ] **Step 1: Extend the source-inspection test for UI and landing copy**

Add assertions such as:

```js
test('settings and landing surfaces expose free/pro messaging and billing actions', () => {
  const popupSettings = read('src/popup/components/SettingsView.tsx');
  const sidepanelSettings = read('src/sidepanel/components/SettingsView.tsx');
  const landingApp = read('landing/src/App.tsx');
  const privacyPolicy = read('landing/src/pages/PrivacyPolicy.tsx');

  assert.match(popupSettings, /Upgrade Monthly/);
  assert.match(popupSettings, /Upgrade Yearly/);
  assert.match(popupSettings, /Manage Billing/);
  assert.match(sidepanelSettings, /Free|Pro|Inactive/);
  assert.match(landingApp, /Free/);
  assert.match(landingApp, /Pro/);
  assert.match(privacyPolicy, /Polar/);
});
```

- [ ] **Step 2: Run the source-inspection test to verify it fails**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: FAIL because the current settings and landing files do not expose billing copy or Polar references

- [ ] **Step 3: Update popup and sidepanel settings**

Add account/billing affordances without turning settings into a full billing UI:

- show plan badge and status text:
  - `Free`
  - `Pro`
  - `Inactive`
- if Free or Inactive:
  - show `Upgrade Monthly`
  - show `Upgrade Yearly`
- if Pro Active:
  - show `Manage Billing`

Keep all actions routed through the extension billing-action helpers from Task 3.

- [ ] **Step 4: Update the landing page and privacy policy**

In `landing/src/App.tsx`:

- replace generic pricing anchor copy with explicit Free vs Pro treatment
- state clearly that Free is local-only and Pro unlocks cloud sync
- mention billing/tax handling through Polar
- keep the CTA lightweight: `Install Canopy to Upgrade` is enough for this batch since the site has no auth surface

In `landing/src/pages/PrivacyPolicy.tsx`:

- add Polar under third-party services
- distinguish between signed-in Free and paid cloud-sync access
- keep Supabase and Google OAuth copy accurate

- [ ] **Step 5: Run the source-inspection test and build**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: PASS

Run: `npm run build`
Expected: PASS with exit code 0

- [ ] **Step 6: Commit**

```bash
git add src/popup/components/SettingsView.tsx src/sidepanel/components/SettingsView.tsx src/popup/Dashboard.tsx landing/src/App.tsx landing/src/pages/PrivacyPolicy.tsx tests/canopy-billing-source.test.mjs
git commit -m "feat: add billing status and pricing surfaces"
```

## Verification Gate

Do not call this batch complete until all of the following run fresh and pass:

1. `node --test tests/canopy-billing-source.test.mjs`
2. `node --test src/popup/auth-bootstrap.test.mjs src/popup/auth-intent.test.mjs src/lib/google-auth.test.mjs`
3. `npx vitest run src/lib/account-state.test.ts src/lib/sync-reconciliation.test.ts src/lib/editor-controller.test.ts`
4. `npm run build`

## Manual Verification Checklist

- Create a new account and confirm it lands on `Free` with local-only messaging.
- Sign in with an existing free account and confirm cloud tables are inaccessible through the app.
- Trigger `Upgrade Monthly` and confirm the extension opens a hosted Polar checkout.
- Trigger `Upgrade Yearly` and confirm the extension opens the yearly hosted checkout.
- After a successful checkout, confirm `profiles.plan='pro'`, `entitlement_status='active'`, and the extension refreshes account state.
- Upgrade a user with existing local notes and confirm reconciliation uploads/downloads only diffs.
- Create conflicting local/cloud entities and confirm the merge prompt explains that newest `updatedAt` wins.
- Cancel or lapse the subscription and confirm the extension loses cloud access immediately while cloud rows remain in Supabase.
- Reactivate the subscription and confirm retained cloud data is merged back through the reconciliation flow.

## Plan Review Notes

- The writing-plans skill asks for a delegated plan-review loop. In this session, subagent spawning is not available unless the user explicitly requests delegation, so review should be done locally against the spec before execution starts.
- The highest-risk implementation points are:
  - tightening RLS without breaking legitimate paid access
  - note `updatedAt` backfill for legacy local/cloud data
  - avoiding stale queue replay after reactivation

