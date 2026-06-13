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

// Map a raw server auth error to user-facing copy. Turnstile tokens are
// single-use and ~5-min-lived; a stale one returns "Bot verification failed",
// which reads like a broken login. The login pages auto-reset the widget on
// error, so tell the user it self-healed and to retry in place. Shared by all
// portal sign-in methods so every portal shows the same friendly message.
function friendlyLoginError(srvErr?: string | null): string {
  if (srvErr && /turnstile|bot verification|verification failed|captcha|security check/i.test(srvErr)) {
    return 'Your security check expired. A fresh one just loaded — please tap Sign in again.';
  }
  return srvErr || 'Login failed. Please complete the captcha above and try again.';
}

/**
 * Thrown when login succeeds but MFA verification is required.
 * Catch this in login pages to redirect to /mfa/challenge.
 */
export class MFARequiredError extends Error {
  challengeId: string;
  methods: string[];
  expiresAt: string;
  user: { id: string; email: string; name: string; userType: string };

  constructor(data: { challengeId: string; methods: string[]; expiresAt: string; user: { id: string; email: string; name: string; userType: string } }) {
    super('MFA verification required');
    this.name = 'MFARequiredError';
    this.challengeId = data.challengeId;
    this.methods = data.methods;
    this.expiresAt = data.expiresAt;
    this.user = data.user;
  }
}

