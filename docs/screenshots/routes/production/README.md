# Production portal — routes

Captured as `stellar.production@demo.com` at deploy `f0564b59`. Accent color: blue-indigo (`#4A5FD0`, `brand-portal-production`).

| Route | Screenshot | Source |
|---|---|---|
| `/production/dashboard` | ![](dashboard.png) | `ProductionDashboard.tsx` |
| `/production/pitches` | ![](pitches.png) | `ManagePitches.tsx` (shared) |
| `/production/pitch/new` | ![](pitch-new.png) | `CreatePitch.tsx` (rendered **outside** `PortalLayout` — full-width wizard) |
| `/production/analytics` | ![](analytics.png) | `ProductionAnalyticsPage.tsx` |
| `/production/projects` | ![](projects.png) | `ProductionProjects.tsx` |
| `/production/pipeline` | ![](pipeline.png) | `ProductionPipeline.tsx` |
| `/production/ndas` | ![](ndas.png) | `ProductionNDAManagement.tsx` → `ComprehensiveNDAManagement.tsx` |
| `/production/messages` | ![](messages.png) | `Messages.tsx` (shared) |
| `/production/calendar` | ![](calendar.png) | `Calendar.tsx` (shared) |
| `/production/profile` | ![](profile.png) | `Profile.tsx` (shared) |
| `/production/billing` | ![](billing.png) | `Billing.tsx` (shared) |
| `/production/settings` | ![](settings.png) | `Settings.tsx` (shared) |

**Not captured** (per-entity or sub-tabs that depend on data):
- `/production/pitch/:id` (ProductionPitchView — rendered outside layout)
- `/production/pitches/:id/edit` (PitchEdit)
- `/production/projects/{active,development,post,completed}` (filtered views)
- `/production/submissions/{new,review,shortlisted,accepted,rejected,archive}`
- `/production/revenue`, `/production/saved`, `/production/following`
- `/production/collaborations`, `/production/my-collaborations`, `/production/invites`
- `/production/team/{members,invite,roles}`
- `/production/settings/{profile,billing,notifications,security}` (sub-tabs of Settings)
- `/production/onboarding`, `/production/verification`
- `/production/legal/*`
