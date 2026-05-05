# Orchestrator Agent — Phase 5.0 Decomposition

_Captured 2026-05-04 as a precondition for starting Phase D.4 / pillar 3 (per
`docs/strategy-five-pillars-2026-05-02.md`). The "weeks" estimate that triggered
this exercise was correct directionally — the honest total is **13–16 active
engineering days** plus a 4-week soak, broken into prerequisite work + milestone
work below. Bigger than the original gut-feel; correct because it doesn't
hand-wave the prerequisites the strategy doc assumed were free._

## Scope corrections — strategy doc claims that don't survive contact with the runtime

This section is load-bearing. Every drift item below is something the strategy doc framed as "in scope" or "available" that the actual codebase doesn't reflect. Same pattern as the path-(a) flip on issue #19 earlier today: reasoning from documentation rather than code. The corrections below should be applied to `docs/strategy-five-pillars-2026-05-02.md` pillar 3 alongside this decomposition landing, otherwise the strategy doc continues to drift.

| # | Strategy doc says | Runtime reality | Decision |
|---|---|---|---|
| 1 | "Flush Hyperdrive cache" is a bounded action | `wrangler.toml` has zero `[[hyperdrive]]` bindings. Hyperdrive is not part of this project's CF surface. | **Drop from action set.** If Hyperdrive is added later, reopen scope in a focused PR. |
| 2 | "Rollback last deploy via `wrangler rollback` through Cloudflare MCP" | Two real rollback paths exist: `.github/workflows/emergency-rollback.yml` (workflow_dispatch + CF API) and `scripts/rollback-deployment.sh` (CLI, calls `wrangler rollback` at line 165). **Neither path uses CF MCP.** | **Re-frame action surface.** Orchestrator triggers the GH workflow via `mcp__github__create_pull_request_review` / `mcp__github__update_issue` style of MCP — i.e., it dispatches the workflow, doesn't run wrangler itself. Cleaner authorization model: rollbacks go through the same audit trail as human-triggered ones. |
| 3 | "Restart Durable Object instance" | Two concrete bindings: `NOTIFICATION_HUB → NotificationHub` and `WEBSOCKET_ROOMS → WebSocketRoom`. **Express milestones in those primitives, not abstract "any DO."** | Action surface is exactly two named operations: `restart-notification-hub`, `restart-websocket-rooms`. |

## Live bugs surfaced during this scoping pass — file separately, do not bury

