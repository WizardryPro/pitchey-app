-- Migration 073: Heat Score System
-- Bayesian + role-weighted engagement scoring for pitches
--
-- Algorithm (0-100 scale):
--   40% engagement (role-weighted views/likes/saves with 14-day half-life decay)
--   30% Bayesian-smoothed rating (C=10 prior, falls back to pitches.rating or global mean)
--   20% investment signal (interest_level weighted: committed=4, high=3, medium=2, low=1)
--   10% freshness (linear decay over 90 days from publish date)
--
-- Role weights: production=4x, investor=3x, creator=1x, viewer/watcher=0.5x
-- Recalculate via: SELECT recalculate_heat_scores();

-- Add heat_score column to pitches
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS heat_score DECIMAL(8,4) DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_pitches_heat_score ON pitches(heat_score DESC);

-- Role weight mapping table (tunable without code changes)
CREATE TABLE IF NOT EXISTS heat_role_weights (
  role VARCHAR(20) PRIMARY KEY,
  weight DECIMAL(4,2) NOT NULL DEFAULT 1.0
);

INSERT INTO heat_role_weights (role, weight) VALUES
  ('investor', 3.0),
  ('production', 4.0),
  ('creator', 1.0),
  ('viewer', 0.5),
  ('admin', 0.0)
ON CONFLICT (role) DO NOTHING;

-- Heat score calculation function
-- Uses: pitch_views.viewer_id, users.user_type, saved_pitches.review_rating
-- (pitch_ratings table not yet created — uses saved_pitches.review_rating as proxy)
CREATE OR REPLACE FUNCTION recalculate_heat_scores()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER := 0;
  global_mean DECIMAL(5,2);
  bayesian_c DECIMAL := 10;
  decay_half_life DECIMAL := 14;
  freshness_window DECIMAL := 90;
BEGIN
  SELECT COALESCE(AVG(review_rating), 3.0) INTO global_mean
  FROM saved_pitches
  WHERE review_rating IS NOT NULL;

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
  likes AS (
    SELECT
      pl.pitch_id,
      SUM(
        COALESCE(hrw.weight, 0.5) *
        POWER(0.5, EXTRACT(EPOCH FROM (NOW() - pl.created_at)) / (decay_half_life * 86400))
      ) AS weighted_likes
    FROM pitch_likes pl
    LEFT JOIN users u ON u.id = pl.user_id
    LEFT JOIN heat_role_weights hrw ON hrw.role = COALESCE(u.user_type, 'viewer')
    WHERE pl.created_at > NOW() - INTERVAL '90 days'
    GROUP BY pl.pitch_id
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
      sp.pitch_id,
      (bayesian_c * global_mean + SUM(sp.review_rating)) / (bayesian_c + COUNT(*)) AS bayesian_rating
    FROM saved_pitches sp
    WHERE sp.review_rating IS NOT NULL
    GROUP BY sp.pitch_id
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
      0.4 * LEAST(100, (
        COALESCE(e.weighted_views, 0) * 1.0 +
        COALESCE(l.weighted_likes, 0) * 3.0 +
        COALESCE(sv.weighted_saves, 0) * 2.0
      )) AS engagement_score,
      0.3 * COALESCE(r.bayesian_rating, COALESCE(p.rating, global_mean)) * 20 AS rating_score,
      0.2 * LEAST(100, COALESCE(inv.investment_signal, 0) * 10) AS investment_score,
      0.1 * GREATEST(0, (1.0 - EXTRACT(EPOCH FROM (NOW() - COALESCE(p.published_at, p.created_at))) / (freshness_window * 86400))) * 100 AS freshness_score
    FROM pitches p
    LEFT JOIN engagement e ON e.pitch_id = p.id
    LEFT JOIN likes l ON l.pitch_id = p.id
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
