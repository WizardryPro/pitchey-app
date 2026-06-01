-- Activity feed: actor/action/object event store powering the Following feed.
-- One row per actor action; fan-out to followers + saved-pitch watchers happens
-- at READ time in getActivityFeed() (no per-recipient rows). This keeps writes
-- O(1) and lets the same event surface to anyone who later follows the actor.
--
-- Phase 2 of the "Following/Saved activity feed" pivot. Emitters:
--   pitch_published — POST /api/pitches/:id/publish
--   user_followed   — POST /api/follows/action (follow)
-- Readers:
--   GET /api/activity/feed (src/db/activity-feed.ts:getActivityFeed)

CREATE TABLE IF NOT EXISTS activity_feed (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    INTEGER NOT NULL,
  action      TEXT    NOT NULL,                       -- pitch_published | pitch_updated | user_followed
  object_type TEXT    NOT NULL,                       -- pitch | user
  object_id   INTEGER,
  metadata    JSONB   NOT NULL DEFAULT '{}'::jsonb,   -- denormalized title/name for cheap render
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feed read path filters by actor (followed creators) then sorts by recency.
CREATE INDEX IF NOT EXISTS idx_activity_feed_actor_created
  ON activity_feed (actor_id, created_at DESC);

-- Global recency sort / pagination.
CREATE INDEX IF NOT EXISTS idx_activity_feed_created
  ON activity_feed (created_at DESC);

-- Saved-pitch branch of the feed (object_type='pitch' AND object_id IN saved).
CREATE INDEX IF NOT EXISTS idx_activity_feed_object
  ON activity_feed (object_type, object_id);
