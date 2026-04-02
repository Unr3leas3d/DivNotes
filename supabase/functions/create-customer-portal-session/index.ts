import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from 'npm:@supabase/supabase-js@2';

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { polarRequest, resolveReturnUrl } from '../_shared/polar.ts';

interface CustomerPortalSessionResponse {
  customer_portal_url: string;
}

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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('polar_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile?.polar_customer_id) {
      return errorResponse('No linked Polar customer found for this account', 400);
    }

    const portalSession = await polarRequest<CustomerPortalSessionResponse>(
      '/customer-sessions',
      {
        method: 'POST',
        body: JSON.stringify({
          customer_id: profile.polar_customer_id,
          return_url: resolveReturnUrl(req),
        }),
      }
    );

    return jsonResponse({ url: portalSession.customer_portal_url });
  } catch (caughtError) {
    return errorResponse(
      caughtError instanceof Error
        ? caughtError.message
        : 'Failed to create customer portal session',
      500
    );
  }
});
