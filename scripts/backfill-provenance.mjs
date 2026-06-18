// One-time backfill: seal already-published pitches that have no provenance row,
// stamped with their REAL publish date (published_at), so the "Sealed [date]"
// feature is visible on existing content — not just future publishes.
//
// Correctness: uses the SAME Neon HTTP driver the worker uses (@neondatabase/
// serverless) and a VERBATIM copy of the canonical() in src/services/pitch-
// provenance.ts + SHA-256, so a backfilled hash is byte-identical to what the
// worker would compute on a future re-publish (no spurious "new version").
//
// Idempotent (ON CONFLICT (content_hash) DO NOTHING; only seals unsealed pitches).
// Dry-run by default; pass `apply` to write.
//
//   node scripts/backfill-provenance.mjs            # dry-run (no writes)
//   DATABASE_URL=... node scripts/backfill-provenance.mjs apply

import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

const APPLY = process.argv.includes('apply');
const connStr = process.env.DATABASE_URL;
if (!connStr) { console.error('DATABASE_URL not set.'); process.exit(1); }
const sql = neon(connStr);

// ── VERBATIM from src/services/pitch-provenance.ts canonical() ──
function canonical(p) {
  const norm = (v) =>
    v === null || v === undefined ? ''
    : typeof v === 'object' ? JSON.stringify(v)
    : String(v);
  return JSON.stringify({
    pitch_id: Number(p.id),
    creator_id: Number(p.user_id),
    title: norm(p.title),
    logline: norm(p.logline),
    short_synopsis: norm(p.short_synopsis),
    long_synopsis: norm(p.long_synopsis),
    synopsis: norm(p.synopsis),
    genre: norm(p.genre),
    format: norm(p.format),
    themes: norm(p.themes),
    budget: norm(p.budget),
  });
}
const sha256Hex = (s) => createHash('sha256').update(s).digest('hex');

const rows = await sql`
  SELECT p.id, p.user_id, p.title, p.logline, p.short_synopsis, p.long_synopsis,
         p.synopsis, p.genre, p.format, p.themes, p.budget,
         COALESCE(p.published_at, p.created_at) AS sealed_at
  FROM pitches p
  WHERE p.status = 'published'
    AND NOT EXISTS (SELECT 1 FROM pitch_provenance pr WHERE pr.pitch_id = p.id)
  ORDER BY p.id
`;

console.log(`${rows.length} published pitch(es) need a seal.${APPLY ? '' : '  (dry-run — no writes)'}`);
let sealed = 0;
for (const p of rows) {
  const hash = sha256Hex(canonical(p));
  console.log(`  pitch ${p.id} "${String(p.title || '').slice(0, 40)}" → ${hash.slice(0, 16)}…  sealed_at=${new Date(p.sealed_at).toISOString().slice(0, 10)}`);
  if (APPLY) {
    const res = await sql`
      INSERT INTO pitch_provenance
        (pitch_id, creator_id, content_hash, algorithm, content_version, prev_hash, sealed_at)
      VALUES (${p.id}, ${p.user_id}, ${hash}, 'sha256', 1, NULL, ${p.sealed_at})
      ON CONFLICT (content_hash) DO NOTHING
      RETURNING id
    `;
    if (res.length) sealed++;
  }
}
console.log(APPLY ? `\n✓ Sealed ${sealed} pitch(es).` : `\nDry-run complete. Re-run with 'apply' to write.`);
