import { describe, expect, it } from 'vitest';

import { derivePolarBillingState } from './polar-billing-policy.ts';

describe('derivePolarBillingState', () => {
  it('grants Pro access for active subscriptions', () => {
    const result = derivePolarBillingState(
      {
        id: 'sub_active',
        status: 'active',
        recurring_interval: 'month',
        current_period_end: '2026-04-10T00:00:00.000Z',
        cancel_at_period_end: false,
      },
      '2026-04-06T00:00:00.000Z'
    );

    expect(result.plan).toBe('pro');
    expect(result.entitlementStatus).toBe('active');
    expect(result.providerSubscriptionStatus).toBe('active');
    expect(result.subscriptionInterval).toBe('monthly');
  });

  it('grants Pro access for trialing subscriptions', () => {
    const result = derivePolarBillingState(
      {
        id: 'sub_trial',
        status: 'trialing',
        recurring_interval: 'year',
        current_period_end: '2026-05-01T00:00:00.000Z',
        cancel_at_period_end: false,
      },
      '2026-04-06T00:00:00.000Z'
    );

    expect(result.plan).toBe('pro');
    expect(result.entitlementStatus).toBe('active');
    expect(result.providerSubscriptionStatus).toBe('trialing');
    expect(result.subscriptionInterval).toBe('yearly');
  });

  it('keeps Pro access for canceled subscriptions until current_period_end', () => {
    const result = derivePolarBillingState(
      {
        id: 'sub_canceled',
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
    expect(result.currentPeriodEnd).toBe('2026-04-10T00:00:00.000Z');
  });

  it('keeps Pro access for past_due subscriptions before current_period_end', () => {
    const result = derivePolarBillingState(
      {
        id: 'sub_past_due',
        status: 'past_due',
        recurring_interval: 'month',
        current_period_end: '2026-04-10T00:00:00.000Z',
        cancel_at_period_end: false,
      },
      '2026-04-06T00:00:00.000Z'
    );

    expect(result.plan).toBe('pro');
    expect(result.entitlementStatus).toBe('active');
    expect(result.providerSubscriptionStatus).toBe('past_due');
  });

  it('keeps Pro access for unpaid subscriptions before current_period_end', () => {
    const result = derivePolarBillingState(
      {
        id: 'sub_unpaid',
        status: 'unpaid',
        recurring_interval: 'month',
        current_period_end: '2026-04-10T00:00:00.000Z',
        cancel_at_period_end: false,
      },
      '2026-04-06T00:00:00.000Z'
    );

    expect(result.plan).toBe('pro');
    expect(result.entitlementStatus).toBe('active');
    expect(result.providerSubscriptionStatus).toBe('unpaid');
  });

  it('revokes access after the billing period ends for lapse states', () => {
    const result = derivePolarBillingState(
      {
        id: 'sub_expired',
        status: 'canceled',
        recurring_interval: 'month',
        current_period_end: '2026-04-05T00:00:00.000Z',
        cancel_at_period_end: true,
      },
      '2026-04-06T00:00:00.000Z'
    );

    expect(result.plan).toBe('free');
    expect(result.entitlementStatus).toBe('inactive');
    expect(result.providerSubscriptionStatus).toBe('canceled');
  });

  it('revokes access when there is no subscription', () => {
    const result = derivePolarBillingState(null, '2026-04-06T00:00:00.000Z');

    expect(result.plan).toBe('free');
    expect(result.entitlementStatus).toBe('inactive');
    expect(result.providerSubscriptionStatus).toBe(null);
    expect(result.polarSubscriptionId).toBe(null);
    expect(result.subscriptionInterval).toBe(null);
    expect(result.currentPeriodEnd).toBe(null);
  });
});
