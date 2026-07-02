---
id: prompt-2026-07-02-001
date: 2026-07-02
source_signal: sig-2026-07-02-001
signal_status: confirmed
band: 1
gates: recommended
action: execute
---

> Target stack: Cloudflare Worker — single hand-rolled `RouteRegistry` (NOT Hono, NOT Express) in `src/worker-integrated.ts` · React 18 + Vite + Zustand + Tailwind on Cloudflare Pages · Neon PostgreSQL via `@neondatabase/serverless` + `postgres` driver, **raw SQL only (no ORM, Drizzle fully retired)** · **custom session auth** (`pitchey-session` UUID cookie + JWT bearer fallback — Better Auth was ripped 2026-05-04) · same-origin via Pages Functions proxy (`frontend/functions/api/[[path]].ts`)

# Batch-delete 8 confirmed orphan handler/route files

**Action:** execute — the verifier confirmed all 8 files are dead (zero active imports anywhere in `src/`). This is a deletion-only task; no source edits outside removing the files themselves.

## Background (verified — do not re-derive)

The `dead-route-sweep` audit loop has re-confirmed these 8 files across 6 consecutive nightly runs (2026-06-25 → 2026-07-02). A separate Explore verifier independently checked each file's exports against active `import` statements in `src/` (including `worker-integrated.ts`) and confirmed zero wiring. The script `find-orphans.mjs` has known false-negative bugs, so the verifier check was manual — see `signals/2026-07-02-deadroute-sweep-aggregate.md` for the full evidence chain.

These are Era 0–6 parallel-migration artefacts: handler/route files that were superseded when functionality moved into `worker-integrated.ts` as private inline methods but were never deleted. None are PROTECTED parked paths (#60/#61).

## Files to delete (8)

```
src/handlers/messaging.ts
src/handlers/pitches.ts
src/routes/creator.ts
src/routes/email-messaging.routes.ts
src/routes/investor.ts
src/routes/pitches.ts
src/routes/production.ts
src/routes/users.ts
```

Why each is dead:
- **`src/handlers/messaging.ts`** — `MessagingHandlers` class has 0 active imports anywhere in `src/`; live messaging uses `handlers/messaging-simple.ts` (11 dynamic imports in `worker-integrated.ts`).
- **`src/handlers/pitches.ts`** — `pitchesHandler`, `trendingPitchesHandler`, `newPitchesHandler` referenced nowhere in `src/`; equivalent logic is an inline private method at `worker-integrated.ts` ~line 12590.
- **`src/routes/creator.ts`** — only reference is a commented-out import at `worker-integrated.ts:359`; endpoints duplicated as private methods inside the monolith.
- **`src/routes/email-messaging.routes.ts`** — import commented out at `worker-integrated.ts:367`; instantiation also commented out at line 844; `EmailMessagingRoutes`/`EmailMessagingEnv` referenced nowhere else in `src/`.
- **`src/routes/investor.ts`** — only reference is a commented-out import at `worker-integrated.ts:360`; endpoints duplicated as private methods inside the monolith.
- **`src/routes/pitches.ts`** — only reference is a commented-out import at `worker-integrated.ts:362`; live `/api/pitches/public` is served by inline `getPublicPitches` registered at line 4013.
- **`src/routes/production.ts`** — only reference is a commented-out import at `worker-integrated.ts:361`; endpoints duplicated as private methods inside the monolith.
- **`src/routes/users.ts`** — only reference is a commented-out import at `worker-integrated.ts:363`; live user endpoints served via `routes/user-profile.ts` + inline methods.

## Pre-flight check (run before deleting)

Verify none of these files acquired a new active import since the last audit run (2026-07-02):

```bash
grep -rn \
  "messaging\.ts\|pitches\.ts\|creator\.ts\|email-messaging\.routes\|investor\.ts\|production\.ts\|routes/users" \
  src/ --include="*.ts" | grep -v "//.*import"
```

Expected: only commented-out references. If any active import appears, stop and investigate that file before deleting.

## Task

Delete all 8 files:

```bash
rm src/handlers/messaging.ts \
   src/handlers/pitches.ts \
   src/routes/creator.ts \
   src/routes/email-messaging.routes.ts \
   src/routes/investor.ts \
   src/routes/pitches.ts \
   src/routes/production.ts \
   src/routes/users.ts
```

After deletion, confirm there are no dangling type-only imports or re-exports from these files that TypeScript would catch:

```bash
npm run build:worker
```

(esbuild bundles without type-checking; this just confirms no import-resolution errors.)

## Done When

1. All 8 files deleted from the repo.
2. Pre-flight grep shows zero active import references to any of the 8 paths (commented-out refs in `worker-integrated.ts:359–367` are expected and fine — leave them as historical comments).
3. `npm run build:worker` exits 0 (no import-resolution errors).
4. `npm run type-check` (root: `npx tsc --noEmit -p tsconfig.json`) exits 0 — no new errors introduced by the deletions.
5. No PROTECTED path touched (`src/workflows/`, `src/workers/crawl4ai-worker.ts`, `src/services/console-analysis-crawler.ts` — all confirmed out of scope).

## Out of scope

- Do NOT remove the commented-out import lines at `worker-integrated.ts:359–367` — they are harmless annotations that document what was once imported; removing them would mix cleanup concerns.
- Do NOT investigate or touch `src/handlers/contracts.ts` or `src/routes/ndas.ts` — both are pending human decisions (see `prompts/2026-07-02-sig-2026-07-02-001-contracts-revive.md` and `prompts/2026-07-02-sig-2026-07-02-001-ndas-routes-intent.md`).
