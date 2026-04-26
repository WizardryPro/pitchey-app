-- ================================================================================
-- BUSINESS RULES ENFORCEMENT AT DATABASE LEVEL
-- Comprehensive triggers, constraints, and validation functions
-- ================================================================================

-- ================================================================================
-- PORTAL ACCESS ENFORCEMENT FUNCTIONS
-- ================================================================================

-- Function: Enforce portal access rules
CREATE OR REPLACE FUNCTION enforce_portal_access_rules()
RETURNS TRIGGER AS $$
DECLARE
  user_type_val text;
  operation_type text;
BEGIN
  -- Get user type
  SELECT user_type INTO user_type_val FROM users WHERE id = NEW.user_id;
  
  -- Determine operation type based on table
  operation_type := TG_TABLE_NAME;
  
  -- Portal-specific access rules
  CASE operation_type
    WHEN 'pitches' THEN
      -- Only creators can create pitches
      IF user_type_val != 'creator' THEN
        RAISE EXCEPTION 'Access denied: Only creators can create pitches (User type: %)', user_type_val;
      END IF;
      
    WHEN 'investment_deals' THEN
      -- Only investors can create investment deals (via investor_id)
      IF TG_OP = 'INSERT' THEN
        SELECT user_type INTO user_type_val FROM users WHERE id = NEW.investor_id;
        IF user_type_val != 'investor' THEN
          RAISE EXCEPTION 'Access denied: Only investors can create investment deals (User type: %)', user_type_val;
        END IF;
      END IF;
      
    WHEN 'production_deals' THEN
      -- Only production companies can create production deals
      IF TG_OP = 'INSERT' THEN
        SELECT user_type INTO user_type_val FROM users WHERE id = NEW.production_company_id;
        IF user_type_val != 'production' THEN
          RAISE EXCEPTION 'Access denied: Only production companies can create production deals (User type: %)', user_type_val;
        END IF;
      END IF;
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- INVESTMENT DEAL BUSINESS RULES
-- ================================================================================

-- Function: Validate investment deal business rules
CREATE OR REPLACE FUNCTION validate_investment_deal_rules()
RETURNS TRIGGER AS $$
DECLARE
  creator_verified boolean;
  investor_verified boolean;
  creator_subscription text;
  investor_subscription text;
  pitch_seeking_investment boolean;
  existing_deal_count integer;
BEGIN
  -- Get user verification status and subscription tiers
  SELECT company_verified, subscription_tier INTO creator_verified, creator_subscription
  FROM users WHERE id = NEW.creator_id;
  
  SELECT COALESCE(company_verified, email_verified), subscription_tier 
  INTO investor_verified, investor_subscription
  FROM users WHERE id = NEW.investor_id;
  
  -- Check if pitch is seeking investment
  SELECT seeking_investment INTO pitch_seeking_investment
  FROM pitches WHERE id = NEW.pitch_id;
  
  -- Rule 1: Pitch must be seeking investment
  IF NOT pitch_seeking_investment THEN
    RAISE EXCEPTION 'Business rule violation: Pitch is not currently seeking investment';
  END IF;
  
  -- Rule 2: Investment amount validation
  IF NEW.investment_amount IS NOT NULL THEN
    -- Minimum investment check
    IF NEW.investment_amount < 1000 THEN
      RAISE EXCEPTION 'Business rule violation: Minimum investment amount is €1,000 (Proposed: €%)', NEW.investment_amount;
    END IF;
    
    -- Maximum investment check (reasonable limit)
    IF NEW.investment_amount > 50000000 THEN
      RAISE EXCEPTION 'Business rule violation: Investment amount exceeds maximum limit of €50,000,000';
    END IF;
    
    -- Verification required for large investments
    IF NEW.investment_amount > 100000 THEN
      IF NOT creator_verified THEN
        RAISE EXCEPTION 'Business rule violation: Creator verification required for investments over €100,000';
      END IF;
      
      IF NOT investor_verified THEN
        RAISE EXCEPTION 'Business rule violation: Investor verification required for investments over €100,000';
      END IF;
    END IF;
  END IF;
  
  -- Rule 3: Equity percentage validation
  IF NEW.equity_percentage IS NOT NULL THEN
    IF NEW.equity_percentage <= 0 OR NEW.equity_percentage > 100 THEN
      RAISE EXCEPTION 'Business rule violation: Equity percentage must be between 0.1%% and 100%% (Proposed: %)', NEW.equity_percentage;
    END IF;
  END IF;
  
  -- Rule 4: Subscription tier restrictions
  IF creator_subscription = 'free' AND NEW.deal_state IN ('term_sheet', 'legal_review', 'funding') THEN
    RAISE EXCEPTION 'Business rule violation: Creator paid subscription required for advanced deal stages (Current stage: %)', NEW.deal_state;
  END IF;
  
  -- Rule 5: Prevent duplicate active deals
  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO existing_deal_count
    FROM investment_deals
    WHERE pitch_id = NEW.pitch_id 
    AND investor_id = NEW.investor_id
    AND deal_state NOT IN ('completed', 'cancelled');
    
    IF existing_deal_count > 0 THEN
      RAISE EXCEPTION 'Business rule violation: An active investment deal already exists between this investor and pitch';
    END IF;
  END IF;
  
  -- Rule 6: State transition validation
  IF TG_OP = 'UPDATE' AND OLD.deal_state != NEW.deal_state THEN
    -- Validate state transition is allowed
    IF NOT is_valid_deal_state_transition(OLD.deal_state::text, NEW.deal_state::text) THEN
      RAISE EXCEPTION 'Business rule violation: Invalid state transition from % to %', OLD.deal_state, NEW.deal_state;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Check valid deal state transitions
