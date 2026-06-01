import { useState } from 'react';
import {
  Crown,
  Check,
  X,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { paymentsAPI } from '@/lib/apiServices';
import { useBetterAuthStore } from '@/store/betterAuthStore';
import {
  getSubscriptionTiersByUserType,
  getSubscriptionTier,
  type SubscriptionTier,
} from '@/config/subscription-plans';

interface SubscriptionCardProps {
  subscription: any;
  onRefresh: () => void;
}

// Per-portal "Most Popular" callout — middle tier of each ladder.
const POPULAR_TIER_BY_PORTAL: Record<string, string> = {
  creator: 'creator_plus',
  production: 'production_plus',
  investor: 'exec',
};

export default function SubscriptionCard({ subscription, onRefresh }: SubscriptionCardProps) {
  const { user } = useBetterAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Backend expects 'monthly' | 'annual' — UI still says "Yearly" for clarity.
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'annual'>('monthly');

  // Treat 'free' (legacy) the same as 'watcher' (current free tier id).
  const rawTier = subscription?.tier;
  const currentTierId = rawTier === 'free' ? 'watcher' : rawTier;
  const subscriptionStatus = subscription?.status || 'inactive';
  const isActive = subscriptionStatus === 'active';
  const cancelAtPeriodEnd = subscription?.subscription?.cancelAtPeriodEnd;
  const currentPeriodEnd = subscription?.subscription?.currentPeriodEnd
    ? new Date(subscription.subscription.currentPeriodEnd)
    : null;

  const userType = (user?.userType || 'creator') as 'creator' | 'investor' | 'production' | 'watcher' | 'viewer';
  // Watchers are audience-only — no subscription paths shown.
  // Fall back to creator tiers for viewer (legacy alias).
  const portalForTiers = userType === 'viewer' ? 'watcher' : userType;
  const availableTiers: SubscriptionTier[] = getSubscriptionTiersByUserType(portalForTiers);
  const popularTierId = POPULAR_TIER_BY_PORTAL[portalForTiers] || '';

  const currentTierDef = currentTierId ? getSubscriptionTier(currentTierId) : null;
  const currentTierName = currentTierDef?.name || 'Free';

  const handleUpgrade = async (planKey: string) => {
    const plan = getSubscriptionTier(planKey);
    if (!plan || plan.price.monthly === 0) return; // free tier — nothing to subscribe to

    try {
      setLoading(true);
      setError(null);

      const result = await paymentsAPI.subscribe(planKey, selectedBilling) as any;

      if (result && result.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result?.error || 'No checkout URL received');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start upgrade process');
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!isActive) return;

    const confirmed = confirm(
      'Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period.'
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);

      await paymentsAPI.cancelSubscription();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (n: number) => {
    if (n === 0) return null;
    // Keep two decimals only when fractional (e.g. 19.99) so 199 stays "199".
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Current Subscription</h3>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-purple-600" />
            <span className="font-medium text-purple-600">
              {currentTierName}
            </span>
          </div>
        </div>

        {isActive ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="flex items-center gap-2 text-green-600">
                <Check className="w-4 h-4" />
                Active
              </span>
            </div>

            {currentPeriodEnd && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">
                  {cancelAtPeriodEnd ? 'Access expires:' : 'Next payment:'}
                </span>
                <span className="text-gray-900">
                  {currentPeriodEnd.toLocaleDateString()}
                </span>
              </div>
            )}

            {cancelAtPeriodEnd && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Subscription will be cancelled at the end of the current period
                  </span>
                </div>
              </div>
            )}

            {!cancelAtPeriodEnd && (
              <div className="pt-3">
                <button
                  onClick={handleCancelSubscription}
                  disabled={loading}
                  className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm"
                >
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="flex items-center gap-2 text-gray-500">
                <X className="w-4 h-4" />
                No active subscription
              </span>
            </div>
            <p className="text-gray-600 text-sm">
              Upgrade to a paid plan to unlock advanced features and remove limitations.
            </p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Billing Toggle */}
      <div className="text-center">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSelectedBilling('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedBilling === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setSelectedBilling('annual')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedBilling === 'annual'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly (≈2 months free)
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {availableTiers.map((plan) => {
          const planKey = plan.id;
          const isCurrentPlan = currentTierId === planKey;
          const isFree = plan.price.monthly === 0;
          const isPopular = planKey === popularTierId;
          const monthly = plan.price.monthly;
          const annual = plan.price.annual;
          const displayedPrice = selectedBilling === 'annual' ? annual : monthly;
          const annualSavings = !isFree && monthly > 0
            ? Math.max(0, monthly * 12 - annual)
            : 0;
          // A paid tier priced below the current tier is a downgrade, not an upgrade
          // (e.g. Karl on the unlimited/top plan sees "Downgrade" for cheaper tiers).
          const currentMonthly = currentTierDef?.price?.monthly ?? 0;
          const isDowngrade = !isCurrentPlan && !isFree && monthly < currentMonthly;

          return (
            <div
              key={planKey}
              className={`border-2 rounded-xl p-6 relative ${
                isCurrentPlan
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-purple-300'
              } transition-all`}
            >
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Current Plan
                  </span>
                </div>
              )}

              {!isCurrentPlan && isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-2">
                  {isFree ? (
                    <span className="text-3xl font-bold text-gray-900">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-gray-900">
                        €{formatPrice(displayedPrice)}
                      </span>
                      <span className="text-gray-500">
                        /{selectedBilling === 'annual' ? 'year' : 'month'}
                      </span>
                    </>
                  )}
                </div>

                {selectedBilling === 'annual' && annualSavings > 0 && (
                  <div className="text-sm text-green-600">
                    Save €{formatPrice(annualSavings)}/year
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{feature}</span>
                  </div>
                ))}
                {plan.credits > 0 && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{plan.credits} credits / month</span>
                  </div>
                )}
                {plan.credits === -1 && (
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">Unlimited credits</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleUpgrade(planKey)}
                disabled={loading || isCurrentPlan || isFree}
                className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors ${
                  isCurrentPlan || isFree
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : isDowngrade
                    ? 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
                    : isPopular
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                } disabled:opacity-50`}
              >
                {loading
                  ? 'Processing...'
                  : isCurrentPlan
                  ? 'Current Plan'
                  : isFree
                  ? 'Free Forever'
                  : isDowngrade
                  ? `Downgrade to ${plan.name}`
                  : `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
