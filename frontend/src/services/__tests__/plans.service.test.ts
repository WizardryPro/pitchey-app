import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Mock config to prevent import.meta env issues ───────────────────────────
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:8001',
  config: {
    API_URL: 'http://localhost:8001',
    WS_URL: 'ws://localhost:8001',
  },
}));

// ─── Mock subscription-plans to provide known test data ──────────────────────
vi.mock('../../config/subscription-plans', () => ({
  SUBSCRIPTION_TIERS: [
    { id: 'creator', name: 'Creator', price: { monthly: 19.99, annual: 199 }, credits: 10, analytics: 'basic', features: [], userType: 'creator' },
    { id: 'creator_plus', name: 'Creator+', price: { monthly: 29.99, annual: 299 }, credits: 30, analytics: 'enhanced', features: [], userType: 'creator' },
    { id: 'production', name: 'Production Company', price: { monthly: 19.99, annual: 199 }, credits: 20, analytics: 'basic', features: [], userType: 'production' },
    { id: 'exec', name: 'Exec', price: { monthly: 49.99, annual: 499 }, credits: 50, analytics: 'enhanced', features: [], userType: 'exec' },
  ],
  CREDIT_PACKAGES: [
    { credits: 5, price: 8.99, currency: 'EUR' },
  ],
  CREDIT_COSTS: [
    { action: 'basic_upload', credits: 10, description: 'New upload' },
  ],
}));

// Plans service uses module-level state (cached, inFlight) — must re-import per test
// to reset that state. We use vi.resetModules() in beforeEach.

describe('plans.service', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── tiersByUserType ──────────────────────────────────────────────────────
  describe('tiersByUserType', () => {
    it('filters creator tiers', async () => {
      const { tiersByUserType, usePlans: _u } = await import('../plans.service');
      const { SUBSCRIPTION_TIERS } = await import('../../config/subscription-plans');
      const result = tiersByUserType(SUBSCRIPTION_TIERS, 'creator');
      expect(result.every(t => t.userType === 'creator')).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('filters production tiers', async () => {
      const { tiersByUserType } = await import('../plans.service');
      const { SUBSCRIPTION_TIERS } = await import('../../config/subscription-plans');
      const result = tiersByUserType(SUBSCRIPTION_TIERS, 'production');
      expect(result.every(t => t.userType === 'production')).toBe(true);
    });

    it('filters exec tiers when userType is investor', async () => {
      const { tiersByUserType } = await import('../plans.service');
      const { SUBSCRIPTION_TIERS } = await import('../../config/subscription-plans');
      const result = tiersByUserType(SUBSCRIPTION_TIERS, 'investor');
      expect(result.every(t => t.userType === 'exec')).toBe(true);
    });

    it('returns empty array for watcher userType', async () => {
      const { tiersByUserType } = await import('../plans.service');
      const { SUBSCRIPTION_TIERS } = await import('../../config/subscription-plans');
      expect(tiersByUserType(SUBSCRIPTION_TIERS, 'watcher')).toEqual([]);
    });

    it('returns empty array for viewer userType', async () => {
      const { tiersByUserType } = await import('../plans.service');
      const { SUBSCRIPTION_TIERS } = await import('../../config/subscription-plans');
      expect(tiersByUserType(SUBSCRIPTION_TIERS, 'viewer')).toEqual([]);
    });

    it('returns all tiers for unknown userType', async () => {
      const { tiersByUserType } = await import('../plans.service');
      const { SUBSCRIPTION_TIERS } = await import('../../config/subscription-plans');
      const result = tiersByUserType(SUBSCRIPTION_TIERS, 'unknown');
      expect(result).toEqual(SUBSCRIPTION_TIERS);
    });
  });

  // ─── fetchPlans (via usePlans hook) ───────────────────────────────────────
  describe('usePlans hook', () => {
    it('starts with fallback data before fetch resolves', async () => {
      const { SUBSCRIPTION_TIERS } = await import('../../config/subscription-plans');
      mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves

      const { usePlans } = await import('../plans.service');
      const { result } = renderHook(() => usePlans());

      // Should immediately have fallback data
      expect(result.current.tiers).toEqual(SUBSCRIPTION_TIERS);
      expect(result.current.creditPackages).toBeDefined();
      expect(result.current.creditCosts).toBeDefined();
    });

    it('updates with API data when fetch succeeds', async () => {
      const apiTiers = [
        { id: 'api_creator', name: 'API Creator', price: { monthly: 9.99, annual: 99 }, credits: 5, analytics: 'basic', features: [], userType: 'creator' },
      ];
      const apiCreditPackages = [{ credits: 3, price: 4.99, currency: 'EUR' }];
      const apiCreditCosts = [{ action: 'test', credits: 1, description: 'test action' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: {
            tiers: apiTiers,
            creditPackages: apiCreditPackages,
            creditCosts: apiCreditCosts,
          },
        }),
      });

      const { usePlans } = await import('../plans.service');
      const { result } = renderHook(() => usePlans());

      await waitFor(() => {
        expect(result.current.tiers).toEqual(apiTiers);
      });

      expect(result.current.creditPackages).toEqual(apiCreditPackages);
      expect(result.current.creditCosts).toEqual(apiCreditCosts);
    });

    it('falls back to bundled data on fetch error', async () => {
      const { SUBSCRIPTION_TIERS } = await import('../../config/subscription-plans');
      mockFetch.mockRejectedValue(new Error('Network error'));

      const { usePlans } = await import('../plans.service');
      const { result } = renderHook(() => usePlans());

      await waitFor(() => {
        // After the error, the hook should still have the fallback data
        expect(result.current.tiers).toEqual(SUBSCRIPTION_TIERS);
      });
    });

    it('uses fallback tiers when API returns empty tiers array', async () => {
      const { SUBSCRIPTION_TIERS } = await import('../../config/subscription-plans');
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: { tiers: [], creditPackages: [], creditCosts: [] },
        }),
      });

      const { usePlans } = await import('../plans.service');
      const { result } = renderHook(() => usePlans());

      await waitFor(() => {
        // Empty arrays from API trigger fallback
        expect(result.current.tiers).toEqual(SUBSCRIPTION_TIERS);
      });
    });

    it('exposes forUserType() helper that filters by user type', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves

      const { usePlans } = await import('../plans.service');
      const { result } = renderHook(() => usePlans());

      const creatorTiers = result.current.forUserType('creator');
      expect(creatorTiers.every(t => t.userType === 'creator')).toBe(true);
    });

    it('calls fetch with credentials: include', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      const { usePlans } = await import('../plans.service');
      renderHook(() => usePlans());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/plans'),
          expect.objectContaining({ credentials: 'include' })
        );
      });
    });
  });
});
