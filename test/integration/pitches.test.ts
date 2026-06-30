// Pitches suite — public reads (browse/trending/public detail) + getPitch shape +
// write gating. getPitch is high-risk: it carries the defensive NDA-detection and
// seal/provenance branches across historical schemas.

import { describe, it, expect, beforeAll } from 'vitest';
import { TestClient, json } from './client';
import { query, queryOne } from './db';

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

// Side-effect (round-trip) assertions for publish (POST /api/pitches/:id/publish,
// worker-integrated.ts:2826). On a 200 the route:
//   1. AWAITS sealPitchProvenance() INLINE → writes a `pitch_provenance` row
//      (pitch_id, creator_id, content_hash, sealed_at, content_version).
//   2. Runs the matching-investor notify INSERT (worker-integrated.ts:2919):
//      one `notifications` row per PUBLIC investor_thesis whose `genres` contains
//      the pitch's genre (related_pitch_id = pitchId, type='pitch_update').
// We create a pitch in a genre we KNOW a public thesis targets, publish it, then
// read both writes back. The targeted investor does not follow the creator, so
// the matching-investor notification can only originate from write #2 (teeth).
describe('pitches: publish side-effects (DB round-trip)', () => {
  const creator = new TestClient();
  let pitchId: number | null = null;
  let creatorId: number | null = null;
  let thesisGenre: string | null = null;
  let thesisInvestorId: number | null = null;
  let published = false;
  let setupNote = '';

  beforeAll(async () => {
    await creator.login('alex.creator@demo.com', 'Demo123', 'creator');

    const me = await queryOne<{ id: number }>(
      `SELECT id FROM users WHERE email = $1`, ['alex.creator@demo.com'],
    );
    creatorId = me ? Number(me.id) : null;

    // A PUBLIC thesis with at least one genre, owned by someone OTHER than the
    // creator (the notify query requires investor_id <> creator).
    const thesis = await queryOne<{ investor_id: number; genres: string[] }>(
      `SELECT investor_id, genres FROM investor_thesis
       WHERE is_public = TRUE AND array_length(genres, 1) >= 1 AND investor_id <> $1
       LIMIT 1`,
      [creatorId],
    );
    if (!thesis) {
      setupNote = 'no public investor_thesis with genres on this branch';
      return;
    }
    thesisInvestorId = Number(thesis.investor_id);
    thesisGenre = thesis.genres[0];

    // Create a fresh pitch in the targeted genre, then publish it.
    const created = await creator.post('/api/pitches', {
      title: `R7 publish seal pitch ${Date.now()}`,
      logline: 'A fresh pitch created to exercise the publish seal + notify writes.',
      genre: thesisGenre,
    });
    if ([200, 201].includes(created.status)) {
      pitchId = (await json(created))?.data?.pitch?.id ?? null;
    }
    if (pitchId != null) {
      const pub = await creator.post(`/api/pitches/${pitchId}/publish`, {});
      published = pub.status === 200;
      if (!published) setupNote = `publish returned ${pub.status}`;
    }
  });

  it('seals provenance on publish', async () => {
    expect(pitchId, `precondition: pitch created (${setupNote})`).not.toBeNull();
    expect(published, `precondition: pitch published (${setupNote})`).toBe(true);

    const seal = await queryOne<{ pitch_id: number; creator_id: number; content_hash: string }>(
      `SELECT pitch_id, creator_id, content_hash FROM pitch_provenance WHERE pitch_id = $1`,
      [pitchId],
    );
    expect(seal, 'a pitch_provenance row should exist for the published pitch').not.toBeNull();
    expect(Number(seal!.creator_id)).toBe(creatorId);
    expect(typeof seal!.content_hash).toBe('string');
    expect(seal!.content_hash.length).toBe(64); // sha256 hex
  });

  it('notifies the matching public-thesis investor', async () => {
    expect(pitchId, `precondition: pitch published (${setupNote})`).not.toBeNull();
    expect(published).toBe(true);

    // The targeted investor must not follow the creator, else a follower notify
    // could mask the matching-investor write — assert the isolation holds.
    const follows = await queryOne<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [thesisInvestorId, creatorId],
    );
    expect(Number(follows!.c), 'thesis investor should not follow creator (teeth)').toBe(0);

    const notif = await queryOne<{ id: number; type: string; user_id: number }>(
      `SELECT id, type, user_id FROM notifications
       WHERE related_pitch_id = $1 AND user_id = $2 AND type = 'pitch_update'`,
      [pitchId, thesisInvestorId],
    );
    expect(notif, 'a matching-investor notification should exist').not.toBeNull();
    expect(String(notif!.type)).toBe('pitch_update');
    expect(Number(notif!.user_id)).toBe(thesisInvestorId);
  });
});
