import { useEffect, useRef, useState, useCallback } from 'react';
import { config } from '../config';
import { useBetterAuthStore } from '../store/betterAuthStore';
import type { 
  WebSocketMessage, 
  ConnectionStatus, 
  MessageQueueStatus,
  ConnectionQuality,
  ReconnectionConfig,
  HeartbeatConfig
} from '../types/websocket';

interface UseWebSocketAdvancedOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onReconnect?: (attempt: number) => void;
  onConnectionQualityChange?: (quality: ConnectionQuality) => void;
  autoConnect?: boolean;
  reconnection?: Partial<ReconnectionConfig>;
  heartbeat?: Partial<HeartbeatConfig>;
  maxQueueSize?: number;
  enablePersistence?: boolean;
  rateLimit?: {
    maxMessages: number;
    windowMs: number;
  };
  // Legacy support (deprecated)
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
}

interface QueuedMessage extends WebSocketMessage {
  queuedAt: number;
  attempts: number;
  retryAfter?: number;
  persistenceKey?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

interface ConnectionAttempt {
  timestamp: number;
  success: boolean;
  latency?: number;
  error?: string;
}

interface HeartbeatState {
  lastPing: Date | null;
  lastPong: Date | null;
  missedCount: number;
  intervalId: number | null;
  timeoutId: number | null;
}

interface RateLimitState {
  messages: number;
  windowStart: number;
  blocked: boolean;
  nextReset: number;
}

const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  enabled: true,
  maxAttempts: 10,
  initialDelay: 1000,  // Start at 1 second
  maxDelay: 30000,     // Max 30 seconds
  backoffFactor: 2,    // Exponential backoff
  jitter: true         // Add randomness to prevent thundering herd
};

const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  enabled: true,
  interval: 30000,     // 30 seconds
  timeout: 10000,      // 10 second timeout
  maxMissed: 3         // 3 missed heartbeats = disconnect
};

const DEFAULT_OPTIONS: Required<Omit<UseWebSocketAdvancedOptions, 'reconnection' | 'heartbeat' | 'onConnectionQualityChange' | 'maxReconnectAttempts' | 'reconnectInterval' | 'maxReconnectInterval'>> = {
  onMessage: () => {},
  onConnect: () => {},
  onDisconnect: () => {},
  onError: () => {},
  onReconnect: () => {},
  autoConnect: false, // CRITICAL: Default to false for security - require explicit opt-in
  maxQueueSize: 100,
  enablePersistence: true,
  rateLimit: {
    maxMessages: 60,
    windowMs: 60000,
  },
};

const STORAGE_KEYS = {
  QUEUE: 'pitchey_ws_queue',
  RATE_LIMIT: 'pitchey_ws_ratelimit',
  CIRCUIT_BREAKER: 'pitchey_ws_circuit_breaker',
  PERSISTENT_QUEUE: 'pitchey_ws_persistent_queue',
  CONNECTION_HISTORY: 'pitchey_ws_connection_history',
  QUALITY_METRICS: 'pitchey_ws_quality_metrics',
};

interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttemptTime: number;
}

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 3,  // Open circuit after 3 consecutive failures
  openStateDuration: 300000,  // Stay open for 5 minutes
  halfOpenMaxAttempts: 1,  // Only 1 attempt in half-open state
};

// WebSocket is ENABLED with Cloudflare Workers paid plan (Durable Objects available)
const WEBSOCKET_ENABLED = true;

