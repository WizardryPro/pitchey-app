-- Fix: the `trigger_update_notification_count` trigger on `notifications`
-- (function update_user_notification_count) maintains an unread-count cache on
-- `users`, but the columns it writes were never added — so EVERY insert into
-- `notifications` failed with `column "notification_count" does not exist`,
-- silently breaking in-app notifications app-wide. Add the columns the trigger
-- expects (additive, idempotent).

ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_notification_read TIMESTAMPTZ;
