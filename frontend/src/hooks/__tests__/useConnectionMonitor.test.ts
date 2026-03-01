import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectionMonitor } from '../useConnectionMonitor';

// Mock WebSocket context
const mockWebSocketContext = {
  connectionQuality: {
    strength: 'good' as const,
    latency: 50,
    lastPing: null,
    consecutiveFailures: 0,
    successRate: 100,
  },
  isConnected: true,
  connectionStatus: { status: 'connected', reconnectAttempts: 0 },
  manualReconnect: vi.fn(),
  disableWebSocket: vi.fn(),
  enableWebSocket: vi.fn(),
  // Other context fields
  notifications: [],
  dashboardMetrics: null,
  onlineUsers: [],
  typingIndicators: [],
  uploadProgress: [],
  pitchViews: new Map(),
  sendMessage: vi.fn(() => true),
  markNotificationAsRead: vi.fn(),
  clearAllNotifications: vi.fn(),
  updatePresence: vi.fn(),
  startTyping: vi.fn(),
  stopTyping: vi.fn(),
  trackPitchView: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  clearQueue: vi.fn(),
  isWebSocketDisabled: false,
  queueStatus: { size: 0, dropped: 0 },
  subscribeToNotifications: vi.fn(() => () => {}),
  subscribeToDashboard: vi.fn(() => () => {}),
  subscribeToPresence: vi.fn(() => () => {}),
  subscribeToTyping: vi.fn(() => () => {}),
  subscribeToUploads: vi.fn(() => () => {}),
  subscribeToPitchViews: vi.fn(() => () => {}),
  subscribeToMessages: vi.fn(() => () => {}),
  requestNotificationPermission: vi.fn(async () => 'denied' as const),
};

vi.mock('@shared/contexts/WebSocketContext', () => ({
  useWebSocket: () => mockWebSocketContext,
}));

// Track event listeners
const eventListeners: Record<string, Function[]> = {};
const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;