CREATE OR REPLACE FUNCTION is_valid_deal_state_transition(
  from_state text,
  to_state text
) RETURNS boolean AS $$
BEGIN
  -- Define valid transitions
  RETURN CASE from_state
    WHEN 'inquiry' THEN to_state IN ('nda_required', 'due_diligence', 'cancelled')
    WHEN 'nda_required' THEN to_state IN ('nda_signed', 'cancelled')
    WHEN 'nda_signed' THEN to_state IN ('due_diligence', 'cancelled')
    WHEN 'due_diligence' THEN to_state IN ('negotiation', 'cancelled')
    WHEN 'negotiation' THEN to_state IN ('term_sheet', 'cancelled')
    WHEN 'term_sheet' THEN to_state IN ('legal_review', 'cancelled')
    WHEN 'legal_review' THEN to_state IN ('funding', 'cancelled')
    WHEN 'funding' THEN to_state IN ('completed', 'cancelled')
    WHEN 'completed' THEN to_state = 'completed' -- No changes allowed
    WHEN 'cancelled' THEN to_state = 'cancelled' -- No changes allowed
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- PRODUCTION DEAL BUSINESS RULES
-- ================================================================================

-- Function: Validate production deal business rules
CREATE OR REPLACE FUNCTION validate_production_deal_rules()
RETURNS TRIGGER AS $$
DECLARE
  company_verified boolean;
  company_subscription text;
  creator_verified boolean;
  pitch_seeking_production boolean;
  existing_deal_count integer;
