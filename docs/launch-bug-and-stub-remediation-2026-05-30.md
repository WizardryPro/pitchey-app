# Launch Bug & Stub Remediation — 2026-05-30

Consolidated from a 7-agent investigation into Karl's reported bugs + a full stub/placeholder audit (frontend + backend). Each item has root cause (file:line), what's already fixed, and a concrete fix plan with effort. Investigation was read-only; nothing here is fixed yet unless marked ✅.

**Branch context:** work is on `docs/coverage-notes-scope-and-next-actions` (NOT merged to `main`). Several Karl items were already partially addressed by recent commits on this branch that **are deployed but not on main**. Karl is likely testing an older `main` build — some bugs may already be fixed in the current branch. **Confirm against `https://pitchey-5o8.pages.dev` after a fresh deploy before re-triaging.**

---

## A. Karl's reported bugs

### A1. Character description capped at 200, needs 1000
**Status:** open · **Effort:** small · **Severity:** high (blocks pitch submit)

The hard gate is the valibot schema; the UI counter already says 500, so today the counter (500) and the submit gate (200) *disagree* — which itself produces "I typed a normal description and it won't save."

- `frontend/src/schemas/pitch.schema.ts:72` — `v.maxLength(200, …)` → **change to 1000** (the only must-fix).
- `frontend/src/features/pitches/components/CharacterManagement/CharacterForm.tsx` — L88-89 (`> 500`), L204 (`maxLength={500}`), L215-223 (counter thresholds + `/500`) → raise to 1000, rescale counter. (L108-109/L308 are the **relationship** field — leave at 200.)
- `frontend/src/features/pitches/utils/characterUtils.ts:13` — `MAX_LENGTH: 500` → 1000.
- Backend/DB: **no change** — `pitches.characters` is JSON, `pitch_characters.description` is `TEXT`, no length validation anywhere.

### A2. Document upload — can't upload 2 at once; "folders" do nothing
**Status:** open · **Effort:** medium · **Severity:** high

Multi-select at the OS picker works (`MultipleFileUpload.tsx:561-569` has `multiple`, loop at `:181-243`). The bug is in the **deferred hand-off** used by CreatePitch:

1. **Duplicates / wrong counts.** `DocumentUploadHub.handleFilesChange` (`DocumentUploadHub.tsx:86-96`) re-emits the *entire* pending set on every change; `CreatePitch.tsx:1418-1423` calls `uploadManager.addUpload(file)` per file with **no dedup** (`usePitchUploadManager.ts:47-64`). Adding A then B yields `[A, A, B]` → over-counts and **uploads/charges twice** (10 credits each, `worker-integrated.ts:6190`). This is why Karl fell back to one-at-a-time.
2. **Stale closure.** `MultipleFileUpload.processFiles` builds `[...files, ...processed]` off a captured `files` (`:239-243`), so rapid adds can drop/overwrite.

**Fix:**
- Dedup in `usePitchUploadManager.addUpload` by `name+size+lastModified`; OR make `onFilesSelected` authoritative (`clearUploads()` then add full list). Authoritative-list is cleaner.
- Convert `processFiles`/`onChange` to functional `setState(prev => …)`.

**Folders are decorative.** The folder radio grid (`MultipleFileUpload.tsx:94-102, 510-533`) sets a `folder` field that is **dropped on the deferred path** (`usePitchUploadManager.executeUploads` passes neither `folder` nor `documentType` — `documentType` hardcoded `'document'` at `CreatePitch.tsx:1421`). Even non-deferred, `folder` only becomes an R2 key prefix, never a column (`pitch_documents` INSERT `worker-integrated.ts:6242-6266` has no folder; `getPitch` never reads one).
- **Option 1 (make real):** thread `folder`+`category` through `PendingUpload`/`executeUploads`, add a `folder` column to `pitch_documents` (migration), include in INSERT + `getPitch` SELECT, group downloads by folder.
- **Option 2 (make honest, recommended near-term):** remove the folder radio grid; wire the per-file **category** (Script/Treatment/Pitch Deck → `document_type`, which *is* persisted) instead. Less work, more useful.

### A3. Standard NDA — back button broken, opens a new page
**Status:** open · **Effort:** small · **Severity:** medium

