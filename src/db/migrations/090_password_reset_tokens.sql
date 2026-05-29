-- 090_password_reset_tokens.sql
-- The forgot-password flow (handlers/auth-password.ts) upserts into
-- password_reset_tokens, but the table was never created in prod, so the
-- INSERT failed and no reset email was ever sent. Create it to match the handler:
--   INSERT (id, user_id, token, expires_at) ... ON CONFLICT (user_id) DO UPDATE
--   SELECT user_id, expires_at WHERE token = $1 AND expires_at > NOW()
-- user_id is UNIQUE so the ON CONFLICT (user_id) upsert works (one live token per user).

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
