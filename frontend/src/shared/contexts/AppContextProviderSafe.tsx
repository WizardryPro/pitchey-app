import React, { ReactNode, useEffect, useState } from 'react';

// Import only safe context providers
import { ThemeProvider } from './ThemeContext';
import { NotificationProvider } from './NotificationContext';
import { PitchProvider } from './PitchContext';
import { UserProvider } from './UserContext';
import { WebSocketProvider } from './WebSocketContext';
import { useBetterAuthStore } from '@/store/betterAuthStore';

interface AppProviderProps {
  children: ReactNode;
}

/**
 * Safe App Context Provider - conditionally includes WebSocketProvider only when authenticated
 * This prevents WebSocket connection attempts before authentication is established
 */
export const AppContextProviderSafe: React.FC<AppProviderProps> = ({ children }) => {
  const { isAuthenticated, loading } = useBetterAuthStore();
  const [shouldIncludeWebSocket, setShouldIncludeWebSocket] = useState(false);

  // CRITICAL: Only include WebSocket provider after authentication is confirmed
  useEffect(() => {
    if (!loading) {
      // Only include WebSocket if user is authenticated
      // This prevents connection attempts when not logged in
      if (isAuthenticated) {
        const timer = setTimeout(() => {
          setShouldIncludeWebSocket(true);
        }, 300); // Slight delay to ensure complete auth state stability
        
        return () => clearTimeout(timer);
      } else {
        // Reset if user logs out
        setShouldIncludeWebSocket(false);
      }
    }
  }, [loading, isAuthenticated]);

  return (
    <UserProvider>
      <ThemeProvider>
        <NotificationProvider>
          <PitchProvider>
            {shouldIncludeWebSocket ? (
              <WebSocketProvider>
                {children}
              </WebSocketProvider>
            ) : (
              children
            )}
          </PitchProvider>
        </NotificationProvider>
      </ThemeProvider>
    </UserProvider>
  );
};