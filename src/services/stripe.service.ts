/**
 * Stripe Service — Workers-native (fetch + Web Crypto, no SDK dependency)
 * Handles Checkout Sessions, Subscriptions, Payment Methods, and Webhook verification
 */

const STRIPE_API = 'https://api.stripe.com/v1';

export class StripeService {
  constructor(private secretKey: string) {}

  private async request<T = any>(method: string, endpoint: string, params?: Record<string, string>): Promise<T> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const body = params ? new URLSearchParams(params).toString() : undefined;
    const response = await fetch(`${STRIPE_API}${endpoint}`, { method, headers, body });
    const data = await response.json() as any;

    if (!response.ok) {
      const msg = data?.error?.message || `Stripe API error: ${response.status}`;
      throw new Error(msg);
    }

    return data as T;
  }

  // ── Checkout Sessions ──

  async createSubscriptionCheckout(params: {
    userId: number;
    email: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; url: string }> {
    return this.request('POST', '/checkout/sessions', {
      mode: 'subscription',
      'payment_method_types[0]': 'card',
      customer_email: params.email,
      'line_items[0][price]': params.priceId,
      'line_items[0][quantity]': '1',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      'metadata[userId]': String(params.userId),
      'metadata[type]': 'subscription',
      'subscription_data[metadata][userId]': String(params.userId),
    });
  }

  async createCreditPurchaseCheckout(params: {
    userId: number;
    email: string;
    credits: number;
    priceInCents: number;
    packageId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; url: string }> {
    return this.request('POST', '/checkout/sessions', {
      mode: 'payment',
      'payment_method_types[0]': 'card',
      customer_email: params.email,
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][product_data][name]': `${params.credits} Pitchey Credits`,
      'line_items[0][price_data][unit_amount]': String(params.priceInCents),
      'line_items[0][quantity]': '1',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      'metadata[userId]': String(params.userId),
      'metadata[credits]': String(params.credits),
      'metadata[package]': params.packageId,
      'metadata[type]': 'credits',
    });
  }

  // ── Subscriptions ──

  async cancelSubscription(subscriptionId: string): Promise<any> {
    return this.request('POST', `/subscriptions/${subscriptionId}`, {
      cancel_at_period_end: 'true',
    });
  }

  async getSubscription(subscriptionId: string): Promise<any> {
    return this.request('GET', `/subscriptions/${subscriptionId}`);
  }

  // ── Payment Methods ──

  async createSetupIntent(customerId: string): Promise<{ client_secret: string }> {
    return this.request('POST', '/setup_intents', {
      customer: customerId,
      'payment_method_types[0]': 'card',
    });
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<any> {
    return this.request('POST', `/payment_methods/${paymentMethodId}/detach`);
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<any> {
    return this.request('POST', `/customers/${customerId}`, {
      'invoice_settings[default_payment_method]': paymentMethodId,
    });
  }

  // ── Customers ──

  async getOrCreateCustomer(email: string, userId: number): Promise<{ id: string }> {
    // Search for existing customer
    const existing = await this.request<{ data: Array<{ id: string }> }>('GET', `/customers?email=${encodeURIComponent(email)}&limit=1`);
    if (existing.data.length > 0) {
      return existing.data[0];
    }
    // Create new customer
    return this.request('POST', '/customers', {
      email,
      'metadata[userId]': String(userId),
    });
  }

  // ── Webhook Verification ──

  async verifyWebhookSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
    const elements = sigHeader.split(',');
    const timestamp = elements.find(e => e.startsWith('t='))?.slice(2);
    const signature = elements.find(e => e.startsWith('v1='))?.slice(3);

    if (!timestamp || !signature) return false;

    // Reject timestamps older than 5 minutes to prevent replay attacks
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (age > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSig = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signedPayload)
    );

    const expectedHex = Array.from(new Uint8Array(expectedSig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison
    if (expectedHex.length !== signature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expectedHex.length; i++) {
      mismatch |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  }
}
