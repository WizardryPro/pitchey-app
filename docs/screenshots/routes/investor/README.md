# Investor portal — routes

Captured as `sarah.investor@demo.com` at deploy `f0564b59`. Accent color: indigo-violet (`#5B4FC7`, `brand-portal-investor`).

| Route | Screenshot | Source |
|---|---|---|
| `/investor/dashboard` | ![](dashboard.png) | `InvestorDashboard.tsx` |
| `/investor/browse` | ![](browse.png) | `InvestorBrowse.tsx` |
| `/investor/discover` | ![](discover.png) | `InvestorDiscover.tsx` |
| `/investor/portfolio` | ![](portfolio.png) | `InvestorPortfolio.tsx` |
| `/investor/analytics` | ![](analytics.png) | `InvestorAnalytics.tsx` |
| `/investor/deals` | ![](deals.png) | `InvestorDeals.tsx` |
| `/investor/saved` | ![](saved.png) | `InvestorSaved.tsx` |
| `/investor/financial-overview` | ![](financial-overview.png) | `InvestorFinancialOverview.tsx` |
| `/investor/messages` | ![](messages.png) | `Messages.tsx` (shared) |
| `/investor/calendar` | ![](calendar.png) | `Calendar.tsx` (shared) |
| `/investor/profile` | ![](profile.png) | `Profile.tsx` (shared) |
| `/investor/billing` | ![](billing.png) | `Billing.tsx` (shared) |

**Not captured** (per-entity or sub-tabs that depend on data):
- `/investor/pitch/:id` (InvestorPitchView)
- `/investor/invest/:pitchId` (investment flow)
- `/investor/pending-deals`, `/investor/all-investments`, `/investor/completed-projects`
- `/investor/activity`, `/investor/performance`
- `/investor/discover/genres` (same component, genre subroute)
- `/investor/watchlist`
- `/investor/transaction-history`, `/investor/budget-allocation`, `/investor/roi-analysis`, `/investor/reports`, `/investor/tax-documents`
- `/investor/market-trends`, `/investor/risk-assessment`
- `/investor/network`, `/investor/co-investors`, `/investor/creators`
- `/investor/nda-requests`, `/investor/my-collaborations`
