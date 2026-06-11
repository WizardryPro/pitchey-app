# Production Portal — Last-Sprint Scope (2026-06-04)

**Author:** Principal eng / docs architect (consolidation of 7 specialist reports + first-party verification)
**Status:** READ-ONLY analysis. No code changed in this session. Production files are being edited concurrently by another session — see owner-session flags in §7.
**Verification:** All load-bearing claims below were re-checked against the live Neon schema (`psql`) and the live source on `fix/portal-in-portal-browse`. Confidence is annotated where specialists disagreed.

---

## 1. Executive summary

Karl (a `user_type='production'` user, logged into the production portal) reports three problems. After consolidating all seven specialist reports and verifying against live schema/code:

- **B1 (follow/like/share missing)** is **two things wearing one costume**. The `!isOwner` hiding of Like/Follow/Contact on *your own* pitch is **correct and intended** — confirmed unanimously by 5 specialists. The *real* defect underneath is that **the owner has no Edit affordance at all** (no Edit button on `ProductionPitchView`, no Edit link on `ProductionDashboard` cards) and a **secondary `isLiked`/full-data fetch gap** — `ProductionPitchView` only upgrades to the authenticated endpoint when `hasSignedNDA` is already true, so a production user's like-state never paints. Confidence: **high**.
- **B2 (edit throws an error)** is **a frontend redirect bug, not a backend error**. The backend `PUT /api/creator/pitches/:id` correctly accepts production users and saves. But `PitchEdit.tsx:62` hardcodes the post-save redirect to `/creator/pitches`, which is `userType==='creator'`-gated in `App.tsx`, so a production user is bounced to `/login/creator` — experienced as "the edit threw an error / lost my work." The save actually succeeded. Confidence: **high** (verified line 62 + the route guard). A **separate, silent, lower-severity** bug rides along: every `updatePitch` call fails its `pitch_versions` snapshot INSERT (schema mismatch) and swallows the error — versioning is quietly dead.
- **B3 (team/notes → seat/invite codes so creators work FOR a production company)** is a **feature, not a bug**. The Team tab today is a free-text JSONB crew board with zero connection to any membership system. The platform has **three** overlapping invite/collaboration backends (collaborator/`project_collaborators`, `referral_invites`, and a dead SQLi-riddled `TeamAPI`), and the cleanest path is to **extend the live `teams`/`team_members` infrastructure** with a shareable join code + a `member` role. Confidence: **high** on the gap analysis; the schema target below resolves a contradiction between two specialists (see §3).

**The whole sprint is small in code terms.** B1+B2 are ~4 frontend edits + 1 worker SQL fix. B3 is one ~20-line migration + ~3 new endpoints + a Team-tab sub-section. The expensive items are the cloud-architecture must-dos (§4) and security gates (§5) that are independent of Karl's bugs but block a clean launch.

---

## 2. Karl's bugs — confirmed root causes + ordered fix plan

> **Cross-cutting confirmation first.** All seven reports independently confirmed: `ProductionPitchView.tsx:125` computes `isOwner` correctly, and Like (`:571`), Contact (`:597`), Follow (`:675`) are `!isOwner`-gated by design. Share (`:607`) is always visible. The backend `updatePitch` (`worker-integrated.ts:6201`) accepts `['creator','production']` and `PRODUCTION` has `PITCH_EDIT_OWN`. **The bugs are entirely in (a) missing owner UI affordances and (b) a hardcoded creator-portal redirect.** None of B1/B2 is a backend authz failure.

### Ordered fix plan

| # | Fix | Severity | Confidence | File:line |
|---|-----|----------|-----------|-----------|
| F1 | Portal-aware post-save redirect in PitchEdit (the actual B2) | **high** | high | `frontend/src/pages/PitchEdit.tsx:62` |
| F2 | Add Edit button on `ProductionPitchView` (owner affordance) | **high** | high | `frontend/src/portals/production/pages/ProductionPitchView.tsx` (~`:607`) |
| F3 | Add Edit link on `ProductionDashboard` pitch card | **high** | high | `frontend/src/pages/ProductionDashboard.tsx:~1213` |
| F4 | Fix `pitch_versions` snapshot INSERT (silent failure on every edit) | medium | high (schema verified) | `src/worker-integrated.ts:6402` |
| F5 | Drop the `hasSignedNDA` gate on the authenticated fetch (B1 `isLiked`) | medium | high | `frontend/src/portals/production/pages/ProductionPitchView.tsx:158` |
| F6 | (Optional) numeric `:id` guard in `updatePitch` | low | medium | `src/worker-integrated.ts:~6271` |

