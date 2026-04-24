# Route screenshots

Captured at deploy `f0564b59` on 2026-04-24. Desktop viewport `1280×800`.

Four portals + public marketplace. Each portal is captured as a logged-in
user using the demo accounts documented in root CLAUDE.md. Hover states,
dropdowns, and per-entity routes (e.g., `/creator/pitches/:id/edit`) are not
captured — they depend on data and user interaction.

## Portals

- [Creator](routes/creator/) — 14 routes, `alex.creator@demo.com`
- [Investor](routes/investor/) — 12 routes, `sarah.investor@demo.com`
- [Production](routes/production/) — 12 routes, `stellar.production@demo.com`
- [Watcher](routes/watcher/) — 5 routes, `jamie.watcher@demo.com`

## Public

- [Marketplace](routes/marketplace.png) — anonymous-accessible listing

## Re-capturing

The capture flow is manual via chrome-devtools MCP — no script checked in.
Pattern: log in as demo user → navigate to route → wait 2.5s for lazy-loads
and networkidle → `take_screenshot --fullPage --filePath`. Document which
route each file represents in the per-portal README. Prefer the same viewport
(`1280×800`) for consistency unless you're documenting a mobile bug.

If we want this to be automated (e.g., for visual-regression baselines), the
paused `scripts/smoke-test.mjs` is the right place to add it — it already has
the login-session-reuse scaffolding for each portal.
