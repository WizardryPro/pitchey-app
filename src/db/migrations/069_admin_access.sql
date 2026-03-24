-- Migration 069: Add admin_access system
-- Allows any user to have additive admin access alongside their primary portal role

ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_access BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_invite_pending BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_invited_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_invited_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_accepted_at TIMESTAMPTZ;

-- Seed existing demo admins
UPDATE users SET admin_access = true WHERE email IN ('admin@pitchey.com', 'alex.creator@demo.com');

-- Seed Karl's pending invite
UPDATE users SET admin_invite_pending = true WHERE id = 1045;

-- Partial index for fast admin lookups
CREATE INDEX IF NOT EXISTS idx_users_admin_access ON users (admin_access) WHERE admin_access = true;
