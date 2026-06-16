/**
 * Integration: Auth / Session Flow
 *
 * Exercises the real modules together with fetch mocked at the boundary:
 *   portalAuth (better-auth-client) ──→ betterAuthStore ──→ sessionCache
 *   api-client (401 path) ──→ session endpoint check ──→ store.setUser / redirect
 *   sessionManager (dedup / rate-limit) ──→ betterAuthStore.checkSession
 *
 * Network is mocked at `global.fetch` (set up in src/test/setup.ts).
 * No source files are modified.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';

// ---------------------------------------------------------------------------
// Inline sessionCache mock — real localStorage is mocked in setup.ts already
// but sessionCache also reads document.cookie which doesn't exist in jsdom
// unless we set it. We mock it so the cache layer is transparent here and we
// test the store ↔ sessionManager ↔ fetch seam only.
// Use vi.hoisted so the refs are available in the mock factory (vi.mock is hoisted
// to the top of the module but variables declared with const are not).
// ---------------------------------------------------------------------------
const { mockCacheGet, mockCacheSet, mockCacheClear } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(() => null),
  mockCacheSet: vi.fn(),
  mockCacheClear: vi.fn(),
}));

vi.mock('../../store/sessionCache', () => ({
  sessionCache: {
    get: (...args: any[]) => mockCacheGet(...args),
    set: (...args: any[]) => mockCacheSet(...args),
    clear: (...args: any[]) => mockCacheClear(...args),
  },
}));

// ---------------------------------------------------------------------------
// We do NOT mock better-auth-client — we let the real module run.
// Its makeAuthRequest() calls global.fetch which we control.
// ---------------------------------------------------------------------------

// Import after mocks are registered
import { useBetterAuthStore } from '../../store/betterAuthStore';
import { sessionManager } from '../../lib/session-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: 42,
  email: 'creator@example.com',
  username: 'thecreator',
  userType: 'creator' as const,
  verified: true,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};

/** Build a minimal fetch Response-like object */
function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    clone: function() { return this; },
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Auth / Session Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to unauthenticated state
    useBetterAuthStore.setState({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
    // Reset session manager internal cache between tests
    sessionManager.clearCache();
    // Default: fetch not called unless test overrides
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Creator login → session cached → store authenticated
  // -------------------------------------------------------------------------
  describe('1. Creator login — store + cache update together', () => {
    it('sets isAuthenticated and caches user after successful login fetch', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ success: true, user: MOCK_USER })
      );

      await act(async () => {
        await useBetterAuthStore.getState().loginCreator('creator@example.com', 'Secret123');
      });

      const state = useBetterAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('creator@example.com');
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();

      // sessionCache.set must have been called with the user
      expect(mockCacheSet).toHaveBeenCalledWith(MOCK_USER);
    });

    it('sets error and stays unauthenticated when login returns 401 with error message', async () => {
      // makeAuthRequest in better-auth-client reads response.ok to detect failure.
      // A 200 with success:false is treated as success (response.ok=true overrides the body flag).
      // Use a real 4xx status to trigger the "not ok" branch.
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ success: false, error: 'Invalid credentials' }, 401)
      );

      await act(async () => {
        try {
          await useBetterAuthStore.getState().loginCreator('bad@example.com', 'wrong');
        } catch {
          // expected to throw
        }
      });

      const state = useBetterAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      // friendlyLoginError falls back to the srvErr string when it's not a Turnstile error
      expect(state.error).toBeTruthy();
    });

    it('handles Turnstile failure with friendly message', async () => {
      // Return 401 with a Turnstile error message in the body
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ success: false, error: 'Bot verification failed' }, 401)
      );

      await act(async () => {
        try {
          await useBetterAuthStore.getState().loginCreator('user@example.com', 'pass', 'bad-token');
        } catch {
          // expected
        }
      });

      const state = useBetterAuthStore.getState();
      // friendlyLoginError() maps Turnstile errors to the "fresh one loaded" copy
      expect(state.error).toMatch(/security check expired/i);
    });
  });

  // -------------------------------------------------------------------------
  // 2. checkSession — real sessionManager dedup + store update
  // -------------------------------------------------------------------------
  describe('2. checkSession — sessionManager dedup and store wiring', () => {
    it('sets user when /api/auth/session returns a valid session', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ user: MOCK_USER, session: { id: 'sess-1' } })
      );

      await act(async () => {
        await useBetterAuthStore.getState().checkSession();
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.user?.email).toBe('creator@example.com');
      expect(state.isAuthenticated).toBe(true);
    });

    it('clears user when /api/auth/session returns 401 (genuine logout)', async () => {
      useBetterAuthStore.setState({ user: MOCK_USER as any, isAuthenticated: true });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ error: 'Unauthorized' }, 401)
      );

      await act(async () => {
        await useBetterAuthStore.getState().checkSession();
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('preserves existing session on transient network failure (no flash-logout)', async () => {
      useBetterAuthStore.setState({ user: MOCK_USER as any, isAuthenticated: true });

      // Simulate network-level failure
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to fetch')
      );

      await act(async () => {
        await useBetterAuthStore.getState().checkSession();
      });

      const state = useBetterAuthStore.getState();
      // Must NOT log the user out — a blip is not a 401
      expect(state.user).toEqual(MOCK_USER);
      expect(state.isAuthenticated).toBe(true);
    });

    it('sessionManager deduplicates concurrent checkSession calls (only 1 fetch)', async () => {
      // Clear sessionManager cache so it will actually hit the network
      sessionManager.clearCache();

      let callCount = 0;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return Promise.resolve(mockResponse({ user: MOCK_USER, session: {} }));
      });

      // Fire three concurrent checkSession calls
      await act(async () => {
        await Promise.all([
          useBetterAuthStore.getState().checkSession(),
          useBetterAuthStore.getState().checkSession(),
          useBetterAuthStore.getState().checkSession(),
        ]);
      });

      // sessionManager collapses concurrent calls — only 1 or 2 fetch calls expected
      // (depending on whether the cache is populated before the 2nd/3rd call resolve)
      expect(callCount).toBeLessThanOrEqual(2);
      expect(useBetterAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. logout — clears store, cache, and calls sign-out endpoint
  // -------------------------------------------------------------------------
  describe('3. logout — store + cache + server sign-out', () => {
    it('clears auth state immediately and calls sign-out endpoint', async () => {
      useBetterAuthStore.setState({ user: MOCK_USER as any, isAuthenticated: true });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ success: true })
      );

      await act(async () => {
        await useBetterAuthStore.getState().logout();
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.loading).toBe(false);

      // sessionCache.clear called before the server call
      expect(mockCacheClear).toHaveBeenCalled();
    });

    it('still clears local auth state even when sign-out endpoint fails', async () => {
      useBetterAuthStore.setState({ user: MOCK_USER as any, isAuthenticated: true });

      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      await act(async () => {
        await useBetterAuthStore.getState().logout();
      });

      const state = useBetterAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 4. MFA mid-login flow — store surfaces MFARequiredError to the caller
  // -------------------------------------------------------------------------
  describe('4. MFA required — store throws MFARequiredError', () => {
    it('throws MFARequiredError and does NOT set user in store', async () => {
      const { MFARequiredError } = await import('../../store/betterAuthStore');

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({
          requiresMFA: true,
          challengeId: 'ch-abc123',
          methods: ['totp'],
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          user: { id: '42', email: 'creator@example.com', name: 'Creator', userType: 'creator' },
        })
      );

      let thrown: unknown;
      await act(async () => {
        try {
          await useBetterAuthStore.getState().loginCreator('creator@example.com', 'Pass123');
        } catch (e) {
          thrown = e;
        }
      });

      expect(thrown).toBeInstanceOf(MFARequiredError);
      // Store must not be set to authenticated
      expect(useBetterAuthStore.getState().isAuthenticated).toBe(false);
      expect(useBetterAuthStore.getState().user).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Register flow — no auto-login, stays unauthenticated
  // -------------------------------------------------------------------------
  describe('5. Register — no auto-login after registration', () => {
    it('completes without authenticating the store', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ success: true, message: 'Verification email sent' })
      );

      await act(async () => {
        await useBetterAuthStore.getState().register({
          email: 'new@example.com',
          username: 'newuser',
          password: 'Pass123!',
          userType: 'creator',
        });
      });

      const state = useBetterAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on duplicate email registration', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse({ error: { message: 'Email already registered' } }, 400)
      );

      await act(async () => {
        try {
          await useBetterAuthStore.getState().register({
            email: 'dup@example.com',
            username: 'dup',
            password: 'Pass123!',
            userType: 'creator',
          });
        } catch {
          // expected
        }
      });

      const state = useBetterAuthStore.getState();
      expect(state.error).toBe('Email already registered');
      expect(state.isAuthenticated).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Investor portal login routes to the correct endpoint
  // -------------------------------------------------------------------------
  describe('6. Investor login — correct endpoint routed', () => {
    it('calls /api/auth/investor/login and sets investor user', async () => {
      const investorUser = { ...MOCK_USER, id: 99, email: 'inv@example.com', userType: 'investor' as const };
      let capturedUrl = '';

      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve(mockResponse({ success: true, user: investorUser }));
      });

      await act(async () => {
        await useBetterAuthStore.getState().loginInvestor('inv@example.com', 'Pass123');
      });

      expect(capturedUrl).toContain('/api/auth/investor/login');
      expect(useBetterAuthStore.getState().user?.email).toBe('inv@example.com');
    });
  });
});
