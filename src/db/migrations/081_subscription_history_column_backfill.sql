-- ============================================================================
-- 081_subscription_history_column_backfill.sql
-- ============================================================================
-- Prod error (2026-04-22): `column "new_tier" does not exist` on
-- GET /api/payments/subscription-status.
--
-- Root cause: 047_fix_schema_drift.sql uses CREATE TABLE IF NOT EXISTS for
-- subscription_history, so when the table was hand-created earlier from
-- add-subscription-history-payment-methods.sql (or a subset of it), 047
-- became a silent no-op and several columns never landed.
--
-- Fix: additive ADD COLUMN IF NOT EXISTS for every column the Worker's
-- SELECT (worker-integrated.ts:9192) and INSERT (worker-integrated.ts:9920)
-- read/write. Idempotent — safe to run regardless of current table state.
-- ============================================================================

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS previous_tier       VARCHAR(50);

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS new_tier            VARCHAR(50);

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS action              VARCHAR(50);

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS stripe_price_id     TEXT;

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS stripe_invoice_id   TEXT;

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS amount              DECIMAL(10, 2);

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS currency            VARCHAR(3) DEFAULT 'usd';

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS billing_interval    VARCHAR(20);

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS period_start        TIMESTAMPTZ;

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS period_end          TIMESTAMPTZ;

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS status              VARCHAR(50);

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS metadata            JSONB DEFAULT '{}';

ALTER TABLE subscription_history
    ADD COLUMN IF NOT EXISTS timestamp           TIMESTAMPTZ DEFAULT NOW();

-- Note: 047 declared new_tier/action/status as NOT NULL. We leave those
-- nullable here because enforcing NOT NULL on an existing non-empty table
-- would fail; the application-side writers populate these values, and any
-- pre-existing rows that predate 047 would need a backfill first.
