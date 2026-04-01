CREATE TABLE IF NOT EXISTS referral_invites (
  id SERIAL PRIMARY KEY,
  code VARCHAR(12) NOT NULL UNIQUE,
  inviter_id INTEGER NOT NULL,
  inviter_name VARCHAR(255),
  email VARCHAR(255),
  redeemed_by INTEGER,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_invites_code ON referral_invites(code);
CREATE INDEX IF NOT EXISTS idx_referral_invites_inviter ON referral_invites(inviter_id);
