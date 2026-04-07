# Polar Integration Hardening Design

**Date:** 2026-04-06
**Status:** Approved
**Goal:** Make Polar the authoritative subscription source while preserving Canopy Pro access through the paid billing period end when a subscription is set to lapse.

## Overview

The current billing implementation already treats the Polar webhook as the path that mutates entitlement state, but it still collapses provider state too early. That is no longer sufficient once Canopy allows a grace window through `current_period_end`.

The required product rule is:

- Polar is the source of truth for subscription state
- checkout and portal functions never mutate plan access
- Canopy should keep Pro access enabled until `current_period_end` when Polar reports a canceling or delinquent subscription that is still inside the paid period
- once that timestamp passes, Pro access should be removed on the next authoritative sync

This design hardens the integration around that rule by separating provider state from derived Canopy access and by testing the grace-period policy explicitly.

## Goals

- Keep Polar webhook state as the only authoritative billing mutation path
- Preserve Pro access until `current_period_end` for subscriptions that are canceling or delinquent but still within the paid cycle
- Avoid encoding Canopy access policy by overloading raw provider status fields
- Give the extension a simple, deterministic access contract for `cloudSyncEnabled`
- Add tests around status mapping and period-end behavior so future changes do not silently break access policy

## Out Of Scope

- Adding a polling job or cron-based entitlement sweeper
- Supporting multiple paid plans beyond existing `free` and `pro`
- Building new billing UI beyond reflecting the clarified account state
- Refactoring the entire billing schema if the existing columns can support the clarified contract with a targeted addition

## Approved Product Rules

- Polar remains the subscription source of truth
- Edge functions that launch checkout or portal sessions stay stateless
- If Polar reports `active` or `trialing`, Canopy grants Pro access
- If Polar reports `past_due`, `unpaid`, `canceled`, or another non-active state but `current_period_end` is still in the future, Canopy continues Pro access until that timestamp
- If there is no qualifying subscription or `current_period_end` is in the past, Canopy removes Pro access

## Design

### 1. Separate Provider State From Canopy Access

The current mapper returns `plan` and `entitlement_status` directly from a coarse active/inactive decision. That makes the grace-period rule ambiguous because a subscription can be non-active in Polar terms while still active for Canopy access.

The hardened contract should distinguish:

- provider subscription status from Polar
- `subscription_interval`
- `current_period_end`
- derived Canopy access decision

If the current schema can accommodate this by adding a provider-status column and keeping the existing derived fields, prefer that over a broad schema rewrite. The key requirement is that the stored record can answer both of these questions separately:

- what does Polar currently say?
- should Canopy currently unlock Pro?

### 2. Centralize Mapping In A Pure Billing Policy Function

The provider-to-access mapping should live in a shared pure function with no direct Supabase or request dependencies. It should accept:

- Polar subscription status
- `cancel_at_period_end`
- `current_period_end`
- current time

It should return a single normalized object that the webhook persists and the account layer can trust.

This function defines the policy once:

- billable statuses like `active` and `trialing` grant Pro immediately
- lapse statuses may still grant Pro if `current_period_end` is in the future
- otherwise access is revoked

Passing `now` as an argument keeps the function deterministic and easy to test.

### 3. Webhook Behavior

The Polar webhook remains the only mutating billing path.

For each `customer.state_changed` event:

- verify signature
- ensure idempotency through `billing_events`
- resolve the Supabase user from `external_id` or linked `polar_customer_id`
- compute normalized provider state plus derived Canopy access through the shared policy function
- persist that normalized state to `profiles`
- mark the billing event processed

The webhook should not collapse provider state into a misleading `inactive` label when the account still has paid access through `current_period_end`.

### 4. Client Contract

The extension should consume a simple stored account contract that is already policy-aware.

`cloudSyncEnabled` should be derived from the normalized Canopy access fields, not by re-implementing Polar status logic across multiple client modules. This keeps checkout, settings surfaces, sync services, and local account caching aligned with the webhook decision.

### 5. Grace-Period Freshness

This batch should remain webhook-first. No new background scheduler is required.

The known edge is that if access should expire exactly at `current_period_end`, Canopy only reflects that once another authoritative sync occurs. To reduce confusion without expanding scope too far:

- preserve the exact `current_period_end` timestamp on the profile
- keep the client capable of recognizing that a previously granted grace period has elapsed when reading a stored account record

That gives the extension a safe local fallback if the webhook has not fired again yet, while keeping Polar as the only source of billing facts.

## Testing Strategy

Add focused tests in this order:

1. Pure billing policy tests
   - `active`
   - `trialing`
   - `past_due` with future period end
   - `canceled` with future period end
   - `unpaid` with future period end
   - lapse states with past period end
   - no subscription

2. Webhook contract tests or source assertions
   - webhook persists provider state and derived access without direct client mutation
   - billing event idempotency remains intact

3. Account-state tests
   - stored account remains Pro and cloud-sync-enabled during the grace window
   - stored account disables sync after the grace window elapses

4. Existing billing source tests
   - update any expectations that assume non-active Polar status must always revoke access immediately

## Risks And Mitigations

- Risk: `entitlement_status` becomes semantically confusing if it mixes provider truth and derived access.
  Mitigation: add a distinct provider-status field or otherwise document and test the normalized contract clearly.

- Risk: grace access may remain stale if no webhook arrives after period end.
  Mitigation: compare `current_period_end` against current time in the local account-state derivation as a defensive fallback.

- Risk: multiple client modules re-implement access logic inconsistently.
  Mitigation: keep access derivation centralized and expose a simple boolean for consumers.

## Implementation Direction

Preferred approach:

- add a centralized billing-policy mapper
- persist both provider state and derived access state
- update client account-state derivation to respect grace-period expiry locally
- expand tests around the mapper and account-state behavior before touching broader UI code
