-- Recipient-scoped activity events (Phase 4A — messaged attachments).
--
-- Default activity_feed rows are BROADCAST: recipient_id IS NULL, fanned out at
-- read time to the actor's followers + saved-pitch watchers. A row with a
-- recipient_id is PRIVATE: visible ONLY to that recipient (getActivityFeed gates
-- it). Used for "X shared a document with you" — messaged attachments serve
-- publicly today and must NOT widen exposure beyond the conversation participant.

ALTER TABLE activity_feed ADD COLUMN IF NOT EXISTS recipient_id INTEGER;

-- Direct-to-me lookup (the private branch of the feed query).
CREATE INDEX IF NOT EXISTS idx_activity_feed_recipient
  ON activity_feed (recipient_id, created_at DESC)
  WHERE recipient_id IS NOT NULL;
