# Polar Integration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Polar the authoritative billing source while preserving Canopy Pro access through `current_period_end` for lapse states and revoking access consistently once that window expires.

**Architecture:** Extract Polar subscription normalization into a pure policy module, update the webhook to persist provider state plus derived access state, and centralize client-side grace-period expiry handling in account-state derivation. Cover the new contract with focused unit tests first, then re-run the existing billing test suite to prove the integration holds together.

**Tech Stack:** TypeScript, Supabase Edge Functions, Node test runner, Vitest-compatible TypeScript test files

---

## File Map

- Create: `supabase/functions/_shared/polar-billing-policy.ts`
  Responsibility: normalize Polar subscription/customer data into provider-state fields plus derived Canopy access fields.
- Create: `supabase/functions/_shared/polar-billing-policy.test.ts`
  Responsibility: pin down the grace-period billing policy with deterministic pure-function tests.
- Modify: `supabase/functions/polar-webhook/index.ts`
  Responsibility: replace inline entitlement mapping with the shared policy module and persist the normalized fields.
- Modify: `src/lib/account-state.ts`
  Responsibility: derive `cloudSyncEnabled` from stored account data while expiring local grace access after `current_period_end`.
- Modify: `src/lib/account-state.test.ts`
  Responsibility: verify active, grace-period, and expired-grace account-state behavior.
- Modify: `tests/canopy-billing-source.test.mjs`
  Responsibility: assert the presence of the shared policy module and the clarified persisted-field contract.
- Optional modify: `supabase/migrations/003_profiles_billing.sql`
  Responsibility: add a provider-status column only if the existing schema cannot store provider truth separately from derived access.
- Optional modify: `supabase/migrations/005_backfill_schema_for_existing_projects.sql`
  Responsibility: keep existing deployments aligned if a new profile column is required.

### Task 1: Add Billing Policy Tests

**Files:**
- Create: `supabase/functions/_shared/polar-billing-policy.test.ts`
- Reference: `docs/superpowers/specs/2026-04-06-polar-integration-hardening-design.md`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { derivePolarBillingState } from './polar-billing-policy.ts';

