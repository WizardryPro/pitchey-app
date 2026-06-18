// Platform-earned GOLD tier for creators — the moat-native trust signal.
//
// A creator can't do company verification (no company). Their top trust tier is
// EARNED from on-platform history that only exists because of Pitchey:
//   - a real sealed catalogue (>= 2 sealed pitches — provenance), and
//   - sustained, un-withdrawn buyer interest (>= 3 honored NDAs from OTHER users:
//     status='signed' AND not revoked).
// This reputation is non-transferable and hard to fake — exactly the asset that
// makes Pitchey the venue rather than a listing site.
//
// PROMOTE-ONLY by design: it only ever sets verification_tier='gold', and only for
// creators not already gold. It never downgrades, and never touches production/
// investor (who earn gold via company-verification) or admin-granted gold. So it
// cannot conflict with the company-verification / admin / identity tier writers.
//
// NOTE: gold does NOT require identity (silver) in v1 — the catalogue + honored-NDA
// signals stand on their own and are hard to fake. To tighten once Stripe Identity
// is enabled, add `AND u.identity_verified_at IS NOT NULL` to the WHERE.

import { neon } from '@neondatabase/serverless';

const MIN_SEALED_PITCHES = 2;
const MIN_HONORED_NDAS = 3;

export async function recomputeCreatorReputationTiers(env: any, _ctx?: any): Promise<{ promoted: number }> {
  const url = env?.DATABASE_URL;
  if (!url) return { promoted: 0 };
  const sql = neon(url);
  try {
    const rows = await sql`
      UPDATE users u SET verification_tier = 'gold', updated_at = NOW()
      WHERE u.user_type = 'creator'
        AND COALESCE(u.verification_tier, 'grey') <> 'gold'
        AND (
          SELECT COUNT(*) FROM pitch_provenance pr WHERE pr.creator_id = u.id
        ) >= ${MIN_SEALED_PITCHES}
        AND (
          SELECT COUNT(*) FROM ndas n
          JOIN pitches p ON p.id = n.pitch_id
          WHERE p.user_id = u.id
            AND n.status = 'signed'
            AND n.signer_id <> u.id
            AND n.revoked_at IS NULL
            AND n.access_revoked_at IS NULL
        ) >= ${MIN_HONORED_NDAS}
      RETURNING u.id
    `;
    const promoted = rows.length;
    console.log(JSON.stringify({
      level: 'info',
      category: 'reputation',
      action: 'creator_gold_recompute',
      promoted,
    }));
    return { promoted };
  } catch (err) {
    console.error('recomputeCreatorReputationTiers error:', err instanceof Error ? err.message : String(err));
    return { promoted: 0 };
  }
}