---

#### F1 — B2 root cause: hardcoded `/creator/pitches` redirect (DO THIS FIRST)

**Verified.** `PitchEdit.tsx:62` reads exactly `const pitchesListPath = '/creator/pitches';` and the three navigate calls (post-save, back, cancel) all use it. `App.tsx` gates `/creator/*` on `userType === 'creator'`, redirecting others to `/login/creator`. Backend save succeeds; the redirect is the failure.

`PitchEdit` already imports `usePortalTheme` but never reads the user object. Derive the path from `userType`:

```diff
 import { usePortalTheme } from '@shared/hooks/usePortalTheme';
+import { useBetterAuthStore } from '@/store/betterAuthStore';

 export default function PitchEdit() {
   const navigate = useNavigate();
   const theme = usePortalTheme();
+  const { user } = useBetterAuthStore();
   const { id } = useParams<{ id: string }>();
   ...
-  const pitchesListPath = '/creator/pitches';
+  const pitchesListPath =
+    user?.userType === 'production' ? '/production/pitches' :
+    user?.userType === 'investor'   ? '/investor/pitches'   :
+    '/creator/pitches';
```

`/production/pitches` already exists (`App.tsx:590` → `ManagePitches`). No backend change. **This single edit resolves B2 as Karl experiences it.**

> Note (worker-debugger open Q): `pitchService.update()` posts to `PUT /api/creator/pitches/:id` regardless of portal; the portal-agnostic `PUT /api/pitches/:id` is also registered. Switching the frontend to the agnostic route is a nice cleanup but **out of scope this sprint** — F1 fixes the user-visible bug without it.

#### F2 — Add Edit button to ProductionPitchView (owner affordance; the real B1)

`Edit3` is imported (`:10`) but never rendered. Add an owner-gated button in the header action bar (after Share, ~`:607`):

```tsx
{isOwner && (
  <button
    onClick={() => navigate(`/production/pitches/${id}/edit`)}
    className="flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
  >
    <Edit3 className="h-4 w-4 sm:mr-1.5" />
    <span className="hidden sm:inline">Edit</span>
  </button>
)}
```

> ⚠️ **Owner-session flag:** `ProductionPitchView.tsx` is listed as a file the OTHER session is actively editing. Coordinate F2 + F5 + the B3 Team-tab gate change (§3) so they land as one coherent diff, not three conflicting ones.

#### F3 — Add Edit link to ProductionDashboard pitch card

The card (~`:1213`) shows only View Details / Analytics / Manage Media — no edit path, so today the only way to reach `/production/pitches/:id/edit` is typing the URL (which then hits the F1 bug). Add:

```tsx
<Link
  to={`/production/pitches/${pitch.id}/edit`}
  className="flex-1 text-center py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
>
  Edit
</Link>
```

> ⚠️ **Owner-session flag:** `ProductionDashboard.tsx` is on the other session's edit list. Confirm the card markup before patching — line numbers will drift.

#### F4 — pitch_versions snapshot INSERT fails silently on every edit

**Verified against live schema.** `pitch_versions` columns are `(id, pitch_id, version_number NOT NULL, title NOT NULL, content NOT NULL jsonb, changes_summary, created_by, created_at)`. The INSERT at `worker-integrated.ts:6402` targets `(pitch_id, title, logline, short_synopsis, long_synopsis, rating_average, rating_count, pitchey_score_avg)` — **six of those columns do not exist**, and `version_number`/`content` (both `NOT NULL`) are not supplied. So the INSERT throws every time and is swallowed by the `console.error('pitch_versions snapshot failed:')` catch at `:6416`. The pitch saves fine; only versioning is dead.

