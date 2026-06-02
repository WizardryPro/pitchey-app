import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import {
  SUBSCRIPTION_TIERS,
  CREDIT_PACKAGES,
  getSubscriptionTiersByUserType,
} from '../config/subscription-plans';

// Public pricing page. Sourced entirely from config/subscription-plans so it
// can't drift from what checkout actually charges. Prices are EUR today; this
// will need to respect locale pricing once Stripe price-localisation lands
// (Priority 7) — read it from the same config so both stay in sync.
const CURRENCY = '€';

const GROUPS: { key: string; label: string; blurb: string }[] = [
  { key: 'creator', label: 'For Creators', blurb: 'Pitch your stories and reach investors and production companies.' },
  { key: 'production', label: 'For Production Companies', blurb: 'Source projects, manage NDAs, and run your development pipeline.' },
  { key: 'exec', label: 'For Executives & Studios', blurb: 'Discover and evaluate pitches at scale.' },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  const price = (tier: typeof SUBSCRIPTION_TIERS[number]) =>
    billing === 'monthly' ? tier.price.monthly : tier.price.annual;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits how you work. Watchers browse for free — no plan needed.
          </p>

          {/* Billing cycle toggle */}
          <div className="inline-flex items-center gap-1 mt-6 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${billing === 'monthly' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition ${billing === 'annual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              Annual
            </button>
          </div>
        </div>

        {GROUPS.map((group) => {
          const tiers = getSubscriptionTiersByUserType(group.key);
          if (!tiers.length) return null;
          return (
            <section key={group.key} className="mb-14">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{group.label}</h2>
                <p className="text-gray-600">{group.blurb}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {tiers.map((tier, i) => {
                  const featured = i === 1; // middle tier highlighted
                  return (
                    <div
                      key={tier.id}
                      className={`relative bg-white rounded-2xl border p-6 flex flex-col ${featured ? 'border-purple-300 shadow-lg ring-1 ring-purple-200' : 'border-gray-200 shadow-sm'}`}
                    >
                      {featured && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-purple-600 text-white text-xs font-medium">
                          <Sparkles className="w-3 h-3" /> Most popular
                        </span>
                      )}
                      <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-gray-900">{CURRENCY}{price(tier).toFixed(2)}</span>
                        <span className="text-sm text-gray-500">/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {tier.credits === -1 ? 'Unlimited credits' : `${tier.credits} credits / month`}
                      </p>
                      <ul className="mt-5 space-y-2 flex-1">
                        {tier.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                            <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => navigate('/portals')}
                        className={`mt-6 w-full py-2.5 rounded-lg font-medium transition ${featured ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                      >
                        Get Started
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Pay-as-you-go credits */}
        <section className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Pay-as-you-go credits</h2>
            <p className="text-gray-600">Prefer not to subscribe? Top up credits any time.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <div key={pkg.credits} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-center">
                <p className="text-2xl font-bold text-gray-900">{pkg.credits + (pkg.bonus ?? 0)}</p>
                <p className="text-sm text-gray-500">credits{pkg.bonus ? ` (incl. ${pkg.bonus} free)` : ''}</p>
                <p className="mt-3 text-lg font-semibold text-purple-600">{CURRENCY}{pkg.price.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-sm text-gray-500">
          Prices shown in EUR. Questions? <button onClick={() => navigate('/contact')} className="text-purple-600 hover:underline">Contact us</button>.
        </p>
      </div>
    </div>
  );
}
