import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock apiClient BEFORE importing the service ────────────────────
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: (...args: any[]) => mockPut(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

import { SavedPitchesService } from '../saved-pitches.service';

describe('SavedPitchesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getSavedPitches ─────────────────────────────────────────────
  describe('getSavedPitches', () => {
    it('returns saved pitches response when data has savedPitches field', async () => {
      const mockData = {
        savedPitches: [
          { id: 1, userId: 10, pitchId: 20, savedAt: '2026-01-01' },
        ],
        total: 1,
      };

      mockGet.mockResolvedValue({ success: true, data: mockData });

      const result = await SavedPitchesService.getSavedPitches();

      expect(mockGet).toHaveBeenCalledWith('/api/saved-pitches');
      expect(result.savedPitches).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('wraps array response into expected structure', async () => {
      const mockArray = [
        { id: 1, userId: 10, pitchId: 20, savedAt: '2026-01-01' },
        { id: 2, userId: 10, pitchId: 21, savedAt: '2026-01-02' },
      ];

      mockGet.mockResolvedValue({ success: true, data: mockArray });

      const result = await SavedPitchesService.getSavedPitches();

      expect(result.savedPitches).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('returns empty fallback for unexpected data shape', async () => {
      mockGet.mockResolvedValue({ success: true, data: { somethingElse: true } });

      const result = await SavedPitchesService.getSavedPitches();

      expect(result.savedPitches).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('throws when API returns failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Unauthorized' } });

      await expect(SavedPitchesService.getSavedPitches()).rejects.toThrow('Unauthorized');
    });

    it('appends query params when provided', async () => {
      mockGet.mockResolvedValue({ success: true, data: { savedPitches: [], total: 0 } });

      await SavedPitchesService.getSavedPitches({ page: 2, limit: 10, search: 'drama', genre: 'Drama', format: 'feature' });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain('page=2');
      expect(url).toContain('limit=10');
      expect(url).toContain('search=drama');
      expect(url).toContain('genre=Drama');
      expect(url).toContain('format=feature');
    });
  });

  // ─── savePitch ───────────────────────────────────────────────────
  describe('savePitch', () => {
    it('posts to /api/saved-pitches and returns saved pitch', async () => {
      const mockSaved = { id: 5, userId: 10, pitchId: 42, savedAt: '2026-01-01' };

      mockPost.mockResolvedValue({ success: true, data: mockSaved });

      const result = await SavedPitchesService.savePitch({ pitchId: 42 });

      expect(mockPost).toHaveBeenCalledWith('/api/saved-pitches', { pitchId: 42 });
      expect(result.id).toBe(5);
    });

    it('includes notes in the request body', async () => {
      const mockSaved = { id: 6, userId: 10, pitchId: 43, savedAt: '2026-01-01', notes: 'Interesting' };

      mockPost.mockResolvedValue({ success: true, data: mockSaved });

      await SavedPitchesService.savePitch({ pitchId: 43, notes: 'Interesting' });

      expect(mockPost).toHaveBeenCalledWith('/api/saved-pitches', { pitchId: 43, notes: 'Interesting' });
    });

    it('throws with error message on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Already saved' } });

      await expect(SavedPitchesService.savePitch({ pitchId: 1 })).rejects.toThrow('Already saved');
    });

    it('throws with duplicate save message for DUPLICATE_SAVE code', async () => {
      mockPost.mockResolvedValue({ success: false, error: { code: 'DUPLICATE_SAVE' } });

      await expect(SavedPitchesService.savePitch({ pitchId: 1 })).rejects.toThrow('already in your saved list');
    });

    it('throws with string error directly', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'Network problem' });

      await expect(SavedPitchesService.savePitch({ pitchId: 1 })).rejects.toThrow('Network problem');
    });

    it('throws when response data does not have id', async () => {
      mockPost.mockResolvedValue({ success: true, data: { nope: true } });

      await expect(SavedPitchesService.savePitch({ pitchId: 1 })).rejects.toThrow('Invalid response format');
    });
  });

  // ─── unsavePitch ─────────────────────────────────────────────────
  describe('unsavePitch', () => {
    it('calls delete on correct endpoint', async () => {
      mockDelete.mockResolvedValue({ success: true });

      await SavedPitchesService.unsavePitch(7);

      expect(mockDelete).toHaveBeenCalledWith('/api/saved-pitches/7');
    });

    it('throws on failure', async () => {
      mockDelete.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      await expect(SavedPitchesService.unsavePitch(99)).rejects.toThrow('Not found');
    });

    it('throws with string error', async () => {
      mockDelete.mockResolvedValue({ success: false, error: 'Server error' });

      await expect(SavedPitchesService.unsavePitch(1)).rejects.toThrow('Server error');
    });
  });

  // ─── isPitchSaved ────────────────────────────────────────────────
  describe('isPitchSaved', () => {
    it('returns isSaved true when pitch is saved', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { isSaved: true, savedPitchId: 5, savedAt: '2026-01-01' },
      });

      const result = await SavedPitchesService.isPitchSaved(42);

      expect(mockGet).toHaveBeenCalledWith('/api/saved-pitches/check/42');
      expect(result.isSaved).toBe(true);
      expect(result.savedPitchId).toBe(5);
    });

    it('returns isSaved false when API fails', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await SavedPitchesService.isPitchSaved(1);

      expect(result.isSaved).toBe(false);
    });

    it('returns isSaved false when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await SavedPitchesService.isPitchSaved(1);

      expect(result.isSaved).toBe(false);
    });
  });

  // ─── updateSavedPitchNotes ───────────────────────────────────────
  describe('updateSavedPitchNotes', () => {
    it('calls put on correct endpoint with notes', async () => {
      const mockSaved = { id: 5, userId: 10, pitchId: 42, savedAt: '2026-01-01', notes: 'Updated note' };

      mockPut.mockResolvedValue({ success: true, data: mockSaved });

      const result = await SavedPitchesService.updateSavedPitchNotes(5, 'Updated note');

      expect(mockPut).toHaveBeenCalledWith('/api/saved-pitches/5', { notes: 'Updated note' });
      expect(result).toEqual(mockSaved);
    });

    it('throws on failure', async () => {
      mockPut.mockResolvedValue({ success: false, error: { message: 'Update failed' } });

      await expect(SavedPitchesService.updateSavedPitchNotes(1, 'note')).rejects.toThrow('Update failed');
    });
  });

  // ─── getSavedPitchStats ──────────────────────────────────────────
  describe('getSavedPitchStats', () => {
    it('returns stats on success', async () => {
      const mockStats = {
        totalSaved: 10,
        byGenre: { Drama: 5, Comedy: 3 },
        byFormat: { feature: 7, short: 3 },
        recentlyAdded: 2,
      };

      mockGet.mockResolvedValue({ success: true, data: mockStats });

      const result = await SavedPitchesService.getSavedPitchStats();

      expect(mockGet).toHaveBeenCalledWith('/api/saved-pitches/stats');
      expect(result.totalSaved).toBe(10);
      expect(result.byGenre.Drama).toBe(5);
    });

    it('returns empty stats on failure (no throw)', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await SavedPitchesService.getSavedPitchStats();

      expect(result.totalSaved).toBe(0);
      expect(result.byGenre).toEqual({});
    });
  });
});
