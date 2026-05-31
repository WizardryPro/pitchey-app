# Client Bug Inventory — Karl's session (2026-05-30)

Single source of truth for every symptom the client reported. Status tracked here so nothing is lost or re-litigated. **Root rule: a fix is not "done" until verified in a real browser AND deployed to prod.**

## Why it kept feeling unresolved
API-layer tests passed (backend was fine) while the **UI layer** stayed broken, and frontend fixes were not deployed to prod — so the client kept seeing the same bugs. Verification must be at the client's layer (browser on prod), not a green API test.

## Symptoms & status

| # | Symptom (client's words) | Layer | Root cause | Fix | Verified (local UI) | Deployed to prod |
|---|---|---|---|---|---|---|
| 1 | Rating won't save | frontend | `feedback.service.ts` checked `res.data?.success` (always undefined after unwrap) → returned false | `res.success` | ✅ ("Rating submitted!" + persists, pitch 229) | ☐ |
| 2 | Duplicated `Cavell_is_the_comic_title` under header | frontend | (a) `MultipleFileUpload` renders filename twice; (b) `PitchDetail` renders title in `<h1>` and `<h2>`. Source = AI image filename `..Cavell_is_the_comic_title..png` on pitch "At Ever Las" (id 229) | conditional `originalName` on `isRenamed`; remove duplicate `<h2>` | ✅ (title renders once, pitch 229) | ☐ |
| 3 | Can't post a picture / cover image | frontend | `CreatePitch` stored image as `{file,uploadId,preview}` not raw `File` → schema `instanceof File` fails → "Invalid image file" blocks submit | store raw `File` | ✅ (pitch 1413 created w/ cover on local build) | ☐ |
| 4 | Forced to upload all documents | frontend | Same as #3 — stuck on image error; docs are actually optional (`v.optional`) | (covered by #3) | ✅ (docs optional confirmed in UI) | ☐ |
| 5 | **Script downloadable BEFORE NDA signed** (SECURITY) | backend | `serveMediaFile` (`/api/media/file/:path`) was in `publicEndpoints` → zero auth; `token` param cosmetic. `getPublicPitch`/`getPitch` leaked raw `script_url`/`pitch_deck_url`/`trailer_url`. | gate `serveMediaFile` on `pitch_documents.requires_nda` (default-open; covers stay public via lead's corrected classification — `pitch-images/`+`pitches/<id>/media` covers NOT force-authed); strip protected URLs unless owner/NDA | ☐ (needs worker deploy + MUST verify covers don't break) | ☐ |
| 6 | Genre "forgotten" | frontend | `pitch.service.ts` create/update did `...?? input.genre.toLowerCase()` → "Action-Comedy"→"action-comedy"; `PitchEdit` `<select>` can't match → "Select a genre". (Live path: CreatePitch.tsx:405 uses this service.) | drop `.toLowerCase()`; case-insensitive read-back in PitchEdit | ☐ | ☐ |
| 7 | "Won't let him upload any documents" | frontend | On create form "Upload All" called `uploadFile` w/o pitchId → file in R2 + credits charged but `pitch_documents` link skipped → orphaned, fake success. `DocumentUploadHub` had `deferUploads` but didn't pass to `MultipleFileUpload`. | thread `deferUploads` down; defer doc uploads until post-create | ☐ | ☐ |
| 8 | New pitch invisible/undeletable right after create | backend | NOT Redis: (a) `creatorPitchesHandler` sent `Cache-Control: private,max-age=30` → browser served stale list 30s; (b) `deletePitch` ran DELETE w/o `RETURNING`, Neon HTTP returns `rows:[]` → **always 404** (all deletes broken) | (a) `no-store`; (b) add `RETURNING id` | ☐ (needs worker deploy) | ☐ |

## FINAL STATUS (verified on canonical prod pitchey-5o8.pages.dev)
All 8 reported bugs FIXED + DEPLOYED (worker `02f0a516`+, frontend `DxN8bR4i`) + pushed to PR #137:
1. Rating saves ✅ ("Rating submitted!" persists, pitch 229)
2. Title/filename duplication ✅ (renders once)
3. Cover image upload ✅ (pitch created w/ cover, prod)
4. Documents not forced ✅ (optional)
5. Script NOT downloadable pre-NDA ✅ (anon 401, authed-non-signer 403, owner/signer OK, covers public 200)
6. Genre persists ✅ (created "Action-Comedy", edit page shows "Action-Comedy" selected)
7. Documents upload + attach ✅ (deferred w/ pitchId, lands in uploads/<uid>/)
8. New pitch visible immediately ✅ + pitch DELETE works ✅ (204)