BEGIN
  -- Get verification status
  SELECT company_verified, subscription_tier INTO company_verified, company_subscription
  FROM users WHERE id = NEW.production_company_id;
  
  SELECT COALESCE(company_verified, email_verified) INTO creator_verified
  FROM users WHERE id = NEW.creator_id;
  
  -- Check if pitch is seeking production
  SELECT COALESCE(seeking_production, true) INTO pitch_seeking_production
  FROM pitches WHERE id = NEW.pitch_id;
  
  -- Rule 1: Pitch must be available for production deals
  IF NOT pitch_seeking_production THEN
    RAISE EXCEPTION 'Business rule violation: Pitch is not available for production deals';
  END IF;
  
  -- Rule 2: Option amount validation
  IF NEW.option_amount IS NOT NULL THEN
    -- Minimum option amount based on deal type
    CASE NEW.deal_type
      WHEN 'option' THEN
        IF NEW.option_amount < 5000 THEN
          RAISE EXCEPTION 'Business rule violation: Minimum option amount is €5,000 (Proposed: €%)', NEW.option_amount;
        END IF;
      WHEN 'acquisition' THEN
        IF NEW.option_amount < 50000 THEN
          RAISE EXCEPTION 'Business rule violation: Minimum acquisition amount is €50,000 (Proposed: €%)', NEW.option_amount;
        END IF;
      WHEN 'licensing' THEN
        IF NEW.option_amount < 10000 THEN
          RAISE EXCEPTION 'Business rule violation: Minimum licensing amount is €10,000 (Proposed: €%)', NEW.option_amount;
        END IF;
    END CASE;
    
    -- Verification required for large deals
    IF NEW.option_amount > 500000 THEN
      IF NOT company_verified THEN
        RAISE EXCEPTION 'Business rule violation: Company verification required for deals over €500,000';
      END IF;
    END IF;
  END IF;
  
  -- Rule 3: Rights validation
  IF NEW.rights_territory IS NULL OR NEW.rights_duration IS NULL THEN
    RAISE EXCEPTION 'Business rule violation: Rights territory and duration must be specified';
  END IF;
  
  -- Rule 4: Option period validation
  IF NEW.deal_type = 'option' AND NEW.option_period IS NULL THEN
    RAISE EXCEPTION 'Business rule violation: Option period must be specified for option deals';
  END IF;
  
  -- Rule 5: Prevent duplicate active deals
  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO existing_deal_count
    FROM production_deals
    WHERE pitch_id = NEW.pitch_id 
    AND production_company_id = NEW.production_company_id
    AND deal_state NOT IN ('completed', 'cancelled');
    
    IF existing_deal_count > 0 THEN
      RAISE EXCEPTION 'Business rule violation: An active production deal already exists between this company and pitch';
    END IF;
  END IF;
  
  -- Rule 6: Backend percentage validation
  IF NEW.backend_percentage IS NOT NULL THEN
    IF NEW.backend_percentage < 0 OR NEW.backend_percentage > 50 THEN
      RAISE EXCEPTION 'Business rule violation: Backend percentage must be between 0%% and 50%% (Proposed: %)', NEW.backend_percentage;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- NDA BUSINESS RULES
-- ================================================================================

-- Function: Validate NDA business rules
CREATE OR REPLACE FUNCTION validate_nda_rules()
RETURNS TRIGGER AS $$
DECLARE
  requester_type text;
  creator_type text;
  existing_nda_count integer;
  pitch_exists boolean;
BEGIN
  -- Get user types
  SELECT user_type INTO requester_type FROM users WHERE id = NEW.requester_id;
  SELECT user_type INTO creator_type FROM users WHERE id = NEW.creator_id;
  
  -- Check if pitch exists and is published
  SELECT EXISTS(SELECT 1 FROM pitches WHERE id = NEW.pitch_id AND status = 'published') 
  INTO pitch_exists;
  
  -- Rule 1: Pitch must exist and be published
  IF NOT pitch_exists THEN
    RAISE EXCEPTION 'Business rule violation: Cannot create NDA for non-existent or unpublished pitch';
  END IF;
  
  -- Rule 2: Only investors and production companies can request NDAs
  IF requester_type NOT IN ('investor', 'production') THEN
    RAISE EXCEPTION 'Business rule violation: Only investors and production companies can request NDAs (User type: %)', requester_type;
  END IF;
  
  -- Rule 3: Creator must actually be a creator
  IF creator_type != 'creator' THEN
    RAISE EXCEPTION 'Business rule violation: NDA creator must be of type creator (User type: %)', creator_type;
  END IF;
  
  -- Rule 4: Cannot request NDA for own pitch
  IF NEW.requester_id = NEW.creator_id THEN
    RAISE EXCEPTION 'Business rule violation: Cannot request NDA for your own pitch';
  END IF;
  
  -- Rule 5: Prevent duplicate active NDAs
  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO existing_nda_count
    FROM enhanced_ndas
    WHERE pitch_id = NEW.pitch_id 
    AND requester_id = NEW.requester_id
    AND nda_state NOT IN ('rejected', 'revoked', 'expired');
    
    IF existing_nda_count > 0 THEN
      RAISE EXCEPTION 'Business rule violation: An active NDA already exists for this pitch and requester';
    END IF;
  END IF;
  
  -- Rule 6: State transition validation
  IF TG_OP = 'UPDATE' AND OLD.nda_state != NEW.nda_state THEN
    IF NOT is_valid_nda_state_transition(OLD.nda_state::text, NEW.nda_state::text) THEN
      RAISE EXCEPTION 'Business rule violation: Invalid NDA state transition from % to %', OLD.nda_state, NEW.nda_state;
    END IF;
  END IF;
  
  -- Rule 7: Expiry date validation
  IF NEW.access_expiry IS NOT NULL AND NEW.access_expiry <= now() THEN
    RAISE EXCEPTION 'Business rule violation: NDA expiry date cannot be in the past';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Check valid NDA state transitions
