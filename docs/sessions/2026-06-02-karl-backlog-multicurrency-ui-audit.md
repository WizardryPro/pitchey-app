# Session 2026-06-02 — Karl backlog, multi-currency, UI↔backend drift audit

Branch `docs/coverage-notes-scope-and-next-actions` → main, deployed via CI (worker + Pages) per PR. All verified against live prod (`pitchey-5o8.pages.dev` / `pitchey-api-prod.ndlovucavelle.workers.dev`).

## Reconciliation (Step 0)
Found a **split-brain prod**: the activity-feed pivot worker was a local-only `wrangler deploy`, frontend was main. Pushed + merged the pivot (PR #160) so CI redeploys both from one main. (Detail: any push to main auto-deploys both surfaces — never leave prod on a manual deploy of an unmerged branch.)

## Karl feedback backlog (P1–P7) — shipped + verified
- **P1 persistence** (#161): profile cache footgun (`public,max-age=300`→`private,no-store`), pitch docs FREE (was 10cr/doc, 402'd first upload), upload linkage surfaced (`mutateOrThrow`), PitchEdit loads existing docs.
- **P2** (#162): pitch documents moved out from under the cover image into their own section.
- **P3** (#163): shared `QuickActionsPanel` on creator/production/investor + Share Profile (creator/production).
- **P6** (#164): public `/pricing` (from `subscription-plans`), footer (Pricing→/pricing, removed dead Format, tagline "Connecting stories since 2026."), Contact form now emails info@ via new `POST /api/contact`. Terms/Privacy already real legal copy.
- **P4** (#165): credits currency coherence — `getCreditsBalance` USD→EUR; per-credit cost 2dp over effective credits.
- **P5** (#166/#167): feedback names follow the reviewer's `is_anonymous` choice (dropped owner/NDA viewer gate); email-shaped reviewer names masked to local part.
- **P4 "first time free"** (#170): was the static `"First month free (12 month contract)"` plan bullet (untrue at checkout — no trial); removed from all tiers.
- **P7 verification** (#167): OpenCorporates lookup for non-UK/US ('other') companies; gated on `OPENCORPORATES_API_KEY` (unset → manual fallback).
- **P7 multi-currency** (#168 build, #169 activate): EUR/GBP/USD, same numeric amount, via Stripe `currency_options` prices (created by `scripts/stripe-create-multicurrency-prices.mjs`). `MULTI_CURRENCY_ENABLED=true`; `/api/locale` geo-detects; verified GBP/USD/EUR `cs_live_` sessions.

## NDA "Enhanced Information" gating (#171)
Teaser/Request-NDA was shown on every pitch regardless of content → signing dead-ended at "Unavailable". Backend `getPitch` now returns `hasProtectedContent`; PitchDetail gates the section on `requireNDA || hasProtectedContent || protectedContent`. (NB: `PublicPitchView` still unguarded — Batch B below.)

## UI↔backend drift audit + fixes
5-agent read-only audit of "UI claims something the backend doesn't back." Prevention: vitest now RUNS in CI (was never executed — lint+typecheck+build only), non-blocking until the ~79 stale-mock failures are burned down (#172).

**Batch A — Critical (shipped #172, verified):** settings-save 500 (`settings.ts` `createDatabase`→`neon` ×8; PUT settings 500→200), Request-NDA 404 (`lib/api.ts`→`/api/ndas/request`), currency `$`→`€` (`formatters.ts` + InvestorStats + investor-sidebar), notification-prefs frontend routing.

**Locale-aware currency:** `formatCurrency`/`formatBudgetCompact` now follow the user's selected currency via `getActiveCurrency()` (presentation/symbol only — NOT FX-converted; exact for pricing, symbol-only for stored EUR figures).

## Open / pending
- **notification_preferences schema drift** — `/api/notifications/preferences` GET+POST still 500: `notification.service.ts` writes columns (`email_notifications`, `nda_notifications`, `quiet_hours_enabled`, `user_id UUID`) that don't match the actual table (mig 011: `email_enabled`, JSONB `*_alerts`, integer id). Needs prod-schema introspection + alignment.
- **Audit Batch B** (misleading claims): gate `PublicPitchView` NDA teaser; remove fictional `view_pitch`/`promoted_pitch` credit costs; tiered-analytics overclaim.
- **Audit Batch C** (display): subscription next-payment nesting, invoice unit/currency, dashboard avg-rating scale, dead investor Quick Action routes, payment-history filter statuses.
- **Audit Batch D** (structural): `/api/plans` single source for plans/credit-costs/limits; RBAC via session payload (kills the duplicated-config drift class).
- **FX conversion** if locale-aware data figures (not just pricing) need true converted amounts.
- **OpenCorporates** + (re-flip) gating: set `OPENCORPORATES_API_KEY`.

See memory: `project_karl_backlog_jun2026`, `project_ui_backend_drift_audit`, `project_p1_persistence_fixes`, `project_activity_feed_pivot`.
