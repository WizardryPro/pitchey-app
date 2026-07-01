// Regression guard for the Stripe webhook incident (2026-06-27): live deliveries
// were failing HMAC verification and returning a clean 400 "Invalid webhook
// signature" — the classic symptom of a deployed STRIPE_WEBHOOK_SECRET that no
// longer matches the endpoint's signing secret. The verification code itself was
// (and is) correct; these tests pin that contract so a refactor can't silently
// break it, and document exactly which inputs pass vs. fail.
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { StripeService } from '../stripe.service';

const SECRET = 'whsec_test_secret_value';

// Build a Stripe-style signature header (t=<ts>,v1=<hmac>) over `${t}.${body}`,
// exactly as Stripe signs deliveries and as verifyWebhookSignature expects.
function signature(body: string, secret: string, tsOverride?: number): string {
  const t = tsOverride ?? Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

describe('StripeService.verifyWebhookSignature', () => {
  const svc = new StripeService('sk_test_dummy');
  const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });

  it('accepts a correctly-signed, in-window payload', async () => {
    const ok = await svc.verifyWebhookSignature(body, signature(body, SECRET), SECRET);
    expect(ok).toBe(true);
  });

  it('REJECTS when the secret does not match (the prod incident root cause)', async () => {
    // Signed with the real secret, verified against a different secret — exactly the
    // deployed-secret-mismatch failure mode. Must be false, never throw.
    const sig = signature(body, 'whsec_the_wrong_secret');
    const ok = await svc.verifyWebhookSignature(body, sig, SECRET);
    expect(ok).toBe(false);
  });

  it('rejects a tampered body (signature no longer matches)', async () => {
    const sig = signature(body, SECRET);
    const tampered = body.replace('checkout.session.completed', 'customer.subscription.deleted');
    const ok = await svc.verifyWebhookSignature(tampered, sig, SECRET);
    expect(ok).toBe(false);
  });

  it('rejects a stale timestamp (> 5 min) even with a valid HMAC', async () => {
    const staleTs = Math.floor(Date.now() / 1000) - 600; // 10 min old
    const ok = await svc.verifyWebhookSignature(body, signature(body, SECRET, staleTs), SECRET);
    expect(ok).toBe(false);
  });

  it('rejects a malformed header with no t=/v1= parts', async () => {
    const ok = await svc.verifyWebhookSignature(body, 'garbage', SECRET);
    expect(ok).toBe(false);
  });
});