CREATE OR REPLACE FUNCTION is_valid_nda_state_transition(
  from_state text,
  to_state text
) RETURNS boolean AS $$
BEGIN
  RETURN CASE from_state
    WHEN 'pending' THEN to_state IN ('signed', 'rejected', 'expired')
    WHEN 'signed' THEN to_state IN ('approved', 'rejected', 'expired')
    WHEN 'approved' THEN to_state IN ('revoked', 'expired')
    WHEN 'rejected' THEN to_state = 'rejected' -- No changes allowed
    WHEN 'expired' THEN to_state = 'expired' -- No changes allowed
    WHEN 'revoked' THEN to_state = 'revoked' -- No changes allowed
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- PITCH ACCESS CONTROL RULES
-- ================================================================================

-- Function: Validate pitch access rules
CREATE OR REPLACE FUNCTION validate_pitch_access_rules()
RETURNS TRIGGER AS $$
DECLARE
  user_type_val text;
  pitch_owner_id integer;
  nda_approved boolean;
BEGIN
  -- Get user type and pitch owner
  SELECT user_type INTO user_type_val FROM users WHERE id = NEW.user_id;
  SELECT user_id INTO pitch_owner_id FROM pitches WHERE id = NEW.pitch_id;
  
  -- Rule 1: Owner always has access (skip other checks)
  IF NEW.user_id = pitch_owner_id THEN
    RETURN NEW;
  END IF;
  
  -- Rule 2: Check if NDA is required and approved
  IF NEW.access_level IN ('nda_signed', 'full_access') THEN
    SELECT EXISTS(
      SELECT 1 FROM enhanced_ndas 
      WHERE pitch_id = NEW.pitch_id 
      AND requester_id = NEW.user_id 
      AND nda_state = 'approved'
      AND (access_expiry IS NULL OR access_expiry > now())
    ) INTO nda_approved;
    
    IF NOT nda_approved THEN
      RAISE EXCEPTION 'Business rule violation: NDA approval required for this access level';
    END IF;
  END IF;
  
  -- Rule 3: Access expiry validation
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'Business rule violation: Access expiry date cannot be in the past';
  END IF;
  
  -- Rule 4: Access level validation
  IF NEW.access_level NOT IN ('basic', 'standard', 'nda_signed', 'full_access') THEN
    RAISE EXCEPTION 'Business rule violation: Invalid access level: %', NEW.access_level;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- USER VERIFICATION RULES
-- ================================================================================

-- Function: Validate user verification requirements
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
    -- Allow creation but warn about limitations
    RAISE NOTICE 'User created but email verification required for full platform access';
  END IF;
  
  -- Rule 3: Subscription tier validation — lookup-based (see migration 085 + issue #44).
  -- The set of valid tier IDs lives in the subscription_plans table; adding or
  -- renaming a tier requires only a migration row, not a separate trigger edit.
  IF NEW.subscription_tier IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM subscription_plans WHERE id = NEW.subscription_tier
     ) THEN
    RAISE EXCEPTION 'Business rule violation: Invalid subscription tier: %', NEW.subscription_tier;
  END IF;
  
  -- Rule 4: User type consistency
  IF NEW.user_type NOT IN ('creator', 'investor', 'production', 'viewer', 'admin') THEN
    RAISE EXCEPTION 'Business rule violation: Invalid user type: %', NEW.user_type;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- NOTIFICATION BUSINESS RULES
-- ================================================================================

