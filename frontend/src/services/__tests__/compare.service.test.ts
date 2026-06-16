import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock apiClient BEFORE importing the service ─────────────────────────────
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: vi.fn(),
    delete: (...args: any[]) => mockDelete(...args),
    patch: vi.fn(),
  },
}));

import { compareService } from '../compare.service';
import type { CompareSubject, SavedComparison } from '../compare.service';

const mockSubject: CompareSubject = {
  subject_id: 1,
  name: 'Alice Creator',
  username: 'alicecreator',
  user_type: 'creator',
  verification_tier: 'gold',
  avatar: null,
  subtitle: null,
  thumbnail: null,
  genre: 'Drama',
  format: 'Feature',
  pitch_count: 5,
  avg_heat: 7.5,
  avg_pitchey: 8.0,
  total_views: 1000,
  total_likes: 200,
  budget_min: 100000,
  budget_max: 500000,
  newest_at: '2026-01-01T00:00:00Z',
  genres: ['Drama', 'Thriller'],
};

const mockSavedComparison: SavedComparison = {
  id: 1,
  title: 'My Creator Comparison',
  subject_type: 'creator',
  subject_ids: '1,2,3',
  share_token: 'abc123token',
  created_at: '2026-01-01T00:00:00Z',
};

describe('compareService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── subjects ──────────────────────────────────────────────────────────────
  describe('subjects', () => {
    it('returns empty array when ids is empty', async () => {
      const result = await compareService.subjects('creator', []);
      expect(mockGet).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('fetches subjects with correct URL for creator type', async () => {
      mockGet.mockResolvedValue({ success: true, data: { subjects: [mockSubject] } });

      const result = await compareService.subjects('creator', [1, 2]);

      expect(mockGet).toHaveBeenCalledWith('/api/compare?type=creator&ids=1,2');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice Creator');
    });

    it('fetches subjects for pitch type', async () => {
      mockGet.mockResolvedValue({ success: true, data: { subjects: [mockSubject] } });

      await compareService.subjects('pitch', [10, 20]);

      expect(mockGet).toHaveBeenCalledWith('/api/compare?type=pitch&ids=10,20');
    });

    it('fetches subjects for slate type', async () => {
      mockGet.mockResolvedValue({ success: true, data: { subjects: [mockSubject] } });

      await compareService.subjects('slate', [5]);

      expect(mockGet).toHaveBeenCalledWith('/api/compare?type=slate&ids=5');
    });

    it('returns empty array on API failure', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await compareService.subjects('creator', [1]);

      expect(result).toEqual([]);
    });

    it('handles double-wrapped data (data.data.subjects)', async () => {
      mockGet.mockResolvedValue({ success: true, data: { data: { subjects: [mockSubject] } } });

      const result = await compareService.subjects('creator', [1]);

      expect(result).toHaveLength(1);
    });
  });

  // ─── creators ──────────────────────────────────────────────────────────────
  describe('creators', () => {
    it('delegates to subjects with type=creator', async () => {
      mockGet.mockResolvedValue({ success: true, data: { subjects: [mockSubject] } });

      const result = await compareService.creators([1, 2]);

      expect(mockGet).toHaveBeenCalledWith('/api/compare?type=creator&ids=1,2');
      expect(result).toHaveLength(1);
    });

    it('returns empty array for empty ids', async () => {
      const result = await compareService.creators([]);
      expect(mockGet).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  // ─── searchCreators ────────────────────────────────────────────────────────
  describe('searchCreators', () => {
    it('returns empty array for blank query', async () => {
      const result = await compareService.searchCreators('   ');
      expect(mockGet).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('returns empty array for empty string', async () => {
      const result = await compareService.searchCreators('');
      expect(mockGet).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('fetches with encoded query', async () => {
      mockGet.mockResolvedValue({ success: true, data: { creators: [] } });

      await compareService.searchCreators('alice creator');

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/compare/creators?q=alice%20creator'));
    });

    it('maps creator data to PickerItems', async () => {
      const rawCreators = [
        { id: 1, name: 'Alice', user_type: 'creator', avatar: 'https://example.com/avatar.jpg' },
        { id: 2, username: 'bob_creator', user_type: 'production', avatar: null },
      ];
      mockGet.mockResolvedValue({ success: true, data: { creators: rawCreators } });

      const result = await compareService.searchCreators('alice');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'Alice', sub: 'creator', image: 'https://example.com/avatar.jpg' });
      expect(result[1]).toEqual({ id: 2, name: 'bob_creator', sub: 'production', image: null });
    });

    it('falls back to "Unknown" when no name or username', async () => {
      mockGet.mockResolvedValue({ success: true, data: { creators: [{ id: 3, user_type: 'creator' }] } });

      const result = await compareService.searchCreators('test');

      expect(result[0].name).toBe('Unknown');
    });

    it('filters out entries with invalid ids', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { creators: [{ id: 'not-a-number', name: 'Bad' }, { id: 5, name: 'Good' }] },
      });

      const result = await compareService.searchCreators('test');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Good');
    });

    it('returns empty array on API failure', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await compareService.searchCreators('alice');

      expect(result).toEqual([]);
    });
  });

  // ─── shared ────────────────────────────────────────────────────────────────
  describe('shared', () => {
    it('returns shared comparison data on success', async () => {
      const mockData = { title: 'Creator Comparison', type: 'creator', subjects: [mockSubject] };
      mockGet.mockResolvedValue({ success: true, data: mockData });

      const result = await compareService.shared('abc123token');

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/compare/shared/abc123token'));
      expect(result.title).toBe('Creator Comparison');
      expect(result.type).toBe('creator');
      expect(result.subjects).toHaveLength(1);
    });

    it('URL-encodes special characters in token', async () => {
      mockGet.mockResolvedValue({ success: true, data: { title: 'Test', type: 'pitch', subjects: [] } });

      await compareService.shared('token/with+special=chars');

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('token/with+special=chars')));
    });

    it('handles double-wrapped response (data.data)', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { data: { title: 'Nested', type: 'slate', subjects: [mockSubject] } },
      });

      const result = await compareService.shared('token123');

      expect(result.title).toBe('Nested');
      expect(result.type).toBe('slate');
    });

    it('defaults title to "Comparison" when missing', async () => {
      mockGet.mockResolvedValue({ success: true, data: { type: 'creator', subjects: [] } });

      const result = await compareService.shared('token');

      expect(result.title).toBe('Comparison');
    });

    it('defaults type to "creator" when missing', async () => {
      mockGet.mockResolvedValue({ success: true, data: { title: 'Test', subjects: [] } });

      const result = await compareService.shared('token');

      expect(result.type).toBe('creator');
    });

    it('throws on API failure with error message', async () => {
      mockGet.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      await expect(compareService.shared('badtoken')).rejects.toThrow('Not found');
    });

    it('throws with default message when no error details', async () => {
      mockGet.mockResolvedValue({ success: false });

      await expect(compareService.shared('badtoken')).rejects.toThrow('Comparison not found');
    });
  });

  // ─── save ──────────────────────────────────────────────────────────────────
  describe('save', () => {
    it('posts and returns id + share_token on success', async () => {
      mockPost.mockResolvedValue({ success: true, data: { id: 10, share_token: 'newtoken123' } });

      const result = await compareService.save('My Comparison', 'creator', [1, 2, 3]);

      expect(mockPost).toHaveBeenCalledWith('/api/compare/saved', {
        title: 'My Comparison',
        type: 'creator',
        ids: '1,2,3',
      });
      expect(result.id).toBe(10);
      expect(result.share_token).toBe('newtoken123');
    });

    it('handles double-wrapped data (data.data)', async () => {
      mockPost.mockResolvedValue({ success: true, data: { data: { id: 5, share_token: 'wrapped' } } });

      const result = await compareService.save('Test', 'pitch', [5]);

      expect(result.id).toBe(5);
      expect(result.share_token).toBe('wrapped');
    });

    it('throws on API failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Unauthorized' } });

      await expect(compareService.save('Title', 'creator', [1])).rejects.toThrow('Unauthorized');
    });

    it('throws with default message when no error details', async () => {
      mockPost.mockResolvedValue({ success: false });

      await expect(compareService.save('Title', 'creator', [1])).rejects.toThrow('Failed to save');
    });
  });

  // ─── listSaved ─────────────────────────────────────────────────────────────
  describe('listSaved', () => {
    it('returns saved comparisons on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: { comparisons: [mockSavedComparison] } });

      const result = await compareService.listSaved();

      expect(mockGet).toHaveBeenCalledWith('/api/compare/saved');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('My Creator Comparison');
    });

    it('returns empty array on failure', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await compareService.listSaved();

      expect(result).toEqual([]);
    });

    it('returns empty array when comparisons missing from response', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      const result = await compareService.listSaved();

      expect(result).toEqual([]);
    });
  });

  // ─── deleteSaved ───────────────────────────────────────────────────────────
  describe('deleteSaved', () => {
    it('calls delete on the correct endpoint', async () => {
      mockDelete.mockResolvedValue({ success: true });

      await compareService.deleteSaved(1);

      expect(mockDelete).toHaveBeenCalledWith('/api/compare/saved/1');
    });

    it('resolves even if delete returns failure (no throw — service does not check success)', async () => {
      mockDelete.mockResolvedValue({ success: false });

      await expect(compareService.deleteSaved(99)).resolves.toBeUndefined();
    });
  });

  // ─── searchSlates ──────────────────────────────────────────────────────────
  describe('searchSlates', () => {
    it('returns empty array for blank query', async () => {
      const result = await compareService.searchSlates('   ');
      expect(mockGet).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('fetches with encoded query', async () => {
      mockGet.mockResolvedValue({ success: true, data: { slates: [] } });

      await compareService.searchSlates('sci fi');

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/compare/slates?q=sci%20fi'));
    });

    it('maps slate data to PickerItems', async () => {
      const rawSlates = [
        { id: 10, name: 'Horror Slate', owner: 'Alice', thumbnail: 'https://example.com/slate.jpg' },
        { id: 11, thumbnail: null },
      ];
      mockGet.mockResolvedValue({ success: true, data: { slates: rawSlates } });

      const result = await compareService.searchSlates('horror');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 10, name: 'Horror Slate', sub: 'Alice', image: 'https://example.com/slate.jpg' });
      expect(result[1]).toEqual({ id: 11, name: 'Untitled slate', sub: undefined, image: null });
    });

    it('filters out entries with invalid ids', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { slates: [{ id: 'bad', name: 'Invalid' }, { id: 7, name: 'Valid' }] },
      });

      const result = await compareService.searchSlates('test');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid');
    });

    it('returns empty array on API failure', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await compareService.searchSlates('test');

      expect(result).toEqual([]);
    });
  });
});
