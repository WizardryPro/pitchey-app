// Creator Deal Inbox (moat #6) — integration coverage for the full round-trip:
// producer proposes a deal (existing endpoint) → creator sees it in the inbox →
// creator accepts / rejects. Drives the real handlers against a Neon branch.
//
// production_deals has a UNIQUE(pitch_id, production_company_id) constraint, so
// `freshDeal` clears any prior deal on the pitch first — keeping each test
// independent and the suite idempotent across re-runs.

import { describe, it, expect, beforeAll } from 'vitest';
import { neon } from '@neondatabase/serverless';
import { TestClient, json } from './client';

const sql = neon(process.env.TEST_DATABASE_URL as string);

function digArray(body: any): any[] {
  const c = body?.data?.pitches ?? body?.pitches ?? body?.data ?? body;
  return Array.isArray(c) ? c : (Array.isArray(c?.pitches) ? c.pitches : []);
}

describe('Creator Deal Inbox (moat #6)', () => {
  const creator = new TestClient();
  const producer = new TestClient();
  let pitchId: number | null = null;

  async function freshDeal(): Promise<number> {
    await sql`DELETE FROM production_deals WHERE pitch_id = ${pitchId}`;
    const res = await producer.post('/api/production/deals', {
      pitchId, dealType: 'option', amount: 25000, terms: 'Integration-test option deal',
    });
    expect(res.status, await res.clone().text().catch(() => '')).toBe(201);
    return (await json(res)).data.deal.id;
  }

  beforeAll(async () => {
    await creator.login('alex.creator@demo.com', 'Demo123', 'creator');
    await producer.login('stellar.production@demo.com', 'Demo123', 'production');
    const res = await creator.get('/api/creator/pitches');
    if (res.status === 200) pitchId = digArray(await json(res))[0]?.id ?? null;
  });

  it('GET /api/creator/deals requires auth', async () => {
    const res = await new TestClient().get('/api/creator/deals');
    expect([401, 403]).toContain(res.status);
  });

  it('producer proposal lands in the creator inbox, then the creator accepts it', async () => {
    expect(pitchId, 'precondition: creator owns a pitch').not.toBeNull();
    const dealId = await freshDeal();

    const inbox = await creator.get('/api/creator/deals');
    expect(inbox.status).toBe(200);
    const mine = ((await json(inbox)).data.deals as any[]).find((d) => String(d.id) === String(dealId));
    expect(mine, 'proposed deal should appear in the creator inbox').toBeTruthy();
    expect(mine.status).toBe('inquiry');
    expect(mine.actionable).toBe(true);
    expect(mine.producer_name).toBeTruthy();
    expect(mine.pitch_title).toBeTruthy();

    const resp = await creator.post(`/api/creator/deals/${dealId}/respond`, { action: 'accept', message: 'Looks good' });
    expect(resp.status, await resp.clone().text().catch(() => '')).toBe(200);
    expect((await json(resp)).data.deal.status).toBe('negotiation');
  });

  it('reject moves the deal to cancelled, and a second response is rejected (409)', async () => {
    if (pitchId == null) { expect(true).toBe(true); return; }
    const dealId = await freshDeal();

    const rej = await creator.post(`/api/creator/deals/${dealId}/respond`, { action: 'reject', message: 'Not a fit' });
    expect(rej.status).toBe(200);
    expect((await json(rej)).data.deal.status).toBe('cancelled');

    const again = await creator.post(`/api/creator/deals/${dealId}/respond`, { action: 'accept' });
    expect(again.status).toBe(409);
  });

  it('a non-owner cannot respond to someone else\'s deal (403)', async () => {
    if (pitchId == null) { expect(true).toBe(true); return; }
    const dealId = await freshDeal();

    const investor = new TestClient();
    await investor.login('sarah.investor@demo.com', 'Demo123', 'investor');
    const res = await investor.post(`/api/creator/deals/${dealId}/respond`, { action: 'accept' });
    expect(res.status).toBe(403);
  });

  it('rejects an unknown action (400)', async () => {
    if (pitchId == null) { expect(true).toBe(true); return; }
    const dealId = await freshDeal();
    const res = await creator.post(`/api/creator/deals/${dealId}/respond`, { action: 'bogus' });
    expect(res.status).toBe(400);
  });
});
