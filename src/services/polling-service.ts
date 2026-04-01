/**
 * Polling Service for Free Tier
 * Replaces WebSocket functionality with efficient polling
 */

import { WorkerDatabase } from './worker-database';
import { getCorsHeaders } from '../utils/response';

export interface PollResponse {
  notifications?: any[];
  messages?: any[];
  updates?: any[];
  timestamp: number;
  nextPollIn: number;
}

export class PollingService {
  private db: WorkerDatabase;
  private kv: KVNamespace;

  constructor(env: any) {
    this.db = new WorkerDatabase(env);
    this.kv = env.KV;
  }

  /**
   * Poll for notifications - replaces WebSocket notifications
   */
  async pollNotifications(userId: string): Promise<PollResponse> {
    const cacheKey = `poll:notifications:${userId}`;

    // Check cache first (5 second cache for notifications)
    const cached = await this.kv.get(cacheKey, 'json') as PollResponse | null;
    if (cached && Date.now() - (cached as PollResponse).timestamp < 5000) {
      return cached as PollResponse;
    }

    // Get fresh notifications
    const db = this.db as any;
    const notifications = await db.getNotifications(userId, 10);
    
    const response: PollResponse = {
      notifications,
      timestamp: Date.now(),
      nextPollIn: 30000 // Poll every 30 seconds
    };

    // Cache the response
    await this.kv.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 5
    });

    return response;
  }

  /**
   * Poll for messages - replaces WebSocket messages
   */
  async pollMessages(userId: string, conversationId?: string): Promise<PollResponse> {
    const cacheKey = conversationId 
      ? `poll:messages:${userId}:${conversationId}`
      : `poll:messages:${userId}`;
    
    // Check cache (3 second cache for messages)
    const cached = await this.kv.get(cacheKey, 'json') as PollResponse | null;
    if (cached && Date.now() - (cached as PollResponse).timestamp < 3000) {
      return cached as PollResponse;
    }

    // Get fresh messages
    const db = this.db as any;
    const messages = conversationId
      ? await db.getConversationMessages(conversationId, userId, 20)
      : await db.getRecentMessages(userId, 20);
    
    const response: PollResponse = {
      messages,
      timestamp: Date.now(),
      nextPollIn: conversationId ? 5000 : 15000 // Active chat: 5s, inbox: 15s
    };

    // Cache the response
    await this.kv.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 3
    });

    return response;
  }

  /**
   * Poll for dashboard updates
   */
  async pollDashboardUpdates(userId: string, role: string): Promise<PollResponse> {
    const cacheKey = `poll:dashboard:${role}:${userId}`;
    
    // Check cache (30 second cache for dashboard)
    const cached = await this.kv.get(cacheKey, 'json') as PollResponse | null;
    if (cached && Date.now() - (cached as PollResponse).timestamp < 30000) {
      return cached as PollResponse;
    }

    // Get dashboard data based on role
    const db = this.db as any;
    let updates = {};

    switch (role) {
      case 'creator':
        updates = {
          pitchViews: await db.getTotalPitchViews(userId),
          ndaRequests: await db.getPendingNDACount(userId),
          messages: await db.getUnreadMessageCount(userId)
        };
        break;
      case 'investor':
        updates = {
          savedPitches: await db.getSavedPitchesCount(userId),
          investments: await db.getInvestmentCount(userId),
          followedCreators: await db.getFollowingCount(userId)
        };
        break;
      case 'production':
        updates = {
          activeProjects: await db.getActiveProjectsCount(userId),
          ndaActive: await db.getActiveNDACount(userId),
          partnerships: await db.getPartnershipsCount(userId)
        };
        break;
    }

    const response: PollResponse = {
      updates: [updates],
      timestamp: Date.now(),
      nextPollIn: 60000 // Poll every minute for dashboard
    };

    // Cache the response
    await this.kv.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 30
    });

    return response;
  }

  /**
   * Combined poll for all updates (more efficient)
   */
  async pollAll(userId: string, role: string): Promise<PollResponse> {
    const [notifications, dashboardUpdates] = await Promise.all([
      this.pollNotifications(userId),
      this.pollDashboardUpdates(userId, role)
    ]);

    return {
      notifications: notifications.notifications,
      updates: dashboardUpdates.updates,
      timestamp: Date.now(),
      nextPollIn: 30000
    };
  }
}

/**
 * Handler for polling endpoints
 */
export async function handlePolling(
  request: Request,
  env: any,
  userId: string,
  role: string
): Promise<Response> {
  const url = new URL(request.url);
  const polling = new PollingService(env);
  
  let response: PollResponse;
  
  switch (url.pathname) {
    case '/api/poll/notifications':
      response = await polling.pollNotifications(userId);
      break;
    case '/api/poll/messages':
      const conversationId = url.searchParams.get('conversation');
      response = await polling.pollMessages(userId, conversationId || undefined);
      break;
    case '/api/poll/dashboard':
      response = await polling.pollDashboardUpdates(userId, role);
      break;
    case '/api/poll/all':
      response = await polling.pollAll(userId, role);
      break;
    default:
      return new Response(JSON.stringify({ error: 'Unknown poll endpoint' }), {
        status: 404,
        headers: { ...getCorsHeaders(request.headers.get('origin')), 'Content-Type': 'application/json' }
      });
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      ...getCorsHeaders(request.headers.get('origin')),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}