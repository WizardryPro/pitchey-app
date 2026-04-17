# Observability — 5-Layer Stack

Current observability architecture for Pitchey production. Each layer answers a different question; no redundancy.

| Layer | Tool | Question it answers |
|-------|------|---------------------|
| Browser | chrome-devtools MCP | What is the user actually seeing? |
| Edge | Cloudflare Workers Observability | How is the Worker behaving? |
| Errors | Sentry (`@sentry/cloudflare`) | What broke? |
| Logs | Axiom | What happened at `$time`? |
| Metrics | Analytics Engine + Postgres | How often does `$thing` happen? |

Historical evolution of this stack is in `PLATFORM_EVOLUTION.md` (Era 4).

---

## Layer 1 — Browser (chrome-devtools MCP)

For CLI-based browser analysis when debugging frontend bugs or performance issues.

**Launch Chrome with remote debugging:**
```bash
google-chrome-stable --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
```

**Targets:**
- Staging: `https://pitchey-5o8.pages.dev`
- Production: `https://pitchey.com`

**Key MCP tools:**

| Tool | Purpose |
|------|---------|
| `navigate_page` / `take_snapshot` / `take_screenshot` | Navigate, inspect a11y tree, visual capture |
| `fill_form` + `click` + `wait_for` | Login with demo accounts, drive UI |
| `list_console_messages` / `list_network_requests` | Console errors, API call status codes |
| `get_network_request` | Response body, headers, timing for specific request |
| `lighthouse_audit` / `performance_start_trace` | Performance audits and traces |
| `evaluate_script` / `take_memory_snapshot` | Run JS in page, heap snapshots |

---

## Layer 2 — Edge (Cloudflare Workers Observability)

Enabled via `wrangler.toml`:
```toml
[observability]
enabled = true

[observability.logs]
enabled = true
head_sampling_rate = 1.0
invocation_logs = true
persist = true
```

100% log sampling. Automatic Tracing captures request duration, CPU time, and subrequests without manual instrumentation.

**Access:**
- Dashboard: Workers & Pages → `pitchey-api-prod` → Logs
- CLI live tail: `wrangler tail --format=json`
- MCP query: Cloudflare MCP `telemetry/query` with `view: "events"` and `$metadata.service = "pitchey-api-prod"` filter

**Schema drift detection pattern:**
```js
telemetry/query → view: "events", filters: [
  { key: "$metadata.service", operation: "eq", value: "pitchey-api-prod" },
  { key: "$metadata.level", operation: "eq", value: "error" }
]
```
Look for `relation "X" does not exist` (missing table) or `column X.Y does not exist` (missing column).

---

## Layer 3 — Errors (Sentry)

`@sentry/cloudflare` with `withSentry()` wrapper. Frontend uses `@sentry/react` configured in `frontend/src/monitoring/sentry-config.ts`.

**Configuration (Worker, via `wrangler.toml`):**
```toml
SENTRY_DSN = "https://..."
SENTRY_ENVIRONMENT = "production"
SENTRY_TRACES_SAMPLE_RATE = "0.1"
```

**Frontend config highlights:**
- 10% trace sampling in prod, 100% replay on error
- `tracePropagationTargets` set so traces flow frontend → backend
- `beforeSend` filters out 401/403/404 and auth-timing noise

**Use Sentry for:**
- Exceptions with stack traces
- Brute-force auth alerts (emitted from `src/lib/auth-observability.ts`)
- Performance regressions (transactions)
- Release tracking

**Do not use Sentry for:**
- Structured request logs → Axiom
- High-cardinality metrics → Analytics Engine
- "What happened at 3:47 AM" forensics → Axiom

---

## Layer 4 — Logs (Axiom)

Dataset: `pitchey-logs`. Token stored as worker secret (`AXIOM_TOKEN`). Emitted by `src/lib/production-logger.ts` — structured JSON with auto-redaction and requestId/traceId propagation.

**Setup (one-time):**
1. Create Axiom account (free tier: 500GB/month ingest)
2. Create dataset `pitchey-logs`
3. Generate API token with ingest permissions
4. `wrangler secret put AXIOM_TOKEN`
5. `wrangler.toml`: `AXIOM_DATASET = "pitchey-logs"`

**Useful APL queries:**

```apl
// Recent errors
['pitchey-logs']
| where level == "error"
| where _time > ago(1h)
| order by _time desc

// Slow requests (>1s)
['pitchey-logs']
| where duration > 1000
| summarize count() by bin(_time, 5m), path

// Auth failures by IP (brute force hunting)
['pitchey-logs']
| where authEvent == "login_failed"
| summarize attempts = count() by ip
| where attempts > 3
| order by attempts desc

// Failed logins spike (15min window)
['pitchey-logs']
| where authEvent == "login_failed"
| where _time > ago(15m)
| summarize failures = count()
| where failures > 20
```