Both symptoms are one bug: live links open `/legal/standard-nda` in a **new tab**, where the page's `navigate(-1)` back arrow (`StandardNDA.tsx:40`) has no history to pop.

- `frontend/src/features/ndas/components/NDAUploadSection.tsx:574` — `window.open('/legal/standard-nda', '_blank')` in the **creator CreatePitch flow** (the one Karl hit).
- `frontend/src/features/ndas/components/NDAModal.tsx:277-284` — `<a target="_blank">` "View full" (NDAModal is currently orphaned — low priority).

**Fix:**
- `NDAUploadSection.tsx:574` — replace `window.open(_blank)` with an **in-page modal** that fetches `/api/ndas/standard` and renders inline with a Close button (avoids losing the half-filled CreatePitch form). The live `NDAWizard`/`EnhancedNDARequest` flows already prove the inline pattern.
- Harden `StandardNDA.tsx:40`: `onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}` so the public deep-link is never a dead end.
- (Separate content-drift finding: `EnhancedNDARequest`/`NDAPreviewModal` renders an **old hardcoded** NDA text `PitchDetail` path at `EnhancedNDARequest`/`:160-200`, not the lawyer-drafted `/api/ndas/standard` — reconcile later.)

### A4. Demo: can't find script/pitch-deck downloads
**Status:** partially fixed · **Effort:** medium · **Severity:** high

Commit `7bdb16be` fixed the **write path** + the **creator's own view** only:
- `/api/upload` now links files to `pitch_documents` (`worker-integrated.ts:6201-6270`); `getPitch` reads them back as `documents[]` (`:5822-5854`); `CreatorPitchView.tsx:631-650` renders them.

**Still broken for everyone who isn't the creator** (Karl's Demo scenario = viewer who hasn't signed an NDA):
1. `getPublicPitch` (`GET /api/pitches/public/:id`, `worker-integrated.ts:5502-5717`) was **never updated** — its whitelisted response (5633-5674) doesn't query `pitch_documents`, only exposes legacy scalar `pitch_deck_url`/`script_url`/`trailer_url`.
2. `PublicPitchView`/`ProductionPitchView`/`InvestorPitchView` call the public handler until NDA is signed, so they never receive `documents[]`.
3. Those viewer components render only `pitch.script`/`pitch.pitchDeck`/`pitch.scriptUrl` — **none render `documents[]`**.
4. Field-name mismatch: `transformPitchData` emits `script`/`pitchDeck` (`lib/api.ts:74-75`) but `PublicPitchView`/`PitchDetail` read `scriptUrl`/`pitchDeckUrl`.
5. Demo seed (`scripts/seed-demo-users.sql:79-128`) inserts pitches with **no documents at all**.

**Fix:**
- Port the `pitch_documents` read-back block from `getPitch` into `getPublicPitch` (respecting existing `is_public`/`hasNDAAccess` gating).
- Render `pitch.documents[]` (reuse `CreatorPitchView.tsx:631-650` block) in ProductionPitchView (~1237), InvestorPitchView (~987), PublicPitchView (~360), PitchDetail (~799); keep scalar slots as fallback.
- Fix the `script`/`scriptUrl` field-name mismatch in `lib/api.ts:74-75`.
- Seed ≥1 demo pitch with a `pitch_documents` row so the Demo shows the feature.

### A5. Phantom budget the creator never set
**Status:** ✅ RESOLVED — no action needed (verified) · **Severity:** medium

**UPDATE 2026-05-30:** Queried live prod — **0 rows** have `estimated_budget = 1000000`. The old hardcoded `1000000` was sent in the payload but the era's backend `createPitch` INSERT had no `estimated_budget` slot, so it was silently dropped — it never persisted. The current form injects no budget defaults (`estimatedBudget: ''`, `budgetRange: undefined`) and the budget section is hidden unless "seeking investment" is checked. So there is nothing to clean up and it won't recur. If Karl still sees a phantom budget on a NEWLY created pitch on the current build, re-investigate with that specific pitch id. The migration below is **not needed** and was not written.

<details><summary>(original analysis — superseded)</summary>


Not a live display bug — it's **persisted stale data**. Old commit `23b21dfa` shipped CreatePitch with hardcoded `estimatedBudget: 1000000` + `budgetBracket: 'Medium'`, so era-pitches saved `estimated_budget = 1000000` with no user input. Current form is fixed (`estimatedBudget: ''`, writes `?? null`); all display paths are pure null-coalescing (no injected default). `7bdb16be` made budget *editable* but doesn't clear old rows.

