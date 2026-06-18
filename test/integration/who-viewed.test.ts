// "Who viewed your protected deck" (moat #2) — integration coverage for the
// gated GET /api/views/pitch/:id. Verifies: the owner-gate (privacy-leak fix —
// non-owners NEVER receive named viewers), the subscription_tier gate, and the
// route fix (was '/api/views/pitch/*', a dead wildcard the router couldn't match).

import { describe, it, expect, beforeAll } from 'vitest';
import { TestClient, json } from './client';

function digArray(body: any): any[] {
  const c = body?.data?.pitches ?? body?.pitches ?? body?.data?.recentPitches ?? body?.recentPitches ?? body?.data ?? body;
  return Array.isArray(c) ? c : (Array.isArray(c?.pitches) ? c.pitches : []);
}

// A real pitch owned by the creator demo account — discovered once, reused by all
// three perspectives so none of the assertions silently skip.
let pitchId: number | null = null;
const owner = new TestClient();

beforeAll(async () => {
  await owner.login('alex.creator@demo.com', 'Demo123', 'creator');
  const res = await owner.get('/api/creator/pitches');
  if (res.status === 200) pitchId = digArray(await json(res))[0]?.id ?? null;
});

describe('GET /api/views/pitch/:id (who-viewed gate)', () => {
  it('route is live (was a dead /* wildcard) — owner gets a 200, not a router 404', async () => {
    expect(pitchId, 'precondition: creator demo account owns a pitch').not.toBeNull();
    const res = await owner.get(`/api/views/pitch/${pitchId}`);
    expect(res.status, await res.clone().text().catch(() => '')).toBe(200);
    const d = (await json(res)).data;
    expect(d.isOwner).toBe(true);
    expect(typeof d.locked).toBe('boolean');
    expect(typeof d.totalViewers).toBe('number');
    expect(d.breakdown).toBeTruthy();
    // Demo creator is on the free tier → detail locked, no names leaked.
    if (d.locked) expect(d.viewers.length).toBe(0);
  });

  it('unauthenticated callers get no names (auth-gated or locked)', async () => {
    const res = await new TestClient().get(`/api/views/pitch/${pitchId}`);
    expect(res.status).not.toBe(500);
    if (res.status === 200) {
      // If the route were public, the handler must still withhold names.
      const d = (await json(res)).data;
      expect(d.isOwner).toBe(false);
      expect(d.locked).toBe(true);
      expect(d.viewers.length).toBe(0);
    } else {
      // Otherwise the auth middleware blocks it — also no names.
      expect([401, 403]).toContain(res.status);
    }
  });

  it('a non-owner (investor) never sees named viewers — the privacy-leak fix', async () => {
    const investor = new TestClient();
    await investor.login('sarah.investor@demo.com', 'Demo123', 'investor');
    const res = await investor.get(`/api/views/pitch/${pitchId}`);
    expect(res.status).not.toBe(500);
    const d = (await json(res)).data;
    expect(d.isOwner).toBe(false);
    expect(d.locked).toBe(true);
    expect(d.viewers.length).toBe(0);
  });
});
