# Canopy Billing, Entitlements & Cloud Sync Design

**Date:** 2026-04-01
**Status:** Approved
**Goal:** Introduce a free-by-default authenticated account model, Polar-backed billing, and entitlement-gated cloud sync without turning the extension into a billing surface.

## Overview

Canopy currently treats "authenticated with Supabase" as effectively equivalent to "cloud sync enabled." That is too coarse for paid plans. The product direction for this batch is:

- every new signed-in user is on a free account by default
- free accounts remain local-only
- Pro is the only plan that unlocks cloud sync
- billing should use a merchant-of-record platform because tax and VAT handling should not be owned by Canopy
- the subscription belongs to exactly one Canopy account
- existing local data should sync automatically on upgrade, but only by diff
- when billing lapses, cloud access should stop immediately while cloud data remains retained for later reactivation
- when reactivation causes local/cloud conflicts, the user is warned that the latest `updated_at` wins

This design uses Polar as the merchant of record and Supabase as the source of truth for account entitlements.

## Goals

- Separate authentication from billing entitlement in both the data model and the extension UI
- Default every signed-in user to `free`
- Unlock cloud sync only for `pro + active`
- Keep hosted checkout and billing management outside the extension popup
- Tie one subscription to one Supabase user / Canopy account
- Retain cloud data when entitlement lapses, but make it inaccessible until entitlement is active again
- Reconcile local and cloud data through explicit diff/merge logic instead of blind overwrite
- Create infrastructure that can gate more paid features later without redesigning auth again

## Out Of Scope

- Multiple paid tiers beyond one Pro product
- Seat-based billing, family plans, or transferable licenses
- Building a custom in-app billing UI beyond status display and CTA buttons
- Field-level merge resolution for conflicting entities
- Refactoring the content script into a cloud-aware runtime
- Analytics, referral systems, coupons, or affiliate flows beyond what Polar provides by default

## Approved Product Decisions

- Every new signed-in user starts on `free`
- Signed-in free users remain local-only until they upgrade
- v1 has one paid plan: `Pro`
- `Pro` has two billing intervals: monthly and discounted yearly
- Billing should use a merchant of record because tax/VAT burden should be avoided
- The subscription is tied to one Canopy account, not a transferable license key
- Upgrading to Pro should automatically sync existing local notes, folders, and tags
- Upgrade and reactivation sync should be diff-based, not full overwrite
- When billing lapses, cloud access is cut off immediately
- Cloud data is retained after lapse so it can sync back to a reactivated account or a new device later
- When merge conflicts occur, the user is prompted that the latest `updated_at` wins before reconciliation runs
- The extension and marketing site should both expose billing entry points, but the website / hosted billing surface is canonical

## Existing Context

The repo already has:

- Supabase auth wired into the Chrome extension through a custom Chrome storage adapter in `src/lib/supabase.ts`
- popup and sidepanel auth hydration paths in `src/popup/App.tsx` and `src/lib/use-extension-workspace.ts`
- cloud-backed services for notes, folders, and tags that currently key only off "authenticated user exists"
- local caches in `chrome.storage.local`
- a landing site in `landing/` that already exposes a pricing section and privacy policy surface
- Supabase migrations for `notes`, `folders`, `tags`, and `note_tags`

The important constraint is that this is still a client-heavy app. Payment checkout can be launched from the extension, but billing truth cannot live in the extension because webhook verification and entitlement mutation must happen server-side.

## Provider Decision

Use Polar as the merchant of record.

### Why Polar

- It solves the stated operational problem directly: tax and VAT handling are part of the platform
- It fits the desired UX: hosted checkout, hosted customer portal, webhook-driven subscription state
- It is a better match than plain Stripe for "one app account, one subscription, feature gating later"
- Its built-in benefits / entitlements model is directionally aligned with future paid features even if v1 only gates cloud sync

### Why Not Plain Stripe

Plain Stripe can have lower base payment fees, but it does not remove the tax/VAT burden that motivated this work. Using Stripe plus Billing plus Tax would still leave Canopy responsible for compliance decisions and operating that stack.

### Why Polar Over Lemon Squeezy

Lemon Squeezy is a valid fallback and also fits the merchant-of-record requirement. Polar is the better fit here because the product roadmap wants reusable entitlement infrastructure rather than just a checkout flow. That matters once Canopy starts gating more than cloud sync.

### Public Pricing Snapshot On 2026-04-01

- Polar: `4% + 40¢`, plus `0.5%` for subscriptions and `1.5%` for international cards
- Lemon Squeezy: `5% + 50¢`, plus `0.5%` for subscriptions and `1.5%` for international transactions
- Stripe: `2.9% + 30¢` domestic card processing, plus `0.7%` for Billing and `0.5%` for Stripe Tax in common subscription setups

