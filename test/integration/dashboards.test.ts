// Dashboard suite — guards the exact failure class that hit prod in #40:
// dashboard SQL drift (Neon call-form misuse, ambiguous columns, missing columns)
// returned 500s that NO test caught because the live handlers had 0% coverage.
// These tests run the real handlers' real SQL against the real (branch) schema.
//
// The load-bearing assertion everywhere is `status !== 500` — a 500 here means the
// SQL exploded against the live schema, which is precisely what we want CI to catch.

import { describe, it, expect, beforeAll } from 'vitest';
import { TestClient, json } from './client';

const DEMOS = {
  creator: { email: 'alex.creator@demo.com', portal: 'creator' },
  investor: { email: 'sarah.investor@demo.com', portal: 'investor' },
  production: { email: 'stellar.production@demo.com', portal: 'production' },
} as const;

describe('dashboards: auth gating', () => {
  it('GET /api/creator/dashboard requires auth', async () => {
    const res = await new TestClient().get('/api/creator/dashboard');
    expect([401, 403]).toContain(res.status);
  });
});

describe.each(Object.entries(DEMOS))('dashboards: %s (authed, no 500)', (_name, demo) => {
  it(`GET /api/${demo.portal}/dashboard runs its SQL against the live schema`, async () => {
    const client = new TestClient();
    const login = await client.login(demo.email, 'Demo123', demo.portal);
    expect(login.status, await login.clone().text()).toBe(200);

    const res = await client.get(`/api/${demo.portal}/dashboard`);
    // The #40 regression was a 500 from SQL drift. Assert it does NOT 500.
    expect(res.status, `dashboard 500 = SQL drift vs live schema: ${await res.clone().text().catch(() => '')}`).not.toBe(500);
    expect([200, 304]).toContain(res.status);
    const body = await json(res);
    expect(body.success ?? body.data ?? body).toBeTruthy();
  });
});