interface BetterAuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Sign in methods for each portal
  loginCreator: (email: string, password: string, turnstileToken?: string) => Promise<void>;
  loginInvestor: (email: string, password: string, turnstileToken?: string) => Promise<void>;
  loginProduction: (email: string, password: string, turnstileToken?: string) => Promise<void>;
  loginWatcher: (email: string, password: string, turnstileToken?: string) => Promise<void>;

  // Generic login (determines portal from user data)
  login: (email: string, password: string, turnstileToken?: string) => Promise<void>;

  // Registration
  register: (data: {
    email: string;
    username: string;
    password: string;
    userType: string;
    companyName?: string;
    turnstileToken?: string;
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

  loginCreator: async (email: string, password: string, turnstileToken?: string) => {
    set({ loading: true, error: null });
    try {
      const response = await portalAuth.signInCreator(email, password, turnstileToken);
      // Check if MFA is required
      const raw = response as any;
      if (raw.requiresMFA) {
        set({ loading: false });
        throw new MFARequiredError(raw);
      }
      if (response.success === false) {
        const srvErr = typeof response.error === 'string' ? response.error : (response.error as any)?.message;
        throw new Error(friendlyLoginError(srvErr));
      }
      const user = response.user || response.data?.user;
      if (!user) throw new Error('Login response was incomplete. Please try again.');
      sessionCache.set(user);
      sessionManager.updateCache(user);
      set({ user: user as User, isAuthenticated: true, loading: false });
    } catch (error: any) {
      if (error instanceof MFARequiredError) throw error;
      set({ error: error.message || 'Login failed', loading: false });
      throw error;
    }
  },

  loginInvestor: async (email: string, password: string, turnstileToken?: string) => {
    set({ loading: true, error: null });
    try {
      const response = await portalAuth.signInInvestor(email, password, turnstileToken);
      const raw = response as any;
      if (raw.requiresMFA) {
        set({ loading: false });
        throw new MFARequiredError(raw);
      }
      if (response.success === false) {
        const srvErr = typeof response.error === 'string' ? response.error : (response.error as any)?.message;
        throw new Error(friendlyLoginError(srvErr));
      }
      const user = response.user || response.data?.user;
      if (!user) throw new Error('Login response was incomplete. Please try again.');
      sessionCache.set(user);
      sessionManager.updateCache(user);
      set({ user: user as User, isAuthenticated: true, loading: false });
    } catch (error: any) {
      if (error instanceof MFARequiredError) throw error;
      set({ error: error.message || 'Login failed', loading: false });
      throw error;
    }
  },

  loginProduction: async (email: string, password: string, turnstileToken?: string) => {
    set({ loading: true, error: null });
    try {
      const response = await portalAuth.signInProduction(email, password, turnstileToken);
      const raw = response as any;
      if (raw.requiresMFA) {
        set({ loading: false });
        throw new MFARequiredError(raw);
      }
      if (response.success === false) {
        const srvErr = typeof response.error === 'string' ? response.error : (response.error as any)?.message;
        throw new Error(friendlyLoginError(srvErr));
      }
      const user = response.user || response.data?.user;
      if (!user) throw new Error('Login response was incomplete. Please try again.');
      sessionCache.set(user);
      sessionManager.updateCache(user);
      set({ user: user as User, isAuthenticated: true, loading: false });
    } catch (error: any) {
      if (error instanceof MFARequiredError) throw error;
      set({ error: error.message || 'Login failed', loading: false });
      throw error;
    }
  },

  loginWatcher: async (email: string, password: string, turnstileToken?: string) => {
    set({ loading: true, error: null });
    try {
      const response = await portalAuth.signInWatcher(email, password, turnstileToken);
      const raw = response as any;
      if (raw.requiresMFA) {
        set({ loading: false });
        throw new MFARequiredError(raw);
      }
      if (response.success === false) {
        const srvErr = typeof response.error === 'string' ? response.error : (response.error as any)?.message;
        throw new Error(friendlyLoginError(srvErr));
      }
      const user = response.user || response.data?.user;
      if (!user) throw new Error('Login response was incomplete. Please try again.');
      sessionCache.set(user);
      sessionManager.updateCache(user);
      set({ user: user as User, isAuthenticated: true, loading: false });
    } catch (error: any) {
      if (error instanceof MFARequiredError) throw error;
      set({ error: error.message || 'Login failed', loading: false });
      throw error;
    }
  },

  login: async (email: string, password: string, turnstileToken?: string) => {
    // Generic login - let the server determine the portal
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();

      // Check MFA requirement
      if (data.requiresMFA) {
        set({ loading: false });
        throw new MFARequiredError({ challengeId: data.challengeId, methods: data.methods, expiresAt: data.expiresAt, user: data.user });
      }

      const user = data.user;
      if (!user) throw new Error('User data not received from server');
      sessionCache.set(user);
      sessionManager.updateCache(user);
      set({ user, isAuthenticated: true, loading: false });
    } catch (error: any) {
      if (error instanceof MFARequiredError) throw error;
      set({ error: error.message || 'Login failed', loading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ loading: true, error: null });
    try {
      const { turnstileToken, ...registrationData } = data;
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...registrationData, turnstileToken }),
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
        // getSession returns null only on a definitive 401/403 (genuine logout)
        // and THROWS on transient failures (network/5xx). Let the throw propagate
        // so performCheck reports success:false and the store preserves the
        // existing session instead of clearing it. Do NOT swallow it here — that
        // was converting transient blips into logouts and flashing the old login
        // page mid-navigation.
        const session = await portalAuth.getSession();
        const user = session?.user || null;
        if (user) {
          sessionCache.set(user);
        } else {
          sessionCache.clear();
        }
        return user;
      });

      // Transient check failure (network blip / 5xx — e.g. a cold-start DB error
      // bubbling up as a 500). performCheck returns success:false here, distinct
      // from a genuine empty session (success:true, user:null). Do NOT log the
      // user out: flipping isAuthenticated false makes route guards bounce to
      // /login/<portal>, which flashes the old login page mid-navigation before
      // the next check restores state. Preserve current state; the next check
      // (or the 60s session-manager cache) reconciles.
      if (!result.success) {
        set({ loading: false });
        return;
      }

      // Detect userType mismatch (stale cache from previous login)
      const currentUser = useBetterAuthStore.getState().user;
      if (result.user && currentUser &&
          (result.user as any).userType !== (currentUser as any).userType) {
        sessionCache.clear();
        sessionCache.set(result.user);
      }

      // Update state based on result
      set({
        user: result.user || null,
        isAuthenticated: !!result.user,
        loading: false,
        error: null
      });

      // Redeem pending referral invite if present
      if (result.user) {
        const pendingCode = localStorage.getItem('pendingInviteCode');
        if (pendingCode) {
          localStorage.removeItem('pendingInviteCode');
          fetch(`${import.meta.env.VITE_API_URL || ''}/api/invites/${pendingCode}/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: '{}'
          }).catch(() => {}); // fire-and-forget
        }
      }
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