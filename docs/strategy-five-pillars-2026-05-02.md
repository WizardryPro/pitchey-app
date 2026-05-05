# Strategic Frame — Five Pillars (2026-05-02)

_Captured 2026-05-02. Strategic spine for `docs/roadmap-post-launch-2026-04-20.md` Phases C–E. Read before re-deriving priorities; the ordering below is load-bearing._

## Frame

The hyperscaler research underpinning this frame is AWS/Azure/GCP-flavoured: RI/Savings Plan optimization, PUE benchmarking, predictive autoscaling, carbon-aware batch scheduling. Pitchey already lives downstream of most of it. **Workers + Neon serverless gives us scale-to-zero, edge distribution, and pay-per-request without commitments to manage** — most of the pillars in the source research are absorbed by being serverless-edge-native from day one.

What remains are five wins clustered around closing the **observability-to-action loop** and making the **cost story legible at the unit level** ahead of production launch. Sequencing matters: pillar 1 is a hard prerequisite for pillar 3; everything else slots cleanly behind it.

## Pillars (in execution order)

### Pillar 1 — Catch-swallow remediation (AIOps prerequisite)

**Why first.** Any agentic remediation layer built on top of Sentry/Axiom/Analytics Engine while errors are silently defaulted is on quicksand. The entire self-healing/autonomous-remediation pitch in the research assumes errors actually surface; `.catch(() => default)` patterns make Sentry, Axiom, and AE simultaneously blind. The consumption-gate failure that hid for weeks is the canonical example.

**State.** Already mid-flight per the existing roadmap (Phase C.3). `safeQuery` helper in `src/db/safe-query.ts` is in use across 10 files / 39 sites; ~180 silent `.catch(() => …)` remain across 25 files (down from 196 at audit time). Tier list lives in `docs/catch-swallow-audit-2026-04-17.md`.

**Definition of done.** Two-count discipline, not a single number:

1. **Error-swallowing residue** — `.catch(() => …)` sites that are *not* tagged with a `// fire-and-forget` comment marker on the line above. Threshold: **below 30 in `src/` excluding `worker-integrated.ts`**, and zero in any handler that returns user-visible data.
2. **Telemetry-intentional residue** — sites tagged `// fire-and-forget` (typically `ctx.waitUntil(...).catch(() => {})` patterns). Allowed; not counted against the threshold. Adding the marker is the migration step at each such site, forcing a per-site human judgment that this is genuinely fire-and-forget.

Tier 1 + Tier 2 fully migrated. Verification grep below filters the marker so the count is meaningful.

### Pillar 2 — Unit economics in Analytics Engine

**Translation.** The FinOps "cost per customer / per transaction / per feature" framing translates directly: cost per pitch view, per NDA signature, per investor onboarded, per Heat recomputation. Workers + Neon make this tractable because per-request CPU time and DB compute time are already telemetered.

**Approach.** Pick **1–2 North Star unit metrics** tied to the production-launch business model. Resist the urge to instrument everything — instrument selectively. Reuse the surviving 2 Analytics Engine datasets (`ANALYTICS`, `PITCHEY_ANALYTICS`) per `docs/observability-audit-2026-04-17.md`; do not re-add bindings.

**Initial candidates** (pick at most two):
- **Cost per pitch view** — Worker CPU ms × CF unit price + Neon compute time × Neon unit price, aggregated by pitch and by viewer role. Highest-volume action; sets the floor for all other unit costs.
- **Cost per NDA signature** — multi-step: NDA request → review → sign → notification fan-out. Reveals whether NDA throughput is economically viable at scale.
- **Cost per investor onboarded** — funnel cost across signup → portal load → first browse → first pitch view. Underwrites paid acquisition decisions.
- **Cost per Heat recomputation** — already a cron; if it doesn't show up cheaply we have a scale problem before launch.

**Definition of done.** Dashboard surfacing p50/p95 cost-per-unit for the chosen metric(s), with a delta view week-over-week. Backed by SQL over the AE dataset, not by adding new ones.

### Pillar 3 — Orchestrator agent (AIOps level-5 gap)

**Frame.** Current operating model is level-4: parallel Claude Code sessions in tmux, human-orchestrated. The level-5 gap is a **long-running orchestrator** — agentic incident remediation in the research's terms. GitHub MCP (workflow_dispatch surface) and Sentry MCP are the action surface; Cloudflare MCP turned out to be the wrong frame here — see the scope corrections in `docs/orchestrator-decomposition.md` for why.

