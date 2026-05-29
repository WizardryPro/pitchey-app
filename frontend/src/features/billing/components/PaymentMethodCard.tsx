import { useState } from 'react';
import { 
  CreditCard, 
  Plus, 
  Star, 
  Trash2, 
  Shield, 
  AlertTriangle,
  Check,
  ExternalLink
} from 'lucide-react';
import { paymentsAPI } from '@/lib/apiServices';

interface PaymentMethodCardProps {
  paymentMethods: any[];
  onRefresh: () => void;
}

export default function PaymentMethodCard({ paymentMethods, onRefresh }: PaymentMethodCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Adding/managing cards is handled by Stripe's hosted Customer Portal. The portal
  // endpoint resolves (or creates) the Stripe customer, so this works even for users
  // who have never subscribed.
  const handleManageBilling = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await paymentsAPI.openBillingPortal();

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        setError(('error' in result && result.error) || 'Unable to open the billing portal. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open the billing portal');
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    const confirmed = confirm(
      'Are you sure you want to remove this payment method? This action cannot be undone.'
    );
    
    if (!confirmed) return;

    try {
      setActionLoading(paymentMethodId);
      setError(null);

      await paymentsAPI.removePaymentMethod(paymentMethodId);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to remove payment method');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      setActionLoading(paymentMethodId);
      setError(null);

      await paymentsAPI.setDefaultPaymentMethod(paymentMethodId);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to set default payment method');
    } finally {
      setActionLoading(null);
    }
  };

  const getCardIcon = (brand: string) => {
    // In a real app, you'd use actual card brand icons
    return <CreditCard className="w-5 h-5" />;
  };

  const formatCardNumber = (last4: string) => {
    return `•••• •••• •••• ${last4}`;
  };

  const getCardBrandName = (brand: string) => {
    const brandNames: { [key: string]: string } = {
      'visa': 'Visa',
      'mastercard': 'Mastercard',
      'amex': 'American Express',
      'discover': 'Discover',
      'diners': 'Diners Club',
      'jcb': 'JCB',
      'unionpay': 'UnionPay'
    };
    return brandNames[brand?.toLowerCase()] || brand?.toUpperCase() || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
          <p className="text-sm text-gray-600">Manage your saved payment methods for subscriptions and purchases</p>
        </div>
        <button
          onClick={handleManageBilling}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Adding...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Add Payment Method
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Secure Payment Processing</h4>
            <p className="text-sm text-blue-700">
              All payment methods are securely stored and processed by Stripe. 
              We never store your complete card details on our servers.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Methods List */}
      {paymentMethods && paymentMethods.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {paymentMethods.map((method: any) => (
            <div
              key={method.id}
              className={`border-2 rounded-xl p-6 relative transition-all ${
                method.isDefault
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {method.isDefault && (
                <div className="absolute -top-3 left-4">
                  <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Default
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    {getCardIcon(method.card?.brand)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {getCardBrandName(method.card?.brand)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatCardNumber(method.card?.last4)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <button
                      onClick={() => handleSetDefault(method.id)}
                      disabled={actionLoading === method.id}
                      className="p-2 text-gray-400 hover:text-purple-600 transition-colors"
                      title="Set as default"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleRemovePaymentMethod(method.id)}
                    disabled={actionLoading === method.id}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Remove payment method"
                  >
                    {actionLoading === method.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Expires:</span>
                  <span className="text-gray-900">
                    {method.card?.expMonth?.toString().padStart(2, '0')}/{method.card?.expYear}
                  </span>
                </div>
                
                {method.billingDetails?.name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="text-gray-900">{method.billingDetails.name}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Added:</span>
                  <span className="text-gray-900">
                    {new Date(method.created * 1000).toLocaleDateString()}
                  </span>
                </div>

                {method.card?.funding && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="text-gray-900 capitalize">{method.card.funding}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex gap-2">
                {!method.isDefault && (
                  <button
                    onClick={() => handleSetDefault(method.id)}
                    disabled={actionLoading === method.id}
                    className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-1"
                  >
                    {actionLoading === method.id ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-700"></div>
                        Setting...
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3" />
                        Set as Default
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={handleManageBilling}
                  disabled={loading}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border rounded-lg">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment Methods</h3>
          <p className="text-gray-500 mb-6">
            Add a payment method to make purchases and manage subscriptions
          </p>
          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Your First Payment Method
              </>
            )}
          </button>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-white border rounded-lg p-6">
        <h4 className="font-medium text-gray-900 mb-4">Payment Method Help</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="font-medium text-gray-900 mb-2">Supported Cards</h5>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Visa, Mastercard, American Express</li>
              <li>• Discover, Diners Club, JCB</li>
              <li>• Most international debit cards</li>
              <li>• Digital wallets (Apple Pay, Google Pay)</li>
            </ul>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-900 mb-2">Security Features</h5>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 256-bit SSL encryption</li>
              <li>• PCI DSS compliant processing</li>
              <li>• Fraud detection and prevention</li>
              <li>• 3D Secure authentication</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h5 className="font-medium text-gray-900 mb-2">Having Issues?</h5>
          <p className="text-sm text-gray-600 mb-3">
            If you're having trouble adding or managing payment methods, here are some common solutions:
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Ensure your card has sufficient funds and is not expired</li>
            <li>• Check that your billing address matches your card statement</li>
            <li>• Try using a different browser or clearing your cache</li>
            <li>• Contact your bank if transactions are being declined</li>
          </ul>
        </div>
      </div>
    </div>
  );
}