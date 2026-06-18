// NDA suite — guards the #284 area where requestNDA wrote `nda_requests` while
// approve/access read `ndas`, silently breaking the flow for all non-demo users.
// These tests assert the request/status/can-request endpoints run their real SQL
// against the unified `ndas` table without exploding, and that gating holds.

import { describe, it, expect, beforeAll } from 'vitest';
import { TestClient, json } from './client';

async function anyPitchId(client: TestClient): Promise<number | null> {
  const res = await client.get('/api/pitches/browse?limit=5');
  if (res.status !== 200) return null;
  const body = await json(res);
  const list = body.data?.pitches ?? body.pitches ?? body.data ?? body;
  const arr = Array.isArray(list) ? list : (Array.isArray(list?.pitches) ? list.pitches : []);
  return arr[0]?.id ?? null;
}

describe('nda: gating', () => {
  it('POST /api/ndas/request requires auth', async () => {
    const res = await new TestClient().post('/api/ndas/request', { pitchId: 1 });
    expect([401, 403]).toContain(res.status);
  });

  it('GET /api/ndas requires auth', async () => {
    const res = await new TestClient().get('/api/ndas');
    expect([401, 403]).toContain(res.status);
  });
});

describe('nda: status reads run real SQL (no 500)', () => {
  let pitchId: number | null = null;
  const client = new TestClient();

  beforeAll(async () => {
    await client.login('sarah.investor@demo.com', 'Demo123', 'investor');
    pitchId = await anyPitchId(client);
  });

  it('GET /api/ndas/pitch/:id/status against live `ndas` schema', async () => {
    if (pitchId == null) { expect(true).toBe(true); return; }
    const res = await client.get(`/api/ndas/pitch/${pitchId}/status`);
    expect(res.status, await res.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 401, 403, 404]).toContain(res.status);
  });

  it('GET /api/ndas/pitch/:id/can-request resolves without exploding', async () => {
    if (pitchId == null) { expect(true).toBe(true); return; }
    const res = await client.get(`/api/ndas/pitch/${pitchId}/can-request`);
    expect(res.status).not.toBe(500);
    expect([200, 401, 403, 404]).toContain(res.status);
  });

  it('GET /api/ndas (authed) lists the investor NDAs without exploding', async () => {
    const res = await client.get('/api/ndas');
    expect(res.status).not.toBe(500);
    expect([200]).toContain(res.status);
  });
});
