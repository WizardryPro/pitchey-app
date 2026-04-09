-- Migration 075: Pitchey Score — Branded 1-10 Rating Scale
-- Replaces 1-5 star ratings with branded 1-10 scale (Dead on Arrival → Pitch Perfect)
-- Adds anonymous ratings table, role-weighted scoring
-- Removes likes from heat score, replaces with weighted user ratings
--
-- Weight hierarchy: anonymous=0.25x, watcher=0.5x, creator=1x, investor=3x, production=4x

BEGIN;

-- 1. Widen pitches.rating_average to support 10.00
ALTER TABLE pitches ALTER COLUMN rating_average TYPE DECIMAL(4,2);

-- 2. Drop old CHECK constraint on pitch_feedback.rating (1-5), add new (1-10)
ALTER TABLE pitch_feedback DROP CONSTRAINT IF EXISTS pitch_feedback_rating_check;
ALTER TABLE pitch_feedback ADD CONSTRAINT pitch_feedback_rating_check CHECK (rating >= 1 AND rating <= 10);

-- 3. Scale existing feedback ratings: 1-5 → 2-10
UPDATE pitch_feedback SET rating = rating * 2 WHERE rating IS NOT NULL;

-- 4. Scale existing pitches.rating_average
UPDATE pitches SET rating_average = rating_average * 2 WHERE rating_average > 0;

-- 5. Add reviewer_weight column to pitch_feedback
ALTER TABLE pitch_feedback ADD COLUMN IF NOT EXISTS reviewer_weight DECIMAL(4,2) DEFAULT 1.0;

-- Backfill weights for existing rows
UPDATE pitch_feedback SET reviewer_weight = CASE
  WHEN reviewer_type = 'production' THEN 4.0
  WHEN reviewer_type = 'investor' THEN 3.0
  WHEN reviewer_type = 'watcher' THEN 0.5
  WHEN reviewer_type = 'peer' THEN 1.0
  ELSE 1.0
END;

-- 6. Create anonymous ratings table
CREATE TABLE IF NOT EXISTS pitch_ratings_anonymous (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  ip_hash VARCHAR(64) NOT NULL,
  reviewer_weight DECIMAL(4,2) NOT NULL DEFAULT 0.25,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pitch_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_pitch_ratings_anon_pitch ON pitch_ratings_anonymous(pitch_id);

-- 7. Add anonymous + watcher to heat_role_weights
INSERT INTO heat_role_weights (role, weight) VALUES
  ('anonymous', 0.25),
  ('watcher', 0.5)
ON CONFLICT (role) DO UPDATE SET weight = EXCLUDED.weight;

-- 8. Add viewer_score_avg column for the dual-score system
-- pitchey_score_avg = weighted avg from creator/investor/production (industry)
-- viewer_score_avg = weighted avg from watcher/anonymous (audience)
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS pitchey_score_avg DECIMAL(4,2) DEFAULT 0;
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS viewer_score_avg DECIMAL(4,2) DEFAULT 0;

-- 9. Create pitch_comments table for simple comment thread
CREATE TABLE IF NOT EXISTS pitch_comments (
  id SERIAL PRIMARY KEY,
  pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_type VARCHAR(50),
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  ip_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pitch_comments_pitch ON pitch_comments(pitch_id, created_at DESC);

-- 10. Replace heat score function — removes likes, adds weighted ratings from both tables
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
