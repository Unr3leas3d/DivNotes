export type BillingInterval = 'monthly' | 'yearly';
export type SubscriptionInterval = BillingInterval | null;

const POLAR_API_BASE_URL =
  Deno.env.get('POLAR_API_BASE_URL') ?? 'https://api.polar.sh/v1';
const DEFAULT_RETURN_URL =
  Deno.env.get('POLAR_RETURN_URL') ?? 'https://divnotes.com';

export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function polarHeaders() {
  return {
    Authorization: `Bearer ${getRequiredEnv('POLAR_ACCESS_TOKEN')}`,
    'Content-Type': 'application/json',
  };
}

export function getPriceId(interval: BillingInterval) {
  return interval === 'yearly'
    ? getRequiredEnv('POLAR_YEARLY_PRICE_ID')
    : getRequiredEnv('POLAR_MONTHLY_PRICE_ID');
}

export async function polarRequest<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(`${POLAR_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...polarHeaders(),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T | { detail?: string; error?: string }) : null;

  if (!response.ok) {
    const detail =
      data && typeof data === 'object'
        ? ('detail' in data && data.detail) || ('error' in data && data.error)
        : null;
    throw new Error(
      detail
        ? `Polar request failed (${response.status}): ${detail}`
        : `Polar request failed with status ${response.status}`
    );
  }

  return data as T;
}

export function resolveReturnUrl(req: Request): string {
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const url = new URL(origin);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return origin;
      }
    } catch {
      // Fall back to the configured public URL below.
    }
  }

  return DEFAULT_RETURN_URL;
}

export function mapRecurringInterval(
  interval: string | null | undefined
): SubscriptionInterval {
  if (interval === 'month') {
    return 'monthly';
  }

  if (interval === 'year') {
    return 'yearly';
  }

  return null;
}
