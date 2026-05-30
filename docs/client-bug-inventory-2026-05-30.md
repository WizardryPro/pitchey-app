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

## Notes / observations during testing
- Credits pill fix already deployed (shows "500", not "—"). ✓
- Cover image upload uses `POST /api/creator/pitches/:id/media` AFTER pitch create (`POST /api/pitches`). Documents may differ.
- Observed: freshly created pitch 1413 not returned by `GET /api/creator/pitches` and DELETE 404'd — possible Redis list-cache lag on new pitches. Watch (separate from above).
- Test pitch 1413 ("SMOKE-TEST DELETE ME image-fix verify") created on prod — needs cleanup via SQL.

## Local verification harness
`wrangler pages dev dist/` on :8788 (same-origin Pages proxy → prod API), login via same-origin fetch (bypasses Turnstile). Lets us drive the REAL UI with local fixes against real prod data before deploying.
