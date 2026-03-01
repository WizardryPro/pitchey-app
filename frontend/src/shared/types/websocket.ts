export interface WebSocketMessage {
  type: string;
  data?: any;
  id?: string;
  timestamp?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  retryCount?: number;
  maxRetries?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  reconnecting: boolean;
  disconnecting: boolean;
  lastConnected: Date | null;
  lastDisconnected: Date | null;
  reconnectAttempts: number;
  error: string | null;
  state: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'reconnecting';
  quality: ConnectionQuality;
}

export interface ConnectionQuality {
  strength: 'poor' | 'fair' | 'good' | 'excellent';
  latency: number | null;
  lastPing: Date | null;
  consecutiveFailures: number;
  successRate: number; // Percentage over last 10 attempts
}

export interface MessageQueueStatus {
  queued: number;
  maxQueue: number;
  dropped: number;
  rateLimited: number;
  persistent: number; // Messages stored in localStorage
  pending: number; // Messages waiting for reconnection
}

export interface ReconnectionConfig {
  enabled: boolean;
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

export interface HeartbeatConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  maxMissed: number;
}

// Intelligence Layer WebSocket Types
export interface IntelligenceUpdate {
  type: 'market_news' | 'trend_alert' | 'opportunity_discovered' | 'competitive_change' | 'enrichment_complete';
  data: any;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  category?: 'market' | 'trends' | 'opportunities' | 'competitive' | 'enrichment';
}

export interface MarketNewsUpdate {
  id: string;
  headline: string;
  summary: string;
  source: string;
  impact: 'positive' | 'negative' | 'neutral';
  relevanceScore: number;
  tags: string[];
  url?: string;
  publishedAt: string;
}

export interface TrendAlert {
  id: string;
  name: string;
  type: 'genre' | 'budget' | 'technology' | 'demographic';
  direction: 'rising' | 'declining' | 'stable';
  strength: number; // 0-100
  confidence: number; // 0-100
  timeframe: string;
  description: string;
  impact: string;
}

export interface OpportunityUpdate {
  id: string;
  title: string;
  type: 'market_gap' | 'trending_genre' | 'budget_sweet_spot' | 'demographic_shift';
  description: string;
  confidence: number; // 0-100
  potentialValue: number;
  timeToAct: string;
  requirements: string[];
  competitionLevel: 'low' | 'medium' | 'high';
}

export interface CompetitiveChange {
  competitorId: string;
  competitorName: string;
  changeType: 'feature_added' | 'pricing_changed' | 'strategy_shift' | 'market_entry';
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionRequired: boolean;
  recommendation?: string;
}

export interface EnrichmentComplete {
  pitchId: number;
  enrichmentType: 'industry' | 'market' | 'competitive';
  status: 'success' | 'partial' | 'failed';
  dataPoints: number;
  insights: string[];
  recommendations: string[];
  confidence: number;
}