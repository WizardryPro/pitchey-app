# Realtime Activity Feed — Implementation Plan (2026-06-22)

Source: multi-agent planning workflow (5 subsystem designs → adversarial verification against live code → synthesis). This doc is the synthesized, verified plan only.

## Problem (verified)

The feed "hints at realtime but looks stale" because it is **empty by construction and fragmented on read**:

- Only `pitch_published` ever writes to `activity_feed` (`worker-integrated.ts:2916`). Likes, saves, follows, comments, NDA, and deal events write **nothing** to it.
- Four divergent read endpoints disagree:
  - `/api/activity/feed` → `activity_feed` (consumed **only** by `Following.tsx`)
  - `/api/creator/activity` + `/api/production/activity` → `notifications` table
  - `/api/investor/activity` → `investments` table
- Realtime push (`NotificationHub` DO + WS) works but only `pitch_published` is pushed.
- Frontend doesn't subscribe to any activity WS channel; views are one-shot fetches on mount except `CreatorActivity` (30s poll). Relative timestamps + refresh spinners dress frozen data as live.
- No caching on any activity read; no cron backfill.

## Strategy

**Extend the existing primitives, don't rebuild.** `recordActivity()` (fire-and-forget-safe), `getActivityFeed()` (read-time fan-out via follows + saved_pitches + `recipient_id`), `pushRealtimeEvent()` (already generic `event.type`), `UpstashCacheService.delByPrefix`, and the `NotificationHub` DO are all sound and reusable.

**Moat note:** the strategically load-bearing part is **event taxonomy completeness** (especially `nda_requested`/`nda_approved` and deal events) — that's the cross-role NDA-intent + engagement graph that is the project's stated defensibility thesis. The realtime push is UX sugar; the recorded graph is the durable asset.

## Corrections applied during verification (do not re-introduce)

- **REJECTED** "NDA `ndas.signer_id` column does not exist" — live code uses `signer_id` consistently (worker 8618/8655/8661/6454); #284/#285 unified it. The cited migrations are stale, not the live schema.
- **REJECTED** "`submitPitchComment` / `pitch_comments` don't exist" — handler at `src/handlers/pitch-feedback.ts:706`; table has migrations 075/087/106.
- **DROPPED** the proposed `target_id` column — doesn't exist and isn't needed; `recipient_id` (migration 095) already covers directed/private events.
- **DROPPED** a new `pushActivityEvent` method — `pushRealtimeEvent` (`:12691`) already takes a generic `event.type`.
- **CUT as over-engineering for pre-launch:** 4-week shadow-read rollout, 90-day notifications→activity_feed backfill cron, `activity_feed_unified` UNION view, materialized views, presence/online-only push filtering, page-0 cache-warming, Cloudflare Queues fan-out.

## Phases (dependency-ordered, each independently shippable)

### P1 — Data model: widen taxonomy + one index (NO target_id)
- Widen `ActivityAction` union in `src/db/activity-feed.ts:17`: add `pitch_liked, pitch_saved, pitch_commented, nda_requested, nda_approved, deal_created, deal_outcome_reported` (keep string fallback so unknown types never break `recordActivity`).
- **No** `target_id` column. Use `recipient_id` for directed events.
- Migration `NNN_activity_feed_object_index.sql` (next free number per `schema_migrations`, **not** hardcoded 116): `idx_activity_feed_object(object_type,object_id)` + `idx_activity_feed_actor_created(actor_id,created_at DESC)` IF NOT EXISTS.
- Apply on a Neon branch (verify EXPLAIN uses indexes) → prod via `scripts/migrate.mjs` so the deploy gate passes.

### P2 — Write-path instrumentation (depends on P1)
Per-handler pre-flight `grep -rn 'register.*<route>' src/worker-integrated.ts` before editing (like-button orphan lesson). `recordActivity` calls are **additive** to existing notification writes — don't remove the bell.

| Event | Live handler | action / objectType | directed? |
|---|---|---|---|
| Like | `src/handlers/pitch-interactions.ts` `pitchLikeHandler` | `pitch_liked` / `pitch` | recipient = creator |
| Save | `pitchSaveHandler` + inline `saveInvestorPitch` | `pitch_saved` / `pitch` | — |
| Follow (follow branch only) | `src/handlers/follows-enhanced.ts` `followActionHandler` | `user_followed` / `user` | — |
| Comment | `src/handlers/pitch-feedback.ts:706` `submitPitchComment` | `pitch_commented` / `pitch` (strip identity if `is_anonymous`, migration 106) | — |
| NDA request | `worker-integrated.ts` `requestNDA` (~8655, uses `signer_id`) | `nda_requested` / `nda` | recipient = pitch owner |
| NDA approve | `approveNDA` (~8838) | `nda_approved` / `nda` | recipient = `signer_id` |
| Deal created | `src/handlers/production-deals.ts:88` `createProductionDeal` | `deal_created` / `deal` | recipient = creator |
| Deal outcome | inline `POST /api/production/deals/:dealId/outcome` (`:3260`) | `deal_outcome_reported` / `deal` | — |

