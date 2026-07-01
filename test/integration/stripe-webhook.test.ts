// Stripe webhook suite — guards the security boundary fixed in #322 (the route
// was 401ing before reaching the handler) and the HMAC-SHA256 signature gate.
// No DB writes, no real Stripe calls: we only prove the route is PUBLIC (reaches
// the handler, not auth) and that bad/missing signatures are rejected with 400.

import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { TestClient, json } from './client';

const WEBHOOK_SECRET = 'whsec_integration_test_dummy';
const EVENT = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed', data: { object: {} } });

// Build a valid Stripe-style signature header for `body` using the test secret,
// matching verifyWebhookSignature (HMAC-SHA256 over `${t}.${body}`, t within 5min).
function sign(body: string): string {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

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

// Ack contract: once the signature is VALID, Stripe must get a 2xx even for an
// event we don't process — a non-2xx here is what gets an endpoint disabled.
// Needs a DB (the handler runs the idempotency INSERT before the switch), so it's
// gated on the integration branch. The downstream-failure→200 guarantee is the
// same outer try/catch that wraps the switch and returns 200 on any thrown error.
describe.skipIf(!process.env.TEST_DATABASE_URL)('stripe webhook: acks valid deliveries with 2xx', () => {
  it('returns 200 for a correctly-signed but unhandled event type', async () => {
    const client = new TestClient({
      env: { STRIPE_SECRET_KEY: 'sk_test_integration_dummy', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET },
    });
    const event = JSON.stringify({ id: `evt_int_${Date.now()}`, type: 'invoice.upcoming', data: { object: {} } });
    const res = await client.request('/api/webhooks/stripe', {
      method: 'POST', body: event, cookies: false,
      headers: { 'content-type': 'application/json', 'stripe-signature': sign(event) },
    });
    expect(res.status).toBe(200);
    const body = await json(res).catch(() => ({}));
    expect(JSON.stringify(body)).toMatch(/received/i);
  });
});
