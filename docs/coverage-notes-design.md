# Coverage Notes Feature — Design

**Status:** Scoped (this doc), implementation gated on Stripe go-live.
**Tracking:** No GitHub issue yet — file when implementation starts.
**Date:** 2026-05-08

## Why this feature

Industry context: studio development executives pay $100-300/script to professional readers for "coverage" — a structured 1500-2000 word assessment that lets the exec triage their reading queue. It's a paid service in every major production company.

For Pitchey:
- **Highest revenue:effort ratio** of the AI features in the May 2026 strategy review.
- Slots into the existing credit system (no net-new monetization infrastructure).
- Reuses the existing Anthropic + PDF-extract pipeline (`ai-production-autofill.ts`) — minimal new code.
- Differentiator vs. competitors: most movie-pitch platforms don't offer this; the ones that do charge per-script and use slow human readers.

## What gets generated

A structured JSON response containing both granular fields (for the UI) and long-form prose (the actual coverage doc the user reads/downloads).

Schema (also encoded as JSON guidance in the prompt — see `src/prompts/coverage-notes.ts`):

| Field | Type | Notes |
|---|---|---|
| `logline` | string (25-50 words) | One-sentence pitch in industry format |
| `synopsis` | string (200-400 words) | Full plot summary, no spoiler warnings |
| `comparables` | array of `{title, year, why}` | 3-5 entries, each justified |
| `strengths` | array of strings | 3-5 evidence-based positives |
| `weaknesses` | array of strings | 3-5 evidence-based critiques |
| `market_analysis` | string (150-250 words) | Audience, budget tier, distribution, timing |
| `recommendation` | enum | `Pass` / `Consider` / `Recommend` |
| `recommendation_rationale` | string | 2-4 sentences |
| `coverage_prose` | string (1500-2000 words) | The full long-form report |

## API surface

```
POST /api/coverage/generate
Content-Type: multipart/form-data
Body: file (PDF / TXT / DOCX, max 10MB)

Response 200:
{
  "success": true,
  "data": {
    "coverage_id": "uuid",
    "logline": "...",
    "synopsis": "...",
    "comparables": [...],
    "strengths": [...],
    "weaknesses": [...],
    "market_analysis": "...",
    "recommendation": "Pass" | "Consider" | "Recommend",
    "recommendation_rationale": "...",
    "coverage_prose": "...",
    "credits_remaining": 450,
    "credits_charged": 50
  }
}

Response 402: insufficient credits
Response 503: AI service unavailable / DB unavailable
Response 502: Claude API failure
```

```
GET /api/coverage/:id
Response 200: same shape as above (without credit fields)
```

```
GET /api/coverage/list
Response 200: { reports: [{ id, generated_at, logline, recommendation }] }
```

## Pricing

**50 credits per coverage report.** Calibration:

- Production-assessment auto-fill is 5 credits (short structured output, ~500 tokens).
- Coverage is ~3-5x the output (1500-2000 words prose + structured fields), more nuanced prompt, slower response.
- Industry baseline: $100-300/script for human coverage. Pitchey credit pricing TBD with Stripe go-live; if $1 = 10 credits then 50 credits = $5 — well below human-reader floor, sustainable margin on Anthropic API cost.

Final number to confirm during Stripe price setup. Placeholder in `src/prompts/coverage-notes.ts` as `COVERAGE_NOTES_CREDIT_COST = 50`.

## Storage

New table:

```sql
CREATE TABLE coverage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pitch_id INTEGER REFERENCES pitches(id) ON DELETE SET NULL,  -- nullable: coverage from arbitrary upload may not link to a pitch
  source_filename TEXT,
  source_size_bytes INTEGER,
  result_json JSONB NOT NULL,  -- the structured response
  credits_charged INTEGER NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_coverage_reports_user ON coverage_reports(user_id, generated_at DESC);
CREATE INDEX idx_coverage_reports_pitch ON coverage_reports(pitch_id) WHERE pitch_id IS NOT NULL;
```

Why JSONB and not flat columns: the schema may evolve (add fields, change recommendation calibration) and JSONB tolerates that without column-add migrations. Flat columns would also work, slightly faster to query specific fields, but the iteration cost during prompt-evolution outweighs query speed at expected volume.

Why nullable `pitch_id`: a creator might upload a script that's not yet a pitch on the platform, generate coverage, then create the pitch. Don't force the pitch to exist first.

## Implementation pointers

