import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';

// Mock dependencies BEFORE importing the store
const mockSignInCreator = vi.fn();
const mockSignInInvestor = vi.fn();
const mockSignInProduction = vi.fn();
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../../lib/better-auth-client', () => ({
  portalAuth: {
    signInCreator: (...args: any[]) => mockSignInCreator(...args),
    signInInvestor: (...args: any[]) => mockSignInInvestor(...args),
    signInProduction: (...args: any[]) => mockSignInProduction(...args),
    getSession: (...args: any[]) => mockGetSession(...args),
    signOut: (...args: any[]) => mockSignOut(...args),
  },
}));

vi.mock('../sessionCache', () => ({
  sessionCache: {
    get: vi.fn(() => null),
    set: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('../../lib/session-manager', () => ({
  sessionManager: {
    checkSession: vi.fn(async (fn: () => Promise<any>) => {
      const user = await fn();
      return { success: !!user, user, timestamp: Date.now() };
    }),
    updateCache: vi.fn(),
    clearCache: vi.fn(),
  },
}));

import { useBetterAuthStore } from '../betterAuthStore';
import { sessionCache } from '../sessionCache';
import { sessionManager } from '../../lib/session-manager';

const mockUser = {
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  userType: 'creator' as const,
  verified: true,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

describe('betterAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useBetterAuthStore.setState({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ========================================================================
  // Initial state
  // ========================================================================
  describe('initial state', () => {
    it('has null user', () => {
      expect(useBetterAuthStore.getState().user).toBeNull();
    });

    it('is not authenticated', () => {
      expect(useBetterAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('has no error', () => {
      expect(useBetterAuthStore.getState().error).toBeNull();
    });
  });

  // ========================================================================
  // loginCreator
  // ========================================================================
  describe('loginCreator', () => {
    it('sets user and isAuthenticated on success', async () => {
      mockSignInCreator.mockResolvedValue({ user: mockUser });

      await act(async () => {
        await useBetterAuthStore.getState().loginCreator('test@example.com', 'pass');
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('caches session on success', async () => {
      mockSignInCreator.mockResolvedValue({ user: mockUser });

      await act(async () => {
        await useBetterAuthStore.getState().loginCreator('test@example.com', 'pass');
      });

      expect(sessionCache.set).toHaveBeenCalledWith(mockUser);
    });

    it('sets error on failure', async () => {
      mockSignInCreator.mockRejectedValue(new Error('Invalid credentials'));

      await act(async () => {
        try {
          await useBetterAuthStore.getState().loginCreator('bad@example.com', 'wrong');
        } catch {
          // expected
        }
      });

      const state = useBetterAuthStore.getState();
      expect(state.error).toBe('Invalid credentials');
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });

    it('throws error when user data not received', async () => {
      mockSignInCreator.mockResolvedValue({ user: null });

      await expect(
        useBetterAuthStore.getState().loginCreator('test@example.com', 'pass')
      ).rejects.toThrow('User data not received');
    });

    it('handles response.data.user format', async () => {
      mockSignInCreator.mockResolvedValue({ data: { user: mockUser } });

      await act(async () => {
        await useBetterAuthStore.getState().loginCreator('test@example.com', 'pass');
      });

      expect(useBetterAuthStore.getState().user).toEqual(mockUser);
    });
  });

  // ========================================================================
  // loginInvestor
  // ========================================================================
  describe('loginInvestor', () => {
    it('calls signInInvestor and sets user', async () => {
      const investorUser = { ...mockUser, userType: 'investor' as const };
      mockSignInInvestor.mockResolvedValue({ user: investorUser });

      await act(async () => {
        await useBetterAuthStore.getState().loginInvestor('inv@example.com', 'pass');
      });

      expect(mockSignInInvestor).toHaveBeenCalledWith('inv@example.com', 'pass', undefined);
      expect(useBetterAuthStore.getState().user?.userType).toBe('investor');
    });

    it('sets error on failure', async () => {
      mockSignInInvestor.mockRejectedValue(new Error('Login failed'));

      await act(async () => {
        try {
          await useBetterAuthStore.getState().loginInvestor('bad@example.com', 'wrong');
        } catch {
          // expected
        }
      });

      expect(useBetterAuthStore.getState().error).toBe('Login failed');
    });
  });

  // ========================================================================
  // loginProduction
  // ========================================================================
  describe('loginProduction', () => {
    it('calls signInProduction and sets user', async () => {
      const prodUser = { ...mockUser, userType: 'production' as const };
      mockSignInProduction.mockResolvedValue({ user: prodUser });

      await act(async () => {
        await useBetterAuthStore.getState().loginProduction('prod@example.com', 'pass');
      });

      expect(mockSignInProduction).toHaveBeenCalledWith('prod@example.com', 'pass', undefined);
      expect(useBetterAuthStore.getState().user?.userType).toBe('production');
    });
  });

  // ========================================================================
  // login (generic)
  // ========================================================================
  describe('login', () => {
    it('sets user on successful login', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      }) as any;

      await act(async () => {
        await useBetterAuthStore.getState().login('test@example.com', 'pass');
      });

      expect(useBetterAuthStore.getState().user).toEqual(mockUser);
      expect(useBetterAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('sets error when response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }) as any;

      await act(async () => {
        try {
          await useBetterAuthStore.getState().login('test@example.com', 'pass');
        } catch {
          // expected
        }
      });

      expect(useBetterAuthStore.getState().error).toBe('Login failed');
    });

    it('throws when user data not received', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ user: null }),
      }) as any;

      await expect(
        useBetterAuthStore.getState().login('test@example.com', 'pass')
      ).rejects.toThrow('User data not received');
    });
  });

  // ========================================================================
  // register
  // ========================================================================
  describe('register', () => {
    it('completes successfully without auto-login', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      }) as any;

      await act(async () => {
        await useBetterAuthStore.getState().register({
          email: 'new@example.com',
          username: 'newuser',
          password: 'Pass123',
          userType: 'creator',
        });
      });

      const state = useBetterAuthStore.getState();
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('sets error on failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Email taken' } }),
      }) as any;

      await act(async () => {
        try {
          await useBetterAuthStore.getState().register({
            email: 'dup@example.com',
            username: 'dup',
            password: 'Pass123',
            userType: 'creator',
          });
        } catch {
          // expected
        }
      });

      expect(useBetterAuthStore.getState().error).toBe('Email taken');
    });

    it('uses generic error when JSON parsing fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error('parse error')),
      }) as any;

      await act(async () => {
        try {
          await useBetterAuthStore.getState().register({
            email: 'fail@example.com',
            username: 'fail',
            password: 'Pass123',
            userType: 'creator',
          });
        } catch {
          // expected
        }
      });

      expect(useBetterAuthStore.getState().error).toBe('Registration failed');
    });
  });

  // ========================================================================
  // logout
  // ========================================================================
  describe('logout', () => {
    it('clears user state', async () => {
      // Set up authenticated state
      useBetterAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      mockSignOut.mockResolvedValue({ success: true });

      await act(async () => {
        await useBetterAuthStore.getState().logout();
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.loading).toBe(false);
    });

    it('clears session cache', async () => {
      mockSignOut.mockResolvedValue({ success: true });

      await act(async () => {
        await useBetterAuthStore.getState().logout();
      });

      expect(sessionCache.clear).toHaveBeenCalled();
      expect(sessionManager.clearCache).toHaveBeenCalled();
    });

    it('handles server logout failure gracefully', async () => {
      mockSignOut.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await useBetterAuthStore.getState().logout();
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.loading).toBe(false);
    });
  });

  // ========================================================================
  // setUser / clearError
  // ========================================================================
  describe('setUser', () => {
    it('sets user and isAuthenticated', () => {
      act(() => {
        useBetterAuthStore.getState().setUser(mockUser);
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('clears user when set to null', () => {
      useBetterAuthStore.setState({ user: mockUser, isAuthenticated: true });

      act(() => {
        useBetterAuthStore.getState().setUser(null);
      });

      expect(useBetterAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('clearError', () => {
    it('clears the error', () => {
      useBetterAuthStore.setState({ error: 'Some error' });

      act(() => {
        useBetterAuthStore.getState().clearError();
      });

      expect(useBetterAuthStore.getState().error).toBeNull();
    });
  });

  // ========================================================================
  // checkSession
  // ========================================================================
  describe('checkSession', () => {
    it('sets user when session is valid', async () => {
      mockGetSession.mockResolvedValue({ user: mockUser });

      await act(async () => {
        await useBetterAuthStore.getState().checkSession();
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('clears user when session is invalid', async () => {
      useBetterAuthStore.setState({ user: mockUser, isAuthenticated: true });
      mockGetSession.mockResolvedValue(null);

      await act(async () => {
        await useBetterAuthStore.getState().checkSession();
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('handles session check errors gracefully', async () => {
      vi.mocked(sessionManager.checkSession).mockRejectedValue(new Error('fail'));

      await act(async () => {
        await useBetterAuthStore.getState().checkSession();
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.loading).toBe(false);
    });
  });
});
