/**
 * Raw SQL API Endpoints
 * All database queries using raw SQL - no ORM
 */

import { RawSQLDatabase } from '../db/raw-sql-connection';
import { RawSQLAuthMiddleware, AuthContext, createAuthResponse, withAuth } from '../middleware/raw-sql-auth.middleware';
import { z } from 'zod';

// ============= VALIDATION SCHEMAS =============

const CreatePitchSchema = z.object({
  title: z.string().min(1).max(255),
  logline: z.string().min(1),
  synopsis: z.string().optional(),
  genre: z.string(),
  format: z.string(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  budget_range: z.string().optional(),
  target_audience: z.string().optional()
});

const UpdatePitchSchema = CreatePitchSchema.partial();

const CreateNDARequestSchema = z.object({
  pitch_id: z.number(),
  message: z.string().optional()
});

const CreateInvestmentSchema = z.object({
  pitch_id: z.number(),
  amount: z.number().positive(),
  equity_percentage: z.number().min(0).max(100).optional(),
  terms: z.string().optional()
});

// ============= API HANDLERS =============

export class RawSQLAPIHandlers {
  constructor(
    private db: RawSQLDatabase,
    private auth: RawSQLAuthMiddleware
  ) {}

  // ============= PITCH ENDPOINTS =============

  /**
   * Get all pitches with filters
   */
  async getPitches(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const genre = url.searchParams.get('genre');
    const format = url.searchParams.get('format');
    const status = url.searchParams.get('status') || 'active';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('search');

    let query = `
      SELECT 
        p.*,
        u.username as creator_username,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        COALESCE(pv.view_count, 0) as view_count,
        COALESCE(ps.save_count, 0) as save_count
      FROM pitches p
      JOIN users u ON p.creator_id = u.id
      LEFT JOIN (
        SELECT pitch_id, COUNT(*) as view_count
        FROM pitch_views
        GROUP BY pitch_id
      ) pv ON pv.pitch_id = p.id
      LEFT JOIN (
        SELECT pitch_id, COUNT(*) as save_count
        FROM saved_pitches
        GROUP BY pitch_id
      ) ps ON ps.pitch_id = p.id
      WHERE p.status = $1
    `;

    const params: any[] = [status];
    let paramCount = 1;

    if (genre) {
      paramCount++;
      query += ` AND p.genre = $${paramCount}`;
      params.push(genre);
    }

    if (format) {
      paramCount++;
      query += ` AND p.format = $${paramCount}`;
      params.push(format);
    }

    if (search) {
      paramCount++;
      query += ` AND (p.title ILIKE $${paramCount} OR p.logline ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const pitches = await this.db.query(query, params);

    return createAuthResponse(true, 'Pitches retrieved', pitches);
  }

  /**
   * Get single pitch by ID
   */
  async getPitch(request: Request, pitchId: number): Promise<Response> {
    const context = await this.auth.authenticate(request);

    const pitch = await this.db.queryOne(`
      SELECT 
        p.*,
        u.username as creator_username,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        u.email as creator_email,
        COALESCE(pv.view_count, 0) as view_count,
        COALESCE(ps.save_count, 0) as save_count,
        CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_saved
      FROM pitches p
      JOIN users u ON p.creator_id = u.id
      LEFT JOIN (
        SELECT pitch_id, COUNT(*) as view_count
        FROM pitch_views
        GROUP BY pitch_id
      ) pv ON pv.pitch_id = p.id
      LEFT JOIN (
        SELECT pitch_id, COUNT(*) as save_count
        FROM saved_pitches
        GROUP BY pitch_id
      ) ps ON ps.pitch_id = p.id
      LEFT JOIN saved_pitches sp ON sp.pitch_id = p.id 
        AND sp.user_id = $2
      WHERE p.id = $1
    `, [pitchId, context.user?.id || 0]);

    if (!pitch) {
      return createAuthResponse(false, 'Pitch not found', null, 404);
    }

    // Track view if authenticated
    if (context.isAuthenticated && context.user) {
      await this.db.query(`
        INSERT INTO pitch_views (pitch_id, viewer_id, viewed_at)
        VALUES ($1, $2, NOW())
      `, [pitchId, context.user.id]);
    }

    return createAuthResponse(true, 'Pitch retrieved', pitch);
  }

  /**
   * Create new pitch
   */
  async createPitch(request: Request): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    
    if (context.user!.user_type !== 'creator') {
      return createAuthResponse(false, 'Only creators can create pitches', null, 403);
    }

    const body = await request.json();
    const validated = CreatePitchSchema.parse(body);

    const [pitch] = await this.db.insert('pitches', {
      ...validated,
      creator_id: context.user!.id,
      created_at: new Date(),
      updated_at: new Date()
    });

    return createAuthResponse(true, 'Pitch created', pitch, 201);
  }

  /**
   * Update pitch
   */
  async updatePitch(request: Request, pitchId: number): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    
    // Check ownership
    const existing = await this.db.queryOne<{ creator_id: number }>(
      'SELECT creator_id FROM pitches WHERE id = $1',
      [pitchId]
    );

    if (!existing) {
      return createAuthResponse(false, 'Pitch not found', null, 404);
    }

    if (existing.creator_id !== context.user!.id) {
      return createAuthResponse(false, 'Unauthorized', null, 403);
    }

    const body = await request.json();
    const validated = UpdatePitchSchema.parse(body);

    const [updated] = await this.db.update(
      'pitches',
      { ...validated, updated_at: new Date() },
      'id = $1',
      [pitchId]
    );

    return createAuthResponse(true, 'Pitch updated', updated);
  }

  /**
   * Delete pitch
   */
  async deletePitch(request: Request, pitchId: number): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    
    // Check ownership
    const existing = await this.db.queryOne<{ creator_id: number }>(
      'SELECT creator_id FROM pitches WHERE id = $1',
      [pitchId]
    );

    if (!existing) {
      return createAuthResponse(false, 'Pitch not found', null, 404);
    }

    if (existing.creator_id !== context.user!.id) {
      return createAuthResponse(false, 'Unauthorized', null, 403);
    }

    await this.db.delete('pitches', 'id = $1', [pitchId]);
    
    return createAuthResponse(true, 'Pitch deleted');
  }

  // ============= USER ENDPOINTS =============

  /**
   * Get user profile
   */
  async getUserProfile(request: Request, userId?: number): Promise<Response> {
    const context = await this.auth.authenticate(request);
    
    const targetUserId = userId || context.user?.id;
    if (!targetUserId) {
      return createAuthResponse(false, 'User ID required', null, 400);
    }

    const user = await this.db.queryOne(`
      SELECT 
        id, email, username, user_type,
        first_name, last_name, bio, location,
        profile_image_url, company_name,
        created_at, email_verified
      FROM users
      WHERE id = $1
    `, [targetUserId]);

    if (!user) {
      return createAuthResponse(false, 'User not found', null, 404);
    }

    // Get user stats
    const stats = await this.db.queryOne(`
      SELECT 
        (SELECT COUNT(*) FROM pitches WHERE creator_id = $1) as pitch_count,
        (SELECT COUNT(*) FROM investments WHERE investor_id = $1) as investment_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = $1) as follower_count,
        (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following_count
    `, [targetUserId]);

    return createAuthResponse(true, 'User profile retrieved', {
      ...user,
      stats
    });
  }

  /**
   * Update user profile
   */
  async updateUserProfile(request: Request): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    const body = await request.json();

    // Only allow updating certain fields
    const allowedFields = ['first_name', 'last_name', 'bio', 'location', 'company_name', 'profile_image_url'];
    const updates: Record<string, any> = {};
    
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return createAuthResponse(false, 'No valid fields to update', null, 400);
    }

    const [updated] = await this.db.update(
      'users',
      { ...updates, updated_at: new Date() },
      'id = $1',
      [context.user!.id]
    );

    return createAuthResponse(true, 'Profile updated', updated);
  }

  // ============= NDA ENDPOINTS =============

  /**
   * Request NDA for a pitch
   */
  async requestNDA(request: Request): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    const body = await request.json();
    const validated = CreateNDARequestSchema.parse(body);

    // Check if NDA already requested
    const existing = await this.db.queryOne(
      'SELECT id, status FROM nda_requests WHERE pitch_id = $1 AND requestor_id = $2',
      [validated.pitch_id, context.user!.id]
    );

    if (existing) {
      return createAuthResponse(false, `NDA already ${existing.status}`, existing, 409);
    }

    const [ndaRequest] = await this.db.insert('nda_requests', {
      pitch_id: validated.pitch_id,
      requestor_id: context.user!.id,
      status: 'pending',
      message: validated.message,
      created_at: new Date(),
      updated_at: new Date()
    });

    return createAuthResponse(true, 'NDA request sent', ndaRequest, 201);
  }

  /**
   * Get NDA requests for user's pitches
   */
  async getNDARequests(request: Request): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    let query = `
      SELECT 
        nr.*,
        p.title as pitch_title,
        u.username as requestor_username,
        u.email as requestor_email
      FROM nda_requests nr
      JOIN pitches p ON nr.pitch_id = p.id
      JOIN users u ON nr.requestor_id = u.id
      WHERE p.creator_id = $1
    `;

    const params: any[] = [context.user!.id];

    if (status) {
      query += ' AND nr.status = $2';
      params.push(status);
    }

    query += ' ORDER BY nr.created_at DESC';

    const requests = await this.db.query(query, params);
    
    return createAuthResponse(true, 'NDA requests retrieved', requests);
  }

  /**
   * Approve/Reject NDA request
   */
  async updateNDAStatus(request: Request, requestId: number): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    const body = await request.json();
    const { status, notes } = body;

    if (!['approved', 'rejected'].includes(status)) {
      return createAuthResponse(false, 'Invalid status', null, 400);
    }

    // Check ownership
    const ndaRequest = await this.db.queryOne(`
      SELECT nr.*, p.creator_id
      FROM nda_requests nr
      JOIN pitches p ON nr.pitch_id = p.id
      WHERE nr.id = $1
    `, [requestId]);

    if (!ndaRequest) {
      return createAuthResponse(false, 'NDA request not found', null, 404);
    }

    if (ndaRequest.creator_id !== context.user!.id) {
      return createAuthResponse(false, 'Unauthorized', null, 403);
    }

    const [updated] = await this.db.update(
      'nda_requests',
      {
        status,
        notes,
        [status === 'approved' ? 'approved_at' : 'rejected_at']: new Date(),
        updated_at: new Date()
      },
      'id = $1',
      [requestId]
    );

    return createAuthResponse(true, `NDA request ${status}`, updated);
  }

  // ============= INVESTMENT ENDPOINTS =============

  /**
   * Create investment
   */
  async createInvestment(request: Request): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    
    if (context.user!.user_type !== 'investor') {
      return createAuthResponse(false, 'Only investors can make investments', null, 403);
    }

    const body = await request.json();
    const validated = CreateInvestmentSchema.parse(body);

    const [investment] = await this.db.insert('investments', {
      ...validated,
      investor_id: context.user!.id,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    });

    return createAuthResponse(true, 'Investment created', investment, 201);
  }

  /**
   * Get investments
   */
  async getInvestments(request: Request): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'investor';

    let query: string;
    let params: any[];

    if (type === 'investor') {
      // Get investments made by the user
      query = `
        SELECT 
          i.*,
          p.title as pitch_title,
          p.genre as pitch_genre,
          u.username as creator_username
        FROM investments i
        JOIN pitches p ON i.pitch_id = p.id
        JOIN users u ON p.creator_id = u.id
        WHERE i.investor_id = $1
        ORDER BY i.created_at DESC
      `;
      params = [context.user!.id];
    } else {
      // Get investments in user's pitches
      query = `
        SELECT 
          i.*,
          p.title as pitch_title,
          u.username as investor_username,
          u.email as investor_email
        FROM investments i
        JOIN pitches p ON i.pitch_id = p.id
        JOIN users u ON i.investor_id = u.id
        WHERE p.creator_id = $1
        ORDER BY i.created_at DESC
      `;
      params = [context.user!.id];
    }

    const investments = await this.db.query(query, params);
    
    return createAuthResponse(true, 'Investments retrieved', investments);
  }

  // ============= FOLLOW ENDPOINTS =============

  /**
   * Follow/Unfollow user
   */
  async toggleFollow(request: Request, targetUserId: number): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    
    if (context.user!.id === targetUserId) {
      return createAuthResponse(false, 'Cannot follow yourself', null, 400);
    }

    // Check if already following
    const existing = await this.db.queryOne(
      'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2',
      [context.user!.id, targetUserId]
    );

    if (existing) {
      // Unfollow
      await this.db.delete('follows', 'id = $1', [existing.id]);
      return createAuthResponse(true, 'Unfollowed successfully');
    } else {
      // Follow
      await this.db.insert('follows', {
        follower_id: context.user!.id,
        following_id: targetUserId,
        created_at: new Date()
      });
      return createAuthResponse(true, 'Followed successfully');
    }
  }

  /**
   * Get followers/following
   */
  async getFollows(request: Request, userId: number, type: 'followers' | 'following'): Promise<Response> {
    let query: string;
    let params: any[];

    if (type === 'followers') {
      query = `
        SELECT 
          u.id, u.username, u.first_name, u.last_name,
          u.profile_image_url, u.bio, u.user_type
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
      `;
      params = [userId];
    } else {
      query = `
        SELECT 
          u.id, u.username, u.first_name, u.last_name,
          u.profile_image_url, u.bio, u.user_type
        FROM follows f
        JOIN users u ON f.following_id = u.id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
      `;
      params = [userId];
    }

    const users = await this.db.query(query, params);
    
    return createAuthResponse(true, `${type} retrieved`, users);
  }

  // ============= SAVED PITCHES =============

  /**
   * Save/Unsave pitch
   */
  async toggleSavePitch(request: Request, pitchId: number): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    
    // Check if already saved
    const existing = await this.db.queryOne(
      'SELECT id FROM saved_pitches WHERE user_id = $1 AND pitch_id = $2',
      [context.user!.id, pitchId]
    );

    if (existing) {
      // Unsave
      await this.db.delete('saved_pitches', 'id = $1', [existing.id]);
      return createAuthResponse(true, 'Pitch unsaved');
    } else {
      // Save
      await this.db.insert('saved_pitches', {
        user_id: context.user!.id,
        pitch_id: pitchId,
        created_at: new Date()
      });
      return createAuthResponse(true, 'Pitch saved');
    }
  }

  /**
   * Get saved pitches
   */
  async getSavedPitches(request: Request): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    
    const pitches = await this.db.query(`
      SELECT 
        p.*,
        u.username as creator_username,
        sp.created_at as saved_at
      FROM saved_pitches sp
      JOIN pitches p ON sp.pitch_id = p.id
      JOIN users u ON p.creator_id = u.id
      WHERE sp.user_id = $1
      ORDER BY sp.created_at DESC
    `, [context.user!.id]);
    
    return createAuthResponse(true, 'Saved pitches retrieved', pitches);
  }

  // ============= DASHBOARD ENDPOINTS =============

  /**
   * Get dashboard stats
   */
  async getDashboardStats(request: Request): Promise<Response> {
    const context = await this.auth.requireAuth(request);
    const userType = context.user!.user_type;

    let stats: any = {};

    if (userType === 'creator') {
      stats = await this.db.queryOne(`
        SELECT 
          (SELECT COUNT(*) FROM pitches WHERE creator_id = $1) as total_pitches,
          (SELECT COUNT(*) FROM pitches WHERE creator_id = $1 AND status = 'active') as active_pitches,
          (SELECT COALESCE(SUM(view_count), 0) FROM (
            SELECT COUNT(*) as view_count
            FROM pitch_views pv
            JOIN pitches p ON pv.pitch_id = p.id
            WHERE p.creator_id = $1
            GROUP BY pv.pitch_id
          ) views) as total_views,
          (SELECT COUNT(DISTINCT nr.id) 
           FROM nda_requests nr
           JOIN pitches p ON nr.pitch_id = p.id
           WHERE p.creator_id = $1) as nda_requests,
          (SELECT COALESCE(SUM(i.amount), 0)
           FROM investments i
           JOIN pitches p ON i.pitch_id = p.id
           WHERE p.creator_id = $1 AND i.status = 'approved') as total_investment
      `, [context.user!.id]);
    } else if (userType === 'investor') {
      stats = await this.db.queryOne(`
        SELECT 
          (SELECT COUNT(*) FROM investments WHERE investor_id = $1) as total_investments,
          (SELECT COALESCE(SUM(amount), 0) FROM investments WHERE investor_id = $1) as total_invested,
          (SELECT COUNT(*) FROM saved_pitches WHERE user_id = $1) as saved_pitches,
          (SELECT COUNT(*) FROM nda_requests WHERE requestor_id = $1 AND status = 'approved') as approved_ndas,
          (SELECT COUNT(DISTINCT pitch_id) FROM pitch_views WHERE viewer_id = $1) as pitches_viewed
      `, [context.user!.id]);
    }

    return createAuthResponse(true, 'Dashboard stats retrieved', stats);
  }
}

/**
 * Create router for raw SQL endpoints
 */
export function createRawSQLRouter(env: any) {
  const db = new RawSQLDatabase({
    connectionString: env.DATABASE_URL,
    redis: env.UPSTASH_REDIS_REST_URL ? {
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN
    } : undefined
  });
  
  const auth = new RawSQLAuthMiddleware(db);
  const handlers = new RawSQLAPIHandlers(db, auth);

  return {
    // Pitch endpoints
    'GET /api/pitches': () => handlers.getPitches.bind(handlers),
    'GET /api/pitches/:id': (params: any) => (req: Request) => handlers.getPitch(req, params.id),
    'POST /api/pitches': () => handlers.createPitch.bind(handlers),
    'PUT /api/pitches/:id': (params: any) => (req: Request) => handlers.updatePitch(req, params.id),
    'DELETE /api/pitches/:id': (params: any) => (req: Request) => handlers.deletePitch(req, params.id),
    
    // User endpoints
    'GET /api/users/:id': (params: any) => (req: Request) => handlers.getUserProfile(req, params.id),
    'GET /api/profile': () => handlers.getUserProfile.bind(handlers),
    'PUT /api/profile': () => handlers.updateUserProfile.bind(handlers),
    
    // NDA endpoints
    'POST /api/nda/request': () => handlers.requestNDA.bind(handlers),
    'GET /api/nda/requests': () => handlers.getNDARequests.bind(handlers),
    'PUT /api/nda/requests/:id': (params: any) => (req: Request) => handlers.updateNDAStatus(req, params.id),
    
    // Investment endpoints
    'POST /api/investments': () => handlers.createInvestment.bind(handlers),
    'GET /api/investments': () => handlers.getInvestments.bind(handlers),
    
    // Follow endpoints
    'POST /api/follows/:userId': (params: any) => (req: Request) => handlers.toggleFollow(req, params.userId),
    'GET /api/follows/:userId/followers': (params: any) => (req: Request) => handlers.getFollows(req, params.userId, 'followers'),
    'GET /api/follows/:userId/following': (params: any) => (req: Request) => handlers.getFollows(req, params.userId, 'following'),
    
    // Saved pitches endpoints
    'POST /api/pitches/:id/save': (params: any) => (req: Request) => handlers.toggleSavePitch(req, params.id),
    'GET /api/saved-pitches': () => handlers.getSavedPitches.bind(handlers),
    
    // Dashboard endpoints
    'GET /api/dashboard/stats': () => handlers.getDashboardStats.bind(handlers)
  };
}