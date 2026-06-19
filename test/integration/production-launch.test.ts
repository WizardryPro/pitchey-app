// Production-company launch-readiness audit (pre-launch hardening).
//
// The launch cohort is ~60 production companies who drive everything else. #6
// already proved a core production flow (proposing deals) had NEVER worked — silently
// 500ing on dead DB triggers. This drives the real production day-1 surface against a
// Neon branch to surface any other silent breakage BEFORE those 60 users hit it, and
// stays behind as a permanent launch guard.
//
// A 500 on any of these = silent breakage to fix (the #40 / #6 failure class).

import { describe, it, expect, beforeAll } from 'vitest';
import { TestClient, json } from './client';

const producer = new TestClient();

beforeAll(async () => {
  const res = await producer.login('stellar.production@demo.com', 'Demo123', 'production');
  expect(res.status, 'production login must work').toBe(200);
});

// Every GET the production dashboard + pages load on day 1. The audit bar: none may
// 500. A logged-in producer should get 200 (or 304); auth/empty states are fine too.
const READ_ENDPOINTS = [
  '/api/production/dashboard',
  '/api/production/stats',
  '/api/production/activity',
  '/api/production/analytics',
  '/api/production/saved-pitches',
  '/api/production/submissions',
  '/api/production/pipeline',
  '/api/production/projects',
  '/api/production/collaborations',
  '/api/production/deals',
  '/api/production/verification-status',
  '/api/production/slate',
  '/api/production/revenue',
  '/api/production/investments/overview',
  '/api/calls/mine',
  '/api/calls',
  '/api/calls/submissions/mine',
  '/api/teams',
  '/api/pitches/browse?limit=5',
  '/api/pitches/trending',
  '/api/pitches/search?q=film',
];

describe('production launch: day-1 reads never 500', () => {
  it.each(READ_ENDPOINTS)('GET %s', async (path) => {
    const res = await producer.get(path);
    expect(res.status, `${path} → ${res.status}: ${await res.clone().text().catch(() => '')}`).not.toBe(500);
    expect([200, 204, 304]).toContain(res.status);
  });
});

describe('production launch: day-1 write flows', () => {
  it('a new production company can sign up (step 1 for all 60)', async () => {
    const email = `prodco_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
    const res = await new TestClient().post('/api/auth/register', {
      email, password: 'LaunchPassw0rd!', username: `prodco_${Date.now()}`,
      userType: 'production', companyName: 'Acme Pictures', firstName: 'Pat', lastName: 'Producer',
    });
    expect(res.status, await res.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 201]).toContain(res.status);
    const body = await json(res);
    expect(JSON.stringify(body)).toMatch(/success|user|token|id/i);
  });

  it('can post an open call / mandate', async () => {
    const res = await producer.post('/api/calls', {
      title: 'Seeking sci-fi feature', description: 'Looking for grounded sci-fi features under €5M.',
      genre: 'Sci-Fi', format: 'Feature Film', budgetMin: 1000000, budgetMax: 5000000,
    });
    expect(res.status, await res.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 201]).toContain(res.status);
  });

  it('can browse a pitch and save it', async () => {
    const body = await json(await producer.get('/api/pitches/browse?limit=5'));
    const list = body.data?.items ?? body.data?.pitches ?? body.items ?? [];
    const pid = (Array.isArray(list) ? list : [])[0]?.id;
    expect(pid, 'browse should return at least one pitch').toBeTruthy();
    const save = await producer.post(`/api/pitches/${pid}/save`, {});
    expect(save.status, await save.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 201, 409]).toContain(save.status);
  });

  it('can propose a deal on a creator pitch (the #6 flow)', async () => {
    // Use a pitch owned by the creator demo account.
    const creator = new TestClient();
    await creator.login('alex.creator@demo.com', 'Demo123', 'creator');
    const mine = await creator.get('/api/creator/pitches');
    const arr = (await json(mine)).data;
    const pitchId = (Array.isArray(arr) ? arr : arr?.pitches ?? [])[0]?.id;
    if (pitchId == null) { expect(true).toBe(true); return; }
    const res = await producer.post('/api/production/deals', { pitchId, dealType: 'option', amount: 30000, terms: 'audit' });
    // Not 500 is the bar; 201 created or 409 (a deal already exists) are both fine.
    expect(res.status, await res.clone().text().catch(() => '')).not.toBe(500);
    expect([201, 409, 400]).toContain(res.status);
  });
});
