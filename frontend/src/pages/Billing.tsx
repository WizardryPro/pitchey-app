import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  CreditCard,
  Download,
  History,
  Settings,
  Star,
  Receipt,
  Coins,
  Crown,
} from 'lucide-react';
import { useBetterAuthStore } from '../store/betterAuthStore';
import { paymentsAPI } from '../lib/apiServices';
import SubscriptionCard from '@features/billing/components/SubscriptionCard';
import CreditPurchase from '@features/billing/components/CreditPurchase';
import PaymentHistory from '@features/billing/components/PaymentHistory';
import PaymentMethodCard from '@features/billing/components/PaymentMethodCard';
import { getSubscriptionTier } from '../config/subscription-plans';

export default function Billing() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useBetterAuthStore();
  const validTabs = ['overview', 'subscription', 'credits', 'history', 'invoices', 'payment-methods'];
  const tabParam = searchParams.get('tab');
  // When the user lands here from Stripe with ?subscription=success, jump
  // them to the subscription tab so they can see the confirmation in context.
  const subscriptionStatus = searchParams.get('subscription');
  const activeTab = subscriptionStatus === 'success'
    ? 'subscription'
    : (tabParam && validTabs.includes(tabParam) ? tabParam : 'overview');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Billing data states
  const [subscription, setSubscription] = useState<any>(null);
  const [credits, setCredits] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  const userType = (user?.userType || 'creator') as 'creator' | 'investor' | 'production' | 'watcher' | 'viewer';

  useEffect(() => {
    fetchBillingData();
  }, []);

  useEffect(() => {
    if (subscriptionStatus === 'success') {
      toast.success('Subscription active — enjoy your new plan!');
      setSearchParams({ tab: 'subscription' });
    } else if (subscriptionStatus === 'cancelled') {
      toast.error('Checkout cancelled.');
      setSearchParams({ tab: 'subscription' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionStatus]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all billing data in parallel
      const [
        subscriptionData,
        creditsData,
        historyData,
        invoicesData,
        paymentMethodsData
      ] = await Promise.all([
        paymentsAPI.getSubscriptionStatus(),
        paymentsAPI.getCreditBalance(),
        paymentsAPI.getPaymentHistory({ limit: 20 }),
        paymentsAPI.getInvoices({ limit: 20 }),
        paymentsAPI.getPaymentMethods()
      ]);

      setSubscription(subscriptionData);
      setCredits(creditsData);
      setPaymentHistory((historyData as any)?.payments || []);
      setInvoices((invoicesData as any)?.invoices || []);
      setPaymentMethods((paymentMethodsData as any)?.paymentMethods || []);

    } catch (err: any) {
      console.error('Failed to fetch billing data:', err);
      setError(err.message || 'Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };


  const tabs = [
    { id: 'overview', label: 'Overview', icon: Star },
    { id: 'subscription', label: 'Subscription', icon: Crown },
    { id: 'credits', label: 'Credits', icon: Coins },
    { id: 'history', label: 'Payment History', icon: History },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'payment-methods', label: 'Payment Methods', icon: CreditCard },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page heading — global chrome (logo, credits, profile) comes from PortalLayout's MinimalHeader */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Payments</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your subscription and billing</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchBillingData}
            className="mt-2 text-red-600 hover:text-red-800 underline text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {/* Main Content */}
      <div>
        {/* Tab Navigation — horizontally scrollable at narrow viewports so all 6 tabs stay reachable on mobile */}
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams);
                      params.set('tab', tab.id);
                      navigate(`?${params.toString()}`, { replace: true });
                    }}
                    className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap shrink-0 ${
                      activeTab === tab.id
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <OverviewTab 
                subscription={subscription}
                credits={credits}
                paymentHistory={paymentHistory}
                onRefresh={fetchBillingData}
              />
            )}
            
            {activeTab === 'subscription' && (
              (userType === 'viewer' || userType === 'watcher') ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 mb-4">
                    <Crown className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Watcher accounts don't have subscriptions
                  </h3>
                  <p className="text-sm text-gray-600 max-w-md mx-auto">
                    Watchers can browse, like, and comment on pitches. To create, invest in, or produce pitches, sign up separately as a Creator, Investor, or Production account at{' '}
                    <Link to="/signup" className="text-purple-600 hover:text-purple-700 font-medium">pitchey.com</Link>.
                  </p>
                  <p className="text-sm text-gray-500 mt-4">
                    You can still buy credits under the <button onClick={() => { const params = new URLSearchParams(searchParams); params.set('tab', 'credits'); navigate(`?${params.toString()}`, { replace: true }); }} className="text-purple-600 hover:text-purple-700 underline">Credits tab</button>.
                  </p>
                </div>
              ) : (
                <SubscriptionCard
                  subscription={subscription}
                  onRefresh={fetchBillingData}
                />
              )
            )}
            
            {activeTab === 'credits' && (
              <CreditPurchase 
                credits={credits}
                onRefresh={fetchBillingData}
              />
            )}
            
            {activeTab === 'history' && (
              <PaymentHistory 
                payments={paymentHistory}
                onRefresh={fetchBillingData}
              />
            )}
            
            {activeTab === 'invoices' && (
              <InvoicesTab 
                invoices={invoices}
                onRefresh={fetchBillingData}
              />
            )}
            
            {activeTab === 'payment-methods' && (
              <PaymentMethodCard 
                paymentMethods={paymentMethods}
                onRefresh={fetchBillingData}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ subscription, credits, paymentHistory, onRefresh }: any) {
  const nextPayment = subscription?.subscription?.currentPeriodEnd
    ? new Date(subscription.subscription.currentPeriodEnd)
    : null;

  const recentPayments = paymentHistory?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Current Plan</h3>
            <Crown className="w-6 h-6" />
          </div>
          <p className="text-2xl font-bold mb-2">
            {(() => {
              const tier = getSubscriptionTier(subscription?.tier || '');
              return tier?.name || 'Free Plan';
            })()}
          </p>
          <p className="text-purple-100 text-sm">
            {subscription?.status === 'active' ? (
              <>
                {nextPayment && `Next payment: ${nextPayment.toLocaleDateString()}`}
              </>
            ) : (
              'No active subscription'
            )}
          </p>
        </div>

        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Credit Balance</h3>
            <Coins className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-2">
            {credits?.balance?.credits ?? credits?.credits ?? 0}
          </p>
          <p className="text-gray-500 text-sm">
            Total purchased: {credits?.balance?.totalPurchased ?? 0} |
            Total used: {credits?.balance?.totalUsed ?? 0}
          </p>
        </div>
      </div>

      {/* Recent Activity — backend serves rows from credit_transactions, so these are credit grants/usage, not dollar payments */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Credit Activity</h3>
        {recentPayments.length > 0 ? (
          <div className="space-y-3">
            {recentPayments.map((payment: any, index: number) => {
              const isDebit = payment.type === 'usage';
              const amount = parseFloat(payment.amount);
              return (
                <div key={index} className="flex items-center justify-between py-3 border-b last:border-b-0">
                  <div>
                    <p className="font-medium text-gray-900">{payment.description}</p>
                    <p className="text-sm text-gray-500">{new Date(payment.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                      {isDebit ? '−' : '+'}{Math.abs(amount)} credits
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{payment.type}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No recent activity</p>
        )}
      </div>
    </div>
  );
}

// Invoices Tab Component
function InvoicesTab({ invoices, onRefresh }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
        <button
          onClick={onRefresh}
          className="text-purple-600 hover:text-purple-700 text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {invoices.length > 0 ? (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((invoice: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium text-gray-900">
                      #{invoice.id || `INV-${index + 1}`}
                    </p>
                    <p className="text-sm text-gray-500">{invoice.description}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${(parseFloat(invoice.amount) / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => toast('Available after billing is connected', { icon: 'ℹ️' })}
                      className="text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white border rounded-lg">
          <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No invoices found</p>
        </div>
      )}
    </div>
  );
}