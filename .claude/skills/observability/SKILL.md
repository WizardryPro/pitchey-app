---
name: observability
description: Use when working on tracing, logging, monitoring, Sentry, or Axiom integration
triggers:
  - observability
  - tracing
  - sentry
  - axiom
  - monitoring
  - logging
  - metrics
  - analytics engine
  - health check
---

# Pitchey Observability Stack

5 layers — browser, edge, errors, logs, metrics.

## Key Files

| Layer | File | Purpose |
|-------|------|---------|
| Sentry (backend) | `src/worker-integrated.ts` | `withSentry()` wrapper, 10% trace sampling |
| Sentry (frontend) | `frontend/src/monitoring/sentry-config.ts` | Init, replay, `beforeSend` filter |
| Axiom | `src/middleware/axiom-logging.ts` | Structured request logs via `ctx.waitUntil` |
| Axiom client | `src/lib/observability.ts` | `AxiomClient` class, `createAxiomLogger(env)` |
| Query logging | `src/db/logged-connection.ts` | `LoggedDatabase` — timing, Sentry breadcrumbs |
| Trace context | `src/db/trace-context.ts` | `AsyncLocalStorage<TraceContext>` for per-request traces |
| Production logger | `src/lib/production-logger.ts` | Structured JSON, auto-redaction, requestId propagation |
| Auth observability | `src/lib/auth-observability.ts` | Login/signup/session events, brute force detection |
| Health checks | `src/handlers/health-monitoring.ts` | DB, KV, R2, Resend, Better Auth (3s timeouts) |
| CORS/response | `src/utils/response.ts` | `getCorsHeaders()` — must include trace headers |

## Wrangler Config

```toml
# wrangler.toml
[observability]
enabled = true

[observability.logs]
enabled = true
head_sampling_rate = 1.0
invocation_logs = true
persist = true

# 7 Analytics Engine bindings
# pitchey_metrics, pitchey_database_metrics, pitchey_performance_metrics,
# pitchey_error_tracking, pitchey_trace_events, pitchey_container_metrics, pitchey_job_analytics
```

## Secrets

- `SENTRY_DSN` — in wrangler.toml (not a secret, it's a public DSN)
- `AXIOM_TOKEN` — `wrangler secret put AXIOM_TOKEN`

## Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time | 2000ms | — |
| Error rate | 1% | 5% |
| Worker CPU | 45ms | 50ms (CF limit) |
| Cache hit rate | <60% | — |
| Login failures | 5/15min | 10+ same IP |

## Live Debugging

```bash
# Stream all logs
npx wrangler tail pitchey-api-prod --format pretty

# Errors only
npx wrangler tail pitchey-api-prod --status error

# SQL drift detection
npx wrangler tail pitchey-api-prod --format json | grep "does not exist"
```

## Deep Reference

See `docs/OBSERVABILITY.md`, `docs/LOGGING.md`, `docs/SENTRY_ERROR_TRACKING.md`, `docs/monitoring-guide.md`
