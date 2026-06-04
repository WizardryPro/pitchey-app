# Scope — Production workspace + NDA model (Karl-aligned)

**Date:** 2026-06-04 (revised to Karl's model)
**Status:** SCOPE ONLY — no code. Awaiting confirm on the one flagged decision (NDA scope) before Phase 1.

## Karl's intent (the model we're aligning to)

1. **Only producers can sign NDAs.**
2. A production company that has signed an NDA can **view all** of a pitch's Feasibility, Team, and Notes — but **not edit** them.
3. **The team *behind* the pitch edits the workspace.** A producer shares a join code (B3); creators redeem it to become seated members of the producer's company team; that team (producer + joined creators) builds the Feasibility/Team/Notes on the producer's pitches.

So there is **ONE canonical production workspace per pitch**, owned/edited by the pitch's company team, and **read-only** to NDA-signed producers. This *replaces* the earlier "each viewing company keeps its own private silo" idea.

---

## Current state (verified)

- `production_notes(user_id, pitch_id, content, category, author, shared, …)`, `production_checklists` + `production_team_assignments` each `UNIQUE(user_id, pitch_id)` → **private per person**.
- Write gate `canWriteProductionData`: **any** production user OR seated member of pitch owner's company team. (The blanket "any production user can write" is what lets *external* producers edit — must change.)
- NDA: `signNDA` requires `Permission.NDA_SIGN` ("investors/production can sign"); `canRequestNDA` blocks only `watcher`. So **creators + investors + production** can currently request/sign.
- Frontend `ProductionPitchView`: Team/Notes view-gated `isOwner || hasSignedNDA || isCompanyMember`; checklist editable only by `isOwner`; reads hit per-user endpoints (so an external producer sees their own empty set, not the pitch's).
- B3 substrate (097): `teams(owner_id, is_company_team, join_code, seat_limit)`, `team_members(team_id, user_id, role∈owner|editor|viewer|member)`.

---

## Target — two workstreams

### A. NDA: producers only  ⚠ needs one confirm (see Decisions)

- `signNDA`, `requestNDA`, `canRequestNDA`: gate to `userType === 'production'`. Creators/investors/watchers → `canRequest:false` / 403.
- RBAC: tighten `Permission.NDA_SIGN` to production role only (today investors hold it).
- Frontend: the "Request NDA Access" CTA shows only for production users; others see a "NDA access is for production companies" note instead of a dead button.

### B. Production workspace: ONE canonical set per pitch

| | Today | Target |
|---|---|---|
| Key | `(user_id, pitch_id)` | `(pitch_id)` — one canonical set; `author_id` on notes for attribution |
| Edit | any producer + pitch-owner's members | **pitch owner + seated members of the pitch owner's company team** only |
| View | per-user (sees own) | **the pitch's canonical set**, to: editors + NDA-signed producers (read-only) |

- New authz helpers:
  - `canEditPitchWorkspace(sql, userId, pitchId)` = `userId == pitch.user_id` OR member (`role IN ('owner','editor','member')`) of the team owned by `pitch.user_id`. (Drops the blanket "any production user".)
  - `canViewPitchWorkspace(...)` = `canEdit` OR NDA-signed on the pitch.
- Reads return the canonical set (`WHERE pitch_id = X`) to any viewer who passes `canView`.
- Writes upsert `ON CONFLICT (pitch_id)` (checklist/team); notes insert `(pitch_id, author_id, …)`; gated by `canEdit`.

---

## Migration `098_canonical_production_workspace.sql` (Phase 1)

Backward-compatible, Neon-branch first:
1. `ALTER … ADD COLUMN author_id INT REFERENCES users(id)` on `production_notes`; backfill `author_id = user_id`.
2. **Collapse to one row per pitch** for checklist/team: keep the **pitch owner's** row if present, else most-recently-updated; delete the rest (these were external producers' private evals, no longer a concept). Preserve deleted rows in a `*_archive` table (no hard loss — D3).
3. For notes: **keep only notes authored by the pitch's team** (owner + its members); archive external-producer notes. (D3)
4. Swap constraints: drop `UNIQUE(user_id,pitch_id)` → add `UNIQUE(pitch_id)` on checklist + team. Index `production_notes(pitch_id)`.
5. Keep `user_id` one release (reversibility), drop later.

## Handler changes (`production-pitch-data.ts`)

- Replace `canWriteProductionData` with `canEditPitchWorkspace` (above) + add `canViewPitchWorkspace`.
- 3 readers: gate on `canView`, scope `WHERE pitch_id` (drop `user_id`).
- `createProductionNote`/`updateProductionChecklist`/`updateProductionTeam`: gate `canEdit`, key on `pitch_id`, `ON CONFLICT (pitch_id)`.
- `deleteProductionNote`/`toggleNoteShared`: gate `canEdit`, scope `WHERE pitch_id` (any team member; D4).
- `getCreatorPitchFeedback`: unchanged (creator sees `shared=true`).

## Frontend changes (`ProductionPitchView.tsx`)

- Compute `canEdit = isOwner || isCompanyMember`. Checklist `isOwner ? button : span` → `canEdit ? button : span`.
- Team "Save Team Configuration" + Notes "Add Note": render only when `canEdit`; NDA-signed-only producers see the populated tabs **read-only** (the whole point of Karl's ask).
- View gate stays `isOwner || hasSignedNDA || isCompanyMember`; reads now return the pitch's canonical set.
- NDA CTA: production-only (workstream A).

## Rollout (stop between phases)

- **Phase 1 — DB:** migration `098` on a Neon branch → verify → prod.
- **Phase 2 — Backend:** authz helpers + re-point 9 handlers + NDA producer gate. Deploy. Smoke: owner + a seated member co-edit one workspace; an NDA-signed external producer sees it read-only (no Save/Add); a non-NDA producer & non-producers blocked.
- **Phase 3 — Frontend:** canEdit gating, read-only render for NDA viewers, NDA CTA. Build + deploy.
- **Phase 4 — Cleanup:** drop `production_*.user_id`.

## Decisions

- **D-NDA — RESOLVED: investors + producers (no creators/watchers).** Turned out RBAC already enforced exactly this — `NDA_REQUEST`/`NDA_SIGN` are held only by INVESTOR + PRODUCTION; `requestNDA`/`signNDA` enforce them; creators have approve/reject (as owners) not sign. **Workstream A shipped** = one consistency fix in `canRequestNDA` (was watcher-only) so the can-request pre-check matches the enforcement and the UI stops offering a dead CTA to creators. Worker `a5adc372`. Verified live: creator `canRequest:false`, investor passes the role gate. No investor regression.
- D1 canonical company team when a producer owns several `is_company_team` → lowest-id + one-time demote of extras. **(default)**
- D2 auto-provision a company team for a producer who has none, on first edit. **(default: yes)**
- D3 collapsed checklist/team/external notes → archived, not hard-deleted. **(default)**
- D4 note delete → any team member. **(default)**
- D5 NDA-signed viewers stay read-only (no edit). **(Karl's explicit ask — locked)**
