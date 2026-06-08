/**
 * Production Pitch Data Handlers
 * Persists notes, checklist, and team assignments per pitch for production users.
 * Replaces localStorage usage in ProductionPitchView.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';
import { safeQuery } from '../db/safe-query';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function errorResponse(message: string, origin: string | null, status = 400): Response {
  return jsonResponse({ success: false, error: message }, origin, status);
}

function extractPitchId(request: Request): number {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/production/pitches/:pitchId/notes -> pitchId is at index 4
  return parseInt(parts[4] || '0', 10);
}

/**
 * Hybrid production workspace resolution (Karl-aligned, option B).
 *
 * - Production-OWNED pitch: ONE canonical workspace keyed on the pitch owner's
 *   user_id. The owner + seated B3 team members (role owner|editor|member of the
 *   team owned by the pitch owner) co-edit it; NDA-signed producers VIEW it
 *   read-only.
 * - Creator-OWNED pitch: per-producer PRIVATE workspace keyed on the acting
 *   user — each evaluating production user keeps their own (unchanged behavior).
 *
 * Returns null if the pitch doesn't exist. `workspaceUserId` is the row key for
 * the single-blob checklist/team; `teamUserIds` scopes note reads on production
 * pitches so external producers' historical private notes never leak.
 */
interface WorkspaceCtx {
  ownerId: number;
  isProductionPitch: boolean;
  workspaceUserId: number;
  teamUserIds: number[];
  canEdit: boolean;
  canView: boolean;
}

/** Has this creator signed the company's (collaboration) NDA? Keyed on the pitch
 *  owner — one signature per company covers all its projects (B3 per-company
 *  scope). Pre-migration (table absent) → false, i.e. the secure default of
 *  blocking workspace access until signed. See collaboration-nda-scope.md. */
async function hasSignedCompanyNda(sql: any, signerId: number, ownerId: number): Promise<boolean> {
  try {
    const r = await sql`
      SELECT 1 FROM company_nda_signatures s
      JOIN teams t ON t.id = s.team_id
      WHERE t.owner_id = ${ownerId} AND s.signer_id = ${signerId} AND s.status = 'signed'
      LIMIT 1`;
    return r.length > 0;
  } catch { return false; }
}

/** Defensive "has this user signed/been-granted an NDA on this pitch" — tolerant
 *  of the signer_id / requester_id / pitch_access schema drift (see CLAUDE.md). */
async function hasSignedNda(sql: any, userId: number, pitchId: number): Promise<boolean> {
  try {
    const r = await sql`SELECT 1 FROM ndas WHERE pitch_id = ${pitchId} AND signer_id = ${userId} AND (status = 'approved' OR status = 'signed') LIMIT 1`;
    if (r.length > 0) return true;
  } catch { /* signer_id may not exist in older envs */ }
  try {
    const r = await sql`SELECT 1 FROM ndas WHERE pitch_id = ${pitchId} AND requester_id = ${userId} AND (status = 'approved' OR status = 'signed') LIMIT 1`;
    if (r.length > 0) return true;
  } catch { /* requester_id fallback */ }
  try {
    const r = await sql`SELECT 1 FROM pitch_access WHERE pitch_id = ${pitchId} AND user_id = ${userId} LIMIT 1`;
    if (r.length > 0) return true;
  } catch { /* pitch_access may not exist */ }
  return false;
}

