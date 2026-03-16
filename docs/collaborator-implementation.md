# Pitchey Collaborator System — Implementation Guide

## Context

Build a collaborator system that lets production companies invite external team members (directors, DPs, line producers, etc.) to specific production pipeline projects with scoped access. Collaborator access is **additive** — any existing user (creator, investor, production) can also be a collaborator. This is NOT a fourth portal. Collaborators see a "My Collaborations" section within their existing portal.

### Architecture Rules
- Collaborator access is tied to `project_collaborators` rows, not user_type
- No marketplace, pitch browsing, or investor data access for collaborators
- Budget visibility per-project via `collaborator_budget_visible` boolean (default false)
- Invite tokens are 64-char crypto-random, single-use, expire after 7 days
- Every collaborator endpoint checks `project_collaborators` membership with `status = 'active'`
- Soft delete on removal (status = 'removed') — preserves audit trail

---

## Step 1: Database Migration (045_project_collaborators.sql)

Create migration file: `src/db/migrations/045_project_collaborators.sql`

```sql
-- Migration 045: Project Collaborators
-- Enables production companies to invite external team members to projects

CREATE TABLE project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES production_pipeline(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  custom_role_name VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES users(id),
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

CREATE TABLE collaborator_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES production_pipeline(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_collab_project_user
  ON project_collaborators(project_id, user_id)
  WHERE user_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX idx_collab_project_email
  ON project_collaborators(project_id, invited_email)
  WHERE status = 'pending';

CREATE INDEX idx_collab_user
  ON project_collaborators(user_id) WHERE status = 'active';

CREATE UNIQUE INDEX idx_collab_token
  ON project_collaborators(invite_token) WHERE status = 'pending';

CREATE INDEX idx_collab_activity_project
  ON collaborator_activity_log(project_id, created_at DESC);

CREATE INDEX idx_collab_activity_user
  ON collaborator_activity_log(user_id, created_at DESC);

ALTER TABLE production_pipeline
  ADD COLUMN collaborator_budget_visible BOOLEAN DEFAULT false;
```

---

## Step 2: Invitation Endpoints (Production Company Side)

Handler file: `src/handlers/collaborator.ts`

### Endpoints:
- `POST /api/projects/:projectId/collaborators/invite` — Send invitation
- `GET /api/projects/:projectId/collaborators` — List collaborators (owner or active collaborator)
- `DELETE /api/projects/:projectId/collaborators/:collaboratorId` — Soft remove
- `PATCH /api/projects/:projectId/collaborators/:collaboratorId` — Update role
- `POST /api/projects/:projectId/collaborators/:collaboratorId/resend` — Resend invite

All require auth. Invitation management requires project ownership.

---

## Step 3: Invite Acceptance Endpoint

### POST /api/collaborate/accept
- Look up by invite_token WHERE status = 'pending'
- Check 7-day expiry
- Verify authenticated user's email matches invited_email
- Set user_id, status='active', accepted_at
- Notify project owner

---

## Step 4: Collaborator Read Endpoints

Auth helper: `isProjectCollaborator(userId, projectId)`

- `GET /api/my/collaborations` — List all active collaborations
- `GET /api/my/collaborations/:projectId` — Project detail (budget filtered)
- `GET /api/my/collaborations/:projectId/checklist` — Checklist with role matching
- `GET /api/my/collaborations/:projectId/notes` — Chronological notes
- `GET /api/my/collaborations/:projectId/activity` — Paginated activity log

---

## Step 5: Collaborator Write Endpoints

- `PATCH /api/my/collaborations/:projectId/checklist/:itemId` — Toggle checklist (role-enforced)
- `POST /api/my/collaborations/:projectId/notes` — Add note with category
- `GET /api/my/collaborations/:projectId/messages` — Project thread messages
- `POST /api/my/collaborations/:projectId/messages` — Send message + WebSocket

---

## Step 6: Frontend — InviteCollaboratorModal

Production portal → Pipeline Project → Team tab
- InviteCollaboratorModal: email + role + custom role
- CollaboratorList: avatar, name/email, role badge, status, actions

---

## Step 7: Frontend — AcceptInvitePage

Route: `/collaborate/accept?token=xxx`
- Unauth → redirect to signup with redirect param
- Auth → accept invite → show project summary → navigate to project

---

## Step 8: Frontend — CollaborationsDashboard

Route: `/collaborations`
- "My Collaborations" nav item in ALL three portals (hidden if count=0)
- Card grid: project title, stage, role, owner, completion %, milestone

---

## Step 9: Frontend — CollaborationProjectView

Route: `/collaborations/:projectId`
5 tabs: Overview, Checklist, Notes, Team Chat, Activity

---

## Step 10: Email Integration

- Invite email via Resend
- Acceptance notification to project owner

---

## Frontend Service Layer

`frontend/src/services/collaborator.service.ts` with all API methods using `credentials: 'include'`
