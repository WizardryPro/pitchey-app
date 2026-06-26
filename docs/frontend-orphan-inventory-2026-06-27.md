# Frontend orphan inventory (2026-06-27)

Roadmap **R1.4** / issue **#104** — measure the frontend dead-code tree (the `#308` backend
orphan numbers are backend-only; the frontend was unmeasured). **Measure-only — no deletions.**

## TL;DR
- Tool: **knip** with a committed `frontend/knip.json` (run `npm run knip` from `frontend/`).
- **The default knip config is unusable here** — it reported 96 unused files with a ~75%
  false-positive rate because it couldn't resolve the project's path aliases (`@/`,
  `@features`, `@portals`) or the custom `lazyRetry()` route entries. The committed config
  fixes both.
- **With the config: 60 unused files, 235 unused exports, 163 unused exported types.**
  Verified the config is sound — known-used, lazy-routed files (InvestorDashboard,
  CreatorPitchView, investor-thesis.service, MatchingInvestorsPanel) are correctly NOT
  flagged.
- Recommendation: a frontend deletion sweep is **worth it but not urgent** — do it as a
  gated, per-cluster pass with per-file verification, the same discipline as the backend
  orphan delete (#370). Do NOT bulk-delete on knip alone.

## Why the default config lied
The frontend resolves modules through Vite aliases and a custom `lazyRetry(() => import())`
wrapper for ~142 lazy routes. knip's defaults don't follow either, so it flagged huge
swaths of live code as "unused." Sampled false positives under the default config:
`InvestorThesisService` (used by 2 routed pages), `NotificationBell` (imported 8×),
`NotificationCenter` (imported 2×) — all live. **This is why the audit needed a config
before any number could be trusted**, and why the committed `knip.json` is the real
deliverable here.

## The numbers (configured knip)
| Category | Count |
|---|---|
| Unused files | **60** |
| Unused exports | 235 |
| Unused exported types | 163 |
| Duplicate exports | 33 *(mostly `default` + named on the same module — a style, not dead code; ignore)* |
| Unused dependencies | 11 (+2 dev) |

### Unused files by area (where the dead tree clusters)
| Area | Files |
|---|---|
| `src/features/` | 29 |
| `src/shared/` | 18 |
| `src/components/` | 9 |
| `src/test/` | 2 |
| `src/portals/` | 1 |
| top-level | 1 (`react-global.tsx`) |

The concentration in `features/` (29) + `shared/` (18) mirrors the backend Era 0–6
parallel-tree pattern — abandoned alternative implementations that were never wired.

### Notable candidates (a sample — verify before deleting)
- Components: `Button.tsx`, `DashboardHeader.tsx`, `EnhancedNavigationShadcn.tsx` (a shadcn
  experiment), `PitchMediaGallery.tsx`, `Dashboard/NotificationWidgetSafe.tsx`.
- A whole shadow notification cluster: `features/notifications/components/`
  `NotificationBellSafe`, `NotificationDropdown`, `NotificationInitializer`,
  `NotificationPreferences`, `PushSubscriptionManager` — a parallel notifications UI tree.
- `shared/contexts/` (`AppContextProvider`, `PollingContext`), `shared/hooks/useMobileGestures`,
  several `shared/types/*`.
- NDA UI alternates: `features/ndas/components/NDAManagement`, `NDAStatus`.

## Caveats (do not skip before deleting)
- knip does transitive reachability from entries — better than a grep — but it still can't
  see **runtime-only** usage (a string-built dynamic import, a component referenced only in
  a config map, a test-only util). Each candidate needs a quick first-hand check.
- The `react-global.tsx` and a couple `shared/` files may be **side-effect** modules (imported
  for their effect, not an export) — knip can mis-flag these. Verify.
- 11 "unused dependencies" — some are likely transitively/peer used; verify before removing.

## Recommendation
1. **The config is the win** — `frontend/knip.json` + `npm run knip` make this measurement
   repeatable and trustworthy. Wire it into CI later as an informational (non-blocking) check.
2. A deletion sweep of the ~60 files is worth ~similar value to the backend #370 (−6.7k LOC):
   do it **per-cluster** (start with the shadow `features/notifications/` tree), each with a
   first-hand "is it really unused?" check + a clean build, exactly like #370.
3. Defer the 235 unused exports / 163 types — lower value, higher churn; revisit after the
   file sweep.

## Reproduce
```bash
cd frontend && npm run knip            # full report
cd frontend && npm run knip -- --include files   # just the unused files
```
