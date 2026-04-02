import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import {
  getPriceId,
  polarRequest,
  resolveReturnUrl,
  type BillingInterval,
} from '../_shared/polar.ts';

interface CheckoutSessionResponse {
  url: string;
}

interface RequestBody {
  interval?: BillingInterval;
}

const MONTHLY_PRICE_ENV = 'POLAR_MONTHLY_PRICE_ID';
const YEARLY_PRICE_ENV = 'POLAR_YEARLY_PRICE_ID';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return errorResponse('Unauthorized', 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authorization },
        },
      }
    );

    const token = authorization.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = (await req.json()) as RequestBody;
    if (body.interval !== 'monthly' && body.interval !== 'yearly') {
      return errorResponse('Interval must be monthly or yearly', 400);
    }

    const requestedPriceEnv =
      body.interval === 'yearly' ? YEARLY_PRICE_ENV : MONTHLY_PRICE_ENV;
    const priceId = getPriceId(body.interval);
    if (!priceId) {
      return errorResponse(`Missing ${requestedPriceEnv}`, 500);
    }

    const returnUrl = resolveReturnUrl(req);
    const checkout = await polarRequest<CheckoutSessionResponse>('/checkouts/custom/', {
      method: 'POST',
      body: JSON.stringify({
        product_price_id: priceId,
        external_customer_id: user.id,
        customer_email: user.email ?? null,
        success_url: returnUrl,
        return_url: returnUrl,
        metadata: {
          supabase_user_id: user.id,
        },
      }),
    });

    return jsonResponse({ url: checkout.url });
  } catch (caughtError) {
    return errorResponse(
      caughtError instanceof Error ? caughtError.message : 'Failed to create checkout session',
      500
    );
  }
});