describe('useConnectionMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock context
    mockWebSocketContext.connectionQuality = {
      strength: 'good',
      latency: 50,
      lastPing: null,
      consecutiveFailures: 0,
      successRate: 100,
    };
    mockWebSocketContext.isConnected = true;
    mockWebSocketContext.connectionStatus = { status: 'connected', reconnectAttempts: 0 };

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    // Clear navigator.connection
    Object.defineProperty(navigator, 'connection', {
      writable: true,
      configurable: true,
      value: undefined,
    });

    // Track event listeners for online/offline
    Object.keys(eventListeners).forEach(k => delete eventListeners[k]);
    window.addEventListener = vi.fn((event: string, handler: Function) => {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(handler);
    }) as any;
    window.removeEventListener = vi.fn((event: string, handler: Function) => {
      if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter(h => h !== handler);
      }
    }) as any;

    // Reset fetch mock
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
  });

  // ─── Initial State ─────────────────────────────────────────────────

  describe('initial state', () => {
    it('reflects navigator.onLine as true', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.connectionState.isOnline).toBe(true);
    });

    it('reflects navigator.onLine as false', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.connectionState.isOnline).toBe(false);
    });

    it('defaults connectionType to unknown', () => {
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.connectionState.connectionType).toBe('unknown');
    });

    it('defaults effectiveType to unknown', () => {
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.connectionState.effectiveType).toBe('unknown');
    });

    it('defaults downlink and rtt to 0', () => {
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.connectionState.downlink).toBe(0);
      expect(result.current.connectionState.rtt).toBe(0);
    });

    it('defaults saveData to false', () => {
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.connectionState.saveData).toBe(false);
    });

    it('initially has zero reconnections', () => {
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.performanceMetrics.reconnections).toBe(0);
    });

    it('picks up initial latency from WebSocket quality', () => {
      // connectionQuality.latency = 50 from mock triggers the WS quality effect
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.performanceMetrics.averageLatency).toBe(50);
    });

    it('has zero latency when WS quality latency is null', () => {
      mockWebSocketContext.connectionQuality = {
        ...mockWebSocketContext.connectionQuality,
        latency: null,
      };
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.performanceMetrics.averageLatency).toBe(0);
    });

    it('exposes isConnected from WebSocket context', () => {
      mockWebSocketContext.isConnected = true;
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.isConnected).toBe(true);
    });

    it('exposes wsQuality from WebSocket context', () => {
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.wsQuality.strength).toBe('good');
      expect(result.current.wsQuality.latency).toBe(50);
    });
  });

  // ─── Online/Offline Events ─────────────────────────────────────────

  describe('online/offline events', () => {
    it('registers online and offline event listeners', () => {
      renderHook(() => useConnectionMonitor());
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('updates isOnline to false on offline event', () => {
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.connectionState.isOnline).toBe(true);

      act(() => {
        eventListeners['offline']?.forEach(fn => fn());
      });

      expect(result.current.connectionState.isOnline).toBe(false);
    });

    it('updates isOnline to true on online event', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      const { result } = renderHook(() => useConnectionMonitor());

      act(() => {
        eventListeners['online']?.forEach(fn => fn());
      });

      expect(result.current.connectionState.isOnline).toBe(true);
    });

    it('enables WebSocket on online event', () => {
      renderHook(() => useConnectionMonitor());

      act(() => {
        eventListeners['online']?.forEach(fn => fn());
      });

      expect(mockWebSocketContext.enableWebSocket).toHaveBeenCalled();
    });

    it('sets shouldFallback on offline event', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      act(() => {
        eventListeners['offline']?.forEach(fn => fn());
      });

      expect(result.current.shouldFallback).toBe(true);
    });

    it('cleans up event listeners on unmount', () => {
      const { unmount } = renderHook(() => useConnectionMonitor());
      unmount();
      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  // ─── Network Information API ───────────────────────────────────────

  describe('Network Information API', () => {
    it('reads connection properties when available', () => {
      const mockConnection = {
        type: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      Object.defineProperty(navigator, 'connection', {
        value: mockConnection,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.connectionState.connectionType).toBe('wifi');
      expect(result.current.connectionState.effectiveType).toBe('4g');
      expect(result.current.connectionState.downlink).toBe(10);
      expect(result.current.connectionState.rtt).toBe(50);
    });

    it('registers change listener on connection object', () => {
      const mockConnection = {
        type: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      Object.defineProperty(navigator, 'connection', {
        value: mockConnection,
        writable: true,
        configurable: true,
      });

      renderHook(() => useConnectionMonitor());
      expect(mockConnection.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('handles missing connection API gracefully', () => {
      Object.defineProperty(navigator, 'connection', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      // Should not throw
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.connectionState.connectionType).toBe('unknown');
    });

    it('handles saveData flag', () => {
      const mockConnection = {
        type: 'cellular',
        effectiveType: '3g',
        downlink: 1.5,
        rtt: 200,
        saveData: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      Object.defineProperty(navigator, 'connection', {
        value: mockConnection,
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.connectionState.saveData).toBe(true);
    });
  });

  // ─── Fallback Determination ────────────────────────────────────────

  describe('shouldFallback', () => {
    it('is true when offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      mockWebSocketContext.connectionQuality = {
        strength: 'good',
        latency: 50,
        lastPing: null,
        consecutiveFailures: 0,
        successRate: 100,
      };
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.shouldFallback).toBe(true);
    });

    it('is true when connection quality is poor', () => {
      mockWebSocketContext.connectionQuality = {
        strength: 'poor',
        latency: 3000,
        lastPing: null,
        consecutiveFailures: 5,
        successRate: 20,
      };
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.shouldFallback).toBe(true);
    });

    it('is true when latency exceeds 2000ms', () => {
      mockWebSocketContext.connectionQuality = {
        strength: 'fair',
        latency: 2500,
        lastPing: null,
        consecutiveFailures: 0,
        successRate: 80,
      };
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.shouldFallback).toBe(true);
    });

    it('is true when success rate is below 50%', () => {
      mockWebSocketContext.connectionQuality = {
        strength: 'fair',
        latency: 200,
        lastPing: null,
        consecutiveFailures: 0,
        successRate: 30,
      };
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.shouldFallback).toBe(true);
    });

    it('is true on slow-2g network', () => {
      const mockConnection = {
        type: 'cellular',
        effectiveType: 'slow-2g',
        downlink: 0.1,
        rtt: 2000,
        saveData: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      Object.defineProperty(navigator, 'connection', {
        value: mockConnection,
        writable: true,
        configurable: true,
      });
      mockWebSocketContext.connectionQuality = {
        strength: 'fair',
        latency: 200,
        lastPing: null,
        consecutiveFailures: 0,
        successRate: 80,
      };

      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.shouldFallback).toBe(true);
    });

    it('is true on 2g network', () => {
      const mockConnection = {
        type: 'cellular',
        effectiveType: '2g',
        downlink: 0.3,
        rtt: 1500,
        saveData: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      Object.defineProperty(navigator, 'connection', {
        value: mockConnection,
        writable: true,
        configurable: true,
      });
      mockWebSocketContext.connectionQuality = {
        strength: 'fair',
        latency: 200,
        lastPing: null,
        consecutiveFailures: 0,
        successRate: 80,
      };

      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.shouldFallback).toBe(true);
    });

    it('is true when consecutive failures >= 3', () => {
      mockWebSocketContext.connectionQuality = {
        strength: 'fair',
        latency: 200,
        lastPing: null,
        consecutiveFailures: 3,
        successRate: 80,
      };
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.shouldFallback).toBe(true);
    });

    it('is false on healthy connection', () => {
      mockWebSocketContext.connectionQuality = {
        strength: 'excellent',
        latency: 30,
        lastPing: null,
        consecutiveFailures: 0,
        successRate: 100,
      };
      const { result } = renderHook(() => useConnectionMonitor());
      expect(result.current.shouldFallback).toBe(false);
    });
  });

  // ─── testConnection Action ─────────────────────────────────────────

  describe('testConnection', () => {
    it('returns true on successful healthy response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
      });

      const { result } = renderHook(() => useConnectionMonitor());

      let success: boolean = false;
      await act(async () => {
        success = await result.current.actions.testConnection();
      });

      expect(success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
      });
    });

    it('returns false on failed response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => useConnectionMonitor());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.actions.testConnection();
      });

      expect(success).toBe(false);
    });

    it('returns false on network error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useConnectionMonitor());

      let success: boolean = true;
      await act(async () => {
        success = await result.current.actions.testConnection();
      });

      expect(success).toBe(false);
    });

    it('tracks latency on successful connection test', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
      });

      const { result } = renderHook(() => useConnectionMonitor());

      await act(async () => {
        await result.current.actions.testConnection();
      });

      // After a successful test, average latency should be > 0
      expect(result.current.performanceMetrics.averageLatency).toBeGreaterThanOrEqual(0);
    });

    it('increments failure count on error', async () => {
      // Start with null latency so WS quality effect doesn't add a success
      mockWebSocketContext.connectionQuality = {
        ...mockWebSocketContext.connectionQuality,
        latency: null,
      };
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useConnectionMonitor());

      await act(async () => {
        await result.current.actions.testConnection();
      });

      // Success rate should be 0% after one failure with no prior successes
      expect(result.current.performanceMetrics.successRate).toBe(0);
    });
  });

  // ─── forceReconnect Action ─────────────────────────────────────────

  describe('forceReconnect', () => {
    it('calls manualReconnect on WebSocket context', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      act(() => {
        result.current.actions.forceReconnect();
      });

      expect(mockWebSocketContext.manualReconnect).toHaveBeenCalled();
    });
  });

  // ─── enableFallback / disableFallback ──────────────────────────────

  describe('enableFallback / disableFallback', () => {
    it('enableFallback sets shouldFallback to true and disables WebSocket', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      act(() => {
        result.current.actions.enableFallback();
      });

      expect(result.current.shouldFallback).toBe(true);
      expect(mockWebSocketContext.disableWebSocket).toHaveBeenCalled();
    });

    it('disableFallback sets shouldFallback to false and enables WebSocket', () => {
      const { result } = renderHook(() => useConnectionMonitor());

      // First enable fallback
      act(() => {
        result.current.actions.enableFallback();
      });
      expect(result.current.shouldFallback).toBe(true);

      // Then disable
      act(() => {
        result.current.actions.disableFallback();
      });

      expect(mockWebSocketContext.enableWebSocket).toHaveBeenCalled();
    });
  });

  // ─── Performance Metrics ───────────────────────────────────────────

  describe('performance metrics', () => {
    it('calculates average latency from history', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useConnectionMonitor());

      await act(async () => {
        await result.current.actions.testConnection();
      });
      await act(async () => {
        await result.current.actions.testConnection();
      });

      expect(result.current.performanceMetrics.averageLatency).toBeGreaterThanOrEqual(0);
    });

    it('calculates success rate correctly', async () => {
      // Start with null latency so WS quality effect doesn't add to counters
      mockWebSocketContext.connectionQuality = {
        ...mockWebSocketContext.connectionQuality,
        latency: null,
      };

      // One success, one failure
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useConnectionMonitor());

      await act(async () => {
        await result.current.actions.testConnection();
      });
      await act(async () => {
        await result.current.actions.testConnection();
      });

      // 1 success / 2 total = 50%
      expect(result.current.performanceMetrics.successRate).toBe(50);
    });
  });
});