References:

- https://polar.sh/resources/pricing
- https://polar.sh/docs/merchant-of-record/fees
- https://www.lemonsqueezy.com/pricing
- https://docs.lemonsqueezy.com/help/getting-started/fees
- https://stripe.com/pricing
- https://stripe.com/billing/pricing
- https://stripe.com/tax/pricing

## Architecture

### System Boundaries

Use `Polar + Supabase` with Supabase as the application source of truth.

- Polar owns:
  - hosted checkout
  - hosted billing/customer portal
  - subscription lifecycle billing events
  - tax / VAT handling as merchant of record
- Supabase owns:
  - user identity through `auth.users`
  - app-owned profile and entitlement state
  - webhook event log
  - protected cloud data tables
  - authenticated edge functions for checkout and portal launch
- Extension owns:
  - auth session bootstrap
  - account status display
  - upgrade / manage billing CTAs
  - local-only editing when entitlement is not active
  - reconciliation flow after entitlement activates
- Landing site owns:
  - pricing and plan explanation
  - canonical billing entry surface
  - legal copy updates

### Account States

Product-facing states become:

- `local`
- `authenticated_free`
- `authenticated_pro`
- `authenticated_inactive`

Implementation should not try to encode all of these as one enum if it makes the app brittle. The cleaner internal shape is:

- auth mode: `loading | login | local | authenticated`
- plan: `free | pro | null`
- entitlement status: `inactive | active | past_due | canceled | expired | null`
- derived flag: `cloudSyncEnabled`

`cloudSyncEnabled` is true only when:

- auth mode is `authenticated`
- plan is `pro`
- entitlement status is `active`

### Signup / Profile Bootstrap

New authenticated users should get a `profiles` row automatically through a database trigger on `auth.users`, not by trusting the client to create one.

That row should default to:

- `plan = free`
- `entitlement_status = inactive`
- `billing_provider = null`

For historical users created before the migration, the extension bootstrap path or a one-time backfill migration should ensure a `profiles` row exists.

## Data Model

### `profiles`

Create a first-class application profile table keyed to `auth.users`.

Suggested columns:

- `user_id uuid primary key references auth.users`
- `email text not null`
- `plan text not null default 'free'`
- `entitlement_status text not null default 'inactive'`
- `billing_provider text`
- `polar_customer_id text`
- `polar_subscription_id text`
- `subscription_interval text`
- `current_period_end timestamptz`
- `last_entitlement_sync_at timestamptz`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Rules:

- only webhook/service-role paths mutate billing-linked columns
- the client reads this table to determine current entitlement
- future feature flags can hang off this record without another schema reset

### `billing_events`

Create an event log table for webhook idempotency and auditability.

Suggested columns:

- `id bigint generated always as identity primary key`
- `provider text not null`
- `event_id text not null`
- `event_type text not null`
- `payload jsonb not null`
- `processed_at timestamptz`
- `created_at timestamptz default now()`

Constraint:

- unique index on `(provider, event_id)`

### Existing Cloud Tables

Keep:

- `notes`
- `folders`
- `tags`
- `note_tags`

Cloud data remains in these tables even after subscription lapse. Entitlement controls access, not retention.

### Required Note Model Correction

The current local `StoredNote` type does not include `updatedAt`, while folder and tag models already do. That is not sufficient for the approved conflict policy.

v1 must add note-level `updatedAt` across:

- local storage shape
- TypeScript types
- note service mapping
- content-script note creation/edit flows
- any import/export payloads that serialize notes

Without note-level `updatedAt`, "latest update wins" cannot be applied consistently to notes.

## Security And RLS

UI gating alone is not enough.

Today, the `notes`, `folders`, `tags`, and `note_tags` tables are protected primarily by `user_id = auth.uid()` style policies. That allows any authenticated owner to access cloud rows, which conflicts with the product requirement that signed-in free users remain local-only and lapsed users lose cloud access immediately.

### Required Policy Change

All cloud data table policies must require both:

- ownership by `auth.uid()`
- an active entitlement in `profiles`

Directionally, every read/write policy should require something equivalent to:

```sql
exists (
  select 1
  from profiles
  where profiles.user_id = auth.uid()
    and profiles.plan = 'pro'
    and profiles.entitlement_status = 'active'
)
```

Apply this requirement to:

- `notes`
- `folders`
- `tags`
- `note_tags`

This is what makes "cloud access cut off immediately" real instead of just cosmetic.

### Profile Access

