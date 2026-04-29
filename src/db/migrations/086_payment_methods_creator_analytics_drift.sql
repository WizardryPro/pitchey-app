-- Schema drift fix surfaced 2026-04-29 via Cloudflare observability:
--
--   1. "Failed to fetch payment methods: NeonDbError: column "brand" does not exist"
--      worker-integrated.ts:9550 selects brand/last_four/exp_month/exp_year/billing_name
--      from payment_methods. Multiple historical CREATE TABLE IF NOT EXISTS migrations
--      define payment_methods with conflicting schemas; whichever ran first stuck.
--      021_phase3_advanced_tables.sql uses card_brand/card_last4/card_exp_month/
--      card_exp_year and has no billing_name column. The handler's catch-fallback
--      returns { paymentMethods: [] } on failure so the bug surfaced as "user has no
--      saved cards" rather than an error — same silent-default anti-pattern documented
--      in CLAUDE.md ("Anti-Pattern: Silent .catch(() => default) on DB Queries").
--
--   2. "Database query attempt 1 failed: QueryError: relation "creator_analytics" does
--      not exist" — migration 018_creator_analytics_tables.sql was never run on prod
--      (known historical drift, "Migration gaps 048-067" entry in CLAUDE.md). Handler
--      at handlers/creator-analytics.ts queries creator_analytics, pitch_analytics,
--      pitch_engagement.
--
-- Same pattern as migration 081 (subscription_history column backfill, 2026-04-22):
-- ADD COLUMN IF NOT EXISTS for every expected column because CREATE TABLE IF NOT
-- EXISTS was a silent no-op against pre-existing partial tables.
--
-- This migration is purely additive (no DROPs, no NOT NULL on populated rows). Safe
-- to re-run.

-- ── Bug #1: payment_methods column alignment ─────────────────────────────────

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS brand        VARCHAR(20);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS last_four    VARCHAR(4);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS exp_month    INTEGER;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS exp_year     INTEGER;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS billing_name VARCHAR(255);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT TRUE;

-- Backfill from card_* columns (021_phase3_advanced_tables.sql legacy schema) if
-- they exist. Each block is self-guarded so the migration is a no-op on databases
-- that were created from the canonical schema (003/047/add-subscription-history).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_methods' AND column_name = 'card_brand'
  ) THEN
    UPDATE payment_methods SET brand = card_brand WHERE brand IS NULL AND card_brand IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_methods' AND column_name = 'card_last4'
  ) THEN
    UPDATE payment_methods SET last_four = card_last4 WHERE last_four IS NULL AND card_last4 IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_methods' AND column_name = 'card_exp_month'
  ) THEN
    UPDATE payment_methods SET exp_month = card_exp_month WHERE exp_month IS NULL AND card_exp_month IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_methods' AND column_name = 'card_exp_year'
  ) THEN
    UPDATE payment_methods SET exp_year = card_exp_year WHERE exp_year IS NULL AND card_exp_year IS NOT NULL;
  END IF;
END $$;

-- ── Bug #2: ensure creator_analytics et al. exist ────────────────────────────

CREATE TABLE IF NOT EXISTS creator_analytics (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_pitches INTEGER DEFAULT 0,
    published_pitches INTEGER DEFAULT 0,
    draft_pitches INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_saves INTEGER DEFAULT 0,
    nda_requests INTEGER DEFAULT 0,
    nda_signed INTEGER DEFAULT 0,
    investment_inquiries INTEGER DEFAULT 0,
    total_invested DECIMAL(15, 2) DEFAULT 0,
    avg_view_duration INTEGER,
    engagement_rate DECIMAL(5, 2),
    conversion_rate DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(creator_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_creator_analytics_creator
  ON creator_analytics(creator_id, period_end DESC);

CREATE TABLE IF NOT EXISTS pitch_analytics (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INTEGER DEFAULT 0,
    unique_views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    nda_requests INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    avg_view_duration INTEGER,
    bounce_rate DECIMAL(5, 2),
    completion_rate DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(pitch_id, date)
);

CREATE INDEX IF NOT EXISTS idx_pitch_analytics_pitch_date
  ON pitch_analytics(pitch_id, date DESC);

CREATE TABLE IF NOT EXISTS pitch_engagement (
    id SERIAL PRIMARY KEY,
    pitch_id INTEGER NOT NULL REFERENCES pitches(id) ON DELETE CASCADE,
    viewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    view_duration INTEGER,
    sections_viewed JSONB,
    engagement_score DECIMAL(5, 2),
    actions_taken JSONB,
    viewer_type VARCHAR(50),
    referrer VARCHAR(255),
    device_type VARCHAR(50),
    viewed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pitch_engagement_pitch
  ON pitch_engagement(pitch_id, viewed_at DESC);
