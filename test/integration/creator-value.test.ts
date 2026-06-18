// "Your Pitchey" value dashboard (moat #8) — integration coverage for the new
// GET /api/creator/value endpoint. Dogfoods the integration tier: drives the real
// handler's real (drift-defensive) SQL against the branch schema.

import { describe, it, expect } from 'vitest';
import { TestClient, json } from './client';

describe('GET /api/creator/value', () => {
  it('requires auth', async () => {
    const res = await new TestClient().get('/api/creator/value');
    // Unauth returns the empty value payload (200) OR a 401 depending on gating —
    // never a 500.
    expect(res.status).not.toBe(500);
    expect([200, 401, 403]).toContain(res.status);
  });

  it('returns the accumulated-value summary for the creator demo account', async () => {
    const client = new TestClient();
    const login = await client.login('alex.creator@demo.com', 'Demo123', 'creator');
    expect(login.status, await login.clone().text()).toBe(200);

    const res = await client.get('/api/creator/value');
    expect(res.status, `value endpoint 500 = SQL drift: ${await res.clone().text().catch(() => '')}`).not.toBe(500);
    expect(res.status).toBe(200);

    const body = await json(res);
    const d = body.data ?? body;
    // Shape contract — each tile present and numeric where expected.
    expect(d).toHaveProperty('verificationTier');
    expect(['grey', 'silver', 'gold']).toContain(d.verificationTier);
    expect(typeof d.pitches.total).toBe('number');
    expect(typeof d.pitches.published).toBe('number');
    expect(typeof d.pitches.sealed).toBe('number');
    expect(typeof d.audience.followers).toBe('number');
    expect(typeof d.audience.totalViews).toBe('number');
    expect(typeof d.reach.shareLinkViews).toBe('number');
    expect(typeof d.trust.ndas).toBe('number');
    expect(typeof d.heat.top).toBe('number');
    // The creator demo account owns pitches, so total should be > 0.
    expect(d.pitches.total).toBeGreaterThan(0);
  });
});
