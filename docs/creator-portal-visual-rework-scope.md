# Creator Portal — Visual Rework Scope (2026-06-19)

Pre-launch visual audit of the creator portal. **The creator Dashboard is the quality bar**
(purple gradient welcome banner, "Your Pitchey" stat-card with icon tiles, consistent
rounded cards, deliberate spacing/typography). Every other creator page was screenshotted
on live prod (full-page) and graded against it by 4 parallel `ui-ux-designer` agents, each
reading the screenshot + the source `.tsx`. Screenshots: `/tmp/creator-audit/*.png`.

Goal: hand this to the **frontend-design** skill as a prioritized rework list.

## Ranked by rework need

| # | Page | Route | Grade | Priority | Effort | Gist |
|---|------|-------|:---:|:---:|:---:|------|
| 1 | **CreatorAnalyticsPage** | `/creator/analytics` | **D** | High | M | No hero; stats stacked one-per-row; empty charts look *broken* not empty |
| 2 | **Messages** | `/creator/messages` | **D** | High | L | Debug status bar + fake "E2E" toggle + persistent credit warning = dev-console feel |
| 3 | **PitchEdit** | `/creator/pitch/:id/edit` | **C-** | High | M | No pitch identity in header; orphaned Budget card; raw NDA radio controls; no sticky save |
| 4 | **CreatePitch** | `/creator/pitch/new` | **C+** | High | L | Renders its own header → double-chrome; yellow credit warning before you type; no section nav |
| 5 | **CreatorPortfolio** | `/creator/portfolio` | **C** | High | M | Double-header (breaks portal chrome); flat identity card — **and this is the externally-shared surface investors see** |
| 6 | **ManagePitches** | `/creator/pitches` | **C** | High | M | Flat, no hero; stat row has no tiles; incoherent 5-color card action buttons; 💜 emoji like-count; auto-refresh checkbox leaking into UI |
| 7 | **Settings** | `/creator/settings` | **C+** | High | M | Functional-admin feel; dual Save buttons (confusing); amber-styled 2FA reads as a warning |
| 8 | **Following** | `/creator/following` | **C** | Med | M | Builds own chrome; **uses BLUE (investor color) not creator purple** — worst brand mismatch in the set |
| 9 | **Billing** | `/creator/billing` | **C** | Med | M | Gradient plan-card next to a border-only card (mismatched weight); Stripe CTA looks like a notice banner |
| 10 | **CreatorNDAManagement** | `/creator/ndas` | **C** | Med | S | Flat header (no hero); GREEN (off-brand) quick-action cards; activity rows have no actions |
| 11 | **CreatorSettingsProfile** | `/creator/settings/profile` | **B-** | High | M | Best structure of the lot; needs avatar/banner prominence, identity-verification placement, sticky save |
| 12 | **Profile** | `/creator/profile` | **B** | High | M | Has the hero; read-mode collapses to flat label/value dump; followers shown as text not tiles; no verification chips |
| 13 | **OpportunitiesBoard** | `/creator/opportunities` | **B+** | High | S | Nearest to the bar; **raw ISO timestamp in the deadline chip** (looks like a bug); chip overflow |

Not re-audited (already polished): **Dashboard** (the bar), **Slate editor / CreatorSlateDetail**
and the new **"Who viewed your deck"** panel (built this session, on-brand).

## Cross-cutting themes — fix these as a system, not page-by-page

These recur across almost every page; a design-system pass that addresses them lifts the
whole portal at once:

1. **Missing gradient hero.** Most pages open "cold" with a plain gray `text-2xl` heading.
   The dashboard's purple-gradient welcome banner is the signature element absent nearly
   everywhere. → Create a reusable `<PageHero>` (compact gradient banner + title + optional
   stat pills + primary CTA) and drop it on top of every page.
2. **Inconsistent stat presentation.** Pages render metrics as flat text or stacked
   one-per-row instead of the dashboard's icon + accent-color rounded tiles. → Extract a
   shared `<StatTile>` / `<StatGrid>` and reuse everywhere (analytics, pitches, billing,
   profile, portfolio, NDA).
3. **Pages that break the portal chrome → "double header."** `Following`, `CreatorPortfolio`,
   and `CreatePitch` render their own full-page `<header>`/`min-h-screen` wrapper, so a second
   bar appears under the portal nav and the page feels like a different app. → Remove the
   bespoke chrome; let `PortalLayout` own it; use the page-level action-row pattern.
4. **Brand-color drift.** `Following` uses **blue** (the investor portal color); `NDA` and
   `Billing` use **green** quick-action cards. → Normalize all accents to the creator
   purple/indigo token set.
5. **Operational/debug controls leaking into the UI.** Auto-refresh checkbox (ManagePitches),
   connection-status bar + "E2E" toggle (Messages), live-update strips. → Collapse to a single
   status dot w/ tooltip; remove the non-functional E2E toggle entirely.
6. **Credit-cost warnings front-loaded as anxiety.** Yellow warning at the top of CreatePitch
   (before any input) and a persistent credit banner in the Messages composer. → Move to an
   inline pill at the point of action (or into the relevant modal), neutral styling.
7. **Raw/unformatted data on screen.** ISO timestamp in the Opportunities deadline chip; raw
   `toLocaleDateString()` dates; 💜 emoji like-count. → Route through `formatDate*` utils;
   replace emoji with the Lucide icon set used elsewhere.
8. **Dated form controls.** Raw `<input>`/radio/native `<select>` vs. the platform's styled
   option-tiles and pill-chips. → Adopt styled option tiles (NDA config, filters) and pill-tab
   filters consistently.
9. **Non-sticky save on long forms.** CreatePitch, PitchEdit, CreatorSettingsProfile bury Save
   at the end of a long scroll. → Sticky bottom action bar with the purple primary CTA.

## Suggested sequencing for the frontend-design pass

1. **Build the shared primitives first** (`PageHero`, `StatTile`/`StatGrid`, sticky action bar,
   styled option-tile, pill-tab) — themes 1–2, 9. Everything else reuses them.
2. **Worst + highest-visibility pages:** Analytics (#1), Messages (#2), then Portfolio (#5,
   external-facing) and ManagePitches (#6, daily hub).
3. **Quick wins** that buy outsized credibility for little effort: Opportunities ISO-date fix
   (#13), NDA hero/brand colors (#10), Following blue→purple (#8).
4. **Account cluster:** Settings (#7), Settings Profile (#11), Billing (#9), Profile (#12).
5. **Pitch authoring:** CreatePitch (#4) + PitchEdit (#3) — biggest effort, do with the shared
   primitives in hand.
