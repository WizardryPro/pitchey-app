# Creator portal — routes

Captured as `alex.creator@demo.com` at deploy `f0564b59`. Accent color: violet (`#7B3FBF`, `brand-portal-creator`). Per-entity screenshots use pitch ID `229` ("At Ever Las").

## Dashboard + overview

| Route | Screenshot | Source |
|---|---|---|
| `/creator/dashboard` | ![](dashboard.png) | `CreatorDashboard.tsx` |
| `/creator/analytics` | ![](analytics.png) | `CreatorAnalyticsPage.tsx` |
| `/creator/activity` | ![](activity.png) | activity feed |
| `/creator/stats` | ![](stats.png) | stats page |

## Pitches

| Route | Screenshot | Source |
|---|---|---|
| `/creator/pitches` | ![](pitches.png) | `ManagePitches.tsx` (shared) |
| `/creator/pitches/published` | ![](pitches-published.png) | ManagePitches filtered: published |
| `/creator/pitches/drafts` | ![](pitches-drafts.png) | ManagePitches filtered: drafts |
| `/creator/pitches/review` | ![](pitches-review.png) | ManagePitches filtered: review |
| `/creator/pitches/analytics` | ![](pitches-analytics.png) | aggregate analytics across all pitches |
| `/creator/pitch/new` | ![](pitch-new.png) | `CreatePitch.tsx` (rendered **outside** `PortalLayout`) |
| `/creator/pitches/:id` | ![](pitch-detail.png) | `PitchDetail.tsx` (shared, inside portal) |
| `/creator/pitch/:id` | ![](pitch-view.png) | `CreatorPitchView.tsx` |
| `/creator/pitch/:id/edit` | ![](pitch-edit.png) | `PitchEdit.tsx` (shared) |
| `/creator/pitches/:id/analytics` | ![](pitch-analytics.png) | `PitchAnalytics.tsx` (shared) |
| `/creator/slates` | ![](slates.png) | `CreatorSlates.tsx` |

## Team + collaboration

| Route | Screenshot | Source |
|---|---|---|
| `/creator/collaborations` | ![](collaborations.png) | `CreatorCollaborations.tsx` |
| `/creator/my-collaborations` | ![](my-collaborations.png) | `CreatorMyCollaborations.tsx` |
| `/creator/team/members` | ![](team-members.png) | team members |
| `/creator/team/invite` | ![](team-invite.png) | invite flow |
| `/creator/team/roles` | ![](team-roles.png) | role management |

## Communication + profile

| Route | Screenshot | Source |
|---|---|---|
| `/creator/messages` | ![](messages.png) | `Messages.tsx` (shared) |
| `/creator/calendar` | ![](calendar.png) | `Calendar.tsx` (shared) |
| `/creator/ndas` | ![](ndas.png) | `CreatorNDAManagement.tsx` → `ComprehensiveNDAManagement.tsx` |
| `/creator/following` | ![](following.png) | `Following.tsx` (shared) |
| `/creator/portfolio` | ![](portfolio.png) | `CreatorPortfolio.tsx` |
| `/creator/profile` | ![](profile.png) | `Profile.tsx` (shared) |
| `/creator/settings` | ![](settings.png) | `Settings.tsx` (shared) |
| `/creator/billing` | ![](billing.png) | `Billing.tsx` (shared) |

## Funding + investors

| Route | Screenshot | Source |
|---|---|---|
| `/creator/investors` | ![](investors.png) | `CreatorInvestors.tsx` |
| `/creator/funding-settings` | ![](funding-settings.png) | `CreatorFundingSettings.tsx` |

## Legal (product-wide, shared across all portals)

| Route | Screenshot |
|---|---|
| `/legal/dashboard` | ![](legal-dashboard.png) |
| `/legal/wizard` | ![](legal-wizard.png) |
| `/legal/library` | ![](legal-library.png) |
| `/legal/templates` | ![](legal-templates.png) |
| `/legal/compare` | ![](legal-compare.png) |

## Not captured

- `/creator/my-collaborations/:projectId` — requires a specific project id
- `/creator/slates/:id` — requires a specific slate id
- Onboarding (`/creator/onboarding`) — runs on first login only, redirects for completed users
