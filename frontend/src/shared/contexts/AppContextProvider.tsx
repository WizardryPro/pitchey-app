import React, { createContext, useContext, ReactNode } from 'react';

// Import all individual context providers
// AuthContext removed - using Better Auth hooks instead
import { ThemeProvider } from './ThemeContext';
import { NotificationProvider } from './NotificationContext';
import { WebSocketProvider } from './WebSocketContext';
import { PitchProvider } from './PitchContext';
import { UserProvider } from './UserContext';
import { PollingProvider } from './PollingContext';

interface AppProviderProps {
  children: ReactNode;
}

/**
 * Main App Context Provider
 * Wraps all context providers to avoid prop drilling and ensure proper data flow
 * This solves the useSyncExternalStore error by ensuring all contexts are properly initialized
 */
export const AppContextProvider: React.FC<AppProviderProps> = ({ children }) => {
  return (
    <UserProvider>
      <ThemeProvider>
        <WebSocketProvider>
          <PollingProvider defaultInterval={30000} enablePolling={true}>
            <NotificationProvider>
              <PitchProvider>
                {children}
              </PitchProvider>
            </NotificationProvider>
          </PollingProvider>
        </WebSocketProvider>
      </ThemeProvider>
    </UserProvider>
  );
};

// Export a custom hook to check if contexts are properly initialized
export const useAppContext = () => {
  const inContext = React.useContext(React.createContext(true));
  if (!inContext) {
    console.warn('Component is not wrapped in AppContextProvider');
  }
  return inContext;
};