Rewrite to match the real schema (derive `version_number`, pack the fields into `content` jsonb):

```sql
INSERT INTO pitch_versions (pitch_id, version_number, title, content, created_by)
SELECT
  $1,
  COALESCE((SELECT MAX(version_number) FROM pitch_versions WHERE pitch_id = $1), 0) + 1,
  $2,
  $3::jsonb,
  $4
```

params: `[u.id, u.title ?? null, JSON.stringify({ logline: u.logline, short_synopsis: u.short_synopsis, long_synopsis: u.long_synopsis, rating_average: u.rating_average, rating_count: u.rating_count, pitchey_score_avg: u.pitchey_score_avg }), authResult.user.id]`

> Race note: `UNIQUE(pitch_id, version_number)` means concurrent edits to the same pitch can collide on `MAX+1`. At current scale this is fine; add `ON CONFLICT (pitch_id, version_number) DO NOTHING` if it ever matters. Keep the surrounding try/catch — but consider routing the catch through `safeQuery`/Sentry instead of a bare `console.error` so the next regression isn't invisible.

> ⚠️ **Owner-session flag:** `src/worker-integrated.ts` is the most-edited file in the tree and the other session is in it. Line `6402` *will* move. Match on the INSERT text, not the line number.

#### F5 — B1 secondary: production users never get `isLiked`/full data

**Verified at `ProductionPitchView.tsx:158`:** the upgrade to the authenticated endpoint only fires when `response.hasSignedNDA` is truthy — but the public endpoint (`getPublicById`) doesn't emit `hasSignedNDA`, so the branch is effectively dead for non-NDA pitches. Result: `isLiked` is always false; the heart never shows filled even after a successful like, and the owner's authenticated fields never load. Fix: when authenticated, always attempt the authenticated endpoint and fall back to public on error.

```diff
-        if (isAuthenticated && authUser?.userType === 'production' && response.hasSignedNDA) {
+        if (isAuthenticated && authUser?.userType === 'production') {
           try {
             const fullResponse = await pitchAPI.getById(parseInt(id!));
             response = fullResponse;
           } catch (authError) {
-            // Fall back to public data if authenticated request fails
+            // Fall back to public data if authenticated request fails (e.g. no NDA)
           }
         }
```

> Confidence note: DB specialist (high) and DevOps (high) both flagged this; frontend specialist treated B1 as own-pitch-only. Reconciled: the own-pitch hiding is correct (no fix), AND the `isLiked` fetch gate is a real defect (F5). Both are true.

> ⚠️ **Owner-session flag:** same file as F2 — bundle them.

#### F6 — Optional hardening (low)

DB specialist proposes a `/^\d+$/` guard on `params.id` in `updatePitch` before the ownership lookup, mirroring `getPitch`. Defensive only; no confirmed repro. Defer unless trivial.

---

## 3. Production business architecture — seat/invite codes (B3)

### Goal
A production company shares a **shareable join code**; a creator redeems it and becomes a **seated member** of that company's team, gaining access to the company's Team/Notes surfaces **without a per-pitch NDA**. "Creators work FOR the production company."

### Contradiction resolved (two specialists disagreed on the substrate)
- **DB specialist** proposed extending **`team_invitations`** (add `invite_code`, `max_uses`, role `creator`).
- **Backend architect** proposed extending **`teams`** (add `join_code`, `seat_limit`, `is_company_team`) + a `member` role on `team_members`.
- **Security auditor** noted the **collaborator/`project_collaborators`** backend is the strongest *existing* implementation but is **per-project**, not company-wide, and is a half-decommissioned orphan.

**Resolution (high confidence):** adopt the **architect's `teams` model**. Reasons: (1) the join code is a property of the *company team* (a broadcast, reusable code), not of a point-to-point *invitation* row — putting it on `team_invitations` forces an awkward "invitation with no invitee." (2) `teams`/`team_members` is live with registered routes and parameterized queries (`src/handlers/teams.ts` + `src/db/queries/teams.ts`); the collaborator system is per-project and currently orphaned (§5). (3) Keep `team_invitations`' existing email-invite flow untouched for named hires — join codes are a parallel, lower-friction path.