describe('derivePolarBillingState', () => {
  it('keeps Pro access for canceled subscriptions until current_period_end', () => {
    const result = derivePolarBillingState(
      {
        id: 'sub_123',
        status: 'canceled',
        recurring_interval: 'month',
        current_period_end: '2026-04-10T00:00:00.000Z',
        cancel_at_period_end: true,
      },
      '2026-04-06T00:00:00.000Z'
    );

    expect(result.plan).toBe('pro');
    expect(result.entitlementStatus).toBe('active');
    expect(result.providerSubscriptionStatus).toBe('canceled');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/polar-billing-policy.test.ts`
Expected: FAIL because `polar-billing-policy.ts` does not exist yet.

- [ ] **Step 3: Expand the test file with the full matrix**

```ts
it('grants access for active subscriptions', () => {});
it('grants access for trialing subscriptions', () => {});
it('keeps access for past_due subscriptions before period end', () => {});
it('keeps access for unpaid subscriptions before period end', () => {});
it('revokes access after period end for lapse statuses', () => {});
it('revokes access when there is no subscription', () => {});
it('maps recurring interval to monthly and yearly values', () => {});
```

- [ ] **Step 4: Commit the test scaffold**

```bash
git add supabase/functions/_shared/polar-billing-policy.test.ts
git commit -m "test: define Polar billing policy cases"
```

### Task 2: Implement the Shared Billing Policy Module

**Files:**
- Create: `supabase/functions/_shared/polar-billing-policy.ts`
- Reference: `supabase/functions/_shared/polar.ts`
- Test: `supabase/functions/_shared/polar-billing-policy.test.ts`

- [ ] **Step 1: Write the minimal implementation**

```ts
import { mapRecurringInterval, type SubscriptionInterval } from './polar.ts';

export interface PolarSubscriptionSnapshot {
  id: string;
  status?: string | null;
  recurring_interval?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
}

export interface DerivedPolarBillingState {
  plan: 'free' | 'pro';
  entitlementStatus: 'inactive' | 'active';
  providerSubscriptionStatus: string | null;
  polarSubscriptionId: string | null;
  subscriptionInterval: SubscriptionInterval;
  currentPeriodEnd: string | null;
}

export function derivePolarBillingState(
  subscription: PolarSubscriptionSnapshot | null,
  nowIso: string
): DerivedPolarBillingState {
  // Determine whether Canopy should grant access based on provider status
  // and whether the paid period has already ended.
}
```

- [ ] **Step 2: Run test to verify the new module still fails on incomplete logic**

Run: `npx vitest run supabase/functions/_shared/polar-billing-policy.test.ts`
Expected: FAIL on assertions until grace-window logic is implemented.

- [ ] **Step 3: Finish the policy logic**

```ts
const ACTIVE_PROVIDER_STATUSES = new Set(['active', 'trialing']);
const GRACE_PROVIDER_STATUSES = new Set(['past_due', 'unpaid', 'canceled']);

function isFuturePeriodEnd(currentPeriodEnd: string | null, nowIso: string) {
  return Boolean(currentPeriodEnd && new Date(currentPeriodEnd).getTime() > new Date(nowIso).getTime());
}

const shouldGrantAccess =
  Boolean(subscription) &&
  (ACTIVE_PROVIDER_STATUSES.has(status) ||
    (GRACE_PROVIDER_STATUSES.has(status) && isFuturePeriodEnd(currentPeriodEnd, nowIso)));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run supabase/functions/_shared/polar-billing-policy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/polar-billing-policy.ts supabase/functions/_shared/polar-billing-policy.test.ts
git commit -m "feat: add Polar billing policy mapper"
```

### Task 3: Wire the Webhook to the Shared Policy

**Files:**
- Modify: `supabase/functions/polar-webhook/index.ts`
- Modify if needed: `supabase/migrations/003_profiles_billing.sql`
- Modify if needed: `supabase/migrations/005_backfill_schema_for_existing_projects.sql`
- Test: `tests/canopy-billing-source.test.mjs`

- [ ] **Step 1: Update the source-level test first**

```js
assert.equal(existsSync(path.join(repoRoot, 'supabase/functions/_shared/polar-billing-policy.ts')), true);
assert.match(webhookFn, /derivePolarBillingState/);
assert.match(webhookFn, /provider_subscription_status|polar_subscription_status/);
```

- [ ] **Step 2: Run the billing source test to verify it fails**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: FAIL because the webhook has not been updated yet.

- [ ] **Step 3: Replace the inline mapper in the webhook**

```ts
import { derivePolarBillingState } from '../_shared/polar-billing-policy.ts';

const derived = derivePolarBillingState(subscription, event.timestamp);

await supabase
  .from('profiles')
  .update({
    plan: derived.plan,
    entitlement_status: derived.entitlementStatus,
    provider_subscription_status: derived.providerSubscriptionStatus,
    polar_subscription_id: derived.polarSubscriptionId,
    subscription_interval: derived.subscriptionInterval,
    current_period_end: derived.currentPeriodEnd,
  })
```

- [ ] **Step 4: Add schema support only if required**

```sql
alter table profiles add column if not exists provider_subscription_status text;
```

- [ ] **Step 5: Re-run the billing source test**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/canopy-billing-source.test.mjs supabase/functions/polar-webhook/index.ts supabase/migrations/003_profiles_billing.sql supabase/migrations/005_backfill_schema_for_existing_projects.sql
git commit -m "feat: persist normalized Polar billing state"
```

### Task 4: Add Grace-Expiry Account-State Tests

**Files:**
- Modify: `src/lib/account-state.test.ts`
- Modify: `src/lib/account-state.ts`

- [ ] **Step 1: Write the failing account-state test**

```ts
it('disables cloud sync when a stored grace-period entitlement has passed current_period_end', () => {
  const state = buildStoredAccountState({
    authMode: 'authenticated',
    email: 'user@example.com',
    profile: {
      email: 'user@example.com',
      plan: 'pro',
      entitlement_status: 'active',
      billing_provider: 'polar',
      subscription_interval: 'monthly',
      current_period_end: '2026-04-05T00:00:00.000Z',
      provider_subscription_status: 'canceled',
    },
  });

  expect(state.cloudSyncEnabled).toBe(false);
});
```

- [ ] **Step 2: Run the account-state tests to verify failure**

Run: `npx vitest run src/lib/account-state.test.ts`
Expected: FAIL because account-state does not yet inspect `current_period_end` or provider status.

- [ ] **Step 3: Extend the account model minimally**

```ts
export interface ProfileRecord {
  current_period_end?: string | null;
  provider_subscription_status?: string | null;
}

function hasUnexpiredGraceAccess(profile: ProfileRecord, now = new Date()) {
  // Treat non-active provider statuses as still enabled only when the paid
  // period is still in the future.
}
```

- [ ] **Step 4: Update account-state derivation**

```ts
const cloudSyncEnabled =
  params.authMode === 'authenticated' &&
  profile.plan === 'pro' &&
  shouldEnableCloudSync(profile);
```

- [ ] **Step 5: Re-run account-state tests**

Run: `npx vitest run src/lib/account-state.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/account-state.ts src/lib/account-state.test.ts
git commit -m "feat: expire local grace-period sync access"
```

### Task 5: Thread the New Profile Fields Through Session Refresh

**Files:**
- Modify: `src/lib/extension-workspace-actions.ts`
- Modify: `src/lib/account-state.ts`
- Test: `src/lib/account-state.test.ts`

- [ ] **Step 1: Update profile reads to select the new persisted fields**

```ts
.select('email, plan, entitlement_status, billing_provider, subscription_interval, current_period_end, provider_subscription_status')
```

- [ ] **Step 2: Return those fields in `readCurrentProfile`**

```ts
return {
  email: data.email ?? '',
  plan: data.plan,
  entitlement_status: data.entitlement_status,
  billing_provider: data.billing_provider,
  subscription_interval: data.subscription_interval,
  current_period_end: data.current_period_end,
  provider_subscription_status: data.provider_subscription_status,
};
```

- [ ] **Step 3: Re-run account and billing tests**

Run: `npx vitest run src/lib/account-state.test.ts && node --test tests/canopy-billing-source.test.mjs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/extension-workspace-actions.ts src/lib/account-state.ts
git commit -m "feat: expose persisted Polar access fields to clients"
```

### Task 6: Full Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run: `npx vitest run supabase/functions/_shared/polar-billing-policy.test.ts src/lib/account-state.test.ts`
Expected: PASS

- [ ] **Step 2: Run billing source tests**

Run: `node --test tests/canopy-billing-source.test.mjs`
Expected: PASS

- [ ] **Step 3: Run the broader relevant suite**

Run: `npm test -- --runInBand`
Expected: PASS for the repo test command if configured, otherwise capture the exact command gap and run the available project test commands instead.

- [ ] **Step 4: Commit verification-safe final state**

```bash
git status --short
```
