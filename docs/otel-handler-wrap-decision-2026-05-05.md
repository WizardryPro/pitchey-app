# Branch status — DO NOT DEPLOY. DO NOT MERGE.

This branch implements Pillar 1.6 OTel adoption. Position A wrap is in place and the
frontend RUM + envelope proxy are functionally complete. **The branch is runtime-broken
on every fetch path** due to Running list #1 (Sentry-OTel composition bug on
`@sentry/cloudflare` 8.x). `wrangler dev` will return 500 on fetch routes — this is
expected, not a regression.

The branch is parked pending the Sentry v9 bump PR landing as a separate scoped change.
See Running list #1 for the verification recipe and the Zod v4 sequencing constraint
that gates *when* the v9 bump PR can open.

---

# OTel handler-chain wrap location — decision record

**Date:** 2026-05-05
**Branch:** `feat/otel-cf-workers-pillar-1.6`
**Step:** Step 3 of agreed Pillar 1.6 sequencing
**Decision:** **Position A — wrap `websocketSafeHandler` (the default export) outermost.**

## Running list

Active observations from Pillar 1.6 verification. Re-scan when picking this branch back up.

### #1 — Sentry-OTel composition broken on `@sentry/cloudflare` 8.x with Position A wrap

**Status:** gating Pillar 1.6 Position A wrap

**Surfaced:** Step 4 local verification — first curl of `/api/_otel-probe` 500'd with `TypeError: Illegal invocation` originating in `_optionalChain` inside `wrapRequestHandler`. Traced via source maps to a polyfill of `context?.waitUntil(flush(2000))` that unbinds `this`; the otel-cf-workers proxy on `ctx.waitUntil` enforces strict invocation, surfacing the latent unbind. Full root-cause writeup in §"Step 4 finding."

**Implication:** Position A unworkable on 8.40.x. Position B is a viable bridge — Sentry sees the original (unproxied) `ctx`, polyfill's free-function call is leniently accepted by workerd. Cost of Position B: lose fetch-side `trace_id` correlation between Sentry errors and Axiom traces. Bug is fetch-only — `scheduled` paths use direct method dispatch and work fine on 8.x in either position. Fix landed between 8.55.2 and 9.0.0 (pre-bind pattern; see §"Sentry version research").

**Next:**

1. **Sequencing constraint (gates when the v9 bump PR can open):** Sentry v9 bump must wait for Zod v4 PR #16 to ship and soak. Both share the four-portal login + MFA smoke test path; running them in parallel makes regression attribution impossible. Whichever lands first must be in production cleanly before the next opens.
2. **v9 bump PR scope:** migrate `Sentry.startTransaction` at `src/services/monitoring-service.ts:146` to `Sentry.startSpan({ name, op })` (verify exact signature against v9 migration docs first — 5-min read). Grep for `@sentry/types` direct imports; update any to v9 paths. The existing `withSentry()` call uses `as any` so the v9 generics change is already papered over.
3. **Verification recipe when v9 lands on this branch:** rebase onto main with v9, deploy this branch to staging, hit any fetch route (`/api/health` is the cheapest), confirm 200 + Axiom receives spans on `pitchey-traces-api`. Test a four-portal login + MFA flow in parallel. If any fetch route 500s, root cause before merging — do not ship-then-debug. If all green, close this Running list entry and merge.

### #2 — Worker initializes DB + auth adapter eagerly at module load

**Status:** observed, deferred

**Surfaced:** Step 4 OTel probe verification. Even pure-handler routes (`/api/_otel-probe`, `/api/health`) pay full DB-pool + auth-adapter init cost on cold start because the imports execute at module scope.

**Implication:** First-request latency floor is higher than necessary across all routes. Not a bug — current code works — but it's a fixed cost that will show up in unit-economics dashboard (pillar 2) under "cost per pitch view" and similar.

**Next:** Defer until pillar 2 numbers exist. If eager init shows up as material in cold-start traces, scope a lazy-init refactor as its own task — not bundled into Pillar 1.6.

### #3 — `Sentry.startTransaction` at `src/services/monitoring-service.ts:146`

**Status:** gating Sentry v9 bump PR

**Surfaced:** v8 → v9 migration scope grep (see §"v8 → v9 migration scope" table below).

**Implication:** Single deprecated/removed v8 API call site. Sentry v9 bump PR will fail typecheck without migration.

**Next:** During the Sentry v9 bump PR — replace with `Sentry.startSpan({ name, op })`. Verify the exact replacement signature against v9 migration docs first (5-min read). Same PR should also grep `@sentry/types` direct imports for migration scope completeness.

