import { useEffect, useState } from 'react';
import { API_URL } from '../config';

// P7 multi-currency display. Source of truth for which currencies are live is
// the worker's /api/locale (driven by the backend MULTI_CURRENCY_ENABLED flag),
// so the UI can't offer a currency the backend won't charge. Amounts are the
// same numeric value across currencies (owner decision) — only the symbol changes.

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  CAD: '$',
  AUD: '$',
};

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[(currency || 'EUR').toUpperCase()] ?? '€';
}

export function formatPrice(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${amount.toFixed(2)}`;
}

interface LocaleInfo {
  currency: string;
  multiCurrencyEnabled: boolean;
  supportedCurrencies: string[];
}

const STORAGE_KEY = 'pitchey:currency';
let cached: LocaleInfo | null = null;
let inFlight: Promise<LocaleInfo> | null = null;

async function fetchLocale(): Promise<LocaleInfo> {
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/locale`, { credentials: 'include' });
      const body = (await res.json()) as { data?: Partial<LocaleInfo> };
      const d = body.data ?? {};
      cached = {
        currency: d.currency || 'EUR',
        multiCurrencyEnabled: !!d.multiCurrencyEnabled,
        supportedCurrencies: d.supportedCurrencies?.length ? d.supportedCurrencies : ['EUR'],
      };
    } catch {
      cached = { currency: 'EUR', multiCurrencyEnabled: false, supportedCurrencies: ['EUR'] };
    }
    return cached;
  })();
  return inFlight;
}

/**
 * Returns the active display/charge currency, the supported set, and a setter.
 * Default = geo-detected currency from /api/locale; a user override is persisted
 * in localStorage. While multi-currency is disabled, this resolves to EUR and
 * `enabled` is false (callers hide the selector).
 */
export function useCurrency() {
  const [info, setInfo] = useState<LocaleInfo | null>(cached);
  const [override, setOverride] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  useEffect(() => {
    let alive = true;
    void fetchLocale().then((i) => { if (alive) setInfo(i); });
    return () => { alive = false; };
  }, []);

  const enabled = !!info?.multiCurrencyEnabled;
  const supported = info?.supportedCurrencies ?? ['EUR'];
  // Honour an override only if it's still a supported currency.
  const resolved = enabled && override && supported.includes(override)
    ? override
    : (info?.currency || 'EUR');

  const setCurrency = (c: string) => {
    try { localStorage.setItem(STORAGE_KEY, c); } catch { /* ignore */ }
    setOverride(c);
  };

  return {
    currency: resolved,
    symbol: currencySymbol(resolved),
    enabled,
    supported,
    setCurrency,
  };
}
