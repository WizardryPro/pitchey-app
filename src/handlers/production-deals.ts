/**
 * Production Deals, Distribution, Milestones, and Export Handlers
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { getUserId } from '../utils/auth-extract';

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}

function errorResponse(message: string, origin: string | null, status = 400): Response {
  return jsonResponse({ success: false, error: message }, origin, status);
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

/** GET /api/production/deals */
export async function getProductionDeals(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { deals: [], total: 0 } }, origin);

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || '';
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

    const validSorts: Record<string, string> = {
      signedAt: 'signed_at',
      amount: 'amount',
      expiresAt: 'expires_at',
      created_at: 'created_at',
    };
    const orderCol = validSorts[sortBy] || 'created_at';

    const deals = await sql`
      SELECT d.*,
             d.deal_state AS status,
             COALESCE(d.option_amount, d.purchase_price, d.development_fee, 0) AS amount,
             p.title AS pitch_title, p.genre AS pitch_genre,
             COALESCE(cu.name, cu.first_name || ' ' || cu.last_name) AS creator_name,
             cu.email AS creator_email
      FROM production_deals d
      LEFT JOIN pitches p ON d.pitch_id = p.id
      LEFT JOIN users cu ON d.creator_id = cu.id
      WHERE d.production_company_id = ${Number(userId)}
        AND (${status} = '' OR d.deal_state::text = ${status})
      ORDER BY
        CASE WHEN ${orderCol} = 'signed_at' THEN d.state_changed_at END DESC NULLS LAST,
        CASE WHEN ${orderCol} = 'amount' THEN COALESCE(d.option_amount, d.purchase_price, d.development_fee, 0) END DESC NULLS LAST,
        CASE WHEN ${orderCol} = 'created_at' THEN d.created_at END DESC NULLS LAST,
        d.created_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `.catch(() => []);

    const countResult = await sql`
      SELECT COUNT(*)::int AS total FROM production_deals
      WHERE production_company_id = ${Number(userId)}
        AND (${status} = '' OR deal_state::text = ${status})
    `.catch(() => [{ total: 0 }]);

    return jsonResponse({
      success: true,
      data: { deals, total: countResult[0]?.total || 0 }
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getProductionDeals error:', e.message);
    return jsonResponse({ success: true, data: { deals: [], total: 0 } }, origin);
  }
}

/** POST /api/production/deals */
export async function createProductionDeal(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const pitchId = Number(body.pitchId) || 0;
    const dealType = typeof body.dealType === 'string' ? body.dealType : '';
    const amount = Number(body.amount) || 0;
    const terms = typeof body.terms === 'string' ? body.terms : '';
    const royaltyPercentage = typeof body.royaltyPercentage === 'number' ? body.royaltyPercentage : null;
    const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : null;

    if (!pitchId) return errorResponse('pitchId is required', origin);

    const validTypes = ['option', 'purchase', 'development', 'production'];
    if (!validTypes.includes(dealType)) {
      return errorResponse(`Invalid dealType. Must be one of: ${validTypes.join(', ')}`, origin);
    }

    // Lookup pitch for creator_id
    const pitch = await sql`SELECT user_id FROM pitches WHERE id = ${pitchId}`.catch(() => []);
    const creatorId = pitch.length > 0 ? pitch[0].user_id : null;

    const result = await sql`
      INSERT INTO production_deals (pitch_id, production_company_id, creator_id, deal_type, option_amount, backend_percentage, notes)
      VALUES (${pitchId}, ${Number(userId)}, ${creatorId}, ${dealType}, ${amount}, ${royaltyPercentage}, ${terms})
      RETURNING *, deal_state AS status, option_amount AS amount
    `;

    // Notify the creator
    if (creatorId) {
      await sql`
        INSERT INTO notifications (user_id, type, title, message, related_user_id, related_pitch_id, created_at)
        VALUES (
          ${creatorId}, 'deal_proposed', 'New Deal Proposal',
          ${'A production company has proposed a ' + dealType + ' deal for your pitch'},
          ${Number(userId)}, ${pitchId}, NOW()
        )
      `.catch(() => []);
    }

    return jsonResponse({ success: true, data: { deal: result[0] } }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('createProductionDeal error:', e.message);
    return errorResponse('Failed to create deal', origin, 500);
  }
}

