import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSafeReturnPath,
  getPostLoginRedirect,
  setPendingReturnTo,
  consumePendingReturnTo,
  resolvePostLoginRedirect,
} from '../postLoginRedirect';

const PENDING_KEY = 'pitchey:pendingReturnTo';

// Reset localStorage mock before each test
beforeEach(() => {
  (localStorage.getItem as ReturnType<typeof vi.fn>).mockReset();
  (localStorage.setItem as ReturnType<typeof vi.fn>).mockReset();
  (localStorage.removeItem as ReturnType<typeof vi.fn>).mockReset();
});

// ============================================================================
// isSafeReturnPath
// ============================================================================
describe('isSafeReturnPath', () => {
  // ─── valid paths ──────────────────────────────────────────────────────────
  it('accepts a simple valid path', () => {
    expect(isSafeReturnPath('/creator/dashboard')).toBe(true);
  });

  it('accepts paths with query strings', () => {
    expect(isSafeReturnPath('/pitches/123?tab=overview')).toBe(true);
  });

  it('accepts deep nested paths', () => {
    expect(isSafeReturnPath('/investor/portfolio/share/abc123')).toBe(true);
  });

  it('accepts root path /', () => {
    expect(isSafeReturnPath('/')).toBe(true);
  });

  // ─── type guards ──────────────────────────────────────────────────────────
  it('rejects non-string values', () => {
    expect(isSafeReturnPath(null)).toBe(false);
    expect(isSafeReturnPath(undefined)).toBe(false);
    expect(isSafeReturnPath(42)).toBe(false);
    expect(isSafeReturnPath({})).toBe(false);
    expect(isSafeReturnPath([])).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSafeReturnPath('')).toBe(false);
  });

  // ─── must start with / ───────────────────────────────────────────────────
  it('rejects relative paths', () => {
    expect(isSafeReturnPath('creator/dashboard')).toBe(false);
  });

  it('rejects HTTP URLs', () => {
    expect(isSafeReturnPath('http://evil.com')).toBe(false);
  });

  it('rejects HTTPS URLs', () => {
    expect(isSafeReturnPath('https://evil.com')).toBe(false);
  });

  // ─── open-redirect guards ─────────────────────────────────────────────────
  it('rejects double-slash // (protocol-relative redirect)', () => {
    expect(isSafeReturnPath('//evil.com')).toBe(false);
  });

  it('rejects /\\ (Windows-style open redirect)', () => {
    expect(isSafeReturnPath('/\\')).toBe(false);
    expect(isSafeReturnPath('/\\evil.com')).toBe(false);
  });

  // ─── auth-route loopbacks ─────────────────────────────────────────────────
  it('rejects exact /login', () => {
    expect(isSafeReturnPath('/login')).toBe(false);
  });

  it('rejects /login/* paths', () => {
    expect(isSafeReturnPath('/login/creator')).toBe(false);
    expect(isSafeReturnPath('/login/investor')).toBe(false);
  });

  it('rejects /login?next=... query strings', () => {
    expect(isSafeReturnPath('/login?next=/creator')).toBe(false);
  });

  it('rejects exact /portals', () => {
    expect(isSafeReturnPath('/portals')).toBe(false);
  });

  it('rejects /portals/* paths', () => {
    expect(isSafeReturnPath('/portals/select')).toBe(false);
  });

  it('rejects /mfa and /mfa/* paths', () => {
    expect(isSafeReturnPath('/mfa')).toBe(false);
    expect(isSafeReturnPath('/mfa/challenge')).toBe(false);
  });

  it('rejects /register and /register/* paths', () => {
    expect(isSafeReturnPath('/register')).toBe(false);
    expect(isSafeReturnPath('/register/creator')).toBe(false);
  });

  it('rejects /forgot-password and its sub-paths', () => {
    expect(isSafeReturnPath('/forgot-password')).toBe(false);
    expect(isSafeReturnPath('/forgot-password/sent')).toBe(false);
  });

  it('rejects /reset-password and its sub-paths', () => {
    expect(isSafeReturnPath('/reset-password')).toBe(false);
    expect(isSafeReturnPath('/reset-password/confirm')).toBe(false);
  });

  it('accepts paths that merely contain a blocked word but do not start with it', () => {
    // e.g. /creator/login-history should be fine because it does not start with /login
    expect(isSafeReturnPath('/creator/login-history')).toBe(true);
  });
});

