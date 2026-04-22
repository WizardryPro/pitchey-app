# 2026-04-21 — pitchey-5o8 1101 root-caused; no current-code production exists

Session ran late. Diagnosis is complete. No refactor tonight. This document captures the state of the world so tomorrow-morning self has a clean picture.

## Hostname inventory

- **`pitchey.com`** → serves the `pitchey-coming-soon` Cloudflare Pages project. Marketing stub only. Not intended to serve the real frontend.
- **`pitchey.pages.dev`** → was on cavelltheleaddev CF account. **Deleted during this session.** Was serving a 4-month-old build (canonical from 2025-12-21). NXDOMAINs now after a few minutes of DNS propagation.
- **`pitchey-5o8.pages.dev`** → on ndlovucavelle CF account (account ID `002bd5c0e90ae753a387c60546cf6869`). HTTP 500 / CF error 1101 on every route. Wrangler bundler emits `/:catchall*` incompatible with its own bundled path-to-regexp v8. Reproduced on wrangler `4.77.0` (pre-session lockfile) and `4.84.1` (upgrade attempted this session, did not fix it).
- **No hostname currently serves current repo code.**

## Implication

Production does not exist in any working form. This is not a site-down incident (no users are being directed to the broken URL). This is a not-yet-launched state that was mistakenly believed to be launched for the past several weeks. The 10 PRs merged on 2026-04-20 are code-level improvements applying to a repo whose most recent *public* deployment is from 2025-12-21.

## Root cause — wrangler Pages Functions bundler bug

Wrangler's Pages Functions bundler emits **path-to-regexp v6 syntax** in the registered `routePath` entries, but the same bundle ships **path-to-regexp v8** (`../node_modules/path-to-regexp/dist/index.js`), which rejects the v6 syntax at runtime. Upstream wrangler bug — not in our code.

### Evidence

Local bundle produced via `npx wrangler pages functions build --outfile=/tmp/functions-bundle.js` (run from `frontend/`), grepped for `routePath:`:

```
200:        routePath: "/api/monitoring/envelope",   # literal, v8-compatible
207:        routePath: "/api/:path*",                # v6 syntax
214:        routePath: "/:catchall*",                # v6 syntax
```

Runtime stack trace (captured via `npx wrangler pages deployment tail <id> --project-name=pitchey --format=pretty`, 10-second subscription warmup, 5 cache-busted requests):

```
GET https://ba5015a9.pitchey-5o8.pages.dev/?cb=... - Exception Thrown @ 22/04/2026, 00:45:13
TypeError: Missing parameter name at index 11: /:catchall*; visit https://git.new/pathToRegexpError for info
```

Same trace on the newer `496be68c` deployment built with wrangler 4.84.1 — confirming the upgrade did not touch the emitter.

Wrangler's filename-to-routePath convention:
- `[[name]].ts` → `routePath: "/:name*"` (breaks)
- `[[...name]].ts` → same family
- literal-named files (like `envelope.ts`) → literal routePath (fine)

`escapeText`/`pathToRegexp` are exported from the embedded v8 library and called on line 433 of the bundle during route compilation.

## Active files in `frontend/functions/`

- `[[catchall]].ts` — SPA fallback serving `index.html` for unmatched routes. **Triggers bug.**
- `api/[[path]].ts` — same-origin API proxy to `pitchey-api-prod.ndlovucavelle.workers.dev`. **Triggers bug.** Added specifically to fix WebSocket cross-origin cookie / SameSite issues per the file's own docstring.
- `api/monitoring/envelope.ts` — Sentry tunnel (PR #3 observability work). Literal path. **Does not trigger bug.**

## Workarounds to evaluate tomorrow (all untested)

1. **Rename `[[catchall]].ts` → `_middleware.ts` at the same directory levels.** Scratch `wrangler pages functions build` with this rename produced `routePath: "/"` and `"/api"` (literals, v8-compatible) instead of `/:catchall*` / `/:path*` — but middleware semantics differ from route semantics (execution order, static-asset interaction, how `context.next()` behaves). Needs redeploy + runtime verification, not just bundle grep.
2. **Delete both catchall files, keep `envelope.ts`.** Homepage would load (static assets + `index.html`). Loses: SPA deep-link support (refresh on `/login` 404s unless `_redirects` works with a literal-path-only function — untested), same-origin API proxy (moves back to cross-origin + CORS + the cookie complexity the proxy was designed to solve), and WS auth flow.
3. **Pin `path-to-regexp` to v6.x via `npm overrides` in `frontend/package.json`.** May force wrangler's transitive dep downgrade. Risk: unrelated wrangler machinery that actually expects v8.
4. **File upstream wrangler issue** at github.com/cloudflare/workers-sdk with this exact bundle line + stack trace. Pin this independent of any workaround; others will hit it.

## `FRONTEND_URL` flip in PR #21 — honest framing

PR #21 changed the Worker's `FRONTEND_URL` from `pitchey-5o8.pages.dev` (was returning 1101) to `pitchey.pages.dev` (was stale-but-200). Tonight's earlier session described this as "fixing a latent bug where emails linked to a dead URL." In reality it moved email-link targets from one broken URL to another broken URL. Neither served current code. The stale-URL site is now also gone (deleted this session), so password-reset / Stripe-redirect / NDA emails sent since PR #21's deploy point at a dead subdomain.

Reverting the flip tonight would only re-point emails at the 1101 URL. The honest operational stance is: **do not send transactional emails until production exists.**

## What this session changed

- **Cavelltheleaddev `pitchey` Pages project deleted.** 402 historical deployments purged, then project DELETE'd via CF API. Subdomain released back to global CF namespace.
- **`frontend/package.json` + `frontend/package-lock.json`**: wrangler bumped from `^4.77.0` → `latest` (resolved 4.84.1). Did not fix the bundler bug. Currently uncommitted in working tree — safe to revert.
- **Memory file `project_pages_subdomain_model.md` rewritten** to reflect the corrected multi-account mental model.
- New deployment `496be68c` pushed to ndlovucavelle `pitchey` project (wrangler 4.84.1 build). Same 1101.

## What this session did NOT change

- Backend Worker code or deploys
- `wrangler.toml` (`FRONTEND_URL` still points at now-deleted `pitchey.pages.dev`)
- CF API token (user declined rotation — flag for follow-up)
- Any DNS record on any account
- ndlovucavelle Pages project settings or env vars

## Next-session priorities (not tonight's work)

1. **Decide target production URL.** Options:
   - (a) Fix the wrangler workaround, deploy current code to `pitchey-5o8.pages.dev` (ndlovucavelle).
   - (b) Deploy current code to a new `pitchey` project on cavelltheleaddev (the subdomain is now free again).
   - (c) Point `pitchey.com` at current code, retire the Coming Soon stub.
2. Pick a workaround from §"Workarounds to evaluate tomorrow" with fresh eyes.
3. File the upstream wrangler issue.
4. Revert the `FRONTEND_URL` change in `wrangler.toml` once a real production URL is decided, and redeploy the Worker.
5. Decide whether to commit or revert the `wrangler@4.84.1` bump left in the working tree.
