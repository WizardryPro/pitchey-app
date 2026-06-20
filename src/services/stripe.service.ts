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
    tier: string;
    successUrl: string;
    cancelUrl: string;
    // Lowercase ISO currency (e.g. 'gbp'). Only set for non-base currencies;
    // requires the price to carry that currency via `currency_options`. When
    // omitted, Stripe uses the price's base currency (EUR) exactly as before.
    currency?: string;
    // Stripe promotion-code id (promo_…) to PRE-APPLY (in-app promo field). When
    // set, the discount is locked onto the session and the user never touches
    // Stripe's promo box. Mutually exclusive with allow_promotion_codes.
    promotionCodeId?: string;
  }): Promise<{ id: string; url: string }> {
    // `tier` is stamped into metadata so the webhook can look up the plan
    // (creator / production / exec) without having to reverse-engineer it
    // from the Stripe price ID. Critical for the watcher→creator upgrade
    // flow: the webhook needs the tier to know whether to flip user_type.
    const sessionParams: Record<string, string> = {
      mode: 'subscription',
      'payment_method_types[0]': 'card',
      customer_email: params.email,
      'line_items[0][price]': params.priceId,
      'line_items[0][quantity]': '1',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      // A 100%-off code leaves nothing due now; 'if_required' skips card collection
      // in that case while still collecting a card on paid/discounted-but-nonzero subs.
      payment_method_collection: 'if_required',
      'metadata[userId]': String(params.userId),
      'metadata[type]': 'subscription',
      'metadata[tier]': params.tier,
      'subscription_data[metadata][userId]': String(params.userId),
      'subscription_data[metadata][tier]': params.tier,
    };
    if (params.promotionCodeId) {
      // Pre-applied in-app code: lock the discount on. Stripe forbids combining
      // `discounts` with `allow_promotion_codes`, so it's one or the other.
      sessionParams['discounts[0][promotion_code]'] = params.promotionCodeId;
    } else {
      // No in-app code → still show Stripe's own promo box on the hosted page
      // (FreeThePitch100 / LifesAPitch50) so the manual path keeps working.
      sessionParams['allow_promotion_codes'] = 'true';
    }
    if (params.currency) sessionParams.currency = params.currency;
    return this.request('POST', '/checkout/sessions', sessionParams);
  }

  // Look up a single ACTIVE promotion code by its human-facing code
  // (e.g. "FreeThePitch100"). Returns null when there's no active, still-valid
  // match. Powers the in-app promo field (validate + pre-apply).
  async findPromotionCodeByCode(code: string): Promise<{
    id: string; code: string; percentOff: number | null; amountOff: number | null; currency: string | null;
  } | null> {
    const res = await this.request<{ data: any[] }>(
      'GET',
      `/promotion_codes?code=${encodeURIComponent(code)}&active=true&limit=1`
    );
    const pc = res.data?.[0];
    if (!pc) return null;
    const coupon = pc.coupon || {};
    // The promotion code can be active while its underlying coupon has expired
    // or hit its redemption cap — `coupon.valid` is the real gate.
    if (coupon.valid === false) return null;
    return {
      id: pc.id,
      code: pc.code,
      percentOff: coupon.percent_off ?? null,
      amountOff: coupon.amount_off ?? null,
      currency: coupon.currency ?? null,
    };
  }

  async createCreditPurchaseCheckout(params: {
    userId: number;
    email: string;
    credits: number;
    priceInCents: number;
    packageId: string;
    successUrl: string;
    cancelUrl: string;
    // Lowercase ISO currency for the dynamic price_data. Defaults to 'eur'.
    // Same numeric amount across currencies (owner decision), so priceInCents
    // is reused as-is.
    currency?: string;
  }): Promise<{ id: string; url: string }> {
    return this.request('POST', '/checkout/sessions', {
      mode: 'payment',
      'payment_method_types[0]': 'card',
      customer_email: params.email,
      'line_items[0][price_data][currency]': params.currency || 'eur',
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

  // ── Promo-code reporting (admin) ──

  // Promotion codes carry the live redemption counts (times_redeemed /
  // max_redemptions) and, with the coupon expanded, the percent_off.
  async listPromotionCodes(): Promise<{ data: any[] }> {
    return this.request('GET', '/promotion_codes?limit=100');
  }

  // Update a promotion code's metadata (Stripe only allows `active` + `metadata`
  // on update). Used to stamp who an industry code was assigned/sent to.
  async updatePromotionCodeMetadata(id: string, metadata: Record<string, string>): Promise<any> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata)) params[`metadata[${k}]`] = v;
    return this.request('POST', `/promotion_codes/${id}`, params);
  }

  // Retrieve a coupon by id; returns null if it doesn't exist (so callers can
  // create-or-reuse idempotently).
  async retrieveCoupon(id: string): Promise<any | null> {
    try {
      return await this.request('GET', `/coupons/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  }

  async createCoupon(params: { id: string; percentOff: number; duration?: string; name?: string; metadata?: Record<string, string> }): Promise<any> {
    const p: Record<string, string> = {
      id: params.id,
      percent_off: String(params.percentOff),
      duration: params.duration || 'forever',
    };
    if (params.name) p.name = params.name;
    for (const [k, v] of Object.entries(params.metadata || {})) p[`metadata[${k}]`] = v;
    return this.request('POST', '/coupons', p);
  }

  async createPromotionCode(params: { coupon: string; code: string; maxRedemptions?: number; metadata?: Record<string, string> }): Promise<any> {
    const p: Record<string, string> = { coupon: params.coupon, code: params.code };
    if (params.maxRedemptions != null) p.max_redemptions = String(params.maxRedemptions);
    for (const [k, v] of Object.entries(params.metadata || {})) p[`metadata[${k}]`] = v;
    return this.request('POST', '/promotion_codes', p);
  }

  // Checkout sessions are scanned to find WHO redeemed a code: each session
  // carries the applied `discounts[].promotion_code` and the `metadata.userId`
  // we stamp at creation, so we can join straight back to our users table.
  // `status` and `discounts`/`total_details` are returned by default — no expand.
  async listCheckoutSessions(startingAfter?: string): Promise<{ data: any[]; has_more: boolean }> {
    let endpoint = '/checkout/sessions?limit=100';
    if (startingAfter) endpoint += `&starting_after=${encodeURIComponent(startingAfter)}`;
    return this.request('GET', endpoint);
  }

  // ── Reconciliation ──

  // Page subscriptions by status so a daily cron can cross-check Stripe's truth
  // against the local subscription_history table (catches dropped invoice.paid /
  // subscription.* webhooks). `metadata.userId`/`metadata.tier` are stamped on
  // the subscription at checkout creation, so the id + metadata are enough to
  // detect "paid in Stripe, no active local row".
  async listSubscriptions(status: string = 'active', startingAfter?: string): Promise<{ data: any[]; has_more: boolean }> {
    let endpoint = `/subscriptions?status=${encodeURIComponent(status)}&limit=100`;
    if (startingAfter) endpoint += `&starting_after=${encodeURIComponent(startingAfter)}`;
    return this.request('GET', endpoint);
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

  // ── Billing Portal ──

  async createBillingPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ id: string; url: string }> {
    return this.request('POST', '/billing_portal/sessions', {
      customer: params.customerId,
      return_url: params.returnUrl,
    });
  }

  // ── Webhook Verification ──

  async verifyWebhookSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
    const elements = sigHeader.split(',');
    const timestamp = elements.find(e => e.startsWith('t='))?.slice(2);
    const signature = elements.find(e => e.startsWith('v1='))?.slice(3);

    if (!timestamp || !signature) return false;

    // Reject timestamps more than 5 minutes from now (either direction) to prevent
    // replay attacks. Math.abs guards against future-dated forgeries, not just stale ones.
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (Math.abs(age) > 300) return false;

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

  // ── Identity (creator verification) ───────────────────────────────────────
  // Deliberately ISOLATED from the subscription/checkout/webhook paths above.
  // The verification result is read via retrieve-on-return (see the identity
  // handlers), NOT a webhook — so adding this requires ZERO change to the live
  // Stripe webhook config and cannot disturb billing.

  // Creates a hosted document+selfie verification session. Returns the redirect
  // URL the creator completes the flow at.
  async createIdentityVerificationSession(params: {
    userId: number;
    returnUrl: string;
  }): Promise<{ id: string; url: string; client_secret: string; status: string }> {
    return this.request('POST', '/identity/verification_sessions', {
      type: 'document',
      'metadata[userId]': String(params.userId),
      'metadata[purpose]': 'creator_identity',
      return_url: params.returnUrl,
    });
  }

  // Reads back a session's status on return: 'requires_input' | 'processing' |
  // 'verified' | 'canceled'. metadata.userId lets the handler bind it to the user.
  async retrieveIdentityVerificationSession(sessionId: string): Promise<{
    id: string;
    status: string;
    metadata?: Record<string, string>;
  }> {
    return this.request('GET', `/identity/verification_sessions/${sessionId}`);
  }
}