Mirror `src/handlers/ai-production-autofill.ts`. Key differences:

1. Import the prompt from `src/prompts/coverage-notes.ts` instead of inlining (the autofill pattern inlines, but coverage prompts are longer + more structurally sensitive — extracting the prompt makes A/B testing tractable).
2. Use `max_tokens: 8192` (autofill uses 4096) — coverage_prose alone is 2000 words, plus the structured fields.
3. Charge `COVERAGE_NOTES_CREDIT_COST` (50) instead of 5.
4. After successful generation, INSERT into `coverage_reports` table.
5. Same credit-check pattern as autofill (fail-closed via `safeQuery`, 503 on credit-table outage).
6. Same file validation (PDF/TXT/DOCX, 10MB cap).

Estimated implementation time: 2-3 days including frontend integration.

Frontend:
- New page `frontend/src/pages/Coverage.tsx` (creator portal, accessible from creator dashboard).
- Upload form, loading state during generation (Claude takes 15-30s for 8K-token responses), result display with download-as-PDF option.
- List view at `/creator/coverage` showing past reports.

## Test plan (when implementation lands)

Manual quality review by 1-2 industry-experienced humans before launch:

1. Upload 5 test scripts of varying quality:
   - 1 produced/successful film (recent indie release)
   - 1 unproduced spec from a public repository (Black List, etc.)
   - 1 first-draft amateur script
   - 1 deliberately bad script (workshop exercise quality)
   - 1 treatment-only document (no full script)

2. Generate coverage for each. Review:
   - Recommendation distribution (expect 1-2 PASS, 2-3 CONSIDER, 0-1 RECOMMEND across 5)
   - Specificity check — does coverage cite real scenes/characters or generic praise?
   - Honesty check — does the bad script get an honest PASS, or does Claude soften it?
   - Comparables quality — are they meaningful or genre-matching?
   - Prose readability — does the long-form coverage read like industry coverage or like an LLM trying to sound like industry coverage?

3. Iterate on `src/prompts/coverage-notes.ts` based on findings. Re-run the 5 test scripts after each prompt change.

4. Pitchey beta launch: ship to a small group of creator users first, gather feedback on accuracy, expand.

## Out of scope (for this design pass)

- Implementation of any of the above (post-Stripe).
- Frontend UI design (the implementation pass will produce mockups).
- A/B testing infrastructure for prompt variants (V2+ work).
- Integration with the heat-score / market signal system (V2+ work — could feed coverage signals into the heat algorithm).
- Multi-language coverage (V2+ work).
- Coverage of TV pilots vs feature scripts (the prompt may need separate variants — defer until evidence).

## Risks worth flagging

1. **Honesty calibration is the hardest part.** LLMs default to encouraging language. The prompt explicitly fights this, but real coverage is meaningfully more brutal than the LLM default. The 5-script test plan is designed to catch grade inflation.

2. **The "which film is this comparable to" failure mode.** Claude knows lots of films but tends to comp by surface features (genre/setting) rather than structural similarity. The prompt tells it to comp by "audience, budget tier, prestige" but enforcement is hard. Worth specific test cases targeting this.

3. **PDF extraction quality.** Some scripts are scans, not text. The existing autofill pipeline handles native PDFs but not scans. If a creator uploads a scan, generation will produce coverage based on garbled text. Worth either rejecting OCR-needed PDFs upfront or adding an OCR pass (Tesseract via container).

4. **Liability framing.** "Pass" coverage on a script that later sells huge would generate complaints. Worth a `/legal/disclaimer` page noting coverage is AI-generated, doesn't substitute for human reader judgment, doesn't constitute professional opinion. Standard SaaS-AI disclaimer.

## Decision log

| Decision | Choice | Rationale |
|---|---|---|
| Where prompt lives | Separate file `src/prompts/coverage-notes.ts` | Long prompts deserve their own version history; extracting helps prompt iteration without churning the handler |
| Storage format | JSONB column | Schema iteration faster than column migrations during prompt evolution |
| Credit cost | 50 (placeholder) | 5-10x autofill (proportional to output volume + complexity), validate during Stripe pricing |
| Recommendation enum | Pass / Consider / Recommend | Industry-standard 3-tier; rejected 5-tier as over-precise for AI calibration |
| Pitch linkage | Nullable | Creators may run coverage on scripts not yet on the platform |
| Test plan | 5-script manual quality review pre-launch | LLM evaluation suites can't catch the honesty failure mode |
