/**
 * Extended Production Dashboard Handlers
 * Real SQL implementations for talent, crew, locations, pipeline, budget, and schedule.
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

function extractParam(request: Request, position: number): string {
  const parts = new URL(request.url).pathname.split('/');
  return parts[position] || '';
}

// ---------------------------------------------------------------------------
// Talent Management (production_talent — INTEGER PKs)
// ---------------------------------------------------------------------------

/** GET /api/production/talent/search */
export async function productionTalentSearchHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { talent: [], total: 0 } }, origin);

  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || '';
    const availability = url.searchParams.get('availability') || '';
    const search = url.searchParams.get('search') || '';
    const maxRate = Number(url.searchParams.get('maxRate')) || 0;
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

    const talent = await sql`
      SELECT id, first_name, last_name, stage_name, talent_type,
             day_rate, currency, availability_status, location,
             rating, years_experience, credits_count, skills,
             reel_url, portfolio_url, imdb_url, created_at
      FROM production_talent
      WHERE 1=1
        AND (${role} = '' OR talent_type = ${role})
        AND (${availability} = '' OR availability_status = ${availability})
        AND (${maxRate} = 0 OR day_rate <= ${maxRate})
        AND (${search} = '' OR first_name ILIKE ${'%' + search + '%'}
             OR last_name ILIKE ${'%' + search + '%'}
             OR stage_name ILIKE ${'%' + search + '%'})
      ORDER BY rating DESC NULLS LAST, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `.catch(() => []);

    const countResult = await sql`
      SELECT COUNT(*)::int AS total FROM production_talent
      WHERE 1=1
        AND (${role} = '' OR talent_type = ${role})
        AND (${availability} = '' OR availability_status = ${availability})
        AND (${maxRate} = 0 OR day_rate <= ${maxRate})
        AND (${search} = '' OR first_name ILIKE ${'%' + search + '%'}
             OR last_name ILIKE ${'%' + search + '%'}
             OR stage_name ILIKE ${'%' + search + '%'})
    `.catch(() => [{ total: 0 }]);

    return jsonResponse({
      success: true,
      data: { talent, total: countResult[0]?.total || 0 }
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionTalentSearchHandler error:', e.message);
    return jsonResponse({ success: true, data: { talent: [], total: 0 } }, origin);
  }
}