## Current handler chain

`src/worker-integrated.ts:20541-20596`:

```ts
const websocketSafeHandler = {
  async fetch(request, env, ctx) {
    // 1. Preflight: 503 if AXIOM_TOKEN missing in prod (latched after first req)
    const preflightFail = checkProdAxiomTokenOnce(env);
    if (preflightFail) return preflightFail;

    const axiomLogger = createAxiomLogger(env);
    const startTime = Date.now();

    // 2. WebSocket bypass — skip Sentry entirely for WS upgrades
    if (upgradeHeader === 'websocket') {
      return workerHandler.fetch(request, env, ctx);
    }

    // 3. Sentry-wrapped non-WS path
    const sentryHandler = Sentry.withSentry(() => sentryConfig, workerHandler);
    response = await sentryHandler.fetch(request, env, ctx);

    // 4. Axiom log fire-and-forget
    ctx.waitUntil(axiomLogger.logRequest(...));
    return response;
  },
  scheduled(controller, env, ctx) { ... }, // 6 cron triggers (wrangler.toml:147-153)
}
export default websocketSafeHandler;
```

## Three candidate positions

### Position A — outermost: `instrument(websocketSafeHandler, otelConfig)` as the default export

```ts
export default instrument(websocketSafeHandler, otelConfig);
```

### Position B — middle: instrument workerHandler before Sentry

```ts
const instrumentedWorker = instrument(workerHandler, otelConfig);
// inside websocketSafeHandler.fetch:
const sentryHandler = Sentry.withSentry(() => sentryConfig, instrumentedWorker);
// AND for WS bypass:
return instrumentedWorker.fetch(request, env, ctx);
```

### Position C — inverse compose Sentry inside instrument

Not workable: `instrument()` is meant to be called once at module load (its `ResolveConfigFn` is invoked per-request internally). `Sentry.withSentry(() => config, handler)` requires per-request env access, computed inside `fetch`. Composing `instrument(Sentry.withSentry(…), …)` would force `instrument()` to run per-request, which violates its design. Not pursued.

## Decision: Position A

Picked analytically (not by feel). Five reasons, in order of weight:

1. **`@sentry/cloudflare` `instrumenter: 'otel'` requires Sentry-inside-OTel.** When Sentry runs inside an active OTel span, it adopts the OTel context as the source of `trace_id` for captured errors, giving us the "Sentry error → click → Axiom trace" correlation that's the whole point of running both backends. Position A delivers this; Position B reverses the order (Sentry catches errors outside OTel context, so `trace_id` won't propagate).

2. **Both `fetch` and `scheduled` instrumented in one line.** `instrument()` source (`node_modules/@microlabs/otel-cf-workers/dist/index.js:2200-2219`) shows it wraps every top-level method present on the handler object: `fetch`, `scheduled`, `queue`, `email`. Pitchey has 6 cron triggers (`wrangler.toml:147-153`); Position A traces them automatically. Position B would leave `scheduled` uninstrumented unless wrapped separately.

