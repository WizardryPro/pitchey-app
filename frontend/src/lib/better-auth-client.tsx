/**
 * Better Auth Client Configuration for Frontend
 * Migrated from JWT to session-based authentication
 * Features comprehensive TypeScript support
 */

import React from 'react';
import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';
import { multiSessionClient } from 'better-auth/client/plugins';
import { API_URL } from '../config';
import type { User } from '@shared/types/api';

// Portal types
export type PortalType = 'creator' | 'investor' | 'production';

// Better Auth client configuration
export const authClient = createAuthClient({
  baseURL: API_URL,
  
  // Plugin configuration
  plugins: [
    organizationClient(),
    adminClient(), 
    multiSessionClient()
  ],
  
  // Cookie configuration
  cookies: {
    sessionToken: {
      name: 'pitchey-session'
    }
  },

  // Fetch configuration for Cloudflare Workers
  fetchOptions: {
    credentials: 'include' as RequestCredentials,
    headers: {
      'Content-Type': 'application/json'
    }
  }
});

// Authentication response types
export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
  error?: string;
  data?: {
    user?: User;
    token?: string;
  };
}

export interface Session {
  user: User;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

/**
 * Portal-specific authentication hooks
 */
export interface PortalAuthMethods {
  // Sign in methods
  signInCreator: (email: string, password: string) => Promise<AuthResponse>;
  signInInvestor: (email: string, password: string) => Promise<AuthResponse>;
  signInProduction: (email: string, password: string) => Promise<AuthResponse>;
  
  // Registration methods  
  registerCreator: (email: string, username: string, password: string) => Promise<AuthResponse>;
  registerInvestor: (email: string, username: string, password: string) => Promise<AuthResponse>;
  registerProduction: (email: string, username: string, password: string) => Promise<AuthResponse>;
  
  // Session management
  getSession: () => Promise<Session | null>;
  signOut: () => Promise<{ success: boolean }>;
  
  // Portal validation
  validatePortalAccess: (userType: string, requiredPortal: PortalType) => boolean;
}

/**
 * Create portal authentication methods
 */
export function createPortalAuthMethods(): PortalAuthMethods {
  // Helper function for auth requests
  const makeAuthRequest = async (endpoint: string, data: unknown): Promise<AuthResponse> => {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      const responseData: AuthResponse = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: responseData.error || 'Request failed'
        };
      }

      return {
        ...responseData,
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  };

  return {
    // Sign in methods
    signInCreator: (email: string, password: string) => 
      makeAuthRequest('/api/auth/creator/login', { email, password }),
    
    signInInvestor: (email: string, password: string) => 
      makeAuthRequest('/api/auth/investor/login', { email, password }),
    
    signInProduction: (email: string, password: string) => 
      makeAuthRequest('/api/auth/production/login', { email, password }),

    // Registration methods
    registerCreator: (email: string, username: string, password: string) => 
      makeAuthRequest('/api/auth/creator/register', { email, username, password, userType: 'creator' }),
    
    registerInvestor: (email: string, username: string, password: string) => 
      makeAuthRequest('/api/auth/investor/register', { email, username, password, userType: 'investor' }),
    
    registerProduction: (email: string, username: string, password: string) => 
      makeAuthRequest('/api/auth/production/register', { email, username, password, userType: 'production' }),

    // Session management
    async getSession(): Promise<Session | null> {
      try {
        const response = await fetch(`${API_URL}/api/auth/session`, {
          method: 'GET',
          credentials: 'include'
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data as Session;
      } catch (error) {
        console.error('Failed to get session:', error);
        return null;
      }
    },

    async signOut(): Promise<{ success: boolean }> {
      try {
        const response = await fetch(`${API_URL}/api/auth/sign-out`, {
          method: 'POST',
          credentials: 'include'
        });

        return { success: response.ok };
      } catch (error) {
        console.error('Failed to sign out:', error);
        return { success: false };
      }
    },

    // Validate portal access
    validatePortalAccess(userType: string, requiredPortal: PortalType): boolean {
      return userType === requiredPortal;
    }
  };
}

/**
 * Migration utility to clean up JWT artifacts
 */
export function cleanupJWTArtifacts() {
  // Remove JWT-related localStorage items
  const keysToRemove = [
    'authToken',
    'token',
    'jwt',
    'accessToken',
    'refreshToken'
  ];

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    // Also remove namespaced versions
    localStorage.removeItem(`pitchey:${key}`);
    localStorage.removeItem(`pitchey:${window.location.host}:${key}`);
  });

  // Clear session storage
  sessionStorage.clear();
}

/**
 * Check if user is authenticated via Better Auth session
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const portalAuth = createPortalAuthMethods();
    const session = await portalAuth.getSession();
    return !!(session && session.user);
  } catch {
    return false;
  }
}

/**
 * Get current user from Better Auth session
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const portalAuth = createPortalAuthMethods();
    const session = await portalAuth.getSession();
    return session?.user || null;
  } catch {
    return null;
  }
}

/**
 * Export portal auth instance for use in stores
 */
export const portalAuth = createPortalAuthMethods();

/**
 * Higher-order component for authentication checking
 */
export function withBetterAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  requiredPortal?: PortalType
): React.ComponentType<T> {
  return function AuthenticatedComponent(props: T) {
    const [isLoading, setIsLoading] = React.useState(true);
    const [isAuthed, setIsAuthed] = React.useState(false);
    const [user, setUser] = React.useState<User | null>(null);

    React.useEffect(() => {
      const checkAuth = async () => {
        try {
          const session = await getCurrentUser();
          
          if (!session) {
            setIsAuthed(false);
            return;
          }

          // Check portal access if required
          if (requiredPortal) {
            const portalAuth = createPortalAuthMethods();
            const hasAccess = portalAuth.validatePortalAccess(session.userType, requiredPortal);
            
            if (!hasAccess) {
              setIsAuthed(false);
              return;
            }
          }

          setUser(session);
          setIsAuthed(true);
        } catch (error) {
          console.error('Auth check failed:', error);
          setIsAuthed(false);
        } finally {
          setIsLoading(false);
        }
      };

      checkAuth();
    }, []);

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!isAuthed) {
      // DISABLED: This was causing redirect loops and flickering
      // Better Auth handles authentication via cookies
      // const loginPath = requiredPortal ? `/login/${requiredPortal}` : '/login';
      // window.location.href = loginPath;
      return <div>Please log in to continue</div>;
    }

    return <WrappedComponent {...props} />;
  };
}