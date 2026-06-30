// Creator GOLD-reputation tier — side-effect + invariant coverage (R13).
//
// The platform-earned gold tier (src/services/creator-reputation.ts,
// recomputeCreatorReputationTiers) is PROMOTE-ONLY and runs on a daily cron with
// no HTTP trigger and (until R13) no side-effect test. These tests seed the exact
// qualifying signals, run the real service (and the new admin endpoint), and
// re-query users.verification_tier to prove the UPDATE actually happened — not
// just that an HTTP call returned 200.
//
// All fixtures use the `r13-…@itest.local` email namespace and are pre-cleaned in
// beforeAll + torn down in afterAll, so reruns are idempotent on a shared branch.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon } from '@neondatabase/serverless';
import { TestClient, json } from './client';
import { buildTestEnv, getTestDatabaseUrl } from './env';
import { recomputeCreatorReputationTiers } from '../../src/services/creator-reputation';

const sql = neon(getTestDatabaseUrl());
const NS = 'r13-%@itest.local';

async function cleanup() {
  // Children first (FKs), all scoped to the r13 namespace.
  await sql`DELETE FROM ndas WHERE signer_id IN (SELECT id FROM users WHERE email LIKE ${NS})`;
  await sql`DELETE FROM ndas WHERE pitch_id IN (SELECT id FROM pitches WHERE user_id IN (SELECT id FROM users WHERE email LIKE ${NS}))`;
  await sql`DELETE FROM production_deals WHERE creator_id IN (SELECT id FROM users WHERE email LIKE ${NS})`;
  await sql`DELETE FROM pitch_provenance WHERE creator_id IN (SELECT id FROM users WHERE email LIKE ${NS})`;
  await sql`DELETE FROM pitches WHERE user_id IN (SELECT id FROM users WHERE email LIKE ${NS})`;
  await sql`DELETE FROM users WHERE email LIKE ${NS}`;
}

async function makeUser(tag: string, userType: string, tier: string | null, password = 'R13testpass'): Promise<number> {
  const email = `r13-${tag}@itest.local`;
  // A users trigger requires production accounts to carry a company name.
  const companyName = userType === 'production' ? `R13 Co ${tag}` : null;
  const [u] = await sql`
    INSERT INTO users (email, username, password, password_hash, user_type, verification_tier, company_name)
    VALUES (${email}, ${'r13_' + tag}, ${password}, ${password}, ${userType}, ${tier}, ${companyName})
    RETURNING id
  ` as { id: number }[];
  return Number(u.id);
}

async function makePitch(creatorId: number, title: string): Promise<number> {
  const [p] = await sql`
    INSERT INTO pitches (user_id, creator_id, title, logline, status)
    VALUES (${creatorId}, ${creatorId}, ${title}, ${'logline ' + title}, 'published')
    RETURNING id
  ` as { id: number }[];
  return Number(p.id);
}

async function tierOf(userId: number): Promise<string> {
  const [r] = await sql`SELECT COALESCE(verification_tier, 'grey') AS tier FROM users WHERE id = ${userId}` as { tier: string }[];
  return r?.tier ?? 'grey';
}

// Path A = >=2 sealed pitches + >=3 honored (signed, un-revoked) NDAs from others.
async function seedPathA(creatorId: number, sealedCount: number, ndaCount: number) {
  for (let i = 0; i < Math.max(sealedCount, ndaCount, 1); i++) {
    const pitchId = await makePitch(creatorId, `pa-${creatorId}-${i}`);
    if (i < sealedCount) {
      await sql`
        INSERT INTO pitch_provenance (pitch_id, creator_id, content_hash, algorithm, content_version, sealed_at)
        VALUES (${pitchId}, ${creatorId}, ${'hash-' + creatorId + '-' + i + '-' + Math.random().toString(36).slice(2)}, 'sha-256', 1, NOW())
      `;
    }
    if (i < ndaCount) {
      const signerId = await makeUser(`signer-${creatorId}-${i}`, 'investor', null);
      await sql`
        INSERT INTO ndas (pitch_id, signer_id, status, nda_type, access_granted, signed_at, created_at, updated_at)
        VALUES (${pitchId}, ${signerId}, 'signed', 'basic', true, NOW(), NOW(), NOW())
      `;
    }
  }
}

