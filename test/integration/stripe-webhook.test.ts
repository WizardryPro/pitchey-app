// Stripe webhook suite — guards the security boundary fixed in #322 (the route
// was 401ing before reaching the handler) and the HMAC-SHA256 signature gate.
// No DB writes, no real Stripe calls: we only prove the route is PUBLIC (reaches
// the handler, not auth) and that bad/missing signatures are rejected with 400.

import { describe, it, expect } from 'vitest';
import { TestClient, json } from './client';

const EVENT = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed', data: { object: {} } });

function webhookClient() {
  // The handler short-circuits to a 500 "not configured" unless BOTH the secret key
  // AND webhook secret are present (worker-integrated.ts:11134). Provide dummy test
  // values so it reaches the signature gate; verifyWebhookSignature is pure HMAC
  // (no network), and ENVIRONMENT='development' skips the live-key go-live guard.
  return new TestClient({
    env: { STRIPE_SECRET_KEY: 'sk_test_integration_dummy', STRIPE_WEBHOOK_SECRET: 'whsec_integration_test_dummy' },
  });
}

describe('stripe webhook: public + signature-gated', () => {
  it('is PUBLIC — no auth, reaches the handler (regression guard for #322)', async () => {
    // Missing signature → 400 from the handler, NOT 401 from auth. A 401 here means
    // the publicEndpoints entry regressed and auth is shadowing the webhook again.
    const res = await webhookClient().request('/api/webhooks/stripe', {
      method: 'POST', body: EVENT, headers: { 'content-type': 'application/json' }, cookies: false,
    });
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(400);
    const body = await json(res).catch(() => ({}));
    expect(JSON.stringify(body)).toMatch(/signature/i);
  });

  it('rejects an invalid signature with 400', async () => {
    const res = await webhookClient().request('/api/webhooks/stripe', {
      method: 'POST', body: EVENT,
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=123,v1=deadbeef' },
      cookies: false,
    });
    expect(res.status).toBe(400);
    const body = await json(res).catch(() => ({}));
    expect(JSON.stringify(body)).toMatch(/signature|invalid/i);
  });
});
