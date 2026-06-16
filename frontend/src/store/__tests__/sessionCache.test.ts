import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to control document.cookie and localStorage manually
// The setup.ts already mocks localStorage, so we build on that.

// Helper to set document.cookie to contain a pitchey-session value
function setSessionCookie(value: string | null) {
  if (value === null) {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  } else {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: `pitchey-session=${value}; Path=/`,
    });
  }
}

const SESSION_CACHE_KEY = 'better-auth-session-cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function makeStoredSession(
  user: unknown,
  {
    ageMs = 0,
    fingerprint = 'abcdef1234567890',
  }: { ageMs?: number; fingerprint?: string } = {}
) {
  return JSON.stringify({
    user,
    timestamp: Date.now() - ageMs,
    cookieFingerprint: fingerprint,
  });
}

describe('sessionCache', () => {
  let sessionCache: typeof import('../sessionCache').sessionCache;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset cookie to empty
    setSessionCookie(null);
    // Re-import the module fresh per test so module-level state is clean
    vi.resetModules();
    const mod = await import('../sessionCache');
    sessionCache = mod.sessionCache;
  });

  // =========================================================================
  // set()
  // =========================================================================
  describe('set()', () => {
    it('writes a serialised session to localStorage', () => {
      setSessionCookie('abc123def456ghi7');
      sessionCache.set({ id: 1, name: 'Alice' });

      expect(localStorage.setItem).toHaveBeenCalled();
      const [key, value] = (localStorage.setItem as any).mock.calls[0];
      expect(key).toBe(SESSION_CACHE_KEY);
      const parsed = JSON.parse(value);
      expect(parsed.user).toEqual({ id: 1, name: 'Alice' });
      expect(typeof parsed.timestamp).toBe('number');
    });

    it('stores a cookie fingerprint', () => {
      setSessionCookie('abcdef1234567890xyz');
      sessionCache.set({ id: 1 });

      const [, value] = (localStorage.setItem as any).mock.calls[0];
      const parsed = JSON.parse(value);
      // fingerprint = first 16 chars of cookie value
      expect(parsed.cookieFingerprint).toBe('abcdef1234567890');
    });

    it('stores null user without throwing', () => {
      setSessionCookie('abc123def456ghi7');
      expect(() => sessionCache.set(null)).not.toThrow();
    });

    it('silently ignores localStorage errors', () => {
      (localStorage.setItem as any).mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      setSessionCookie('abc123def456ghi7');
      expect(() => sessionCache.set({ id: 1 })).not.toThrow();
    });
  });

  // =========================================================================
  // get()
  // =========================================================================
  describe('get()', () => {
    it('returns null when pitchey-session cookie is absent', () => {
      setSessionCookie(null);
      (localStorage.getItem as any).mockReturnValue(
        makeStoredSession({ id: 1 }, { ageMs: 0, fingerprint: 'abcdef1234567890' })
      );
      const result = sessionCache.get();
      expect(result).toBeNull();
    });

    it('calls clear() when cookie is missing', () => {
      setSessionCookie(null);
      (localStorage.getItem as any).mockReturnValue(
        makeStoredSession({ id: 1 })
      );
      sessionCache.get();
      // clear() calls localStorage.removeItem
      expect(localStorage.removeItem).toHaveBeenCalledWith(SESSION_CACHE_KEY);
    });

    it('returns null when localStorage has no entry', () => {
      setSessionCookie('abc123def456ghi7');
      (localStorage.getItem as any).mockReturnValue(null);
      expect(sessionCache.get()).toBeNull();
    });

    it('returns null when cache is expired (> 5 min)', () => {
      setSessionCookie('abcdef1234567890xyz');
      const expiredAge = CACHE_DURATION + 1000;
      (localStorage.getItem as any).mockReturnValue(
        makeStoredSession({ id: 1 }, { ageMs: expiredAge, fingerprint: 'abcdef1234567890' })
      );
      expect(sessionCache.get()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith(SESSION_CACHE_KEY);
    });

    it('returns session when cache is fresh and cookie matches', () => {
      setSessionCookie('abcdef1234567890xyz');
      (localStorage.getItem as any).mockReturnValue(
        makeStoredSession({ id: 42 }, { ageMs: 1000, fingerprint: 'abcdef1234567890' })
      );
      const result = sessionCache.get();
      expect(result).not.toBeNull();
      expect((result as any).user).toEqual({ id: 42 });
    });

    it('returns null when cookie fingerprint has changed', () => {
      // Cookie now has a different first 16 chars than what was cached
      setSessionCookie('NEWVALUE12345678xyz');
      (localStorage.getItem as any).mockReturnValue(
        makeStoredSession({ id: 1 }, { ageMs: 0, fingerprint: 'OLDVALUE12345678' })
      );
      expect(sessionCache.get()).toBeNull();
      // clear() should have been called
      expect(localStorage.removeItem).toHaveBeenCalledWith(SESSION_CACHE_KEY);
    });

    it('returns session when cached fingerprint is empty (no prior cookie)', () => {
      setSessionCookie('abcdef1234567890xyz');
      (localStorage.getItem as any).mockReturnValue(
        makeStoredSession({ id: 1 }, { ageMs: 0, fingerprint: '' })
      );
      // When stored fingerprint is empty the guard is skipped — session is returned
      const result = sessionCache.get();
      expect(result).not.toBeNull();
    });

    it('returns null on JSON parse error', () => {
      setSessionCookie('abc123def456ghi7');
      (localStorage.getItem as any).mockReturnValue('NOT_VALID_JSON{{{');
      expect(sessionCache.get()).toBeNull();
    });

    it('returns session timestamped at exactly CACHE_DURATION - 1 ms (boundary)', () => {
      setSessionCookie('abcdef1234567890xyz');
      const edgeAge = CACHE_DURATION - 1;
      (localStorage.getItem as any).mockReturnValue(
        makeStoredSession({ id: 99 }, { ageMs: edgeAge, fingerprint: 'abcdef1234567890' })
      );
      const result = sessionCache.get();
      expect(result).not.toBeNull();
    });
  });

  // =========================================================================
  // clear()
  // =========================================================================
  describe('clear()', () => {
    it('removes the cache key from localStorage', () => {
      sessionCache.clear();
      expect(localStorage.removeItem).toHaveBeenCalledWith(SESSION_CACHE_KEY);
    });

    it('does not throw when localStorage.removeItem throws', () => {
      (localStorage.removeItem as any).mockImplementationOnce(() => {
        throw new Error('Storage error');
      });
      expect(() => sessionCache.clear()).not.toThrow();
    });
  });
});