let cA = 0, cBelow = 0, cDealB = 0, cAlreadyGold = 0, prodUser = 0;

beforeAll(async () => {
  await cleanup();
  // T1 — Path A qualifier (grey -> should go gold)
  cA = await makeUser('c-pathA', 'creator', 'grey');
  await seedPathA(cA, 2, 3);
  // T2 — below threshold (1 sealed + 2 NDAs -> stays grey)
  cBelow = await makeUser('c-below', 'creator', 'grey');
  await seedPathA(cBelow, 1, 2);
  // T3 — Path B (one mutually-confirmed closed deal, NO seals/NDAs -> gold)
  cDealB = await makeUser('c-pathB', 'creator', 'grey');
  prodUser = await makeUser('prod', 'production', 'silver');
  const dealPitch = await makePitch(cDealB, 'deal-pitch');
  await sql`
    INSERT INTO production_deals (pitch_id, production_company_id, creator_id, deal_type, outcome, outcome_confirmed_by_creator, outcome_confirmed_by_production)
    VALUES (${dealPitch}, ${prodUser}, ${cDealB}, 'option', 'closed_on_platform', true, true)
  `;
  // T4 — already gold creator (promote-only invariant) — also qualifies via Path A
  cAlreadyGold = await makeUser('c-gold', 'creator', 'gold');
  await seedPathA(cAlreadyGold, 2, 3);
});

afterAll(async () => { await cleanup(); });

describe('creator-reputation: gold recompute side-effects', () => {
  it('T1 Path A: a grey creator with >=2 seals + >=3 honored NDAs is promoted to gold', async () => {
    expect(await tierOf(cA)).toBe('grey'); // precondition
    const res = await recomputeCreatorReputationTiers(buildTestEnv());
    expect(res.promotedIds).toContain(cA);
    expect(await tierOf(cA)).toBe('gold'); // the SIDE EFFECT, re-queried from the DB
  });

  it('T2 below threshold: a creator with only 1 seal + 2 NDAs is NOT promoted', async () => {
    await recomputeCreatorReputationTiers(buildTestEnv());
    expect(await tierOf(cBelow)).toBe('grey');
  });

  it('T3 Path B: one mutually-confirmed closed deal alone promotes to gold (no seals/NDAs)', async () => {
    const res = await recomputeCreatorReputationTiers(buildTestEnv());
    // cDealB has zero provenance/ndas — only the deal qualifies it.
    expect(await tierOf(cDealB)).toBe('gold');
    // sanity: it was promoted by Path B in some run (already gold now → excluded going forward)
    expect(typeof res.promoted).toBe('number');
  });

  it('T4 promote-only invariant: an already-gold creator stays gold, is not double-counted, non-creators untouched', async () => {
    const prodTierBefore = await tierOf(prodUser);
    const res = await recomputeCreatorReputationTiers(buildTestEnv());
    expect(await tierOf(cAlreadyGold)).toBe('gold'); // never downgraded
    expect(res.promotedIds).not.toContain(cAlreadyGold); // excluded by COALESCE(tier,'grey') <> 'gold'
    expect(await tierOf(prodUser)).toBe(prodTierBefore); // production user never touched
  });
});

describe('creator-reputation: admin recompute endpoint', () => {
  const client = new TestClient();
  let epId = 0;

  beforeAll(async () => {
    epId = await makeUser('ep-admin', 'creator', null); // created as creator so portal login matches
    await client.login('r13-ep-admin@itest.local', 'R13testpass', 'creator');
  });

  it('T5a non-admin gets 403', async () => {
    const res = await client.post('/api/admin/reputation/recompute', {});
    expect(res.status, await res.clone().text().catch(() => '')).toBe(403);
  });

  it('T5b admin gets 200 with a promoted count', async () => {
    await sql`UPDATE users SET user_type = 'admin' WHERE id = ${epId}`; // flip after login; handler reads type fresh
    const res = await client.post('/api/admin/reputation/recompute', {});
    expect(res.status, await res.clone().text().catch(() => '')).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(typeof body.promoted).toBe('number');
    expect(Array.isArray(body.promotedIds)).toBe(true);
  });
});