### Discovered during verification (adjacent bugs)
- **#9 Edit page couldn't load DRAFTS** — `PitchEdit` used `getById()` → `/api/pitches/public/:id` which 404s for drafts. FIXED → `getByIdAuthenticated()` (`/api/pitches/:id`). Verified: edit page loads draft, genre populated. ✅ deployed.
- **#10 Format Category/Subtype not preserved create→edit (Save disabled)** — FIXED ✅. Three parts: (a) `CreatePitch` now sends `formatCategory`/`formatSubtype` in the create payload (was only sending `format`; backend already had the columns); (b) `transformPitchData` maps `format_category`/`format_subtype` snake→camel so PitchEdit can read them; (c) PitchEdit reverse-derives category/subtype from the stored `format` string (case-insensitive) for OLDER pitches that have null category/subtype. Verified on prod: edited existing pitch 229 — Format Category "Television - Scripted" + Subtype "Limited Series (closed-ended)" repopulated, Save enabled, save round-tripped (Updated 30/05/2026). frontend `BW9if8C0`.

## Notes / observations during testing
- Credits pill fix already deployed (shows "500", not "—"). ✓
- Cover image upload uses `POST /api/creator/pitches/:id/media` AFTER pitch create (`POST /api/pitches`). Documents may differ.
- Observed: freshly created pitch 1413 not returned by `GET /api/creator/pitches` and DELETE 404'd — possible Redis list-cache lag on new pitches. Watch (separate from above).
- Test pitch 1413 ("SMOKE-TEST DELETE ME image-fix verify") created on prod — needs cleanup via SQL.

## Local verification harness
`wrangler pages dev dist/` on :8788 (same-origin Pages proxy → prod API), login via same-origin fetch (bypasses Turnstile). Lets us drive the REAL UI with local fixes against real prod data before deploying.

