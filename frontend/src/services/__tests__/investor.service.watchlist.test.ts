import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();
vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: vi.fn(),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

import { InvestorService } from '../investor.service';

describe('InvestorService — Watchlist & Investment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── addToWatchlist ──────────────────────────────────────────────

  describe('addToWatchlist', () => {
    it('calls POST /api/investor/watchlist with pitchId', async () => {
      mockPost.mockResolvedValue({
        success: true,
        data: { item: { id: 1, pitchId: 42, addedAt: '2026-02-20' } },
      });

      const result = await InvestorService.addToWatchlist(42);

      expect(mockPost).toHaveBeenCalledWith('/api/investor/watchlist', { pitchId: 42, notes: undefined });
      expect(result.id).toBe(1);
    });

    it('includes optional notes when provided', async () => {
      mockPost.mockResolvedValue({
        success: true,
        data: { item: { id: 2, pitchId: 42, notes: 'Great pitch', addedAt: '2026-02-20' } },
      });

      const result = await InvestorService.addToWatchlist(42, 'Great pitch');

      expect(mockPost).toHaveBeenCalledWith('/api/investor/watchlist', { pitchId: 42, notes: 'Great pitch' });
      expect(result.notes).toBe('Great pitch');
    });

    it('returns the created watchlist item', async () => {
      const item = { id: 3, pitchId: 10, addedAt: '2026-02-20' };
      mockPost.mockResolvedValue({ success: true, data: { item } });

      const result = await InvestorService.addToWatchlist(10);

      expect(result).toEqual(item);
    });

    it('throws when API returns success: false', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'Already watchlisted' });

      await expect(InvestorService.addToWatchlist(42)).rejects.toThrow();
    });

    it('throws when item is missing from response', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} });

      await expect(InvestorService.addToWatchlist(42)).rejects.toThrow();
    });
  });

  // ─── removeFromWatchlist ─────────────────────────────────────────

  describe('removeFromWatchlist', () => {
    it('calls DELETE /api/investor/watchlist/:pitchId', async () => {
      mockDelete.mockResolvedValue({ success: true });

      await InvestorService.removeFromWatchlist(42);

      expect(mockDelete).toHaveBeenCalledWith('/api/investor/watchlist/42');
    });

    it('throws when API returns success: false', async () => {
      mockDelete.mockResolvedValue({ success: false, error: 'Not found' });

      await expect(InvestorService.removeFromWatchlist(99)).rejects.toThrow();
    });
  });

  // ─── getWatchlist ────────────────────────────────────────────────

  describe('getWatchlist', () => {
    it('calls GET /api/investor/watchlist', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { watchlist: [{ id: 1, pitchId: 10 }] },
      });

      const result = await InvestorService.getWatchlist();

      expect(mockGet).toHaveBeenCalledWith('/api/investor/watchlist');
      expect(result).toHaveLength(1);
    });

    it('returns empty array when watchlist is empty', async () => {
      mockGet.mockResolvedValue({ success: true, data: { watchlist: [] } });

      const result = await InvestorService.getWatchlist();

      expect(result).toEqual([]);
    });

    it('throws when API returns success: false', async () => {
      mockGet.mockResolvedValue({ success: false, error: 'Unauthorized' });

      await expect(InvestorService.getWatchlist()).rejects.toThrow();
    });
  });

  // ─── invest ──────────────────────────────────────────────────────

  describe('invest', () => {
    it('calls POST /api/investor/invest with all fields', async () => {
      mockPost.mockResolvedValue({
        success: true,
        data: {
          investment: { id: 1, pitchId: 10, amount: 50000, status: 'pending' },
        },
      });

      const result = await InvestorService.invest({
        pitchId: 10,
        amount: 50000,
        terms: 'Standard terms',
        message: 'Excited about this project',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/investor/invest', {
        pitchId: 10,
        amount: 50000,
        terms: 'Standard terms',
        message: 'Excited about this project',
      });
      expect(result.id).toBe(1);
      expect(result.status).toBe('pending');
    });

    it('works with minimal fields (pitchId + amount)', async () => {
      mockPost.mockResolvedValue({
        success: true,
        data: { investment: { id: 2, pitchId: 5, amount: 10000, status: 'pending' } },
      });

      const result = await InvestorService.invest({ pitchId: 5, amount: 10000 });

      expect(mockPost).toHaveBeenCalledWith('/api/investor/invest', { pitchId: 5, amount: 10000 });
      expect(result.amount).toBe(10000);
    });

    it('throws when API returns success: false', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'Insufficient funds' });

      await expect(
        InvestorService.invest({ pitchId: 10, amount: 50000 })
      ).rejects.toThrow();
    });

    it('throws descriptive error message from API', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'Pitch is not accepting investments' });

      await expect(
        InvestorService.invest({ pitchId: 10, amount: 50000 })
      ).rejects.toThrow('Pitch is not accepting investments');
    });

    it('throws when investment data is missing from response', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} });

      await expect(
        InvestorService.invest({ pitchId: 10, amount: 50000 })
      ).rejects.toThrow();
    });
  });

  // ─── withdrawInvestment ──────────────────────────────────────────

  describe('withdrawInvestment', () => {
    it('calls POST /api/investor/investments/:id/withdraw with reason', async () => {
      mockPost.mockResolvedValue({ success: true });

      await InvestorService.withdrawInvestment(5, 'Changed my mind');

      expect(mockPost).toHaveBeenCalledWith(
        '/api/investor/investments/5/withdraw',
        { reason: 'Changed my mind' }
      );
    });

    it('works without a reason', async () => {
      mockPost.mockResolvedValue({ success: true });

      await InvestorService.withdrawInvestment(5);

      expect(mockPost).toHaveBeenCalledWith(
        '/api/investor/investments/5/withdraw',
        { reason: undefined }
      );
    });

    it('throws when API returns success: false', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'Cannot withdraw' });

      await expect(InvestorService.withdrawInvestment(5)).rejects.toThrow();
    });
  });
});