-- Function: Validate notification business rules
CREATE OR REPLACE FUNCTION validate_notification_rules()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: Notification must have valid recipient
  IF NOT EXISTS(SELECT 1 FROM users WHERE id = NEW.user_id) THEN
    RAISE EXCEPTION 'Business rule violation: Notification recipient does not exist';
  END IF;
  
  -- Rule 2: Priority validation
  IF NEW.priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Business rule violation: Invalid notification priority: %', NEW.priority;
  END IF;
  
  -- Rule 3: Expiry date validation
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'Business rule violation: Notification expiry date cannot be in the past';
  END IF;
  
  -- Rule 4: Related entities must exist
  IF NEW.related_deal_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM investment_deals WHERE id = NEW.related_deal_id) THEN
      RAISE EXCEPTION 'Business rule violation: Related investment deal does not exist';
    END IF;
  END IF;
  
  IF NEW.related_production_deal_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM production_deals WHERE id = NEW.related_production_deal_id) THEN
      RAISE EXCEPTION 'Business rule violation: Related production deal does not exist';
    END IF;
  END IF;
  
  IF NEW.related_nda_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM enhanced_ndas WHERE id = NEW.related_nda_id) THEN
      RAISE EXCEPTION 'Business rule violation: Related NDA does not exist';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- RATE LIMITING AND SPAM PREVENTION
-- ================================================================================

-- Function: Prevent spam in deal creation
CREATE OR REPLACE FUNCTION prevent_deal_spam()
RETURNS TRIGGER AS $$
DECLARE
  recent_deals_count integer;
BEGIN
  -- Check for excessive deal creation (more than 5 deals per hour)
  IF TG_TABLE_NAME = 'investment_deals' THEN
    SELECT COUNT(*) INTO recent_deals_count
    FROM investment_deals
    WHERE investor_id = NEW.investor_id
    AND created_at > now() - interval '1 hour';
    
    IF recent_deals_count >= 5 THEN
      RAISE EXCEPTION 'Rate limit exceeded: Maximum 5 investment deals per hour';
    END IF;
  END IF;
  
  IF TG_TABLE_NAME = 'production_deals' THEN
    SELECT COUNT(*) INTO recent_deals_count
    FROM production_deals
    WHERE production_company_id = NEW.production_company_id
    AND created_at > now() - interval '1 hour';
    
    IF recent_deals_count >= 5 THEN
      RAISE EXCEPTION 'Rate limit exceeded: Maximum 5 production deals per hour';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Prevent NDA spam
CREATE OR REPLACE FUNCTION prevent_nda_spam()
RETURNS TRIGGER AS $$
DECLARE
  recent_ndas_count integer;
BEGIN
  -- Check for excessive NDA requests (more than 10 per day)
  SELECT COUNT(*) INTO recent_ndas_count
  FROM enhanced_ndas
  WHERE requester_id = NEW.requester_id
  AND created_at > now() - interval '24 hours';
  
  IF recent_ndas_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 10 NDA requests per day';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- AUDIT LOGGING FUNCTIONS
-- ================================================================================

-- Function: Log sensitive operations
CREATE OR REPLACE FUNCTION log_sensitive_operations()
RETURNS TRIGGER AS $$
DECLARE
  operation_log jsonb;
