# Production Dashboard — Tabs UI/UX Audit

_Captured live from `pitchey-5o8.pages.dev/production/dashboard` (stellarproduction demo), 2026-06-14, viewport ≈1000px (single-column responsive breakpoint). Source: `frontend/src/pages/ProductionDashboard.tsx` + the widgets it mounts._

The dashboard is a 4-tab segmented control: **Overview · Saved Pitches · Following · NDAs**. Below is an inventory of each tab and the UI/UX issues found, then a prioritised cross-cutting list.

## Status (resolved 2026-06-14)

| # | Item | Commit |
|---|---|---|
| 1 | Responsive header/stat clipping (Following, NDAs) | `59b3058f` ✅ |
| 2 | Saved-count disagreed across 3 surfaces (real bug: api-client `.data` nesting + mislabeled chart) | `b4a879cb` ✅ |
| 3 | Duplicate "NDA Summary" block | `be26d8e8` ✅ |
| 4 | Following CTA clutter (4 → 2) | `be26d8e8` ✅ |
| 5 | Filters rendered in empty states | `be26d8e8` ✅ |
| 6 | Deep NDA heading nesting | `63bd802e` ✅ (collapsible direction sections with count badges) |

All six audit items resolved. Remaining open (larger IA decision, not a bug): the Overview↔tabs content duplication — Overview re-surfaces saved/following/NDA data the dedicated tabs also show; consolidating that is a product call, not a cleanup.

---

## Tab 1 — Overview

The catch-all. Vertical stack of self-contained widgets:

1. **Hero** — "Welcome back, stellarproduction" + tagline.
2. **Quick Actions** (6 tiles): Create Pitch, Manage Pitches, Manage NDAs, Messages, Billing, Share Profile.
3. **Invite Creators (Join Code)** — code + copy/regenerate + "Company members" roster with collaboration-NDA status _(copy clarified 2026-06-14, commit 8129a6a5)_.
4. **Your Slate** — production pipeline (`/api/production/slate`), readiness columns: Evaluating (9) / Reviewing (0) / Packaging (1) / Ready (0). Shows owned + saved pitches as cards.
5. **Audience demand** — watcher-engagement lens _(new 2026-06-14, commit a3ff6fbd)_.
6. **Pitch Evaluation Dashboard** — analytics: date-range filters (7d/30d/90d/1y), Pitches Saved / Under Review / NDAs Active / Creators Following counters, Evaluation Pipeline, Pitches-by-Genre + Saved-Pitches-by-Genre donut, Monthly Activity.
7. **Recent Notifications** widget.
8. **Recent Activity** feed.

**UI/UX notes:**
- Overview is very long and **duplicates the other three tabs' content**: it already surfaces saved pitches (Slate), following counts (analytics counters), and NDA activity (Recent Activity + analytics). The dedicated tabs then repeat the same data with different framing.
- Two analytics blocks (the counters and the genre/activity charts) sit far down the page; discoverability is low.

## Tab 2 — Saved Pitches

- Header "Saved Pitches" + subtitle + **"View Full Page"** button → a separate full page.
- Body: **empty state** "No Saved Pitches Yet" → "Browse Marketplace".

**UI/UX notes:**
- 🔴 **Data inconsistency (likely a real bug, not just UX).** Three surfaces disagree on "saved":
  - **Overview → Your Slate** shows *At Ever Las* with a **SAVED** badge (Packaging column).
  - **Overview → Pitch Evaluation → Saved Pitches by Genre** implies ~4 saved pitches (Action-Comedy 50% / action 25% / fantasy 25%).
  - **Saved Pitches tab** says **"No Saved Pitches Yet" (0)**.
  - These read from different sources (`/api/production/slate` vs `savedPitchItems` vs the analytics aggregate). Needs reconciliation — a producer can't trust any single count.
- The "View Full Page" pattern (dashboard tab → separate full page) is unexplained; unclear why both exist.

## Tab 3 — Following

- "Your Following Feed" + two filter dropdowns: **Sort** (Most Recent / Most Popular / Trending / By Genre) and **Content** (All Content / New This Week / NDA Protected / Public Access).
- Three stat tiles: Following **0 Creators** · Pitches in Feed **0** · Saved **0 Pitches**.
- "Following Activity" + empty state "No Following Yet".
- CTAs: **View All Following**, **Discover More**, **Browse Marketplace**, **Explore Following**.