async function resolveWorkspace(sql: any, actingUserId: number, pitchId: number): Promise<WorkspaceCtx | null> {
  let owner: any;
  try {
    [owner] = await sql`
      SELECT p.user_id AS owner_id, u.user_type AS owner_type
      FROM pitches p JOIN users u ON u.id = p.user_id
      WHERE p.id = ${pitchId} LIMIT 1`;
  } catch { return null; }
  if (!owner) return null;

  const ownerId = Number(owner.owner_id);
  const isProductionPitch = owner.owner_type === 'production';

  let myType: string | undefined;
  try { const [me] = await sql`SELECT user_type FROM users WHERE id = ${actingUserId}`; myType = me?.user_type; } catch { /* default below */ }

  if (isProductionPitch) {
    let teamUserIds = [ownerId];
    try {
      const members = await sql`
        SELECT tm.user_id FROM team_members tm JOIN teams t ON t.id = tm.team_id
        WHERE t.owner_id = ${ownerId} AND tm.role IN ('owner','editor','member')`;
      teamUserIds = [ownerId, ...members.map((m: any) => Number(m.user_id))];
    } catch { /* team_members drift — owner-only */ }
    const isOwner = actingUserId === ownerId;
    const isTeam = teamUserIds.includes(actingUserId);
    // Collaboration-NDA gate (B3 Phase 2): a seated member (a creator who joined
    // via a code) must sign the company NDA before the shared workspace unlocks.
    // The owner is exempt; NDA-signed external producers keep their read-only view.
    let memberAccess = isOwner;
    if (!isOwner && isTeam) {
      memberAccess = await hasSignedCompanyNda(sql, actingUserId, ownerId);
    }
    let canView = memberAccess;
    if (!canView && myType === 'production') {
      canView = await hasSignedNda(sql, actingUserId, pitchId); // NDA producer → read-only
    }
    return { ownerId, isProductionPitch, workspaceUserId: ownerId, teamUserIds, canEdit: memberAccess, canView };
  }

  // Creator-owned pitch — private per-producer workspace.
  const canEdit = myType === 'production';
  return { ownerId, isProductionPitch, workspaceUserId: actingUserId, teamUserIds: [actingUserId], canEdit, canView: canEdit };
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

/**
 * GET /api/production/pitches/:pitchId/notes
 */
export async function getProductionNotes(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { notes: [] } }, origin);

  try {
    const ws = await resolveWorkspace(sql, Number(userId), pitchId);
    if (!ws || !ws.canView) return jsonResponse({ success: true, data: { notes: [] } }, origin);

    // Production pitch → the team's shared notes (scoped to team authors so
    // external producers' private notes never leak). Creator pitch → my own.
    const notesResult = ws.isProductionPitch
      ? await safeQuery(() => sql`
          SELECT id, content, category, author, shared, user_id, created_at, updated_at
          FROM production_notes
          WHERE pitch_id = ${pitchId} AND user_id = ANY(${ws.teamUserIds})
          ORDER BY created_at ASC
        `, { fallback: [], context: 'production-pitch-data.notes.list' })
      : await safeQuery(() => sql`
          SELECT id, content, category, author, shared, user_id, created_at, updated_at
          FROM production_notes
          WHERE pitch_id = ${pitchId} AND user_id = ${Number(userId)}
          ORDER BY created_at ASC
        `, { fallback: [], context: 'production-pitch-data.notes.list' });

    return jsonResponse({ success: true, data: { notes: notesResult.rows } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getProductionNotes error:', e.message);
    return jsonResponse({ success: true, data: { notes: [] } }, origin);
  }
}

/**
 * POST /api/production/pitches/:pitchId/notes
 */
export async function createProductionNote(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  const ws = await resolveWorkspace(sql, Number(userId), pitchId);
  if (!ws || !ws.canEdit) {
    return errorResponse('Not authorized to add production notes to this pitch', origin, 403);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const category = typeof body.category === 'string' ? body.category : 'general';
    const author = typeof body.author === 'string' ? body.author : 'Production Team';

    if (!content) return errorResponse('Content is required', origin);

    const validCategories = ['casting', 'location', 'budget', 'schedule', 'team', 'general'];
    if (!validCategories.includes(category)) {
      return errorResponse(`Invalid category. Must be one of: ${validCategories.join(', ')}`, origin);
    }

    const shared = body.shared === true;

    const result = await sql`
      INSERT INTO production_notes (user_id, pitch_id, content, category, author, shared)
      VALUES (${Number(userId)}, ${pitchId}, ${content}, ${category}, ${author}, ${shared})
      RETURNING id, content, category, author, shared, created_at, updated_at
    `;

    return jsonResponse({ success: true, data: { note: result[0] } }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('createProductionNote error:', e.message);
    return errorResponse('Failed to create note', origin, 500);
  }
}

/**
 * DELETE /api/production/pitches/:pitchId/notes/:noteId
 */
export async function deleteProductionNote(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/production/pitches/:pitchId/notes/:noteId
  const pitchId = parseInt(parts[4] || '0', 10);
  const noteId = parseInt(parts[6] || '0', 10);
  if (!noteId) return errorResponse('Invalid note ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  const ws = await resolveWorkspace(sql, Number(userId), pitchId);
  if (!ws || !ws.canEdit) return errorResponse('Not authorized to delete this note', origin, 403);

  try {
    // Production pitch → any team member may delete a team note (D4). Creator
    // pitch → only your own private note.
    const result = ws.isProductionPitch
      ? await sql`
          DELETE FROM production_notes
          WHERE id = ${noteId} AND pitch_id = ${pitchId} AND user_id = ANY(${ws.teamUserIds})
          RETURNING id`
      : await sql`
          DELETE FROM production_notes
          WHERE id = ${noteId} AND pitch_id = ${pitchId} AND user_id = ${Number(userId)}
          RETURNING id`;

    if (result.length === 0) {
      return errorResponse('Note not found', origin, 404);
    }

    return jsonResponse({ success: true }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('deleteProductionNote error:', e.message);
    return errorResponse('Failed to delete note', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/**
 * GET /api/production/pitches/:pitchId/checklist
 */
export async function getProductionChecklist(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { checklist: {} } }, origin);

  try {
    const ws = await resolveWorkspace(sql, Number(userId), pitchId);
    if (!ws || !ws.canView) return jsonResponse({ success: true, data: { checklist: {} } }, origin);

    const result = await safeQuery<{ checklist: Record<string, unknown> }>(() => sql`
      SELECT checklist FROM production_checklists
      WHERE user_id = ${ws.workspaceUserId} AND pitch_id = ${pitchId}
    `, { fallback: [], context: 'production-pitch-data.checklist.read' });

    const checklist = result.rows.length > 0 ? result.rows[0].checklist : {};
    return jsonResponse({ success: true, data: { checklist } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getProductionChecklist error:', e.message);
    return jsonResponse({ success: true, data: { checklist: {} } }, origin);
  }
}

/**
 * PUT /api/production/pitches/:pitchId/checklist
 */
export async function updateProductionChecklist(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  const ws = await resolveWorkspace(sql, Number(userId), pitchId);
  if (!ws || !ws.canEdit) {
    return errorResponse('Not authorized to update production data on this pitch', origin, 403);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const checklist = body.checklist;
    if (typeof checklist !== 'object' || checklist === null) {
      return errorResponse('Checklist object is required', origin);
    }

    const checklistJson = JSON.stringify(checklist);

    // Production pitch → members write the owner's canonical row
    // (workspaceUserId = ownerId). Creator pitch → my own private row.
    await sql`
      INSERT INTO production_checklists (user_id, pitch_id, checklist)
      VALUES (${ws.workspaceUserId}, ${pitchId}, ${checklistJson}::jsonb)
      ON CONFLICT (user_id, pitch_id)
      DO UPDATE SET checklist = ${checklistJson}::jsonb, updated_at = NOW()
    `;

    return jsonResponse({ success: true, data: { checklist } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('updateProductionChecklist error:', e.message);
    return errorResponse('Failed to update checklist', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Team Assignments
// ---------------------------------------------------------------------------

/**
 * GET /api/production/pitches/:pitchId/team
 */
export async function getProductionTeam(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { team: [] } }, origin);

  try {
    const ws = await resolveWorkspace(sql, Number(userId), pitchId);
    if (!ws || !ws.canView) return jsonResponse({ success: true, data: { team: [] } }, origin);

    const result = await safeQuery<{ team: unknown[] }>(() => sql`
      SELECT team FROM production_team_assignments
      WHERE user_id = ${ws.workspaceUserId} AND pitch_id = ${pitchId}
    `, { fallback: [], context: 'production-pitch-data.team.read' });

    const team = result.rows.length > 0 ? result.rows[0].team : [];
    return jsonResponse({ success: true, data: { team } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getProductionTeam error:', e.message);
    return jsonResponse({ success: true, data: { team: [] } }, origin);
  }
}

/**
 * PUT /api/production/pitches/:pitchId/team
 */
export async function updateProductionTeam(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const pitchId = extractPitchId(request);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  const ws = await resolveWorkspace(sql, Number(userId), pitchId);
  if (!ws || !ws.canEdit) {
    return errorResponse('Not authorized to update production data on this pitch', origin, 403);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const team = body.team;
    if (!Array.isArray(team)) {
      return errorResponse('Team array is required', origin);
    }

    const teamJson = JSON.stringify(team);

    // Production pitch → owner's canonical row; creator pitch → my private row.
    await sql`
      INSERT INTO production_team_assignments (user_id, pitch_id, team)
      VALUES (${ws.workspaceUserId}, ${pitchId}, ${teamJson}::jsonb)
      ON CONFLICT (user_id, pitch_id)
      DO UPDATE SET team = ${teamJson}::jsonb, updated_at = NOW()
    `;

    return jsonResponse({ success: true, data: { team } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('updateProductionTeam error:', e.message);
    return errorResponse('Failed to update team', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Share toggle
// ---------------------------------------------------------------------------

/**
 * PATCH /api/production/pitches/:pitchId/notes/:noteId/share
 * Toggle the shared flag on a production note (owner only)
 */
export async function toggleNoteShared(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const pitchId = parseInt(parts[4] || '0', 10);
  const noteId = parseInt(parts[6] || '0', 10);
  if (!noteId) return errorResponse('Invalid note ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  const ws = await resolveWorkspace(sql, Number(userId), pitchId);
  if (!ws || !ws.canEdit) return errorResponse('Not authorized to share this note', origin, 403);

  try {
    const body = await request.json() as Record<string, unknown>;
    const shared = body.shared === true;

    // Production pitch → any team note; creator pitch → my own note.
    const result = ws.isProductionPitch
      ? await sql`
          UPDATE production_notes SET shared = ${shared}, updated_at = NOW()
          WHERE id = ${noteId} AND pitch_id = ${pitchId} AND user_id = ANY(${ws.teamUserIds})
          RETURNING id, shared`
      : await sql`
          UPDATE production_notes SET shared = ${shared}, updated_at = NOW()
          WHERE id = ${noteId} AND pitch_id = ${pitchId} AND user_id = ${Number(userId)}
          RETURNING id, shared`;

    if (result.length === 0) {
      return errorResponse('Note not found', origin, 404);
    }

    return jsonResponse({ success: true, data: { note: result[0] } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('toggleNoteShared error:', e.message);
    return errorResponse('Failed to update note', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Creator feedback (shared notes visible to pitch creator)
// ---------------------------------------------------------------------------

/**
 * GET /api/creator/pitches/:pitchId/feedback
 * Returns all shared production notes for a pitch (visible to pitch creator only)
 */
export async function getCreatorPitchFeedback(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/creator/pitches/:pitchId/feedback -> pitchId at index 4
  const pitchId = parseInt(parts[4] || '0', 10);
  if (!pitchId) return errorResponse('Invalid pitch ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { feedback: [] } }, origin);

  try {
    // Verify the caller owns this pitch
    const pitchCheck = await sql`
      SELECT id FROM pitches WHERE id = ${pitchId} AND user_id = ${Number(userId)}
    `;
    if (pitchCheck.length === 0) {
      return errorResponse('Not your pitch', origin, 403);
    }

    // Fetch all shared notes from any production user, with author info
    const feedbackResult = await safeQuery(() => sql`
      SELECT
        n.id, n.content, n.category, n.author, n.created_at,
        u.company_name,
        CONCAT(u.first_name, ' ', u.last_name) as reviewer_name,
        u.user_type
      FROM production_notes n
      JOIN users u ON u.id = n.user_id
      WHERE n.pitch_id = ${pitchId} AND n.shared = true
      ORDER BY n.created_at DESC
    `, { fallback: [], context: 'production-pitch-data.creator-feedback' });

    return jsonResponse({ success: true, data: { feedback: feedbackResult.rows } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getCreatorPitchFeedback error:', e.message);
    return jsonResponse({ success: true, data: { feedback: [] } }, origin);
  }
}

// ---------------------------------------------------------------------------
// Producer slate (workspace-driven evaluation pipeline)
// ---------------------------------------------------------------------------

type SlateStage = 'evaluating' | 'reviewing' | 'packaging' | 'ready';

function buildSlateItem(r: any): {
  pitchId: number; title: string; genre: string | null; format: string | null;
  poster: string | null; source: string; stage: SlateStage;
  completeness: { score: number; total: number };
  checklistPct: number; rolesConfirmed: number; rolesTotal: number; rolesFilled: number;
  notesCount: number; hasNda: boolean;
} {
  // Mirror the Feasibility tab's 9-field completeness (ProductionPitchView.calculateCompleteness).
  const team = Array.isArray(r.team) ? r.team : [];
  const rolesTotal = team.length;
  const rolesFilled = team.filter((m: any) => m?.name && String(m.name).trim() !== '').length;
  const rolesConfirmed = team.filter((m: any) => m?.status === 'confirmed').length;
  const rolesActive = team.filter((m: any) => m?.status === 'confirmed' || m?.status === 'considering').length;

  const present = [
    !!r.logline,
    !!(r.short_synopsis || r.long_synopsis),
    !!r.script_url,
    !!r.pitch_deck_url,
    !!r.trailer_url,
    !!(r.budget_range || r.estimated_budget || r.budget),
    Array.isArray(r.characters) ? r.characters.length > 0 : !!r.characters,
    !!r.target_audience,
    rolesFilled > 0,
  ];
  const completenessScore = present.filter(Boolean).length;

  const checklist = r.checklist && typeof r.checklist === 'object' ? r.checklist : {};
  const checklistKeys = Object.keys(checklist);
  const checklistDone = checklistKeys.filter((k) => !!checklist[k]).length;
  const checklistPct = checklistKeys.length > 0 ? Math.round((checklistDone / checklistKeys.length) * 100) : 0;

  const notesCount = Number(r.notes_count) || 0;
  const hasNda = r.has_nda === true;

  // Derived stage — default thresholds (tunable). Pure function of the signals.
  let stage: SlateStage = 'evaluating';
  if (hasNda || notesCount > 0 || checklistPct > 0 || rolesFilled > 0) stage = 'reviewing';
  if (rolesActive >= 1 || checklistPct >= 40) stage = 'packaging';
  if (rolesConfirmed >= 2 && checklistPct >= 80) stage = 'ready';

  return {
    pitchId: r.id, title: r.title, genre: r.genre ?? null, format: r.format ?? null,
    poster: r.poster ?? null, source: r.source, stage,
    completeness: { score: completenessScore, total: present.length },
    checklistPct, rolesConfirmed, rolesTotal, rolesFilled,
    notesCount, hasNda,
  };
}

/**
 * GET /api/production/slate
 *
 * The producer's deal funnel: their OWNED production pitches + SAVED creator
 * pitches, each annotated with workspace-derived readiness (completeness,
 * checklist %, confirmed roles, notes, NDA) and a DERIVED stage (evaluating →
 * reviewing → packaging → ready). v1: purely derived — read-only, no new tables,
 * no manual override. Does NOT touch the parked `production_pipeline` feature.
 *
 * All of a producer's own workspace rows are keyed on their user_id (canonical
 * owner row for owned pitches = themselves; private row for saved creator
 * pitches), so the join is simply `user_id = me`.
 */
export async function getProductionSlate(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);
  const me = Number(userId);

  const emptyCounts = { evaluating: 0, reviewing: 0, packaging: 0, ready: 0 };
  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { slate: [], counts: emptyCounts } }, origin);

  try {
    const [u] = await sql`SELECT user_type FROM users WHERE id = ${me}`;
    if (u?.user_type !== 'production') return errorResponse('Production accounts only', origin, 403);

    const res = await safeQuery(() => sql`
      WITH slate_pitches AS (
        SELECT p.id, p.title, p.genre, p.format, p.logline,
               p.short_synopsis, p.long_synopsis, p.script_url, p.pitch_deck_url, p.trailer_url,
               p.target_audience, p.characters, p.budget_range, p.estimated_budget, p.budget,
               COALESCE(p.thumbnail_url, p.title_image) AS poster,
               p.created_at, 'owned' AS source
        FROM pitches p
        WHERE p.user_id = ${me}
        UNION
        SELECT p.id, p.title, p.genre, p.format, p.logline,
               p.short_synopsis, p.long_synopsis, p.script_url, p.pitch_deck_url, p.trailer_url,
               p.target_audience, p.characters, p.budget_range, p.estimated_budget, p.budget,
               COALESCE(p.thumbnail_url, p.title_image) AS poster,
               p.created_at, 'saved' AS source
        FROM saved_pitches sp
        JOIN pitches p ON p.id = sp.pitch_id
        WHERE sp.user_id = ${me} AND p.user_id <> ${me}
      )
      SELECT sp.*, c.checklist, t.team,
        COALESCE((SELECT COUNT(*)::int FROM production_notes n WHERE n.pitch_id = sp.id AND n.user_id = ${me}), 0) AS notes_count,
        EXISTS (SELECT 1 FROM ndas nd WHERE nd.pitch_id = sp.id AND nd.signer_id = ${me} AND (nd.status = 'approved' OR nd.status = 'signed')) AS has_nda
      FROM slate_pitches sp
      LEFT JOIN production_checklists c ON c.user_id = ${me} AND c.pitch_id = sp.id
      LEFT JOIN production_team_assignments t ON t.user_id = ${me} AND t.pitch_id = sp.id
      ORDER BY sp.created_at DESC
    `, { fallback: [], context: 'production-pitch-data.slate' });

    const slate = res.rows.map((r: any) => buildSlateItem(r));
    const counts = { ...emptyCounts };
    for (const s of slate) counts[s.stage]++;
    return jsonResponse({ success: true, data: { slate, counts } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getProductionSlate error:', e.message);
    return jsonResponse({ success: true, data: { slate: [], counts: emptyCounts } }, origin);
  }
}