/** GET /api/production/talent/:id */
export async function productionTalentDetailsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const talentId = Number(extractParam(request, 4)); // /api/production/talent/:id
  if (!talentId) return errorResponse('Invalid talent ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const result = await sql`
      SELECT t.*, u.email, u.name as user_name
      FROM production_talent t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = ${talentId}
    `.catch(() => []);

    if (result.length === 0) {
      return errorResponse('Talent not found', origin, 404);
    }

    return jsonResponse({ success: true, data: { talent: result[0] } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionTalentDetailsHandler error:', e.message);
    return errorResponse('Failed to fetch talent details', origin, 500);
  }
}

/** POST /api/production/talent/:id/contact */
export async function productionTalentContactHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  // /api/production/talent/:id/contact → id at index 4
  const talentId = extractParam(request, 4);
  if (!talentId) return errorResponse('Invalid talent ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return errorResponse('Message is required', origin);

    // Look up talent to find associated user_id
    const talent = await sql`
      SELECT user_id, first_name, last_name FROM production_talent WHERE id = ${Number(talentId)}
    `.catch(() => []);

    if (talent.length === 0) {
      return errorResponse('Talent not found', origin, 404);
    }

    // Insert notification for the talent's user if they have one
    if (talent[0].user_id) {
      await sql`
        INSERT INTO notifications (user_id, type, title, message, related_user_id, created_at)
        VALUES (
          ${Number(talent[0].user_id)},
          'talent_contact',
          'Production Company Contact',
          ${message},
          ${Number(userId)},
          NOW()
        )
      `.catch(() => []);
    }

    return jsonResponse({ success: true, data: { contacted: true } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionTalentContactHandler error:', e.message);
    return errorResponse('Failed to contact talent', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Project Management (production_pipeline — INTEGER PKs)
// ---------------------------------------------------------------------------

/** GET /api/production/pipeline/:id or /api/production/projects/:id */
export async function productionProjectDetailsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = Number(extractParam(request, 4));
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const result = await sql`
      SELECT pp.*,
             p.title AS pitch_title, p.genre, p.logline, p.format, p.estimated_budget,
             COALESCE(u.name, u.first_name || ' ' || u.last_name) AS creator_name
      FROM production_pipeline pp
      LEFT JOIN pitches p ON pp.pitch_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE pp.id = ${projectId} AND pp.production_company_id = ${Number(userId)}
    `.catch(() => []);

    if (result.length === 0) {
      return errorResponse('Project not found', origin, 404);
    }

    // Fetch milestones for the project
    const milestones = await sql`
      SELECT id, title, description, due_date, completed, completed_at
      FROM project_milestones
      WHERE project_id = ${projectId}
      ORDER BY due_date ASC NULLS LAST
    `.catch(() => []);

    return jsonResponse({
      success: true,
      data: { project: { ...result[0], milestones } }
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionProjectDetailsHandler error:', e.message);
    return errorResponse('Failed to fetch project details', origin, 500);
  }
}

/** PUT /api/production/pipeline/:id/status */
export async function productionProjectStatusHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  // /api/production/pipeline/:id/status → id at index 4
  const projectId = Number(extractParam(request, 4));
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const status = typeof body.status === 'string' ? body.status : undefined;
    const stage = typeof body.stage === 'string' ? body.stage : undefined;
    const completionPercentage = typeof body.completion_percentage === 'number' ? body.completion_percentage : undefined;

    const validStatuses = ['active', 'paused', 'completed', 'cancelled'];
    const validStages = ['development', 'pre-production', 'production', 'post-production', 'delivery', 'release'];

    if (status && !validStatuses.includes(status)) {
      return errorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, origin);
    }
    if (stage && !validStages.includes(stage)) {
      return errorResponse(`Invalid stage. Must be one of: ${validStages.join(', ')}`, origin);
    }

    const result = await sql`
      UPDATE production_pipeline
      SET
        status = COALESCE(${status ?? null}, status),
        stage = COALESCE(${stage ?? null}, stage),
        completion_percentage = COALESCE(${completionPercentage ?? null}, completion_percentage),
        updated_at = NOW()
      WHERE id = ${projectId} AND production_company_id = ${Number(userId)}
      RETURNING *
    `.catch(() => []);

    if (result.length === 0) {
      return errorResponse('Project not found', origin, 404);
    }

    return jsonResponse({ success: true, data: { project: result[0] } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionProjectStatusHandler error:', e.message);
    return errorResponse('Failed to update project status', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Budget Management (production_pipeline budget fields + production_budgets)
// ---------------------------------------------------------------------------

/** PUT /api/production/budget/:projectId */
export async function productionBudgetUpdateHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = Number(extractParam(request, 4));
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const budgetAllocated = typeof body.budget_allocated === 'number' ? body.budget_allocated : undefined;
    const budgetSpent = typeof body.budget_spent === 'number' ? body.budget_spent : undefined;
    const contingencyPercentage = typeof body.contingency_percentage === 'number' ? body.contingency_percentage : undefined;
    const contingencyUsed = typeof body.contingency_used === 'number' ? body.contingency_used : undefined;

    const result = await sql`
      UPDATE production_pipeline
      SET
        budget_allocated = COALESCE(${budgetAllocated ?? null}, budget_allocated),
        budget_spent = COALESCE(${budgetSpent ?? null}, budget_spent),
        budget_remaining = COALESCE(${budgetAllocated ?? null}, budget_allocated) - COALESCE(${budgetSpent ?? null}, budget_spent),
        contingency_percentage = COALESCE(${contingencyPercentage ?? null}, contingency_percentage),
        contingency_used = COALESCE(${contingencyUsed ?? null}, contingency_used),
        updated_at = NOW()
      WHERE id = ${projectId} AND production_company_id = ${Number(userId)}
      RETURNING id, budget_allocated, budget_spent, budget_remaining, contingency_percentage, contingency_used
    `.catch(() => []);

    if (result.length === 0) {
      return errorResponse('Project not found', origin, 404);
    }

    return jsonResponse({ success: true, data: { budget: result[0] } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionBudgetUpdateHandler error:', e.message);
    return errorResponse('Failed to update budget', origin, 500);
  }
}

/** GET /api/production/budget/:projectId/variance */
export async function productionBudgetVarianceHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = Number(extractParam(request, 4));
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { budgetAllocated: 0, budgetSpent: 0, budgetRemaining: 0, variance: 0 } }, origin);

  try {
    const result = await sql`
      SELECT budget_allocated, budget_spent, budget_remaining,
             contingency_percentage, contingency_used,
             CASE WHEN budget_allocated > 0
               THEN ROUND(((budget_spent - budget_allocated) / budget_allocated * 100)::numeric, 2)
               ELSE 0
             END AS variance_percentage
      FROM production_pipeline
      WHERE id = ${projectId} AND production_company_id = ${Number(userId)}
    `.catch(() => []);

    if (result.length === 0) {
      return errorResponse('Project not found', origin, 404);
    }

    const row = result[0];
    return jsonResponse({
      success: true,
      data: {
        budgetAllocated: Number(row.budget_allocated) || 0,
        budgetSpent: Number(row.budget_spent) || 0,
        budgetRemaining: Number(row.budget_remaining) || 0,
        variance: Number(row.variance_percentage) || 0,
        contingencyPercentage: Number(row.contingency_percentage) || 0,
        contingencyUsed: Number(row.contingency_used) || 0
      }
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionBudgetVarianceHandler error:', e.message);
    return jsonResponse({ success: true, data: { budgetAllocated: 0, budgetSpent: 0, budgetRemaining: 0, variance: 0 } }, origin);
  }
}

// ---------------------------------------------------------------------------
// Schedule Management (production_schedules — INTEGER PKs)
// ---------------------------------------------------------------------------

/** PUT /api/production/schedule/:projectId */
export async function productionScheduleUpdateHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = Number(extractParam(request, 4));
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const entries = Array.isArray(body.entries) ? body.entries : [];

    if (entries.length === 0) {
      return errorResponse('At least one schedule entry is required', origin);
    }

    const results = [];
    for (const entry of entries) {
      const e = entry as Record<string, unknown>;
      const sceneNumber = typeof e.scene_number === 'string' ? e.scene_number : null;
      const sceneDescription = typeof e.scene_description === 'string' ? e.scene_description : null;
      const scheduledDate = typeof e.scheduled_date === 'string' ? e.scheduled_date : null;
      const callTime = typeof e.call_time === 'string' ? e.call_time : null;
      const wrapTime = typeof e.wrap_time === 'string' ? e.wrap_time : null;
      const schedStatus = typeof e.status === 'string' ? e.status : 'scheduled';

      if (!scheduledDate) continue;

      const row = await sql`
        INSERT INTO production_schedules (project_id, scene_number, scene_description, scheduled_date, call_time, wrap_time, status)
        VALUES (${projectId}, ${sceneNumber}, ${sceneDescription}, ${scheduledDate}, ${callTime}, ${wrapTime}, ${schedStatus})
        ON CONFLICT (id) DO UPDATE SET
          scene_number = EXCLUDED.scene_number,
          scene_description = EXCLUDED.scene_description,
          scheduled_date = EXCLUDED.scheduled_date,
          call_time = EXCLUDED.call_time,
          wrap_time = EXCLUDED.wrap_time,
          status = EXCLUDED.status,
          updated_at = NOW()
        RETURNING *
      `.catch(() => []);

      if (row.length > 0) results.push(row[0]);
    }

    return jsonResponse({ success: true, data: { schedule: results } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionScheduleUpdateHandler error:', e.message);
    return errorResponse('Failed to update schedule', origin, 500);
  }
}

/** GET /api/production/schedule/:projectId/conflicts */
export async function productionScheduleConflictsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const projectId = Number(extractParam(request, 4));
  if (!projectId) return errorResponse('Invalid project ID', origin);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { conflicts: [] } }, origin);

  try {
    // Find overlapping scheduled dates with same cast/crew in the same project
    const conflicts = await sql`
      SELECT a.id AS schedule_a, b.id AS schedule_b,
             a.scene_number AS scene_a, b.scene_number AS scene_b,
             a.scheduled_date, a.call_time AS call_a, a.wrap_time AS wrap_a,
             b.call_time AS call_b, b.wrap_time AS wrap_b
      FROM production_schedules a
      JOIN production_schedules b ON a.project_id = b.project_id
        AND a.scheduled_date = b.scheduled_date
        AND a.id < b.id
      WHERE a.project_id = ${projectId}
        AND a.status != 'cancelled'
        AND b.status != 'cancelled'
      ORDER BY a.scheduled_date
    `.catch(() => []);

    return jsonResponse({ success: true, data: { conflicts } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionScheduleConflictsHandler error:', e.message);
    return jsonResponse({ success: true, data: { conflicts: [] } }, origin);
  }
}

// ---------------------------------------------------------------------------
// Location Scouting (location_scouts — INTEGER PKs)
// ---------------------------------------------------------------------------

/** GET /api/production/locations/search */
export async function productionLocationSearchHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { locations: [], total: 0 } }, origin);

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || '';
    const city = url.searchParams.get('city') || '';
    const search = url.searchParams.get('search') || '';
    const maxRate = Number(url.searchParams.get('maxRate')) || 0;
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

    const locations = await sql`
      SELECT id, name, type, city, state_province, country,
             daily_rate, weekly_rate, currency, availability_status,
             square_footage, parking_spaces, power_available, rating,
             times_booked, photos, permit_required, created_at
      FROM location_scouts
      WHERE 1=1
        AND (${type} = '' OR type = ${type})
        AND (${city} = '' OR city ILIKE ${'%' + city + '%'})
        AND (${maxRate} = 0 OR daily_rate <= ${maxRate})
        AND (${search} = '' OR name ILIKE ${'%' + search + '%'}
             OR address ILIKE ${'%' + search + '%'})
      ORDER BY rating DESC NULLS LAST, times_booked DESC
      LIMIT ${limit} OFFSET ${offset}
    `.catch(() => []);

    const countResult = await sql`
      SELECT COUNT(*)::int AS total FROM location_scouts
      WHERE 1=1
        AND (${type} = '' OR type = ${type})
        AND (${city} = '' OR city ILIKE ${'%' + city + '%'})
        AND (${maxRate} = 0 OR daily_rate <= ${maxRate})
        AND (${search} = '' OR name ILIKE ${'%' + search + '%'}
             OR address ILIKE ${'%' + search + '%'})
    `.catch(() => [{ total: 0 }]);

    return jsonResponse({
      success: true,
      data: { locations, total: countResult[0]?.total || 0 }
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionLocationSearchHandler error:', e.message);
    return jsonResponse({ success: true, data: { locations: [], total: 0 } }, origin);
  }
}

/** GET /api/production/locations/:id */
export async function productionLocationDetailsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const locationId = Number(extractParam(request, 4));
  if (!locationId) return errorResponse('Invalid location ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const result = await sql`
      SELECT ls.*,
             (SELECT COUNT(*)::int FROM location_bookings lb WHERE lb.location_id = ls.id) AS booking_count
      FROM location_scouts ls
      WHERE ls.id = ${locationId}
    `.catch(() => []);

    if (result.length === 0) {
      return errorResponse('Location not found', origin, 404);
    }

    return jsonResponse({ success: true, data: { location: result[0] } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionLocationDetailsHandler error:', e.message);
    return errorResponse('Failed to fetch location details', origin, 500);
  }
}

/** POST /api/production/locations/:id/book */
export async function productionLocationBookHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  // /api/production/locations/:id/book → id at index 4
  const locationId = Number(extractParam(request, 4));
  if (!locationId) return errorResponse('Invalid location ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const projectId = Number(body.projectId) || 0;
    const startDate = typeof body.startDate === 'string' ? body.startDate : '';
    const endDate = typeof body.endDate === 'string' ? body.endDate : '';

    if (!projectId || !startDate || !endDate) {
      return errorResponse('projectId, startDate, and endDate are required', origin);
    }

    // Calculate total cost from location daily rate and date range
    const location = await sql`
      SELECT daily_rate FROM location_scouts WHERE id = ${locationId}
    `.catch(() => []);

    if (location.length === 0) {
      return errorResponse('Location not found', origin, 404);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const totalCost = (Number(location[0].daily_rate) || 0) * days;

    const booking = await sql`
      INSERT INTO location_bookings (location_id, project_id, booked_by, start_date, end_date, total_cost, status)
      VALUES (${locationId}, ${projectId}, ${Number(userId)}, ${startDate}, ${endDate}, ${totalCost}, 'pending')
      RETURNING *
    `;

    // Increment times_booked on the location
    await sql`
      UPDATE location_scouts SET times_booked = times_booked + 1 WHERE id = ${locationId}
    `.catch(() => []);

    return jsonResponse({ success: true, data: { booking: booking[0] } }, origin, 201);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionLocationBookHandler error:', e.message);
    return errorResponse('Failed to book location', origin, 500);
  }
}

// ---------------------------------------------------------------------------
// Crew Assembly (production_crew — INTEGER PKs)
// ---------------------------------------------------------------------------

/** GET /api/production/crew/search */
export async function productionCrewSearchHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const sql = getDb(env);
  if (!sql) return jsonResponse({ success: true, data: { crew: [], total: 0 } }, origin);

  try {
    const url = new URL(request.url);
    const department = url.searchParams.get('department') || '';
    const position = url.searchParams.get('position') || '';
    const search = url.searchParams.get('search') || '';
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

    const crew = await sql`
      SELECT id, first_name, last_name, department, position,
             day_rate, kit_rental_rate, currency, availability_status,
             current_project, available_from, years_experience,
             specialties, equipment_owned, location, rating,
             completed_projects, email, phone, created_at
      FROM production_crew
      WHERE 1=1
        AND (${department} = '' OR department = ${department})
        AND (${position} = '' OR position ILIKE ${'%' + position + '%'})
        AND (${search} = '' OR first_name ILIKE ${'%' + search + '%'}
             OR last_name ILIKE ${'%' + search + '%'}
             OR position ILIKE ${'%' + search + '%'})
      ORDER BY rating DESC NULLS LAST, completed_projects DESC
      LIMIT ${limit} OFFSET ${offset}
    `.catch(() => []);

    const countResult = await sql`
      SELECT COUNT(*)::int AS total FROM production_crew
      WHERE 1=1
        AND (${department} = '' OR department = ${department})
        AND (${position} = '' OR position ILIKE ${'%' + position + '%'})
        AND (${search} = '' OR first_name ILIKE ${'%' + search + '%'}
             OR last_name ILIKE ${'%' + search + '%'}
             OR position ILIKE ${'%' + search + '%'})
    `.catch(() => [{ total: 0 }]);

    return jsonResponse({
      success: true,
      data: { crew, total: countResult[0]?.total || 0 }
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionCrewSearchHandler error:', e.message);
    return jsonResponse({ success: true, data: { crew: [], total: 0 } }, origin);
  }
}

/** GET /api/production/crew/:id */
export async function productionCrewDetailsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  const crewId = Number(extractParam(request, 4));
  if (!crewId) return errorResponse('Invalid crew ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const result = await sql`
      SELECT * FROM production_crew WHERE id = ${crewId}
    `.catch(() => []);

    if (result.length === 0) {
      return errorResponse('Crew member not found', origin, 404);
    }

    return jsonResponse({ success: true, data: { crew: result[0] } }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionCrewDetailsHandler error:', e.message);
    return errorResponse('Failed to fetch crew details', origin, 500);
  }
}

/** POST /api/production/crew/:id/hire */
export async function productionCrewHireHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const userId = await getUserId(request, env);
  if (!userId) return errorResponse('Unauthorized', origin, 401);

  // /api/production/crew/:id/hire → id at index 4
  const crewId = Number(extractParam(request, 4));
  if (!crewId) return errorResponse('Invalid crew ID', origin);

  const sql = getDb(env);
  if (!sql) return errorResponse('Database unavailable', origin, 503);

  try {
    const body = await request.json() as Record<string, unknown>;
    const projectId = typeof body.projectId === 'number' ? body.projectId : 0;
    const startDate = typeof body.startDate === 'string' ? body.startDate : '';
    const agreedRate = typeof body.agreedRate === 'number' ? body.agreedRate : undefined;

    if (!projectId) return errorResponse('projectId is required', origin);

    // Verify crew exists
    const crew = await sql`
      SELECT id, first_name, last_name, availability_status FROM production_crew WHERE id = ${crewId}
    `.catch(() => []);

    if (crew.length === 0) {
      return errorResponse('Crew member not found', origin, 404);
    }

    // Get project title for the current_project field
    const project = await sql`
      SELECT title FROM production_pipeline WHERE id = ${projectId} AND production_company_id = ${Number(userId)}
    `.catch(() => []);

    const projectTitle = project.length > 0 ? (project[0].title || `Project #${projectId}`) : `Project #${projectId}`;

    // Update crew member
    await sql`
      UPDATE production_crew
      SET availability_status = 'on_project',
          current_project = ${projectTitle},
          available_from = NULL,
          day_rate = COALESCE(${agreedRate ?? null}, day_rate),
          updated_at = NOW()
      WHERE id = ${crewId}
    `;

    return jsonResponse({
      success: true,
      data: {
        hired: true,
        crewId,
        projectId,
        crewName: `${crew[0].first_name} ${crew[0].last_name}`,
        startDate: startDate || null
      }
    }, origin);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error('productionCrewHireHandler error:', e.message);
    return errorResponse('Failed to hire crew member', origin, 500);
  }
}
