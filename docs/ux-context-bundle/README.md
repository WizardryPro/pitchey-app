# Pitchey UI/UX Context Bundle

Generated 2026-03-29. Feed this folder to any multimodal LLM for context-aware UI/UX feedback.

## Platform Summary

Movie pitch marketplace connecting creators, investors, and production companies. Edge-first (Cloudflare Workers + Pages), React 18, Tailwind CSS.

**Founding vision**: "What if there was a single place where pitches actually lived? Organized, searchable, easy to send, easy to read, and impossible to lose."

**3 personas**:
- **Creator**: Publish pitches, track engagement (views/likes/NDAs), manage NDA requests
- **Investor**: Browse/search pitches, sign NDAs for protected content, track deal flow
- **Production**: Discover pitches, evaluate completeness, assemble teams, convert to projects

**Core user journey**: Creator publishes → Producer/Investor discovers in marketplace → NDA signed → Full access + messaging → Deal/project starts

## What's Included

### Screenshots (full-page PNGs)
| # | Page | State | File |
|---|------|-------|------|
| 01 | Homepage | Logged out | `screenshots/01-homepage-logged-out.png` |
| 02 | Marketplace | Logged out, 6 pitches | `screenshots/02-marketplace-logged-out.png` |
| 03 | About | Public | `screenshots/03-about.png` |
| 04 | Portal Select | Choosing role | `screenshots/04-portal-select.png` |
| 05 | Pitch View | Public (NDA-gated) | `screenshots/05-pitch-public-view.png` |
| 06 | Production Dashboard | Logged in as Stellar Pictures | `screenshots/06-production-dashboard.png` |
| 07 | Creator Login | Login page | `screenshots/07-login-creator.png` |
| 08 | Creator Dashboard | Logged in as Alex Creator | `screenshots/08-creator-dashboard.png` |
| 09 | Create Pitch | Empty form | `screenshots/09-create-pitch-form.png` |
| 10 | Investor Dashboard | Logged in as Sarah Investor | `screenshots/10-investor-dashboard.png` |

### A11y Tree Snapshots (text)
Same pages as screenshots — semantic element hierarchy with UIDs. In `snapshots/` directory.

### Design System
- `tailwind-config.ts` — Tailwind configuration (colors, spacing, breakpoints)
- UI primitives: 24 shadcn/ui components in `frontend/src/shared/components/ui/`
- Feedback: ErrorBoundary, LoadingSpinner, Toast, Skeleton
- Custom: FormatDisplay, EmptyState, Pagination, WebSocketStatus

### Architecture Context
- See root `CLAUDE.md` for full architecture, API routes, deployment setup
- See `frontend/CLAUDE.md` for auth flow, proxy path, WebSocket details
- See `src/CLAUDE.md` for backend CORS, Sentry, Axiom, tracing

## Known UX Gaps (for review focus)

1. **Budget display**: Raw numbers on some views (marketplace cards now fixed to show $45M format)
2. **Pitch creation**: No completeness indicator during form fill — creator doesn't know what's missing
3. **Marketplace discovery**: No featured/spotlight section, trending badges just added
4. **Empty states**: Dashboards with zero data don't guide user to next action
5. **Engagement percentages**: Creator dashboard shows raw floats like `0.09090909090909091%` instead of formatted values
6. **No pitch templates**: Creators start from scratch every time

## How to Use

Feed screenshots + this README to a multimodal LLM:
```
"Review these screenshots of Pitchey, a movie pitch marketplace. The founding vision is [paste About text]. Identify the top 5 UX improvements that would most align the product with this vision. For each, describe the problem, the fix, and which screenshot shows it."
```

For deeper analysis, also include the a11y snapshots and CLAUDE.md files.