**Verified ground truth (this session):**
- `teams` has **no** `join_code` / `seat_limit` / `is_company_team` columns. `team_members_role_check` allows **only** `owner|editor|viewer` — no `member`. (Architect's migration `UPDATE teams SET is_company_team=true WHERE id=2` would silently no-op against a column that doesn't exist yet — the `ALTER` must run first in the same migration; it does.)
- One production team exists: `Stellar Pictures Team`, `owner_id=3`, one `owner` member.
- `users.organization_id` exists, no `organizations` table, all NULL — leave it alone (do not introduce a second source of truth).

### Target schema (migration `097_company_team_join_codes.sql`)

```sql
BEGIN;

-- 1. Company-team columns on teams
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS join_code       VARCHAR(12) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seat_limit      INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_company_team BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_join_code
  ON teams(join_code) WHERE join_code IS NOT NULL;

-- 2. 'member' role for seated creators (drop+recreate; Postgres can't ALTER a CHECK in place)
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner','editor','viewer','member'));

-- 3. Provenance on the join (optional but cheap)
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS invited_via_code VARCHAR(12) DEFAULT NULL;

-- 4. Mark the one existing production team canonical (runs AFTER the column is added)
UPDATE teams SET is_company_team = true WHERE id = 2;

COMMIT;
```

> Migration safety: `ALTER TABLE team_members DROP CONSTRAINT` takes a brief table lock — at current scale (1 row) it's instantaneous, but run it on a Neon branch first, then prod, per the standard runner (`scripts/migrate.mjs`, `schema_migrations`). **Migration must be applied before the Worker code that references `join_code` deploys** — the deploy-preflight CI gate enforces this ordering.
> Do **not** add a `production_notes.company_user_id` column this sprint (DB specialist, medium confidence) — out of scope; the `shared` flag + the §5 access gate cover the launch need.

### Workflow
1. **Generate (one-time, production company):** Karl → Settings → Team → "Generate Join Code." Backend creates/fetches the `is_company_team=true` team, sets `seat_limit` from his tier, writes an 8-char code, returns it. Karl shares it off-platform.
2. **Redeem (creator, repeatable up to `seat_limit`):** Creator → Settings → "Join a Production Company" → enters code → `POST /api/teams/join`. Atomic seat check, insert `team_members(role='member')`.
3. **Access:** `GET /api/pitches/:id` returns a new `isCompanyMember` boolean. Frontend Team/Notes gate becomes `isOwner || hasSignedNDA || isCompanyMember`.
4. **Manage:** roster + remove (existing endpoints), rotate code on leak (re-generate invalidates the old one).

### API surface
| Method/Path | Status | Purpose |
|---|---|---|
| `POST /api/teams/:id/generate-code` | **new** | Owner generates/rotates an 8-char code (crypto.getRandomValues, Crockford-style alphabet, no O/0/I/1). Validates owner + `user_type='production'` + `is_company_team`. |
| `POST /api/teams/join` | **new** | Creator redeems. Atomic seat check (see security note). 409 already-member / 403 seats-full / 404 bad-code. |
| `GET /api/teams/:id/code` | **new** | Owner reads current code + seat count/limit. |
| `DELETE /api/teams/:id/code` | **new** | Nullify code (leak response) without rotating. |
| `GET /api/pitches/:id` | **modify** | Add `isCompanyMember` via one `EXISTS` subquery — no new endpoint, no second fetch. |
| `GET /api/teams/:id`, `GET /api/teams/:id/members`, `DELETE /api/teams/:teamId/members/:memberId` | **exists** | Roster view/remove. |

`isCompanyMember` subquery (indexed, <1ms):
```sql
EXISTS(SELECT 1 FROM team_members tm JOIN teams t ON t.id = tm.team_id
       WHERE t.owner_id = $pitch_owner_id AND tm.user_id = $requesting_user_id AND tm.role = 'member')
```