---

## Layer 5 — Metrics (Analytics Engine + Postgres)

2 Analytics Engine datasets configured in `wrangler.toml` (pruned 2026-04-17 from 7 — see `observability-audit-2026-04-17.md` for what was removed and why):

| Binding | Dataset | Purpose |
|---------|---------|---------|
| `ANALYTICS` | `pitchey_metrics` | General request/app metrics |
| `PITCHEY_ANALYTICS` | `pitchey_database_metrics` | DB query timing, row counts |

**Principle going forward**: don't add an AE binding without a named reader (dashboard, SQL API query, or alert rule). Error tracking lives in Sentry; request logs in Axiom; AE is for metrics that have an active consumer.

Plus Postgres tables `request_logs` and `error_logs` for persistent, queryable metrics history (30-day retention).

**Query via Cloudflare GraphQL API** (Analytics Engine datasets are queryable per-account with a SQL-like GraphQL schema). See `docs/ANALYTICS_ENGINE_ARCHITECTURE.md` for query examples.

---

## Auth Observability

`src/lib/auth-observability.ts` wires Better Auth hooks into the stack.

**Tracked events:**

| Event | Level | Notes |
|-------|-------|-------|
| `login_success` | info | Includes portal, method, IP |
| `login_failed` | error | Feeds brute-force detection |
| `logout` | info | |
| `signup` | info | |
| `session_created` / `session_expired` | info/warn | |
| `password_reset_requested` | warn | |
| `two_factor_enabled` | info | |
| `account_locked` | error | 5 failures / 15min trigger |
| `suspicious_activity` | error | Alerts Sentry |

**Brute-force / credential stuffing detection:**
- 5+ failed logins on same account in 15 min → account locked
- 10+ failed logins from same IP in 15 min → alert (credential stuffing)
- Impossible-travel detection (distant IP geolocations on same session)

---

## Health Check

`GET /api/health` exercises all external dependencies with 3-second timeouts:
- Postgres (Neon)
- Workers KV
- R2 (head check)
- Resend (email)
- Better Auth (session endpoint)

Used by the Daily Health Check CI workflow and by uptime monitoring.

---

## Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time | 2000 ms | — |
| Error rate | 1% | 5% |
| Worker CPU | 45 ms | 50 ms (CF hard limit) |
| Cache hit rate | < 60% | — |
| Login failures (same account) | 5 / 15 min | — |
| Login failures (same IP) | — | 10+ / 15 min |

---

## Anti-Pattern: Silent `.catch(() => default)` on DB queries

Handlers across `src/handlers/` use patterns like:

```ts
const rows = await sql`SELECT SUM(view_duration) AS total FROM pitch_views`
  .catch(() => [{ total: 0 }]);
```

This swallows schema errors — a `column view_duration does not exist` becomes a silent zero. The consumption gate feature was broken for weeks because of this exact pattern.

**Fix:** replace with a helper that `Sentry.captureException`s the swallowed error before returning the default. Grep `src/handlers/` for `.catch(() =>` to find candidates.

---

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `SENTRY_DSN` | Yes | Sentry Data Source Name | — |
| `SENTRY_ENVIRONMENT` | No | Environment tag | `production` |
| `AXIOM_TOKEN` | No* | Axiom API token | — |
| `AXIOM_DATASET` | No | Axiom dataset name | `pitchey-logs` |
| `LOG_LEVEL` | No | Minimum log level | `info` |
| `SLOW_QUERY_THRESHOLD_MS` | No | Slow query threshold | `1000` |

\* Axiom is optional but recommended for full observability.

---

## Troubleshooting

**Logs not appearing in Axiom:**
1. `wrangler secret list` — verify `AXIOM_TOKEN` is set
2. Check token has ingest permissions on the correct dataset
3. Check Axiom status page

**Missing metrics:**
1. Analytics Engine takes 1–2 minutes to appear
2. Verify binding names in `wrangler.toml` match code references
3. Check the worker actually calls `.writeDataPoint()` on the binding

**Sentry not receiving errors:**
1. Verify `SENTRY_DSN` is correct and not redacted in a sanitized config
2. Check error level — `beforeSend` filters out 401/403/404 intentionally
3. Verify Sentry project quota

---

## Related Docs

- `docs/LOGGING.md` — production-logger conventions
- `docs/SENTRY_ERROR_TRACKING.md` — Sentry-specific setup and dashboards
- `docs/monitoring-guide.md` — operational runbook
- `docs/ANALYTICS_ENGINE_ARCHITECTURE.md` — metrics schema details
- `docs/PLATFORM_EVOLUTION.md` — how the stack got built (Era 4)