**Fix:** data migration —
`UPDATE pitches SET estimated_budget = NULL WHERE estimated_budget = 1000000 AND budget_range IS NULL AND budget_bracket = 'Medium'` (gated on the `23b21dfa` default signature to avoid nulling a deliberate 1,000,000). Numbered migration under `src/db/migrations/`, run via `scripts/migrate.mjs`.
</details>

### A6. Production portal "lock" on Team + another item
**Status:** likely stale deployment — no code change · **Effort:** none (verify) · **Severity:** low

**There is no lock icon or gating flag anywhere in the current production nav source.** `EnhancedProductionNav.tsx` items are plain `{label, path, icon}`; zero `Lock`/`locked`/`premium`/`comingSoon`. The items Karl points at are fully functional:
- Team/Members → `/production/team` → `TeamManagement.tsx` (345 LOC, working; backend `/api/production/team/collaborators` live).
- Verification (uses the **`Shield`** icon — most lock-like glyph) → `ProductionVerification.tsx` (680 LOC, working).

Karl is almost certainly on the **older deployed `main` build** (this branch's `165ae736` already removed dead nav like Calendar but isn't on main). **Action:** deploy current branch, then ask Karl to confirm exactly which two labels show a lock and on which screen (sidebar vs top-nav). Likely the `Shield` glyph being read as a padlock.

### A7. "Make creator pitch look like production" ✅ DONE (deployed, uncommitted)
CreatePitch now carries the production-standard fields (long synopsis, target audience, production timeline, target release date, estimated budget, visibility toggles); backend + migration 092 deployed. See [[project_pitch_create_forms]]. Still **uncommitted** on this branch. Follow-up: surface the new fields in `PitchEdit.tsx` for editing (UPDATE already COALESCEs so nothing is wiped).

---

## B. Stub audit — BACKEND (live paths only)

### CRITICAL — fake real-world side effects
- **Fake payment processor.** `src/handlers/transactions.ts:386-416` `processPayment` — `Math.random() > 0.1` fakes success, writes fake `stripe_…` id, bumps `investments.paid_amount`. LIVE via `POST /api/transactions` (`worker-integrated.ts:2442`→`:19827`). **Remove the route or replace with real Stripe PaymentIntent; drop the investment-mutation side effect.** (medium)
- **Admin moderation that doesn't persist.** `worker-modules/admin-endpoints.ts` — `handleSuspendUser:609`, `handleBanUser:671`, `handleVerifyUser:724`, `handleRestoreUser:765`, `handleMaintenanceMode:1649`, `handleBulkAction:1194`, `handleBroadcastMessage:1810` log + return random-id success, **write nothing**. (Real path exists via `PUT /api/admin/user/:id` `handleUpdateUser:555`.) **Implement real `UPDATE users`/audit writes or remove buttons.** (medium each)

### HIGH — fabricated metrics presented as real
- **DB/performance analytics** (`worker-integrated.ts` `:19874-20154`, routes `:2676-2698`): `getDatabasePerformance/QueryStats/Health/SlowQueries/Errors/EndpointPerformance/PerformanceOverview` — all hardcoded (uptime 99.99, cache 89.5%, etc.).
- **Trace metrics** (`:20419/20461/20508`, routes `:2696-2698`): `getTraceMetrics/Performance/Errors` — fake (`totalTraces: 15420`). (Sibling `getTraceDetails`/`getTraceAnalysis` are REAL.)
- **Admin stats + audit log** (`admin-endpoints.ts` `handleSystemStats:349`, `handleAuditLog:1767`) — hardcoded counts / two demo rows dated 2024-11. (Other admin dashboard/analytics handlers are real per `c41dcac7`.)
- **Recommendation:** remove or clearly label these — highest "operator trusts invented numbers" risk. (large to make real; small to remove)

