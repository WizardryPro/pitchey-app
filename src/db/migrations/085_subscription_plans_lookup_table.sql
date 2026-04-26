-- 085_subscription_plans_lookup_table.sql
--
-- Durable fix for issue #44: replaces the hardcoded subscription_tier whitelist
-- in validate_user_verification_rules() with an EXISTS lookup against a new
-- subscription_plans table. Adding / renaming / removing a tier now requires
-- exactly one migration row — no separate edit to business-rules-enforcement.sql.
--
-- Background: 083_relax_subscription_tier_check.sql was a point fix that widened
-- the IN(...) list to match src/config/subscription-plans.ts as it stood on
-- 2026-04-24. The next tier change would have re-introduced the same drift.
-- This migration replaces that pattern entirely. 083 stays applied; the
-- CREATE OR REPLACE below supersedes the function body it produced.
--
-- The table is intentionally minimal — id + is_legacy + created_at. The TS
-- config remains the source of truth for behavioural fields (price, credits,
-- features); the DB table is the source of truth for "is this ID valid?".
-- Nothing else needs to be mirrored.

CREATE TABLE IF NOT EXISTS subscription_plans (
  id text PRIMARY KEY,
  is_legacy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Current tier IDs from src/config/subscription-plans.ts (2026-04-26).
INSERT INTO subscription_plans (id) VALUES
  ('watcher'),
  ('creator'), ('creator_plus'), ('creator_unlimited'),
  ('production'), ('production_plus'), ('production_unlimited'),
  ('exec'), ('exec_unlimited')
ON CONFLICT (id) DO NOTHING;

-- Legacy / transitional values retained so existing rows that still carry
-- these don't trigger-fail on UPDATE. Mirrors 083's widened whitelist.
INSERT INTO subscription_plans (id, is_legacy) VALUES
  ('basic', true),     -- documented downgrade target (084 + daily expiry sweep)
  ('free', true),
  ('pro', true),
  ('investor', true)
ON CONFLICT (id) DO NOTHING;

-- Replace the trigger function: validation now reads from subscription_plans.
-- Function signature unchanged, so the existing trigger on users picks up the
-- new body automatically — no DROP TRIGGER needed.
CREATE OR REPLACE FUNCTION validate_user_verification_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: Production companies must have company information
  IF NEW.user_type = 'production' THEN
    IF NEW.company_name IS NULL OR NEW.company_name = '' THEN
      RAISE EXCEPTION 'Business rule violation: Production companies must provide company name';
    END IF;
  END IF;

  -- Rule 2: Email verification required for certain operations
  IF NEW.user_type IN ('investor', 'production') AND NOT NEW.email_verified THEN
    RAISE NOTICE 'User created but email verification required for full platform access';
  END IF;

  -- Rule 3: Subscription tier validation — lookup-based, see issue #44.
  IF NEW.subscription_tier IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM subscription_plans WHERE id = NEW.subscription_tier
     ) THEN
    RAISE EXCEPTION 'Business rule violation: Invalid subscription tier: %', NEW.subscription_tier;
  END IF;

  -- Rule 4: User type consistency — unchanged, see memory
  -- "Viewer vs Watcher — conceptual model" for the 'viewer' vs 'watcher' drift.
  IF NEW.user_type NOT IN ('creator', 'investor', 'production', 'viewer', 'admin') THEN
    RAISE EXCEPTION 'Business rule violation: Invalid user type: %', NEW.user_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
