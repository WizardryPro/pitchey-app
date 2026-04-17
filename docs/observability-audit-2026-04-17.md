# Observability Audit — 2026-04-17

Scope: Analytics Engine dataset usage + Sentry Session Replay PII masking.
Driven by: priority-list item #5 ("Prune unused AE datasets and verify PII masking for session replays").

## Part 1 — Analytics Engine Datasets

`wrangler.toml` declares **7** AE dataset bindings. Audit method: grep for each binding name across `src/` to classify writers, then grep for the physical dataset name to find readers (SQL API queries, dashboards, workflows).

### Findings

| Binding | Dataset | Writers | Readers | Verdict |
|---|---|---|---|---|
| `ANALYTICS` | `pitchey_metrics` | 5 files: `worker-integrated.ts`, `scheduled-handler.ts`, `metrics-api.ts`, `worker.ts`, `db/traced-operations.ts` | `metrics-api.ts` (own reads) | **Active** |
| `PITCHEY_ANALYTICS` | `pitchey_database_metrics` | 2: `database-metrics.service.ts`, `trace-service.ts` | `database-metrics.service.ts` | **Active** |
| `PITCHEY_PERFORMANCE` | `pitchey_performance_metrics` | 2: `db/traced-operations.ts`, `database-metrics.service.ts` | none found | **Write-only** — no dashboard or SQL API consumer |
| `PITCHEY_ERRORS` | `pitchey_error_tracking` | 1: `database-metrics.service.ts` | none found | **Write-only** — redundant with Sentry |
| `TRACE_ANALYTICS` | `pitchey_trace_events` | 1: `trace-service.ts` | none found | **Write-only** |
| `CONTAINER_ANALYTICS` | `pitchey_container_metrics` | **0** — only in `wrangler.toml` + docs | none | **Landfill** — prune |
| `JOB_ANALYTICS` | `pitchey_job_analytics` | **0** — only in `wrangler.toml` + docs | none | **Landfill** — prune |

### Recommendations

**Resolved 2026-04-17 (all five AE datasets pruned)**:
- `CONTAINER_ANALYTICS` and `JOB_ANALYTICS`: no writers anywhere. Removed from `wrangler.toml`.
- `PITCHEY_PERFORMANCE`, `PITCHEY_ERRORS`, `TRACE_ANALYTICS` — all three pruned. Investigation found zero readers. The only apparent reader — `searchTraces()` in `worker-integrated.ts:19644` — is a stub that builds a query string but returns `[]` with the comment "Tracing requires Analytics Engine integration — return empty until configured".
- All writers (`db/traced-operations.ts:222`, `services/database-metrics.service.ts`, `services/trace-service.ts:205`) are already guarded with `if (env.XXX)`, so removing the bindings made the writes no-ops without any code change needed.
- Net: `wrangler.toml` now declares 2 AE datasets instead of 7. Sentry covers errors, Axiom covers logs, AE holds metrics with active readers.

**Known followup**: `searchTraces()` stub endpoint still exists and lies — it returns `success: true, traces: []` as if tracing worked. It also has SQL-injection shape on `operation`/`status`/`service` query params (currently harmless because the query is never executed, but a trap for the next person who wires up the AE SQL API). Either delete the endpoint or gate it behind a `503 not configured` response until the reader is actually built.

**General rule going forward**: each AE binding should have either (a) a named dashboard or (b) a documented query in `docs/OBSERVABILITY.md`. Otherwise don't ship it.

### Pruning patch (ready to apply)

```toml
# wrangler.toml — remove:
[[analytics_engine_datasets]]
binding = "CONTAINER_ANALYTICS"
dataset = "pitchey_container_metrics"

[[analytics_engine_datasets]]
binding = "JOB_ANALYTICS"
dataset = "pitchey_job_analytics"
```

Grep first to confirm nothing imports these: `grep -rn "CONTAINER_ANALYTICS\|JOB_ANALYTICS" src/` — currently returns zero source-code hits, docs-only.

---

## Part 2 — Sentry Session Replay PII

File: `frontend/src/monitoring/sentry-config.ts`
Sample rates: 10% session / 100% on-error in prod.

### Current config

```ts
Sentry.replayIntegration({
  maskAllText: false,        // ⚠️ text content is captured
  maskAllInputs: true,       // ✅ form inputs masked
  blockAllMedia: false,      // media captured
  networkDetailAllowUrls: ['pitchey-api-prod.ndlovucavelle.workers.dev'],
  networkCaptureBodies: true,  // ⚠️ request + response bodies captured
  networkRequestHeaders: ['X-Request-ID'],
  networkResponseHeaders: ['X-Response-Time']
})
```

### Findings

**HIGH RISK — `maskAllText: false`**
Pitch content (titles, loglines, synopses, comments, messages) renders as text nodes.
Every on-error replay captures those verbatim. This is the platform's core IP. Replays are stored by Sentry for 90 days; anyone with Sentry dashboard access can read pitch content outside the platform's access controls (NDA gates become irrelevant).

**HIGH RISK — `networkCaptureBodies: true`**
Request/response bodies on the Worker origin are captured. This includes:
- `/api/pitches/:id` response — full pitch body (pre-NDA truncation is applied for watchers on some endpoints but not all).
- `/api/messages/*` — DM thread content.
- `/api/auth/*` responses — session payloads, user email addresses. (Auth *requests* containing passwords should already be stripped by Sentry's default password-field detection, but it's worth verifying.)