// ============================================================================
// getPostLoginRedirect
// ============================================================================
describe('getPostLoginRedirect', () => {
  it('returns from when it is safe', () => {
    expect(getPostLoginRedirect('/creator/dashboard', '/fallback')).toBe('/creator/dashboard');
  });

  it('returns defaultPath when from is unsafe', () => {
    expect(getPostLoginRedirect('//evil.com', '/safe/default')).toBe('/safe/default');
  });

  it('returns defaultPath when from is null', () => {
    expect(getPostLoginRedirect(null, '/default')).toBe('/default');
  });

  it('returns defaultPath when from is a blocked auth route', () => {
    expect(getPostLoginRedirect('/login', '/default')).toBe('/default');
  });

  it('returns from when it is a valid investor path', () => {
    expect(getPostLoginRedirect('/investor/portfolio', '/investor/dashboard')).toBe('/investor/portfolio');
  });
});

// ============================================================================
// setPendingReturnTo
// ============================================================================
describe('setPendingReturnTo', () => {
  it('stores a safe path in localStorage', () => {
    setPendingReturnTo('/creator/pitches/42');
    expect(localStorage.setItem).toHaveBeenCalledWith(PENDING_KEY, '/creator/pitches/42');
  });

  it('does not store an unsafe path', () => {
    setPendingReturnTo('//evil.com');
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('does not store a blocked auth route', () => {
    setPendingReturnTo('/login');
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('does not store null', () => {
    setPendingReturnTo(null);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('does not store a number', () => {
    setPendingReturnTo(42);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it('handles localStorage throwing gracefully', () => {
    (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    // Should not throw
    expect(() => setPendingReturnTo('/safe/path')).not.toThrow();
  });
});

// ============================================================================
// consumePendingReturnTo
// ============================================================================
describe('consumePendingReturnTo', () => {
  it('returns the stored safe path', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('/creator/dashboard');
    const result = consumePendingReturnTo();
    expect(result).toBe('/creator/dashboard');
  });

  it('removes the key from localStorage after reading', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('/creator/dashboard');
    consumePendingReturnTo();
    expect(localStorage.removeItem).toHaveBeenCalledWith(PENDING_KEY);
  });

  it('returns null when stored value is unsafe', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('//evil.com');
    const result = consumePendingReturnTo();
    expect(result).toBeNull();
  });

  it('returns null when no value stored', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const result = consumePendingReturnTo();
    expect(result).toBeNull();
  });

  it('returns null when stored value is a blocked auth route', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('/login');
    const result = consumePendingReturnTo();
    expect(result).toBeNull();
  });

  it('returns null and does not throw when localStorage throws', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('storage error');
    });
    expect(() => consumePendingReturnTo()).not.toThrow();
    expect(consumePendingReturnTo()).toBeNull();
  });
});

// ============================================================================
// resolvePostLoginRedirect
// ============================================================================
describe('resolvePostLoginRedirect', () => {
  it('returns stateFrom when it is safe', () => {
    const result = resolvePostLoginRedirect('/creator/dashboard', '/default');
    expect(result).toBe('/creator/dashboard');
  });

  it('clears pending key from localStorage when stateFrom is safe', () => {
    resolvePostLoginRedirect('/creator/dashboard', '/default');
    expect(localStorage.removeItem).toHaveBeenCalledWith(PENDING_KEY);
  });

  it('falls back to pending when stateFrom is unsafe', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('/investor/portfolio');
    const result = resolvePostLoginRedirect('//evil.com', '/default');
    expect(result).toBe('/investor/portfolio');
  });

  it('falls back to default when both stateFrom and pending are unsafe/missing', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const result = resolvePostLoginRedirect(null, '/default/path');
    expect(result).toBe('/default/path');
  });

  it('does not use pending when stateFrom is safe (pending would be ignored)', () => {
    // stateFrom wins; localStorage.getItem should not even be needed
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('/some/other/path');
    const result = resolvePostLoginRedirect('/creator/settings', '/default');
    expect(result).toBe('/creator/settings');
  });

  it('returns default when stateFrom is a blocked auth route and no pending', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const result = resolvePostLoginRedirect('/login', '/investor/dashboard');
    expect(result).toBe('/investor/dashboard');
  });

  it('falls back to pending when stateFrom is /mfa/challenge', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce('/production/projects');
    const result = resolvePostLoginRedirect('/mfa/challenge', '/default');
    expect(result).toBe('/production/projects');
  });
});
