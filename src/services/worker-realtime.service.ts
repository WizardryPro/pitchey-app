/**
 * Worker Real-time Service
 * Handles WebSocket connections and real-time messaging for Cloudflare Workers
 */

import { getCorsHeaders } from '../utils/response';
import { WorkerDatabase } from './worker-database';
import { LegacySessionHandler } from '../auth/legacy-session-handler';

interface RealtimeMessage {
  type: 'notification' | 'dashboard_update' | 'chat_message' | 'presence_update' | 'typing_indicator' | 'upload_progress' | 'pitch_view_update' | 'connection' | 'ping' | 'pong';
  payload: any;
  timestamp: string;
  userId?: string;
  channel?: string;
}

interface UserSession {
  userId: string;
  websocket: WebSocket;
  userType: 'creator' | 'investor' | 'production';
  channels: Set<string>;
  lastActivity: Date;
  authenticated: boolean;
}

interface WorkerRealtimeConfig {
  heartbeatInterval: number;
  sessionTimeout: number;
  maxChannelsPerUser: number;
  enablePresence: boolean;
  enableBroadcast: boolean;
}

export class WorkerRealtimeService {
  private sessions: Map<string, UserSession> = new Map();
  private channels: Map<string, Set<string>> = new Map(); // channel -> userIds
  private heartbeatTimer: any = null;
  private db: WorkerDatabase;
  private config: WorkerRealtimeConfig;
  private env: any;
  private sessionHandler: LegacySessionHandler | null = null;
  private startTime: number = Date.now(); // Track service start time for uptime calculation

  constructor(env: any, db: WorkerDatabase) {
    this.env = env;
    this.db = db;
    
    try {
      this.sessionHandler = new LegacySessionHandler(env);
    } catch (error) {
      console.error('Error initializing LegacySessionHandler:', error);
    }
    
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      sessionTimeout: 300000,  // 5 minutes
      maxChannelsPerUser: 50,
      enablePresence: true,
      enableBroadcast: true
    };
    