**MEDIUM RISK — `blockAllMedia: false`**
Uploaded pitch documents (PDFs rendered inline) or media are not blocked. Less concerning in practice because most pitch media is served from R2 with signed URLs that expire, but a replayed URL is still evidence of "user X viewed pitch Y" that escapes the platform's audit trail.

### Recommendations

Apply to `frontend/src/monitoring/sentry-config.ts`:

```ts
Sentry.replayIntegration({
  maskAllText: true,              // default-deny: mask all text
  unmask: ['.replay-safe'],       // opt-in selector for deliberately visible chrome (buttons, headings)
  maskAllInputs: true,            // unchanged — already correct
  blockAllMedia: true,            // pitch-content media is sensitive
  networkDetailAllowUrls: ['pitchey-api-prod.ndlovucavelle.workers.dev'],
  networkCaptureBodies: false,    // off by default — enable per-URL via networkRequestHeaders/ResponseHeaders if a specific diagnostic needs it
  networkRequestHeaders: ['X-Request-ID'],
  networkResponseHeaders: ['X-Response-Time', 'X-Ratelimit-Remaining'],
})
```

**Tradeoff**: `maskAllText: true` makes replays less immediately readable for debugging. The opt-in `unmask` selector lets the team mark deliberately safe chrome (nav, buttons) while keeping pitch content opaque. This matches Sentry's recommended default for user-generated-content apps.

**Verify**:
- Sentry dashboard: Project Settings → Security & Privacy → "Data Scrubbing" rules — add `$string` scrubbing for fields named `synopsis`, `logline`, `body`, `content`, `message`.
- Check that `beforeSend` already strips cookies (line 150 of sentry-config.ts — ✅ confirmed).
- Add a `privacy.html` or data-handling note linking to Sentry's 90-day retention policy if not already covered in the existing privacy policy.

---

## Summary

| Finding | Severity | Action | Status |
|---|---|---|---|
| 2 AE datasets with zero writers (`CONTAINER_ANALYTICS`, `JOB_ANALYTICS`) | Low | Remove from `wrangler.toml` | ✅ Done 2026-04-17 |
| 3 AE datasets write-only (`PITCHEY_PERFORMANCE`, `PITCHEY_ERRORS`, `TRACE_ANALYTICS`) | Medium | Remove writer+binding (no readers found) | ✅ Done 2026-04-17 |
| Sentry Replay `maskAllText: false` captures pitch content | **High** | Set `maskAllText: true`, add unmask selector | ✅ Done 2026-04-17 |
| Sentry Replay `networkCaptureBodies: true` captures auth + pitch bodies | **High** | Set to `false` | ✅ Done 2026-04-17 |
| `blockAllMedia: false` | Medium | Set to `true` | ✅ Done 2026-04-17 |
| `searchTraces()` stub endpoint + SQL-injection shape | Low (currently) | Return 503 TRACING_NOT_CONFIGURED | ✅ Done 2026-04-17 |
| **Sentry tunnel `envelope.ts` used `request.text()`** — lossy-decoded binary replay payloads, causing upstream 400s `"missing newline after header or payload"`. Discovered during staging replay validation. **No session replays had reached Sentry since the tunnel was deployed.** | **High** | Switch to `request.arrayBuffer()`, forward raw bytes | ✅ Done 2026-04-17 |

### Staging replay validation — 2026-04-17

Procedure (via chrome-devtools MCP against staging preview deploy `28c057bb.pitchey-5o8.pages.dev`):
1. Deployed the new replay config + tunnel fix to a preview branch
2. Logged in as demo creator, navigated to `/creator/pitch/262` (pitch with real synopsis content: "Dr. Maya Chen", NASA, solar storm, etc.)
3. Fired an unhandled `throw new Error(...)` to trigger the error-sampled replay flush
4. Inspected outgoing envelope POSTs to `/api/monitoring/envelope`

Results:
- ✅ Built JS minified config confirmed: `maskAllText:!0`, `blockAllMedia:!0`, `networkCaptureBodies:!1`
- ✅ `sentryReplaySession` in sessionStorage with `sampled: "buffer"` — replay recording active
- ✅ 3 envelope POSTs: session (250), error event (251, 200 + event id), replay segment (252, 200 + event id `2917e6f33690415f9fdee03dd7071b02`)
- ✅ Plaintext portions of envelopes: **zero** occurrences of "Maya Chen", "NASA", "solar storm", "Echoes of Tomorrow", "New Mexico", "daughter survives" (case-insensitive, full-file regex)
- ❓ rrweb recording payload is zlib-compressed; can't be decompressed in-transit without logging PII to Workers observability. Final visual verification (Sentry dashboard → Replays → scrub `2917e6f3...`) is still a human eyeball task.

Tunnel bug is the more important finding — before the fix, **no replay had ever successfully reached Sentry**, which meant the whole Layer 4-adjacent replay capability was dark. Anyone relying on on-error replays for debugging would have seen "nothing captured" and assumed the sample rate was unlucky.

Next: walk a real error scenario in staging after the replay config deploys, confirm pitch text renders as masked blocks. If legitimately-visible chrome (buttons, nav) is masked, add `replay-safe` class to those components.
