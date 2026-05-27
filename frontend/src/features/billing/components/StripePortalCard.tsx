import { useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { paymentsAPI } from '../../../lib/apiServices';

export default function StripePortalCard() {
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);
    try {
      const result = await paymentsAPI.openBillingPortal();
      if (result.success) {
        window.location.assign(result.url);
        return;
      }
      toast.error(result.error || 'Could not open billing portal.');
    } catch {
      toast.error('Could not open billing portal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-start gap-3">
        <CreditCard className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold text-gray-900">Manage billing on Stripe</h3>
          <p className="text-sm text-gray-600 mt-0.5">
            Update your card, download invoices, change your billing email, or cancel your subscription.
          </p>
        </div>
      </div>
      <button
        onClick={openPortal}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg whitespace-nowrap shrink-0"
      >
        {loading ? 'Opening…' : (
          <>
            Open portal
            <ExternalLink className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
}