### Migration plan (sequence)
1. Apply `097` on a Neon branch → smoke → apply on prod main (runner + CI gate).
2. Ship Worker with the 4 new endpoints + `isCompanyMember` on `getPitch`. Enforce seat limits **at the application layer** by tier (`{production:3, production_plus:10, production_unlimited:-1}`), stored in `teams.seat_limit`.
3. Frontend: Team tab gains a "Company Team" sub-section (roster + Generate/Copy code) — **same tab, new heading**, do NOT add a 5th tab. Creator portal gains a "Join a Production Company" input. Flip the Team/Notes gate to include `isCompanyMember`.

> ⚠️ **Owner-session flag:** the Team-tab gate change touches `ProductionPitchView.tsx` (same file as F2/F5) and `worker-integrated.ts` (same file as F4). Land B3 frontend after B1/B2 to minimize conflict churn.

---

## 4. Cloud architecture — this sprint vs post-launch

### MUST do this sprint (launch blockers / latent prod failures)
1. **Finish the Neon cold-start retry.** The just-shipped 530/1016 retry only wraps `WorkerDatabase.query()`; **~27 hot-path `getSql()` sites still hit the raw `neon()` client and 500 on a cold start.** This is the *same bug class that was just "fixed."* Either migrate those 27 to `this.db.query()` or wrap `getSql()`'s client with the retry. (Code change, no migration.)
2. **Fix the localhost n8n webhook.** `wrangler.toml:218` sets `N8N_WEBHOOK_URL=http://localhost:5678/...`; every video upload does an awaited `fetch()` to it → connect-refuse/hang in prod. Unset it in prod vars (code guards on presence) or move it to `ctx.waitUntil`.
3. **Resolve queue producer/consumer mismatch.** 5 queue producers declared, only `VIDEO_PROCESSING_QUEUE` is written, **no consumer exists**. Messages accumulate and silently drop. Either add the consumer or remove the `.send()` + 4 unused producers + the job-queue cron.
4. **Decide Hyperdrive: use it or remove it.** Bound (`wrangler.toml:162`) but the live constructor uses `env.DATABASE_URL` directly — dead weight + a credential-rotation footgun (rotating Neon pw while forgetting the bound Hyperdrive copy → confusing edge 500s). Route through it or remove the binding + the orphan `pitchey-db` config.
5. **Back up secret VALUES + run one rollback drill.** `wrangler secret` is write-only with **no backup** (the documented biggest DR gap). Vault all values now (low effort). Run one supervised `wrangler rollback` + Pages rollback before launch — you are shipping Stripe-live traffic and an untested rollback is worse than none. (This also satisfies the orchestrator-agent Phase D.4 gate (b).)

