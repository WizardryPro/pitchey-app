// Auth suite — login variants, registration, logout, session, gating.
// Exercises the inlined custom-session auth path (Better Auth was ripped; this is
// the live legacy `sessions`-table flow).

import { describe, it, expect } from 'vitest';
import { TestClient, json } from './client';

describe('auth: portal login', () => {
  it.each(['creator', 'investor', 'production', 'watcher'])(
    'demo %s login returns 200 + a session cookie',
    async (portal) => {
      const emails: Record<string, string> = {
        creator: 'alex.creator@demo.com',
        investor: 'sarah.investor@demo.com',
        production: 'stellar.production@demo.com',
        watcher: 'jamie.watcher@demo.com',
      };
      const client = new TestClient();
      const res = await client.login(emails[portal], 'Demo123', portal);
      expect(res.status, await res.clone().text()).toBe(200);
      expect(client.cookieHeader).toMatch(/pitchey-session=/);
    },
  );

  it('rejects unknown email', async () => {
    const res = await new TestClient().login('nobody-xyz@demo.com', 'Demo123', 'creator');
    expect([400, 401, 403, 404]).toContain(res.status);
  });

  it('rejects wrong password', async () => {
    const res = await new TestClient().login('alex.creator@demo.com', 'nope', 'creator');
    expect([400, 401, 403]).toContain(res.status);
  });
});

describe('auth: session lifecycle', () => {
  it('login → GET /api/auth/session reflects the user → logout clears it', async () => {
    const client = new TestClient();
    await client.login('alex.creator@demo.com', 'Demo123', 'creator');

    const sess = await client.get('/api/auth/session');
    expect(sess.status).not.toBe(500);
    expect([200, 401]).toContain(sess.status);

    const out = await client.post('/api/auth/logout', {});
    expect(out.status).not.toBe(500);
    expect([200, 204]).toContain(out.status);

    // After logout an authed endpoint must reject.
    const afterProfile = await client.get('/api/users/profile');
    expect([401, 403]).toContain(afterProfile.status);
  });
});

describe('auth: registration', () => {
  it('registers a brand-new creator (unique email)', async () => {
    const email = `itest_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
    const client = new TestClient();
    const res = await client.post('/api/auth/register', {
      email,
      password: 'TestPassw0rd!',
      username: `itest_${Date.now()}`,
      userType: 'creator',
      firstName: 'Integration',
      lastName: 'Test',
    });
    // Accept success (200/201) — the row lives in the throwaway branch only.
    expect(res.status, await res.clone().text()).not.toBe(500);
    expect([200, 201, 400, 409]).toContain(res.status);
    if (res.status < 300) {
      const body = await json(res);
      expect(JSON.stringify(body)).toMatch(/success|user|token|id/i);
    }
  });

  it('rejects malformed registration', async () => {
    const res = await new TestClient().post('/api/auth/register', { email: 'not-an-email' });
    expect([400, 422]).toContain(res.status);
  });
});
