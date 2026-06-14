#!/usr/bin/env node
// Regression check for Bug #284 — NDA request -> approve -> access-gate must all
// operate on the `ndas` table. Before the fix, requestNDA wrote pending rows to
// `nda_requests` while approveNDA + the getPitch access-gate read `ndas`, so a
// real (non-demo) request could never be approved.
//
// This runs the full flow inside ONE transaction and ROLLS BACK — it never
// mutates the target DB. Point DATABASE_URL at a Neon branch (or prod read is
// fine since nothing commits). Exits non-zero on any failed assertion.
//
//   DATABASE_URL=postgres://... node scripts/checks/nda-approve-flow.mjs

import postgres from 'postgres';
import process from 'node:process';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

const sql = postgres(url, { max: 1, prepare: false });
let failures = 0;
const ok = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
};

try {
  // Wrap everything and force a rollback so the DB is untouched.
  await sql.begin(async (tx) => {
    // Pick a published pitch + a user who is not the owner and has no ndas row yet.
    const [cand] = await tx`
      SELECT p.id AS pitch_id, p.user_id AS creator_id, u.id AS requester_id
      FROM pitches p
      CROSS JOIN LATERAL (SELECT id FROM users WHERE id <> p.user_id ORDER BY id LIMIT 3) u
      WHERE p.status = 'published'
        AND NOT EXISTS (SELECT 1 FROM ndas n WHERE n.pitch_id = p.id AND n.signer_id = u.id)
      LIMIT 1
    `;
    if (!cand) throw new Error('no clean (pitch, requester) pair available to test');
    const { pitch_id, creator_id, requester_id } = cand;
    console.log(`using pitch_id=${pitch_id} creator_id=${creator_id} requester_id=${requester_id}`);

    // 1) requestNDA (non-demo): pending row goes into `ndas` with signed_at = NULL.
    const [reqRow] = await tx`
      INSERT INTO ndas (signer_id, pitch_id, status, nda_type, access_granted,
                        ip_address, user_agent, created_at, updated_at, signed_at, approved_at)
      VALUES (${requester_id}, ${pitch_id}, 'pending', 'basic', false,
              '127.0.0.1', 'nda-check', NOW(), NOW(), NULL, NULL)
      ON CONFLICT (pitch_id, signer_id) DO NOTHING
      RETURNING id, status, signed_at, access_granted
    `;
    ok('requestNDA inserts a pending row into ndas (no NOT NULL violation)', !!reqRow);
    ok('pending row has signed_at = NULL (not shown as signed)', reqRow && reqRow.signed_at === null);
    ok('pending row has access_granted = false', reqRow && reqRow.access_granted === false);

    // 2) approveNDA: the exact UPDATE the handler runs, keyed on ndas.id.
    const approved = await tx`
      UPDATE ndas n SET status = 'approved', approved_at = NOW(), approved_by = ${creator_id}, updated_at = NOW()
      FROM pitches p
      WHERE n.id = ${reqRow.id} AND n.pitch_id = p.id AND p.user_id = ${creator_id} AND n.status = 'pending'
      RETURNING n.id
    `;
    ok('approveNDA matches the request row (was 0 before the fix)', approved.length === 1);

    // 3) getPitch access-gate unlocks.
    const [gate] = await tx`
      SELECT count(*)::int AS n FROM ndas
      WHERE pitch_id = ${pitch_id} AND signer_id = ${requester_id} AND status IN ('approved','signed')
    `;
    ok('access gate unlocks after approval', gate.n === 1);

    // 4) getSignedNDAs must NOT list an approved-but-unsigned row.
    const [signedList] = await tx`
      SELECT count(*)::int AS n FROM ndas WHERE id = ${reqRow.id} AND signed_at IS NOT NULL
    `;
    ok('approved-but-unsigned row is NOT listed as signed', signedList.n === 0);

    // Roll back — this check must never persist anything.
    throw new Error('__rollback__');
  }).catch((e) => {
    if (e instanceof Error && e.message === '__rollback__') return;
    throw e;
  });
} catch (err) {
  console.error('check errored:', err instanceof Error ? err.message : err);
  failures++;
} finally {
  await sql.end({ timeout: 5 });
}

process.exit(failures === 0 ? 0 : 1);
