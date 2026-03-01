// Auth Service - Better Auth Implementation (Cookie-based Sessions)
import { authClient } from '../lib/better-auth-client';
import type { 
  User, 
  LoginCredentials, 
  RegisterData, 
  AuthResponse 
} from '@shared/types/api';

// Export types from centralized types file
export type { LoginCredentials, RegisterData, AuthResponse } from '@shared/types/api';

export interface TokenValidation {
  valid: boolean;
  user?: User;
  exp?: number;
}

// Clean up any JWT artifacts from localStorage
function cleanupJWTArtifacts(): void {
  // Remove all JWT-related items
  const keysToRemove = [
    'authToken', 'token', 'jwt', 'accessToken', 'refreshToken',
    'user', 'userType', 'pitchey:authToken', 'pitchey:token'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    // Also remove namespaced versions
    const storageKeys = Object.keys(localStorage);
    storageKeys.forEach(storageKey => {
      if (storageKey.includes(key)) {
        localStorage.removeItem(storageKey);
      }
    });
  });
}

export class AuthService {
  // Removed auto-cleanup on load to prevent session loss on refresh

  // Generic login for all user types using Better Auth
  static async login(credentials: LoginCredentials, userType: 'creator' | 'investor' | 'production'): Promise<AuthResponse> {
    cleanupJWTArtifacts(); // Clean up any lingering JWT tokens
    
    try {
      // Use Better Auth signIn with portal-specific endpoint
      const response = await authClient.signIn.email({
        email: credentials.email,
        password: credentials.password,
        callbackURL: `/${userType}/dashboard`,
        // Pass userType as metadata for backend routing
        fetchOptions: {
          headers: {
            'X-Portal-Type': userType
          }
        }
      });

      if (!response.data) {
        throw new Error('Login failed - no data returned');
      }

      // Better Auth handles cookie setting automatically
      // Return compatible response structure
      const userData = response.data as Record<string, unknown>;
      return {
        success: true,
        user: userData.user as unknown as User,
        token: (userData.token as string) || 'session', // Session ID for compatibility
      };
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      throw new Error(e.message || 'Login failed');
    }
  }

  // Creator login
  static async creatorLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.login(credentials, 'creator');
  }

  // Investor login
  static async investorLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.login(credentials, 'investor');
  }

  // Production login
  static async productionLogin(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.login(credentials, 'production');
  }

  // Generic registration using Better Auth
  static async register(data: RegisterData): Promise<AuthResponse> {
    cleanupJWTArtifacts();
    
    try {
      const response = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: (data as unknown as Record<string, unknown>).name as string || data.email.split('@')[0],
        callbackURL: `/${data.userType}/dashboard`,
        // Pass additional data as metadata
        fetchOptions: {
          headers: {
            'X-Portal-Type': data.userType
          }
        } as Record<string, unknown>
      });

      const regData = response as { data?: { user?: unknown; token?: string } };
      if (!regData.data) {
        throw new Error('Registration failed - no data returned');
      }

      return {
        success: true,
        user: regData.data.user as unknown as User,
        token: regData.data.token || 'session',
      };
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      throw new Error(e.message || 'Registration failed');
    }
  }

  // Creator registration
  static async creatorRegister(data: Omit<RegisterData, 'userType'>): Promise<AuthResponse> {
    return this.register({ ...data, userType: 'creator' });
  }

  // Investor registration
  static async investorRegister(data: Omit<RegisterData, 'userType'>): Promise<AuthResponse> {
    return this.register({ ...data, userType: 'investor' });
  }

  // Production registration
  static async productionRegister(data: Omit<RegisterData, 'userType'>): Promise<AuthResponse> {
    return this.register({ ...data, userType: 'production' });
  }

  // Logout using Better Auth
  static async logout(): Promise<void> {
    try {
      // Use Better Auth signOut
      await authClient.signOut({
        fetchOptions: {
          redirect: false
        } as Record<string, unknown>
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clean up any remaining artifacts
      cleanupJWTArtifacts();
      
      // Clear all storage for clean slate
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        
        // Redirect to home
        window.location.href = '/';
      }
    }
  }

  // Validate session using Better Auth
  static async validateToken(): Promise<TokenValidation> {
    try {
      // Use Better Auth session check
      const { data: session } = await authClient.getSession();
      
      if (!session?.user) {
        cleanupJWTArtifacts();
        return { valid: false };
      }

      const sessionAny = session as Record<string, unknown>;
      return {
        valid: true,
        user: session.user as unknown as User,
        exp: sessionAny.expiresAt ? new Date(sessionAny.expiresAt as string | number).getTime() : undefined
      };
    } catch (_error) {
      cleanupJWTArtifacts();
      return { valid: false };
    }
  }

  // Check if user is authenticated using Better Auth
  static isAuthenticated(): boolean {
    // Better Auth handles this via cookies only
    // This is a sync check - for accurate check use validateToken() or getCurrentUser()
    const cookies = document.cookie.split(';');
    const hasSession = cookies.some(cookie => 
      cookie.trim().startsWith('pitchey-session=') || 
      cookie.trim().startsWith('better-auth.session_token=')
    );
    
    return hasSession;
  }

  // Get current user from Better Auth session
  static async getCurrentUser(): Promise<User | null> {
    try {
      const { data: session } = await authClient.getSession();
      
      if (!session?.user) {
        // Don't cleanup artifacts here - let explicit logout handle it
        return null;
      }

      return session.user as unknown as User;
    } catch {
      // Don't cleanup artifacts here - let explicit logout handle it
      return null;
    }
  }

  // Get user type from session
  static async getUserType(): Promise<string | null> {
    const user = await this.getCurrentUser();
    return user?.userType || null;
  }

  // Get auth headers (for backward compatibility with API calls expecting headers)
  static async getAuthHeaders(): Promise<Record<string, string>> {
    // Better Auth uses cookies, but we can add session ID for tracking
    const { data: session } = await authClient.getSession();

    const sessionAny = session as Record<string, unknown> | null;
    const sessionUserAny = session?.user as Record<string, unknown> | undefined;
    if (sessionAny?.id) {
      return {
        'X-Session-ID': String(sessionAny.id),
        'X-User-Type': (sessionUserAny?.userType as string) || ''
      };
    }

    return {};
  }

  // Permission check
  static async hasPermission(permission: string): Promise<boolean> {
    const user = await this.getCurrentUser();
    
    if (!user) return false;

    // Basic permission logic
    const permissions: Record<string, string[]> = {
      creator: ['create_pitch', 'edit_pitch', 'view_analytics'],
      investor: ['view_pitches', 'create_nda', 'make_investment'],
      production: ['view_pitches', 'create_nda', 'manage_projects'],
      admin: ['all']
    };

    const userPermissions = permissions[user.userType] || [];
    
    return userPermissions.includes('all') || userPermissions.includes(permission);
  }

  // Refresh session using Better Auth
  static async refreshSession(): Promise<boolean> {
    try {
      // Better Auth handles session refresh automatically
      // This forces a refresh check
      const { data: session } = await authClient.getSession({
        fetchOptions: {
          headers: {
            'X-Force-Refresh': 'true'
          }
        }
      });

      return !!session?.user;
    } catch {
      cleanupJWTArtifacts();
      return false;
    }
  }
}

// Clean up on module load
if (typeof window !== 'undefined') {
  cleanupJWTArtifacts();
}