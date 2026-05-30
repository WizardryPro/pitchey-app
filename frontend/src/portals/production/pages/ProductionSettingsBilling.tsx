import { CreditCard } from 'lucide-react';
import StripePortalCard from '@features/billing/components/StripePortalCard';

/**
 * Production billing. Real billing (cards, invoices, billing address, cancellation)
 * is handled by Stripe's hosted Customer Portal via StripePortalCard. The previous
 * tabbed UI (Free Plan / Payment Methods / Billing Info / Invoices) was all stub data
 * and toast-only buttons that pre-dated the live Stripe integration — removed so the
 * page only shows what actually works.
 */
export default function ProductionSettingsBilling() {
  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Billing & Payments</h1>
          <p className="mt-2 text-gray-600">Manage your subscription, payment methods, and invoices.</p>
        </div>

        <div className="mb-8">
          <StripePortalCard />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">
            Payment methods, invoices, billing address, and cancellation are all managed in the
            secure billing portal above — click &ldquo;Manage billing&rdquo; to open it.
          </p>
        </div>
      </div>
    </div>
  );
}
