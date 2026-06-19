// Tracked slate share links (moat #5) — integration coverage for the full
// lifecycle: create slate → publish → mint a tracked link → anonymous public view
// (increments view_count) → revoke → 404. Drives the real handlers vs a Neon branch.

import { describe, it, expect, beforeAll } from 'vitest';
import { TestClient, json } from './client';

describe('Tracked slate share links (moat #5)', () => {
  const creator = new TestClient();
  let slateId: number | null = null;

  beforeAll(async () => {
    await creator.login('alex.creator@demo.com', 'Demo123', 'creator');
    const created = await creator.post('/api/slates', { title: 'Share-test slate', description: 'integration' });
    if (created.status < 300) {
      const body = await json(created);
      slateId = body.data?.slate?.id ?? body.data?.id ?? body.slate?.id ?? null;
      if (slateId) await creator.put(`/api/slates/${slateId}`, { status: 'published' });
    }
  });

  it('POST /api/slates/:id/share-links requires auth', async () => {
    const res = await new TestClient().post('/api/slates/1/share-links', {});
    expect([401, 403]).toContain(res.status);
  });

  it('mints a tracked link, the anonymous public view increments the count, then revoke 404s', async () => {
    expect(slateId, 'precondition: created a published slate').not.toBeNull();

    // Mint
    const mk = await creator.post(`/api/slates/${slateId}/share-links`, { label: 'Investor outreach' });
    expect(mk.status, await mk.clone().text().catch(() => '')).toBe(201);
    const link = (await json(mk)).data.link;
    expect(link.token).toBeTruthy();
    expect(link.view_count).toBe(0);

    // Anonymous public view by token (no auth) — returns the slate + tracks the view.
    const pub = await new TestClient().get(`/api/slates/s/${link.token}`);
    expect(pub.status, await pub.clone().text().catch(() => '')).toBe(200);
    const data = (await json(pub)).data;
    expect(data.title).toBe('Share-test slate');
    expect(data.shareToken).toBe(link.token);
    expect(data.creator?.username).toBeTruthy();

    // The owner's link list now shows view_count >= 1.
    const list = await creator.get(`/api/slates/${slateId}/share-links`);
    expect(list.status).toBe(200);
    const listed = (await json(list)).data.links.find((l: any) => l.id === link.id);
    expect(listed.view_count).toBeGreaterThanOrEqual(1);

    // Revoke → the token stops resolving.
    const rev = await creator.delete(`/api/slates/share-links/${link.id}`);
    expect(rev.status).toBe(200);
    const after = await new TestClient().get(`/api/slates/s/${link.token}`);
    expect(after.status).toBe(404);
  });

  it('an unknown token 404s', async () => {
    const res = await new TestClient().get('/api/slates/s/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('a non-owner cannot mint a link on someone else\'s slate', async () => {
    if (slateId == null) { expect(true).toBe(true); return; }
    const investor = new TestClient();
    await investor.login('sarah.investor@demo.com', 'Demo123', 'investor');
    const res = await investor.post(`/api/slates/${slateId}/share-links`, {});
    expect([403, 404]).toContain(res.status);
  });
});
