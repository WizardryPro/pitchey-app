import { apiClient } from '../lib/api-client';
import type { WebSocketMessage } from '@shared/types/websocket';

interface PollingConfig {
  interval: number;
  maxRetries: number;
  backoffMultiplier: number;
  endpoints: string[];
}

class PollingService {
  private static instance: PollingService;
  private pollingIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private retryCounters: Map<string, number> = new Map();
  private isActive: boolean = false;
  private lastPollTimes: Map<string, number> = new Map();
  private messageHandlers: Set<(message: WebSocketMessage) => void> = new Set();
  private visibilityHandler: (() => void) | null = null;
  private pausedByVisibility: boolean = false;

  private config: PollingConfig = {
    interval: 15000, // 15 seconds base interval (was 5s — reduced Sentry transaction volume)
    maxRetries: 3,
    backoffMultiplier: 2,
    endpoints: [
      '/api/poll/all', // Main polling endpoint that returns all updates
      '/api/notifications/unread',
      '/api/analytics/realtime'
    ]
  };

  private constructor() {
    // Pause polling when tab is hidden to reduce unnecessary traffic
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.hidden) {
          if (this.isActive) {
            this.pausedByVisibility = true;
            this.stopIntervals();
          }
        } else {
          if (this.pausedByVisibility) {
            this.pausedByVisibility = false;
            this.resumeIntervals();
          }
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  static getInstance(): PollingService {
    if (!PollingService.instance) {
      PollingService.instance = new PollingService();
    }
    return PollingService.instance;
  }

  public start(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    
    // Start polling for each endpoint
    this.config.endpoints.forEach(endpoint => {
      this.startPolling(endpoint);
    });
  }

  public stop(): void {
    this.isActive = false;
    this.pausedByVisibility = false;
    this.stopIntervals();
    this.retryCounters.clear();
    this.lastPollTimes.clear();
  }

  private stopIntervals(): void {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals.clear();
  }

  private resumeIntervals(): void {
    if (!this.isActive) return;
    this.config.endpoints.forEach(endpoint => {
      this.startPolling(endpoint);
    });
  }

  public addMessageHandler(handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.add(handler);
  }

  public removeMessageHandler(handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.delete(handler);
  }

  private startPolling(endpoint: string): void {
    // Clear any existing interval for this endpoint
    const existingInterval = this.pollingIntervals.get(endpoint);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Calculate interval with backoff
    const retryCount = this.retryCounters.get(endpoint) || 0;
    const interval = Math.min(
      this.config.interval * Math.pow(this.config.backoffMultiplier, retryCount),
      60000 // Max 1 minute
    );

    // Set up polling interval
    const pollInterval = setInterval(async () => {
      if (!this.isActive) {
        clearInterval(pollInterval);
        return;
      }

      try {
        await this.pollEndpoint(endpoint);
        // Reset retry counter on success
        this.retryCounters.set(endpoint, 0);
      } catch (error) {
        console.error(`Polling error for ${endpoint}:`, error);
        this.handlePollingError(endpoint);
      }
    }, interval);

    this.pollingIntervals.set(endpoint, pollInterval);
    
    // Initial poll
    this.pollEndpoint(endpoint).catch(error => {
      console.error(`Initial poll error for ${endpoint}:`, error);
    });
  }

  private async pollEndpoint(endpoint: string): Promise<void> {
    const lastPollTime = this.lastPollTimes.get(endpoint) || 0;
    const now = Date.now();

    // Add timestamp to avoid caching issues
    const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}since=${lastPollTime}&t=${now}`;

    try {
      const response = await apiClient.get(url);

      if (response.data) {
        this.processPollingResponse(endpoint, response.data);
        this.lastPollTimes.set(endpoint, now);
      }
    } catch (error: unknown) {
      const status = (error as any)?.response?.status;
      // Don't treat 404/405 as retriable errors — endpoint doesn't exist
      if (status === 404 || status === 405) {
        // Stop polling this endpoint permanently
        this.retryCounters.set(endpoint, this.config.maxRetries);
        const interval = this.pollingIntervals.get(endpoint);
        if (interval) {
          clearInterval(interval);
          this.pollingIntervals.delete(endpoint);
        }
        return;
      }
      throw error;
    }
  }

  private processPollingResponse(endpoint: string, data: any): void {
    // Convert polling response to WebSocket-style messages
    if (endpoint === '/api/poll/all') {
      // Handle comprehensive polling response
      if (data.notifications) {
        data.notifications.forEach((notification: any) => {
          this.emitMessage({
            type: 'notification',
            data: notification,
            timestamp: new Date().toISOString()
          });
        });
      }

      if (data.dashboardMetrics) {
        this.emitMessage({
          type: 'dashboard_update',
          data: data.dashboardMetrics,
          timestamp: new Date().toISOString()
        });
      }

      if (data.presence) {
        this.emitMessage({
          type: 'presence_update',
          data: data.presence,
          timestamp: new Date().toISOString()
        });
      }

      if (data.messages) {
        data.messages.forEach((message: any) => {
          this.emitMessage({
            type: 'message',
            data: message,
            timestamp: new Date().toISOString()
          });
        });
      }
    } else if (endpoint === '/api/notifications/unread') {
      // Handle unread notifications count
      if (typeof data === 'number' || data.count !== undefined) {
        this.emitMessage({
          type: 'notification_count',
          data: { count: typeof data === 'number' ? data : data.count },
          timestamp: new Date().toISOString()
        });
      }
    } else if (endpoint === '/api/analytics/realtime') {
      // Handle real-time analytics
      this.emitMessage({
        type: 'analytics_update',
        data: data,
        timestamp: new Date().toISOString()
      });
    }
  }

  private emitMessage(message: WebSocketMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  private handlePollingError(endpoint: string): void {
    const retryCount = (this.retryCounters.get(endpoint) || 0) + 1;
    this.retryCounters.set(endpoint, retryCount);

    if (retryCount >= this.config.maxRetries) {
      console.error(`Max retries reached for ${endpoint}, stopping polling`);
      const interval = this.pollingIntervals.get(endpoint);
      if (interval) {
        clearInterval(interval);
        this.pollingIntervals.delete(endpoint);
      }
      
      // Emit error message
      this.emitMessage({
        type: 'error',
        data: {
          message: `Polling failed for ${endpoint}`,
          endpoint,
          retryCount
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // Restart with backoff
      this.startPolling(endpoint);
    }
  }

  public isPollingActive(): boolean {
    return this.isActive;
  }

  public getPollingStatus(): { endpoint: string; lastPoll: number; retries: number }[] {
    return Array.from(this.pollingIntervals.keys()).map(endpoint => ({
      endpoint,
      lastPoll: this.lastPollTimes.get(endpoint) || 0,
      retries: this.retryCounters.get(endpoint) || 0
    }));
  }
}

export const pollingService = PollingService.getInstance();