**UI/UX notes:**
- 🔴 **Responsive break.** At ~1000px the "Your Following Feed" heading wraps **one word per line** (Your / Following / Feed) because the filter dropdowns are forced onto the same row, and the "All Content" dropdown **overflows the right edge** (horizontal scrollbar appears). Header + controls need to stack below a breakpoint.
- **CTA clutter.** Four buttons that resolve to ~two destinations (browse marketplace, or the full following page). "View All Following" and "Explore Following" are duplicates.
- **Dead controls in empty state.** Sort + content filters render even with 0 followed creators — nothing to sort/filter.
- "Saved 0 Pitches" stat here **duplicates** the Saved Pitches tab — a third place the saved count lives.

## Tab 4 — NDAs

"NDA Management Center" — the densest tab:

- **Top stats**, two groups: *On Your Pitches* (0 Pending / 2 Signed) · *By You on Others' Pitches* (0 Pending / 0 Signed).
- "All Categories" sub-nav.
- **NDAs on Your Pitches**: "Incoming NDA Requests" (empty) + "Signed NDAs on Your Pitches (2)" — search box + 3 dropdowns (Status / Type / Sort) + 2 cards (*Ocean Deep* — sarahinvestor, Basic, Jan 17 2026; *The Art of War* — sarahinvestor, Basic, Dec 30 2025), each with "View Pitch".
- **NDAs You've Initiated**: "Your Pending Requests" (empty) + "NDAs You've Signed" (empty).
- **NDA Summary**: repeats the top stats again.

**UI/UX notes:**
- 🔴 **Responsive break.** The 4 stat pills sit on the same row as the "NDA Management Center" heading and **clip** — "Pending" renders as "Penc". Same root cause as the Following header.
- 🟠 **Redundant stats.** The Pending/Signed numbers appear **twice** — top header pills *and* the "NDA Summary" block at the bottom — identical data.
- **Deep heading nesting** (4 levels: Center → NDAs on Your Pitches → Incoming/Signed → cards) makes the page feel like a wall. Two collapsible groups ("On your pitches" / "Initiated by you") would compress it.
- Search + 3 filters render above a 2-item list — fine now, but the filter density is disproportionate to typical data volume.

---

## Cross-cutting issues (prioritised)

| # | Severity | Issue | Tabs | Likely fix |
|---|---|---|---|---|
| 1 | 🔴 High | **Header/controls collide & clip below ~1100px** — "Penc", one-word-per-line heading, dropdown overflow + horizontal scroll | Following, NDAs | Stack heading above filters/stats with a `flex-col`/`flex-wrap` breakpoint; never put stat pills on the title row |
| 2 | 🔴 High | **"Saved" count disagrees across 3 surfaces** (Slate=1, analytics≈4, Saved tab=0) | Overview, Saved | Reconcile data sources; one source of truth for "saved" |
| 3 | 🟠 Med | **Stats duplicated** (NDA stats twice; saved count in 3 places; Overview duplicates all 3 tabs) | NDAs, Following, Overview | Remove "NDA Summary"; dedupe saved count; decide Overview vs tabs ownership |
| 4 | 🟠 Med | **CTA clutter** — 4 following CTAs → 2 destinations; "View Full Page"/"View All"/"Explore" pattern unexplained | Following, Saved | One primary CTA per empty state; clarify dashboard-tab vs full-page relationship |
| 5 | 🟡 Low | **Filters/sort render in empty states** | Following | Hide controls until there's data |
| 6 | 🟡 Low | **Deep heading nesting** on NDAs makes a wall of text | NDAs | Collapsible sections for the two NDA directions |

## Suggested sequence

1. **Fix #1 (responsive)** first — it's visible breakage on every load at common widths, low-risk CSS.
2. **Investigate #2 (saved inconsistency)** — could be a real data bug; needs a backend trace before UI work.
3. **De-dup #3/#4** — copy/layout cleanup once the data story is settled.
4. **Polish #5/#6** — empty-state and density refinements.

_Screens captured this session: Saved (empty), Following (header wrap + overflow), NDAs (stat clip). Overview documented from prior full snapshots._
