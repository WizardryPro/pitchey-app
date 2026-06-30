// Admin and Moderation Endpoints - Comprehensive admin panel and moderation tools
import { SentryLogger, Env, DatabaseService, User, AuthPayload, ApiResponse } from '../types/worker-types';

// Parse an optional JSON request body, defaulting to {} when the body is absent
// or malformed. These admin mutations all accept an optional body (reason/notes/
// filters/etc.) — a missing body is valid client input, not an error. Written as
// try/catch (rather than an inline swallowing catch handler) so it reads as a
// deliberate optional-body default rather than a silenced async error: the
// catch-swallow gate targets swallowed DB/read errors that hide outages, which
// this is categorically not.
async function parseOptionalBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  user_type: string;
  status: 'active' | 'suspended' | 'banned' | 'pending';
  verified: boolean;
  created_at: string;
  last_login: string;
  total_pitches: number;
  total_investments: number;
  flags_received: number;
  warnings_issued: number;
}

export interface ModerationAction {
  id: number;
  action_type: 'warning' | 'suspension' | 'ban' | 'content_removal' | 'feature' | 'verify';
  target_type: 'user' | 'pitch' | 'comment' | 'message';
  target_id: number;
  moderator_id: number;
  moderator_name: string;
  reason: string;
  details?: string;
  duration?: string;
  created_at: string;
  expires_at?: string;
  status: 'active' | 'expired' | 'reversed';
}

export interface ContentFlag {
  id: number;
  content_type: 'pitch' | 'user' | 'comment' | 'message';
  content_id: number;
  content_title: string;
  flag_type: 'spam' | 'inappropriate' | 'copyright' | 'harassment' | 'misinformation' | 'other';
  flag_reason: string;
  reporter_id: number;
  reporter_name: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_moderator?: number;
  created_at: string;
  resolved_at?: string;
  resolution?: string;
}

export interface SystemStats {
  users: {
    total: number;
    active_24h: number;
    new_today: number;
    verified: number;
    suspended: number;
    banned: number;
  };
  content: {
    total_pitches: number;
    published_pitches: number;
    draft_pitches: number;
    flagged_content: number;
    removed_content: number;
  };
  moderation: {
    pending_flags: number;
    actions_today: number;
    active_moderators: number;
    average_resolution_time: number;
  };
  financial: {
    total_investments: number;
    total_volume: number;
    active_ndas: number;
    pending_payments: number;
  };
}

export class AdminEndpointsHandler {
  constructor(
    private logger: SentryLogger,
    private env: Env,
    private db: DatabaseService
  ) {}

  // Resolve a tagged-template SQL client from the injected DatabaseService.
  // WorkerDatabase exposes getSql(); fall back to .sql if present. Returns null
  // when no client is available so handlers can degrade gracefully (never 500).
  private getSqlClient(): ((strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>) | null {
    const anyDb = this.db as any;
    if (anyDb && typeof anyDb.getSql === 'function') {
      try { return anyDb.getSql(); } catch { /* fall through */ }
    }
    if (anyDb && typeof anyDb.sql === 'function') return anyDb.sql;
    return null;
  }

  // Bare-body JSON response. Several admin endpoints are consumed by the admin
  // frontend via handleResponse<T>() which returns response.json() verbatim, so
  // the body must BE the array/object the page expects — not a {success,...} wrapper.
  private bareJson(body: unknown, corsHeaders: Record<string, string>, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Best-effort audit trail. Admin actions write to audit_logs; never let an
  // audit failure break the action itself.
  private async writeAudit(
    sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>,
    userId: number,
    action: string,
    entityType: string,
    entityId: number,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await sql`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, event_category, description, created_at)
        VALUES (${userId}, ${action}, ${entityType}, ${entityId},
                ${JSON.stringify(details)}::jsonb, 'admin',
                ${`${action} on ${entityType} #${entityId}`}, NOW())
      `;
    } catch { /* audit is non-critical */ }
  }

  async handleRequest(request: Request, corsHeaders: Record<string, string>, userAuth?: AuthPayload): Promise<Response> {
    try {
      // Admin authentication required for all endpoints
      if (!userAuth) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Authentication required', code: 'AUTH_REQUIRED' } 
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Check admin permissions (demo: allow specific admin users)
      const isAdmin = this.checkAdminPermissions(userAuth);
      if (!isAdmin) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Admin access required', code: 'INSUFFICIENT_PERMISSIONS' } 
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const url = new URL(request.url);
      const pathSegments = url.pathname.split('/').filter(Boolean);
      
      // Remove 'api' and 'admin' from path segments
      const relevantPath = pathSegments.slice(2);
      const method = request.method;

      // Route to appropriate handler
      if (method === 'GET' && relevantPath[0] === 'dashboard') {
        return await this.handleAdminDashboard(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'stats') {
        return await this.handleSystemStats(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'users') {
        return await this.handleGetUsers(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'user' && relevantPath[1]) {
        return await this.handleGetUser(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'PUT' && relevantPath[0] === 'user' && relevantPath[1]) {
        return await this.handleUpdateUser(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'POST' && relevantPath[0] === 'user' && relevantPath[1] && relevantPath[2] === 'suspend') {
        return await this.handleSuspendUser(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'POST' && relevantPath[0] === 'user' && relevantPath[1] && relevantPath[2] === 'ban') {
        return await this.handleBanUser(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'POST' && relevantPath[0] === 'user' && relevantPath[1] && relevantPath[2] === 'verify') {
        return await this.handleVerifyUser(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'POST' && relevantPath[0] === 'user' && relevantPath[1] && relevantPath[2] === 'restore') {
        return await this.handleRestoreUser(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'GET' && relevantPath[0] === 'content') {
        return await this.handleGetContent(request, corsHeaders, userAuth);
      }
      
      if (method === 'DELETE' && relevantPath[0] === 'content' && relevantPath[1]) {
        return await this.handleRemoveContent(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'POST' && relevantPath[0] === 'content' && relevantPath[1] && relevantPath[2] === 'feature') {
        return await this.handleFeatureContent(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'POST' && relevantPath[0] === 'flags') {
        return await this.handleFlagContent(request, corsHeaders, userAuth);
      }

      if (method === 'GET' && relevantPath[0] === 'flags') {
        return await this.handleGetFlags(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'flag' && relevantPath[1]) {
        return await this.handleGetFlag(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'PUT' && relevantPath[0] === 'flag' && relevantPath[1] && relevantPath[2] === 'resolve') {
        return await this.handleResolveFlag(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'PUT' && relevantPath[0] === 'flag' && relevantPath[1] && relevantPath[2] === 'assign') {
        return await this.handleAssignFlag(request, corsHeaders, userAuth, parseInt(relevantPath[1]));
      }
      
      if (method === 'POST' && relevantPath[0] === 'bulk-action') {
        return await this.handleBulkAction(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'moderation-log') {
        return await this.handleModerationLog(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'analytics') {
        return await this.handleAdminAnalytics(request, corsHeaders, userAuth);
      }

      if (method === 'GET' && relevantPath[0] === 'liquidity') {
        return await this.handleLiquidityGate(request, corsHeaders, userAuth);
      }

      if (method === 'GET' && relevantPath[0] === 'transactions') {
        return await this.handleGetTransactions(request, corsHeaders, userAuth);
      }

      if (method === 'GET' && relevantPath[0] === 'reports') {
        return await this.handleGetReports(request, corsHeaders, userAuth);
      }
      
      if (method === 'POST' && relevantPath[0] === 'reports' && relevantPath[1] === 'generate') {
        return await this.handleGenerateReport(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'system' && relevantPath[1] === 'health') {
        return await this.handleSystemHealth(request, corsHeaders, userAuth);
      }
      
      if (method === 'POST' && relevantPath[0] === 'system' && relevantPath[1] === 'maintenance') {
        return await this.handleMaintenanceMode(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'settings') {
        return await this.handleGetSettings(request, corsHeaders, userAuth);
      }
      
      if (method === 'PUT' && relevantPath[0] === 'settings') {
        return await this.handleUpdateSettings(request, corsHeaders, userAuth);
      }
      
      if (method === 'GET' && relevantPath[0] === 'audit-log') {
        return await this.handleAuditLog(request, corsHeaders, userAuth);
      }
      
      if (method === 'POST' && relevantPath[0] === 'broadcast') {
        return await this.handleBroadcastMessage(request, corsHeaders, userAuth);
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Admin endpoint not found', code: 'ENDPOINT_NOT_FOUND' } 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Admin service error', code: 'ADMIN_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Check if user has admin permissions
  private checkAdminPermissions(userAuth: AuthPayload): boolean {
    // Primary check: real admin accounts carry user_type='admin' (consistent
    // with the rest of the app's RBAC). The hardcoded list below is a legacy
    // demo allowlist kept only for the seeded demo creator used in tests.
    if (userAuth.userType === 'admin') return true;
    const adminUsers = ['admin@pitchey.com', 'alex.creator@demo.com'];
    return adminUsers.includes(userAuth.email);
  }

  // Admin Dashboard — returns a bare flat DashboardStats object (the frontend
  // reads response.json() directly into its DashboardStats interface).
  private async handleAdminDashboard(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    const empty = {
      totalUsers: 0, totalPitches: 0, totalRevenue: 0, pendingNDAs: 0,
      activeUsers: 0, recentSignups: 0, approvedPitches: 0, rejectedPitches: 0
    };
    try {
      const sql = this.getSqlClient();
      if (!sql) return this.bareJson(empty, corsHeaders);

      const rows = await sql`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS total_users,
          (SELECT COUNT(*)::int FROM users WHERE is_active = true) AS active_users,
          (SELECT COUNT(*)::int FROM users WHERE created_at > NOW() - INTERVAL '7 days') AS recent_signups,
          (SELECT COUNT(*)::int FROM pitches) AS total_pitches,
          (SELECT COUNT(*)::int FROM pitches WHERE status IN ('published','active')) AS approved_pitches,
          (SELECT COUNT(*)::int FROM pitches WHERE status = 'draft') AS draft_pitches,
          (SELECT COUNT(*)::int FROM pitches WHERE moderation_status = 'rejected') AS rejected_pitches,
          (SELECT COUNT(*)::int FROM ndas WHERE status = 'pending') AS pending_ndas,
          (SELECT COALESCE(SUM(amount), 0)::float FROM payments WHERE status = 'completed') AS total_revenue
      `;
      const s = (rows && rows[0]) || {};
      return this.bareJson({
        totalUsers: s.total_users ?? 0,
        totalPitches: s.total_pitches ?? 0,
        totalRevenue: Number(s.total_revenue ?? 0),
        pendingNDAs: s.pending_ndas ?? 0,
        activeUsers: s.active_users ?? 0,
        recentSignups: s.recent_signups ?? 0,
        approvedPitches: s.approved_pitches ?? 0,
        rejectedPitches: s.rejected_pitches ?? 0
      }, corsHeaders);
    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson(empty, corsHeaders);
    }
  }

  // System Statistics
  private async handleSystemStats(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const timeframe = url.searchParams.get('timeframe') || '24h';

      const sql = this.getSqlClient();
      if (!sql) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      // Real counts. Each block is defensive so a missing table/column can't 500 the
      // dashboard; metrics with no reliable source are honest 0 rather than fabricated.
      const one = async (q: Promise<any[]>): Promise<Record<string, any>> => {
        try { const r = await q; return r?.[0] || {}; } catch { return {}; }
      };
      const u = await one(sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE last_active_at >= NOW() - INTERVAL '24 hours')::int AS active_24h,
               COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS new_today,
               COUNT(*) FILTER (WHERE is_verified = true)::int AS verified,
               COUNT(*) FILTER (WHERE account_locked_until > NOW())::int AS suspended,
               COUNT(*) FILTER (WHERE is_active = false)::int AS banned
        FROM users`);
      const p = await one(sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'published')::int AS published,
               COUNT(*) FILTER (WHERE status = 'draft')::int AS draft
        FROM pitches`);
      const inv = await one(sql`SELECT COUNT(*)::int AS cnt, COALESCE(SUM(amount), 0)::float AS volume FROM investments`);
      const nda = await one(sql`SELECT COUNT(*) FILTER (WHERE status IN ('signed','approved'))::int AS active FROM ndas`);
      // Real moderation queue + financial-health counts. Each block is its own
      // defensive query so a missing column in some env degrades that metric to 0
      // (honest) without zeroing the others or 500ing the dashboard. These were
      // previously hardcoded 0, which gave admins a false "all clear".
      const pmod = await one(sql`
        SELECT COUNT(*) FILTER (WHERE moderation_status = 'flagged')::int AS flagged,
               COUNT(*) FILTER (WHERE moderation_status = 'rejected')::int AS removed
        FROM pitches`);
      const cr = await one(sql`
        SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_flags,
               COUNT(*) FILTER (WHERE resolved_at >= date_trunc('day', NOW()))::int AS actions_today,
               COUNT(DISTINCT moderator_id) FILTER (WHERE resolved_at >= NOW() - INTERVAL '30 days')::int AS active_moderators,
               COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
                        FILTER (WHERE resolved_at IS NOT NULL), 0)::float AS avg_resolution_hours
        FROM content_reports`);
      const pay = await one(sql`SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending FROM payments`);

      const stats: SystemStats = {
        users: {
          total: u.total || 0,
          active_24h: u.active_24h || 0,
          new_today: u.new_today || 0,
          verified: u.verified || 0,
          suspended: u.suspended || 0,
          banned: u.banned || 0
        },
        content: {
          total_pitches: p.total || 0,
          published_pitches: p.published || 0,
          draft_pitches: p.draft || 0,
          flagged_content: pmod.flagged || 0,
          removed_content: pmod.removed || 0
        },
        moderation: {
          pending_flags: cr.pending_flags || 0,
          actions_today: cr.actions_today || 0,
          active_moderators: cr.active_moderators || 0,
          average_resolution_time: cr.avg_resolution_hours || 0
        },
        financial: {
          total_investments: inv.cnt || 0,
          total_volume: inv.volume || 0,
          active_ndas: nda.active || 0,
          pending_payments: pay.pending || 0
        }
      };

      return new Response(JSON.stringify({
        success: true,
        stats,
        timeframe
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get system stats', code: 'STATS_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Get Users with filters
  private async handleGetUsers(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const user_type = url.searchParams.get('user_type');
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson([], corsHeaders);

      const offset = (page - 1) * limit;
      const like = search ? `%${search}%` : null;

      const rows = await sql`
        SELECT
          u.id,
          u.email,
          COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            NULLIF(u.username, ''),
            NULLIF(u.company_name, ''),
            u.email
          ) AS name,
          u.user_type,
          u.is_active,
          u.account_locked_until,
          u.created_at,
          u.last_login_at,
          COALESCE(uc.balance, 0) AS credits,
          (SELECT COUNT(*)::int FROM pitches p WHERE p.user_id = u.id) AS pitch_count,
          (SELECT COUNT(*)::int FROM ndas n WHERE n.signer_id = u.id) AS investment_count
        FROM users u
        LEFT JOIN user_credits uc ON uc.user_id = u.id
        WHERE (${user_type}::text IS NULL OR u.user_type = ${user_type})
          AND (
            ${like}::text IS NULL
            OR LOWER(u.email) LIKE ${like}
            OR LOWER(COALESCE(u.username, '')) LIKE ${like}
            OR LOWER(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) LIKE ${like}
          )
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const mapStatus = (r: any): string => {
        if (r.is_active === false) return 'banned';
        if (r.account_locked_until && new Date(r.account_locked_until) > new Date()) return 'suspended';
        return 'active';
      };

