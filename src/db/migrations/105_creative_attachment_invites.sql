-- Build Your Team (P1) — invitable / verifiable creative attachments.
--
-- pitch_creative_attachments is pure attribution today (name/role/bio/links). This adds
-- the invite + verification state so a creator can invite the real person (a Pitchey user
-- or an email) to confirm they're attached, turning an unverifiable claim into a
-- "verified attachment".
--
-- status:
--   'listed'   — a typed name, unverified (today's behaviour; the default/backfill)
--   'invited'  — an invite has been sent, awaiting the person's confirmation
--   'accepted' — the person confirmed → verified attachment
--   'declined' — the person declined

ALTER TABLE pitch_creative_attachments
  ADD COLUMN IF NOT EXISTS status          VARCHAR(20) NOT NULL DEFAULT 'listed',
  ADD COLUMN IF NOT EXISTS invited_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_email   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invite_token    VARCHAR(64),
  ADD COLUMN IF NOT EXISTS invited_at      TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS responded_at    TIMESTAMP WITH TIME ZONE;

-- One pending/used token per invite; partial so the many NULLs (listed rows) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pca_invite_token
  ON pitch_creative_attachments (invite_token) WHERE invite_token IS NOT NULL;

-- Fast lookup of "invites addressed to me" for the in-app accept surface.
CREATE INDEX IF NOT EXISTS idx_pca_invited_user
  ON pitch_creative_attachments (invited_user_id) WHERE invited_user_id IS NOT NULL;
