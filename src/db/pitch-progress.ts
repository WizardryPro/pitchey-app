/**
 * pitch-progress — "progress from feedback" (Phase 4B / WS-5).
 *
 * For a reviewer who left feedback on a pitch, computes whether the creator has
 * edited the pitch SINCE that feedback, and how the pitch's score has moved.
 * Backed by pitch_versions snapshots (migration 096) + pitch_feedback.
 *
 * Returns a safe "no progress" shape on any error (never throws). Deltas only
 * exist once a baseline snapshot was captured at/before the feedback — older
 * feedback (pre-snapshots) reports editedSinceFeedback without a score delta.
 */
import postgres from 'postgres';
import * as Sentry from '@sentry/cloudflare';

type DbEnv = { DATABASE_URL: string };

export interface FeedbackProgress {
  hasFeedback: boolean;
  feedbackAt: string | null;
  editedSinceFeedback: boolean;
  editCount: number;
  scoreAtFeedback: number | null;
  scoreNow: number | null;
  scoreDelta: number | null;
}

const EMPTY: FeedbackProgress = {
  hasFeedback: false,
  feedbackAt: null,
  editedSinceFeedback: false,
  editCount: 0,
  scoreAtFeedback: null,
  scoreNow: null,
  scoreDelta: null,
};

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function getFeedbackProgress(
  env: DbEnv,
  pitchId: number,
  viewerId: number
): Promise<FeedbackProgress> {
  if (!pitchId || !viewerId) return EMPTY;
  try {
    const sql = postgres(env.DATABASE_URL);

    const [fb] = await sql`
      SELECT created_at
      FROM pitch_feedback
      WHERE pitch_id = ${pitchId} AND reviewer_id = ${viewerId}
      ORDER BY created_at ASC
      LIMIT 1
    `;
    if (!fb) return EMPTY;
    const feedbackAt: string = fb.created_at instanceof Date ? fb.created_at.toISOString() : String(fb.created_at);

    // Edits since the feedback (snapshots written after the feedback timestamp).
    const [edits] = await sql`
      SELECT COUNT(*)::int AS n
      FROM pitch_versions
      WHERE pitch_id = ${pitchId} AND created_at > ${fb.created_at}
    `;
    const editCount = Number(edits?.n ?? 0);

    // Baseline: the score snapshot at/just-before the feedback.
    const [baseline] = await sql`
      SELECT pitchey_score_avg, rating_average
      FROM pitch_versions
      WHERE pitch_id = ${pitchId} AND created_at <= ${fb.created_at}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // Current score (prefer the industry Pitchey score, fall back to combined).
    const [now] = await sql`
      SELECT pitchey_score_avg, rating_average, updated_at
      FROM pitches
      WHERE id = ${pitchId}
      LIMIT 1
    `;

    const pickScore = (row: any): number | null =>
      row ? (num(row.pitchey_score_avg) ?? num(row.rating_average)) : null;

    const scoreAtFeedback = pickScore(baseline);
    const scoreNow = pickScore(now);
    const scoreDelta =
      scoreAtFeedback != null && scoreNow != null
        ? Math.round((scoreNow - scoreAtFeedback) * 10) / 10
        : null;

    // editedSinceFeedback: snapshots are authoritative, but fall back to the
    // pitch's own updated_at for feedback left before snapshots existed.
    let editedSinceFeedback = editCount > 0;
    if (!editedSinceFeedback && now?.updated_at) {
      editedSinceFeedback = new Date(now.updated_at).getTime() > new Date(feedbackAt).getTime();
    }

    return {
      hasFeedback: true,
      feedbackAt,
      editedSinceFeedback,
      editCount,
      scoreAtFeedback,
      scoreNow,
      scoreDelta,
    };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getFeedbackProgress failed:', e.message);
    try {
      Sentry.withScope((scope) => {
        scope.setTag('activity.context', 'getFeedbackProgress');
        Sentry.captureException(e);
      });
    } catch { /* Sentry hub not initialized */ }
    return EMPTY;
  }
}
