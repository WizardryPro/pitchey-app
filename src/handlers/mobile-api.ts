/**
 * Mobile-Optimized API Handlers for Pitchey Platform
 * Provides lightweight, pagination-ready endpoints for mobile apps
 */

import { WorkerDatabase } from '../services/worker-database';
import { ApiResponseBuilder, ErrorCode } from '../utils/api-response';
import { getCorsHeaders } from '../utils/response';
import { verifyJWT, extractJWT } from '../utils/worker-jwt';

interface MobileRequestContext {
  request: Request;
  env: any;
  db: WorkerDatabase;
  userId?: number;
  userType?: string;
}

interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

interface MobileConnectionInfo {
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
}

// Mobile-optimized response builders
class MobileApiResponse {
  static success(data: any, meta?: any) {
    const response = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };

    if (meta) {
      response.meta = meta;
    }

    return response;
  }

  static paginated(data: any[], pagination: PaginationParams & { total: number }) {
    return {
      success: true,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page * pagination.limit < pagination.total,
        hasPrev: pagination.page > 1
      },
      timestamp: new Date().toISOString()
    };
  }

  static optimized(data: any, connectionInfo?: MobileConnectionInfo) {
    const response = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };

    // Add connection-aware optimizations
    if (connectionInfo?.effectiveType === '2g' || connectionInfo?.effectiveType === 'slow-2g') {
      // Reduce data for slow connections
      response.data = this.compressForSlowConnection(data);
      response.meta = { optimized: 'slow-connection' };
    }

    return response;
  }

  private static compressForSlowConnection(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.compressItem(item));
    }
    return this.compressItem(data);
  }

  private static compressItem(item: any): any {
    if (!item || typeof item !== 'object') return item;

    const compressed: any = {};
    
    // Essential fields only for slow connections
    const essentialFields = [
      'id', 'title', 'description', 'genre', 'format', 
      'status', 'created_at', 'updated_at', 'user_id',
      'creator_name', 'thumbnail_url', 'view_count'
    ];

    for (const field of essentialFields) {
      if (item[field] !== undefined) {
        compressed[field] = item[field];
      }
    }

    // Truncate long descriptions for mobile
    if (compressed.description && compressed.description.length > 100) {
      compressed.description = compressed.description.substring(0, 97) + '...';
    }

    return compressed;
  }
}

