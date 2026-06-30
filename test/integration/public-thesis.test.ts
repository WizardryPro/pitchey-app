// Public investor-thesis endpoint (R11) — GET /api/public/thesis/:id.
//
// Proves the privacy contract: is_public=true returns the SAFE SUBSET (identity +
// positioning + taxonomy, NO financial bounds); private/missing returns a plain
// 404 (no existence leak); and the route is reachable logged-out (publicEndpoints
// bypass works — not a 401 from validateAuth).

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon } from '@neondatabase/serverless';
import { TestClient, json } from './client';
import { getTestDatabaseUrl } from './env';

const sql = neon(getTestDatabaseUrl());
const NS = 'r11-%@itest.local';

async function makeInvestor(tag: string): Promise<number> {
  const [u] = await sql`
    INSERT INTO users (email, username, password, password_hash, user_type, company_name)
    VALUES (${'r11-' + tag + '@itest.local'}, ${'r11_' + tag}, 'x', 'x', 'investor', ${'R11 Fund ' + tag})
    RETURNING id
  ` as { id: number }[];
  return Number(u.id);
}

async function cleanup() {
  await sql`DELETE FROM investor_thesis WHERE investor_id IN (SELECT id FROM users WHERE email LIKE ${NS})`;
  await sql`DELETE FROM users WHERE email LIKE ${NS}`;
}

let publicInvestor = 0, privateInvestor = 0;

beforeAll(async () => {
  await cleanup();
  publicInvestor = await makeInvestor('pub');
  privateInvestor = await makeInvestor('priv');
  // Public thesis — financials set so we can prove they are NOT returned.
  await sql`
    INSERT INTO investor_thesis (investor_id, genres, formats, stages, themes, positioning,
                                 budget_min_usd, budget_max_usd, check_size_min_usd, check_size_max_usd, is_public)
    VALUES (${publicInvestor}, ${['Drama', 'Sci-Fi']}, ${['Feature Film']}, ${['Development']}, ${['Identity']},
            'We back bold first features.', 1000000, 5000000, 250000, 1000000, true)
  `;
  // Private thesis — must 404.
  await sql`
    INSERT INTO investor_thesis (investor_id, genres, positioning, is_public)
    VALUES (${privateInvestor}, ${['Horror']}, 'Private mandate.', false)
  `;
});

afterAll(async () => { await cleanup(); });

describe('public thesis: GET /api/public/thesis/:id', () => {
  it('G3: reachable logged-out (publicEndpoints bypass — not 401)', async () => {
    const res = await new TestClient().get(`/api/public/thesis/${publicInvestor}`);
    expect(res.status, await res.clone().text().catch(() => '')).not.toBe(401);
    expect(res.status).toBe(200);
  });

  it('G1: public thesis returns the safe subset and NO financial fields', async () => {
    const res = await new TestClient().get(`/api/public/thesis/${publicInvestor}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    const t = body.thesis;
    expect(t.companyName).toContain('R11 Fund');
    expect(t.positioning).toBe('We back bold first features.');
    expect(t.genres).toEqual(['Drama', 'Sci-Fi']);
    expect(t.formats).toEqual(['Feature Film']);
    // Financials must NEVER appear in the public payload.
    const keys = Object.keys(t);
    expect(keys).not.toContain('budgetMinUsd');
    expect(keys).not.toContain('budgetMaxUsd');
    expect(keys).not.toContain('checkSizeMinUsd');
    expect(keys).not.toContain('checkSizeMaxUsd');
    expect(JSON.stringify(t)).not.toMatch(/250000|1000000|5000000/);
  });

  it('G1: a private (is_public=false) thesis returns 404, not 403/empty', async () => {
    const res = await new TestClient().get(`/api/public/thesis/${privateInvestor}`);
    expect(res.status).toBe(404);
  });

  it('a nonexistent investor id returns 404', async () => {
    const res = await new TestClient().get('/api/public/thesis/999999999');
    expect(res.status).toBe(404);
  });
});
