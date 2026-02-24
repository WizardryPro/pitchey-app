-- Migration 041: Email logs and file storage tracking
-- Supports 5G monitoring (email audit trail) and 5F security (file quota enforcement)

-- Email send logging for audit and deliverability tracking
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_type VARCHAR(50),
  provider VARCHAR(20) NOT NULL DEFAULT 'resend',
  provider_message_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'failed', 'bounced', 'queued')),
  error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);

-- File storage tracking per user for quota enforcement
CREATE TABLE IF NOT EXISTS file_storage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_key VARCHAR(512) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100),
  bucket VARCHAR(100) NOT NULL DEFAULT 'uploads',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, file_key)
);

CREATE INDEX IF NOT EXISTS idx_file_storage_user ON file_storage(user_id);

-- View for quick per-user storage usage
CREATE OR REPLACE VIEW user_storage_usage AS
SELECT
  user_id,
  COUNT(*) AS file_count,
  COALESCE(SUM(file_size), 0) AS total_bytes
FROM file_storage
GROUP BY user_id;
