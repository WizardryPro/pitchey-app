/**
 * Multi-currency configuration (P7).
 *
 * Master switch. Stays FALSE until the multi-currency Stripe Prices exist
 * (run scripts/stripe-create-multicurrency-prices.mjs), their IDs are pasted
 * into subscription-plans.ts, and the change is verified in Stripe test mode.
 * While false, every path behaves exactly as the EUR-only system did — the
 * currency param is ignored and EUR is charged/displayed throughout.
 */
export const MULTI_CURRENCY_ENABLED = false;

/** Base currency. Always supported, always the fallback. */
export const BASE_CURRENCY = 'EUR';

/** Currencies the platform can charge in (owner decision 2026-06-02: + GBP, USD). */
export const SUPPORTED_CURRENCIES = ['EUR', 'GBP', 'USD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Cloudflare `request.cf.country` (ISO-3166 alpha-2) → default currency. */
const COUNTRY_CURRENCY: Record<string, SupportedCurrency> = {
  GB: 'GBP',
  US: 'USD',
};

/**
 * Coerce an arbitrary input to a supported currency. Unknown/unsupported →
 * BASE_CURRENCY. When multi-currency is disabled, always BASE_CURRENCY so no
 * caller can accidentally trigger a non-EUR charge before activation.
 */
export function normalizeCurrency(input: unknown): SupportedCurrency {
  if (!MULTI_CURRENCY_ENABLED) return BASE_CURRENCY;
  const c = String(input ?? '').toUpperCase();
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(c) ? (c as SupportedCurrency) : BASE_CURRENCY;
}

/** Default currency for a Cloudflare country code. EUR unless multi-currency is on. */
export function currencyForCountry(country: string | undefined): SupportedCurrency {
  if (!MULTI_CURRENCY_ENABLED) return BASE_CURRENCY;
  return (country && COUNTRY_CURRENCY[country.toUpperCase()]) || BASE_CURRENCY;
}
