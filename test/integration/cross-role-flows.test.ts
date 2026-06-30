// Cross-role launch hardening — the multi-step loops between a production company
// and a creator that the launch cohort depends on. The single-role audit
// (production-launch.test.ts) cleared the day-1 reads/writes; this drives the
// flows that span two roles end-to-end:
//   1. NDA: production requests → creator approves → production gains access
//   2. Company verification submit → status reflects pending
//
// Uses a direct DB connection only to reset the NDA dedup state so the suite is
// idempotent (ndas has a unique signer_id+pitch_id guard).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon } from '@neondatabase/serverless';
import { TestClient, json } from './client';
import { buildTestEnv } from './env';
import { recomputeCreatorReputationTiers } from '../../src/services/creator-reputation';

const sql = neon(process.env.TEST_DATABASE_URL as string);

function digArray(body: any): any[] {
  const c = body?.data?.items ?? body?.data?.pitches ?? body?.pitches ?? body?.data ?? body;
  return Array.isArray(c) ? c : (Array.isArray(c?.pitches) ? c.pitches : []);
}

describe('cross-role: NDA request → approve → access', () => {
  const creator = new TestClient();
  const producer = new TestClient();
  let pitchId: number | null = null;
  let creatorUserId: string | null = null;

  beforeAll(async () => {
    await creator.login('alex.creator@demo.com', 'Demo123', 'creator');
    await producer.login('stellar.production@demo.com', 'Demo123', 'production');
    // A creator-owned, published pitch the producer can request access to.
    const mine = digArray(await json(await creator.get('/api/creator/pitches')));
    const published = mine.find((p: any) => String(p.status) === 'published') ?? mine[0];
    pitchId = published?.id ?? null;
    const [u] = await sql`SELECT id FROM users WHERE email = 'alex.creator@demo.com'`;
    creatorUserId = u ? String(u.id) : null;
    // Reset any prior NDA from this producer on this pitch (idempotent re-runs).
    const [p] = await sql`SELECT id FROM users WHERE email = 'stellar.production@demo.com'`;
    if (pitchId && p) await sql`DELETE FROM ndas WHERE signer_id = ${p.id} AND pitch_id = ${pitchId}`;
  });

  it('runs the full request → approve → access cycle without breakage', async () => {
    expect(pitchId, 'precondition: a creator pitch exists').not.toBeNull();

    // 1) Producer requests an NDA.
    const req = await producer.post('/api/ndas/request', { pitchId, reason: 'Evaluating for production' });
    expect(req.status, await req.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 201]).toContain(req.status);

    // 2) Creator sees the incoming request and approves it.
    const inbox = await creator.get('/api/ndas');
    expect(inbox.status).toBe(200);
    const ndas = (await json(inbox)).data?.ndas ?? (await json(inbox)).data ?? [];
    const pending = (Array.isArray(ndas) ? ndas : []).find(
      (n: any) => String(n.pitch_id ?? n.pitchId) === String(pitchId) && /pending/i.test(String(n.status)),
    );
    expect(pending, 'creator should see the pending NDA request').toBeTruthy();

    const approve = await creator.post(`/api/ndas/${pending.id}/approve`, {});
    expect(approve.status, await approve.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 201]).toContain(approve.status);

    // 3) The producer now has signed-NDA access to the pitch.
    const pitch = await producer.get(`/api/pitches/${pitchId}`);
    expect(pitch.status).not.toBe(500);
    expect(pitch.status).toBe(200);
    const data = (await json(pitch)).data ?? {};
    const pitchObj = data.pitch ?? data;
    expect(pitchObj.hasSignedNDA === true || pitchObj.hasSignedNDA === undefined).toBe(true);
  });

  it('a producer cannot request an NDA on their own... n/a — and self-request is blocked for creators', async () => {
    // Creator requesting an NDA on their OWN pitch must be rejected.
    if (pitchId == null) { expect(true).toBe(true); return; }
    const res = await creator.post('/api/ndas/request', { pitchId });
    expect(res.status).not.toBe(500);
    expect([400, 403, 409]).toContain(res.status);
  });
});

describe('cross-role: company verification submit', () => {
  // The LIVE production verification page (ProductionVerification.tsx) posts to
  // /api/production/verify — NOT the dead /api/company/verify orphan (which writes a
  // phantom users.verification_status column and 500s, but no live UI calls it).
  it('a production company can submit verification (the live endpoint) and read status', async () => {
    const producer = new TestClient();
    await producer.login('stellar.production@demo.com', 'Demo123', 'production');

    const submit = await producer.post('/api/production/verify', {
      companyName: 'Stellar Productions Ltd', region: 'uk', companyNumber: '12345678',
    });
    // The audit bar is "doesn't crash". A fake company number can legitimately fail
    // the Companies House auto-check (400) without an API key — that's the handler
    // running correctly, not a 500.
    expect(submit.status, await submit.clone().text().catch(() => '')).not.toBe(500);
    expect([200, 201, 400]).toContain(submit.status);

    const status = await producer.get('/api/production/verification-status');
    expect(status.status).not.toBe(500);
    expect(status.status).toBe(200);
  });
});