**Concrete shape** (refined 2026-05-04 by the Phase 5.0 decomposition; see `docs/orchestrator-decomposition.md` for milestones + gates).
- **Inputs** — Sentry issue webhooks, Axiom alert routes. (Note: Axiom alert routes don't exist yet — authoring them is a P3 prerequisite, ~2–3 days, *not* a free input as this doc originally framed.)
- **Classifier** — match incoming signal against a runbook taxonomy expressed in concrete DO primitives:
  - `notification_hub_failure` (matches NotificationHub error stacks)
  - `websocket_room_failure` (matches WebSocketRoom error stacks)
  - `db_connection_storm` (Neon pool exhaustion / too-many-connections)
  - `third_party_degradation` (Stripe / Resend / Upstash 5xx > 1% over 5 min)
  - `unknown` (escalates to human-readable issue)
- **Bounded actions** (all targeted at concrete primitives, not abstract types):
  - **Rollback last deploy** — orchestrator dispatches `.github/workflows/emergency-rollback.yml` via GitHub MCP workflow_dispatch. Initial mode: shadow only. Live promotion is a separate decision after one week of correct shadow logs. Gated on Phase C.1 rollback drill.
  - **Restart NOTIFICATION_HUB instance** (the named `'global-hub'` instance, not arbitrary IDs).
  - **Restart WEBSOCKET_ROOMS instance** with `server_restart_imminent` notification to connected clients before destruction.
  - **Open a GitHub issue** (via `mcp__github__create_issue`) with classification + suggested action when the bounded set doesn't cover the signal.
- **Out of bounds** — schema changes, secret rotation, force-pushes, Stripe/billing. **Hyperdrive cache flush** was originally in this list — dropped because Hyperdrive isn't a binding in `wrangler.toml`. If Hyperdrive is added later, reopen scope.

**Hard prerequisite.** Pillar 1 complete. An orchestrator that can't see swallowed errors will silently run remediations against an incomplete signal.

**Definition of done.** Orchestrator runs against a staging stream of synthetic Sentry events; correctly classifies + remediates the bounded set; opens human-readable issues for unknowns; mean-time-to-action measured and trending down over a four-week soak.

### Pillar 4 — Reversibility audit

**Frame.** The closing point of the research about "reversible architectures" is worth taking seriously given how CF-locked Pitchey is. The goal is **legibility, not premature abstraction** — name the lock-in so future migration cost is visible without forcing portability shims today.

**Strategic CF lock-in (proprietary; expensive to leave):**
- Durable Objects (real-time messaging, WebSocket fan-out)
- Analytics Engine (unit-economics + request log telemetry)
- Hyperdrive (Neon connection pooling at edge)
- R2 (file storage; less locked but data egress matters)
- Workers AI (when adopted per pillar 5)

**Commodity / portable (cheap to leave):**
- Hono — runs anywhere with Web Fetch APIs.
- Raw SQL via `@neondatabase/serverless` — Neon-flavoured but the Postgres wire protocol is the universal escape hatch.
- Zod, React, Vite, TailwindCSS — fully portable.

**Definition of done.** A one-page `docs/reversibility-audit.md` enumerating each lock-in dependency, the business value it delivers, and the rough migration cost (engineer-weeks + data-migration risk) if Cloudflare disappeared tomorrow. Not a migration plan — a cost-of-departure ledger.

### Pillar 5 — Workers AI (deferred until ML feature lands)

**Why deferred.** The edge strategy pillar is mostly already realised for HTTP. ML inference is the missing edge case. **Workers AI lands when an actual ML feature does, not before** — building the integration ahead of demand is solution-in-search-of-a-problem.

**Credible candidates** when one of these features ships:
- Similarity search across pitches (embedding + vector lookup).
- Semantic tagging on synopses (auto-categorisation, content moderation).
- Investor-pitch matching (recommendation surface).
- Heat anomaly detection (the deterministic Heat formula `H = 0.7×CI + 0.3×RI` stays as-is; ML applies to the *consumption-gating signals around it* — bot detection, view-quality scoring).

**Definition of done.** N/A until a candidate feature has product justification.

## Sequencing

```
catch-swallow ──► unit economics ──► orchestrator ──► reversibility doc
                                                          │
                                                          └──► (Workers AI when an ML feature lands)
```

Pillar 1 → Pillar 3 is a hard dependency. Pillar 2 can run in parallel with the tail end of pillar 1 once Tier 1 is clean. Pillar 4 is small enough (one-page doc) to slot anywhere; intentionally placed after the orchestrator so the doc reflects what we actually built rather than what we planned.

## Explicitly deprioritized

- **RI / Savings Plan optimization** — doesn't apply. Workers + Neon are pay-per-request; there is no commitment surface to optimize.
- **PUE benchmarking** — Cloudflare and Neon publish their own; we don't control either DC's power efficiency.
- **Predictive autoscaling** — Workers isolates handle this for us. There is no scaling controller to tune.
- **Carbon-aware batch scheduling** — low leverage until we have meaningful batch workloads. The Heat recomputation cron is the only credible candidate, and it's not big enough yet to matter.

These four are *not* "later" — they are "wrong axis." Reopening them requires evidence that the underlying serverless-edge-native assumption no longer holds.

## Verification

| Pillar | Done when |
|--------|-----------|
| 1. Catch-swallow | Untagged residue < 30 in `src/` excluding `worker-integrated.ts`. Verification: `grep -rnE -B1 "\.catch\s*\(\s*\(\s*\)\s*=>" src/ --exclude=worker-integrated.ts \| grep -B1 -v "fire-and-forget" \| grep -cE "\.catch"`. Tagged sites (`// fire-and-forget` on prior line) are allowed and not counted |
| 2. Unit economics | Dashboard renders p50/p95 cost-per-pitch-view (or chosen metric) with weekly delta; backed by AE SQL, no new bindings |
| 3. Orchestrator | Bounded actions execute on synthetic events in staging; mean-time-to-action measured over 4-week soak; unknowns escalate to human-readable issues |
| 4. Reversibility | `docs/reversibility-audit.md` exists, enumerates each strategic lock-in with engineer-week migration estimate |
| 5. Workers AI | Gated on a real ML feature; no verification until then |

## Honest summary

Most of what the research lionises we've already absorbed by being serverless-edge-native from the start. The remaining wins are about **closing the observability-to-action loop** (catch-swallowing + orchestrator) and **making the cost story legible at the unit level** for production launch. Two doc deliverables (this file + `reversibility-audit.md`) and two engineering deliverables (unit-economics dashboard, orchestrator agent) — plus finishing the catch-swallow sweep already in flight.

The five pillars are sequencing for ~6–10 weeks of post-revenue-unlock work. Phase B (Stripe go-live) remains the dominant focus until revenue flows; this frame is what comes after.