`profiles` should be readable by the owning user but not directly mutable by the client for billing fields.

Recommended v1 rule:

- allow `select` where `user_id = auth.uid()`
- do not allow direct client `insert`, `update`, or `delete`
- create/update rows through trigger, service role, and webhook handlers

`billing_events` should not be client-readable.

## Billing Flow

### Checkout

Use an authenticated Supabase Edge Function such as `create-checkout-session`.

Flow:

1. Extension or website calls the function while authenticated as the current Canopy user.
2. Function reads the caller's Supabase `user_id`.
3. Function creates a Polar checkout session for the chosen price (`monthly` or `yearly`).
4. The checkout request includes a provider-supported account-binding identifier such as `external_id` / metadata pointing back to the Supabase `user_id`.
5. Function returns the hosted checkout URL.
6. Client opens the URL in a browser tab.

The extension must not grant Pro access based on a return URL alone.

### Customer Portal

Use a second authenticated Edge Function such as `create-customer-portal-session`.

Flow:

1. Function reads the current Supabase `user_id`
2. Function loads the linked Polar customer/subscription data from `profiles`
3. Function creates a Polar customer session / portal URL
4. Client opens that hosted portal in the browser

### Webhook

Use a dedicated public Edge Function such as `polar-webhook`.

Responsibilities:

- verify Polar webhook signature
- record the event in `billing_events` idempotently
- resolve the Canopy user via provider linkage / external ID
- update the `profiles` row
- set `last_entitlement_sync_at`

The webhook is the only path that grants, revokes, or restores paid entitlement.

## Entitlement Lifecycle

Canonical entitlement rule:

- every signed-in user starts as `free + inactive`
- cloud sync is enabled only when `plan = pro` and `entitlement_status = active`

### New Signup

- `profiles` row exists automatically
- user can sign in
- app remains local-only

### Upgrade

- client opens Polar checkout for the authenticated user
- successful billing generates a webhook
- webhook updates `profiles` to:
  - `plan = pro`
  - `entitlement_status = active`
  - `billing_provider = polar`
  - provider IDs and interval fields
- extension refreshes entitlement state
- reconciliation flow begins

### Renewal

- webhook keeps entitlement active
- billing metadata is refreshed

### Cancel / Lapse / Payment Failure

- webhook flips entitlement out of `active` immediately
- extension loses cloud access immediately
- cloud data remains stored
- local editing continues

### Reactivation

- webhook restores `pro + active`
- extension refreshes entitlement
- reconciliation flow runs before normal sync resumes

## Extension Behavior

### Account Snapshot

The extension should cache a richer account snapshot than the current `divnotes_auth` payload. That snapshot can still live in `chrome.storage.local`, but it should include entitlement information.

Suggested shape:

```ts
interface StoredAccountState {
  authMode: 'login' | 'local' | 'authenticated';
  email: string;
  plan: 'free' | 'pro' | null;
  entitlementStatus: 'inactive' | 'active' | 'past_due' | 'canceled' | 'expired' | null;
  billingProvider: 'polar' | null;
  subscriptionInterval: 'monthly' | 'yearly' | null;
  cloudSyncEnabled: boolean;
}
```

This lets popup, sidepanel, and service factories read one cached source of truth without conflating auth and billing.

### UI Surfaces

Extension surfaces should show:

- account email
- plan label: `Free` or `Pro`
- cloud sync status
- `Upgrade` CTA for free/inactive users
- `Manage Billing` CTA for active Pro users

The extension is not the billing portal. It only launches hosted flows.

### Site Surfaces

The landing app should grow a real pricing surface and billing entry point instead of treating pricing as static marketing copy only.

Minimal v1 additions:

- monthly / yearly Pro pricing presentation
- "cloud sync requires Pro" messaging
- a billing/checkout entry surface for signed-in web users if desired later
- legal copy updates reflecting Polar as payment provider

## Service Gating

Current service factories pick cloud mode if:

- `divnotes_auth.mode === 'authenticated'`
- a Supabase session exists

That must change.

`getNotesService()`, `getFoldersService()`, and `getTagsService()` should require:

- authenticated session exists
- cached account state says `cloudSyncEnabled = true`

Anything else should resolve to local services.

This keeps free and inactive users productive without generating failed cloud calls.

## Sync And Merge Rules

### General Rule

Do not treat the existing offline sync queue as the source of truth for upgrade or reactivation. It is an offline-delivery mechanism, not a full cross-device reconciliation engine.

When entitlement becomes active, reconciliation should be based on fresh local and cloud snapshots.

### Entities

The reconciliation engine should compare:

- notes
- folders
- tags
- note-tag relationships