BEGIN
  -- Build operation log
  operation_log := jsonb_build_object(
    'table_name', TG_TABLE_NAME,
    'operation', TG_OP,
    'timestamp', now(),
    'user_id', COALESCE(NEW.user_id, NEW.investor_id, NEW.creator_id, NEW.requester_id),
    'old_data', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    'new_data', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  -- Log to audit table (create if doesn't exist)
  BEGIN
    INSERT INTO audit_log (table_name, operation, user_id, operation_data, created_at)
    VALUES (
      TG_TABLE_NAME,
      TG_OP,
      COALESCE(NEW.user_id, NEW.investor_id, NEW.creator_id, NEW.requester_id),
      operation_log,
      now()
    );
  EXCEPTION WHEN undefined_table THEN
    -- Create audit table if it doesn't exist
    EXECUTE 'CREATE TABLE IF NOT EXISTS audit_log (
      id serial PRIMARY KEY,
      table_name text NOT NULL,
      operation text NOT NULL,
      user_id integer,
      operation_data jsonb,
      created_at timestamp DEFAULT now()
    )';
    
    -- Retry insert
    INSERT INTO audit_log (table_name, operation, user_id, operation_data, created_at)
    VALUES (
      TG_TABLE_NAME,
      TG_OP,
      COALESCE(NEW.user_id, NEW.investor_id, NEW.creator_id, NEW.requester_id),
      operation_log,
      now()
    );
  END;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- APPLY TRIGGERS TO TABLES
-- ================================================================================

-- Portal access enforcement triggers
DROP TRIGGER IF EXISTS enforce_portal_access_pitches ON pitches;
CREATE TRIGGER enforce_portal_access_pitches
  BEFORE INSERT OR UPDATE ON pitches
  FOR EACH ROW EXECUTE FUNCTION enforce_portal_access_rules();

-- Investment deal validation triggers
DROP TRIGGER IF EXISTS validate_investment_deals ON investment_deals;
CREATE TRIGGER validate_investment_deals
  BEFORE INSERT OR UPDATE ON investment_deals
  FOR EACH ROW EXECUTE FUNCTION validate_investment_deal_rules();

DROP TRIGGER IF EXISTS prevent_investment_spam ON investment_deals;
CREATE TRIGGER prevent_investment_spam
  BEFORE INSERT ON investment_deals
  FOR EACH ROW EXECUTE FUNCTION prevent_deal_spam();

-- Production deal validation triggers
DROP TRIGGER IF EXISTS validate_production_deals ON production_deals;
CREATE TRIGGER validate_production_deals
  BEFORE INSERT OR UPDATE ON production_deals
  FOR EACH ROW EXECUTE FUNCTION validate_production_deal_rules();

DROP TRIGGER IF EXISTS prevent_production_spam ON production_deals;
CREATE TRIGGER prevent_production_spam
  BEFORE INSERT ON production_deals
  FOR EACH ROW EXECUTE FUNCTION prevent_deal_spam();

-- NDA validation triggers
DROP TRIGGER IF EXISTS validate_ndas ON enhanced_ndas;
CREATE TRIGGER validate_ndas
  BEFORE INSERT OR UPDATE ON enhanced_ndas
  FOR EACH ROW EXECUTE FUNCTION validate_nda_rules();

DROP TRIGGER IF EXISTS prevent_nda_spam ON enhanced_ndas;
CREATE TRIGGER prevent_nda_spam
  BEFORE INSERT ON enhanced_ndas
  FOR EACH ROW EXECUTE FUNCTION prevent_nda_spam();

-- Pitch access validation triggers
DROP TRIGGER IF EXISTS validate_pitch_access ON pitch_access;
CREATE TRIGGER validate_pitch_access
  BEFORE INSERT OR UPDATE ON pitch_access
  FOR EACH ROW EXECUTE FUNCTION validate_pitch_access_rules();

-- User verification triggers
DROP TRIGGER IF EXISTS validate_user_verification ON users;
CREATE TRIGGER validate_user_verification
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION validate_user_verification_rules();

-- Notification validation triggers
DROP TRIGGER IF EXISTS validate_notifications ON workflow_notifications;
CREATE TRIGGER validate_notifications
  BEFORE INSERT OR UPDATE ON workflow_notifications
  FOR EACH ROW EXECUTE FUNCTION validate_notification_rules();

-- Audit logging triggers (for sensitive tables)
DROP TRIGGER IF EXISTS audit_investment_deals ON investment_deals;
CREATE TRIGGER audit_investment_deals
  AFTER INSERT OR UPDATE OR DELETE ON investment_deals
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_operations();

DROP TRIGGER IF EXISTS audit_production_deals ON production_deals;
CREATE TRIGGER audit_production_deals
  AFTER INSERT OR UPDATE OR DELETE ON production_deals
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_operations();

DROP TRIGGER IF EXISTS audit_ndas ON enhanced_ndas;
CREATE TRIGGER audit_ndas
  AFTER INSERT OR UPDATE OR DELETE ON enhanced_ndas
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_operations();

DROP TRIGGER IF EXISTS audit_pitch_access ON pitch_access;
CREATE TRIGGER audit_pitch_access
  AFTER INSERT OR UPDATE OR DELETE ON pitch_access
  FOR EACH ROW EXECUTE FUNCTION log_sensitive_operations();

-- ================================================================================
-- ADDITIONAL CONSTRAINTS AND POLICIES
-- ================================================================================

-- Row Level Security policies for enhanced protection
-- Enable RLS on sensitive tables
ALTER TABLE investment_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE enhanced_ndas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pitch_access ENABLE ROW LEVEL SECURITY;

-- Investment deals RLS policy
CREATE POLICY investment_deals_access_policy ON investment_deals
  FOR ALL 
  USING (
    -- Users can only access deals they are part of
    creator_id = current_setting('app.user_id')::integer OR
    investor_id = current_setting('app.user_id')::integer OR
    -- Admins can access all
    EXISTS(SELECT 1 FROM users WHERE id = current_setting('app.user_id')::integer AND user_type = 'admin')
  );

-- Production deals RLS policy  
CREATE POLICY production_deals_access_policy ON production_deals
  FOR ALL
  USING (
    creator_id = current_setting('app.user_id')::integer OR
    production_company_id = current_setting('app.user_id')::integer OR
    EXISTS(SELECT 1 FROM users WHERE id = current_setting('app.user_id')::integer AND user_type = 'admin')
  );

-- NDAs RLS policy
CREATE POLICY ndas_access_policy ON enhanced_ndas
  FOR ALL
  USING (
    creator_id = current_setting('app.user_id')::integer OR
    requester_id = current_setting('app.user_id')::integer OR
    EXISTS(SELECT 1 FROM users WHERE id = current_setting('app.user_id')::integer AND user_type = 'admin')
  );

-- Pitch access RLS policy
CREATE POLICY pitch_access_policy ON pitch_access
  FOR ALL
  USING (
    -- Users can see their own access records
    user_id = current_setting('app.user_id')::integer OR
    -- Pitch owners can see who has access to their pitches
    EXISTS(SELECT 1 FROM pitches p WHERE p.id = pitch_id AND p.user_id = current_setting('app.user_id')::integer) OR
    -- Admins can see all
    EXISTS(SELECT 1 FROM users WHERE id = current_setting('app.user_id')::integer AND user_type = 'admin')
  );

-- ================================================================================
-- PERFORMANCE MONITORING AND HEALTH CHECKS
-- ================================================================================

-- Function: Check business rules health
CREATE OR REPLACE FUNCTION check_business_rules_health()
RETURNS TABLE(
  rule_name text,
  status text,
  details text,
  last_checked timestamp
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Portal Access Enforcement'::text as rule_name,
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'enforce_portal_access_pitches'
    ) THEN 'ACTIVE'::text ELSE 'INACTIVE'::text END as status,
    'Ensures only correct user types can perform portal-specific actions'::text as details,
    now() as last_checked
    
  UNION ALL
  
  SELECT 
    'Investment Deal Validation'::text,
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'validate_investment_deals'
    ) THEN 'ACTIVE'::text ELSE 'INACTIVE'::text END,
    'Validates investment amounts, equity, and user verification'::text,
    now()
    
  UNION ALL
  
  SELECT 
    'Rate Limiting'::text,
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name LIKE '%spam%'
    ) THEN 'ACTIVE'::text ELSE 'INACTIVE'::text END,
    'Prevents spam and abuse through rate limiting'::text,
    now()
    
  UNION ALL
  
  SELECT 
    'Audit Logging'::text,
    CASE WHEN EXISTS(
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name LIKE 'audit%'
    ) THEN 'ACTIVE'::text ELSE 'INACTIVE'::text END,
    'Logs all sensitive operations for compliance'::text,
    now();
