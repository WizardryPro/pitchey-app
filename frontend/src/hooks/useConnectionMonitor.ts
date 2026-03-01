import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '@shared/contexts/WebSocketContext';
import type { ConnectionQuality } from '@shared/types/websocket';

interface NetworkInformation extends EventTarget {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

interface ConnectionMonitorState {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

interface UseConnectionMonitorResult {
  connectionState: ConnectionMonitorState;
  wsQuality: ConnectionQuality;
  isConnected: boolean;
  shouldFallback: boolean;
  performanceMetrics: {
    averageLatency: number;
    successRate: number;
    reconnections: number;
  };
  actions: {
    testConnection: () => Promise<boolean>;
    forceReconnect: () => void;
    enableFallback: () => void;
    disableFallback: () => void;
  };
}

export function useConnectionMonitor(): UseConnectionMonitorResult {
  const { 
    connectionQuality, 
    isConnected, 
    connectionStatus,
    manualReconnect,
    disableWebSocket,
    enableWebSocket 
  } = useWebSocket();
  
  const [connectionState, setConnectionState] = useState<ConnectionMonitorState>({
    isOnline: navigator.onLine,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
  });
  
  const [performanceHistory, setPerformanceHistory] = useState<{
    latencies: number[];
    successes: number;
    failures: number;
    reconnections: number;
  }>({
    latencies: [],
    successes: 0,
    failures: 0,
    reconnections: 0,
  });
  
  const [shouldFallback, setShouldFallback] = useState(false);
  
  // Monitor network information API
  useEffect(() => {
    const updateConnectionInfo = () => {
      const nav = navigator as NavigatorWithConnection;
      const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;

      if (connection !== undefined) {
        setConnectionState(prev => ({
          ...prev,
          connectionType: (connection.type ?? 'unknown') as ConnectionMonitorState['connectionType'],
          effectiveType: (connection.effectiveType ?? 'unknown') as ConnectionMonitorState['effectiveType'],
          downlink: connection.downlink ?? 0,
          rtt: connection.rtt ?? 0,
          saveData: connection.saveData ?? false,
        }));
      }
    };
    
    const handleOnline = () => {
      setConnectionState(prev => ({ ...prev, isOnline: true }));
      enableWebSocket();
    };
    
    const handleOffline = () => {
      setConnectionState(prev => ({ ...prev, isOnline: false }));
      setShouldFallback(true);
    };
    
    // Set up listeners
    updateConnectionInfo();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection;
    if (connection !== undefined) {
      connection.addEventListener('change', updateConnectionInfo);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection !== undefined) {
        connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, [enableWebSocket]);
  
  // Monitor WebSocket connection quality
  useEffect(() => {
    if (connectionQuality.latency !== null) {
      setPerformanceHistory(prev => {
        const newLatencies = [...prev.latencies, connectionQuality.latency!].slice(-20);
        return {
          ...prev,
          latencies: newLatencies,
          successes: connectionQuality.consecutiveFailures === 0 ? prev.successes + 1 : prev.successes,
          failures: connectionQuality.consecutiveFailures > 0 ? prev.failures + 1 : prev.failures,
        };
      });
    }
  }, [connectionQuality]);
  
  // Track reconnections
  useEffect(() => {
    if (connectionStatus.reconnectAttempts > 0) {
      setPerformanceHistory(prev => ({
        ...prev,
        reconnections: prev.reconnections + 1,
      }));
    }
  }, [connectionStatus.reconnectAttempts]);
  
  // Determine if fallback should be enabled
  useEffect(() => {
    const poorConnection = connectionQuality.strength === 'poor';
    const highLatency = connectionQuality.latency && connectionQuality.latency > 2000;
    const lowSuccessRate = connectionQuality.successRate < 50;
    const slowNetwork = connectionState.effectiveType === 'slow-2g' || connectionState.effectiveType === '2g';
    
    setShouldFallback(
      !connectionState.isOnline || 
      poorConnection || 
      highLatency || 
      lowSuccessRate || 
      slowNetwork ||
      connectionQuality.consecutiveFailures >= 3
    );
  }, [connectionQuality, connectionState]);
  
  // Actions
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      const start = Date.now();
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
      });
      const latency = Date.now() - start;
      
      setPerformanceHistory(prev => ({
        ...prev,
        latencies: [...prev.latencies, latency].slice(-20),
        successes: response.ok ? prev.successes + 1 : prev.successes,
        failures: response.ok ? prev.failures : prev.failures + 1,
      }));
      
      return response.ok && latency < 5000; // Consider good if < 5s
    } catch (_error) {
      setPerformanceHistory(prev => ({
        ...prev,
        failures: prev.failures + 1,
      }));
      return false;
    }
  }, []);
  
  const forceReconnect = useCallback(() => {
    manualReconnect();
  }, [manualReconnect]);
  
  const enableFallback = useCallback(() => {
    setShouldFallback(true);
    disableWebSocket();
  }, [disableWebSocket]);
  
  const disableFallback = useCallback(() => {
    setShouldFallback(false);
    enableWebSocket();
  }, [enableWebSocket]);
  
  // Calculate performance metrics
  const averageLatency = performanceHistory.latencies.length > 0
    ? performanceHistory.latencies.reduce((a, b) => a + b, 0) / performanceHistory.latencies.length
    : 0;
  
  const totalAttempts = performanceHistory.successes + performanceHistory.failures;
  const successRate = totalAttempts > 0 
    ? (performanceHistory.successes / totalAttempts) * 100
    : 0;
  
  return {
    connectionState,
    wsQuality: connectionQuality,
    isConnected,
    shouldFallback,
    performanceMetrics: {
      averageLatency,
      successRate,
      reconnections: performanceHistory.reconnections,
    },
    actions: {
      testConnection,
      forceReconnect,
      enableFallback,
      disableFallback,
    },
  };
}