Entity keys:

- note: `id`
- folder: `id`
- tag: `id`
- note-tag: `note_id + tag_id`

### Upgrade To Pro

When a previously free user upgrades:

1. refresh entitlement from `profiles`
2. fetch cloud snapshots for all entitled tables
3. load local snapshots from `chrome.storage.local`
4. compute:
   - local-only entities to upload
   - cloud-only entities to download
   - same-id conflicts to resolve
5. if conflicts exist, prompt the user that the latest `updated_at` will win
6. after confirmation, apply reconciliation and sync only the resulting diffs

### Lapse / Inactive Period

When entitlement becomes inactive:

- stop all cloud fetch/write attempts immediately
- keep local editing working
- do not delete retained cloud data
- do not flush queued cloud work while inactive

### Reactivation

Treat reactivation as a merge event, not a reconnect.

If the user made local-only changes while inactive or on another device, those changes must be reconciled against retained cloud data after entitlement becomes active again.

Prompt behavior:

- if there are conflicts, show a merge dialog
- the message should make it explicit that the latest `updated_at` wins
- after confirmation, apply diffs and only then resume normal background sync

### Merge Semantics

v1 should use entity-level reconciliation:

- no field-by-field merge
- no CRDT logic
- no automatic silent conflict resolution when same-id timestamps disagree

If the same entity exists on both sides:

- newer `updated_at` wins after user confirmation

If one side has the entity and the other does not:

- add only the missing entity

If a note-tag relationship differs:

- compute added and removed tag links explicitly

### Queue Interaction

The current `divnotes_sync_queue` should become entitlement-aware.

Rules:

- do not process queue entries while entitlement is inactive
- do not blindly replay old queue entries immediately after reactivation
- after reconciliation, either rebuild the queue from the winning diff set or clear obsolete entries before resuming normal sync

## Content Script Boundary

The content script currently works from local storage and should stay that way in v1.

That is desirable here:

- free users are local-only anyway
- inactive users still need local editing
- entitlement and reconciliation logic are easier to centralize in popup/sidepanel service code than in page-level content scripts

Required adjustment:

- content-script-created notes must stamp `updatedAt`
- content-script edits must keep local timestamps current so later reconciliation is accurate

## File Map

### New Database / Backend Surfaces

- `supabase/migrations/*` for:
  - `profiles`
  - `billing_events`
  - auth-user trigger for profile creation
  - tightened RLS on cloud tables
- `supabase/functions/create-checkout-session/*`
- `supabase/functions/create-customer-portal-session/*`
- `supabase/functions/polar-webhook/*`

### Existing Extension Files Likely To Change

- `src/lib/use-extension-workspace.ts`
- `src/lib/extension-workspace-types.ts`
- `src/popup/App.tsx`
- `src/popup/components/SettingsView.tsx`
- `src/sidepanel/components/SettingsView.tsx`
- `src/lib/notes-service.ts`
- `src/lib/folders-service.ts`
- `src/lib/tags-service.ts`
- `src/lib/types.ts`
- content-script note creation/edit code in `src/content/index.tsx` and related helpers

### Landing Site Files Likely To Change

- `landing/src/App.tsx`
- new pricing / terms surfaces as needed
- `landing/src/pages/PrivacyPolicy.tsx`

## Testing Expectations

Implementation planning for this spec should include:

- profile bootstrap tests for new and historical authenticated users
- webhook tests for valid signature, invalid signature, duplicate event, and entitlement transitions
- service gating tests proving free and inactive users resolve to local services
- RLS verification proving free users cannot read/write `notes`, `folders`, `tags`, or `note_tags`
- checkout flow tests for monthly and yearly price selection
- portal launch tests for active Pro accounts
- reconciliation tests for:
  - local-only entities
  - cloud-only entities
  - same-id timestamp conflicts
  - note-tag diff handling
  - stale queue interaction after reactivation
- UI tests or targeted manual verification for:
  - Free / Pro / Inactive account display
  - upgrade CTA
  - manage billing CTA
  - conflict prompt text
- regression checks that local-only mode still works without any billing dependency

## Summary

This design intentionally separates three concerns that are currently blurred together:

- identity
- billing entitlement
- data sync

The most important implementation consequences are:

- `authenticated` no longer means `cloud enabled`
- Supabase RLS must enforce entitlement, not just the UI
- note-level `updatedAt` is required for the approved merge policy
- upgrade and reactivation sync must reconcile fresh local/cloud snapshots instead of replaying queued writes blindly

If implemented this way, Canopy gets a stable billing foundation for cloud sync now and a reusable entitlement model for future paid features later.