### MEDIUM
- **Container/cost-optimization** endpoints (`src/workers/container-worker-integration.ts:467-492`, routes `:3501-3507`/`:14799-14849`) — empty stubs. **Hide for launch.** (large)
- **Scheduled reports** (`worker-integrated.ts:13411`) — inserts row, **nothing ever runs them**. (medium / document as inert)
- **Production talent-search tile** (`src/handlers/secure-portal-endpoints.ts:886-888`) — `return {talent_searches:0, saved_talent:0} // Placeholder`. (small)
- **Creator analytics signed-NDA count** (`src/handlers/creator-analytics.ts:692`) — `0, -- TODO`. (small)
- **stub-routes** (`src/routes/stub-routes.ts`) — `/api/production/investments/overview` + `/api/investment/recommendations` return canned zeros (LIVE). (small to remove)

### LOW / cleanup
- Stale `// STUB ENDPOINTS … TODO` comment at `worker-integrated.ts:3509` (routes beneath are now real).
- Dead `email.service.ts` SES/`sendWithResend` stubs (live send path is `worker-email.ts` Resend — real).
- `:8318` "allow requesting NDA even if pitch doesn't exist // For demo purposes" — tighten.
- Orphan route files (`routes/users.ts`, `documentation.ts`, `enhanced-upload.routes.ts`, `cache-monitoring.routes.ts`, `email-messaging.routes.ts`) + `services/notification.service.ts` push/SMS placeholders — not live; delete per existing decisions.

## C. Stub audit — FRONTEND

### SEVERITY 1 — user-facing broken/misleading
- **Production billing** (`src/portals/production/pages/ProductionSettingsBilling.tsx`): tabs are stub — `paymentMethods`/`invoices` always `[]` (L77/79), `handleSave` toasts only (L99-107), download/add/remove payment methods are coming-soon toasts (L109-122), hardcoded "Free Plan / Paid plans coming soon" (L195/207) — **misleading since Stripe is live**.
- **Investor billing**: `PaymentMethods.tsx` whole page "coming soon" (L37); `BudgetAllocation.tsx:77` "New Allocation" toast-only.
- **Coming-soon buttons** (visible, click = toast): PitchAnalytics Export (`:160`), ProductionSettingsSecurity Revoke (`:173`)/Download report (`:226`), ProductionSettingsNotifications Test (`:174`)/Verify phone (`:179`), InvestorSaved Create folder (`:292`), TeamMembers Export (`:305`)/Bulk role (`:406`)/Bulk remove (`:412`).
- **Whole sections:** `CollaborationProjectView.tsx:603-613` Team Chat "coming soon"; `InvestorSaved.tsx:203` bulk folder/status no-op.
- **Message reactions** `Messages.tsx:559-560` — "Reactions not implemented" error toast.

