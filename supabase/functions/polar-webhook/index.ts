import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  validateEvent,
  WebhookVerificationError,
} from 'npm:@polar-sh/sdk/webhooks';

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  derivePolarBillingState,
  type PolarSubscriptionSnapshot,
} from '../_shared/polar-billing-policy.ts';

interface PolarCustomerState {
  id: string;
  email?: string | null;
  external_id?: string | null;
  active_subscriptions?: Array<{
    id: string;
    status?: string | null;
    recurring_interval?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean | null;
  }>;
}

interface PolarCustomerStateChangedEvent {
  type: string;
  timestamp: string;
  data: PolarCustomerState;
}

function getEventId(req: Request, event: PolarCustomerStateChangedEvent): string {
  return (
    req.headers.get('webhook-id') ??
    req.headers.get('svix-id') ??
    `${event.type}:${event.timestamp}:${event.data.external_id ?? event.data.id}`
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const rawBody = new Uint8Array(await req.arrayBuffer());
    const event = validateEvent(
      rawBody,
      req.headers,
      Deno.env.get('POLAR_WEBHOOK_SECRET') ?? ''
    ) as PolarCustomerStateChangedEvent;

    if (event.type !== 'customer.state_changed') {
      return jsonResponse({ ok: true, skipped: true });
    }

    const eventId = getEventId(req, event);
    const { data: existingEvent, error: selectError } = await supabase
      .from('billing_events')
      .select('id, processed_at')
      .eq('provider', 'polar')
      .eq('event_id', eventId)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (existingEvent?.processed_at) {
      return jsonResponse({ ok: true, duplicate: true }, 202);
    }

    if (!existingEvent) {
      const { error: insertError } = await supabase.from('billing_events').insert({
        provider: 'polar',
        event_id: eventId,
        event_type: event.type,
        payload: event,
      });

      if (insertError) {
        throw insertError;
      }
    }

    let userId = event.data.external_id ?? null;
    if (!userId) {
      const { data: linkedProfile, error: linkedProfileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('polar_customer_id', event.data.id)
        .maybeSingle();

      if (linkedProfileError) {
        throw linkedProfileError;
      }

      userId = linkedProfile?.user_id ?? null;
    }

    if (!userId) {
      throw new Error('Unable to resolve Supabase user for Polar customer state');
    }

    const subscription: PolarSubscriptionSnapshot | null =
      event.data.active_subscriptions?.[0] ?? null;
    const billingState = derivePolarBillingState(subscription, event.timestamp);

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        email: event.data.email ?? undefined,
        plan: billingState.plan,
        entitlement_status: billingState.entitlementStatus,
        billing_provider: 'polar',
        provider_subscription_status: billingState.providerSubscriptionStatus,
        polar_customer_id: event.data.id,
        polar_subscription_id: billingState.polarSubscriptionId,
        subscription_interval: billingState.subscriptionInterval,
        current_period_end: billingState.currentPeriodEnd,
        last_entitlement_sync_at: event.timestamp,
      })
      .eq('user_id', userId);

    if (profileUpdateError) {
      throw profileUpdateError;
    }

    const { error: processedError } = await supabase
      .from('billing_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('provider', 'polar')
      .eq('event_id', eventId);

    if (processedError) {
      throw processedError;
    }

    return jsonResponse({ ok: true });
  } catch (caughtError) {
    if (caughtError instanceof WebhookVerificationError) {
      return errorResponse('Invalid webhook signature', 403);
    }

    return errorResponse(
      caughtError instanceof Error ? caughtError.message : 'Failed to process Polar webhook',
      500
    );
  }
});
