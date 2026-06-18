# Backend integration tier

Drives the **real** worker (`src/worker-integrated.ts` `export default { fetch }`)
against a **throwaway Neon branch**. This is the tier the backend unit config
(`vitest.backend.config.ts`) explicitly defers — it exercises the live router,
handlers, services, and raw SQL, i.e. the 22.5k-line path that had **0% coverage**.

## Why this exists

Backend unit tests ring `utils/` + `lib/` only (pure logic). Everything that
actually broke in the last months — schema drift, the NDA table split, the Neon
call-form bug, dashboard SQL — lives in the router/handler/SQL path that those
tests never touch. This tier closes that gap by making real HTTP-shaped requests
and asserting on real responses backed by a real (branch) database.

## How it works

- `client.ts` — `TestClient` builds `Request`s and calls `worker.fetch(req, env, ctx)`
  directly. No network for the worker boundary; a cookie jar carries the
  `pitchey-session` cookie across calls so login → authed-request flows work.
- `env.ts` — `buildTestEnv()` wires `DATABASE_URL` to the branch and stubs only
  the native/external bindings (KV/R2 in-memory, queues no-op). Stripe/Resend/
  Redis/Sentry/Turnstile are intentionally absent so handlers hit their
  degraded/absent-key branches instead of real APIs.

## Running locally

1. Provision a disposable Neon branch off `pitchey-production` (Console → Branches,
   or the Neon MCP `create_branch`). Copy its **pooled** connection string.
2. Export it and run:

```bash
export TEST_DATABASE_URL='postgresql://…-pooler.…neon.tech/neondb?sslmode=require'
npm run test:integration            # or :coverage
```

The harness **refuses** to run against a production-looking URL (`env.ts`
`assertNotProd`). Never point `TEST_DATABASE_URL` at the prod branch.

## CI

Runs as its own job on the per-PR Neon branch that `neon-preview.yml` already
provisions (`db_url_with_pooler`). Kept separate from the unit suite because it
needs a DB and runs slower.

## Adding suites

One file per area under `test/integration/` (e.g. `pitches.test.ts`,
`nda.test.ts`). Use `TestClient`; log in with a demo account
(`alex.creator@demo.com` / `Demo123`) when a route needs auth. Tests run serially
(`fileParallelism: false`) against one shared branch — prefer creating your own
rows over mutating demo data, and clean up writes you don't assert on.
