# Next Actions — Post-Session 2026-05-08

Captures the priority queue at end-of-session 2026-05-08 (after PR #106 + #107). Mirrors the chat plan into a reviewable doc. Refreshed when next session starts; superseded when significantly out of date.

## State at this snapshot

- `main` is in sync with prod after PR #106 (`cf5394f5`). Worker version `b171af87...` running.
- PR #107 (CLAUDE.md doc update) awaiting review.
- Stripe go-live still blocked on third party ("delaying client").
- Catch-swallow remediation 100% merged (Pillar 1 gate (a) MET).
- Three open audit issues: #103 (cron stubs), #104 (frontend orphan tree), #105 (BA Phase 1.5a-frontend).

## Priority sequencing — locked

1. **Stripe go-live** — overall #1, blocked externally.
2. **Rollback drill** — Phase C #1, post-Stripe by design (controlled-break exercise belongs in post-launch window, not pre-launch).
3. **BA Phase 1.5a-frontend** (#105) — post-Stripe, scoped at 30-45 min.
4. Everything else — post-Stripe, queued.

This sequencing was reaffirmed in the 2026-05-08 strategy review. Reordering it requires new information, not impatience.

## Tier 1 — pre-Stripe, no prod risk, doable now

These are decision/scope/doc artifacts that lay groundwork without touching the live runtime. Pick one at a time; don't open all three in parallel — switching cost rises faster than throughput.

### A. Rollback procedure documentation

Gates the L7 unlock (orchestrator agent / Phase D.4). The drill itself is post-Stripe, but the procedure needs to be written down before the drill is fast/safe.

**Concrete output:** `docs/INCIDENT_RESPONSE.md` with:
- How to detect a regression (Sentry fingerprint spike, `/api/health` failing, deploy version recently changed)
- The exact `wrangler rollback [version-id]` sequence
- Verification steps post-rollback (health check, smoke test, version ID confirm)
- Comms template for downtime announcements

**Pre-work:** `wrangler deployments list`, `wrangler rollback --help`, confirm token has `Workers Scripts → Edit`.

**Time:** 1-2 hours.

### B. Coverage notes design ✅ DONE 2026-05-08

Highest revenue:effort feature in the recommendations. Implementation post-Stripe; design landed this session.

**Output (this session):**
- `docs/coverage-notes-design.md` — full design + decisions + test plan + risks
- `src/prompts/coverage-notes.ts` — versioned prompt as code artifact

When Stripe lands, implementation work picks up from the design doc — handler mirrors `ai-production-autofill.ts` pattern, schema is specified, pricing decision is staged.

### C. Investor matching — tech-decision spike

Highest moat feature; multi-week implementation post-Stripe. Architecture call needs to be made before any code.

**Concrete output:** `docs/investor-matching-architecture.md` covering:
- **Vector store choice:** Cloudflare Vectorize (lock-in, edge-native) vs Postgres pgvector (commodity, portable). Reversibility frame favors pgvector.
- **Embedding model choice:** OpenAI `text-embedding-3-small` (cheap, best-in-class, adds OpenAI dep) vs Workers AI BGE/multilingual-e5 (CF-native, lock-in).
- **Data audit:** What's in `investors` table? Portfolio history, focus areas, deal sizes, geography? Sparse profile data = poor matching regardless of model.
- **Scope:** what's V1 (recommend 5 investors per pitch) vs V2 (bidirectional matching, alerts, portfolio fit explainer)?

**Time:** 2-3 hours including the data audit.

## Tier 2 — queued, blocked on Stripe

Documented so they're not forgotten. Don't start until Stripe lands.

| Item | Tracking | Estimate | Notes |
|---|---|---|---|
| Stripe go-live | (no issue — external) | — | Binding constraint on commercial launch |
| Rollback drill execution | (file when starting) | Half-day | Gate (b) for orchestrator |
| BA Phase 1.5a-frontend rip | #105 | 30-45 min | Bundle drops ~100-200KB |
| Coverage notes implementation | (file post-design-review) | 2-3 days | Design landed 2026-05-08 |
| Investor matching implementation | (file post-spike) | 2-3 weeks | Spike pending |
| AIOps orchestrator (pillar 3) | (file when starting Phase D.4) | Multi-week | Gate (a) MET; gate (b) is rollback drill |
| 7 cron placeholders audit | #103 | Per-handler | Decide wire-up vs remove for each |
| Frontend orphan audit + cleanup | #104 | 1 day | Use `knip`, propose deletions |
| Phase 1.5b — drop empty BA tables | (no issue) | 30 min + migration review | Destructive, gated |

## Tier 3 — calendar verifications

Not work to plan, things to check on:

| Date | Action | Acceptance |
|---|---|---|
| Mon 2026-05-11 02:00 UTC | First session-cleanup cron firing | Axiom: `category:"session_cleanup"` log with `outcome: "success"` and `deleted > 0` |
| Tue 2026-05-13 | Sentry-watch fix-PR-or-why-not bar | Every fingerprint introduced post-Phase-2-deploy has a fix-PR open OR documented why-not |
| When Stripe unblocks | Tier 2 cascades open | First action: rollback drill execution |

## Strategic recommendation (locked)

**Don't build for L8 (multi-agent) yet.** Multi-agent architectures add coordination overhead that pays off only when specialist agents genuinely diverge in reasoning. Pitchey's use cases are well-handled by single capable agents at L5-L6. Revisit after L7 (orchestrator) is paying off.

**Do prioritize the L7 unlock.** Rollback drill is the bottleneck. Every operational feature in the strategy benefits from L7 substrate (continuous watch + bounded action). Building features on a single-shot model means paying prompt cost every check.

**Highest revenue:effort: coverage notes** (designed this session, implementation post-Stripe).

**Highest defensive moat: investor matching** (depends on proprietary investor data; competitors can't easily replicate).

## What this doc isn't

Not a strategy doc — that's `docs/strategy-five-pillars-2026-05-02.md`. This is a one-snapshot priority queue, dated, perishable. Refresh next session; supersede when out of date. Don't link this from CLAUDE.md as a long-term reference; CLAUDE.md's session-2026-05-08 entry covers the persistent claims.
