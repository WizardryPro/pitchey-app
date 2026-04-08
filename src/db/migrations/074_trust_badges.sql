-- Trust Badges: verification tier on users table
-- Gold: approved + all auto_checks passed
-- Silver: approved or auto_approved
-- Grey: pending verification

ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_tier VARCHAR(10) DEFAULT NULL
  CHECK (verification_tier IN ('gold', 'silver', 'grey'));

CREATE INDEX IF NOT EXISTS idx_users_verification_tier ON users(verification_tier) WHERE verification_tier IS NOT NULL;

-- Backfill existing verifications
UPDATE users u SET verification_tier = (
  CASE
    WHEN cv.status IN ('approved') AND cv.auto_checks IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_each_text(cv.auto_checks)
        WHERE key != 'checked_at' AND value NOT IN ('pass')
      )
    THEN 'gold'
    WHEN cv.status IN ('approved', 'auto_approved')
    THEN 'silver'
    WHEN cv.status = 'pending'
    THEN 'grey'
    ELSE NULL
  END
)
FROM company_verifications cv
WHERE cv.user_id::text = u.id::text;
