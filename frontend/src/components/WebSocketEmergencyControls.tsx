import React, { useState } from 'react';
import { WifiOff, Wifi, Settings, AlertTriangle } from 'lucide-react';
import { useWebSocket } from '@shared/contexts/WebSocketContext';

interface WebSocketEmergencyControlsProps {
  className?: string;
}

export function WebSocketEmergencyControls({ className = '' }: WebSocketEmergencyControlsProps) {
  const [showControls, setShowControls] = useState(false);
  const { 
    connectionStatus,
    isConnected, 
    isWebSocketDisabled, 
    disableWebSocket, 
    enableWebSocket 
  } = useWebSocket();

  const hasConnectionError = connectionStatus.error && 
    (connectionStatus.error.includes('multiple attempts') || 
     connectionStatus.reconnectAttempts >= 5);

  if (!showControls && !hasConnectionError) {
    return (
      <button
        onClick={() => setShowControls(true)}
        className={`p-2 text-gray-500 hover:text-gray-700 ${className}`}
        title="WebSocket Controls"
      >
        <Settings className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className={`bg-white border rounded-lg shadow-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-4 h-4 text-gray-600" />
        <h3 className="font-medium text-gray-900">Real-time Connection</h3>
        {!showControls && hasConnectionError && (
          <AlertTriangle className="w-4 h-4 text-red-500" />
        )}
      </div>

      {/* Connection Status */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-700">Connected</span>
            </>
          ) : isWebSocketDisabled ? (
            <>
              <WifiOff className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Manually Disabled</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">
                {connectionStatus.error || 'Disconnected'}
              </span>
            </>
          )}
        </div>

        {connectionStatus.reconnectAttempts > 0 && (
          <p className="text-xs text-gray-500">
            Reconnection attempts: {connectionStatus.reconnectAttempts}/5
          </p>
        )}
      </div>

      {/* Error Message */}
      {hasConnectionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
          <p className="text-red-800 font-medium mb-1">Connection Failed</p>
          <p className="text-red-700">
            Real-time features (notifications, live updates, messaging) are temporarily unavailable.
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-2">
        {isWebSocketDisabled ? (
          <button
            onClick={enableWebSocket}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            <Wifi className="w-4 h-4" />
            Enable Real-time Features
          </button>
        ) : (
          <button
            onClick={disableWebSocket}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            <WifiOff className="w-4 h-4" />
            Disable Real-time Features
          </button>
        )}

        {showControls && (
          <button
            onClick={() => setShowControls(false)}
            className="w-full px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
          >
            Hide Controls
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          If you're experiencing connection issues, you can temporarily disable real-time features 
          to improve app performance. You can re-enable them anytime.
        </p>
      </div>
    </div>
  );
}

// Compact version for headers
export function WebSocketEmergencyToggle({ className = '' }: { className?: string }) {
  const { isWebSocketDisabled, disableWebSocket, enableWebSocket } = useWebSocket();

  return (
    <button
      onClick={isWebSocketDisabled ? enableWebSocket : disableWebSocket}
      className={`p-2 rounded-lg transition-colors ${
        isWebSocketDisabled 
          ? 'text-red-600 hover:bg-red-50' 
          : 'text-gray-600 hover:bg-gray-100'
      } ${className}`}
      title={isWebSocketDisabled ? 'Enable real-time features' : 'Disable real-time features'}
    >
      {isWebSocketDisabled ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
    </button>
  );
}

export default WebSocketEmergencyControls;