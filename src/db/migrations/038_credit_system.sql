-- Migration 038: Create credit system tables
-- Required by: payment endpoints, NDA credit checks, credit purchase/use
-- Dependencies: users table, pitches table

-- User credit balances
CREATE TABLE IF NOT EXISTS user_credits (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    total_purchased INTEGER NOT NULL DEFAULT 0,
    total_used INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credits_balance ON user_credits(balance) WHERE balance > 0;

-- Credit transaction ledger
CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'grant')),
    amount INTEGER NOT NULL,
    description TEXT,
    balance_before INTEGER,
    balance_after INTEGER,
    usage_type VARCHAR(50), -- 'nda_request', 'basic_upload', 'send_message', etc.
    pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,
    stripe_session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe ON credit_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- Seed demo accounts with starter credits
INSERT INTO user_credits (user_id, balance, total_purchased, total_used)
SELECT id, 100, 100, 0 FROM users WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com', 'stellar.production@demo.com')
ON CONFLICT (user_id) DO NOTHING;
