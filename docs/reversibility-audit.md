# Reversibility Audit (Pillar 4)

_Captured 2026-05-04 alongside the issue #19 BA rip. Cost-of-departure ledger,
not a migration plan. Numbers are engineer-weeks for a single experienced
engineer with current production knowledge — they decay with team turnover._

## Strategic Cloudflare lock-in (proprietary; expensive to leave)

| Dependency | Business value | Migration cost | Notes |
|---|---|---|---|
| Durable Objects | Real-time messaging fan-out, WebSocket session affinity | **6–8 wk** | The single-instance state-of-the-art for stateful WS at edge. Closest off-CF replacement is a stateful service tier (e.g. Redis pub/sub + sticky-session LB) — different architecture, not a port. |
| Analytics Engine | Unit-economics + request log telemetry (2 datasets after 2026-04-17 prune) | **3–4 wk** | Pillar 2 dashboard depends on AE SQL. Replacement = ClickHouse or BigQuery + custom ingest worker. AE-specific SQL dialect (LIMITed JOINs, time-series functions) makes the queries themselves a porting target. |
| Hyperdrive | Neon connection pooling at edge | **1–2 wk** | A pgbouncer-equivalent pool fronted by a CF-or-other edge runtime. Latency hit on cold connections measurable; not catastrophic. |
| R2 | File storage (7 buckets) | **2–3 wk** | S3-compatible API surface; the migration cost is data transfer + signed-URL rewriter, not code changes. Egress fees from R2 are zero — actually cheaper to leave than most CF lock-in. |
| Workers AI | _(none yet — gated on pillar 5)_ | n/a | Not adopted. Listed for future awareness. |

**Total strategic lock-in if the platform had to leave Cloudflare tomorrow: ~12–17 engineer-weeks**, dominated by Durable Objects and Analytics Engine.

## Commodity / portable (cheap to leave)

| Dependency | Why portable | Migration cost |
|---|---|---|
| Hono router | Pure Web Fetch API surface; runs on any runtime that implements `Request`/`Response` | < 1 day |
| `@neondatabase/serverless` | HTTP-pgwire client, but Neon also speaks standard pg wire — swap to `pg` package | 1–2 days (mostly testing) |
| Raw SQL | No ORM coupling; queries are portable Postgres | 0 (already portable) |
| Zod, React, Vite, Tailwind | All open-source, framework-agnostic | 0 |
| Better Auth | _(removed 2026-05-04 — see issue #19)_ | n/a |

## Specific session-store reversibility (issue #19, this rip)

The Better Auth library was removed from the active runtime on 2026-05-04. Files
remained installed in `package.json` for a 1-week observation window before
Phase 1.5 uninstalls them. This window is the canonical example of the
reversibility discipline this doc formalizes:

- **Pinned versions captured pre-rip** (recoverable from any commit ≤ rip date):
  - `better-auth@^1.4.9`
  - `better-auth-cloudflare@^0.3.0`
- **BA tables (`user`, `session`, `account`, `verification`) remain in the database** until Phase 1.5. They are empty and unreferenced — no behavioral cost to keeping them.
- **Revert path during the 1-week window**: `git revert <rip-commit>` restores the imports against the still-installed deps. Auth flow returns to mixed-model in one deploy.
- **Revert path after Phase 1.5**: requires `npm install better-auth@1.4.9 better-auth-cloudflare@0.3.0` + table recreation from migrations + the `git revert`. Estimate: half day.

## Observability stack reversibility

| Dependency | Replacement | Cost |
|---|---|---|
| Sentry (`@sentry/cloudflare`) | OpenTelemetry → any OTel-compatible APM | 1–2 wk; SDK abstraction makes it cleaner than expected |
| Axiom | Datadog / Loki / ClickHouse log ingest | 1 wk; dataset schema is ours, not Axiom's, so the replacement just needs an ingest URL |
| Cloudflare Observability (worker logs, traces) | Replaced by whatever runtime we move to. Sampling config is wrangler-specific. | Bundled with the runtime move; no separate cost |

## Decision rationale captured

- **Workers AI deferred (pillar 5)** — until a real ML feature ships, adopting Workers AI adds lock-in for solution-in-search-of-a-problem reasons. When a feature lands, the lock-in cost is justified by the value; until then it isn't.
- **Hyperdrive kept despite the 1–2 wk migration cost** — the latency win on edge-resident requests is measurably load-bearing for the marketplace and dashboard pages. Removing it would be a regression visible to users.
- **Durable Objects kept despite the 6–8 wk migration cost** — replacement architectures impose worse tradeoffs (sticky-LB session affinity is a known operational pain). The lock-in is bought knowingly.
- **Analytics Engine kept despite the 3–4 wk migration cost** — the unit-economics work in pillar 2 has no payoff if rebuilt against a different metrics store first. AE is good enough for the metrics that matter; replacement is deferred until AE proves insufficient at scale.

## What this doc does NOT do

It is **not** a migration plan. It does not specify off-CF replacement architectures, vendor selections, or sequencing. It is a **cost ledger** that future-you can read in a pinch — "if we had to leave, what would it cost?" — without re-doing the analysis.

When migration becomes a real conversation, this doc is input, not output. The migration plan is its own document.

## Maintenance

Update when:
- A new strategic CF binding is adopted (add to first table)
- A binding is dropped (remove from first table; add to "specific reversibility" section if it has a window)
- A migration is actually executed (this doc becomes a post-mortem; spawn a new audit for what's left)

Do not maintain on a calendar. The decay axis is "we changed an architectural decision," not "it's been a quarter."
