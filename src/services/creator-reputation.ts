// Platform-earned GOLD tier for creators — the moat-native trust signal.
//
// A creator can't do company verification (no company). Their top trust tier is
// EARNED from on-platform history that only exists because of Pitchey. Two
// independent paths qualify (whichever lands first):
//   A. Catalogue + sustained interest — a real sealed catalogue (>= 2 sealed
//      pitches, provenance) AND sustained, un-withdrawn buyer interest (>= 3
//      honored NDAs from OTHER users: status='signed' AND not revoked).
//   B. A closed deal — at least one MUTUALLY-CONFIRMED closed deal
//      (production_deals.outcome closed on/off platform, with BOTH sides'
//      confirmation flags set). This is disintermediation-defense Phase 2: the
//      "earned, forfeitable, platform-bound" credential the research shows is the
//      only kind that retains (Airbnb Plus ~6% vs free Superhost ~0%). It is also
//      the bilateral incentive to REPORT a deal back even when money moved
//      off-platform — the creator's reward for confirming the outcome. A single
//      such deal stands on its own: it is far harder to fake than NDAs (it needs a
//      real counterparty producer to also confirm), so it is its own gold path and
//      does NOT additionally require the sealed catalogue.
// This reputation is non-transferable and hard to fake — exactly the asset that
// makes Pitchey the venue rather than a listing site.
//
// PROMOTE-ONLY by design: it only ever sets verification_tier='gold', and only for
// creators not already gold. It never downgrades, and never touches production/
// investor (who earn gold via company-verification) or admin-granted gold. So it
// cannot conflict with the company-verification / admin / identity tier writers.
//
// NOTE: gold does NOT require identity (silver) in v1 — the signals stand on their
// own and are hard to fake. To tighten once Stripe Identity is enabled, add
// `AND u.identity_verified_at IS NOT NULL` to the WHERE.

import { neon } from '@neondatabase/serverless';

const MIN_SEALED_PITCHES = 2;
const MIN_HONORED_NDAS = 3;
// One mutually-confirmed closed deal is enough — both parties had to confirm it.
const MIN_HONORED_DEALS = 1;

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
          -- Path A: sealed catalogue + sustained honored-NDA interest
          (
            (
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
          )
          -- Path B: a mutually-confirmed closed deal (Phase 2 — strongest earned
          -- credential; 'dead' deals do NOT count, only real closes)
          OR (
            SELECT COUNT(*) FROM production_deals d
            WHERE d.creator_id = u.id
              AND d.outcome IN ('closed_on_platform', 'closed_off_platform')
              AND d.outcome_confirmed_by_creator = true
              AND d.outcome_confirmed_by_production = true
          ) >= ${MIN_HONORED_DEALS}
        )
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
