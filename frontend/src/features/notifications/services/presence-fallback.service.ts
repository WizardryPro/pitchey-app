/**
 * Fallback Presence Service
 * Provides presence detection using HTTP polling when WebSocket is unavailable
 */


const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? (isDev ? 'http://localhost:8001' : '');

interface PresenceData {
  userId: number;
  username: string;
  status: 'online' | 'away' | 'offline' | 'dnd';
  lastSeen: Date;
  activity?: string;
}

interface PresenceUpdateData {
  status: 'online' | 'away' | 'offline' | 'dnd';
  activity?: string;
}

class PresenceFallbackService {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL = 30000; // Poll every 30 seconds
  private readonly HEARTBEAT_INTERVAL = 60000; // Send heartbeat every 60 seconds
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private isPolling = false;
  private consecutiveFailures = 0;
  private readonly subscribers: ((users: PresenceData[]) => void)[] = [];
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentStatus: 'online' | 'away' | 'offline' | 'dnd' = 'offline';
  private currentActivity?: string;

  /**
   * Start presence polling and heartbeat
   */
  start(): void {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.consecutiveFailures = 0;
    this.currentStatus = 'online';

    // Start polling for presence updates
    this.pollInterval = setInterval(() => {
      void this.fetchPresence();
    }, this.POLL_INTERVAL);

    // Start heartbeat to maintain presence
    this.startHeartbeat();

    // Initial fetch
    void this.fetchPresence();
  }

  /**
   * Stop presence polling and heartbeat
   */
  stop(): void {
    const wasPolling = this.isPolling;
    this.isPolling = false;
    this.currentStatus = 'offline';

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    // Only try to send offline status if the service was running successfully
    // (i.e. not stopped due to endpoint failures)
    if (wasPolling && this.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES) {
      // fire-and-forget: best-effort offline ping while tearing down
      this.updatePresence({ status: 'offline' }).catch(() => {});
    }
  }

  /**
   * Update user presence status
   * Uses session cookies for authentication (credentials: 'include')
   */
  async updatePresence(data: PresenceUpdateData): Promise<boolean> {
    try {
      // Use session cookies for authentication - no token needed
      const response = await fetch(`${API_BASE_URL}/api/presence/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (response.status === 401 || response.status === 403) {
        // Session expired — stop polling silently instead of spamming errors
        this.stop();
        return false;
      }

      // Endpoint doesn't exist — stop immediately to avoid infinite retries
      if (response.status === 404 || response.status === 405) {
        this.stop();
        return false;
      }

      if (!response.ok) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          console.warn('Presence update: too many failures, stopping service');
          this.stop();
        }
        return false;
      }

      // Verify we got JSON back (Pages SPA fallback returns HTML for unknown routes)
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          console.warn('Presence update: endpoint returning non-JSON, stopping service');
          this.stop();
        }
        return false;
      }

      const result = await response.json() as { success: boolean };
      this.consecutiveFailures = 0; // Reset on success
      if (result.success) {
        this.currentStatus = data.status;
        this.currentActivity = data.activity;
        return true;
      } else {
        return false;
      }
    } catch (_error) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        console.warn('Presence update: too many failures, stopping service');
        this.stop();
      }
      return false;
    }
  }

  /**
   * Fetch current online users
   * Uses session cookies for authentication (credentials: 'include')
   */
  async fetchPresence(): Promise<PresenceData[]> {
    try {
      // Use session cookies for authentication - no token needed
      const response = await fetch(`${API_BASE_URL}/api/presence/online`, {
        method: 'GET',
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (response.status === 401 || response.status === 403) {
        this.stop();
        return [];
      }

      // Endpoint doesn't exist — stop immediately to avoid infinite retries
      if (response.status === 404 || response.status === 405) {
        this.stop();
        return [];
      }

      if (!response.ok) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          console.warn('Presence fetch: too many failures, stopping service');
          this.stop();
        }
        return [];
      }

      // Verify we got JSON back (Pages SPA fallback returns HTML for unknown routes)
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          console.warn('Presence fetch: endpoint returning non-JSON, stopping service');
          this.stop();
        }
        return [];
      }

      type RawUser = Omit<PresenceData, 'lastSeen'> & { lastSeen: string };
      const result = await response.json() as { success: boolean; data?: { users?: RawUser[] } };
      this.consecutiveFailures = 0; // Reset on success
      if (result.success && result.data != null) {
        const users: PresenceData[] = (result.data.users ?? []).map((user: RawUser) => ({
          ...user,
          lastSeen: new Date(user.lastSeen),
        }));

        // Notify subscribers
        this.subscribers.forEach(callback => {
          try {
            callback(users);
          } catch (error) {
            const e = error instanceof Error ? error : new Error(String(error));
            console.error('Error in presence subscriber:', e.message);
          }
        });

        return users;
      } else {
        return [];
      }
    } catch (_error) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        console.warn('Presence fetch: too many failures, stopping service');
        this.stop();
      }
      return [];
    }
  }

  /**
   * Subscribe to presence updates
   */
  subscribe(callback: (users: PresenceData[]) => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Start heartbeat to maintain online status
   */
  private startHeartbeat(): void {
    const sendHeartbeat = () => {
      if (!this.isPolling) return; // Service was stopped — don't reschedule

      if (this.currentStatus !== 'offline') {
        void this.updatePresence({
          status: this.currentStatus,
          activity: this.currentActivity
        });
      }

      // Only schedule next heartbeat if service is still running
      if (this.isPolling) {
        this.heartbeatTimeout = setTimeout(sendHeartbeat, this.HEARTBEAT_INTERVAL);
      }
    };

    void sendHeartbeat();
  }

  /**
   * Get current status
   */
  getCurrentStatus(): { status: string; activity?: string } {
    return {
      status: this.currentStatus,
      activity: this.currentActivity,
    };
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.isPolling;
  }

  /**
   * Test WebSocket availability
   * Uses session cookies for authentication (credentials: 'include')
   */
  async testWebSocketAvailability(): Promise<{ available: boolean; error?: string }> {
    try {
      // Use session cookies for authentication - no token needed
      const response = await fetch(`${API_BASE_URL}/api/ws/health`, {
        method: 'GET',
        credentials: 'include' // Send cookies for Better Auth session
      });

      if (!response.ok) {
        return { available: false, error: `WebSocket test failed: ${response.status}` };
      }

      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        return { available: false, error: 'Endpoint returned non-JSON response' };
      }

      const result = await response.json() as { websocketAvailable: boolean; error?: string };
      return {
        available: result.websocketAvailable === true,
        error: result.websocketAvailable ? undefined : result.error,
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const presenceFallbackService = new PresenceFallbackService();

export default presenceFallbackService;