/** GET /api/production/deals/:dealId/contract */
export async function getProductionContract(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const parts = new URL(request.url).pathname.split('/');
  const dealId = Number(parts[4]); // /api/production/deals/:dealId/contract
  if (!dealId) return errorResponse('Invalid deal ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const result = await sql`
      SELECT d.*,
             p.title AS pitch_title, p.genre, p.logline,
             COALESCE(cu.name, cu.first_name || ' ' || cu.last_name) AS creator_name,
             cu.email AS creator_email,
             COALESCE(pu.name, pu.first_name || ' ' || pu.last_name) AS production_name,
             pu.email AS production_email
      FROM production_deals d
      LEFT JOIN pitches p ON d.pitch_id = p.id
      LEFT JOIN users cu ON d.creator_id = cu.id
      LEFT JOIN users pu ON d.production_company_id = pu.id
      WHERE d.id = ${dealId} AND d.production_company_id = ${Number(userId)}
    `.catch(() => []);

    if (result.length === 0) {
      return errorResponse('Deal not found', origin, 404);
    }

    const deal = result[0];

    // Build contract JSON representation
    const contract = {
      title: `${(deal.deal_type as string).toUpperCase()} AGREEMENT`,
      date: deal.created_at,
      parties: {
        production: { name: deal.production_name, email: deal.production_email },
        creator: { name: deal.creator_name, email: deal.creator_email },
      },
      subject: {
        pitchTitle: deal.pitch_title,
        genre: deal.genre,
        logline: deal.logline,
      },
      terms: {
        dealType: deal.deal_type,
        optionAmount: Number(deal.option_amount) || 0,
        purchasePrice: Number(deal.purchase_price) || 0,
        backendPercentage: Number(deal.backend_percentage) || 0,
        developmentFee: Number(deal.development_fee) || 0,
        territory: deal.rights_territory || '',
        notes: deal.notes || '',
      },
      status: deal.deal_state,
    };

    return jsonResponse({ success: true, data: { contract } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getProductionContract error:', e.message);
    return errorResponse('Failed to generate contract', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Distribution Channels
// ---------------------------------------------------------------------------

/** GET /api/production/projects/:id/distribution */
export async function getDistributionChannels(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = Number(new URL(request.url).pathname.split('/')[4]);
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { channels: [] } }, origin);

  try {
    // Verify ownership
    const project = await sql`
      SELECT id FROM production_pipeline WHERE id = ${projectId} AND production_company_id = ${Number(userId)}
    `.catch(() => []);

    if (project.length === 0) {
      return errorResponse('Project not found', origin, 404);
    }

    const channels = await sql`
      SELECT * FROM distribution_channels
      WHERE project_id = ${projectId}
      ORDER BY release_date ASC NULLS LAST
    `.catch(() => []);

    return jsonResponse({ success: true, data: { channels } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('getDistributionChannels error:', e.message);
    return jsonResponse({ success: true, data: { channels: [] } }, origin);
  }
}

// ---------------------------------------------------------------------------
// Export Project Data
// ---------------------------------------------------------------------------

/** GET /api/production/projects/:id/export */
export async function exportProjectData(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = Number(new URL(request.url).pathname.split('/')[4]);
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    // Fetch project
    const projectResult = await sql`
      SELECT pp.*,
             p.title AS pitch_title, p.genre, p.logline, p.format, p.estimated_budget
      FROM production_pipeline pp
      LEFT JOIN pitches p ON pp.pitch_id = p.id
      WHERE pp.id = ${projectId} AND pp.production_company_id = ${Number(userId)}
    `.catch(() => []);

    if (projectResult.length === 0) {
      return errorResponse('Project not found', origin, 404);
    }

    // Fetch related data in parallel
    const [milestones, channels, deals] = await Promise.all([
      sql`SELECT * FROM project_milestones WHERE project_id = ${projectId} ORDER BY due_date`.catch(() => []),
      sql`SELECT * FROM distribution_channels WHERE project_id = ${projectId}`.catch(() => []),
      sql`SELECT * FROM production_deals WHERE pitch_id = ${projectResult[0].pitch_id}`.catch(() => []),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      project: projectResult[0],
      milestones,
      distributionChannels: channels,
      deals,
    };

    return jsonResponse({ success: true, data: exportData }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('exportProjectData error:', e.message);
    return errorResponse('Failed to export project data', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

/** PUT /api/production/projects/:projectId/milestones/:milestoneId */
export async function updateProjectMilestone(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const parts = new URL(request.url).pathname.split('/');
  // /api/production/projects/:projectId/milestones/:milestoneId
  const projectId = Number(parts[4]);
  const milestoneId = Number(parts[6]);
  if (!projectId || !milestoneId) return errorResponse('Invalid project or milestone ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    // Verify project ownership
    const project = await sql`
      SELECT id FROM production_pipeline WHERE id = ${projectId} AND production_company_id = ${Number(userId)}
    `.catch(() => []);

    if (project.length === 0) {
      return errorResponse('Project not found', origin, 404);
    }

    const body = await request.json() as Record<string, unknown>;
    const completed = typeof body.completed === 'boolean' ? body.completed : undefined;
    const title = typeof body.title === 'string' ? body.title : undefined;
    const description = typeof body.description === 'string' ? body.description : undefined;
    const dueDate = typeof body.due_date === 'string' ? body.due_date : undefined;
    const notes = typeof body.notes === 'string' ? body.notes : undefined;

    const result = await sql`
      UPDATE project_milestones
      SET
        title = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}::text, COALESCE(${notes ?? null}::text, description)),
        due_date = COALESCE(${dueDate ?? null}::date, due_date),
        completed = COALESCE(${completed ?? null}, completed),
        completed_at = CASE
          WHEN ${completed ?? null} = true THEN NOW()
          WHEN ${completed ?? null} = false THEN NULL
          ELSE completed_at
        END,
        updated_at = NOW()
      WHERE id = ${milestoneId} AND project_id = ${projectId}
      RETURNING *
    `.catch(() => []);

    if (result.length === 0) {
      return errorResponse('Milestone not found', origin, 404);
    }

    return jsonResponse({ success: true, data: { milestone: result[0] } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('updateProjectMilestone error:', e.message);
    return errorResponse('Failed to update milestone', origin, 500);
  }
}