### POST-launch
- Enable R2 versioning on `pitchey-ndas` + `pitchey-pitches` first (legally-sensitive; RPO is currently infinity).
- Audit the container/`ENABLE_CONTAINERS` crons (parked feature burning invocations?).
- Adopt canary/versioned Worker deploys (single Worker = whole-API blast radius).
- Verify Upstash Redis degrades **open** (cache-miss → DB, rate-limiter doesn't fail-closed on a Redis blip).

---

## 5. Security findings

> All four B3-adjacent findings below were first-party verified this session.

| # | Finding | Severity | Status | Fix |
|---|---|---|---|---|
| S1 | **Collaborator notes leak owner's PRIVATE notes.** `getCollaborationNotes` (`collaborator.ts:768`) selects `production_notes WHERE pitch_id = …` with **no `shared = true` filter** — verified. Any seated collaborator reads casting/budget/schedule notes the owner marked private. | **high** | confirmed live | Add `AND (shared = true OR user_id = ${Number(userId)})`. |
| S2 | **Unauthorized note/team/checklist writes.** `createProductionNote` (`production-pitch-data.ts`) keys purely on `userId` + path `pitchId` with **no NDA/ownership gate** — verified. Any production user can attach (and `shared=true`-publish) notes onto *any* pitch id. **Live evidence:** `production_notes` row id=6 was written by creator user 1025 onto pitch 213 (owned by production user 3). | medium | confirmed live | Gate writes on `EXISTS(ndas …) OR EXISTS(pitches WHERE id=$p AND user_id=$u)`; 403 otherwise. |
| S3 | **Decommissioned collaborator backend still fully live.** Commit `ea0f4c43` ripped the *frontend* projects/pipeline UI but left **all collaborator routes registered** (20 references verified in `worker-integrated.ts`) and `production_pipeline` rows in the DB. Reachable attack surface with no UI/monitoring — and the exact surface B3 might "revive" under a false "this is new code" assumption. | medium | confirmed live | Explicit decision: park (comment out the `register()` calls) **or** revive-with-fixes (S1/S2 first). Given we chose the `teams` substrate for B3 (§3), **park it.** |
| S4 | **`src/api/teams.ts` `TeamAPI` — SQL injection in every method, plus an owner-transfer escalation primitive.** String-interpolated SQL throughout. **Verified `new TeamAPI(` = 0 callers** — dead, so prod impact is contained, but it's a loaded gun for any "consolidate the two team impls" refactor. | high (if wired) | dead, confirmed | **Delete the file.** Removes the SQLi, the escalation footgun, and the consolidation hazard in one move. |
| S5 | **Referral codes guessable + credit-farmable.** `generateInviteCode` (`worker-integrated.ts:20733`) uses `Math.random()` (non-crypto); `redeemInvite` grants 5 credits with no per-user cap; `getInvite` returns invitee **email** to any authenticated caller. | medium | confirmed | crypto.getRandomValues; one bonus/redeemer lifetime; drop `email` from the response; rate-limit redeem. |
| S6 | **Team invite role is client-controlled + trusted on accept.** `acceptInvitation` inserts the stored role with no re-validation; an editor can mint editor invites. DB CHECK is the only backstop. | medium | confirmed | Re-derive/cap grantable role server-side on accept; never above inviter's role; never `owner` via invite. |

**New-feature security requirements for B3 (carry into §3 build):**
- `POST /api/teams/join` seat check must be **atomic** (TOCTOU): single `INSERT … WHERE (SELECT COUNT(*) … role='member') < seat_limit`, check rows-affected; 403 if 0.
- Restrict redeem to `user_type='creator'` (or decide explicitly whether watchers/investors may join).
- `isCompanyMember` grants Team/Notes on **all** of the company's pitches by design — document it, and ensure company-internal (`shared=false`) notes are visible to `isOwner || isCompanyMember` only, never to NDA-signed investors (this is also the S1 fix surface).

---

## 6. Observability gaps + fixes

| # | Gap | Fix |
|---|---|---|
| O1 | **Cloudflare Observability MCP returns API errors** — no CLI path to query 100%-sampled logs; this session's diagnosis was static-analysis + `wrangler tail` only. | Rotate/re-scope the CF MCP token (likely expired or missing Workers Logs read). Until fixed, use `npx wrangler tail pitchey-api-prod --format json`. |
| O2 | **No portal dimension in Sentry** — can't filter Karl's (production) errors from creators'. | Add a `portal=production` Sentry tag on requests from production users. Cheap, high diagnostic value, and unblocks O1's blind spot. |
| O3 | **`fetchPitchData` catch blocks swallow `authError`/`publicError` silently** (`ProductionPitchView.tsx:163,167`). The exact reason a pitch "shows no buttons" can be page-load failure that never reaches Sentry. | `Sentry.captureException` in those inner catches (or route through `safeQuery`-style reporting). |
| O4 | **`pitch_versions` snapshot fails on every edit but only `console.error`s** (F4). A whole feature is dark with no alert. | After F4's schema fix, route the surrounding catch through Sentry, not a bare console log. |
| O5 | **E2E smoke (`e2e/smoke-regression.spec.ts`) uses pre-in-portal-browse URLs.** After the `fix/portal-in-portal-browse` change, production browse lands at `/production/browse` → `/production/pitch/:id` (ProductionPitchView), not `/pitch/:id` (PitchDetail). Like/Follow selector tests may pass/fail for path reasons unrelated to the real bug. | Point production-user E2E paths at `/production/browse` → `/production/pitch/:id`. Confidence: medium. |

---

## 7. Prioritized backlog (P0 / P1 / P2)

> **Owner-session note:** another session is concurrently editing `ProductionPitchView.tsx`, `ProductionDashboard.tsx`, `PitchEdit.tsx`, `App.tsx`, and `src/worker-integrated.ts`. Every item touching those files is flagged ⚠️. Match edits on text, not line numbers (they will drift). A deploy ships the **whole shared tree** — both sessions' changes go out together; coordinate before deploying.

### P0 — fix this sprint (Karl's bugs + launch blockers)
- **F1** Portal-aware redirect in `PitchEdit.tsx:62` — *the* fix for B2. ⚠️ shared file. **Lowest-risk, highest-impact; do first.**
- **F2** Edit button on `ProductionPitchView` (owner B1 affordance). ⚠️ shared file (bundle with F5 + B3 gate).
- **F3** Edit link on `ProductionDashboard` pitch card. ⚠️ shared file.
- **F4** Fix `pitch_versions` INSERT in `updatePitch`. ⚠️ shared file (match on INSERT text).
- **S1** Add `shared`/own-author filter to `getCollaborationNotes` — **private-note leak, security P0.**
- **S4** Delete `src/api/teams.ts` (dead SQLi). Not a shared file — safe to do independently.
- **Cloud-1** Finish the 27-site cold-start retry gap — same bug class just "fixed," still 500s on cold start. ⚠️ shared file.
- **Cloud-2** Unset/repoint `N8N_WEBHOOK_URL` (per-upload prod failure). `wrangler.toml`.
- **Cloud-5** Vault secret values + run one rollback drill (pre-Stripe-live-launch DR).

### P1 — this sprint if capacity, else immediately post-launch
- **F5** Drop `hasSignedNDA` gate on authenticated fetch (B1 `isLiked`). ⚠️ shared file (bundle with F2).
- **B3** Company seat/invite codes: migration `097` + 4 endpoints + Team-tab "Company Team" sub-section + creator "Join" input. ⚠️ shared files; land after B1/B2. Includes atomic seat check + S2-style write gate.
- **S2** NDA/ownership gate on `createProductionNote`/`updateProductionTeam`/`updateProductionChecklist`.
- **S3** Park the orphaned collaborator routes (comment out `register()` calls) — decided against revival since B3 uses `teams`.
- **Cloud-3** Queue consumer-or-remove. **Cloud-4** Hyperdrive use-or-remove.
- **O1** Restore CF Observability MCP token. **O2** Sentry `portal` tag.

### P2 — post-launch
- **S5** Referral code crypto + farming caps + PII removal. **S6** Server-side role cap on invite accept.
- **F6** numeric `:id` guard in `updatePitch`.
- **O3/O4** Sentry on swallowed fetch + version-snapshot catches. **O5** E2E path update.
- R2 versioning (NDAs/pitches first); container-cron audit; canary deploys; Redis degrade-open verification.
- Tech-debt: `pitches` dual `user_id`/`creator_id` columns (in sync via trigger; future single-column cleanup); migrate `production_team_assignments` JSONB → relational `team_members`.

---

### Confidence & contradictions ledger
- **B1 own-pitch hiding is correct** — 5 specialists agree; the "real bug" is missing Edit UI (F2/F3) + the `isLiked` fetch gate (F5). **High.**
- **B2 is frontend redirect, not backend error** — worker + DB + frontend + DevOps all agree; backend save verified to succeed. **High.**
- **B3 substrate = `teams` (not `team_invitations`, not the per-project collaborator system)** — resolved in §3; **high** on the gap, **medium-high** on the model choice (the architect's reasoning is sound and the collaborator system's per-project + orphan status disqualifies it for a company-wide feature).
- **`pitch_versions` broken** — schema verified first-party. **High.**
- **All six security findings** — code + live data verified first-party this session. **High** on S1/S2/S3/S4; **medium** on S5/S6 (severity depends on abuse appetite).
