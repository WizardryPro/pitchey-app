# Production portal — routes

Captured as `stellar.production@demo.com` at deploy `f0564b59`. Accent color: blue-indigo (`#4A5FD0`, `brand-portal-production`). Per-entity pitch screenshots use pitch ID `212`.

## Dashboard + overview

| Route | Screenshot | Source |
|---|---|---|
| `/production/dashboard` | ![](dashboard.png) | `ProductionDashboard.tsx` |
| `/production/analytics` | ![](analytics.png) | `ProductionAnalyticsPage.tsx` |
| `/production/activity` | ![](activity.png) | activity feed |
| `/production/stats` | ![](stats.png) | stats page |

## Pitches

| Route | Screenshot | Source |
|---|---|---|
| `/production/pitches` | ![](pitches.png) | `ManagePitches.tsx` (shared) |
| `/production/pitch/new` | ![](pitch-new.png) | `CreatePitch.tsx` (rendered **outside** `PortalLayout`) |
| `/production/pitch/:id` | ![](pitch-view.png) | `ProductionPitchView.tsx` (outside layout) |
| `/production/pitches/:id/edit` | ![](pitch-edit.png) | `PitchEdit.tsx` (shared) |

## Projects

| Route | Screenshot | Source |
|---|---|---|
| `/production/projects` | ![](projects.png) | `ProductionProjects.tsx` |
| `/production/projects/active` | ![](projects-active.png) | active filter |
| `/production/projects/development` | ![](projects-development.png) | development filter |
| `/production/projects/post` | ![](projects-post.png) | post-production filter |
| `/production/projects/completed` | ![](projects-completed.png) | completed filter |
| `/production/pipeline` | ![](pipeline.png) | `ProductionPipeline.tsx` |

## Submissions

| Route | Screenshot | Source |
|---|---|---|
| `/production/submissions` | ![](submissions.png) | submissions root |
| `/production/submissions/new` | ![](submissions-new.png) | new submissions |
| `/production/submissions/review` | ![](submissions-review.png) | under review |
| `/production/submissions/shortlisted` | ![](submissions-shortlisted.png) | shortlisted |
| `/production/submissions/accepted` | ![](submissions-accepted.png) | accepted |
| `/production/submissions/rejected` | ![](submissions-rejected.png) | rejected |
| `/production/submissions/archive` | ![](submissions-archive.png) | archived |

## Revenue + discovery

| Route | Screenshot | Source |
|---|---|---|
| `/production/revenue` | ![](revenue.png) | revenue |
| `/production/saved` | ![](saved.png) | saved pitches |
| `/production/following` | ![](following.png) | following |

## Collaboration + team

| Route | Screenshot | Source |
|---|---|---|
| `/production/collaborations` | ![](collaborations.png) | collaborations |
| `/production/my-collaborations` | ![](my-collaborations.png) | my collaborations |
| `/production/invites` | ![](invites.png) | invitations |
| `/production/team` | ![](team.png) | team root |

## Communication + profile

| Route | Screenshot | Source |
|---|---|---|
| `/production/ndas` | ![](ndas.png) | `ProductionNDAManagement.tsx` |
| `/production/messages` | ![](messages.png) | `Messages.tsx` (shared) |
| `/production/calendar` | ![](calendar.png) | `Calendar.tsx` (shared) |
| `/production/profile` | ![](profile.png) | `Profile.tsx` (shared) |
| `/production/billing` | ![](billing.png) | `Billing.tsx` (shared) |
| `/production/settings` | ![](settings.png) | `Settings.tsx` (shared) |

## Production settings (portal-specific)

| Route | Screenshot | Source |
|---|---|---|
| `/production/settings/profile` | ![](settings-profile.png) | `ProductionSettingsProfile.tsx` |
| `/production/settings/billing` | ![](settings-billing.png) | `ProductionSettingsBilling.tsx` |
| `/production/settings/notifications` | ![](settings-notifications.png) | `ProductionSettingsNotifications.tsx` |
| `/production/settings/security` | ![](settings-security.png) | `ProductionSettingsSecurity.tsx` |

## Onboarding

| Route | Screenshot | Source |
|---|---|---|
| `/production/onboarding` | ![](onboarding.png) | onboarding flow |
| `/production/verification` | ![](verification.png) | company verification (EIN/CH/insurance) |

## Not captured

- `/production/team/members`, `/production/team/invite`, `/production/team/roles` — all redirect to or render under `/production/team`
- Legal `/legal/*` — shared with creator, captured once under `routes/creator/legal-*.png`
