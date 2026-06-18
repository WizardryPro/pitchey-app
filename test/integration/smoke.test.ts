// Proof-of-life for the integration tier. If these pass, the harness can drive
// the real worker against the real (branch) DB — and Phase 2 just adds route
// suites on top.

import { describe, it, expect } from 'vitest';
import { TestClient, json } from './client';

describe('integration harness: proof of life', () => {
  it('GET /api/health reaches the live handler and talks to the DB', async () => {
    const client = new TestClient();
    const res = await client.get('/api/health');
    // handleHealth returns 200 (ok) or 503 (degraded) — both prove the router +
    // DB check ran. A throw/500 here means the harness can't reach the worker.
    expect([200, 503]).toContain(res.status);
    const body = await json(res);
    // Envelope: { success, data: { status, services: { database: { status } } } }
    const data = body.data ?? body;
    expect(data.status).toMatch(/ok|degraded/);
    // DB sub-check should be healthy against a fresh branch.
    expect(data.services?.database?.status).toMatch(/ok|healthy|up|connected|active/i);
  });

  it('unknown route returns a structured 404 (not a crash)', async () => {
    const client = new TestClient();
    const res = await client.get('/api/this-route-does-not-exist-xyz');
    expect(res.status).toBe(404);
  });

  it('CORS preflight is handled', async () => {
    const client = new TestClient();
    const res = await client.request('/api/health', {
      method: 'OPTIONS',
      headers: { origin: 'https://pitchey-5o8.pages.dev', 'access-control-request-method': 'GET' },
    });
    expect([200, 204]).toContain(res.status);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });
});

describe('integration harness: live auth flow', () => {
  it('creator demo login sets a session cookie and authorizes /api/users/profile', async () => {
    const client = new TestClient();
    const loginRes = await client.login('alex.creator@demo.com', 'Demo123', 'creator');
    expect(loginRes.status, await loginRes.clone().text()).toBe(200);
    const loginBody = await json(loginRes);
    expect(loginBody.success ?? loginBody.user ?? loginBody.token).toBeTruthy();

    // Cookie jar should now carry the session; an authed endpoint should accept it.
    const profileRes = await client.get('/api/users/profile');
    expect([200, 304]).toContain(profileRes.status);
  });

  it('rejects a bad password', async () => {
    const client = new TestClient();
    const res = await client.login('alex.creator@demo.com', 'wrong-password', 'creator');
    expect([400, 401, 403]).toContain(res.status);
  });
});