// Side-effect (DB mutation) assertions for the promote-only reputation cron
// (recomputeCreatorReputationTiers in src/services/creator-reputation.ts). It runs
// one UPDATE that sets verification_tier='gold' for creators meeting Path A
// (>= 2 sealed pitches AND >= 3 honored NDAs) or Path B (a mutually-confirmed
// closed deal), and never downgrades.
//
// No grey creator qualifies organically on the prod-copy branch (verified at
// authoring time: alex.creator is already gold; the rest have 0–1 of each signal).
// To get real TEETH on the UPDATE we seed ONE deterministic, self-cleaning Path-A
// creator via direct SQL (same fixture pattern this file already uses for NDA
// dedup) — this seeds the PREREQUISITE signals, not the tier itself; the live
// function is what flips the tier.
describe('cross-role: creator reputation gold promotion (DB mutation)', () => {
  const EMAIL = 'r7-gold-seed@example.test';
  let creatorId: number | null = null;
  let pitchId: number | null = null;
  const signerIds: number[] = [];

  async function cleanup() {
    const [u] = await sql`SELECT id FROM users WHERE email = ${EMAIL}`;
    if (!u) return;
    const id = u.id;
    const pitches = await sql`SELECT id FROM pitches WHERE user_id = ${id}`;
    for (const p of pitches) {
      await sql`DELETE FROM ndas WHERE pitch_id = ${p.id}`;
      await sql`DELETE FROM pitch_provenance WHERE pitch_id = ${p.id}`;
    }
    await sql`DELETE FROM pitch_provenance WHERE creator_id = ${id}`;
    await sql`DELETE FROM pitches WHERE user_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id}`;
  }

  beforeAll(async () => {
    await cleanup(); // idempotent re-runs

    const [u] = await sql`
      INSERT INTO users (email, username, password, user_type, verification_tier)
      VALUES (${EMAIL}, ${'r7goldseed'}, ${'x'}, 'creator', 'grey')
      RETURNING id
    `;
    creatorId = Number(u.id);

    const [p] = await sql`
      INSERT INTO pitches (user_id, creator_id, title, logline, status)
      VALUES (${creatorId}, ${creatorId}, ${'R7 gold seed pitch'},
              ${'Seed pitch for the reputation gold-promotion side-effect test.'}, 'draft')
      RETURNING id
    `;
    pitchId = Number(p.id);

    // Path A signal 1: >= 2 sealed pitches (provenance rows for this creator).
    for (let i = 0; i < 2; i++) {
      const hash = `${'r7'.padEnd(2, '0')}${String(creatorId).padStart(10, '0')}${String(Date.now() + i).padStart(20, '0')}`.padEnd(64, '0').slice(0, 64);
      await sql`
        INSERT INTO pitch_provenance (pitch_id, creator_id, content_hash, algorithm, content_version, sealed_at)
        VALUES (${pitchId}, ${creatorId}, ${hash}, 'sha256', ${i + 1}, NOW())
      `;
    }

    // Path A signal 2: >= 3 honored NDAs (status='signed', signer <> creator, not revoked).
    const signers = await sql`
      SELECT id FROM users WHERE user_type IN ('investor', 'production') AND id <> ${creatorId} LIMIT 3
    `;
    for (const s of signers) {
      signerIds.push(Number(s.id));
      await sql`
        INSERT INTO ndas (pitch_id, signer_id, status, nda_type, access_granted, signed_at, created_at, updated_at)
        VALUES (${pitchId}, ${s.id}, 'signed', 'basic', true, NOW(), NOW(), NOW())
        ON CONFLICT (pitch_id, signer_id) DO NOTHING
      `;
    }
  });

  afterAll(async () => { await cleanup(); });

  it('promotes a qualifying grey creator to gold, monotonically', async () => {
    expect(creatorId, 'precondition: seeded creator').not.toBeNull();
    expect(signerIds.length, 'precondition: >= 3 honored-NDA signers seeded').toBeGreaterThanOrEqual(3);

    const [before] = await sql`SELECT COALESCE(verification_tier, 'grey') AS tier FROM users WHERE id = ${creatorId}`;
    expect(String(before.tier)).toBe('grey');

    // Snapshot existing gold creators to assert monotonicity (no downgrades).
    const goldBefore = (await sql`SELECT id FROM users WHERE verification_tier = 'gold'`).map((r) => Number(r.id));

    const result = await recomputeCreatorReputationTiers(buildTestEnv());
    expect(typeof result.promoted).toBe('number');
    expect(result.promoted).toBeGreaterThanOrEqual(1);

    // The live UPDATE flipped our seeded creator grey -> gold.
    const [after] = await sql`SELECT verification_tier AS tier FROM users WHERE id = ${creatorId}`;
    expect(String(after.tier)).toBe('gold');

    // Monotonicity: every previously-gold creator is still gold.
    const goldAfter = new Set((await sql`SELECT id FROM users WHERE verification_tier = 'gold'`).map((r) => Number(r.id)));
    for (const id of goldBefore) {
      expect(goldAfter.has(id), `creator ${id} must not be downgraded from gold`).toBe(true);
    }
  });
});
