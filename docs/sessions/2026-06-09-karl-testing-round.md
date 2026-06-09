# Karl testing round — 2026-06-09

Karl tested on `https://pitchey-5o8.pages.dev`. The test notes flagged this as "the
Issue #18 orphan, NOT production" — **that's wrong**. `pitchey-5o8.pages.dev` *is* the
live production frontend (the `-5o8` suffix is permanent; the real orphan
`pitchey.pages.dev` was deleted 2026-04-21 and now NXDOMAINs — see
`project_pages_subdomain_model`). So every bug below is current, not a stale-preview
artifact.

## Shipped (PR #227, deployed — bundle `index-BxgIrNe0.js`)

| # | Fix | File(s) |
|---|-----|---------|
| P1 | PitchEdit white-screen crash on `.size` of undefined | `DocumentUpload.tsx`, `PitchEdit.tsx` |
| P2 | Document upload required two attempts | `DocumentUpload.tsx` |
| P3 | Deck/lookbook uploader label (synonym surfaced) | `DocumentUpload.tsx` |
| P5 | Removed "Total Invested" marketplace stat | `MarketplaceEnhanced.tsx` |

**P1** — `uploadStatistics` did `d.file.size`, but documents rehydrated on the **edit**
flow have no `File` (persisted as `{ url, title, … }`, `file: undefined`). The interface
lied (`file: File` required). Made `file` optional + added `size?`, null-guarded every
`.file.*` access (reduce, list render, download, dedupe, progress math). The useMemo was
the white-screen; the list render would have been the *next* crash.

**P2** — click re-entry, not a state race. The hidden `<input>` sits inside the dropzone
`<div>` whose `onClick` calls `fileInputRef.click()`. A programmatic `input.click()`
dispatches a click **on the input that bubbles back to the div's onClick → `.click()`
again** → picker opens twice, first selection swallowed. Fixed with `stopPropagation` on
the input + the "Choose Files" button.

---

## Report-only (need a decision before code)

### P3 — lookbook vs pitch deck is a *data-model* split, not a label bug

"Lookbook" and "pitch deck" are industry-synonymous, but the codebase models them as
**two distinct things in two ways at once**:

1. **Two document types** — `DOCUMENT_TYPES` in `DocumentUpload.tsx` has both
   `pitch_deck` and `lookbook`. NDA exemption is keyed on the type
   (`requiresNda: type !== 'lookbook'` in `CreatePitch.tsx:437`, `PitchEdit.tsx:446`) —
   lookbooks skip the NDA gate, pitch decks don't.
2. **Two top-level URL fields** — `pitch.pitchDeck` (`pitch_deck_url`) and
   `pitch.lookbookUrl` (`api.ts:74,158`). The creator view (`CreatorPitchView.tsx:774`)
   renders the "Pitch Deck" link from `pitch.pitchDeck` — a field that an **uploaded
   document does not populate at all**. So even uploading a real pitch-deck *document*
   won't light up the pitch-deck slot that reads the URL field.
3. **Separate UI tiles** — `ProductionDashboard.tsx` has both a Lookbook tile (1108) and
   a Pitch Deck tile (1151), each matching only its own `type`.

**Where the "no pitch deck" signal comes from:** any check of the form
`mediaFiles.find(m => m.type === 'pitch_deck')` (e.g. `ProductionDashboard.tsx:1153`) goes
grey when only a `lookbook` was uploaded. The creator-facing `pitch.pitchDeck` link is a
separate disconnect (URL field vs. uploaded document).

**Shipped now:** the uploader option is relabelled `Pitch Deck / Lookbook` to surface the
synonym (zero-risk string change).

**Decision needed (do NOT migrate blind):**
- **Option A (recommended):** treat `lookbook` as an alias of `pitch_deck` at the
  *presence-check* layer — any `m.type === 'pitch_deck' || m.type === 'lookbook'`
  satisfies "has a pitch deck". Keep both as upload sub-labels. No schema change. Decide
  whether the merged concept is NDA-gated (today lookbook = exempt, deck = gated).