- **`scripts/rollback-deployment.sh:20` has stale FRONTEND_URL** (`https://pitchey.pages.dev`, which NXDOMAINs since 2026-04-21) — running the rollback script today would fail its post-rollback frontend health check. **This is a real bug that blocks Phase C.1 rollback drill** because the drill would fail on the URL check, not on rollback itself. Filed separately; must fix before C.1 starts.
- **Orphan DO exports**: `worker-integrated.ts:20646–20647` exports `ContainerOrchestrator` and `JobScheduler` but `wrangler.toml` `new_classes` only includes `NotificationHub` + `WebSocketRoom`. These are likely dead exports (related to parked container worker per CLAUDE.md issue #61) or bound by a separate worker. Audit and either remove or document. Doesn't block orchestrator work but bears on "what DO instances does the orchestrator know about."

## Hard prerequisites (re-stated, unchanged from strategy doc)

Both must be true before any orchestrator code lands in production:

1. **Phase C.3 / pillar 1 — catch-swallow remediation done.** Untagged residue < 30 in `src/` excluding `worker-integrated.ts`; telemetry sites tagged `// fire-and-forget`. An orchestrator built on swallowed errors classifies against an incomplete signal.
2. **Phase C.1 — rollback drill verified end-to-end.** `scripts/rollback-deployment.sh` exercised on staging (after the stale FRONTEND_URL is fixed), dry-run + live, both green. `wrangler rollback` confirmed to exist and behave as the script assumes in wrangler 4.77.

Neither gate is satisfied today.

## Prerequisite work surfaced (NOT in original Phase 5 estimate)

These are net-new items the strategy doc assumed were free or already done. Each is sized in days; total is the prerequisite block before milestone work starts.

| ID | Description | Estimate | Gate |
|---|---|---|---|
| P1 | **Verify `wrangler rollback` works in 4.77** — part of Phase C.1 already, listed for completeness | (already in roadmap) | Phase C.1 acceptance |
| P2 | **Provision Sentry webhook signing secret in Pitchey org**, add as Worker secret | 0.5 days | Test webhook from Sentry dashboard returns 200 with valid HMAC, 401 with forged |
| P3 | **Author + configure Axiom alert routes**. Entire alert taxonomy needs writing: which APL queries fire alerts, what thresholds, what payload routes back to the orchestrator endpoint. The strategy doc treats "Axiom alert routes" as an existing input — they don't exist. | 2–3 days | At least 4 alert rules configured (one per planned classification category); each fires correctly against synthetic log data |
| P4 | **Fix stale FRONTEND_URL in `scripts/rollback-deployment.sh`** (and any other stale Pitchey-pages.dev refs in the rollback path) | 0.5 days | Script runs `curl pitchey-5o8.pages.dev` and gets 200 in dry-run mode |
| P5 | **Resolve orphan DO exports** — audit `ContainerOrchestrator` and `JobScheduler` against parked-code carve-outs in CLAUDE.md, either remove from worker-integrated.ts exports or document why they're bound elsewhere | 1 day | `wrangler types` output matches actual runtime DO inventory; orchestrator's "list known DOs" is exhaustive |

**Prerequisite block total: 4 days** (P1 already in Phase C.1).

## Milestones (orchestrator work proper)

Each milestone is a thing you can build and verify. Each has a verification gate defined now, not later. Estimates are for one experienced engineer with current production knowledge.

### M1 — Sentry webhook ingest endpoint (1.5 days)

**What:** New Worker route `POST /api/orchestrator/events` with HMAC-SHA256 signature verification. New Neon table `orchestrator_events` columns: `(event_id PK, source ENUM('sentry','axiom'), raw_payload JSONB, classification TEXT, confidence NUMERIC, action_taken TEXT, ingested_at TIMESTAMPTZ, action_taken_at TIMESTAMPTZ)`.

**Gate G-M1:**
- (a) Real Sentry test webhook from the Pitchey org dashboard lands in `orchestrator_events` with signature verified
- (b) Forged payload (signature header tampered) returns 401, does not write to DB
- (c) Same `event_id` POSTed twice produces exactly one row (idempotent UPSERT)

### M2 — Axiom alert ingest (0.5 days)

**What:** Same `/api/orchestrator/events` endpoint, discriminated by `source=axiom`, bearer-token auth instead of HMAC.

**Gate G-M2:**
- (a) Real Axiom alert from a P3-configured rule lands in `orchestrator_events` with `source='axiom'`
- (b) Bearer mismatch returns 401

### M3 — Classifier module + 4-category taxonomy (2 days)

**What:** `src/orchestrator/classifier.ts`. Rule-based matchers (NOT ML — premature). Categories:
- `notification_hub_failure` — error stacks containing `NotificationHub.send` or `NotificationHub.broadcast` above 10/min from `worker-integrated.ts:10920–10985` code paths
- `websocket_room_failure` — error stacks in `durable-objects/websocket-room.ts` or matching `WebSocketRoom.handleSession` above 10/min
- `db_connection_storm` — `pool exhausted` / `too many connections` / Neon-side errors above threshold from `db/connection.ts` or related
- `third_party_degradation` — Stripe / Resend / Upstash returning 5xx > 1% over 5 min, identified via Axiom log query
- `unknown` — fallback, escalates to M6

Each rule returns `{ category, confidence: 0–1, suggested_action: 'restart-notification-hub' | 'restart-websocket-rooms' | 'rollback' | 'open-issue' }`. Note actions are concrete primitives, not abstractions.

**Gate G-M3:**
- (a) 50 hand-labeled fixture events in `tests/orchestrator/fixtures/` — at least 10 per category, sourced from real Sentry/Axiom output
- (b) Classifier accuracy on the fixture set ≥ 90%
- (c) `unknown` rate < 20% on the fixture set
- (d) Each rule has a unit test that fails-noisily when the rule itself drifts (e.g., NotificationHub gets renamed)

### M4 — Bounded action: rollback via GH workflow_dispatch (1 day; SHADOW MODE) — GATED on Phase C.1

**What:** Orchestrator dispatches `.github/workflows/emergency-rollback.yml` via `mcp__github__update_issue` workflow_dispatch surface (NOT via Cloudflare MCP — the strategy doc was wrong). Initial mode: shadow only. Logs `[orchestrator] would dispatch emergency-rollback.yml(rollback_type=automatic, environment=production, reason=<event_id>)` to Axiom + writes to `orchestrator_events.action_taken='rollback_shadow'`. Live promotion is a separate decision after one week of correct shadow logs.

**Gate G-M4 (shadow):**
- (a) Synthetic deploy-regression event in staging produces a shadow log entry
- (b) Shadow log's intended `target_version` matches what `scripts/rollback-deployment.sh --dry-run` would identify for the same scenario
- (c) Live execution path is **disabled** by code, not by config — flipping a flag does NOT promote to live

**Gate G-M4-live (separate, deferred):**
- (d) One week of shadow logs with zero false-positive shadows AND at least one true-positive shadow correctly identifying a rollback-worthy event (without this, "all unknown" passes vacuously)
- (e) Phase C.1 rollback drill passed at least once on staging within the prior 30 days

### M5 — Bounded action: restart NOTIFICATION_HUB instance (1 day)

**What:** GitHub workflow_dispatch OR direct Worker admin endpoint that calls `env.NOTIFICATION_HUB.idFromName('global-hub').get(...)` followed by an internal-protocol `restart` message. Per `worker-integrated.ts:10924`, the live worker uses `idFromName('global-hub')` — the orchestrator restarts that exact instance, not arbitrary IDs.

**Gate G-M5:**
- (a) Synthetic `notification_hub_failure` event triggers restart
- (b) DO is back up within 30s (verified via `state` endpoint or test message round-trip)
- (c) Notification queue messages buffered during restart are processed after restart completes (no message loss)

### M6 — Bounded action: restart WEBSOCKET_ROOMS instance (1 day)

**What:** Similar shape to M5 but targeting `WEBSOCKET_ROOMS` binding. Crucially: WebSocketRoom holds active client connections. Restart must send `{type:"server_restart_imminent"}` to all connected clients before destruction so frontend reconnect logic kicks in cleanly.

**Gate G-M6:**
- (a) Synthetic `websocket_room_failure` event triggers restart
- (b) Connected test clients receive `server_restart_imminent` message and reconnect within 10s
- (c) Connection count returns to pre-restart level within 30s of restart completing
- (d) No message-in-flight is silently lost (verify with sequence-numbered test messages)

### M7 — Human-readable issue fallback (0.5 days)

**What:** For events classified as `unknown` OR confidence < 0.6, open a GitHub issue via `mcp__github__create_issue`. Title format: `[orchestrator/<source>/<category>] <error_summary>`. Dedup: same `(source, category, error_summary_hash)` within 1 hour → comment on existing open issue, don't open new.

**Gate G-M7:**
- (a) Synthetic unknown event opens a GitHub issue with classification metadata, raw event JSON, suggested next-step links (Sentry issue URL, Axiom query URL)
- (b) Same event 30s later comments on the existing issue, does NOT open a new one
- (c) Same event 1 hour later opens a new issue (dedup window respected)

### M8 — MTTA measurement + Analytics Engine writes (1 day)

**What:** On every classification: write `(category, source, ingested_at, action_taken_at)` to AE `PITCHEY_ANALYTICS` (do not add a new dataset — the post-2026-04-17 prune retained 2 datasets and that's the budget). SQL view for p50/p95/p99 MTTA per category, week-over-week delta. Surface in unit-economics dashboard (pillar 2) as a side panel.

**Gate G-M8:**
- (a) AE writes are visible via `wrangler analytics-engine sql` query within 60s of action-taken
- (b) Dashboard tile renders MTTA from at least 2 weeks of synthetic event runs
- (c) Weekly delta calculation is non-zero (i.e., produces real numbers)

### M9 — 4-week soak harness (1 day setup + 4 weeks observation)

**What:** Synthetic event generator: cron-triggered, one event of each category per day against staging. Verifies classification correctness, action taken (or shadow logged), MTTA recorded. Weekly automated report.

**Gate G-M9:**
- (a) Synthetic generator exists in `scheduled.yml` workflow, fires daily
- (b) 4 consecutive weekly reports meet pass criteria: classification accuracy ≥ 90%, MTTA p95 trending down, zero false-positive live remediations (rollback shadow throughout)
- (c) 4-week pass → orchestrator promoted from "soak" to "live" status; rollback action then evaluated for shadow → live promotion as a separate decision (gated on G-M4-live)

## Critical path

```
P1 (in Phase C.1) ─┐
P4 ────────────────┤── prereqs gate ──► M1 ──► M3 ─┬─► M4 (shadow, gated on Phase C.1)
P2 ────────────────┤                               ├─► M5
P3 ────────────────┘                               ├─► M6
P5 (parallel)                                      └─► M7

M2 (parallel with M1)

(M4, M5, M6, M7 complete) ──► M8 ──► M9 (4-week soak)
```

**Parallel opportunities (single engineer):**
- P2, P3, P4, P5 can run in parallel with each other (all are prereqs but independent)
- M2 fast-follows M1 (same endpoint)
- M4, M5, M6, M7 can ship in any order after M3

**Parallel opportunities (multi-engineer):**
- Prereqs split across two engineers: one on P2+P4 (operational), one on P3 (alert authorship — biggest)
- Milestone work splits cleanly along action surface (M4, M5, M6, M7 are 4 different surfaces)

## Honest total

- Prerequisites P2–P5: **4 days** (one engineer; less with parallel)
- Milestones M1–M8: **9.5 days** active engineering
- Soak M9: 4 weeks observation, 1 day setup
- **Total active engineering: ~13.5 days**
- **Total wall-clock with soak: ~10 weeks** if soak completes happy-path

If P3 (Axiom alert authorship) reveals more taxonomy than the 4 categories listed, M3 grows proportionally. Mitigation: P3 lands first, M3 estimate revised based on what P3 produced.

## Out of scope (explicitly)

- ML-based classification (rule-based is sufficient at expected event volume)
- Self-modification (orchestrator opening PRs against its own classifier rules) — level-6 jump beyond level-5 target
- Multi-environment orchestration (staging + prod simultaneously)
- Stripe / billing remediations — explicit out-of-bounds per strategy doc, **never** in scope
- Schema changes / migrations — out-of-bounds for the same reason
- **Hyperdrive cache flush** — Hyperdrive isn't bound (see scope corrections #1)

## Why this decomposition was worth doing

Without it, Phase 5 was estimated as "weeks" — vague enough to absorb the prerequisite work invisibly into the milestone work, which is exactly how scope grows mid-flight. The decomposition surfaced:

1. **3 strategy-doc drift items** that would have produced fictional milestones
2. **2 live bugs** (stale rollback URL, orphan DO exports) that aren't part of Phase 5 but block adjacent work
3. **5 net-new prerequisites** the strategy doc treated as free
4. **Concrete primitives** (`NOTIFICATION_HUB`, `WEBSOCKET_ROOMS`) that constrain what the orchestrator can verify against

The "weeks" estimate was honest in spirit (it's not days) and wrong in granularity (no decomposition, no gates). The real number is **13.5 days active + 10 weeks wall-clock** with the soak. That's the contract.

## Maintenance

Update this doc when:
- A milestone ships → mark complete with link to merge commit
- A scope correction is applied to the strategy doc → cross-reference here
- A finding from execution invalidates an estimate → update the estimate, do not silently let the doc drift
- Hyperdrive is added (or any other CF binding) that opens a new bounded action → reopen scope question

Do not maintain on a calendar.
