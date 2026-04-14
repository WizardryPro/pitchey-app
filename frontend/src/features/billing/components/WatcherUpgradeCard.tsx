import { useState } from 'react';
import { Check, Crown, Loader2, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { paymentsAPI } from '@/lib/apiServices';
import {
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from '@/config/subscription-plans';

/**
 * WatcherUpgradeCard
 *
 * Upgrade path for users on the free Watcher tier (user_type='viewer').
 * Watchers can draft pitches but can't publish. Subscribing to a Creator
 * plan flips their user_type='viewer' → 'creator' via the Stripe webhook
 * and unlocks publishing + analytics + etc.
 *
 * Shows the 3 Creator tiers (€19.99 / €29.99 / €39.99) with a monthly /
 * annual toggle. The tier IDs sent to the backend (`creator`,
 * `creator_plus`, `creator_unlimited`) match SUBSCRIPTION_TIERS in
 * src/config/subscription-plans.ts — do not rename without updating both.
 */
export default function WatcherUpgradeCard() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  // Only the three Creator tiers — watchers upgrading to production is a
  // different funnel (production needs company verification) and isn't
  // advertised from this surface.
  const creatorTiers: SubscriptionTier[] = SUBSCRIPTION_TIERS.filter(
    (t) => t.userType === 'creator'
  );

  const handleUpgrade = async (tierId: string) => {
    try {
      setLoadingTier(tierId);
      const result = await paymentsAPI.subscribe(tierId, billingInterval) as { url?: string; error?: string };

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      toast.error(
        result.error
          || 'Payments are not configured yet. Please try again shortly.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start checkout';
      toast.error(msg);
    } finally {
      setLoadingTier(null);
    }
  };

  const savings = (monthly: number, annual: number) =>
    Math.max(0, Math.round((1 - annual / (monthly * 12)) * 100));

  return (
    <div className="space-y-6">
      {/* Value proposition */}
      <div className="bg-gradient-to-br from-cyan-50 to-purple-50 border border-cyan-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            <Crown className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Ready to publish?</h3>
            <p className="text-sm text-gray-600">
              You're on the free Watcher plan — upgrade to Creator to publish your drafts.
            </p>
          </div>
        </div>
        <ul className="text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pl-1">
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" />Publish pitches to the marketplace</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" />Monthly Creator Credits included</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" />Sign & approve NDAs</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" />Analytics & audience insights</li>
        </ul>
      </div>

      {/* Billing interval toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setBillingInterval('monthly')}
            className={`px-4 py-1.5 text-sm rounded-md transition ${
              billingInterval === 'monthly'
                ? 'bg-cyan-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval('annual')}
            className={`px-4 py-1.5 text-sm rounded-md transition ${
              billingInterval === 'annual'
                ? 'bg-cyan-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Annual
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {creatorTiers.map((tier, idx) => {
          const isMiddle = idx === 1;
          const price = billingInterval === 'monthly' ? tier.price.monthly : tier.price.annual;
          const priceSuffix = billingInterval === 'monthly' ? '/mo' : '/yr';
          const savingsPct = billingInterval === 'annual'
            ? savings(tier.price.monthly, tier.price.annual)
            : 0;
          const isLoading = loadingTier === tier.id;

          return (
            <div
              key={tier.id}
              className={`relative bg-white rounded-xl border shadow-sm p-6 flex flex-col ${
                isMiddle ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-gray-200'
              }`}
            >
              {isMiddle && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-cyan-600 text-white text-xs font-semibold rounded-full shadow">
                  Most popular
                </div>
              )}

              <h4 className="text-lg font-bold text-gray-900">{tier.name}</h4>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">€{price}</span>
                <span className="text-sm text-gray-500">{priceSuffix}</span>
              </div>
              {savingsPct > 0 && (
                <span className="mt-1 text-xs text-green-700">Save {savingsPct}% vs monthly</span>
              )}

              <ul className="mt-4 space-y-2 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={isLoading || loadingTier !== null}
                onClick={() => void handleUpgrade(tier.id)}
                className={`mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition ${
                  isMiddle
                    ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirecting…
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Upgrade to {tier.name}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 text-center">
        You'll be redirected to Stripe to complete payment. You can cancel anytime from this page.
      </p>
    </div>
  );
}