- **Option B:** collapse to one type. Requires backfilling existing `lookbook` rows,
  picking one NDA rule, and reconciling the parallel `pitch_deck_url`/`lookbook_url`
  columns. A real migration — out of scope for a label fix.

### P4 — budget is a free-text TEXT field, not a number

The prompt assumed `budget` is numeric (USD, $1B cap, thousands separators). It isn't:

- DB column `pitches.estimated_budget` is **TEXT** (free-form).
- The input is a `text` field (`CreatePitch.tsx:1220`) with placeholder
  *"Set your budget — e.g. $2.5M, £400K, or a range you're comfortable sharing"* — i.e.
  ranges and non-USD currencies are **by design**.
- Frontend schema: `EstimatedBudgetSchema = optional string, maxLength 100`
  (`schemas/pitch.schema.ts:219`). Backend treats it as `estimatedBudget?: string`
  (`worker-integrated.ts:5546`) with no numeric validation.

So the requested rework (numeric USD, $1B cap, separators, backend range Zod) is a
**breaking data-model change**, not a UI tweak:

- **Option A — keep free-text, tighten UX (low risk):** keep TEXT, add a `$`/`USD` hint +
  helper text, and a soft client-side warning for implausible inputs. No data migration;
  ranges/currencies still allowed. Doesn't give a hard server cap.
- **Option B — structured numeric (what the prompt describes; higher cost):** add a new
  `estimated_budget_usd BIGINT` column, migrate/parse existing free-text where possible
  (lossy — "£400K", "$2.5M", "1-2M range" don't all parse), make the input numeric with
  `$`/separators/`≤ $1,000,000,000`, and add the Zod `int().min(0).max(1_000_000_000)`
  bound server-side. Keep the free-text column for legacy display or drop it after backfill.

**Recommendation:** confirm the product intent first. If budgets must stay expressible as
ranges/other currencies, do A. If a single comparable USD figure is the goal (enables real
"Avg Budget" math — note `MarketplaceEnhanced` already `Number()`-coerces the text today,
so non-numeric budgets silently count as 0), do B as its own migration.

### P6 — pitch → marketplace latency: it's the publish gate, not the cache

- The marketplace (`MarketplaceEnhanced.tsx:354`) fetches **`/api/search`**, which (after
  a duplicate registration — `search` at 2466 is dead, overwritten by) resolves to
  **`searchPitches`** (`worker-integrated.ts:8812`). That handler filters
  `status = 'published'`, orders by `created_at DESC`, and is **not cached**.
- `createPitch` inserts new pitches as **`status = 'draft'`** (`:5634`). Drafts never
  appear in search. A pitch only lands on the marketplace once **explicitly published**
  via `POST /api/pitches/:id/publish` (`:2577`), which also calls `invalidateBrowseCache()`.
- Because the search path is uncached, a *published* pitch shows on the very next
  marketplace load — there is **no cache lag on the marketplace itself**.

**So "takes a while to appear" is almost certainly one of:**
1. The pitch was still a **draft** — publishing is a separate, possibly non-obvious step.
   (Most likely. Fix: clarify the publish CTA, or auto-publish on create where intended.)
2. Karl was looking at a **browse-cached surface** (homepage trending/new widgets fed by
   `/api/pitches/browse`, 3-min Redis TTL `browse:pitches:*`). Publish invalidates that
   cache, but `invalidateBrowseCache()` (`:12106`) only enumerates tabs
   `trending/new/popular/default` × pages 1–3 × `l10/l20` — **any other key
   (other tab, page ≥ 4, other limit) stays stale up to 3 min.**

**Recommended fixes (pick per the actual repro):**
- Make the **publish step explicit/obvious** post-create (or auto-publish if that's the
  intended UX) — addresses cause 1.
- If browse-surface staleness is the repro: switch `invalidateBrowseCache()` to a
  key-prefix sweep (Upstash `SCAN`/prefix) instead of the hard-coded permutation list, or
  drop the browse TTL to ~30s. Cheap, removes the silent-miss gap.
- Clean up the **duplicate `/api/search` registration** (dead `search` at 2466).

---

## Not bugs

- **P7 — Team Assembly:** product-scope decision, see
  `docs/decisions/2026-06-09-team-assembly-scope.md`.
