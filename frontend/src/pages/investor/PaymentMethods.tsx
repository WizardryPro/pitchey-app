import {
  CreditCard, Shield, Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';

const PaymentMethods = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Payment Methods</h1>
            <p className="text-muted-foreground mt-2">
              Manage your payment methods for investments and transactions
            </p>
          </div>

          {/* Security Notice */}
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Bank-Level Security</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Your payment information will be encrypted and secured with industry-standard protection.
                    We never store sensitive card details on our servers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Empty State */}
          <div className="text-center py-16">
            <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment integration coming soon</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Secure payment processing via Stripe is being integrated.
              You will be able to add credit cards, bank accounts, and wire transfers for investments.
            </p>
          </div>

          {/* Payment Information */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Accepted Payment Methods</h4>
                <p className="text-sm text-muted-foreground">
                  We will accept all major credit cards (Visa, Mastercard, American Express),
                  ACH bank transfers, and wire transfers for investments over $100,000.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Processing Times</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Credit/Debit Cards: Instant</li>
                  <li className="flex items-center gap-2"><Building2 className="h-4 w-4" /> ACH Transfers: 2-3 business days</li>
                  <li className="flex items-center gap-2"><Shield className="h-4 w-4" /> Wire Transfers: 1-2 business days</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethods;