// Utility functions
function getPaginationParams(url: URL): PaginationParams {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

function getMobileConnectionInfo(request: Request): MobileConnectionInfo {
  const headers = request.headers;
  return {
    effectiveType: headers.get('effective-connection-type') as any,
    downlink: headers.get('downlink') ? parseFloat(headers.get('downlink')!) : undefined,
    rtt: headers.get('rtt') ? parseInt(headers.get('rtt')!) : undefined
  };
}

function getImageOptimizationParams(connectionInfo: MobileConnectionInfo): string {
  const params = new URLSearchParams();
  
  if (connectionInfo.effectiveType === '2g' || connectionInfo.effectiveType === 'slow-2g') {
    params.set('w', '400');
    params.set('q', '60');
    params.set('f', 'webp');
  } else if (connectionInfo.effectiveType === '3g') {
    params.set('w', '600');
    params.set('q', '75');
    params.set('f', 'webp');
  } else {
    params.set('w', '800');
    params.set('q', '85');
    params.set('f', 'webp');
  }

  return params.toString();
}

// Mobile API Handlers

export async function mobileGetTrendingPitches(context: MobileRequestContext): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const pagination = getPaginationParams(url);
    const connectionInfo = getMobileConnectionInfo(context.request);
    const genre = url.searchParams.get('genre');
    const format = url.searchParams.get('format');

    let query = `
      SELECT 
        p.id, p.title, p.description, p.genre, p.format, p.status,
        p.created_at, p.updated_at, p.view_count, p.thumbnail_url,
        u.display_name as creator_name, u.id as user_id,
        COUNT(v.id) as recent_views
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN pitch_views v ON p.id = v.pitch_id AND v.viewed_at > NOW() - INTERVAL '7 days'
      WHERE p.status = 'published'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (genre) {
      query += ` AND p.genre = $${paramIndex}`;
      params.push(genre);
      paramIndex++;
    }

    if (format) {
      query += ` AND p.format = $${paramIndex}`;
      params.push(format);
      paramIndex++;
    }

    query += `
      GROUP BY p.id, u.id
      ORDER BY recent_views DESC, p.view_count DESC, p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(pagination.limit, pagination.offset);

    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM pitches p
      WHERE p.status = 'published'
      ${genre ? ` AND p.genre = $1` : ''}
      ${format ? ` AND p.format = $${genre ? '2' : '1'}` : ''}
    `;

    const countParams = [];
    if (genre) countParams.push(genre);
    if (format) countParams.push(format);

    const [pitchesResult, countResult] = await Promise.all([
      context.db.executeQuery(query, params),
      context.db.executeQuery(countQuery, countParams)
    ]);

    const pitches = pitchesResult.rows.map(pitch => ({
      ...pitch,
      thumbnail_url: pitch.thumbnail_url ? 
        `${pitch.thumbnail_url}?${getImageOptimizationParams(connectionInfo)}` : 
        null
    }));

    const total = parseInt(countResult.rows[0]?.total || '0');

    return new Response(
      JSON.stringify(MobileApiResponse.paginated(pitches, { ...pagination, total })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(),
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
        }
      }
    );

  } catch (error) {
    console.error('Mobile trending pitches error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch trending pitches')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function mobileGetPitchById(context: MobileRequestContext, pitchId: string): Promise<Response> {
  try {
    const connectionInfo = getMobileConnectionInfo(context.request);
    
    const query = `
      SELECT 
        p.*,
        u.display_name as creator_name, u.profile_image_url as creator_avatar,
        COUNT(v.id) as view_count,
        COUNT(DISTINCT pv.id) as total_views
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN pitch_views v ON p.id = v.pitch_id AND v.viewed_at > NOW() - INTERVAL '24 hours'
      LEFT JOIN pitch_views pv ON p.id = pv.pitch_id
      WHERE p.id = $1 AND (p.status = 'published' OR p.user_id = $2)
      GROUP BY p.id, u.id
    `;

    const result = await context.db.executeQuery(query, [pitchId, context.userId || 0]);

    if (!result.rows.length) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.NOT_FOUND, 'Pitch not found')),
        { status: 404, headers: getCorsHeaders() }
      );
    }

    let pitch = result.rows[0];

    // Optimize images for mobile connection
    if (pitch.thumbnail_url) {
      pitch.thumbnail_url = `${pitch.thumbnail_url}?${getImageOptimizationParams(connectionInfo)}`;
    }
    if (pitch.creator_avatar) {
      pitch.creator_avatar = `${pitch.creator_avatar}?${getImageOptimizationParams(connectionInfo)}`;
    }

    // Track view if user is authenticated
    if (context.userId && context.userId !== pitch.user_id) {
      await context.db.executeQuery(
        'INSERT INTO pitch_views (pitch_id, viewer_id, viewed_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
        [pitchId, context.userId]
      );
    }

    return new Response(
      JSON.stringify(MobileApiResponse.optimized(pitch, connectionInfo)),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(),
          'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200'
        }
      }
    );

  } catch (error) {
    console.error('Mobile get pitch error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch pitch')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function mobileGetUserDashboard(context: MobileRequestContext): Promise<Response> {
  try {
    if (!context.userId) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.UNAUTHORIZED, 'Authentication required')),
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const connectionInfo = getMobileConnectionInfo(context.request);
    
    let dashboardData: any = {
      user_id: context.userId,
      user_type: context.userType
    };

    // Get different data based on user type
    switch (context.userType) {
      case 'creator':
        dashboardData = await getMobileCreatorDashboard(context);
        break;
      case 'investor':
        dashboardData = await getMobileInvestorDashboard(context);
        break;
      case 'production':
        dashboardData = await getMobileProductionDashboard(context);
        break;
      default:
        dashboardData = await getBasicMobileDashboard(context);
    }

    return new Response(
      JSON.stringify(MobileApiResponse.optimized(dashboardData, connectionInfo)),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(),
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600'
        }
      }
    );

  } catch (error) {
    console.error('Mobile dashboard error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch dashboard')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function mobileSearchPitches(context: MobileRequestContext): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const query = url.searchParams.get('q') || '';
    const pagination = getPaginationParams(url);
    const connectionInfo = getMobileConnectionInfo(context.request);
    const genre = url.searchParams.get('genre');
    const format = url.searchParams.get('format');

    if (!query.trim()) {
      return new Response(
        JSON.stringify(MobileApiResponse.paginated([], { ...pagination, total: 0 })),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders()
          }
        }
      );
    }

    const searchQuery = `
      SELECT 
        p.id, p.title, p.description, p.genre, p.format, p.status,
        p.created_at, p.view_count, p.thumbnail_url,
        u.display_name as creator_name,
        ts_rank(to_tsvector('english', p.title || ' ' || p.description), plainto_tsquery('english', $1)) as rank
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 'published'
        AND to_tsvector('english', p.title || ' ' || p.description) @@ plainto_tsquery('english', $1)
        ${genre ? 'AND p.genre = $' + (genre ? '3' : '2') : ''}
        ${format ? 'AND p.format = $' + (format ? (genre ? '4' : '3') : (genre ? '3' : '2')) : ''}
      ORDER BY rank DESC, p.view_count DESC
      LIMIT $${genre && format ? '5' : genre || format ? '4' : '3'} OFFSET $${genre && format ? '6' : genre || format ? '5' : '4'}
    `;

    const params = [query];
    if (genre) params.push(genre);
    if (format) params.push(format);
    params.push(pagination.limit, pagination.offset);

    const result = await context.db.executeQuery(searchQuery, params);

    const pitches = result.rows.map(pitch => ({
      ...pitch,
      thumbnail_url: pitch.thumbnail_url ? 
        `${pitch.thumbnail_url}?${getImageOptimizationParams(connectionInfo)}` : 
        null
    }));

    return new Response(
      JSON.stringify(MobileApiResponse.paginated(pitches, { ...pagination, total: result.rows.length })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(),
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
        }
      }
    );

  } catch (error) {
    console.error('Mobile search error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Search failed')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function mobileGetNotifications(context: MobileRequestContext): Promise<Response> {
  try {
    if (!context.userId) {
      return new Response(
        JSON.stringify(ApiResponseBuilder.error(ErrorCode.UNAUTHORIZED, 'Authentication required')),
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const url = new URL(context.request.url);
    const pagination = getPaginationParams(url);
    const unreadOnly = url.searchParams.get('unread_only') === 'true';

    const query = `
      SELECT id, title, message, type, read_at, created_at, metadata
      FROM notifications
      WHERE user_id = $1
      ${unreadOnly ? 'AND read_at IS NULL' : ''}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications
      WHERE user_id = $1
      ${unreadOnly ? 'AND read_at IS NULL' : ''}
    `;

    const [notificationsResult, countResult] = await Promise.all([
      context.db.executeQuery(query, [context.userId, pagination.limit, pagination.offset]),
      context.db.executeQuery(countQuery, [context.userId])
    ]);

    const total = parseInt(countResult.rows[0]?.total || '0');

    return new Response(
      JSON.stringify(MobileApiResponse.paginated(notificationsResult.rows, { ...pagination, total })),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(),
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
        }
      }
    );

  } catch (error) {
    console.error('Mobile notifications error:', error);
    return new Response(
      JSON.stringify(ApiResponseBuilder.error(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch notifications')),
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

// Helper functions for dashboard data

async function getMobileCreatorDashboard(context: MobileRequestContext) {
  const queries = await Promise.all([
    context.db.executeQuery(
      'SELECT COUNT(*) as total FROM pitches WHERE user_id = $1',
      [context.userId]
    ),
    context.db.executeQuery(
      'SELECT COUNT(*) as total FROM pitch_views WHERE pitch_id IN (SELECT id FROM pitches WHERE user_id = $1)',
      [context.userId]
    ),
    context.db.executeQuery(
      'SELECT COUNT(*) as total FROM follows WHERE followed_user_id = $1',
      [context.userId]
    ),
    context.db.executeQuery(`
      SELECT id, title, view_count, created_at 
      FROM pitches 
      WHERE user_id = $1 
      ORDER BY view_count DESC, created_at DESC 
      LIMIT 3
    `, [context.userId])
  ]);

  return {
    user_type: 'creator',
    stats: {
      total_pitches: parseInt(queries[0].rows[0]?.total || '0'),
      total_views: parseInt(queries[1].rows[0]?.total || '0'),
      followers: parseInt(queries[2].rows[0]?.total || '0')
    },
    recent_pitches: queries[3].rows
  };
}

async function getMobileInvestorDashboard(context: MobileRequestContext) {
  const queries = await Promise.all([
    context.db.executeQuery(
      'SELECT COUNT(*) as total FROM investment_interests WHERE investor_id = $1',
      [context.userId]
    ),
    context.db.executeQuery(
      'SELECT COUNT(*) as total FROM saved_pitches WHERE user_id = $1',
      [context.userId]
    ),
    context.db.executeQuery(
      'SELECT COUNT(*) as total FROM ndas WHERE investor_id = $1 AND status = $2',
      [context.userId, 'signed']
    )
  ]);

  return {
    user_type: 'investor',
    stats: {
      investment_interests: parseInt(queries[0].rows[0]?.total || '0'),
      saved_pitches: parseInt(queries[1].rows[0]?.total || '0'),
      signed_ndas: parseInt(queries[2].rows[0]?.total || '0')
    }
  };
}

async function getMobileProductionDashboard(context: MobileRequestContext) {
  const queries = await Promise.all([
    context.db.executeQuery(
      'SELECT COUNT(*) as total FROM production_submissions WHERE production_company_id = $1',
      [context.userId]
    ),
    context.db.executeQuery(
      'SELECT COUNT(*) as total FROM production_projects WHERE production_company_id = $1',
      [context.userId]
    )
  ]);

  return {
    user_type: 'production',
    stats: {
      submissions: parseInt(queries[0].rows[0]?.total || '0'),
      projects: parseInt(queries[1].rows[0]?.total || '0')
    }
  };
}

async function getBasicMobileDashboard(context: MobileRequestContext) {
  return {
    user_type: context.userType || 'user',
    stats: {},
    message: 'Basic dashboard for mobile'
  };
}

// Mobile authentication middleware
export async function verifyMobileAuth(request: Request, env: any): Promise<{ userId?: number; userType?: string }> {
  try {
    const token = extractJWT(request);
    if (!token) {
      return {};
    }

    const payload = await verifyJWT(token, env.JWT_SECRET);
    return {
      userId: payload.userId,
      userType: payload.userType
    };
  } catch (error) {
    console.error('Mobile auth verification failed:', error);
    return {};
  }
}