END;
$$ LANGUAGE plpgsql;

-- Function: Get business rules violations summary
CREATE OR REPLACE FUNCTION get_business_rules_violations(
  hours_back integer DEFAULT 24
) RETURNS TABLE(
  violation_type text,
  count bigint,
  latest_occurrence timestamp
) AS $$
BEGIN
  -- This would analyze error logs to find business rule violations
  -- For now, return a placeholder structure
  RETURN QUERY
  SELECT 
    'Portal Access Violations'::text as violation_type,
    0::bigint as count,
    NULL::timestamp as latest_occurrence
  WHERE false; -- Placeholder - would be implemented with actual log analysis
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- MAINTENANCE AND CLEANUP FUNCTIONS
-- ================================================================================

-- Function: Clean up expired access records
CREATE OR REPLACE FUNCTION cleanup_expired_access()
RETURNS TABLE(
  cleaned_table text,
  records_cleaned integer
) AS $$
DECLARE
  nda_cleaned integer;
  access_cleaned integer;
BEGIN
  -- Clean up expired NDAs
  UPDATE enhanced_ndas 
  SET nda_state = 'expired'::nda_state
  WHERE access_expiry < now() 
  AND nda_state = 'approved'::nda_state;
  
  GET DIAGNOSTICS nda_cleaned = ROW_COUNT;
  
  -- Clean up expired pitch access
  UPDATE pitch_access
  SET revoked_at = now()
  WHERE expires_at < now()
  AND revoked_at IS NULL;
  
  GET DIAGNOSTICS access_cleaned = ROW_COUNT;
  
  -- Return cleanup results
  RETURN QUERY
  SELECT 'enhanced_ndas'::text, nda_cleaned
  UNION ALL
  SELECT 'pitch_access'::text, access_cleaned;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-access', '0 2 * * *', 'SELECT cleanup_expired_access();');

