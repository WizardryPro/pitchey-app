# Creator portal — routes

Captured as `alex.creator@demo.com` at deploy `f0564b59`. Accent color: violet (`#7B3FBF`, `brand-portal-creator`).

| Route | Screenshot | Source |
|---|---|---|
| `/creator/dashboard` | ![](dashboard.png) | `CreatorDashboard.tsx` |
| `/creator/pitches` | ![](pitches.png) | `ManagePitches.tsx` (shared) |
| `/creator/pitch/new` | ![](pitch-new.png) | `CreatePitch.tsx` (rendered outside `PortalLayout` — full-width wizard) |
| `/creator/analytics` | ![](analytics.png) | `CreatorAnalyticsPage.tsx` |
| `/creator/messages` | ![](messages.png) | `Messages.tsx` (shared) |
| `/creator/calendar` | ![](calendar.png) | `Calendar.tsx` (shared) |
| `/creator/ndas` | ![](ndas.png) | `CreatorNDAManagement.tsx` → `ComprehensiveNDAManagement.tsx` |
| `/creator/following` | ![](following.png) | `Following.tsx` (shared) |
| `/creator/portfolio` | ![](portfolio.png) | `CreatorPortfolio.tsx` |
| `/creator/profile` | ![](profile.png) | `Profile.tsx` (shared) |
| `/creator/settings` | ![](settings.png) | `Settings.tsx` (shared) |
| `/creator/billing` | ![](billing.png) | `Billing.tsx` (shared) |
| `/creator/slates` | ![](slates.png) | `CreatorSlates.tsx` |
| `/creator/collaborations` | ![](collaborations.png) | `CreatorCollaborations.tsx` |

**Not captured** (per-entity or sub-tabs that depend on data):
- `/creator/pitch/:id` (CreatorPitchView)
- `/creator/pitches/:id` (PitchDetail)
- `/creator/pitch/:id/edit` (PitchEdit)
- `/creator/pitches/:id/analytics` (PitchAnalytics)
- `/creator/my-collaborations/:projectId` (CollaborationDetail)
- `/creator/slates/:id` (SlateDetail)
- `/creator/team/*` (members/invite/roles)
- `/creator/legal/*` (dashboard/wizard/library/templates/compare)
- `/creator/investors`, `/creator/funding-settings`
- `/creator/pitches/published|drafts|review|analytics` (filtered views of ManagePitches)
