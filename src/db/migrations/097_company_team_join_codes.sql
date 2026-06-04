-- 097_company_team_join_codes.sql
-- B3: Company-team join codes. A production company shares a reusable join code;
-- a creator redeems it to become a seated 'member' of the company team, gaining
-- the company's Team/Notes access WITHOUT a per-pitch NDA ("creators work FOR the
-- production company"). Extends the live teams/team_members substrate rather than
-- the per-project collaborator system or the point-to-point team_invitations flow.

BEGIN;

-- 1. Company-team columns on teams
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS join_code       VARCHAR(12) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seat_limit      INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_company_team BOOLEAN NOT NULL DEFAULT false;

-- A join code is globally unique (a creator redeems it with no team context).
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_join_code
  ON teams(join_code) WHERE join_code IS NOT NULL;

-- 2. 'member' role for seated creators. Postgres can't ALTER a CHECK in place,
--    so drop + recreate with the expanded set.
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner', 'editor', 'viewer', 'member'));

-- 3. Provenance: which code a member joined through (cheap, aids rotation/audit).
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS invited_via_code VARCHAR(12) DEFAULT NULL;

-- 4. Mark existing production-owned teams as company teams (generalized rather
--    than hardcoding the single current team id, so future production teams are
--    covered too). Runs AFTER the column exists in this same transaction.
UPDATE teams SET is_company_team = true
  WHERE owner_id IN (SELECT id FROM users WHERE user_type = 'production');

COMMIT;