-- ================================================================================
-- MONITORING QUERIES
-- ================================================================================

-- View: Business rules violations dashboard
CREATE OR REPLACE VIEW business_rules_dashboard AS
SELECT 
  'Investment Deals'::text as area,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE deal_state = 'cancelled') as cancelled_count,
  ROUND(COUNT(*) FILTER (WHERE deal_state = 'cancelled') * 100.0 / NULLIF(COUNT(*), 0), 2) as cancellation_rate
FROM investment_deals

UNION ALL

SELECT 
  'Production Deals'::text,
  COUNT(*),
  COUNT(*) FILTER (WHERE deal_state = 'cancelled'),
  ROUND(COUNT(*) FILTER (WHERE deal_state = 'cancelled') * 100.0 / NULLIF(COUNT(*), 0), 2)
FROM production_deals

UNION ALL

SELECT 
  'NDAs'::text,
  COUNT(*),
  COUNT(*) FILTER (WHERE nda_state = 'rejected'),
  ROUND(COUNT(*) FILTER (WHERE nda_state = 'rejected') * 100.0 / NULLIF(COUNT(*), 0), 2)
FROM enhanced_ndas;

-- View: Portal access summary
CREATE OR REPLACE VIEW portal_access_summary AS
SELECT 
  u.user_type,
  COUNT(*) as user_count,
  COUNT(*) FILTER (WHERE u.email_verified = true) as verified_count,
  COUNT(*) FILTER (WHERE u.company_verified = true) as company_verified_count,
  COUNT(*) FILTER (WHERE u.subscription_tier != 'free') as paid_subscription_count
FROM users u
WHERE u.user_type IN ('creator', 'investor', 'production')
GROUP BY u.user_type;

-- ================================================================================
-- USAGE INSTRUCTIONS
-- ================================================================================

/*
BUSINESS RULES ENFORCEMENT IMPLEMENTATION GUIDE:

1. DATABASE DEPLOYMENT:
   - Run this script on your Neon PostgreSQL database
   - Ensure all prerequisite tables exist
   - Test with sample data

2. APPLICATION INTEGRATION:
   - Set app.user_id session variable for RLS policies
   - Handle business rule exceptions gracefully
   - Log validation failures for monitoring

3. MONITORING:
   - Use check_business_rules_health() to verify system status
   - Monitor business_rules_dashboard view for issues
   - Set up alerts for high violation rates

4. MAINTENANCE:
   - Run cleanup_expired_access() regularly
   - Review audit logs for suspicious activity
   - Update business rules as requirements change

5. TESTING:
   - Test each portal's access restrictions
   - Verify state transition validations
   - Test rate limiting functionality
   - Validate RLS policies work correctly

Example usage:

-- Check system health
SELECT * FROM check_business_rules_health();

-- View business metrics
SELECT * FROM business_rules_dashboard;

-- Clean up expired records
SELECT * FROM cleanup_expired_access();

-- Set user context for RLS (in application)
SELECT set_config('app.user_id', '123', true);

*/