### SEVERITY 2 — silent/degraded
- `social.service.ts:329-399` block/report/unblock no-op stubs (no live UI yet).
- `notification.service.ts:45` `loadSounds()` no-op (sounds never play).
- `ProductionSettingsNotifications.tsx` granular sub-toggles not all sent to backend (some don't persist).

### SEVERITY 3 — orphan/dead code (delete)
`ComingSoon.tsx` (dead import App.tsx:196), `PitchValidationDemo.tsx` (mockData), `ChunkedUploadTest.tsx`, `ChunkedUploadDemo.tsx`, `test-minimal.tsx`, `EnhancedCreatorAnalytics.tsx` (orphan), `features/notifications/hooks/useNotifications.ts` (orphan, unpersisted mark-as-read).

### SEVERITY 4 — drift comments to reconcile
Sentry "temporarily removed" in `ErrorBoundary.tsx` (contradicts live sentry-config), WS notifications "temporarily disabled" `NotificationContext.tsx:48`, React Query disabled `App.tsx`. Plus `alert()`-for-UX polish debt across many pages.

---

## Progress log
- **2026-05-30 — Batch 3b (fabricated metrics) shipped:** Removed the 10 fabricated-metric endpoints (`/api/analytics/database/*`, `/api/analytics/performance/*`, `/api/traces/metrics/*`) — routes + 483 lines of dead handler methods that returned invented uptime/cache/trace numbers with no data source and no callers (verified 404 post-deploy; real `/api/traces/search|:id|:id/analysis` kept). Made the orphaned fake admin handlers real instead: `handleSystemStats` (`/api/admin/stats`) now runs real COUNT queries over users/pitches/investments/ndas (honest 0 for metrics with no source); `handleAuditLog` (`/api/admin/audit-log`) queries the real `audit_logs` table instead of 2 hardcoded 2024 demo rows. Bonus find during the sweep: `handleGetUser` (`/api/admin/user/:id`) returned hardcoded "alex.creator" demo data for *every* user id — now queries the real user. Worker `c091a57b`. Container/cost shell endpoints + scheduled-report executor still deferred (lower priority, see B-MEDIUM).
- **2026-05-30 — Batch 3 (critical integrity) shipped:** Removed the **fake payment processor** entirely — `POST /api/transactions` + `PUT /api/transactions/:id/status` (and `createTransaction`/`updateTransactionStatus`/`processPayment` in `handlers/transactions.ts`) ran a `Math.random()` 90%-success mock that could mark investments funded with no real money; zero callers, read routes kept (verified 404 on the write routes post-deploy). **Admin moderation made real:** `handleSuspendUser`/`handleBanUser`/`handleVerifyUser`/`handleRestoreUser` now persist to `users` (account_locked_until / is_active / is_verified+verification_tier) instead of logging fake success; `handleBulkAction` applies real user writes and returns an honest **501** for refunds (no Stripe payment_intent linkage — issue refunds in the Stripe dashboard) instead of faking success to the admin Transactions page. `handleMaintenanceMode` + `handleBroadcastMessage` (no UI callers, no backing tables) now return honest **501** instead of fabricated success/recipient counts. Worker `99a45ede`. NOTE: ban/unban via the live admin UI already worked (through `handleUpdateUser`); these were the unwired parallel endpoints. **Batch 3b NOT done** — fabricated-metrics endpoints (DB/performance/trace metrics, admin system-stats + audit-log) still return invented numbers; container/cost endpoints still empty shells.
- **2026-05-30 — Batch 2 shipped:** A2 (document upload) — added authoritative `setDocumentUploads` to `usePitchUploadManager` so the deferred hand-off no longer duplicates files / double-charges credits; CreatePitch now uses it. Removed the misleading "Upload to Folder" picker (folder was never persisted). A4 (downloads on viewer pages) — ported the `pitch_documents` read-back into `getPublicPitch` (so non-creator viewers get `documents[]`); new shared `PitchDocuments` component renders them in ProductionPitchView, InvestorPitchView, PublicPitchView, PitchDetail (falls back to legacy script/deck/trailer slots when empty, no duplication); fixed the `scriptUrl`/`pitchDeckUrl` field-name mismatch. `tsc` clean, backend bundles, CreatePitch/PitchDetail tests green (2 pre-existing PublicPitchView nav-button failures unrelated). Backend (worker `5703c5f3`) + frontend deployed; `documents` key confirmed live on `/api/pitches/public/:id`. NOTE: folder grouping + per-file category wiring deferred (see A2 Option 1). Demo-seed-with-documents (A4 step 4) not done.
- **2026-05-30 — Batch 1 shipped:** A1 (char limit 200→1000, all 3 sites + test), A3 (StandardNDA back-button history fallback + NDAUploadSection now opens the Standard NDA in an **in-page modal** instead of a new tab), A5 (verified no-op — 0 phantom rows, no migration). Dead-code removed: `ComingSoon`, `PitchValidationDemo`, `ChunkedUploadTest`, `ChunkedUploadDemo`, `test-minimal`, orphan `useNotifications` hook (+ their tests + the dead App.tsx import). `tsc` clean, 182 pitch/NDA tests green. Frontend-only — deployed to Pages.

## D. Suggested execution order

1. **Quick high-impact (do first, small):** A1 char limit (1000), A3 NDA back/new-tab, A5 phantom-budget migration. Frontend dead-code deletion (C-Sev3).
2. **Medium, user-facing:** A2 multi-upload dedup + folders-honest, A4 documents on viewer pages, production-billing stub → route to live `StripePortalCard`, coming-soon button sweep (implement/hide).
3. **Backend integrity:** remove/relabel fabricated-metrics endpoints (B-HIGH), remove or gate fake `/api/transactions` payment + fake admin moderation (B-CRITICAL), hide container endpoints.
4. **Verify-then-decide:** A6 production lock (deploy branch, re-confirm with Karl).
5. **Housekeeping:** commit the deployed-but-uncommitted A7 work; merge branch → main; reconcile drift comments.
