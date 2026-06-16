-- 106_pitch_comments_is_anonymous.sql
-- Per-comment author choice: post with username shown (default) or anonymously.
-- Anonymous comments still store user_id (owner can see + moderation); the flag
-- only governs how the author is displayed to non-owner viewers.
ALTER TABLE pitch_comments
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;