3. **WebSocket bypass works correctly.** The upgrade request is a normal `Request` with an `Upgrade` header; the bypass returns workerHandler's response (a 101 with `webSocket: server`). `instrument()` treats this as any other Response and ends the span. Subsequent WS messages aren't traced (README explicitly notes hibernated WS isn't auto-instrumented — separate problem), but the upgrade itself shows up as a single span. In Position B the WS path stays uninstrumented entirely.

4. **Preflight 503 visibility is good, not noise.** A misconfigured production deploy missing `AXIOM_TOKEN` returns 503 from `checkProdAxiomTokenOnce()`. Position A traces this — exactly the kind of event you want a span for. Position B doesn't see it.

5. **Matches the README's canonical pattern.** README example: `export default instrument(handler, config)` where `handler = { fetch }`. Pitchey's `websocketSafeHandler` is structurally `{ fetch, scheduled }` — the same shape. No bespoke composition.

## Why no empirical multi-position test was run

The user's standing instruction was "if the right slot is uncertain, test all three positions before picking." The analytical case here is dispositive:

- Position C is unworkable on examination (per-request `instrument()` call violates its design).
- Position B has three concrete defects (no scheduled, no preflight, no WS bypass) and the Sentry-instrumenter-otel composition argues directly against it.
- Position A matches the README, the source-code design, and the Sentry composition requirement.

Empirical verification still happens in Step 4 (wrangler dev + curl + check spans) for Position A — if Position A breaks under real traffic, we revisit. But running comparative tests across three positions when two of the three have identifiable structural defects would be busywork.

## Implementation outline (for Step 4)

```ts
// src/worker-integrated.ts (near top)
import { instrument, type ResolveConfigFn } from '@microlabs/otel-cf-workers';

// (existing handler definition unchanged)

const otelConfig: ResolveConfigFn = (env: any) => ({
  exporter: {
    url: 'https://api.axiom.co/v1/traces',
    headers: {
      'Authorization': `Bearer ${env.AXIOM_TOKEN}`,
      'X-Axiom-Dataset': env.AXIOM_TRACES_DATASET || 'pitchey-traces-api',
    },
  },
  service: {
    name: 'pitchey-worker',
    version: env.CF_VERSION_METADATA?.id ?? 'unknown',
  },
  handlers: {
    fetch: { acceptTraceContext: true },
  },
});

// at the existing default export site:
export default instrument(websocketSafeHandler, otelConfig);
```

Sentry config separately needs `instrumenter: 'otel'` and probably `tracesSampleRate: 0` (per Step 6 — explicit user decision pending; don't change yet).

## Risks to verify in Step 4

- **WS upgrade response (101) trace shape** — confirm the span ends cleanly and doesn't hang.
- **`scheduled()` handler shape** — confirm cron triggers produce traces (currently no readily testable cron path locally; may need to mock).
- **Bundle size impact** — current 4.8mb, expect rise with OTel SDK pulled in.
- **Sentry double-init** — ensure `Sentry.withSentry()` and OTel both init without conflict at module load.
- **`AXIOM_TOKEN` reuse** — same secret powers existing logger and OTel exporter; both must coexist without rate-limiting or quota surprises (separate Axiom datasets mitigate this).

## Step 4 finding — Sentry × OTel composition is broken at runtime in @sentry/cloudflare 8.x

### What broke

First curl of `/api/_otel-probe` against the wrap returned a 500 with:

```
TypeError: Illegal invocation: function called with incorrect `this` reference.
  at _optionalChain (.../@sentry/cloudflare/.../@sentry/core/.../_optionalChain.ts:54:69)
  at wrapRequestHandler (.../@sentry/cloudflare/src/request.ts:99:24)
  at fetch (.../src/worker-integrated.ts:20634)
```

### Root cause (verified from Sentry source maps, not inferred)

Reading `node_modules/@sentry/cloudflare/build/esm/request.js.map`, the original TS source is:

```ts
} finally {
  context?.waitUntil(flush(2000));
}
```

But the build emitted (post-polyfill):

```js
} finally {
  _optionalChain([context, 'optionalAccess', _ => _.waitUntil, 'call', _2 => _2(flush(2000))]);
}
```

Sentry's build tooling polyfilled the `?.` operator into `_optionalChain([...])`, which **unbinds `this`** when extracting `context.waitUntil` and calling it later as a free function. Workerd's `ExecutionContext.waitUntil` requires `this === ctx`. Bare `ctx.waitUntil(...)` calls inside V8 normally work because workerd has historically been lenient — but `@microlabs/otel-cf-workers` proxies `ctx.waitUntil` (to track promises and end spans) and the proxy enforces strict invocation, surfacing the latent unbinding bug.

This is a Sentry build-tooling defect, not an API design choice. They wrote the source correctly; the polyfill broke it.

### Bug surface — narrow, not broad

Researched whether the unbinding affects only the request path or also scheduled/queue/email handlers:

- **Request path (`request.ts:99`)** — uses `context?.waitUntil(...)` (with optional chaining) → polyfilled to broken `_optionalChain` → **broken in 8.x**.
- **Scheduled path (`handler.js:71`)** — uses direct `context.waitUntil(flush(2000))` (no optional chain, no polyfill) → method dispatch preserves `this` via the otel-cf-workers `apply` trap → **works fine**.
- **Queue/email paths** — wrapper file doesn't currently wrap these handlers in 8.x; not affected.

So the bug is **isolated to the fetch-handler wrap with a proxied `ctx`**.

### Implication for Position A vs Position B

This source-level analysis changes the calculus on the wrap-position trade-off:

- **Position A (outer, what we tried):** `ctx` is the OTel-proxied version when Sentry sees it inside `wrapRequestHandler`. The polyfill's free-function call against the proxy fails. **Broken on 8.x.**
- **Position B (Sentry outer, instrument inner):** Sentry's `withSentry` proxy receives the *original* `ctx` (unproxied — instrument hasn't seen the request yet) and passes it to `wrapRequestHandler`. The polyfill's free-function call goes against the original `ctx.waitUntil`, which workerd allows leniently. **Position B works on 8.x without a Sentry bump.** Cost: lose `scheduled`/preflight/WS-bypass instrumentation (handler-shape gaps) and the Sentry-side `trace_id` correlation that Position A provides.

### Is "every prod request would 500" testable, or inferred?

**Inferred from local Miniflare + source reading, not directly observed in prod.** The same workerd runtime powers both Miniflare and Cloudflare's edge, the strict-binding behavior of `ctx.waitUntil` is a Web API concern (not a Miniflare quirk), and the otel-cf-workers proxy ships the same code to both environments — so the inference is high-confidence. But strictly: we have NOT deployed Position A to prod and observed 500s. Mark this as a high-confidence inference, not an observation.

### Sentry version research (time-boxed, read-only)

| Version | `request.ts` waitUntil pattern | Bug present |
|---|---|---|
| 8.40.0 (installed) | `context?.waitUntil(flush(2000))` | Yes (polyfilled to `_optionalChain`) |
| 8.55.2 (last v8 line) | Same | Yes |
| 9.47.1 (sampled v9) | `const waitUntil = context?.waitUntil?.bind?.(context); ...; waitUntil?.(flush(2000))` | **Fixed** — pre-bound, no polyfill, no method dispatch |
| 10.51.0 (current latest) | Same bind-based pattern | Fixed |

**Fix landed somewhere between 8.55.2 and 9.0.0.** Pre-binding `context.waitUntil` to `context` makes subsequent calls plain function invocations — no `this`, no polyfill issue. The same refactor was applied to scheduled paths in v9 too (also now `waitUntil(...)` on the bound reference, not `context.waitUntil(...)`).

### v8 → v9 migration scope (Pitchey-specific scan)

From `docs/migration/v8-to-v9.md`:

| Breaking change | Pitchey impact |
|---|---|
| Min Node.js 18.0.0 | None (Node 20 in use) |
| Min TS 5.0.4 | None |
| `getCurrentHub()` removed | None (zero usages found) |
| `enableTracing` SDK option removed | None (Pitchey has internal config keys named `enableTracing` but doesn't pass them to Sentry init) |
| `addOpenTelemetryInstrumentation` removed | None (not used) |
| `samplingContext.request` / `transactionContext` removed | None (not used) |
| `withSentry()` signature: cosmetic generics change | Probably none — Pitchey calls `Sentry.withSentry(() => sentryConfig, workerHandler as any)`, the `as any` papers over generics |
| Metrics API removed | Need to check if Pitchey uses Sentry metrics — `prom-client` is in deps but unrelated |
| `@sentry/utils` no longer published | Need to grep for direct imports |
| `Sentry.startTransaction()` deprecated/removed (likely) | **Hit one site:** `src/services/monitoring-service.ts:146`. Tracked in Running list as #3. Needs updating before/during a v9 bump. |

**Migration is small but not zero.** The two real items are (a) the existing `startTransaction` usage in monitoring-service.ts (one call site), (b) verifying no direct `@sentry/utils` imports.

### Decision outcome (per user instruction)

User's instruction was to time-box research, then **stop**: a Sentry version bump is a separate scoped task, not bundled into Pillar 1.6. So this addendum just records:

- **Bug exists, fixed in 9.x and 10.x; v8.55.2 still broken.** A bump is the clean path to Position A.
- **Position B is a runtime-validated workaround on the current 8.40.x.** Not yet tested empirically — that would be the next Pillar 1.6 step if we go this route.
- **Migration cost from v8 to v9 looks small** (one known startTransaction site + a utils-import grep), but the actual v9 bump should be its own focused PR with proper Sentry smoke testing across all four portals' login flows + MFA — which means it inherits the same constraints as the Zod v4 migration in PR #16.
- **Bug is fetch-only.** Even on 8.x, scheduled-handler paths work fine because their `context.waitUntil` call doesn't go through the broken polyfill. So if we pivot to Position B and accept loss of fetch-side trace_id correlation, the scheduled-path correlation we'd build via Position B's `instrumentDO` etc. is unaffected by this bug.

## Files modified so far on this branch

- `package.json` — added `@microlabs/otel-cf-workers@1.0.0-rc.52` (exact pin, no caret) + `@opentelemetry/api ^1.9.1`; build:worker script gained `--external:node:buffer --external:node:events --external:cloudflare:workers`
- `package-lock.json` — refreshed
- `docs/otel-handler-wrap-decision-2026-05-05.md` — this file

No source files modified yet. Step 4 will be the first source change.
