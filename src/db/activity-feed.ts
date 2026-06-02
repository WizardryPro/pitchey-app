/**
 * activity-feed — the actor/action/object event source behind the Following feed.
 *
 * Model: one row per actor action (see migration 094). Fan-out to followers and
 * saved-pitch watchers happens at READ time in getActivityFeed(), not on write.
 *
 * recordActivity() is fire-and-forget by contract: it NEVER throws to the caller.
 * A missing table (before migration 094 is applied) or any DB error is logged +
 * reported to Sentry, but the originating request (publish, follow) still succeeds.
 * Call it without awaiting, or with ctx.waitUntil().
 */
import postgres from 'postgres';
import * as Sentry from '@sentry/cloudflare';

type DbEnv = { DATABASE_URL: string };

export type ActivityAction = 'pitch_published' | 'pitch_updated' | 'user_followed' | 'message_attachment';

export interface RecordActivityInput {
  actorId: number;
  action: ActivityAction | string;
  objectType: 'pitch' | 'user' | 'message' | string;
  objectId?: number | null;
  /** When set, the event is PRIVATE — visible only to this recipient, never
   *  fanned out to the actor's followers. Used for messaged attachments. */
  recipientId?: number | null;
  metadata?: Record<string, unknown>;
}

export async function recordActivity(env: DbEnv, input: RecordActivityInput): Promise<void> {
  try {
    if (!input.actorId || Number.isNaN(input.actorId)) return;
    const sql = postgres(env.DATABASE_URL);
    await sql`
      INSERT INTO activity_feed (actor_id, action, object_type, object_id, recipient_id, metadata)
      VALUES (
        ${input.actorId},
        ${input.action},
        ${input.objectType},
        ${input.objectId ?? null},
        ${input.recipientId ?? null},
        ${JSON.stringify(input.metadata ?? {})}::jsonb
      )
    `;
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    // Don't surface — the feed is best-effort. Missing table pre-migration lands here.
    console.error('recordActivity failed:', e.message);
    try {
      Sentry.withScope((scope) => {
        scope.setTag('activity.action', String(input.action));
        scope.setTag('activity.context', 'recordActivity');
        Sentry.captureException(e);
      });
    } catch { /* Sentry hub not initialized */ }
  }
}

export interface ActivityFeedActor {
  id: number;
  name: string;
  username: string | null;
  userType: string | null;
  profileImage: string | null;
}

export interface ActivityFeedPitch {
  id: number;
  title: string;
  genre: string | null;
  logline: string | null;
  requireNda: boolean;
}

export interface ActivityFeedItem {
  id: number;
  actorId: number;
  action: string;
  objectType: string;
  objectId: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: ActivityFeedActor | null;
  pitch: ActivityFeedPitch | null;
}

/**
 * Events relevant to `viewerId`: actions by creators they follow, plus actions on
 * pitches they've saved. Enriched with actor + pitch detail. Excludes the viewer's
 * own actions. Returns [] on any error (caller need not guard).
 */
export async function getActivityFeed(
  env: DbEnv,
  viewerId: number,
  opts: { limit?: number; offset?: number } = {}
): Promise<ActivityFeedItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  try {
    const sql = postgres(env.DATABASE_URL);
    const rows = await sql`
      SELECT
        af.id, af.actor_id, af.action, af.object_type, af.object_id, af.metadata, af.created_at,
        u.name        AS actor_name,
        u.username    AS actor_username,
        u.user_type   AS actor_user_type,
        COALESCE(u.profile_image, u.avatar_url) AS actor_profile_image,
        p.title       AS pitch_title,
        p.genre       AS pitch_genre,
        p.logline     AS pitch_logline,
        COALESCE(p.require_nda, false) AS pitch_require_nda
      FROM activity_feed af
      LEFT JOIN users u   ON u.id = af.actor_id
      LEFT JOIN pitches p ON af.object_type = 'pitch' AND p.id = af.object_id
      WHERE af.actor_id <> ${viewerId}
        AND (
          -- PRIVATE events: visible only to their recipient (e.g. messaged attachments).
          af.recipient_id = ${viewerId}
          OR (
            -- BROADCAST events: fanned out to followers + saved-pitch watchers.
            af.recipient_id IS NULL
            AND (
              af.actor_id IN (SELECT following_id FROM follows WHERE follower_id = ${viewerId})
              OR (
                af.object_type = 'pitch'
                AND af.object_id IN (SELECT pitch_id FROM saved_pitches WHERE user_id = ${viewerId})
              )
            )
          )
        )
        -- Don't surface published pitches that have since been unpublished/archived.
        AND (af.object_type <> 'pitch' OR p.id IS NOT NULL)
      ORDER BY af.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return rows.map((r: Record<string, unknown>): ActivityFeedItem => {
      const actorId = Number(r.actor_id);
      const objectId = r.object_id == null ? null : Number(r.object_id);
      const metadata = (r.metadata as Record<string, unknown>) ?? {};
      return {
        id: Number(r.id),
        actorId,
        action: String(r.action),
        objectType: String(r.object_type),
        objectId,
        metadata,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        actor: r.actor_name != null || r.actor_username != null
          ? {
              id: actorId,
              name: (r.actor_name as string) ?? '',
              username: (r.actor_username as string) ?? null,
              userType: (r.actor_user_type as string) ?? null,
              profileImage: (r.actor_profile_image as string) ?? null,
            }
          : null,
        pitch: r.object_type === 'pitch' && r.pitch_title != null
          ? {
              id: objectId ?? 0,
              title: (r.pitch_title as string) ?? '',
              genre: (r.pitch_genre as string) ?? null,
              logline: (r.pitch_logline as string) ?? null,
              requireNda: Boolean(r.pitch_require_nda),
            }
          : null,
      };
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getActivityFeed failed:', e.message);
    try {
      Sentry.withScope((scope) => {
        scope.setTag('activity.context', 'getActivityFeed');
        Sentry.captureException(e);
      });
    } catch { /* Sentry hub not initialized */ }
    return [];
  }
}
