# Investor portal — routes

Captured as `sarah.investor@demo.com` at deploy `f0564b59`. Accent color: indigo-violet (`#5B4FC7`, `brand-portal-investor`). Per-entity pitch screenshot uses pitch ID `229`.

## Dashboard + overview

| Route | Screenshot | Source |
|---|---|---|
| `/investor/dashboard` | ![](dashboard.png) | `InvestorDashboard.tsx` |
| `/investor/portfolio` | ![](portfolio.png) | `InvestorPortfolio.tsx` |
| `/investor/analytics` | ![](analytics.png) | `InvestorAnalytics.tsx` |
| `/investor/activity` | ![](activity.png) | activity feed |
| `/investor/performance` | ![](performance.png) | performance summary |

## Deal management

| Route | Screenshot | Source |
|---|---|---|
| `/investor/deals` | ![](deals.png) | `InvestorDeals.tsx` |
| `/investor/pending-deals` | ![](pending-deals.png) | pending deals filter |
| `/investor/all-investments` | ![](all-investments.png) | all investments list |
| `/investor/completed-projects` | ![](completed-projects.png) | completed projects |

## Discovery

| Route | Screenshot | Source |
|---|---|---|
| `/investor/browse` | ![](browse.png) | `InvestorBrowse.tsx` |
| `/investor/discover` | ![](discover.png) | `InvestorDiscover.tsx` |
| `/investor/saved` | ![](saved.png) | `InvestorSaved.tsx` |
| `/investor/watchlist` | ![](watchlist.png) | watchlist |
| `/investor/pitch/:id` | ![](pitch-view.png) | `InvestorPitchView.tsx` |

## Financial

| Route | Screenshot | Source |
|---|---|---|
| `/investor/financial-overview` | ![](financial-overview.png) | `InvestorFinancialOverview.tsx` |
| `/investor/transaction-history` | ![](transaction-history.png) | transaction history |
| `/investor/budget-allocation` | ![](budget-allocation.png) | budget allocation |
| `/investor/roi-analysis` | ![](roi-analysis.png) | ROI analysis |
| `/investor/reports` | ![](reports.png) | reports |
| `/investor/tax-documents` | ![](tax-documents.png) | tax documents |

## Research + network

| Route | Screenshot | Source |
|---|---|---|
| `/investor/market-trends` | ![](market-trends.png) | market trends |
| `/investor/risk-assessment` | ![](risk-assessment.png) | risk assessment |
| `/investor/network` | ![](network.png) | network |
| `/investor/co-investors` | ![](co-investors.png) | co-investors |
| `/investor/creators` | ![](creators.png) | creators index |

## NDA + collaboration

| Route | Screenshot | Source |
|---|---|---|
| `/investor/nda-requests` | ![](nda-requests.png) | NDA requests |
| `/investor/my-collaborations` | ![](my-collaborations.png) | my collaborations |

## Communication + profile

| Route | Screenshot | Source |
|---|---|---|
| `/investor/messages` | ![](messages.png) | `Messages.tsx` (shared) |
| `/investor/calendar` | ![](calendar.png) | `Calendar.tsx` (shared) |
| `/investor/profile` | ![](profile.png) | `Profile.tsx` (shared) |
| `/investor/billing` | ![](billing.png) | `Billing.tsx` (shared) |

## Not captured

- `/investor/invest/:pitchId` — investment checkout flow (requires in-progress deal)
- `/investor/discover/genres` — renders same component as `/investor/discover`
- `/investor/onboarding` — first-login only
