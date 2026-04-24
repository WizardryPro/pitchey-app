-- 082_founding_user_subscription_grant.sql
--
-- Grants all existing real users a 6-month free subscription at the
-- "access to everything" tier for their user_type.
--
-- Tier mapping (matches src/config/subscription-plans.ts):
--   creator    → creator_unlimited    (€39.99/mo normally)
--   production → production_unlimited (€39.99/mo normally)
--   investor   → exec_unlimited       (€49.99/mo normally)
--   watcher/viewer — skipped (portal is already free and pins tier='watcher')
--   admin — skipped
--
-- Filters:
--   is_active = true (exclude disabled accounts)
--   email NOT LIKE '%@demo.com' (exclude seeded demo accounts — alex.creator,
--     sarah.investor, stellar.production, jamie.watcher, etc.)
--
-- Expiry enforcement:
--   New column `users.subscription_ends_at` is consulted by the daily sweep in
--   src/worker-integrated.ts scheduled handler (082 cron). When NOW() passes
--   the end date and subscription_status='active' but stripe_subscription_id
--   is NULL (i.e. this grant, not a paid Stripe sub), the user is downgraded
--   back to 'basic' / 'canceled'.
--
-- Reversibility:
--   Rollback: DELETE FROM subscription_history WHERE action='founding_grant';
--   then UPDATE users SET subscription_tier='basic', subscription_status=null,
--   subscription_ends_at=null WHERE id IN (select user_id from deleted rows).

-- 1. Add expiry column — idempotent
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- 1a. Relax orphaned NOT NULL columns on subscription_history.
--     The table has two parallel column sets: a legacy set (tier, start_date,
--     end_date) from a retired BASIC/PRO/ENTERPRISE scheme, and a current set
--     (new_tier, previous_tier, period_start, period_end). Live code writes
--     only the current set; the legacy columns are orphaned. No code reads
--     tier or start_date (verified via grep).
--
--     `tier` is ENUM subscription_tier_new (values: BASIC/PRO/ENTERPRISE),
--     which can't legally hold current tier IDs like 'creator_unlimited'.
--     `start_date` has no default, so new inserts fail the NOT NULL check.
--
--     Full column+type drop tracked alongside issue #44.
ALTER TABLE subscription_history ALTER COLUMN tier       DROP NOT NULL;
ALTER TABLE subscription_history ALTER COLUMN start_date DROP NOT NULL;

-- 2. Grant + record history in one transactional block. The CTE gives us a
--    single source of truth for "which users get the grant" so the UPDATE and
--    INSERT see the same set.
WITH eligible AS (
  SELECT
    id,
    user_type,
    CASE user_type
      WHEN 'creator'    THEN 'creator_unlimited'
      WHEN 'production' THEN 'production_unlimited'
      WHEN 'investor'   THEN 'exec_unlimited'
      ELSE NULL
    END AS target_tier,
    subscription_tier AS previous_tier
  FROM users
  WHERE is_active = true
    AND email NOT LIKE '%@demo.com'
    AND user_type IN ('creator', 'production', 'investor')
    -- Don't re-grant if someone already has an active unlimited tier
    -- (avoids clobbering a real Stripe subscription with a free grant).
    AND NOT (
      subscription_tier IN ('creator_unlimited', 'production_unlimited', 'exec_unlimited')
      AND subscription_status = 'active'
    )
),
updated AS (
  UPDATE users u
  SET
    subscription_tier      = e.target_tier,
    subscription_status    = 'active',
    subscription_ends_at   = NOW() + INTERVAL '6 months',
    updated_at             = NOW()
  FROM eligible e
  WHERE u.id = e.id
  RETURNING u.id, e.target_tier, e.previous_tier
)
INSERT INTO subscription_history (
  user_id, previous_tier, new_tier, action, amount, currency, status,
  billing_interval, period_start, period_end, stripe_subscription_id, metadata, created_at
)
SELECT
  updated.id,
  updated.previous_tier,
  updated.target_tier,
  'founding_grant',        -- distinct action label so the sweep + rollback can target it
  0,                        -- free
  'EUR',
  'active',
  'month',
  NOW(),
  NOW() + INTERVAL '6 months',
  NULL,                     -- no Stripe subscription backing this
  jsonb_build_object(
    'reason', 'founding user 6-month gift',
    'granted_at', NOW()
  ),
  NOW()
FROM updated;

-- 3. Report what happened (visible in migrate runner output)
DO $$
DECLARE
  granted_count int;
  skipped_demo_count int;
  skipped_existing_count int;
BEGIN
  SELECT COUNT(*) INTO granted_count
  FROM subscription_history
  WHERE action = 'founding_grant' AND created_at >= NOW() - INTERVAL '5 minutes';

  SELECT COUNT(*) INTO skipped_demo_count
  FROM users
  WHERE is_active = true AND email LIKE '%@demo.com';

  SELECT COUNT(*) INTO skipped_existing_count
  FROM users
  WHERE is_active = true
    AND email NOT LIKE '%@demo.com'
    AND user_type IN ('creator', 'production', 'investor')
    AND subscription_tier IN ('creator_unlimited', 'production_unlimited', 'exec_unlimited')
    AND subscription_status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM subscription_history sh
      WHERE sh.user_id = users.id AND sh.action = 'founding_grant'
    );

  RAISE NOTICE '082_founding_user_subscription_grant: granted=%, skipped_demo=%, skipped_already_unlimited=%',
    granted_count, skipped_demo_count, skipped_existing_count;
END $$;
