/**
 * Better Auth Store - Replaces the legacy authStore
 * Uses Better Auth's session management via cookies
 * No localStorage, no JWT tokens, no manual session checks
 */

import { create } from 'zustand';
import type { User } from '@shared/types';
import { portalAuth } from '../lib/better-auth-client';
import { sessionCache } from './sessionCache';
import { sessionManager } from '../lib/session-manager';

interface BetterAuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Sign in methods for each portal
  loginCreator: (email: string, password: string) => Promise<void>;
  loginInvestor: (email: string, password: string) => Promise<void>;
  loginProduction: (email: string, password: string) => Promise<void>;
  
  // Generic login (determines portal from user data)
  login: (email: string, password: string) => Promise<void>;
  
  // Registration
  register: (data: {
    email: string;
    username: string;
    password: string;
    userType: string;
    companyName?: string;
  }) => Promise<void>;
  
  // Sign out
  logout: () => Promise<void>;
  
  // Session management - passive, no active fetching
  setUser: (user: User | null) => void;
  clearError: () => void;
  checkSession: () => Promise<void>;
}

// Initialize auth state from cache immediately to prevent flicker
const getCachedAuthState = () => {
  const cached = sessionCache.get();
  if (cached && cached.user) {
    return {
      user: cached.user as User,
      isAuthenticated: true,
      loading: true, // Must validate with backend before trusting cache
      error: null
    };
  }
  return {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  };
};

export const useBetterAuthStore = create<BetterAuthState>((set) => ({
  ...getCachedAuthState(), // Initialize from cache

  loginCreator: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await portalAuth.signInCreator(email, password);
      // Handle both response.user and response.data.user formats
      const user = response.user || response.data?.user;
      const token = response.token || response.data?.token;
      
      if (!user) {
        throw new Error('User data not received from server');
      }
      
      // NOTE: We no longer store JWT tokens in localStorage
      // Session cookies are the only auth mechanism (managed by Better Auth)
      // This prevents auth mixing bugs when switching portals

      sessionCache.set(user); // Cache the user session
      sessionManager.updateCache(user); // Update session manager cache
      if (user.userType) localStorage.setItem('userType', user.userType);
      set({ user: user as User, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Login failed',
        loading: false
      });
      throw error;
    }
  },

  loginInvestor: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await portalAuth.signInInvestor(email, password);
      // Handle both response.user and response.data.user formats
      const user = response.user || response.data?.user;

      if (!user) {
        throw new Error('User data not received from server');
      }

      // NOTE: We no longer store JWT tokens in localStorage
      // Session cookies are the only auth mechanism (managed by Better Auth)

      sessionCache.set(user); // Cache the user session
      sessionManager.updateCache(user); // Update session manager cache
      if (user.userType) localStorage.setItem('userType', user.userType);
      set({ user: user as User, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Login failed',
        loading: false
      });
      throw error;
    }
  },

  loginProduction: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await portalAuth.signInProduction(email, password);
      // Handle both response.user and response.data.user formats
      const user = response.user || response.data?.user;

      if (!user) {
        throw new Error('User data not received from server');
      }

      // NOTE: We no longer store JWT tokens in localStorage
      // Session cookies are the only auth mechanism (managed by Better Auth)

      sessionCache.set(user); // Cache the user session
      sessionManager.updateCache(user); // Update session manager cache
      if (user.userType) localStorage.setItem('userType', user.userType);
      set({ user: user as User, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Login failed',
        loading: false
      });
      throw error;
    }
  },

  login: async (email: string, password: string) => {
    // Generic login - let the server determine the portal
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      const user = data.user;
      
      if (!user) {
        throw new Error('User data not received from server');
      }
      
      sessionCache.set(user); // Cache the user session
      sessionManager.updateCache(user); // Update session manager cache
      if (user.userType) localStorage.setItem('userType', user.userType);
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Login failed',
        loading: false 
      });
      throw error;
    }
  },

  register: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || 'Registration failed');
      }

      // Don't auto-login — user must verify email first
      // Register.tsx will show the "check your inbox" UI
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Registration failed',
        loading: false
      });
      throw error;
    }
  },

  logout: async () => {
    // Clear all caches FIRST (synchronous, immediate) to prevent stale reads
    sessionCache.clear();
    sessionManager.clearCache();
    localStorage.removeItem('userType');
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    set({ user: null, isAuthenticated: false, loading: true, error: null });

    try {
      await portalAuth.signOut();
    } catch (error) {
      console.warn('[BetterAuthStore] Server logout failed:', error);
    } finally {
      set({ loading: false });
    }
  },

  setUser: (user: User | null) => {
    set({ 
      user, 
      isAuthenticated: !!user,
      loading: false 
    });
  },

  clearError: () => {
    set({ error: null });
  },

  checkSession: async () => {
    try {
      // Use session manager to prevent rate limiting, but always hit the API
      // (don't trust localStorage cache as ground truth)
      const result = await sessionManager.checkSession(async () => {
        try {
          const session = await portalAuth.getSession();
          const user = session?.user || null;
          if (user) {
            sessionCache.set(user);
          } else {
            sessionCache.clear();
          }
          return user;
        } catch {
          sessionCache.clear();
          return null;
        }
      });

      // Update state based on result
      set({
        user: result.user || null,
        isAuthenticated: !!result.user,
        loading: false,
        error: null
      });
    } catch {
      sessionCache.clear();
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null
      });
    }
  }
}));

/**
 * Hook to passively check Better Auth session
 * This does NOT trigger fetches or cause re-renders
 */
export async function checkBetterAuthSession(): Promise<User | null> {
  try {
    const session = await portalAuth.getSession();
    return (session?.user as User) || null;
  } catch {
    return null;
  }
}