export function useWebSocketAdvanced(options: UseWebSocketAdvancedOptions = {}) {
  // Get authentication state from Better Auth
  const { user, isAuthenticated } = useBetterAuthStore();
  
  // Merge configs with legacy support
  const reconnectionConfig: ReconnectionConfig = {
    ...DEFAULT_RECONNECTION_CONFIG,
    ...options.reconnection,
    // Legacy support
    ...(options.maxReconnectAttempts && { maxAttempts: options.maxReconnectAttempts }),
    ...(options.reconnectInterval && { initialDelay: options.reconnectInterval }),
    ...(options.maxReconnectInterval && { maxDelay: options.maxReconnectInterval }),
  };
  
  const heartbeatConfig: HeartbeatConfig = {
    ...DEFAULT_HEARTBEAT_CONFIG,
    ...options.heartbeat,
  };
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Enhanced state with quality tracking
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connecting: false,
    reconnecting: false,
    disconnecting: false,
    lastConnected: null,
    lastDisconnected: null,
    reconnectAttempts: 0,
    error: null,
    state: 'disconnected',
    quality: {
      strength: 'good',
      latency: null,
      lastPing: null,
      consecutiveFailures: 0,
      successRate: 100,
    },
  });
  
  const [queueStatus, setQueueStatus] = useState<MessageQueueStatus>({
    queued: 0,
    maxQueue: opts.maxQueueSize,
    dropped: 0,
    rateLimited: 0,
    persistent: 0,
    pending: 0,
  });
  
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  // Enhanced refs with reliability features
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const messageQueueRef = useRef<QueuedMessage[]>([]);
  const persistentQueueRef = useRef<QueuedMessage[]>([]);
  const connectionHistoryRef = useRef<ConnectionAttempt[]>([]);
  const heartbeatStateRef = useRef<HeartbeatState>({
    lastPing: null,
    lastPong: null,
    missedCount: 0,
    intervalId: null,
    timeoutId: null,
  });
  const rateLimitRef = useRef<RateLimitState>({
    messages: 0,
    windowStart: Date.now(),
    blocked: false,
    nextReset: Date.now() + opts.rateLimit.windowMs,
  });
  const circuitBreakerRef = useRef<CircuitBreakerState>({
    failureCount: 0,
    lastFailureTime: 0,
    state: 'closed',
    nextAttemptTime: 0,
  });
  const reconnectAttemptRef = useRef<number>(0);
  const lastReconnectTimeRef = useRef<number>(0);
  const pingIntervalRef = useRef<number | undefined>();
  
  // Update queue status - moved up to fix initialization order
  const updateQueueStatus = useCallback(() => {
    setQueueStatus(prev => ({
      ...prev,
      queued: messageQueueRef.current.length,
    }));
  }, []);
  
  // Enhanced reliability functions
  
  // Connection quality assessment
  const updateConnectionQuality = useCallback((success: boolean, latency?: number) => {
    const history = connectionHistoryRef.current;
    const now = Date.now();
    
    // Add to history
    history.push({
      timestamp: now,
      success,
      latency,
    });
    
    // Keep only last 10 attempts
    if (history.length > 10) {
      history.shift();
    }
    
    // Calculate success rate
    const successCount = history.filter(attempt => attempt.success).length;
    const successRate = history.length > 0 ? (successCount / history.length) * 100 : 0;
    
    // Calculate average latency
    const latencyHistory = history
      .filter(attempt => attempt.latency !== undefined)
      .map(attempt => attempt.latency!);
    const avgLatency = latencyHistory.length > 0 
      ? latencyHistory.reduce((sum, lat) => sum + lat, 0) / latencyHistory.length 
      : null;
    
    // Determine connection strength
    // Thresholds are for heartbeat ping/pong round-trip over the internet
    let strength: ConnectionQuality['strength'] = 'poor';
    if (successRate >= 90 && (avgLatency === null || avgLatency < 500)) {
      strength = 'excellent';
    } else if (successRate >= 70 && (avgLatency === null || avgLatency < 1500)) {
      strength = 'good';
    } else if (successRate >= 50 && (avgLatency === null || avgLatency < 3000)) {
      strength = 'fair';
    }
    
    const quality: ConnectionQuality = {
      strength,
      latency: avgLatency,
      lastPing: heartbeatStateRef.current.lastPing,
      consecutiveFailures: success ? 0 : connectionHistoryRef.current
        .slice(-5)
        .filter(attempt => !attempt.success).length,
      successRate,
    };
    
    setConnectionStatus(prev => ({
      ...prev,
      quality,
    }));
    
    if (options.onConnectionQualityChange) {
      options.onConnectionQualityChange(quality);
    }
    
    // Persist quality metrics
    if (opts.enablePersistence) {
      try {
        localStorage.setItem(STORAGE_KEYS.QUALITY_METRICS, JSON.stringify(quality));
        localStorage.setItem(STORAGE_KEYS.CONNECTION_HISTORY, JSON.stringify(history.slice(-20)));
      } catch (error) {
        console.warn('Failed to persist connection quality metrics:', error);
      }
    }
  }, [opts.enablePersistence, options.onConnectionQualityChange]);
  
  // Enhanced exponential backoff with jitter
  const calculateReconnectDelay = useCallback((attempt: number): number => {
    const config = reconnectionConfig;
    let delay = Math.min(
      config.initialDelay * Math.pow(config.backoffFactor, attempt),
      config.maxDelay
    );
    
    // Add jitter to prevent thundering herd problem
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.max(delay, config.initialDelay);
  }, [reconnectionConfig]);
  
  // Heartbeat management
  const startHeartbeat = useCallback(() => {
    if (!heartbeatConfig.enabled || heartbeatStateRef.current.intervalId) {
      return;
    }
    
    const heartbeat = heartbeatStateRef.current;
    
    heartbeat.intervalId = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pingTime = Date.now();
        heartbeat.lastPing = new Date(pingTime);
        
        try {
          wsRef.current.send(JSON.stringify({
            type: 'ping',
            timestamp: new Date(pingTime).toISOString(),
            id: `ping_${pingTime}`,
          }));
          
          // Set timeout for pong response
          heartbeat.timeoutId = window.setTimeout(() => {
            heartbeat.missedCount++;
            updateConnectionQuality(false);
            
            if (heartbeat.missedCount >= heartbeatConfig.maxMissed) {
              console.warn('Heartbeat timeout - connection appears dead');
              disconnect();
              if (reconnectionConfig.enabled) {
                connect();
              }
            }
          }, heartbeatConfig.timeout);
          
        } catch (error) {
          console.error('Failed to send heartbeat:', error);
          heartbeat.missedCount++;
          updateConnectionQuality(false);
        }
      }
    }, heartbeatConfig.interval);
  }, [heartbeatConfig, reconnectionConfig.enabled, updateConnectionQuality]);
  
  const stopHeartbeat = useCallback(() => {
    const heartbeat = heartbeatStateRef.current;
    
    if (heartbeat.intervalId) {
      clearInterval(heartbeat.intervalId);
      heartbeat.intervalId = null;
    }
    
    if (heartbeat.timeoutId) {
      clearTimeout(heartbeat.timeoutId);
      heartbeat.timeoutId = null;
    }
  }, []);
  
  const handlePongReceived = useCallback(() => {
    const heartbeat = heartbeatStateRef.current;
    const now = new Date();
    
    if (heartbeat.lastPing) {
      const latency = now.getTime() - heartbeat.lastPing.getTime();
      updateConnectionQuality(true, latency);
    }
    
    heartbeat.lastPong = now;
    heartbeat.missedCount = 0;
    
    if (heartbeat.timeoutId) {
      clearTimeout(heartbeat.timeoutId);
      heartbeat.timeoutId = null;
    }
  }, [updateConnectionQuality]);
  
  // Persistent message queue management
  const savePersistentQueue = useCallback(() => {
    if (!opts.enablePersistence) return;
    
    try {
      const queue = persistentQueueRef.current.map(msg => ({
        ...msg,
        persistenceKey: msg.persistenceKey || `persist_${Date.now()}_${Math.random()}`,
      }));
      
      localStorage.setItem(STORAGE_KEYS.PERSISTENT_QUEUE, JSON.stringify(queue));
      
      setQueueStatus(prev => ({
        ...prev,
        persistent: queue.length,
      }));
    } catch (error) {
      console.warn('Failed to save persistent queue:', error);
    }
  }, [opts.enablePersistence]);
  
  const loadPersistentQueue = useCallback(() => {
    if (!opts.enablePersistence) return;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PERSISTENT_QUEUE);
      if (saved) {
        const queue: QueuedMessage[] = JSON.parse(saved);
        const now = Date.now();
        
        // Filter out messages older than 24 hours
        const validMessages = queue.filter(msg => 
          now - msg.queuedAt < 24 * 60 * 60 * 1000
        );
        
        persistentQueueRef.current = validMessages;
        
        setQueueStatus(prev => ({
          ...prev,
          persistent: validMessages.length,
        }));
      }
    } catch (error) {
      console.warn('Failed to load persistent queue:', error);
    }
  }, [opts.enablePersistence]);
  
  const addToPersistentQueue = useCallback((message: WebSocketMessage) => {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random()}`,
      queuedAt: Date.now(),
      attempts: 0,
      priority: message.priority || 'normal',
      persistenceKey: `persist_${Date.now()}_${Math.random()}`,
    };
    
    persistentQueueRef.current.push(queuedMessage);
    savePersistentQueue();
  }, [savePersistentQueue]);
  
  // Enhanced state management
  const updateConnectionState = useCallback((newState: ConnectionStatus['state'], additionalProps?: Partial<ConnectionStatus>) => {
    setConnectionStatus(prev => ({
      ...prev,
      ...additionalProps,
      state: newState,
      connecting: newState === 'connecting',
      connected: newState === 'connected',
      reconnecting: newState === 'reconnecting',
      disconnecting: newState === 'disconnecting',
    }));
  }, []);
  
  // Circuit breaker functions
  const checkCircuitBreakerState = useCallback(() => {
    const now = Date.now();
    const breaker = circuitBreakerRef.current;
    
    switch (breaker.state) {
      case 'open':
        if (now >= breaker.nextAttemptTime) {
          breaker.state = 'half-open';
        }
        break;
      case 'half-open':
        // Half-open state allows limited attempts
        break;
      default:
        // Closed state - normal operation
        break;
    }
    
    return breaker.state;
  }, []);
  
  const recordCircuitBreakerFailure = useCallback(() => {
    const now = Date.now();
    const breaker = circuitBreakerRef.current;
    
    breaker.failureCount++;
    breaker.lastFailureTime = now;
    
    if (breaker.failureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      breaker.state = 'open';
      breaker.nextAttemptTime = now + CIRCUIT_BREAKER_CONFIG.openStateDuration;
      console.warn(`Circuit breaker: OPENED after ${breaker.failureCount} failures. Next attempt in ${CIRCUIT_BREAKER_CONFIG.openStateDuration / 1000}s`);
      
      // Persist circuit breaker state
      if (opts.enablePersistence) {
        try {
          localStorage.setItem(STORAGE_KEYS.CIRCUIT_BREAKER, JSON.stringify(breaker));
        } catch (error) {
          console.warn('Failed to persist circuit breaker state:', error);
        }
      }
    }
  }, [opts.enablePersistence]);
  
  const recordCircuitBreakerSuccess = useCallback(() => {
    const breaker = circuitBreakerRef.current;
    breaker.failureCount = 0;
    breaker.state = 'closed';
    
    // Clear persisted circuit breaker state
    if (opts.enablePersistence) {
      try {
        localStorage.removeItem(STORAGE_KEYS.CIRCUIT_BREAKER);
      } catch (error) {
        console.warn('Failed to clear circuit breaker state:', error);
      }
    }
  }, [opts.enablePersistence]);

  // Load persisted data and initialize
  useEffect(() => {
    if (opts.enablePersistence) {
      try {
        // Load regular message queue
        const saved = localStorage.getItem(STORAGE_KEYS.QUEUE);
        if (saved) {
          const parsed = JSON.parse(saved);
          messageQueueRef.current = parsed.filter((msg: QueuedMessage) => 
            Date.now() - msg.queuedAt < 24 * 60 * 60 * 1000 // 24 hours max age
          );
          updateQueueStatus();
        }
        
        // Load persistent queue
        loadPersistentQueue();
        
        // Load connection history
        const historySaved = localStorage.getItem(STORAGE_KEYS.CONNECTION_HISTORY);
        if (historySaved) {
          const parsed = JSON.parse(historySaved);
          connectionHistoryRef.current = parsed.filter((attempt: ConnectionAttempt) => 
            Date.now() - attempt.timestamp < 24 * 60 * 60 * 1000 // Keep last 24 hours
          ).slice(-20); // Keep last 20 attempts
        }
        
        // Quality metrics are assessed fresh each session — don't load stale values
        // that could show "poor" banners before the WS even connects
        localStorage.removeItem(STORAGE_KEYS.QUALITY_METRICS);
        
        // Load rate limit state
        const rateLimitSaved = localStorage.getItem(STORAGE_KEYS.RATE_LIMIT);
        if (rateLimitSaved) {
          const parsed = JSON.parse(rateLimitSaved);
          if (Date.now() - parsed.windowStart < opts.rateLimit.windowMs) {
            rateLimitRef.current = parsed;
          }
        }
        
        // Load circuit breaker state
        const circuitBreakerSaved = localStorage.getItem(STORAGE_KEYS.CIRCUIT_BREAKER);
        if (circuitBreakerSaved) {
          const parsed = JSON.parse(circuitBreakerSaved);
          // Only restore if it's not too old
          if (Date.now() - parsed.lastFailureTime < CIRCUIT_BREAKER_CONFIG.openStateDuration * 2) {
            circuitBreakerRef.current = parsed;
          }
        }
      } catch (error) {
        console.warn('Failed to load persisted WebSocket data:', error);
      }
    }
  }, [opts.enablePersistence, opts.rateLimit.windowMs, loadPersistentQueue, updateQueueStatus]);
  
  // Rate limiting
  const isRateLimited = useCallback(() => {
    const now = Date.now();
    const state = rateLimitRef.current;
    
    // Reset window if expired
    if (now >= state.nextReset) {
      state.messages = 0;
      state.windowStart = now;
      state.nextReset = now + opts.rateLimit.windowMs;
      state.blocked = false;
    }
    
    // Check if rate limited
    if (state.messages >= opts.rateLimit.maxMessages) {
      state.blocked = true;
      setQueueStatus(prev => ({ ...prev, rateLimited: prev.rateLimited + 1 }));
      return true;
    }
    
    return false;
  }, [opts.rateLimit]);
  
  // updateQueueStatus function moved up to fix initialization order
  
  // Persist data
  const persistData = useCallback(() => {
    if (opts.enablePersistence) {
      try {
        localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(messageQueueRef.current));
        localStorage.setItem(STORAGE_KEYS.RATE_LIMIT, JSON.stringify(rateLimitRef.current));
      } catch (error) {
        console.warn('Failed to persist WebSocket data:', error);
      }
    }
  }, [opts.enablePersistence]);
  
  // Queue message
  const queueMessage = useCallback((message: WebSocketMessage) => {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: message.id || `msg_${Date.now()}_${Math.random()}`,
      queuedAt: Date.now(),
      attempts: 0,
      priority: message.priority || 'normal',
    };
    
    // Remove oldest messages if queue is full
    while (messageQueueRef.current.length >= opts.maxQueueSize) {
      messageQueueRef.current.shift();
      setQueueStatus(prev => ({ ...prev, dropped: prev.dropped + 1 }));
    }
    
    messageQueueRef.current.push(queuedMessage);
    updateQueueStatus();
    persistData();
  }, [opts.maxQueueSize, updateQueueStatus, persistData]);
  
  // Process queued messages
  const processQueue = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    const now = Date.now();
    const toSend: QueuedMessage[] = [];
    const toRetry: QueuedMessage[] = [];
    
    messageQueueRef.current.forEach(message => {
      if (message.retryAfter && now < message.retryAfter) {
        toRetry.push(message);
      } else {
        toSend.push(message);
      }
    });
    
    // Send messages respecting rate limits
    let sent = 0;
    for (const message of toSend) {
      if (isRateLimited()) {
        // Add back to retry queue
        message.retryAfter = rateLimitRef.current.nextReset;
        toRetry.push(message);
        continue;
      }
      
      try {
        wsRef.current.send(JSON.stringify(message));
        rateLimitRef.current.messages++;
        sent++;
      } catch (error) {
        console.error('Failed to send queued message:', error);
        message.attempts++;
        if (message.attempts < 3) {
          message.retryAfter = now + (message.attempts * 5000); // Exponential backoff
          toRetry.push(message);
        }
      }
    }
    
    messageQueueRef.current = toRetry;
    updateQueueStatus();
    persistData();
    
    if (sent > 0) {
    }
  }, [isRateLimited, updateQueueStatus, persistData]);
  
  // Connect function with circuit breaker and bundling-loop protection
  const connect = useCallback(async () => {
    // CRITICAL: Authentication guard - prevent connection when user not authenticated
    if (!isAuthenticated || !user) {
      setConnectionStatus(prev => ({
        ...prev,
        connected: false,
        error: null, // Clear any previous error
      }));
      return;
    }
    
    // CRITICAL: WebSocket disabled on free tier - use polling instead
    if (!WEBSOCKET_ENABLED) {
      setConnectionStatus(prev => ({
        ...prev,
        connected: false,
        error: 'WebSocket disabled - using polling mode',
      }));
      return;
    }
    
    // Check circuit breaker state first
    const circuitState = checkCircuitBreakerState();
    if (circuitState === 'open') {
      const breaker = circuitBreakerRef.current;
      const waitTime = Math.ceil((breaker.nextAttemptTime - Date.now()) / 1000);
      setConnectionStatus(prev => ({
        ...prev,
        error: `Connection blocked by circuit breaker. Retry in ${waitTime}s`,
      }));
      return;
    }
    
    if (wsRef.current && 
        (wsRef.current.readyState === WebSocket.CONNECTING || 
         wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }
    
    // Prevent rapid connection attempts caused by bundling stale closures
    const lastAttempt = localStorage.getItem('pitchey_last_ws_attempt');
    const now = Date.now();
    if (lastAttempt && (now - parseInt(lastAttempt)) < 2000) { // Increased to 2 seconds
      return;
    }
    localStorage.setItem('pitchey_last_ws_attempt', now.toString());
    
    // Better Auth: No longer use JWT tokens - session cookies handle auth
    // Remove legacy JWT token checks
    
    const isDemoMode = localStorage.getItem('demoMode') === 'true';
    if (isDemoMode) {
      return;
    }
    
    // Check if WebSocket was manually disabled
    const isDisabled = localStorage.getItem('pitchey_websocket_disabled') === 'true';
    if (isDisabled) {
      return;
    }
    
    // Update connection state to connecting
    updateConnectionState('connecting', {
      error: null,
      lastDisconnected: connectionStatus.lastDisconnected,
    });
    
    try {
      let wsUrl = config.WS_URL.replace(/^http/, 'ws');

      // Remove trailing /ws if already present to prevent duplication
      if (wsUrl.endsWith('/ws')) {
        wsUrl = wsUrl.slice(0, -3);
      }

      // Better Auth: For cross-origin WebSocket connections, we need to get a token
      // because browsers don't send cookies for cross-origin WebSocket upgrades
      let finalWsUrl = `${wsUrl}/ws`;
      
      // Check if this is a cross-origin connection
      // Compare WebSocket URL origin to current page origin (not API_URL)
      // In production, API_URL is empty (same-origin proxy) but WS_URL goes direct to Worker
      const wsOrigin = new URL(wsUrl.replace(/^ws/, 'http')).origin;
      const currentOrigin = window.location.origin;
      const isCrossOrigin = wsOrigin !== currentOrigin;

      if (isCrossOrigin) {
        // Cross-origin: Need to fetch a WebSocket token
        try {
          const tokenResponse = await fetch(`${config.API_URL}/api/ws/token`, {
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
            },
          });
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            if (tokenData.token) {
              // Add token as query parameter for cross-origin WebSocket
              finalWsUrl = `${wsUrl}/ws?token=${tokenData.token}`;
            }
          } else {
            console.warn('Could not get WebSocket token, connecting anonymously');
          }
        } catch (error) {
          console.warn('Error fetching WebSocket token:', error);
        }
      }
      
      const wsCreateTime = Date.now();
      const ws = new WebSocket(finalWsUrl);

      ws.onopen = () => {
        const connectTime = Date.now();
        const connectionLatency = connectTime - wsCreateTime;

        // Reset stale connection history so a fresh connect starts clean
        connectionHistoryRef.current = [];

        // Record successful connection — don't use handshake latency as quality signal
        // (TCP+TLS+upgrade easily takes 500ms+, only heartbeat pings measure real latency)
        updateConnectionQuality(true);
        recordCircuitBreakerSuccess();
        reconnectAttemptRef.current = 0;
        
        // Update connection state to connected
        updateConnectionState('connected', {
          lastConnected: new Date(connectTime),
          reconnectAttempts: 0,
          error: null,
        });
        
        // Better Auth: Authentication is handled via session cookies
        // No need to send auth messages - the server knows who we are from cookies
        
        opts.onConnect();
        
        // Clear reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }
        
        // Start enhanced heartbeat system
        startHeartbeat();
        
        // Load and process persistent queue
        loadPersistentQueue();
        if (persistentQueueRef.current.length > 0) {
          // Move persistent messages to regular queue for processing
          messageQueueRef.current.push(...persistentQueueRef.current);
          persistentQueueRef.current = [];
          savePersistentQueue();
          updateQueueStatus();
        }
        
        // Process queued messages
        setTimeout(processQueue, 1000);
      };
      
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          opts.onMessage(message);
          
          // Handle system messages
          if (message.type === 'ping') {
            // Server sent ping, respond with pong
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            }
          } else if (message.type === 'pong') {
            // Handle pong response for heartbeat
            handlePongReceived();
          } else if (message.type === 'connected') {
            // Handle connection confirmation with authentication status
          } else if (message.type === 'auth_success') {
            // Authentication via first message succeeded
          } else if (message.type === 'auth_error') {
            // Authentication via first message failed
            console.warn('WebSocket: Authentication failed', message.data || message);
          } else if (message.type === 'auth_required') {
            // Operation requires authentication
          } else if (message.type === 'error') {
            // Handle structured error messages
            const errorMsg = message.data?.error || message.data?.message || message.data || 'Unknown error';
            const errorCode = message.data?.code;
            const errorCategory = message.data?.category || 'unknown';
            const errorSeverity = message.data?.severity || 2; // Default to medium severity
            
            // Don't show analytics/tracking errors to user
            if (typeof errorMsg === 'string' && (
                errorMsg.toLowerCase().includes('analytics') || 
                errorMsg.toLowerCase().includes('tracking') ||
                errorMsg.toLowerCase().includes('analytics_events'))) {
              return; // Silently ignore analytics errors
            }
            
            // Only log errors in development or if they're not low-severity
            if (config.IS_DEVELOPMENT || errorSeverity > 1) {
              console.error('WebSocket server error:', {
                message: errorMsg,
                code: errorCode,
                category: errorCategory,
                recoverable: message.data?.recoverable,
                retryAfter: message.data?.retryAfter
              });
            }
            
            // Handle specific error types
            if (errorCode === 2001 || errorCode === 2002) { // Auth token invalid/expired
              // Clear token but DON'T redirect - Better Auth handles this
              localStorage.removeItem('authToken');
              // DISABLED: This was causing redirect loops with Better Auth
              // if (window.location.pathname !== '/login') {
              //   window.location.href = '/login';
              // }
            }
            
            // Update connection status with error info
            setConnectionStatus(prev => ({
              ...prev,
              error: errorMsg
            }));
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onclose = (event) => {
        const disconnectTime = new Date();
        
        // Update connection state
        updateConnectionState('disconnected', {
          lastDisconnected: disconnectTime,
          error: event.reason || `Connection closed (${event.code})`,
        });
        
        wsRef.current = null;
        opts.onDisconnect();
        
        // Stop heartbeat
        stopHeartbeat();
        
        // Move pending messages to persistent storage
        if (messageQueueRef.current.length > 0) {
          persistentQueueRef.current.push(...messageQueueRef.current);
          messageQueueRef.current = [];
          savePersistentQueue();
          updateQueueStatus();
        }
        
        // Attempt reconnect if not a clean close or auth failure
        // Auth failure codes: 1008 (Policy Violation), 4001-4003 (Custom auth errors)
        const isAuthFailure = event.code === 1008 || (event.code >= 4001 && event.code <= 4003);
        const isCleanClose = event.code === 1000 || event.code === 1001;
        
        // Record failure in circuit breaker for unexpected disconnections
        if (!isCleanClose && !isAuthFailure) {
          recordCircuitBreakerFailure();
        }
        
        // Check circuit breaker before attempting reconnection
        const circuitState = checkCircuitBreakerState();
        if (circuitState === 'open') {
          setConnectionStatus(prev => ({
            ...prev,
            reconnecting: false,
            error: 'Connection attempts blocked by circuit breaker. Will retry automatically.',
          }));
          return;
        }
        
        if (!isCleanClose && !isAuthFailure && reconnectionConfig.enabled &&
            reconnectAttemptRef.current < reconnectionConfig.maxAttempts) {
          
          const attempt = ++reconnectAttemptRef.current;
          const delay = calculateReconnectDelay(attempt - 1);
          
          // Update connection state for reconnecting
          updateConnectionState('reconnecting', {
            reconnectAttempts: attempt,
          });
          
          // Record failed connection attempt
          updateConnectionQuality(false);
          
          
          reconnectTimeoutRef.current = setTimeout(() => {
            opts.onReconnect(attempt);
            connect();
          }, delay);
        } else if (isAuthFailure) {
          // Authentication failed - don't retry, provide clear feedback
          console.warn(`WebSocket authentication failed (code: ${event.code}): ${event.reason}`);
          setConnectionStatus(prev => ({
            ...prev,
            reconnecting: false,
            error: `Authentication failed: ${event.reason || 'Invalid or expired token'}. Please log in again.`,
          }));
          
          // Clear invalid token if authentication failed
          if (event.reason && event.reason.toLowerCase().includes('token')) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userType');
          }
        } else if (reconnectAttemptRef.current >= reconnectionConfig.maxAttempts) {
          // Max attempts reached - stop trying and show user-friendly message
          console.error(`WebSocket connection failed after ${reconnectionConfig.maxAttempts} attempts. Real-time features disabled.`);
          updateConnectionState('disconnected', {
            reconnecting: false,
            error: 'Connection failed after multiple attempts. Real-time features temporarily unavailable.',
          });
          
          // Move all queued messages to persistent storage for later
          if (messageQueueRef.current.length > 0) {
            persistentQueueRef.current.push(...messageQueueRef.current);
            messageQueueRef.current = [];
            savePersistentQueue();
            updateQueueStatus();
          }
        }
      };
      
      ws.onerror = (error) => {
        // Serialize Event to a string so Sentry doesn't log [object Object]
        const errorMsg = error instanceof ErrorEvent
          ? `message=${error.message}, filename=${error.filename}`
          : `type=${error.type}`;
        console.error(`WebSocket error occurred: ${errorMsg}, readyState=${ws.readyState}, url=${ws.url}`);
        
        // Record failure in circuit breaker for connection errors
        if (ws.readyState === WebSocket.CONNECTING) {
          recordCircuitBreakerFailure();
        }
        
        // Don't immediately set error state - let onclose handle reconnection logic
        // This prevents error loops when the server is unreachable
        if (ws.readyState === WebSocket.CONNECTING) {
        }
        
        opts.onError(error);
      };
      
      wsRef.current = ws;
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus(prev => ({
        ...prev,
        connecting: false,
        error: 'Failed to create connection',
      }));
    }
  }, [opts, connectionStatus.reconnectAttempts, processQueue, checkCircuitBreakerState, recordCircuitBreakerSuccess, recordCircuitBreakerFailure, isAuthenticated, user]);
  
  // Disconnect function
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = undefined;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnecting');
      wsRef.current = null;
    }
    
    setConnectionStatus(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      reconnecting: false,
      reconnectAttempts: 0,
    }));
  }, []);
  
  // Send message function
  const sendMessage = useCallback((message: WebSocketMessage) => {
    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    
    // Check rate limiting
    if (isRateLimited()) {
      console.warn('Message rate limited, queuing for later');
      queueMessage(message);
      return false;
    }
    
    // Try to send immediately if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        rateLimitRef.current.messages++;
        persistData();
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        queueMessage(message);
        return false;
      }
    } else {
      // Queue for later if not connected
      if (message.priority === 'critical' || message.priority === 'high') {
        // High priority messages go to regular queue for immediate processing when reconnected
        queueMessage(message);
      } else {
        // Normal/low priority messages go to persistent storage
        addToPersistentQueue(message);
      }
      
      // Try to reconnect if not already connecting
      if (!connectionStatus.connecting && !connectionStatus.reconnecting) {
        connect();
      }
      
      return false;
    }
  }, [isRateLimited, queueMessage, persistData, connectionStatus, connect]);
  
  // Clear queue function
  const clearQueue = useCallback(() => {
    messageQueueRef.current = [];
    updateQueueStatus();
    persistData();
  }, [updateQueueStatus, persistData]);
  
  // Get queue messages (for debugging/status)
  const getQueuedMessages = useCallback(() => {
    return [...messageQueueRef.current];
  }, []);
  
  // Auto-connect on mount and when authentication state changes
  useEffect(() => {
    // CRITICAL: Only auto-connect if explicitly enabled AND user is authenticated
    if (opts.autoConnect && isAuthenticated && user) {
      // In development, React StrictMode causes double mounting
      // Delay WebSocket connection slightly to avoid race condition
      const isDev = import.meta.env.DEV;
      const delay = isDev ? 100 : 0;
      
      const timer = setTimeout(() => {
        connect();
      }, delay);
      
      return () => {
        clearTimeout(timer);
      };
    }
    
    // CRITICAL: Disconnect immediately if not authenticated
    if (!isAuthenticated || !user) {
      if (connectionStatus.connected || connectionStatus.connecting) {
        disconnect();
      }
      // Clear any connection state
      setConnectionStatus(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        reconnecting: false,
        error: null
      }));
    }
    
    return () => {
      disconnect();
    };
  }, [opts.autoConnect, isAuthenticated, user, connectionStatus.connected, connectionStatus.connecting]); // Include connection state
  
  // Guard against browser extension message channel errors
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Suppress browser extension message channel errors to prevent console spam
      if (event.reason?.message?.includes('message channel closed before a response was received')) {
        event.preventDefault();
        return;
      }
      // Allow other unhandled rejections to be logged normally
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, []);
  
  // Circuit breaker automatic retry mechanism
  useEffect(() => {
    const interval = setInterval(() => {
      const circuitState = checkCircuitBreakerState();
      if (circuitState === 'half-open' && !connectionStatus.connected && !connectionStatus.connecting) {
        connect();
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [checkCircuitBreakerState, connect, connectionStatus.connected, connectionStatus.connecting]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, []);
  
  return {
    // Enhanced connection state
    connectionStatus,
    isConnected: connectionStatus.connected,
    isConnecting: connectionStatus.connecting,
    isReconnecting: connectionStatus.reconnecting,
    isDisconnecting: connectionStatus.disconnecting,
    
    // Connection quality
    connectionQuality: connectionStatus.quality,
    
    // Message state
    lastMessage,
    queueStatus,
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    clearQueue,
    getQueuedMessages,
    
    // Manual reconnect function
    manualReconnect: useCallback(() => {
      if (wsRef.current) {
        disconnect();
      }
      reconnectAttemptRef.current = 0; // Reset attempt counter
      connect();
    }, [connect, disconnect]),
    
    // Configuration access
    reconnectionConfig,
    heartbeatConfig,
    
    // Enhanced status helpers
    canSend: connectionStatus.connected && !rateLimitRef.current.blocked,
    nextRetry: rateLimitRef.current.blocked ? new Date(rateLimitRef.current.nextReset) : null,
    retryCount: reconnectAttemptRef.current,
    isHealthy: connectionStatus.quality.strength === 'excellent' || connectionStatus.quality.strength === 'good',
    
    // Debug information
    getStats: useCallback(() => ({
      connectionHistory: connectionHistoryRef.current,
      heartbeatState: heartbeatStateRef.current,
      persistentQueue: persistentQueueRef.current.length,
      circuitBreaker: circuitBreakerRef.current,
    }), []),
  };
}

