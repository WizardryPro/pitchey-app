-- 083_relax_subscription_tier_check.sql
--
-- Unblocks migration 084 (founding-user subscription grant) which attempts to
-- write tier values like 'creator_unlimited' that the existing
-- validate_user_verification_rules() trigger rejects.
--
-- Drift: trigger's tier whitelist in src/db/business-rules-enforcement.sql was
-- hardcoded to ('free', 'creator', 'pro', 'investor') — stale relative to
-- src/config/subscription-plans.ts which defines 9 tier IDs. Bug was dormant
-- because Stripe isn't live so no user had upgraded to a *_unlimited tier.
-- 084 is the first writer that tripped it.
--
-- Durable fix (lookup table vs codegen from TS config) tracked in issue #44.
-- This migration is a point fix: CREATE OR REPLACE the function body with a
-- widened whitelist. Function signature is unchanged, so the existing trigger
-- on users picks up the new body automatically — no DROP TRIGGER needed.
--
-- Whitelist composition:
--   Current tier IDs from subscription-plans.ts: watcher, creator,
--     creator_plus, creator_unlimited, production, production_plus,
--     production_unlimited, exec, exec_unlimited
--   'basic' — documented downgrade target in 084 rollback + daily sweep
--   Legacy values kept (free, pro, investor) so UPDATEs on pre-existing rows
--     that still carry these values don't retrigger-fail. Can be pruned once
--     a data audit confirms no rows reference them.

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

  -- Rule 3: Subscription tier validation (widened from legacy 4-value whitelist)
  IF NEW.subscription_tier IS NOT NULL
     AND NEW.subscription_tier NOT IN (
       -- Current tiers (src/config/subscription-plans.ts)
       'watcher',
       'creator', 'creator_plus', 'creator_unlimited',
       'production', 'production_plus', 'production_unlimited',
       'exec', 'exec_unlimited',
       -- Downgrade target documented in 084 + daily expiry sweep
       'basic',
       -- Legacy values retained for historical rows
       'free', 'pro', 'investor'
     ) THEN
    RAISE EXCEPTION 'Business rule violation: Invalid subscription tier: %', NEW.subscription_tier;
  END IF;

  -- Rule 4: User type consistency (unchanged — tracked separately, see memory
  -- "Viewer vs Watcher — conceptual model" for the 'viewer' vs 'watcher' drift)
  IF NEW.user_type NOT IN ('creator', 'investor', 'production', 'viewer', 'admin') THEN
    RAISE EXCEPTION 'Business rule violation: Invalid user type: %', NEW.user_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
