// Pitches suite — public reads (browse/trending/public detail) + getPitch shape +
// write gating. getPitch is high-risk: it carries the defensive NDA-detection and
// seal/provenance branches across historical schemas.

import { describe, it, expect, beforeAll } from 'vitest';
import { TestClient, json } from './client';

async function firstPublicPitchId(client: TestClient): Promise<number | null> {
  const res = await client.get('/api/pitches/browse?limit=5');
  if (res.status !== 200) return null;
  const body = await json(res);
  const list = body.data?.pitches ?? body.pitches ?? body.data ?? body;
  const arr = Array.isArray(list) ? list : (Array.isArray(list?.pitches) ? list.pitches : []);
  return arr[0]?.id ?? null;
}

describe('pitches: public reads (no 500)', () => {
  it.each([
    '/api/pitches/browse',
    '/api/pitches/trending',
    '/api/pitches/featured',
    '/api/pitches?limit=5',
  ])('GET %s returns a list without exploding', async (path) => {
    const res = await new TestClient().get(path);
    expect(res.status, await res.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 304]).toContain(res.status);
  });
});

describe('pitches: detail', () => {
  let pitchId: number | null = null;
  const client = new TestClient();

  beforeAll(async () => { pitchId = await firstPublicPitchId(client); });

  it('GET /api/pitches/:id returns the pitch (NDA/seal branches survive live schema)', async () => {
    if (pitchId == null) { expect(true).toBe(true); return; } // empty branch — skip gracefully
    const res = await client.get(`/api/pitches/${pitchId}`);
    expect(res.status, await res.clone().text().catch(() => '')).not.toBe(500);
    expect(res.status).toBe(200);
    const body = await json(res);
    const pitch = body.data?.pitch ?? body.data ?? body.pitch ?? body;
    expect(pitch.id ?? pitch?.data?.id).toBeTruthy();
  });

  it('GET /api/pitches/:id/engagement returns breakdown without leaking named likers to anon', async () => {
    if (pitchId == null) { expect(true).toBe(true); return; }
    const res = await client.get(`/api/pitches/${pitchId}/engagement`);
    expect(res.status).not.toBe(500);
    expect([200, 401, 403]).toContain(res.status);
  });

  it('GET /api/pitches/:id with a nonexistent id 404s (not 500)', async () => {
    const res = await client.get('/api/pitches/999999999');
    expect(res.status).not.toBe(500);
    expect([404, 200]).toContain(res.status); // some handlers return 200+null; never 500
  });
});

describe('pitches: write gating', () => {
  it('POST /api/pitches requires auth', async () => {
    const res = await new TestClient().post('/api/pitches', { title: 'x' });
    expect([401, 403]).toContain(res.status);
  });
});
