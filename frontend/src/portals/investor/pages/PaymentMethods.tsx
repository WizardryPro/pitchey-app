import { Shield } from 'lucide-react';
import { Card, CardContent } from '@shared/components/ui/card';
import StripePortalCard from '@features/billing/components/StripePortalCard';

/**
 * Investor payment methods. Cards/invoices/subscription are managed through Stripe's
 * hosted Customer Portal (StripePortalCard). The previous "payment integration coming
 * soon" placeholder pre-dated the live Stripe integration and was removed.
 */
const PaymentMethods = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 mt-20">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Payment Methods</h1>
            <p className="text-muted-foreground mt-2">
              Manage your payment methods and billing for investments and subscriptions
            </p>
          </div>

          <div className="mb-6">
            <StripePortalCard />
          </div>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-700">
                  Cards, invoices, and billing details are handled in the secure Stripe portal above.
                  We never store sensitive card details on our servers.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethods;
