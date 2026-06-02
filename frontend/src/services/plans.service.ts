import { useEffect, useState } from 'react';
import { API_URL } from '../config';
import {
  SUBSCRIPTION_TIERS,
  CREDIT_PACKAGES,
  CREDIT_COSTS,
  type SubscriptionTier,
  type CreditCost,
} from '../config/subscription-plans';

type CreditPackage = (typeof CREDIT_PACKAGES)[number];

// Single-source plans/credit config (genres pattern). The backend
// (GET /api/plans, from src/config/subscription-plans.ts) is authoritative;
// the bundled frontend config is only a first-paint/offline fallback. This
// stops the two configs from silently drifting (the backend always wins at
// runtime). Stripe price IDs are intentionally NOT served — checkout is
// tier-driven server-side.

export interface PlansData {
  tiers: SubscriptionTier[];
  creditPackages: CreditPackage[];
  creditCosts: CreditCost[];
}

const FALLBACK: PlansData = {
  tiers: SUBSCRIPTION_TIERS,
  creditPackages: CREDIT_PACKAGES,
  creditCosts: CREDIT_COSTS,
};

let cached: PlansData | null = null;
let inFlight: Promise<PlansData> | null = null;

async function fetchPlans(): Promise<PlansData> {
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/plans`, { credentials: 'include' });
      const body = (await res.json()) as { data?: Partial<PlansData> };
      const d = body.data ?? {};
      cached = {
        tiers: d.tiers?.length ? (d.tiers as SubscriptionTier[]) : FALLBACK.tiers,
        creditPackages: d.creditPackages?.length ? (d.creditPackages as CreditPackage[]) : FALLBACK.creditPackages,
        creditCosts: d.creditCosts?.length ? (d.creditCosts as CreditCost[]) : FALLBACK.creditCosts,
      };
    } catch {
      cached = FALLBACK;
    }
    return cached;
  })();
  return inFlight;
}

export function tiersByUserType(tiers: SubscriptionTier[], userType: string): SubscriptionTier[] {
  if (userType === 'creator') return tiers.filter((t) => t.userType === 'creator');
  if (userType === 'production') return tiers.filter((t) => t.userType === 'production');
  if (userType === 'investor') return tiers.filter((t) => t.userType === 'exec');
  if (userType === 'watcher' || userType === 'viewer') return [];
  return tiers;
}

/**
 * Plans/credit config from the backend (with bundled fallback for first paint).
 * Re-renders when the backend data resolves.
 */
export function usePlans() {
  const [data, setData] = useState<PlansData>(cached ?? FALLBACK);
  useEffect(() => {
    let alive = true;
    void fetchPlans().then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);
  return {
    ...data,
    forUserType: (userType: string) => tiersByUserType(data.tiers, userType),
  };
}