## Session 2 — deep verification + observability (autonomous)
Verified live on canonical prod, cross-checked against Cloudflare Workers observability (no false positives — each confirmed by real action + log):
- **Rating** (#1) re-verified: pitch 262, "Rating submitted!" ✅
- **Comment submit** (#11) FIXED: `submitComment` used `res.data?.success` (backend returns `{success,data:<row>}`) → always false → comments looked broken though saved. Now `res.success`. Deployed + pushed (b7b4bf82).
- **NDA signer access** (#13) FIXED: `ndas WHERE signer_id=$2 OR requester_id=$2` threw whole query (`requester_id` column absent) → legit signers wrongly 403'd. Now probes each column separately. Verified: sarah (signer on 1408) gets the script 200; anon 401. Worker 4281d550→.
- **Add Character** (#12) WORKS end-to-end: form opens, validates (Name + Description ≥10 chars — submit stays DISABLED until valid, which is the "won't let me add" UX), character persists to backend (pitch 1430 → characters=[{name:"Jane Doe"}]). Backend createPitch persists `characters`; getPitch returns it.
- **Observability**: zero non-cron error events 17:45–19:35Z while exercising rating/comment/character/create/edit/delete/NDA. Only recurring error = pre-existing `No such module "db"` CRON (not user-facing) — open follow-up.

### Still to sweep (continuing autonomously)
- Public/anonymous route: structured feedback + comment gated by 30s consumption gate that never opens for guests on PublicPitchView (view tracking requires isAuthenticated). Investigate/fix.
- Every portal's clickable actions (investor/production/watcher dashboards, messaging, NDAs, slates, portfolio, settings) with observability capture.
- main branch sync (post-#137 commits: ndas + comment fixes not yet on main; deployed to prod directly).

## Session 2 (cont.) — verified live + loop plan
- **Credits → payment screen**: VERIFIED WORKING live. Credit purchase ("Purchase Credits") AND subscription upgrade ("Upgrade to Creator+") both navigate to live Stripe checkout (`checkout.stripe.com/c/pay/cs_live_…`). Full chain frontend→worker→Stripe proven. Worker payments logs all 200/info, zero errors. NOT a current regression.
- **Comment submit** (#11) deployed (frontend RnrfQgTb) + pushed (b7b4bf82).
- main sync: PR #138 opened with post-#137 fixes (ndas signer, comment), auto-merge enabled.

### Karl request: "project document upload on create new" — PLAN (execute w/ browser verify)
CreatePitch.tsx currently uses `DocumentUploadHub` (was swapped FROM `DocumentUpload` per "Karl feedback #6", CreatePitch.tsx:19). Karl now wants the edit-page `DocumentUpload` (categorized Project Documents) on create. NOT a 1-line swap because:
1. `DocumentUploadHub` bundles BOTH document upload AND the NDA settings radios + AI-disclosure (via onNDAChange). Replacing it would drop the NDA UI on create → regression. Must keep NDA + AI-disclosure section.
2. Document upload on create works via `uploadManager.setDocumentUploads(files)` fed by DocumentUploadHub.onFilesSelected, then `uploadManager.executeUploads(pitchId)` after create. `DocumentUpload` only calls `onChange(DocumentFile[])` → `handleDocumentChange` (CreatePitch.tsx:297) which only `setValue('documents', …)` — does NOT feed the upload manager. So swapping naively = documents never upload (regress the #7 fix).
Correct impl: (a) render `<DocumentUpload documents={formData.documents} onChange={handleDocumentChange} maxFiles={15} maxFileSize={10} enableDragDrop showPreview showProgress />` for the document area; (b) in `handleDocumentChange`, also `uploadManager.setDocumentUploads(documents.filter(d=>d.file).map(d=>d.file))` so deferred upload still fires on create; (c) keep the NDA + AI-disclosure UI (extract from DocumentUploadHub or render the NDA radios separately with onNDAChange→handleNDADocumentChange). Verify on prod: create a pitch with a PDF via the new component → confirm it lands in uploads/<uid>/ and shows on the pitch.

### Verified-green so far (live prod, browser + observability)
rating, comment, NDA gate (signer 200/anon 401/non-signer 403/covers public), add-character (persists), genre, edit draft load, edit format/genre repopulate + Save, pitch create/delete, credits+subscription→Stripe checkout. Zero non-cron worker errors.

## Session 2 (cont.) — portal route sweep (chrome MCP + observability)
Creator portal, clicked through with console+network capture:
- /creator/dashboard — 25 reqs all 200, console clean ✓
- /creator/messages — all 200, clean ✓
- /creator/ndas — all 200, clean ✓ (note: real route is /creator/ndas, not /creator/nda-management)
- **FIX #14 — input-validation 500s**: a bad /creator/:username path forwarded "nda-management" as a userId → `/api/pitches?userId=nda-management` → 500; and `/api/pitches/NaN` → 500. Non-numeric ids hit int columns → "invalid input syntax for integer". Fixed both: getPitches invalid userId → empty 200; getPitch non-numeric :id → 404. Verified live (worker 6692a587): NaN→404, bad userId→200 empty, valid→200. Pushed 7414804b.

Remaining sweep: creator marketplace/following/portfolio/profile/settings/analytics/slates/team/collaborations/legal; investor/production/watcher portals; public route; + doc-upload-on-create (planned).

## Session 2 (cont.) — "only works for me" ROOT CAUSE + silent-error audit
- **#15 STALE SERVICE WORKER (the "works for me not the client" root cause)** — FIXED + verified. Earlier app versions registered /sw.js, /service-worker.js, /sw-mobile.js (precached index.html+assets). Current app registers none, but RETURNING users still had the old SW active → it served cached stale index.html (old asset hashes → old JS) → NONE of the deployed frontend fixes reached them, while a fresh browser saw them. Replaced all 3 SW files with a kill-switch (purge caches + unregister + reload controlled tabs on next update check ≤24h) + no-cache headers. VERIFIED live: registered old caching SW (cache static-cache-v1.0.0), deployed kill-switch, forced update → registrations=0, caches=[], controller=null. Pushed a3766a7d. **This likely explains why Karl kept seeing old behaviour.**
- **Silent-error audit** (user concern: observability can't catch silent UI failures): grepped all services for the `res.data?.success`/double-unwrap anti-pattern. Result: the apiClient (unwrapping) silent-false class was contained to feedback.service (rating/comment — fixed; remove() is fine — DELETE returns bare {success:true}). The Legal Documents components' `response.data?.success` checks are CORRECT — they use the axios `api` (lib/api.ts) where response.data is the raw body. No new silent-false bugs found.
- Systemic catch going forward: silent frontend failures (return false, no throw) are invisible to Cloudflare obs + Sentry; only UI-level assertions catch them. The chrome-MCP route sweep is that net manually; action smoke tests assert outcomes at API layer.

## Session 2 (cont.) — CREATOR PORTAL sweep COMPLETE (chrome MCP, all routes)
All real creator routes clicked through, console + network captured — ALL clean (200, no console errors):
dashboard, messages, ndas, profile, settings, portfolio, analytics, slates, following, marketplace, team/members, collaborations, legal/library.
- Only bug found in creator portal = the input-validation 500 (#14, fixed): verified holding — /creator/team etc. (unknown /creator/:creatorId paths) now return 200-empty for /api/pitches?userId=<word> (was 500); only /api/users/<word> 400 remains (correct — no such user). Minor UX note: /creator/<unknown> renders a near-empty broken CreatorProfile (400) — edge case from bad URLs, low priority.
- Remaining: investor, production, watcher portals; public/anonymous route; + doc-upload-on-create.

## Session 3 (2026-05-31) — doc-upload-on-create + standard-NDA, verified end-to-end

Three client-reported bugs, each verified live on pitchey-5o8.pages.dev (browser → worker → Neon), test pitches cleaned up after.

- **#16 Project documents on create didn't attach + double-charged** — FIXED (commit c2f3389d, frontend). Karl: docs on create should use the edit-style typed boxes AND stay attached ("its not even keeping it attached"). Two bugs: (a) the shared DocumentUpload auto-uploaded each file to /api/upload with NO pitchId → orphaned in R2 (never linked to pitch_documents), charged 10 credits immediately, and set doc.url which made the create submit's re-upload filter (!d.url) skip it; (b) PitchFormSchema.DocumentFileSchema required name/PDF-only/4-type-picklist that the DocumentUpload DocumentFile shape doesn't use → submit blocked with "Invalid key: Expected 'name'". Fixes: added `autoUpload` (default true) + `pitchId` props to DocumentUpload; CreatePitch stages files (autoUpload=false) and uploads once with pitchId after create (single charge, attaches); PitchEdit passes pitchId so its in-component uploads attach directly too; manual upload buttons hidden when autoUpload=false. Made DocumentFileSchema permissive. VERIFIED: staged (no orphan upload) → POST /api/pitches → single POST /api/upload pitchId=1460 → pitch_documents row (type=script, requires_nda=t) → renders with download link on /pitch/1460.
- **#17 Standard NDA radio unselectable ("keeps forgetting the NDA")** — FIXED (commit 1bd0b044, frontend). NDAUploadSection's radios are controlled by the `ndaDocument` PROP (checked={ndaDocument?.ndaType==='standard'}), but CreatePitch rendered it WITHOUT passing ndaDocument → prop always undefined → "No NDA Required" permanently checked, standard/custom never selectable. Fix: pass `ndaDocument={ndaDocument ?? undefined}`. VERIFIED: select standard → radio stays checked → create → pitches.require_nda=t (1462) → reopen edit → "Use Platform Standard NDA" shown selected.
- **#18 Edit page couldn't toggle NDA** — FIXED (commit 5a65a552, worker 4fd30461). updatePitch's UPDATE never included require_nda in SET, so the edit form's requireNDA was silently ignored (NDA only persisted on create). Added `require_nda = COALESCE($33, require_nda)` + param; COALESCE(false,…) stores explicit false so the toggle works both ways. VERIFIED: create requireNDA=false → PUT true → DB t → PUT false → DB f (pitch 1463).

Still open (deferred — ambiguous/feature, need owner input): "show creator name" public-visibility toggle (cross-layer, hide-semantics unclear); cover-image "file shown underneath / downloadable" (the staged-doc download link is gone via #16 autoUpload=false; cover filename text is standard UX — needs Karl clarification on exact complaint).

- **#19 Credits pill was a dead button** — FIXED (commit b6787ea9, frontend). Karl: "the credits to get to the payment screen which was working before". The credits pill in MinimalHeader (live header via PortalLayout) had no onClick → clicking did nothing → no nav path to the buy-credits screen. Wired to `/${getPortalPath(userType)}/billing?tab=credits`. VERIFIED live: pill → /creator/billing?tab=credits (balance + 4 Purchase Credits packages) → Purchase Credits → Stripe LIVE checkout (cs_live_…).

## Session 3 (cont.) — creator-name toggle + follow discoverability

- **#20 "Show creator name" toggle (hide from anonymous only)** — DONE (commit 64592828, frontend + worker 2a7dbf31). Added a "Show creator name" checkbox to Public Visibility on create + edit (visibility_settings.showCreatorName, default true). Backend getPublicPitch + getPitch return "Anonymous Creator" only when viewer is anonymous (!userId) AND showCreatorName===false; signed-in viewers always see the real name; undefined→shown (existing pitches unaffected). Added parseVisibilitySettings helper + showCreatorName to valibot VisibilitySettingsSchema (v.object strips undeclared keys) + PitchEdit typed settings. VERIFIED live: pitch 230 showCreatorName=false → anonymous /public/230 renders "Anonymous Creator", authenticated /api/pitches/230 shows "Alex Creator". Reset after.
- **#21 Follow button hidden on NDA-gated pitches** — FIXED (commit 61c5eec5, frontend). Karl: "how would you follow someone — it doesn't even show how." PitchDetail's FollowButton was only inside the (hasSignedNDA || isOwner) branch, so NDA-required pitches showed "Creator info hidden — NDA required" with no follow affordance. Following is public (needs only creatorId, already exposed) — added FollowButton to the NDA-hidden branch. VERIFIED live: pitch 211 (require_nda=true, unsigned) now shows "Follow" → click → "Following" → /api/follows/stats isFollowing=true. Follow API (/api/follows/action) + status (/api/follows/stats?userId=) both confirmed working. The follow flow itself was never broken — only the button's visibility. Test follow reset.
- **#19 credits pill** (prior turn, b6787ea9) re-confirmed: portal-aware via getPortalPath(userType) in the shared MinimalHeader, so it works across all portals → billing?tab=credits → Stripe.