    this.startHeartbeat();
  }

  /**
   * Validate session from request using Better Auth
   */
  private async validateSessionFromRequest(request: Request): Promise<{ valid: boolean; user?: any }> {
    if (!this.sessionHandler) {
      console.error('SessionHandler not available - WebSocket authentication disabled');
      return { valid: false };
    }
    
    try {
      return await this.sessionHandler.validateSession(request);
    } catch (error) {
      console.error('Session validation error:', error);
      return { valid: false };
    }
  }
  
  /**
   * Validate token for WebSocket connection (cross-origin fallback)
   */
  private async validateTokenForWebSocket(token: string): Promise<{ valid: boolean; user?: any }> {
    if (!token) return { valid: false };

    try {
      if (!this.db) {
        console.error('Database connection not available for WebSocket token validation');
        return { valid: false };
      }

      // Better Auth uses 'session' table (singular), try that first
      // The token from /api/ws/token is stored as the session id
      let sessions: any[] = [];

      try {
        // Try Better Auth session table first
        sessions = await this.db.query(`
          SELECT s.id, s."userId" as user_id, s."expiresAt" as expires_at,
                 u.id as uid, u.email, u.name as username, u."userType" as user_type,
                 u."createdAt", u.image as profile_image
          FROM session s
          JOIN "user" u ON s."userId" = u.id
          WHERE s.id = $1
          AND s."expiresAt" > NOW()
          LIMIT 1
        `, [token]);
      } catch (betterAuthError) {
        console.log('Better Auth session table query failed, trying legacy sessions table');

        // Fallback to legacy sessions table
        try {
          sessions = await this.db.query(`
            SELECT s.*, u.id as user_id, u.email, u.username, u.user_type,
                   u.first_name, u.last_name, u.company_name, u.profile_image
            FROM sessions s
            JOIN users u ON s.user_id::text = u.id::text
            WHERE (s.id = $1 OR s.token = $1)
            AND s.expires_at > NOW()
            LIMIT 1
          `, [token]);
        } catch (legacyError) {
          console.error('Both session table queries failed:', legacyError);
        }
      }

      if (sessions && sessions.length > 0) {
        const session = sessions[0];
        return {
          valid: true,
          user: {
            id: session.user_id || session.uid,
            email: session.email,
            username: session.username || session.name,
            userType: session.user_type || 'creator',
            firstName: session.first_name,
            lastName: session.last_name,
            companyName: session.company_name,
            profileImage: session.profile_image || session.image
          }
        };
      }

      console.log('WebSocket token validation: no valid session found for token:', token.substring(0, 8) + '...');
      return { valid: false };
    } catch (error) {
      console.error('Token validation error:', error);
      return { valid: false };
    }
  }

  /**
   * Handle WebSocket upgrade request
   * Paid Cloudflare plan with Durable Objects - WebSocket is fully supported
   */
  async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Initialize user variables with defaults for anonymous connection
    let user: any = null;
    let userId: string = `anonymous-${crypto.randomUUID()}`;
    let userType: string = 'anonymous';

    // Authentication phase - wrapped in try-catch to allow anonymous fallback
    // Authentication failures should NOT prevent WebSocket connection
    try {
      // First, try cookie-based authentication
      try {
        const sessionResult = await this.validateSessionFromRequest(request);
        if (sessionResult.valid && sessionResult.user) {
          user = sessionResult.user;
          userId = user.id.toString();
          userType = user.userType || 'creator';
        }
      } catch (sessionError) {
        console.warn('[WS] Session validation failed, trying token auth:', sessionError);
      }

      // If no session, try token-based authentication as a fallback
      if (!user) {
        const token = url.searchParams.get('token');
        if (token) {
          try {
            const tokenValidation = await this.validateTokenForWebSocket(token);
            if (tokenValidation.valid && tokenValidation.user) {
              user = tokenValidation.user;
              userId = user.id.toString();
              userType = user.userType || 'creator';
            }
          } catch (tokenError) {
            console.warn('[WS] Token validation failed:', tokenError);
          }
        }
      }

      // Log connection type
      if (user) {
        console.log('[WS] Authenticated connection for user:', userId, 'type:', userType);
      } else {
        console.log('[WS] Anonymous connection:', userId);
      }
    } catch (authError) {
      // Auth completely failed - continue with anonymous connection
      console.warn('[WS] Auth phase failed, continuing as anonymous:', authError);
    }

    // WebSocket creation phase - this is the critical part that must succeed
    try {
      // Create WebSocket pair
      console.log('[WS] Creating WebSocket pair...');
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);
      console.log('[WS] WebSocket pair created successfully');

      // Accept the WebSocket connection
      console.log('[WS] Accepting server WebSocket...');
      server.accept();
      console.log('[WS] Server WebSocket accepted');

      // Create user session with proper authentication status
      const isAuthenticated = user !== null && userType !== 'anonymous';
      const session: UserSession = {
        userId,
        websocket: server,
        userType: userType as 'creator' | 'investor' | 'production',
        channels: new Set(),
        lastActivity: new Date(),
        authenticated: isAuthenticated
      };

      this.sessions.set(userId, session);

      // Set up message handlers
      server.addEventListener('message', (event) => {
        this.handleMessage(userId, event.data as string);
      });

      server.addEventListener('close', () => {
        this.handleDisconnect(userId);
      });

      server.addEventListener('error', (error) => {
        console.error(`[WS] Error for user ${userId}:`, error);
        this.handleDisconnect(userId);
      });

      // Send connection confirmation
      this.sendToUser(userId, {
        type: 'connection',
        payload: {
          status: 'connected',
          userId,
          authenticated: isAuthenticated,
          timestamp: new Date().toISOString(),
          serverTime: Date.now()
        },
        timestamp: new Date().toISOString()
      });

      // Update user presence (non-blocking - errors won't affect connection)
      if (this.config.enablePresence && isAuthenticated) {
        this.updateUserPresence(userId, 'online').catch(err => {
          console.error('[WS] Failed to update user presence:', err);
        });
      }

      // Return the WebSocket connection to the client
      // Cloudflare Workers requires status 101 for WebSocket responses
      console.log('[WS] Returning 101 response with client WebSocket...');
      return new Response(null, { status: 101, webSocket: client });

    } catch (wsError) {
      // WebSocket creation failed - this is a real error
      console.error('[WS] WebSocket creation error:', wsError, 'Stack:', wsError instanceof Error ? wsError.stack : 'N/A');

      return new Response(JSON.stringify({
        error: 'WebSocket upgrade failed',
        message: 'Unable to establish WebSocket connection. Please try again.',
        fallback: 'Use polling endpoints instead',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(request.headers.get('Origin'))
        }
      });
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(userId: string, data: string): Promise<void> {
    const session = this.sessions.get(userId);
    if (!session) return;

    session.lastActivity = new Date();

    try {
      const message: RealtimeMessage = JSON.parse(data);

      switch (message.type) {
        case 'ping':
          this.sendToUser(userId, {
            type: 'pong',
            payload: { timestamp: Date.now() },
            timestamp: new Date().toISOString()
          });
          break;

        case 'notification':
          await this.handleNotificationMessage(userId, message);
          break;

        case 'chat_message':
          await this.handleChatMessage(userId, message);
          break;

        case 'presence_update':
          await this.handlePresenceUpdate(userId, message);
          break;

        case 'typing_indicator':
          await this.handleTypingIndicator(userId, message);
          break;

        case 'dashboard_update':
          await this.handleDashboardUpdate(userId, message);
          break;

        case 'pitch_view_update':
          await this.handlePitchViewUpdate(userId, message);
          break;

        default:
          console.warn(`Unknown message type: ${message.type} from user ${userId}`);
      }
    } catch (error) {
      console.error(`Error parsing message from user ${userId}:`, error);
      this.sendToUser(userId, {
        type: 'notification',
        payload: {
          error: 'Invalid message format',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle notification messages
   */
  private async handleNotificationMessage(userId: string, message: RealtimeMessage): Promise<void> {
    const { targetUserId, notificationData } = message.payload;

    if (targetUserId) {
      // Send to specific user
      this.sendToUser(targetUserId, {
        type: 'notification',
        payload: {
          from: userId,
          data: notificationData,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      // Store notification in database
      try {
        await this.db.query(`
          INSERT INTO notifications (user_id, type, content, created_at)
          VALUES ($1, $2, $3, NOW())
        `, [targetUserId, 'realtime', JSON.stringify(notificationData)]);
      } catch (error) {
        console.error('Error storing notification:', error);
      }
    }
  }

  /**
   * Handle chat messages
   */
  private async handleChatMessage(userId: string, message: RealtimeMessage): Promise<void> {
    const { conversationId, content, participants } = message.payload;

    const chatMessage: RealtimeMessage = {
      type: 'chat_message',
      payload: {
        conversationId,
        senderId: userId,
        content,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    // Send to all participants
    if (participants && Array.isArray(participants)) {
      for (const participantId of participants) {
        if (participantId !== userId) { // Don't echo back to sender
          this.sendToUser(participantId, chatMessage);
        }
      }
    }
  }

  /**
   * Handle presence updates
   */
  private async handlePresenceUpdate(userId: string, message: RealtimeMessage): Promise<void> {
    const { status } = message.payload; // online, away, busy, offline

    await this.updateUserPresence(userId, status);

    // Broadcast presence to relevant channels
    const session = this.sessions.get(userId);
    if (session) {
      for (const channel of session.channels) {
        this.broadcastToChannel(channel, {
          type: 'presence_update',
          payload: {
            userId,
            status,
            timestamp: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        }, userId);
      }
    }
  }

  /**
   * Handle typing indicators
   */
  private async handleTypingIndicator(userId: string, message: RealtimeMessage): Promise<void> {
    const { conversationId, isTyping, participants } = message.payload;

    if (participants && Array.isArray(participants)) {
      for (const participantId of participants) {
        if (participantId !== userId) {
          this.sendToUser(participantId, {
            type: 'typing_indicator',
            payload: {
              conversationId,
              userId,
              isTyping,
              timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  /**
   * Handle dashboard updates
   */
  private async handleDashboardUpdate(userId: string, message: RealtimeMessage): Promise<void> {
    const { metrics, targetUsers } = message.payload;

    const updateMessage: RealtimeMessage = {
      type: 'dashboard_update',
      payload: {
        metrics,
        updatedBy: userId,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    if (targetUsers && Array.isArray(targetUsers)) {
      for (const targetUserId of targetUsers) {
        this.sendToUser(targetUserId, updateMessage);
      }
    }
  }

  /**
   * Handle pitch view updates
   */
  private async handlePitchViewUpdate(userId: string, message: RealtimeMessage): Promise<void> {
    const { pitchId, action, metadata } = message.payload;

    // Broadcast to interested users (e.g., pitch creator, team members)
    const updateMessage: RealtimeMessage = {
      type: 'pitch_view_update',
      payload: {
        pitchId,
        action, // viewed, liked, commented, etc.
        userId,
        metadata,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    // Get pitch owner and notify them
    try {
      const result = await this.db.query<{ creator_id: number }>(`
        SELECT creator_id FROM pitches WHERE id = $1
      `, [pitchId]);

      if (result && result.length > 0) {
        const creatorId = result[0].creator_id;
        if (creatorId.toString() !== userId) { // Don't notify creator of their own actions
          this.sendToUser(creatorId.toString(), updateMessage);
        }
      }
    } catch (error) {
      console.error('Error getting pitch creator for update:', error);
    }
  }

  /**
   * Send message to specific user
   */
  private sendToUser(userId: string, message: RealtimeMessage): boolean {
    const session = this.sessions.get(userId);
    if (session && session.websocket.readyState === 1) { // 1 is OPEN
      try {
        session.websocket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
        this.handleDisconnect(userId);
        return false;
      }
    }
    return false;
  }

  /**
   * Broadcast message to all users in a channel
   */
  private broadcastToChannel(channelId: string, message: RealtimeMessage, excludeUserId?: string): void {
    const channelUsers = this.channels.get(channelId);
    if (channelUsers) {
      for (const userId of channelUsers) {
        if (userId !== excludeUserId) {
          this.sendToUser(userId, message);
        }
      }
    }
  }

  /**
   * Subscribe user to a channel
   */
  public subscribeUserToChannel(userId: string, channelId: string): boolean {
    const session = this.sessions.get(userId);
    if (!session) return false;

    if (session.channels.size >= this.config.maxChannelsPerUser) {
      console.warn(`User ${userId} exceeded maximum channels limit`);
      return false;
    }

    // Add user to session channels
    session.channels.add(channelId);

    // Add user to global channel mapping
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Set());
    }
    this.channels.get(channelId)!.add(userId);

    return true;
  }

  /**
   * Unsubscribe user from a channel
   */
  public unsubscribeUserFromChannel(userId: string, channelId: string): boolean {
    const session = this.sessions.get(userId);
    if (session) {
      session.channels.delete(channelId);
    }

    const channelUsers = this.channels.get(channelId);
    if (channelUsers) {
      channelUsers.delete(userId);
      if (channelUsers.size === 0) {
        this.channels.delete(channelId);
      }
    }

    return true;
  }

  /**
   * Handle user disconnect
   */
  private async handleDisconnect(userId: string): Promise<void> {
    console.log(`User ${userId} disconnected from WebSocket`);

    const session = this.sessions.get(userId);
    if (!session) return;

    // Update presence to offline
    if (this.config.enablePresence) {
      await this.updateUserPresence(userId, 'offline');
    }

    // Remove from all channels
    for (const channelId of session.channels) {
      this.unsubscribeUserFromChannel(userId, channelId);
    }

    // Remove session
    this.sessions.delete(userId);

    console.log(`Cleaned up session for user ${userId}`);
  }

  /**
   * Update user presence
   */
  private async updateUserPresence(userId: string, status: string): Promise<void> {
    try {
      // Update in database
      await this.db.query(`
        INSERT INTO user_presence (user_id, status, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET status = $2, updated_at = NOW()
      `, [userId, status]);
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }

  /**
   * Start heartbeat to clean up stale connections
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();
      const staleUsers: string[] = [];

      for (const [userId, session] of this.sessions) {
        const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
        
        if (timeSinceActivity > this.config.sessionTimeout) {
          staleUsers.push(userId);
        } else {
          // Send ping to keep connection alive
          try {
            session.websocket.send(JSON.stringify({
              type: 'ping',
              payload: { timestamp: now.getTime() },
              timestamp: now.toISOString()
            }));
          } catch (error) {
            console.error(`Error sending ping to user ${userId}:`, error);
            staleUsers.push(userId);
          }
        }
      }

      // Clean up stale connections
      for (const userId of staleUsers) {
        this.handleDisconnect(userId);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Get service statistics
   */
  public getStats(): object {
    return {
      activeSessions: this.sessions.size,
      activeChannels: this.channels.size,
      totalChannelSubscriptions: Array.from(this.channels.values()).reduce((sum, users) => sum + users.size, 0),
      config: this.config,
      uptime: Math.floor((Date.now() - this.startTime) / 1000) // Uptime in seconds
    };
  }

  /**
   * Broadcast system message to all connected users
   */
  public broadcastSystemMessage(message: string, type: string = 'system'): void {
    const systemMessage: RealtimeMessage = {
      type: 'notification',
      payload: {
        type,
        message,
        timestamp: new Date().toISOString(),
        system: true
      },
      timestamp: new Date().toISOString()
    };

    for (const userId of this.sessions.keys()) {
      this.sendToUser(userId, systemMessage);
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all WebSocket connections
    for (const [userId, session] of this.sessions) {
      try {
        session.websocket.close();
      } catch (error) {
        console.error(`Error closing WebSocket for user ${userId}:`, error);
      }
    }

    this.sessions.clear();
    this.channels.clear();
  }
}