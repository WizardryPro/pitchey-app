-- Migration 047: Fix Production Schema Drift
-- Detected via Cloudflare Workers Observability on 2026-03-29
-- 4 SQL errors where deployed Worker code references missing tables/columns

-- ============================================================================
-- Section A: pitch_analytics table (missing entirely)
-- Error: "relation pitch_analytics does not exist"
-- Endpoint: GET /api/analytics/realtime
-- Source schema: migration 018_creator_analytics_tables.sql
-- ============================================================================

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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pitch_id, date)
);

CREATE INDEX IF NOT EXISTS idx_pitch_analytics_pitch_date
    ON pitch_analytics(pitch_id, date DESC);

-- ============================================================================
-- Section B: saved_pitches.notes column (missing from table)
-- Error: "column sp.notes does not exist"
-- Endpoint: GET /api/saved-pitches
-- Source schema: migration 016_critical_missing_tables.sql
-- ============================================================================

ALTER TABLE saved_pitches ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================================
-- Section C: notifications columns (from_user_id, related_pitch_id, related_user_id)
-- Error: "column n.from_user_id does not exist"
-- Endpoint: GET /api/user/notifications
-- Also needed: related_pitch_id, related_user_id (used in NDA notification INSERTs
-- at lines 7434/7509 of worker-integrated.ts)
-- ============================================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS from_user_id INTEGER;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_pitch_id INTEGER;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_notifications_from_user
    ON notifications(from_user_id);

-- ============================================================================
-- Section D: subscription_history table (missing entirely)
-- Error: "column new_tier does not exist"
-- Endpoint: GET /api/payments/subscription-status
-- Source schema: add-subscription-history-payment-methods.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    previous_tier VARCHAR(50),
    new_tier VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    stripe_invoice_id TEXT,
    amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'usd',
    billing_interval VARCHAR(20),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id
    ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_status
    ON subscription_history(status);
CREATE INDEX IF NOT EXISTS idx_subscription_history_stripe_subscription
    ON subscription_history(stripe_subscription_id);

-- Also ensure payment_methods table exists (referenced by subscription endpoints)
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    type VARCHAR(20) NOT NULL,
    brand VARCHAR(20),
    last_four VARCHAR(4),
    exp_month INTEGER,
    exp_year INTEGER,
    bank_name VARCHAR(100),
    account_type VARCHAR(20),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    billing_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id
    ON payment_methods(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_user_default
    ON payment_methods(user_id) WHERE is_default = TRUE;
