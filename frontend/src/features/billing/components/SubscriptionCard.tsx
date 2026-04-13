import { useState } from 'react';
import { 
  Crown, 
  Check, 
  X, 
  Star, 
  Zap, 
  Shield, 
  Upload, 
  BarChart3,
  MessageSquare,
  Eye,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { paymentsAPI } from '@/lib/apiServices';

interface SubscriptionCardProps {
  subscription: any;
  onRefresh: () => void;
}

const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: [
      'Up to 2 pitch uploads',
      'Basic analytics',
      '10 messages per month',
      'Community support'
    ],
    limits: [
      'Limited to public viewing only',
      'Basic features only',
      'Basic support only'
    ]
  },
  basic: {
    name: 'Basic',
    price: 29,
    features: [
      'Up to 10 pitch uploads',
      'Advanced analytics',
      '100 messages per month',
      'NDA management',
      'Email support',
      'Custom branding'
    ],
    limits: [
      'Limited storage space',
      'Standard processing priority'
    ]
  },
  pro: {
    name: 'Pro',
    price: 99,
    features: [
      'Unlimited pitch uploads',
      'Advanced analytics with AI insights',
      'Unlimited messaging',
      'Advanced NDA management',
      'Email support',
      'Custom branding',
      'API access',
      'Export capabilities'
    ],
    limits: []
  },
  enterprise: {
    name: 'Enterprise',
    price: 299,
    features: [
      'Everything in Pro',
      'White-label solution',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantees',
      'Custom analytics',
      'Team management',
      'Advanced security features'
    ],
    limits: []
  }
};

export default function SubscriptionCard({ subscription, onRefresh }: SubscriptionCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Backend expects 'monthly' | 'annual' — UI still says "Yearly" for clarity.
  const [selectedBilling, setSelectedBilling] = useState<'monthly' | 'annual'>('monthly');

  const currentTier = subscription?.tier || 'free';
  const subscriptionStatus = subscription?.status || 'inactive';
  const isActive = subscriptionStatus === 'active';
  const cancelAtPeriodEnd = subscription?.subscription?.cancelAtPeriodEnd;
  const currentPeriodEnd = subscription?.subscription?.currentPeriodEnd 
    ? new Date(subscription.subscription.currentPeriodEnd) 
    : null;

  const handleUpgrade = async (planKey: string) => {
    if (planKey === 'free') return;
    
    try {
      setLoading(true);
      setError(null);

      const result = await paymentsAPI.subscribe(planKey, selectedBilling) as any;

      if (result && result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url;
      } else {
        throw new Error('No checkout URL received');
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

  const getYearlyPrice = (monthlyPrice: number) => {
    return Math.floor(monthlyPrice * 12 * 0.8); // 20% discount for yearly
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
              {PLANS[currentTier as keyof typeof PLANS]?.name || 'Free'}
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

            <div className="flex gap-3 pt-3">
              {!cancelAtPeriodEnd && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={loading}
                  className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 text-sm"
                >
                  Cancel Subscription
                </button>
              )}
              
              <button
                onClick={() => window.open('https://billing.stripe.com', '_blank')}
                className="px-4 py-2 text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50 text-sm flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Manage in Stripe
              </button>
            </div>
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
            Yearly (20% off)
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(PLANS).map(([planKey, plan]) => {
          const isCurrentPlan = currentTier === planKey;
          const price = selectedBilling === 'annual' 
            ? getYearlyPrice(plan.price) 
            : plan.price;
          const originalYearlyPrice = plan.price * 12;

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

              {planKey === 'pro' && (
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
                  {plan.price === 0 ? (
                    <span className="text-3xl font-bold text-gray-900">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-gray-900">
                        ${price}
                      </span>
                      <span className="text-gray-500">
                        /{selectedBilling === 'annual' ? 'year' : 'month'}
                      </span>
                    </>
                  )}
                </div>
                
                {selectedBilling === 'annual' && plan.price > 0 && (
                  <div className="text-sm text-green-600">
                    Save ${originalYearlyPrice - price}/year
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
                
                {plan.limits.map((limit, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-500">{limit}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleUpgrade(planKey)}
                disabled={loading || isCurrentPlan || planKey === 'free'}
                className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors ${
                  isCurrentPlan
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : planKey === 'free'
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : planKey === 'pro'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                } disabled:opacity-50`}
              >
                {loading ? 'Processing...' : 
                 isCurrentPlan ? 'Current Plan' :
                 planKey === 'free' ? 'Free Forever' : 
                 `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Comparison</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Feature</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">Free</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">Basic</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">Pro</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-700">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Pitch Uploads
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">2</td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">10</td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">Unlimited</td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">Basic</td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">Advanced</td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">AI Insights</td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">Custom</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Messages/Month
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">10</td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">100</td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">Unlimited</td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm text-gray-900 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  NDA Management
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">
                  <X className="w-4 h-4 text-red-400 mx-auto" />
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 mx-auto" />
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 mx-auto" />
                </td>
                <td className="py-3 px-4 text-center text-sm text-gray-600">
                  <Check className="w-4 h-4 text-green-500 mx-auto" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}