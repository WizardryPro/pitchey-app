// Read-only DB assertion helper for the integration tier.
//
// Backs side-effect (round-trip) assertions: a test drives the REAL worker
// `fetch()` to perform a write through the live handler path, then this helper
// reads the resulting rows back from the SAME throwaway Neon branch to prove the
// write actually landed (not just that the HTTP status was 2xx).
//
// IMPORTANT: this is for ASSERTIONS / READS only. The worker performs every
// application write through its own SQL path — do NOT insert/update app data
// through this helper. (Test-fixture seeding for a deterministic flow is done in
// the individual test with its own `neon()` client, matching the existing
// cross-role-flows.test.ts pattern — kept separate from this read helper.)
//
// Connection string comes from getTestDatabaseUrl(), which runs the prod guard
// (assertNotProd). We REUSE that guard here rather than re-reading the env var,
// so this helper can never point at production and the suite errors clearly if
// TEST_DATABASE_URL is unset.

import { neon } from '@neondatabase/serverless';
import { getTestDatabaseUrl } from './env';

const sql = neon(getTestDatabaseUrl());

/** Run a parameterized read and return all rows. */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await sql.query(text, params)) as unknown as T[];
}

/** Run a parameterized read and return the first row (or null). */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
