import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePortalAccess, clearAuthenticationState } from '../auth';

// ─── Mock navigation utility ─────────────────────────────────────────────────
vi.mock('../navigation', () => ({
  getPortalPath: (userType: string) => {
    if (userType === 'viewer') return 'watcher';
    return userType;
  },
}));

// ============================================================================
// validatePortalAccess
// ============================================================================
describe('validatePortalAccess', () => {
  it('returns invalid for null userType', () => {
    const result = validatePortalAccess(null, '/investor/dashboard');
    expect(result.isValidPortal).toBe(false);
    expect(result.currentPortal).toBe('unknown');
    expect(result.expectedPortal).toBe('login');
    expect(result.redirectPath).toBe('/');
  });

  it('returns valid when on home path (/) regardless of userType', () => {
    const result = validatePortalAccess('creator', '/');
    expect(result.isValidPortal).toBe(true);
    expect(result.currentPortal).toBe('home');
    expect(result.expectedPortal).toBe('creator');
    expect(result.redirectPath).toBe('/');
  });

  it('returns valid when creator is on /creator path', () => {
    const result = validatePortalAccess('creator', '/creator/dashboard');
    expect(result.isValidPortal).toBe(true);
    expect(result.currentPortal).toBe('creator');
    expect(result.expectedPortal).toBe('creator');
    expect(result.redirectPath).toBe('/creator/dashboard');
  });

  it('returns invalid when creator is on /investor path', () => {
    const result = validatePortalAccess('creator', '/investor/dashboard');
    expect(result.isValidPortal).toBe(false);
    expect(result.currentPortal).toBe('investor');
    expect(result.expectedPortal).toBe('creator');
    expect(result.redirectPath).toBe('/creator/dashboard');
  });

  it('returns valid for investor on /investor path', () => {
    const result = validatePortalAccess('investor', '/investor/portfolio');
    expect(result.isValidPortal).toBe(true);
    expect(result.currentPortal).toBe('investor');
  });

  it('returns valid for production on /production path', () => {
    const result = validatePortalAccess('production', '/production/projects');
    expect(result.isValidPortal).toBe(true);
    expect(result.currentPortal).toBe('production');
  });

  it('returns valid for watcher on /watcher path', () => {
    const result = validatePortalAccess('watcher', '/watcher/dashboard');
    expect(result.isValidPortal).toBe(true);
    expect(result.currentPortal).toBe('watcher');
  });

  it('maps viewer DB type to watcher portal', () => {
    const result = validatePortalAccess('viewer', '/watcher/dashboard');
    expect(result.isValidPortal).toBe(true);
    expect(result.expectedPortal).toBe('watcher');
  });

  it('returns invalid and redirects viewer trying to access /investor path', () => {
    const result = validatePortalAccess('viewer', '/investor/dashboard');
    expect(result.isValidPortal).toBe(false);
    expect(result.redirectPath).toBe('/watcher/dashboard');
  });

  it('redirectPath uses expectedPortal when invalid', () => {
    const result = validatePortalAccess('production', '/creator/dashboard');
    expect(result.redirectPath).toBe('/production/dashboard');
  });

  it('correctly identifies /creator path prefix', () => {
    const result = validatePortalAccess('creator', '/creator/settings/profile');
    expect(result.currentPortal).toBe('creator');
    expect(result.isValidPortal).toBe(true);
  });
});

// ============================================================================
// clearAuthenticationState
// ============================================================================
describe('clearAuthenticationState', () => {
  beforeEach(() => {
    // Set up localStorage mock to track calls
    localStorage.removeItem = vi.fn();
    sessionStorage.clear = vi.fn();
  });

  it('removes all WebSocket-related keys from localStorage', () => {
    clearAuthenticationState();

    const expectedKeys = [
      'pitchey_last_ws_attempt',
      'pitchey_ws_queue',
      'pitchey_ws_ratelimit',
      'pitchey_ws_circuit_breaker',
      'pitchey_websocket_disabled',
      'pitchey_websocket_loop_detected',
    ];

    for (const key of expectedKeys) {
      expect(localStorage.removeItem).toHaveBeenCalledWith(key);
    }
  });

  it('clears sessionStorage', () => {
    clearAuthenticationState();
    expect(sessionStorage.clear).toHaveBeenCalled();
  });

  it('removes exactly 6 keys from localStorage', () => {
    clearAuthenticationState();
    expect(localStorage.removeItem).toHaveBeenCalledTimes(6);
  });
});
