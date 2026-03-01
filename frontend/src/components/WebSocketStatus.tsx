import React from 'react';
import { Wifi, WifiOff, RotateCcw, AlertCircle } from 'lucide-react';
import { useWebSocket } from '@shared/contexts/WebSocketContext';

interface WebSocketStatusProps {
  showDetails?: boolean;
  className?: string;
}

export function WebSocketStatus({ showDetails = false, className = '' }: WebSocketStatusProps) {
  const { connectionStatus, isConnected, isReconnecting } = useWebSocket();
  const isConnecting = connectionStatus.reconnectAttempts > 0 && !isConnected;

  // Don't show anything if connected and no details requested
  if (isConnected && !showDetails) {
    return null;
  }

  const getStatusInfo = () => {
    if (isConnected) {
      return {
        icon: <Wifi className="w-4 h-4 text-green-500" />,
        text: 'Real-time features active',
        bgColor: 'bg-green-50 border-green-200',
        textColor: 'text-green-700',
      };
    }

    if (isConnecting || isReconnecting) {
      const attempts = connectionStatus.reconnectAttempts;
      const maxAttempts = 5; // Match DEFAULT_OPTIONS.maxReconnectAttempts
      
      return {
        icon: <RotateCcw className="w-4 h-4 text-yellow-500 animate-spin" />,
        text: isReconnecting 
          ? `Reconnecting... (${attempts}/${maxAttempts})`
          : 'Connecting to real-time features...',
        bgColor: 'bg-yellow-50 border-yellow-200',
        textColor: 'text-yellow-700',
      };
    }

    // Connection failed or error
    return {
      icon: <WifiOff className="w-4 h-4 text-red-500" />,
      text: connectionStatus.error?.includes('multiple attempts') 
        ? 'Real-time features temporarily unavailable'
        : 'Real-time features offline',
      bgColor: 'bg-red-50 border-red-200',
      textColor: 'text-red-700',
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${statusInfo.bgColor} ${statusInfo.textColor} ${className}`}>
      {statusInfo.icon}
      <span className="text-sm font-medium">{statusInfo.text}</span>
      
      {showDetails && connectionStatus.error && (
        <div className="ml-2">
          <AlertCircle className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}

// Compact version for headers/toolbars
export function WebSocketStatusCompact({ className = '' }: { className?: string }) {
  const { isConnected, connectionStatus, isReconnecting } = useWebSocket();
  const isConnecting = connectionStatus.reconnectAttempts > 0 && !isConnected;

  const getIcon = () => {
    if (isConnected) return <Wifi className="w-4 h-4 text-green-500" />;
    if (isConnecting || isReconnecting) return <RotateCcw className="w-4 h-4 text-yellow-500 animate-spin" />;
    return <WifiOff className="w-4 h-4 text-red-500" />;
  };

  const getTooltip = () => {
    if (isConnected) return 'Real-time features active';
    if (isConnecting || isReconnecting) return 'Connecting to real-time features...';
    return 'Real-time features offline';
  };

  return (
    <div className={`flex items-center ${className}`} title={getTooltip()}>
      {getIcon()}
    </div>
  );
}

export default WebSocketStatus;