- Standalone handlers have `env` not `ctx`: loose `await recordActivity(...)` (it never throws). Use `ctx.waitUntil` only in RouteRegistry methods that already have `ctx` (NDA/deal inline).
- **v1: positive engagement only** — do not record unlike/unsave.

### P3 — Read consolidation (depends on P2)
- Add optional `viewerRole` to `getActivityFeed(env, viewerId, opts)`; layer role rules on the existing `recipient_id` + follows/saved fan-out: creators also see events on their own pitches; investor/production see directed events via `recipient_id` + follows.
- Migrate `/api/creator/activity` and `/api/production/activity` off `notifications` onto `getActivityFeed`.
- Investor: keep `investments` read as a labelled **historical overlay** (no backfill) + merge `activity_feed` deal/nda events where `recipient_id=viewerId`.
- Normalize all four endpoints to the single `ActivityFeedItem` shape (resolves the confirmed Investor vs Production incompatible client shapes backend-side).
- Drop `Following.tsx`'s `/api/pitches/following` fallback once the feed is populated.
- Verify by log-comparing old-vs-new counts per endpoint in dev — not a multi-week shadow program.

### P4 — Realtime push (depends on P3)
- **Reuse** `pushRealtimeEvent` (`:12691`). After each `recordActivity`: directed events push to the single `recipient_id`; broadcast events (like/save/follow/comment) push to the actor's followers via the **same loop** `pitch_published` already uses (~`:2893`). Gate/skip the loop above ~100 followers for v1; no Queues.
- Frontend: add an `activity` case to `WebSocketContext.handleMessage` (currently ends ~line 365 with `pitch_published`) + an explicit `activity:user:${id}` subscribe in `handleConnect` (so non-viewers aren't pushed to).
- New `frontend/src/hooks/useActivityFeed.ts`: initial fetch + WS prepend deduped by id → `{activities, isLoading, unreadCount, refresh}`. Wire into Creator/Following/Investor/Production activity views; **remove** the 30s `setInterval` in `CreatorActivity` (WS reconnect is the recovery path, not a parallel poll).
- Exclude activity from DO offline-queueing (or short TTL) — offline users get correct state on next fetch.

### P5 — Caching (depends on P4)
- In `getActivityFeedRoute` (`:14122`) check `this.cache.get('activity:feed:${viewerId}:${limit}:${offset}')` before query; populate with ~5min TTL; no-op when `this.cache.isConnected` is false.
- Clamp `limit` to `{10,20,30}` to bound key cardinality.
- On each P2 write, fire-and-forget invalidate the actor's + recipient's keys (reuse the `delByPrefix` idiom at `:12727`).
- Startup WARN if `UPSTASH_REDIS_REST_URL` absent in prod. Measure hit-rate via Axiom before tuning.

## Risk register

| Risk | Mitigation |
|---|---|
| Acting on the stale NDA `signer_id` "blocker" | Confirmed live uses `signer_id`; treat as stale-migration noise |
| `ctx.waitUntil` unavailable in standalone handlers | `recordActivity` never throws; loose `await` is safe |
| Synchronous follower fan-out blocks response | Reuse `pitch_published` loop; gate above ~100 followers; DB is source of truth |
| DO offline-queue memory explosion | Exclude activity from queueing / short TTL |
| Investor vs Production incompatible client shapes | Normalize backend-side in P3 before the shared hook |
| Editing an orphan handler | Per-handler `register(...)` grep before each edit |
| Broad cache invalidation cost | Scope to actor+recipient keys; clamp limit; measure first |
| notifications/activity_feed dual-write drift | Intentional (bell vs feed); document, don't collapse pre-launch |

## Open decisions (for the owner)

1. Investor history lives only in `investments` (no backfill), `activity_feed` takes over going forward? (Rec: yes)
2. Record unlike/unsave, or positive-only? (Rec: positive-only v1)
3. Explicit frontend subscribe vs DO auto-subscribe-all? (Rec: explicit)
4. Long-term: make `activity_feed` the single substrate and derive notifications from it? (Defer past launch)
5. Confirm anonymous comments surface with identity stripped (Karl's two-button model)
6. Per-type unread counts vs one global unread badge
7. Fold `pitch_published` push into the generic activity path, or leave as special case? (Low priority)
