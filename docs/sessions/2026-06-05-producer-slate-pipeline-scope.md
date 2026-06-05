# Scope — Workspace-driven producer slate (pipeline integration)

**Date:** 2026-06-05
**Goal:** Make the production workspace state (Feasibility completeness + checklist %, Team package status, Notes, NDA) **drive** the producer's dashboard pipeline — so the deal's state is legible at a glance and the workspace stops being a passive scratchpad.

## ⚠ Guardrail — do NOT revive the parked Projects/Pipeline feature

`/api/production/pipeline` → `productionPipelineHandler` queries a heavyweight `production_pipeline` table (stages development→release, `budget_allocated/spent`, milestones, `project_collaborators`). That **Projects/Pipeline** feature was decommissioned (`ea0f4c43`) and retired from nav (`2ab42ccb`); the route is parked, not live. This scope does **not** touch it. New surface gets a distinct name (`/api/production/slate`) to avoid colliding with / reviving the parked route. The companion `/api/production/projects` family is likewise parked.

## The unit: the producer's "slate"

The producer's working set = **owned production pitches** (they created) + **saved creator pitches** (evaluating). Each gets a derived readiness state from data that ALREADY exists — no new core tables.

## 1. Readiness signals (derived, read-only) — per pitch

| Signal | Source (existing) |
|---|---|
| `completeness` (e.g. 6/9) | pitch's own fields (logline/synopsis/script/pitchDeck/budget/characters/audience/team) — same calc the Feasibility tab already does |
| `checklistPct` | `production_checklists.checklist` jsonb — canonical (owner) row for owned pitches, the producer's private row for saved creator pitches (reuse `resolveWorkspace`) |
| `rolesConfirmed / rolesTotal` | `production_team_assignments.team` jsonb — count `status='confirmed'` vs total roles |
| `hasNDA`, `notesCount`, `lastActivity` | `ndas`, `production_notes` |

## 2. Derived stage (auto-bucketing — tunable thresholds)

- **Evaluating** — saved, no NDA, no workspace activity. "Should I pursue this?"
- **Reviewing** — NDA signed OR notes/checklist started. Active due diligence.
- **Packaging** — ≥1 key role Considering/Confirmed OR checklist ≥ ~40%. Attaching talent.
- **Ready** — Director + a second key role Confirmed AND checklist ≥ ~80%. Financeable package.

Stage is a pure function of the signals above (no stored state in v1).

## 3. Backend — `GET /api/production/slate`

New handler (in `production-pitch-data.ts`, reusing `resolveWorkspace`/`hasSignedNda`). One aggregate pass:
- owned production pitches (`pitches WHERE user_id = me`) + saved pitches (`saved_pitches WHERE user_id = me`).
- LEFT JOIN the canonical/private `production_checklists` + `production_team_assignments` rows; subquery counts for notes/NDA.
- Compute `completeness`, `checklistPct`, `rolesConfirmed/Total`, `stage` per row.
- Return `{ slate: [...], counts: { evaluating, reviewing, packaging, ready } }`.
- Read-only, no schema change, no parked-table access.

## 4. Frontend — real funnel on ProductionDashboard

Replace the placeholder "Evaluation Pipeline" / "Save pitches to build your pipeline" block (`frontend/src/pages/ProductionDashboard.tsx`) with a grouped board/list:
- Sections (or kanban columns) by stage: Evaluating · Reviewing · Packaging · Ready.
- Each card: poster + title + **readiness badges** — completeness ring, `checklist 80%`, `Director ✓`, NDA pill, notes count.
- Click → the pitch's workspace (`/production/pitch/:id`).
- The existing **"Under Review"** stat card becomes accurate (= Reviewing + Packaging count) instead of a placeholder `0`.
- On-brand with the workspace pass just shipped (indigo chips, ring-1 cards, status pills).

## 5. Decision — derived-only (v1) vs manual override (v2)

- **v1 (recommended): purely derived.** Zero writes, zero schema, immediate value — the funnel reflects real workspace state automatically. No way to "park" a deal in a stage manually.
- **v2 (optional): manual stage override + drag-between-columns.** Persist a producer-set stage. `saved_pitches` already has `notes`/`tags` and `UNIQUE(user_id,pitch_id)` — add a nullable `stage` column there for saved creator pitches; a tiny `production_pitch_stage(user_id,pitch_id,stage)` for owned. Derived stage is the default; manual override wins when set. Adds a write path + drag UX.

## 6. Phasing (stop between)

- **Phase 1 — backend:** `/api/production/slate` aggregate + derived stage. Smoke against a producer with owned + saved pitches.
- **Phase 2 — frontend:** the funnel board on the dashboard + accurate stat cards.
- **Phase 3 (optional) — manual override:** stage persistence + drag.

## Value recap

This is the step that turns the workspace from *recording* a deal's state into *driving* the slate: a producer opens the dashboard and instantly sees which projects are financeable (Ready), which need talent (Packaging), which are waiting on the creator (Reviewing with low completeness), and which to triage (Evaluating) — the funnel a producer actually runs their business on.

## Open questions

- Q1: v1 derived-only, or go straight to v2 with manual drag? (Recommend v1 first.)
- Q2: Should saved creator pitches and owned production pitches share one board, or two tabs? (Recommend one board — it's the producer's whole slate.)
- Q3: Stage thresholds — tune the Packaging/Ready cutoffs to taste, or start with the defaults above?
