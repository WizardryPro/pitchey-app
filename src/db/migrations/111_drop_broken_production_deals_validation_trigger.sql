-- 111_drop_broken_production_deals_validation_trigger.sql
--
-- The `validate_production_deals` trigger (function `validate_production_deal_rules`)
-- has NEVER worked and silently blocked every production_deals INSERT/UPDATE — which
-- is why the table has 0 rows and the producer→creator deal flow dead-ended at
-- creation (moat #6). Two independent defects:
--   1. The function declares a local `company_verified boolean` that SHADOWS the
--      `users.company_verified` column it then SELECTs → "column reference
--      'company_verified' is ambiguous" on every fire.
--   2. Even past that, it reads `pitches.seeking_production`, a column that does
--      not exist → "column 'seeking_production' does not exist".
-- It was written against a schema that never shipped. Deal-creation validation
-- (dealType, min amounts) belongs in the application layer (createProductionDeal),
-- not a phantom-schema trigger.
--
-- A THIRD defect compounds it: the generic `audit_production_deals` trigger
-- (function `log_sensitive_operations`, shared by several tables) does
-- `COALESCE(NEW.user_id, NEW.investor_id, NEW.creator_id, …)` — but production_deals
-- has no `user_id` column, so plpgsql errors "record 'new' has no field 'user_id'"
-- on every insert. We drop only the TRIGGER on this table (the function stays, since
-- other tables that DO have user_id still use it).
--
-- The remaining production_deals triggers (update_deal_timestamp, prevent_deal_spam)
-- are correct and left in place. Deal-creation validation belongs in the app layer
-- (createProductionDeal). Additive/safe + idempotent.

DROP TRIGGER IF EXISTS validate_production_deals ON production_deals;
DROP FUNCTION IF EXISTS validate_production_deal_rules();
DROP TRIGGER IF EXISTS audit_production_deals ON production_deals;
