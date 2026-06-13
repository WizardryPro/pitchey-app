# Creator ↔ Production: how they link up

_How a creator and a production company actually connect, collaborate, and transact on Pitchey. Reference doc — reflects the live code as of 2026-06-14. Grounded in `src/worker-integrated.ts` route registrations + `src/handlers/teams.ts` / `production-pitch-data.ts` / `production-deals.ts`._

There is no single "connect" button — a creator and a production company link through **five distinct surfaces**, each for a different stage of the relationship. They compose: discovery → company team → shared workspace → deal.

---

## 1. Discovery surfaces (how they find each other)

- **Marketplace + Heat** — producers browse/search creator pitches (`/marketplace`, `/production/browse`), ranked by Heat (role-weighted: production attention counts ×4). Producers **save** pitches into their slate/pipeline.
- **Opportunities / Open Calls board** — a production company (or investor) **posts a mandate** ("Seeking grounded sci-fi features", genre/budget/region). Creators **submit** an existing pitch to it (`open_calls` + `call_submissions`). As of 2026-06-13 a new open-call notifies heat-ranked, genre-matched creators (moat plan priority #1) — _planned, verify in `calls.ts createCallHandler`_.
- **Follow** — a creator follows a producer (or vice-versa); new pitches surface in the follow feed + the notification bell (see `docs` on the watcher follow feed). Following needs **no NDA**.
- **Producer-driven acquisition loop** — producers **invite writers** to sign up and submit (the primary organic growth loop; see [[project_acquisition_loop]] in memory).

## 2. Company team membership (the durable link)

A production company is modelled as a **team** (`teams` table). A creator becomes **part of** a company two ways:

- **Join code (B3)** — the company shares a short code; the creator redeems it: `POST /api/teams/join`. They become a seated **`member`** of the team. Codes are generated/rotated/revoked by the owner: `POST /api/teams/:id/generate-code`, `GET`/`DELETE /api/teams/:id/code`. Seats are capped.
- **Email invite** — the company invites by email: `POST /api/teams/:id/invite`; the creator accepts: `POST /api/teams/invites/:id/accept` (also reject/resend/cancel). Same end state (seated member).

Membership is the gate for the shared workspace — checked via **`isCompanyMember`** (`src/handlers/teams.ts`).

## 3. Collaboration NDA (the trust gate)

On joining a company, a creator signs the **Platform Standard NDA** (lawyer-drafted, click-to-sign): `POST /api/teams/:id/collaboration-nda/sign`. Status + per-seat record: `GET /api/teams/:id/collaboration-nda` / `/members`; on-demand signed-record HTML: `/document`.

**Unsigned seated members are blocked from the workspace** (Team / Notes / Feasibility). This is distinct from the **pitch-scoped `ndas`** table (investor/production signing an NDA to unlock a specific pitch's protected content) — the collaboration NDA governs _company membership_, not a single pitch.

## 4. The shared workspace (`resolveWorkspace`)

Once a creator is a seated, NDA-signed member, they co-build the project workspace. `resolveWorkspace()` in `src/handlers/production-pitch-data.ts` decides whose workspace is shown:

- **Production-owned pitch** → ONE canonical Team / Notes / Feasibility-Checklist. Owner + seated members **edit**; NDA-signed producers who aren't members **view read-only**.
- **Creator-owned pitch** → per-producer private workspace (each collaborating producer gets their own).

Premium UI: Editor/View chips, roster cards, member NDA status.

## 5. Pitch-scoped collaboration ("collab bridge")

The lighter-weight link, for a single project rather than full company membership:

- A producer who has **saved a creator's pitch** proposes a **pitch-scoped collaboration** (Team Plan + Notes) on it.
- The creator **accepts on their own pitch view** → the producer's plan + notes become a **shared co-edit workspace** (a `resolveWorkspace` branch over the **`collaborations`** table). Endpoint surface: `GET /api/collaborations`.
- Lets a creator + producer co-develop one project without the creator joining the whole company.

## 6. The deal (where money/rights commit)

- A producer proposes a **deal** on a pitch: `POST /api/production/deals` (type/amount/backend %/territory). Stored in `production_deals`; fires a `deal_proposed` notification; contract record at `GET /api/production/deals/:dealId/contract`.
- **Gap (moat plan priority #6, not yet built):** there is **no `/api/creator/deals`** route — the creator has no in-app surface to accept/counter/reject, so the deal currently dies to email. Closing this loop (creator deal inbox + click-to-sign deal sheet) is the End-to-End Deal Continuity pillar in `docs/pitchey-moat-and-value-plan-2026-06-12.md`.

---

## End-to-end flow (the happy path)

```
Producer browses marketplace / posts an open call
   → saves a creator's pitch  OR  creator submits to the call
   → links via:  (a) join code/invite → company team member → sign collaboration NDA → shared workspace
              or (b) pitch-scoped collab bridge (accept on the creator's pitch view) → co-edit Team Plan + Notes
   → producer proposes a deal (production_deals)
   → [TODO] creator accepts/counters in a deal inbox → both click-to-sign → into production_pipeline
```

## Gating model at a glance

| Action | Requires |
|---|---|
| See a public pitch, follow the creator | nothing (free, watcher-level) |
| Unlock a pitch's protected content (synopsis, docs) | sign the **pitch NDA** (`ndas`) — investor/production only |
| Edit a company project's Team/Notes/Feasibility | seated **team member** (`isCompanyMember`) **+** signed **collaboration NDA** |
| Co-edit one project without joining the company | accept a **pitch-scoped collaboration** (`collaborations`) |
| Receive/commit to terms | **deal** (`production_deals`) — creator-side response is the open gap |

## Key tables & files

- `teams`, team join codes, invites → `src/handlers/teams.ts`, routes `worker-integrated.ts:2771–2844`
- Collaboration NDA → `worker-integrated.ts:3225–3238`, migration 099
- `resolveWorkspace` / `isCompanyMember` → `src/handlers/production-pitch-data.ts`, `teams.ts`
- Pitch-scoped collab → `collaborations` table, `GET /api/collaborations` (`worker-integrated.ts:3302`)
- Deals → `production_deals`, `src/handlers/production-deals.ts`, routes `:3070–3076`
- Related memory: [[project_company_team_join_codes]], [[project_collab_nda]], [[project_collab_bridge]], [[project_production_workspace_hybrid]], [[project_acquisition_loop]], [[project_moat_value_plan]]
