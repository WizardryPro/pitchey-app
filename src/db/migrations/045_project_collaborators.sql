-- Migration 045: Project Collaborators
-- Enables production companies to invite external team members to projects

CREATE TABLE IF NOT EXISTS project_collaborators (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES production_pipeline(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  invited_email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  custom_role_name VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  invited_by INTEGER NOT NULL REFERENCES users(id),
  invite_token VARCHAR(64) NOT NULL UNIQUE,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,

  CONSTRAINT chk_collab_status CHECK (status IN ('pending', 'active', 'removed')),
  CONSTRAINT chk_collab_role CHECK (role IN (
    'director', 'line_producer', 'dp', 'production_designer',
    'editor', 'sound_designer', 'custom')),
  CONSTRAINT chk_custom_role CHECK (
    (role = 'custom' AND custom_role_name IS NOT NULL)
    OR (role != 'custom' AND custom_role_name IS NULL))
);

CREATE TABLE IF NOT EXISTS collaborator_activity_log (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES production_pipeline(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_project_user
  ON project_collaborators(project_id, user_id)
  WHERE user_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_project_email
  ON project_collaborators(project_id, invited_email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_collab_user
  ON project_collaborators(user_id) WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_token
  ON project_collaborators(invite_token) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_collab_activity_project
  ON collaborator_activity_log(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collab_activity_user
  ON collaborator_activity_log(user_id, created_at DESC);

-- Add budget visibility toggle to production_pipeline
ALTER TABLE production_pipeline
  ADD COLUMN IF NOT EXISTS collaborator_budget_visible BOOLEAN DEFAULT false;
