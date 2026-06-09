# Decision: collapse the draft → marketplace path — 2026-06-09

**Status:** Decided (A) + implemented
**Trigger:** Karl R3 P2. Round-2 fixed the "where's my pitch" *messaging* but left two
competing draft actions, which confused the first real tester.

## Current states & transitions (verified against prod)

`SELECT status, COUNT(*) FROM pitches GROUP BY status` (2026-06-09):

| status | count | notes |
|--------|------:|-------|
| `draft` | 10 | default on create (`createPitch` inserts `'draft'`) |
| `published` | 9 | the ONLY status the marketplace shows (`searchPitches` filters `status='published'`) |
| `active` | 1 | legacy (2025-11-15) — not produced by current code; invisible to the marketplace |
| `under_review` | **0** | **nobody is in it** |

Who sets/reads what:
- **create** → `'draft'`.
- **ManagePitches "Submit for review"** (`submitForReview`) → `'under_review'`. **Dead-end:**
  there is no reviewer/moderation process, and the marketplace ignores `under_review`. A pitch
  sent here simply disappears from the creator's reach-the-market path.
- **ManagePitches "Publish"** (`toggleStatus` → `pitchService.publish` → `POST /api/pitches/:id/publish`)
  → `'published'`; this is what actually lists a pitch. It also calls `invalidateBrowseCache()`
  (round-2 prefix sweep).
- **marketplace** (`searchPitches`) reads `status='published'` only.

So a creator faced **two buttons on a draft** — a green "Submit for review" (→ a dead-end
state) and a separate "Publish" — with no signal that only the latter reaches the marketplace.

## Options

- **A) Single-action publish (chosen).** Drafts get one CTA: "Publish to marketplace". Remove the
  "Submit for review" button for creators. Keep `under_review` in the enum (future moderation)
  but route nothing to it. Keep unpublish (published → draft).
- **B) Keep both, auto-promote `under_review` → `published`.** Defeats the purpose; rejected.
- **C) Status quo with better labels.** Already confused a real tester; rejected.

## Decision: **A.** No data migration needed — `under_review` is empty, so nothing is stranded.
The single legacy `active` row is out of scope (separate legacy-status cleanup; it's invisible
to the marketplace and harmless).

## Implementation
- ManagePitches: removed the draft "Submit for review" button + the now-unused `submitForReview`
  handler. Drafts now show a single primary **Publish** action (green); published pitches keep
  Unpublish. `POST /api/pitches/:id/publish` already busts the browse cache, so a freshly
  published pitch is visible immediately (round-2 made the search path uncached + the cache
  invalidation a prefix sweep).
- Not introducing any moderation/approval system — out of scope.