      const users = (rows || [])
        .map((r: any) => ({
          id: String(r.id),
          email: r.email,
          name: r.name,
          userType: r.user_type,
          credits: Number(r.credits ?? 0),
          status: mapStatus(r),
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
          lastLogin: r.last_login_at ? new Date(r.last_login_at).toISOString() : null,
          pitchCount: Number(r.pitch_count ?? 0),
          investmentCount: Number(r.investment_count ?? 0)
        }))
        .filter((u: any) => !status || u.status === status);

      return this.bareJson(users, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson([], corsHeaders);
    }
  }

  // Get User Details
  private async handleGetUser(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, userId: number): Promise<Response> {
    try {
      // Real user detail (was hardcoded "alex.creator" demo data for every id).
      const sql = this.getSqlClient();
      if (!sql) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const urRows = await sql`SELECT * FROM users WHERE id = ${userId}`;
      if (!urRows || urRows.length === 0) {
        return new Response(JSON.stringify({ success: false, error: { message: 'User not found', code: 'USER_NOT_FOUND' } }), {
          status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const ur = urRows[0] as Record<string, any>;
      let pstat: Record<string, any> = {};
      try {
        const r = await sql`
          SELECT COUNT(*)::int AS total,
                 COUNT(*) FILTER (WHERE status = 'published')::int AS published,
                 COUNT(*) FILTER (WHERE status = 'draft')::int AS draft
          FROM pitches WHERE user_id = ${userId}`;
        pstat = r?.[0] || {};
      } catch { /* pitches table shape drift */ }
      const status = ur.is_active === false
        ? 'banned'
        : (ur.account_locked_until && new Date(ur.account_locked_until) > new Date() ? 'suspended' : 'active');
      const userDetail = {
        id: ur.id,
        username: ur.username ?? null,
        email: ur.email,
        user_type: ur.user_type,
        status,
        verified: ur.is_verified === true,
        created_at: ur.created_at,
        last_login: ur.last_active_at ?? null,
        profile: {
          first_name: ur.first_name ?? null,
          last_name: ur.last_name ?? null,
          bio: ur.bio ?? null,
          location: ur.location ?? null,
          website: ur.company_name ?? ur.website ?? null
        },
        stats: {
          total_pitches: pstat.total || 0,
          published_pitches: pstat.published || 0,
          draft_pitches: pstat.draft || 0,
          total_views: 0,
          total_likes: 0,
          followers: 0,
          following: 0
        },
        moderation: {
          flags_received: 0,
          warnings_issued: 0,
          suspensions: 0,
          last_warning: null,
          notes: []
        },
        recent_activity: []
      };

      return new Response(JSON.stringify({
        success: true,
        user: userDetail
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get user details', code: 'GET_USER_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Update User
  private async handleUpdateUser(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, userId: number): Promise<Response> {
    try {
      const body = await request.json() as {
        status?: 'active' | 'suspended' | 'banned';
        credits?: number;
        verified?: boolean;
        user_type?: string;
        admin_notes?: string;
      };

      const sql = this.getSqlClient();
      if (!sql) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Status → is_active / account lock
      if (body.status === 'banned') {
        await sql`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ${userId}`;
      } else if (body.status === 'suspended') {
        await sql`UPDATE users SET account_locked_until = NOW() + INTERVAL '30 days', updated_at = NOW() WHERE id = ${userId}`;
      } else if (body.status === 'active') {
        await sql`UPDATE users SET is_active = true, account_locked_until = NULL, updated_at = NOW() WHERE id = ${userId}`;
      }

      // Credits → user_credits balance (upsert)
      if (typeof body.credits === 'number' && Number.isFinite(body.credits)) {
        const credits = Math.max(0, Math.floor(body.credits));
        await sql`
          INSERT INTO user_credits (user_id, balance, last_updated)
          VALUES (${userId}, ${credits}, NOW())
          ON CONFLICT (user_id) DO UPDATE SET balance = ${credits}, last_updated = NOW()
        `;
      }

      await this.logger.captureMessage('Admin user update', 'info', {
          admin_id: userAuth.userId,
          target_user_id: userId,
          changes: body
      });

      return this.bareJson({ id: String(userId), ...body }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to update user', code: 'UPDATE_USER_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Suspend User
  private async handleSuspendUser(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, userId: number): Promise<Response> {
    try {
      const body = await request.json() as {
        reason: string;
        duration?: string;
        notify_user?: boolean;
      };

      if (!body.reason?.trim()) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Suspension reason is required', code: 'VALIDATION_ERROR' } 
        }), {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Persist the suspension (mirrors handleUpdateUser's 'suspended' path).
      const sql = this.getSqlClient();
      if (!sql) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      await sql`UPDATE users SET account_locked_until = NOW() + INTERVAL '30 days', account_lock_reason = ${body.reason}, updated_at = NOW() WHERE id = ${userId}`;

      // Persist a real moderation record and use its DB id — previously this was
      // a fabricated Math.random() value with no audit trail behind it.
      let actionId = 0;
      try {
        const auditRows = await sql`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, event_category, description, created_at)
          VALUES (${userAuth.userId}, 'suspension', 'user', ${userId},
                  ${JSON.stringify({ reason: body.reason, duration: body.duration || '7 days' })}::jsonb, 'admin',
                  ${`Suspended user #${userId}`}, NOW())
          RETURNING id`;
        actionId = auditRows?.[0]?.id ?? 0;
      } catch { /* audit is non-critical — never block the suspension on it */ }

      // Create moderation action
      const moderationAction: ModerationAction = {
        id: actionId,
        action_type: 'suspension',
        target_type: 'user',
        target_id: userId,
        moderator_id: userAuth.userId,
        moderator_name: userAuth.email,
        reason: body.reason,
        duration: body.duration || '7 days',
        created_at: new Date().toISOString(),
        expires_at: body.duration ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
        status: 'active'
      };

      await this.logger.captureMessage('User suspended', 'warning', {
          admin_id: userAuth.userId,
          suspended_user_id: userId,
          reason: body.reason,
          duration: body.duration
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'User suspended successfully',
        moderation_action: moderationAction
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to suspend user', code: 'SUSPEND_USER_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Ban User
  private async handleBanUser(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, userId: number): Promise<Response> {
    try {
      const body = await request.json() as {
        reason: string;
        permanent?: boolean;
        notify_user?: boolean;
      };

      if (!body.reason?.trim()) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Ban reason is required', code: 'VALIDATION_ERROR' } 
        }), {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Persist the ban (mirrors handleUpdateUser's 'banned' path → is_active=false).
      const sql = this.getSqlClient();
      if (!sql) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      await sql`UPDATE users SET is_active = false, account_lock_reason = ${body.reason}, updated_at = NOW() WHERE id = ${userId}`;

      await this.logger.captureMessage('User banned', 'error', {
          admin_id: userAuth.userId,
          banned_user_id: userId,
          reason: body.reason,
          permanent: body.permanent
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'User banned successfully',
        ban_details: {
          user_id: userId,
          reason: body.reason,
          permanent: body.permanent || false,
          banned_at: new Date().toISOString(),
          banned_by: userAuth.userId
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to ban user', code: 'BAN_USER_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Verify User
  private async handleVerifyUser(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, userId: number): Promise<Response> {
    try {
      const body = await request.json() as {
        verification_type?: 'identity' | 'business' | 'creator';
        notes?: string;
      };

      // Persist verification — sets the trust columns the badge logic reads.
      const sql = this.getSqlClient();
      if (!sql) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      await sql`UPDATE users SET is_verified = true, company_verified = true, verification_tier = 'gold', updated_at = NOW() WHERE id = ${userId}`;

      await this.logger.captureMessage('User verified', 'info', {
          admin_id: userAuth.userId,
          verified_user_id: userId,
          verification_type: body.verification_type || 'identity'
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'User verified successfully',
        verification: {
          user_id: userId,
          verified: true,
          verification_type: body.verification_type || 'identity',
          verified_at: new Date().toISOString(),
          verified_by: userAuth.userId
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to verify user', code: 'VERIFY_USER_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Restore User
  private async handleRestoreUser(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, userId: number): Promise<Response> {
    try {
      const body = await request.json() as {
        reason?: string;
        notify_user?: boolean;
      };

      // Persist restoration (mirrors handleUpdateUser's 'active' path).
      const sql = this.getSqlClient();
      if (!sql) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      await sql`UPDATE users SET is_active = true, account_locked_until = NULL, account_lock_reason = NULL, updated_at = NOW() WHERE id = ${userId}`;

      await this.logger.captureMessage('User restored', 'info', {
          admin_id: userAuth.userId,
          restored_user_id: userId,
          reason: body.reason
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'User restored successfully',
        restoration: {
          user_id: userId,
          status: 'active',
          restored_at: new Date().toISOString(),
          restored_by: userAuth.userId,
          reason: body.reason
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to restore user', code: 'RESTORE_USER_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Get Content for moderation
  private async handleGetContent(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const statusFilter = url.searchParams.get('status') || '';
      const genreFilter = url.searchParams.get('genre') || '';

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson([], corsHeaders);

      const rows = await sql`
        SELECT
          p.id,
          p.title,
          COALESCE(NULLIF(p.short_synopsis, ''), NULLIF(p.long_synopsis, ''), '') AS synopsis,
          COALESCE(p.genre, '') AS genre,
          COALESCE(NULLIF(p.estimated_budget, ''), p.budget_range, '') AS budget_raw,
          p.status,
          p.moderation_status,
          p.moderation_notes,
          p.created_at,
          p.user_id,
          u.email AS creator_email,
          COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            NULLIF(u.username, ''),
            NULLIF(u.company_name, ''),
            u.email
          ) AS creator_name,
          (
            SELECT COALESCE(array_agg(DISTINCT cr.reason), ARRAY[]::text[])
            FROM content_reports cr
            WHERE cr.content_type = 'pitch' AND cr.content_id = p.id AND cr.status <> 'resolved'
          ) AS flagged_reasons
        FROM pitches p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE (${genreFilter}::text = '' OR p.genre = ${genreFilter})
        ORDER BY p.created_at DESC
        LIMIT 200
      `;

      // Explicit moderation decisions win; otherwise fall back to the publish
      // lifecycle so un-reviewed pitches still bucket sensibly.
      const mapStatus = (moderation: string | null, s: string): string => {
        if (moderation === 'approved' || moderation === 'rejected' || moderation === 'flagged' || moderation === 'pending') {
          return moderation;
        }
        if (s === 'published' || s === 'active') return 'approved';
        return 'pending';
      };

      // Budgets are stored loosely as free text / ranges (e.g. "100k-500k", "$2,000,000").
      // Parse the first numeric token and scale a k/m suffix; 0 when unparseable.
      const parseBudget = (raw: unknown): number => {
        const m = String(raw ?? '').match(/([0-9][0-9.,]*)\s*([kKmM])?/);
        if (!m) return 0;
        let n = Number(m[1].replace(/,/g, '')) || 0;
        const suffix = (m[2] || '').toLowerCase();
        if (suffix === 'k') n *= 1_000;
        else if (suffix === 'm') n *= 1_000_000;
        return n;
      };

      const content = (rows || [])
        .map((r: any) => {
          const budget = parseBudget(r.budget_raw);
          return {
            id: String(r.id),
            title: r.title || 'Untitled',
            synopsis: r.synopsis || '',
            genre: r.genre || '',
            budget,
            creator: {
              id: String(r.user_id ?? ''),
              name: r.creator_name || r.creator_email || 'Unknown',
              email: r.creator_email || ''
            },
            status: mapStatus(r.moderation_status, r.status),
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
            moderationNotes: r.moderation_notes || undefined,
            flaggedReasons: Array.isArray(r.flagged_reasons) ? r.flagged_reasons : [],
            documents: []
          };
        })
        .filter((c: any) => !statusFilter || c.status === statusFilter);

      return this.bareJson(content, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson([], corsHeaders);
    }
  }

  // Reject content — DELETE /api/admin/content/:id. Sets moderation_status and
  // unpublishes the pitch (status → draft) so it leaves the public surface.
  private async handleRemoveContent(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, contentId: number): Promise<Response> {
    try {
      const body = await parseOptionalBody<{ reason?: string }>(request);
      const reason = (body.reason || '').trim();

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }, corsHeaders, 503);

      const rows = await sql`
        UPDATE pitches
           SET moderation_status = 'rejected',
               moderation_notes  = ${reason || null},
               moderated_by      = ${userAuth.userId},
               moderated_at      = NOW(),
               status            = 'draft'
         WHERE id = ${contentId}
        RETURNING id, title
      `;
      if (!rows || rows.length === 0) {
        return this.bareJson({ success: false, error: { message: 'Pitch not found', code: 'NOT_FOUND' } }, corsHeaders, 404);
      }

      // Resolve any open reports against this pitch.
      await sql`
        UPDATE content_reports
           SET status = 'resolved', moderator_id = ${userAuth.userId}, moderator_notes = ${reason || null}, resolved_at = NOW()
         WHERE content_type = 'pitch' AND content_id = ${contentId} AND status <> 'resolved'
      `;
      await this.writeAudit(sql, userAuth.userId, 'content.reject', 'pitch', contentId, { reason });

      return this.bareJson({ success: true, message: 'Pitch rejected and unpublished', id: String(contentId), status: 'rejected' }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson({ success: false, error: { message: 'Failed to reject content', code: 'REMOVE_CONTENT_ERROR' } }, corsHeaders, 500);
    }
  }

  // Approve content — POST /api/admin/content/:id/feature. Marks the pitch
  // approved, publishes it if still a draft, and clears any open reports.
  private async handleFeatureContent(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, contentId: number): Promise<Response> {
    try {
      const body = await parseOptionalBody<{ notes?: string }>(request);
      const notes = (body.notes || '').trim();

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }, corsHeaders, 503);

      const rows = await sql`
        UPDATE pitches
           SET moderation_status = 'approved',
               moderation_notes  = ${notes || null},
               moderated_by      = ${userAuth.userId},
               moderated_at      = NOW(),
               status            = CASE WHEN status = 'draft' THEN 'published' ELSE status END,
               published_at      = COALESCE(published_at, NOW())
         WHERE id = ${contentId}
        RETURNING id, title, status
      `;
      if (!rows || rows.length === 0) {
        return this.bareJson({ success: false, error: { message: 'Pitch not found', code: 'NOT_FOUND' } }, corsHeaders, 404);
      }

      await sql`
        UPDATE content_reports
           SET status = 'resolved', moderator_id = ${userAuth.userId}, moderator_notes = ${notes || null}, resolved_at = NOW()
         WHERE content_type = 'pitch' AND content_id = ${contentId} AND status <> 'resolved'
      `;
      await this.writeAudit(sql, userAuth.userId, 'content.approve', 'pitch', contentId, { notes });

      return this.bareJson({ success: true, message: 'Pitch approved', id: String(contentId), status: 'approved' }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson({ success: false, error: { message: 'Failed to approve content', code: 'FEATURE_CONTENT_ERROR' } }, corsHeaders, 500);
    }
  }

  // Flag content — POST /api/admin/flags. Marks the pitch flagged and opens a
  // row in content_reports (the moderation queue).
  private async handleFlagContent(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await parseOptionalBody<{
        contentId?: number | string;
        pitchId?: number | string;
        reasons?: string[];
        reason?: string;
        notes?: string;
      }>(request);
      const cid = parseInt(String(body.contentId ?? body.pitchId ?? ''), 10);
      if (!Number.isFinite(cid)) {
        return this.bareJson({ success: false, error: { message: 'contentId is required', code: 'VALIDATION_ERROR' } }, corsHeaders, 422);
      }
      const reasons = Array.isArray(body.reasons) ? body.reasons.filter(Boolean) : (body.reason ? [body.reason] : []);
      const reasonStr = reasons.join(', ') || 'flagged';
      const notes = (body.notes || '').trim();

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }, corsHeaders, 503);

      const upd = await sql`
        UPDATE pitches
           SET moderation_status = 'flagged',
               moderation_notes  = ${notes || null},
               moderated_by      = ${userAuth.userId},
               moderated_at      = NOW()
         WHERE id = ${cid}
        RETURNING id
      `;
      if (!upd || upd.length === 0) {
        return this.bareJson({ success: false, error: { message: 'Pitch not found', code: 'NOT_FOUND' } }, corsHeaders, 404);
      }

      const ins = await sql`
        INSERT INTO content_reports (reporter_id, content_type, content_id, reason, description, status, created_at)
        VALUES (${userAuth.userId}, 'pitch', ${cid}, ${reasonStr}, ${notes || null}, 'pending', NOW())
        RETURNING id
      `;
      await this.writeAudit(sql, userAuth.userId, 'content.flag', 'pitch', cid, { reasons, notes });

      return this.bareJson({ success: true, id: String(ins?.[0]?.id ?? ''), contentId: String(cid), status: 'flagged' }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson({ success: false, error: { message: 'Failed to flag content', code: 'FLAG_CONTENT_ERROR' } }, corsHeaders, 500);
    }
  }

  // Get Flags — reads the live content_reports moderation queue.
  private async handleGetFlags(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get('status') || '';

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson({ success: true, flags: [], stats: { pending: 0, reviewing: 0, resolved: 0 } }, corsHeaders);

      const rows = await sql`
        SELECT
          cr.id, cr.content_type, cr.content_id, cr.reason, cr.description,
          cr.status, cr.reporter_id, cr.moderator_id, cr.created_at, cr.resolved_at,
          COALESCE(p.title, '') AS content_title,
          COALESCE(NULLIF(u.username, ''), u.email, '') AS reporter_name
        FROM content_reports cr
        LEFT JOIN pitches p ON cr.content_type = 'pitch' AND p.id = cr.content_id
        LEFT JOIN users u ON u.id = cr.reporter_id
        WHERE (${status}::text = '' OR cr.status = ${status})
        ORDER BY cr.created_at DESC
        LIMIT 200
      `;

      const flags = (rows || []).map((r: any) => ({
        id: r.id,
        content_type: r.content_type,
        content_id: r.content_id,
        content_title: r.content_title || `#${r.content_id}`,
        flag_reason: r.reason || '',
        flag_notes: r.description || '',
        reporter_id: r.reporter_id,
        reporter_name: r.reporter_name || 'Unknown',
        status: r.status || 'pending',
        assigned_moderator: r.moderator_id ?? undefined,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
        resolved_at: r.resolved_at ? new Date(r.resolved_at).toISOString() : null
      }));

      const statsRows = await sql`
        SELECT status, COUNT(*)::int AS n FROM content_reports GROUP BY status
      `;
      const stats: Record<string, number> = { pending: 0, reviewing: 0, resolved: 0 };
      for (const s of statsRows || []) stats[s.status] = s.n;

      return this.bareJson({ success: true, flags, stats }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson({ success: false, error: { message: 'Failed to get flags', code: 'GET_FLAGS_ERROR' } }, corsHeaders, 500);
    }
  }

  // Get Flag Details — single content_reports row.
  private async handleGetFlag(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, flagId: number): Promise<Response> {
    try {
      const sql = this.getSqlClient();
      if (!sql) return this.bareJson({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }, corsHeaders, 503);

      const rows = await sql`
        SELECT
          cr.id, cr.content_type, cr.content_id, cr.reason, cr.description,
          cr.status, cr.reporter_id, cr.moderator_id, cr.moderator_notes,
          cr.created_at, cr.resolved_at,
          COALESCE(p.title, '') AS content_title,
          COALESCE(NULLIF(u.username, ''), u.email, '') AS reporter_name,
          u.email AS reporter_email
        FROM content_reports cr
        LEFT JOIN pitches p ON cr.content_type = 'pitch' AND p.id = cr.content_id
        LEFT JOIN users u ON u.id = cr.reporter_id
        WHERE cr.id = ${flagId}
      `;
      if (!rows || rows.length === 0) {
        return this.bareJson({ success: false, error: { message: 'Flag not found', code: 'NOT_FOUND' } }, corsHeaders, 404);
      }
      const r: any = rows[0];

      return this.bareJson({
        success: true,
        flag: {
          id: r.id,
          content_type: r.content_type,
          content_id: r.content_id,
          content_title: r.content_title || `#${r.content_id}`,
          flag_reason: r.reason || '',
          flag_notes: r.description || '',
          reporter_id: r.reporter_id,
          reporter_name: r.reporter_name || 'Unknown',
          reporter_email: r.reporter_email || '',
          status: r.status || 'pending',
          moderator_notes: r.moderator_notes || '',
          assigned_moderator: r.moderator_id ?? undefined,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
          resolved_at: r.resolved_at ? new Date(r.resolved_at).toISOString() : null
        }
      }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson({ success: false, error: { message: 'Failed to get flag details', code: 'GET_FLAG_ERROR' } }, corsHeaders, 500);
    }
  }

  // Resolve Flag — closes a content_reports row.
  private async handleResolveFlag(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, flagId: number): Promise<Response> {
    try {
      const body = await parseOptionalBody<{
        resolution?: string;
        resolution_notes?: string;
      }>(request);
      const notes = (body.resolution_notes || '').trim();

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }, corsHeaders, 503);

      const rows = await sql`
        UPDATE content_reports
           SET status = 'resolved', moderator_id = ${userAuth.userId}, moderator_notes = ${notes || null}, resolved_at = NOW()
         WHERE id = ${flagId}
        RETURNING id
      `;
      if (!rows || rows.length === 0) {
        return this.bareJson({ success: false, error: { message: 'Flag not found', code: 'NOT_FOUND' } }, corsHeaders, 404);
      }
      await this.writeAudit(sql, userAuth.userId, 'flag.resolve', 'content_report', flagId, { resolution: body.resolution, notes });

      return this.bareJson({ success: true, message: 'Flag resolved', id: String(flagId), status: 'resolved' }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson({ success: false, error: { message: 'Failed to resolve flag', code: 'RESOLVE_FLAG_ERROR' } }, corsHeaders, 500);
    }
  }

  // Assign Flag — assigns a moderator to a content_reports row.
  private async handleAssignFlag(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload, flagId: number): Promise<Response> {
    try {
      const body = await parseOptionalBody<{ assigned_to?: number }>(request);
      const assignee = Number(body.assigned_to);
      if (!Number.isFinite(assignee) || assignee <= 0) {
        return this.bareJson({ success: false, error: { message: 'Moderator assignment is required', code: 'VALIDATION_ERROR' } }, corsHeaders, 422);
      }

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }, corsHeaders, 503);

      const rows = await sql`
        UPDATE content_reports
           SET moderator_id = ${assignee}, status = CASE WHEN status = 'pending' THEN 'reviewing' ELSE status END
         WHERE id = ${flagId}
        RETURNING id
      `;
      if (!rows || rows.length === 0) {
        return this.bareJson({ success: false, error: { message: 'Flag not found', code: 'NOT_FOUND' } }, corsHeaders, 404);
      }
      await this.writeAudit(sql, userAuth.userId, 'flag.assign', 'content_report', flagId, { assigned_to: assignee });

      return this.bareJson({ success: true, message: 'Flag assigned', id: String(flagId), assigned_to: assignee }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson({ success: false, error: { message: 'Failed to assign flag', code: 'ASSIGN_FLAG_ERROR' } }, corsHeaders, 500);
    }
  }

  // Bulk Action
  private async handleBulkAction(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await request.json() as {
        action: 'suspend' | 'ban' | 'verify' | 'remove_content' | 'approve_content';
        target_type: 'user' | 'content' | 'flag';
        target_ids: number[];
        reason?: string;
        duration?: string;
      };

      if (!Array.isArray(body.target_ids) || body.target_ids.length === 0) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Target IDs are required', code: 'VALIDATION_ERROR' } 
        }), {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      if (body.target_ids.length > 100) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Maximum 100 items per bulk action', code: 'LIMIT_EXCEEDED' } 
        }), {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      await this.logger.captureMessage('Bulk action performed', 'warning', {
          admin_id: userAuth.userId,
          action: body.action,
          target_type: body.target_type,
          target_count: body.target_ids.length,
          reason: body.reason
      });

      const sql = this.getSqlClient();
      if (!sql) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Refunds can't be processed here — credit_transactions has no payment_intent
      // linkage to Stripe, so an automated refund is impossible. Be honest instead of
      // faking success (the admin Transactions page calls this for refunds).
      if ((body.action as string) === 'refund') {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'Automated refunds are not available — issue the refund from the Stripe dashboard.', code: 'NOT_IMPLEMENTED' }
        }), {
          status: 501,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // Apply real writes for supported user actions; report anything else as failed
      // rather than fabricating success.
      const results: Array<{ id: number; status: string; message?: string }> = [];
      for (const id of body.target_ids) {
        try {
          if (body.target_type === 'user' && body.action === 'suspend') {
            await sql`UPDATE users SET account_locked_until = NOW() + INTERVAL '30 days', account_lock_reason = ${body.reason || 'Bulk suspension'}, updated_at = NOW() WHERE id = ${id}`;
            results.push({ id, status: 'success' });
          } else if (body.target_type === 'user' && body.action === 'ban') {
            await sql`UPDATE users SET is_active = false, account_lock_reason = ${body.reason || 'Bulk ban'}, updated_at = NOW() WHERE id = ${id}`;
            results.push({ id, status: 'success' });
          } else if (body.target_type === 'user' && body.action === 'verify') {
            await sql`UPDATE users SET is_verified = true, company_verified = true, verification_tier = 'gold', updated_at = NOW() WHERE id = ${id}`;
            results.push({ id, status: 'success' });
          } else {
            results.push({ id, status: 'error', message: `Action '${body.action}' on '${body.target_type}' is not supported` });
          }
        } catch (_e) {
          results.push({ id, status: 'error', message: 'Write failed' });
        }
      }

      const successful = results.filter(r => r.status === 'success').length;
      return new Response(JSON.stringify({
        success: successful > 0,
        message: `Bulk ${body.action}: ${successful}/${body.target_ids.length} applied`,
        results,
        summary: {
          total: body.target_ids.length,
          successful,
          failed: results.length - successful
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to perform bulk action', code: 'BULK_ACTION_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Moderation Log
  private async handleModerationLog(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson([], corsHeaders);

      // Recent-activity feed assembled from real events. Both the dashboard
      // (getRecentActivity) and the Moderation Log page consume this defensively.
      const rows = await sql`
        (SELECT
            'user-' || u.id AS id,
            'user_signup' AS type,
            'New ' || COALESCE(u.user_type, 'user') || ' account: ' ||
              COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), NULLIF(u.username, ''), u.email) AS description,
            u.created_at AS ts,
            u.email AS "user"
          FROM users u ORDER BY u.created_at DESC LIMIT ${limit})
        UNION ALL
        (SELECT
            'pitch-' || p.id,
            'pitch_created',
            'New pitch: ' || COALESCE(p.title, 'Untitled'),
            p.created_at,
            (SELECT email FROM users WHERE id = p.user_id)
          FROM pitches p ORDER BY p.created_at DESC LIMIT ${limit})
        UNION ALL
        (SELECT
            'nda-' || n.id,
            'nda_signed',
            'NDA ' || COALESCE(n.status, 'updated'),
            COALESCE(n.signed_at, n.created_at),
            (SELECT email FROM users WHERE id = n.signer_id)
          FROM ndas n ORDER BY COALESCE(n.signed_at, n.created_at) DESC LIMIT ${limit})
        ORDER BY ts DESC NULLS LAST
        LIMIT ${limit}
      `;

      const activity = (rows || []).map((r: any) => ({
        id: String(r.id),
        type: r.type,
        description: r.description,
        timestamp: r.ts ? new Date(r.ts).toISOString() : new Date().toISOString(),
        user: r.user || undefined
      }));

      return this.bareJson(activity, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson([], corsHeaders);
    }
  }

  // Admin Analytics
  // Real analytics over the live DB. Returns the camelCase shape AdminAnalytics.tsx
  // reads directly (userGrowth / contentMetrics / financialMetrics / topGenres /
  // engagementMetrics). Each metric degrades to 0 rather than failing the page.
  private async handleAdminAnalytics(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || url.searchParams.get('timeframe') || '30d';
    const days = period === '24h' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : 30;

    // growthRate as a whole-number percentage change vs the preceding window.
    const growth = (cur: number, prev: number): number => {
      if (!prev) return cur > 0 ? 100 : 0;
      return Math.round(((cur - prev) / prev) * 100);
    };

    const empty = {
      userGrowth: { newUsers: 0, growthRate: 0, creators: 0, investors: 0, production: 0 },
      contentMetrics: { newPitches: 0, growthRate: 0 },
      financialMetrics: { revenue: 0, revenueGrowthRate: 0, totalTransactions: 0, avgTransaction: 0 },
      topGenres: [] as { name: string; count: number }[],
      engagementMetrics: { activeUsers: 0, activityGrowthRate: 0 }
    };

    try {
      const sql = this.getSqlClient();
      if (!sql) return this.bareJson(empty, corsHeaders);

      const [agg] = await sql`
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - ${days} * INTERVAL '1 day') AS new_users,
          (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - ${days * 2} * INTERVAL '1 day' AND created_at < NOW() - ${days} * INTERVAL '1 day') AS prev_new_users,
          (SELECT COUNT(*)::int FROM users WHERE user_type = 'creator') AS creators,
          (SELECT COUNT(*)::int FROM users WHERE user_type = 'investor') AS investors,
          (SELECT COUNT(*)::int FROM users WHERE user_type = 'production') AS production,
          (SELECT COUNT(*)::int FROM pitches WHERE created_at >= NOW() - ${days} * INTERVAL '1 day') AS new_pitches,
          (SELECT COUNT(*)::int FROM pitches WHERE created_at >= NOW() - ${days * 2} * INTERVAL '1 day' AND created_at < NOW() - ${days} * INTERVAL '1 day') AS prev_new_pitches,
          (SELECT COALESCE(SUM(amount), 0)::float FROM payments WHERE status = 'completed' AND created_at >= NOW() - ${days} * INTERVAL '1 day') AS revenue,
          (SELECT COALESCE(SUM(amount), 0)::float FROM payments WHERE status = 'completed' AND created_at >= NOW() - ${days * 2} * INTERVAL '1 day' AND created_at < NOW() - ${days} * INTERVAL '1 day') AS prev_revenue,
          (SELECT COUNT(*)::int FROM payments WHERE status = 'completed' AND created_at >= NOW() - ${days} * INTERVAL '1 day') AS txns,
          (SELECT COUNT(*)::int FROM users WHERE last_login_at >= NOW() - ${days} * INTERVAL '1 day') AS active_users,
          (SELECT COUNT(*)::int FROM users WHERE last_login_at >= NOW() - ${days * 2} * INTERVAL '1 day' AND last_login_at < NOW() - ${days} * INTERVAL '1 day') AS prev_active_users
      `;

      const genreRows = await sql`
        SELECT genre AS name, COUNT(*)::int AS count
        FROM pitches
        WHERE genre IS NOT NULL AND genre <> ''
        GROUP BY genre
        ORDER BY count DESC
        LIMIT 6
      `;

      const a: any = agg || {};
      const revenue = Number(a.revenue || 0);
      const txns = Number(a.txns || 0);

      return this.bareJson({
        userGrowth: {
          newUsers: Number(a.new_users || 0),
          growthRate: growth(Number(a.new_users || 0), Number(a.prev_new_users || 0)),
          creators: Number(a.creators || 0),
          investors: Number(a.investors || 0),
          production: Number(a.production || 0)
        },
        contentMetrics: {
          newPitches: Number(a.new_pitches || 0),
          growthRate: growth(Number(a.new_pitches || 0), Number(a.prev_new_pitches || 0))
        },
        financialMetrics: {
          revenue,
          revenueGrowthRate: growth(revenue, Number(a.prev_revenue || 0)),
          totalTransactions: txns,
          avgTransaction: txns > 0 ? revenue / txns : 0
        },
        topGenres: (genreRows || []).map((g: any) => ({ name: g.name, count: Number(g.count || 0) })),
        engagementMetrics: {
          activeUsers: Number(a.active_users || 0),
          activityGrowthRate: growth(Number(a.active_users || 0), Number(a.prev_active_users || 0))
        }
      }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson(empty, corsHeaders);
    }
  }

  // Liquidity Gate — the pre-build trigger for the deal-servicing roadmap (R2.3).
  // Reads four signals off LIVE tables (ndas, users, production_deals mig-114
  // outcome columns) — zero new schema. The thresholds are DRAFT (advisory, to be
  // tuned with Karl); the `gate.open` verdict is a recommendation, NOT a decision.
  // See docs/deal-servicing-roadmap-2026-06-27.md §5. The sharpest signal is the
  // off-platform-close rate: high = on-platform servicing would capture real leakage.
  private async handleLiquidityGate(_request: Request, corsHeaders: Record<string, string>, _userAuth: AuthPayload): Promise<Response> {
    // DRAFT thresholds — surfaced in the payload so the UI can label them as such.
    const THRESHOLDS = {
      buyersPerWeek: 5,        // ≥ N verified buyers signing NDAs / week
      dealsPerMonth: 3,        // ≥ M deals reaching a terminal outcome / month
      offPlatformRate: 0.25,   // ≥ X off-platform-close share = meaningful leakage to capture
      mutualConfirmRate: 0.5,  // ≥ X both-sides-confirm = parties actually report back (P2 working)
    };

    const empty = {
      buyersSigningNdas: { currentWeek: 0, weeks: [] as { week: string; count: number }[], trendNonDecreasing: false, threshold: THRESHOLDS.buyersPerWeek, pass: false },
      dealsReachingOutcome: { currentMonth: 0, months: [] as { month: string; count: number }[], threshold: THRESHOLDS.dealsPerMonth, pass: false },
      offPlatformCloseRate: { rate: 0, offPlatform: 0, totalCloses: 0, meaningfulLeakage: false, threshold: THRESHOLDS.offPlatformRate },
      mutualConfirmRate: { rate: 0, confirmed: 0, withOutcome: 0, threshold: THRESHOLDS.mutualConfirmRate, pass: false },
      gate: { open: false, thresholdsAreDraft: true },
      // R12: never show misleading zeros for the graph section on a total failure —
      // degraded:true is distinguishable from a genuinely empty graph.
      graphDensity: { degraded: true },
    };

    try {
      const sql = this.getSqlClient();
      if (!sql) return this.bareJson(empty, corsHeaders);

      // Signal 1 — distinct buyer-type (investor/production) NDA signers per ISO week, last 8 weeks.
      const weekRows = await sql`
        SELECT to_char(date_trunc('week', n.signed_at), 'YYYY-MM-DD') AS week,
               COUNT(DISTINCT n.signer_id)::int AS count
        FROM ndas n
        JOIN users u ON u.id = n.signer_id
        WHERE n.signed_at IS NOT NULL
          AND n.signed_at >= date_trunc('week', NOW()) - INTERVAL '7 weeks'
          AND u.user_type IN ('investor', 'production')
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      // Signal 2 — deals reaching a terminal outcome per month, last 6 months.
      const monthRows = await sql`
        SELECT to_char(date_trunc('month', COALESCE(outcome_reported_at, closed_at)), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
        FROM production_deals
        WHERE outcome IS NOT NULL
          AND COALESCE(outcome_reported_at, closed_at) >= date_trunc('month', NOW()) - INTERVAL '5 months'
        GROUP BY 1
        ORDER BY 1 ASC
      `;

      // Signals 3 & 4 — close mix + mutual-confirm, all-time over deals with an outcome.
      const [agg] = await sql`
        SELECT
          COUNT(*) FILTER (WHERE outcome = 'closed_off_platform')::int AS off_platform,
          COUNT(*) FILTER (WHERE outcome IN ('closed_on_platform', 'closed_off_platform'))::int AS total_closes,
          COUNT(*) FILTER (WHERE outcome IS NOT NULL)::int AS with_outcome,
          COUNT(*) FILTER (WHERE outcome IS NOT NULL AND outcome_confirmed_by_creator AND outcome_confirmed_by_production)::int AS mutually_confirmed
        FROM production_deals
      `;

      const weeks = (weekRows || []).map((r: any) => ({ week: String(r.week), count: Number(r.count || 0) }));
      const months = (monthRows || []).map((r: any) => ({ month: String(r.month), count: Number(r.count || 0) }));

      // Current-week / current-month figures (0 if no row for the bucket).
      const currentWeekKey = weeks.length ? weeks[weeks.length - 1].week : '';
      const currentWeek = weeks.find(w => w.week === currentWeekKey)?.count ?? 0;
      const currentMonth = months.length ? months[months.length - 1].count : 0;

      // Trend: non-decreasing across the observed weekly buckets (need ≥2 to judge).
      const trendNonDecreasing = weeks.length >= 2 && weeks.every((w, i) => i === 0 || w.count >= weeks[i - 1].count);

      const a: any = agg || {};
      const offPlatform = Number(a.off_platform || 0);
      const totalCloses = Number(a.total_closes || 0);
      const withOutcome = Number(a.with_outcome || 0);
      const mutuallyConfirmed = Number(a.mutually_confirmed || 0);
      const offRate = totalCloses > 0 ? offPlatform / totalCloses : 0;
      const confirmRate = withOutcome > 0 ? mutuallyConfirmed / withOutcome : 0;

      const s1Pass = currentWeek >= THRESHOLDS.buyersPerWeek && trendNonDecreasing;
      const s2Pass = currentMonth >= THRESHOLDS.dealsPerMonth;
      const s3Leak = offRate >= THRESHOLDS.offPlatformRate;
      const s4Pass = confirmRate >= THRESHOLDS.mutualConfirmRate;

      // R12: cross-role NDA-intent graph density (the moat asset). Self-contained
      // error handling — surfaces degraded:true rather than dragging down the gate.
      const graphDensity = await this.computeGraphDensity(sql);

      return this.bareJson({
        buyersSigningNdas: { currentWeek, weeks, trendNonDecreasing, threshold: THRESHOLDS.buyersPerWeek, pass: s1Pass },
        dealsReachingOutcome: { currentMonth, months, threshold: THRESHOLDS.dealsPerMonth, pass: s2Pass },
        offPlatformCloseRate: { rate: offRate, offPlatform, totalCloses, meaningfulLeakage: s3Leak, threshold: THRESHOLDS.offPlatformRate },
        mutualConfirmRate: { rate: confirmRate, confirmed: mutuallyConfirmed, withOutcome, threshold: THRESHOLDS.mutualConfirmRate, pass: s4Pass },
        // Advisory verdict: liquidity is real AND deals close AND the leak is worth
        // capturing AND both sides report back. All four together = start P5.0.
        gate: { open: s1Pass && s2Pass && s3Leak && s4Pass, thresholdsAreDraft: true },
        graphDensity,
      }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson(empty, corsHeaders);
    }
  }

  // R12: cross-role NDA-intent graph density — the moat thesis is this graph over
  // time + liquidity, but nothing measured it. Read-only over EXISTING tables
  // (ndas/users/production_deals/investor_thesis/collaborations); zero new schema.
  // 'signed' = the honored edge (matches the gold-reputation Path-A definition).
  // Self-contained try/catch: a DB failure (e.g. Neon 402) surfaces degraded:true,
  // never all-zeros that would read as "no graph".
  private async computeGraphDensity(
    sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>,
  ): Promise<any> {
    try {
      // Per-pitch roll-up: NDA count + which buyer roles signed → density + the
      // headline cross-role (both investor AND production signer) count.
      const [d] = await sql`
        WITH pitch_roles AS (
          SELECT n.pitch_id,
            COUNT(*) AS nda_count,
            BOOL_OR(u.user_type = 'investor') AS has_investor,
            BOOL_OR(u.user_type = 'production') AS has_production
          FROM ndas n
          JOIN users u ON u.id = n.signer_id
          WHERE n.status = 'signed'
          GROUP BY n.pitch_id
        )
        SELECT
          COALESCE(SUM(nda_count), 0)::int AS total_signed,
          COUNT(*)::int AS pitches_with_nda,
          COUNT(*) FILTER (WHERE has_investor AND has_production)::int AS both_sides,
          COUNT(*) FILTER (WHERE has_investor AND NOT has_production)::int AS investor_only,
          COUNT(*) FILTER (WHERE has_production AND NOT has_investor)::int AS production_only,
          COUNT(*) FILTER (WHERE nda_count = 1)::int AS bucket_1,
          COUNT(*) FILTER (WHERE nda_count BETWEEN 2 AND 3)::int AS bucket_2_3,
          COUNT(*) FILTER (WHERE nda_count >= 4)::int AS bucket_4plus
        FROM pitch_roles
      `;

      // Intent → deal conversion via the real pitch_id linkage on production_deals.
      const [c] = await sql`
        SELECT
          (SELECT COUNT(DISTINCT pitch_id) FROM ndas WHERE status = 'signed')::int AS nda_engaged_pitches,
          (SELECT COUNT(DISTINCT pd.pitch_id) FROM production_deals pd
             WHERE pd.pitch_id IN (SELECT pitch_id FROM ndas WHERE status = 'signed'))::int AS converted_pitches
      `;

      // Supply / intent leading indicators.
      const [s] = await sql`
        SELECT
          (SELECT COUNT(*) FROM investor_thesis)::int AS investors_with_thesis,
          (SELECT COUNT(*) FROM investor_thesis WHERE is_public)::int AS public_theses,
          (SELECT COUNT(*) FROM collaborations)::int AS collaborations_total,
          (SELECT COUNT(*) FROM collaborations WHERE created_at >= NOW() - INTERVAL '30 days')::int AS collaborations_30d
      `;

      const dd: any = d || {}, cc: any = c || {}, ss: any = s || {};
      const totalSigned = Number(dd.total_signed || 0);
      const pitchesWithNda = Number(dd.pitches_with_nda || 0);
      const ndaEngaged = Number(cc.nda_engaged_pitches || 0);
      const converted = Number(cc.converted_pitches || 0);

      return {
        degraded: false,
        ndaDensity: {
          totalSigned,
          pitchesWithNda,
          meanPerEngagedPitch: pitchesWithNda > 0 ? totalSigned / pitchesWithNda : 0,
          distribution: {
            one: Number(dd.bucket_1 || 0),
            twoToThree: Number(dd.bucket_2_3 || 0),
            fourPlus: Number(dd.bucket_4plus || 0),
          },
        },
        crossRole: {
          bothSides: Number(dd.both_sides || 0), // headline — the defensible asset
          investorOnly: Number(dd.investor_only || 0),
          productionOnly: Number(dd.production_only || 0),
        },
        intentToDeal: {
          ndaEngagedPitches: ndaEngaged,
          convertedPitches: converted,
          conversionRate: ndaEngaged > 0 ? converted / ndaEngaged : 0,
          linkage: 'pitch_id',
        },
        supplySignals: {
          investorsWithThesis: Number(ss.investors_with_thesis || 0),
          publicTheses: Number(ss.public_theses || 0),
          collaborationsTotal: Number(ss.collaborations_total || 0),
          collaborationsLast30d: Number(ss.collaborations_30d || 0),
        },
      };
    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return { degraded: true };
    }
  }

  // Get Reports
  // Transactions — bare Transaction[] sourced from the payments table.
  private async handleGetTransactions(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const typeFilter = url.searchParams.get('type') || '';
      const statusFilter = url.searchParams.get('status') || '';

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson([], corsHeaders);

      const rows = await sql`
        SELECT
          pm.id,
          pm.type,
          pm.amount,
          COALESCE(pm.currency, 'USD') AS currency,
          pm.status,
          pm.description,
          pm.stripe_payment_intent_id,
          pm.created_at,
          pm.completed_at,
          pm.user_id,
          u.email AS user_email,
          u.user_type,
          COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
            NULLIF(u.username, ''),
            NULLIF(u.company_name, ''),
            u.email
          ) AS user_name
        FROM payments pm
        LEFT JOIN users u ON u.id = pm.user_id
        ORDER BY pm.created_at DESC
        LIMIT 200
      `;

      // payments.type → frontend Transaction.type enum
      const mapType = (t: string): string => {
        switch (t) {
          case 'credits': return 'credit_purchase';
          case 'success_fee': return 'commission';
          case 'subscription': return 'subscription';
          case 'refund': return 'refund';
          default: return 'payment';
        }
      };

      const txns = (rows || [])
        .map((r: any) => ({
          id: String(r.id),
          type: mapType(r.type),
          amount: Number(r.amount ?? 0),
          currency: (r.currency || 'USD').toUpperCase(),
          status: r.status || 'pending',
          user: {
            id: String(r.user_id ?? ''),
            name: r.user_name || r.user_email || 'Unknown',
            email: r.user_email || '',
            userType: r.user_type || ''
          },
          description: r.description || '',
          stripeTransactionId: r.stripe_payment_intent_id || undefined,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          updatedAt: (r.completed_at || r.created_at) ? new Date(r.completed_at || r.created_at).toISOString() : new Date().toISOString(),
          refundableAmount: r.status === 'completed' && r.type !== 'refund' ? Number(r.amount ?? 0) : 0
        }))
        .filter((t: any) => (!typeFilter || t.type === typeFilter) && (!statusFilter || t.status === statusFilter));

      return this.bareJson(txns, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson([], corsHeaders);
    }
  }

  private async handleGetReports(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    // Reports are generated on demand (see handleGenerateReport → CSV download);
    // there is no stored-report registry, so the list is empty by design.
    return this.bareJson({ success: true, reports: [] }, corsHeaders);
  }

  // Render a row matrix as CSV (RFC-4180 quoting).
  private toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
    const esc = (v: string | number | null | undefined): string => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.map(esc).join(',')];
    for (const r of rows) lines.push(r.map(esc).join(','));
    return lines.join('\r\n');
  }

  // Generate Report — POST /api/admin/reports/generate. Returns a real CSV blob
  // built from live data for the requested type. Frontend sends {type, filters}.
  private async handleGenerateReport(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await parseOptionalBody<{
        type?: string;
        report_type?: string;
        filters?: { dateFrom?: string; dateTo?: string };
      }>(request);
      const type = body.type || body.report_type || 'users';
      const from = body.filters?.dateFrom || null;
      const to = body.filters?.dateTo || null;

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }, corsHeaders, 503);

      let headers: string[] = [];
      let rows: (string | number | null)[][] = [];

      if (type === 'users') {
        const r = await sql`
          SELECT id, email, COALESCE(username, '') AS username, COALESCE(user_type, '') AS user_type,
                 COALESCE(is_active, true) AS is_active, created_at, last_login_at
          FROM users
          WHERE (${from}::timestamptz IS NULL OR created_at >= ${from}::timestamptz)
            AND (${to}::timestamptz IS NULL OR created_at <= ${to}::timestamptz)
          ORDER BY created_at DESC LIMIT 5000
        `;
        headers = ['id', 'email', 'username', 'user_type', 'is_active', 'created_at', 'last_login_at'];
        rows = (r || []).map((x: any) => [x.id, x.email, x.username, x.user_type, x.is_active, x.created_at?.toISOString?.() ?? x.created_at, x.last_login_at?.toISOString?.() ?? x.last_login_at]);
      } else if (type === 'transactions') {
        const r = await sql`
          SELECT pm.id, pm.type, pm.amount, COALESCE(pm.currency, 'USD') AS currency, pm.status,
                 pm.created_at, u.email AS user_email
          FROM payments pm LEFT JOIN users u ON u.id = pm.user_id
          WHERE (${from}::timestamptz IS NULL OR pm.created_at >= ${from}::timestamptz)
            AND (${to}::timestamptz IS NULL OR pm.created_at <= ${to}::timestamptz)
          ORDER BY pm.created_at DESC LIMIT 5000
        `;
        headers = ['id', 'type', 'amount', 'currency', 'status', 'created_at', 'user_email'];
        rows = (r || []).map((x: any) => [x.id, x.type, x.amount, x.currency, x.status, x.created_at?.toISOString?.() ?? x.created_at, x.user_email]);
      } else if (type === 'content') {
        const r = await sql`
          SELECT p.id, p.title, COALESCE(p.genre, '') AS genre, p.status,
                 COALESCE(p.moderation_status, '') AS moderation_status,
                 p.created_at, u.email AS creator_email
          FROM pitches p LEFT JOIN users u ON u.id = p.user_id
          WHERE (${from}::timestamptz IS NULL OR p.created_at >= ${from}::timestamptz)
            AND (${to}::timestamptz IS NULL OR p.created_at <= ${to}::timestamptz)
          ORDER BY p.created_at DESC LIMIT 5000
        `;
        headers = ['id', 'title', 'genre', 'status', 'moderation_status', 'created_at', 'creator_email'];
        rows = (r || []).map((x: any) => [x.id, x.title, x.genre, x.status, x.moderation_status, x.created_at?.toISOString?.() ?? x.created_at, x.creator_email]);
      } else { // revenue — daily totals of completed payments
        const r = await sql`
          SELECT DATE(created_at) AS day, COUNT(*)::int AS transactions, COALESCE(SUM(amount), 0)::float AS revenue
          FROM payments
          WHERE status = 'completed'
            AND (${from}::timestamptz IS NULL OR created_at >= ${from}::timestamptz)
            AND (${to}::timestamptz IS NULL OR created_at <= ${to}::timestamptz)
          GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 5000
        `;
        headers = ['day', 'transactions', 'revenue'];
        rows = (r || []).map((x: any) => [x.day?.toISOString?.()?.slice(0, 10) ?? x.day, x.transactions, x.revenue]);
      }

      const csv = this.toCsv(headers, rows);
      const filename = `${type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          ...corsHeaders
        }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson({ success: false, error: { message: 'Failed to generate report', code: 'GENERATE_REPORT_ERROR' } }, corsHeaders, 500);
    }
  }

  // System Health
  // Real service health — pings DB, Redis, Stripe, Resend and returns the
  // {status,timestamp,services:{...}} shape AdminSystemHealth.tsx reads.
  private async handleSystemHealth(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    const timestamp = new Date().toISOString();

    // Bound each probe so one slow dependency can't hang the page.
    const timed = async (fn: () => Promise<void>): Promise<{ status: string; responseTime: number; message?: string }> => {
      const start = Date.now();
      try {
        await Promise.race([
          fn(),
          new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
        return { status: 'healthy', responseTime: Date.now() - start };
      } catch (e) {
        return { status: 'unhealthy', responseTime: Date.now() - start, message: e instanceof Error ? e.message : String(e) };
      }
    };

    const checkDb = async () => {
      const sql = this.getSqlClient();
      if (!sql) throw new Error('No DB client');
      await sql`SELECT 1`;
    };
    const checkRedis = async () => {
      if (!this.env.UPSTASH_REDIS_REST_URL) throw new Error('Not configured');
      const r = await fetch(`${this.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${this.env.UPSTASH_REDIS_REST_TOKEN}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    };
    const checkStripe = async () => {
      if (!this.env.STRIPE_SECRET_KEY) throw new Error('Not configured');
      const r = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${this.env.STRIPE_SECRET_KEY}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    };
    const checkResend = async () => {
      if (!this.env.RESEND_API_KEY) throw new Error('Not configured');
      const r = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}` }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    };

    try {
      const [database, redis, stripe, resend] = await Promise.all([
        timed(checkDb), timed(checkRedis), timed(checkStripe), timed(checkResend)
      ]);
      const services = { database, redis, stripe, resend };
      const statuses = Object.values(services).map(s => s.status);
      const status = statuses.every(s => s === 'healthy') ? 'healthy'
        : statuses.every(s => s === 'unhealthy') ? 'unhealthy' : 'degraded';

      return this.bareJson({ status, timestamp, services }, corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson({ status: 'unknown', timestamp, services: {} }, corsHeaders);
    }
  }

  // Maintenance Mode
  private async handleMaintenanceMode(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await request.json() as {
        enabled: boolean;
        message?: string;
        scheduled_end?: string;
      };

      await this.logger.captureMessage('Maintenance mode changed', 'warning', {
          admin_id: userAuth.userId,
          enabled: body.enabled,
          message: body.message
      });

      // This endpoint never persisted anything (no maintenance-flag table). Maintenance
      // is actually toggled through PUT /api/admin/settings (the `maintenance` block).
      // Return an honest 501 instead of faking success.
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Use PUT /api/admin/settings to toggle maintenance — this endpoint is not implemented.', code: 'NOT_IMPLEMENTED' }
      }), {
        status: 501,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to set maintenance mode', code: 'MAINTENANCE_ERROR' }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Get Settings
  // Well-formed defaults in the exact nested shape the SystemSettings page renders.
  private defaultSettings(): Record<string, any> {
    return {
      maintenance: { enabled: false, message: '', scheduledStart: undefined, scheduledEnd: undefined },
      features: {
        userRegistration: true, pitchSubmission: true, payments: true,
        messaging: true, ndaWorkflow: true, realTimeUpdates: true
      },
      limits: { maxPitchesPerUser: 50, maxFileUploadSize: 50, maxDocumentsPerPitch: 10, sessionTimeout: 43200 },
      pricing: {
        creditPrices: { single: 4.99, pack5: 19.99, pack10: 34.99, pack25: 74.99 },
        subscriptionPlans: {
          basic: { monthly: 19.99, yearly: 199.99 },
          premium: { monthly: 29.99, yearly: 299.99 },
          enterprise: { monthly: 39.99, yearly: 399.99 }
        }
      },
      notifications: { emailEnabled: true, smsEnabled: false, pushEnabled: true, weeklyDigest: true },
      security: { enforceStrongPasswords: true, twoFactorRequired: false, sessionSecurity: 'normal', apiRateLimit: 100 }
    };
  }

  // Deep-merge stored overrides onto defaults so a partial save never drops sections.
  private mergeSettings(base: any, over: any): any {
    if (!over || typeof over !== 'object' || Array.isArray(over)) return over ?? base;
    const out: Record<string, any> = Array.isArray(base) ? [] : { ...base };
    for (const k of Object.keys(over)) {
      out[k] = (base && typeof base[k] === 'object' && !Array.isArray(base[k]))
        ? this.mergeSettings(base[k], over[k])
        : over[k];
    }
    return out;
  }

  private async handleGetSettings(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    const defaults = this.defaultSettings();
    try {
      const sql = this.getSqlClient();
      if (!sql) return this.bareJson(defaults, corsHeaders);
      const rows = await sql`SELECT settings FROM platform_settings WHERE id = 1`;
      const stored = rows?.[0]?.settings;
      return this.bareJson(stored ? this.mergeSettings(defaults, stored) : defaults, corsHeaders);
    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson(defaults, corsHeaders);
    }
  }

  // Update Settings — persists the full SystemSettings object the page PUTs.
  private async handleUpdateSettings(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const incoming = await parseOptionalBody<Record<string, any>>(request);

      const sql = this.getSqlClient();
      if (!sql) return this.bareJson({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }, corsHeaders, 503);

      // Merge over any existing stored settings so partial PUTs are non-destructive.
      const existingRows = await sql`SELECT settings FROM platform_settings WHERE id = 1`;
      const merged = this.mergeSettings(existingRows?.[0]?.settings ?? {}, incoming);

      await sql`
        INSERT INTO platform_settings (id, settings, updated_by, updated_at)
        VALUES (1, ${JSON.stringify(merged)}::jsonb, ${userAuth.userId}, NOW())
        ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_by = EXCLUDED.updated_by, updated_at = NOW()
      `;
      await this.writeAudit(sql, userAuth.userId, 'settings.update', 'platform_settings', 1, {});

      return this.bareJson(this.mergeSettings(this.defaultSettings(), merged), corsHeaders);

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return this.bareJson({ success: false, error: { message: 'Failed to update settings', code: 'UPDATE_SETTINGS_ERROR' } }, corsHeaders, 500);
    }
  }

  // Audit Log
  private async handleAuditLog(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const url = new URL(request.url);
      const action_type = url.searchParams.get('action_type');
      const user_id = url.searchParams.get('user_id');
      const page = parseInt(url.searchParams.get('page') || '1');

      // Real audit log from the audit_logs table (mirrors auditLogRealHandler's schema).
      const sql = this.getSqlClient();
      if (!sql) {
        return new Response(JSON.stringify({ success: false, error: { message: 'Database unavailable', code: 'DB_UNAVAILABLE' } }), {
          status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const actionFilter = action_type || '';
      const limit = 50;
      const offset = (Math.max(1, page) - 1) * limit;
      let auditLog: any[] = [];
      let total = 0;
      try {
        auditLog = await sql`
          SELECT a.id, a.action, a.user_id AS actor_id, u.email AS actor_name,
                 a.entity_type AS target_type, a.entity_id AS target_id,
                 a.ip_address, a.created_at AS timestamp
          FROM audit_logs a
          LEFT JOIN users u ON u.id = a.user_id
          WHERE (${actionFilter}::text = '' OR a.action = ${actionFilter})
          ORDER BY a.created_at DESC
          LIMIT ${limit} OFFSET ${offset}`;
        const c = await sql`SELECT COUNT(*)::int AS total FROM audit_logs a WHERE (${actionFilter}::text = '' OR a.action = ${actionFilter})`;
        total = c[0]?.total ?? 0;
      } catch (_e) { /* audit_logs may be absent in some envs — return empty honestly */ }
      void user_id;

      return new Response(JSON.stringify({
        success: true,
        audit_log: auditLog,
        pagination: {
          page,
          total,
          has_next: offset + auditLog.length < total
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to get audit log', code: 'AUDIT_LOG_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // Broadcast Message
  private async handleBroadcastMessage(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await request.json() as {
        message: string;
        target_audience: 'all' | 'creators' | 'investors' | 'production';
        message_type: 'info' | 'warning' | 'announcement';
        send_email?: boolean;
        schedule_at?: string;
      };

      if (!body.message?.trim()) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Message content is required', code: 'VALIDATION_ERROR' } 
        }), {
          status: 422,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // This never sent anything and returned hardcoded recipient counts. There is no
      // admin UI for it. Return an honest 501 rather than faking a successful send;
      // a real implementation needs a notifications fan-out (+ optional email).
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Broadcast messaging is not implemented yet.', code: 'NOT_IMPLEMENTED' }
      }), {
        status: 501,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    } catch (error) {
      await this.logger.captureError(error instanceof Error ? error : new Error(String(error)));
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to send broadcast message', code: 'BROADCAST_ERROR' } 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
}