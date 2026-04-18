-- Migration 080: Reapply recalculate_heat_scores() function body from migration 075
--
-- Why this exists: prod was hand-migrated before the runner existed, and the 2026-04-17
-- baseline recorded 075 as "applied" in schema_migrations without actually executing it.
-- Verification via pg_get_functiondef() on 2026-04-18 confirmed the live function body is
-- still the original 073 version — it reads saved_pitches.review_rating (0-5 scale) and
-- still includes the likes CTE that 075 removed.
--
-- Result: the 1-10 role-weighted ratings captured in pitch_feedback and
-- pitch_ratings_anonymous never influence heat_score, so the marketplace "Hottest" sort
-- runs on the legacy 0-5 signal only.
--
-- Fix: this migration replaces the function body with the 075 design verbatim (mig 075
-- lines 74-177). CREATE OR REPLACE is idempotent — safe to re-run. Schema side of 075
-- (tables, columns, role weights) already landed via the 078 patch; this closes the
-- remaining gap.
--
-- After applying this migration, run `POST /api/admin/heat-scores/recalculate` to rebuild
-- heat_score values using the new function. Expect the marketplace "Hottest" feed to
-- visibly reshuffle: pitches with strong pitch_feedback signal but no saved_pitches
-- signal will rise.

BEGIN;

CREATE OR REPLACE FUNCTION recalculate_heat_scores()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER := 0;
  global_mean DECIMAL(5,2);
  bayesian_c DECIMAL := 10;
  decay_half_life DECIMAL := 14;
  freshness_window DECIMAL := 90;
BEGIN
  -- Global mean from both rating sources (1-10 scale)
  SELECT COALESCE(AVG(rating), 5.5) INTO global_mean
  FROM (
    SELECT rating FROM pitch_feedback WHERE rating IS NOT NULL
    UNION ALL
    SELECT rating FROM pitch_ratings_anonymous
  ) all_ratings;

  WITH engagement AS (
    SELECT
      pv.pitch_id,
      SUM(
        COALESCE(hrw.weight, 0.5) *
        POWER(0.5, EXTRACT(EPOCH FROM (NOW() - pv.viewed_at)) / (decay_half_life * 86400))
      ) AS weighted_views
    FROM pitch_views pv
    LEFT JOIN users u ON u.id = pv.viewer_id
    LEFT JOIN heat_role_weights hrw ON hrw.role = COALESCE(u.user_type, 'viewer')
    WHERE pv.viewed_at > NOW() - INTERVAL '90 days'
    GROUP BY pv.pitch_id
  ),
  saves AS (
    SELECT
      sp.pitch_id,
      SUM(
        COALESCE(hrw.weight, 0.5) *
        POWER(0.5, EXTRACT(EPOCH FROM (NOW() - COALESCE(sp.saved_at, sp.created_at))) / (decay_half_life * 86400))
      ) AS weighted_saves
    FROM saved_pitches sp
    LEFT JOIN users u ON u.id = sp.user_id
    LEFT JOIN heat_role_weights hrw ON hrw.role = COALESCE(u.user_type, 'viewer')
    WHERE COALESCE(sp.saved_at, sp.created_at) > NOW() - INTERVAL '90 days'
    GROUP BY sp.pitch_id
  ),
  ratings AS (
    SELECT
      pitch_id,
      (bayesian_c * global_mean + SUM(rating * reviewer_weight)) / (bayesian_c + SUM(reviewer_weight)) AS bayesian_rating
    FROM (
      SELECT pitch_id, rating, reviewer_weight FROM pitch_feedback WHERE rating IS NOT NULL
      UNION ALL
      SELECT pitch_id, rating, reviewer_weight FROM pitch_ratings_anonymous
    ) all_ratings
    GROUP BY pitch_id
  ),
  investments AS (
    SELECT
      ii.pitch_id,
      SUM(
        CASE ii.interest_level
          WHEN 'committed' THEN 4
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 1
          ELSE 1
        END
      ) AS investment_signal
    FROM investment_interests ii
    GROUP BY ii.pitch_id
  ),
  scores AS (
    SELECT
      p.id AS pitch_id,
      -- Engagement: views + saves (likes removed, ratings carry the weight now)
      0.4 * LEAST(100, (
        COALESCE(e.weighted_views, 0) * 1.0 +
        COALESCE(sv.weighted_saves, 0) * 2.0
      )) AS engagement_score,
      -- Rating: weighted Bayesian on 1-10 scale, * 10 to get 0-100
      0.3 * COALESCE(r.bayesian_rating, COALESCE(p.rating_average, global_mean)) * 10 AS rating_score,
      -- Investment signal
      0.2 * LEAST(100, COALESCE(inv.investment_signal, 0) * 10) AS investment_score,
      -- Freshness: 90-day linear decay
      0.1 * GREATEST(0, (1.0 - EXTRACT(EPOCH FROM (NOW() - COALESCE(p.published_at, p.created_at))) / (freshness_window * 86400))) * 100 AS freshness_score
    FROM pitches p
    LEFT JOIN engagement e ON e.pitch_id = p.id
    LEFT JOIN saves sv ON sv.pitch_id = p.id
    LEFT JOIN ratings r ON r.pitch_id = p.id
    LEFT JOIN investments inv ON inv.pitch_id = p.id
    WHERE p.status = 'published'
  )
  UPDATE pitches p
  SET heat_score = ROUND((s.engagement_score + s.rating_score + s.investment_score + s.freshness_score)::numeric, 4),
      updated_at = NOW()
  FROM scores s
  WHERE p.id = s.pitch_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  UPDATE pitches SET heat_score = 0 WHERE status != 'published' AND heat_score != 0;

  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
