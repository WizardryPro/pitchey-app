import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock apiClient BEFORE importing the service ─────────────────────────────
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
    patch: vi.fn(),
  },
}));

import { SlateService } from '../slate.service';
import type { Slate, SlateDetail, SlatePitch } from '../slate.service';

const mockSlate: Slate = {
  id: 1,
  title: 'Horror Collection',
  description: 'Best horror pitches',
  cover_image: 'https://example.com/cover.jpg',
  status: 'published',
  pitch_count: 3,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
};

const mockPitch: SlatePitch = {
  entry_id: 10,
  position: 1,
  added_at: '2026-01-05T00:00:00Z',
  id: 100,
  title: 'Haunted House',
  logline: 'A family moves into a haunted house',
  genre: 'Horror',
  format: 'Feature',
  cover_image: null,
  view_count: 500,
  like_count: 50,
  status: 'published',
  created_at: '2026-01-01T00:00:00Z',
};

const mockSlateDetail: SlateDetail = {
  ...mockSlate,
  pitches: [mockPitch],
};

describe('SlateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── list ──────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('fetches all slates with no params', async () => {
      mockGet.mockResolvedValue({ data: { slates: [mockSlate] } });

      const result = await SlateService.list();

      expect(mockGet).toHaveBeenCalledWith('/api/slates');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Horror Collection');
    });

    it('appends status query param', async () => {
      mockGet.mockResolvedValue({ data: { slates: [] } });

      await SlateService.list({ status: 'draft' });

      expect(mockGet).toHaveBeenCalledWith('/api/slates?status=draft');
    });

    it('appends page query param', async () => {
      mockGet.mockResolvedValue({ data: { slates: [] } });

      await SlateService.list({ page: 2 });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('page=2'));
    });

    it('appends limit query param', async () => {
      mockGet.mockResolvedValue({ data: { slates: [] } });

      await SlateService.list({ limit: 10 });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('limit=10'));
    });

    it('handles response with slates at top level (fallback)', async () => {
      mockGet.mockResolvedValue({ slates: [mockSlate] });

      const result = await SlateService.list();

      expect(result).toHaveLength(1);
    });

    it('returns empty array when no slates in response', async () => {
      mockGet.mockResolvedValue({ data: {} });

      const result = await SlateService.list();

      expect(result).toEqual([]);
    });

    it('returns empty array when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await SlateService.list();

      expect(result).toEqual([]);
    });
  });

  // ─── get ───────────────────────────────────────────────────────────────────
  describe('get', () => {
    it('fetches slate by id', async () => {
      mockGet.mockResolvedValue({ data: mockSlateDetail });

      const result = await SlateService.get(1);

      expect(mockGet).toHaveBeenCalledWith('/api/slates/1');
      expect(result).not.toBeNull();
      expect(result?.title).toBe('Horror Collection');
      expect(result?.pitches).toHaveLength(1);
    });

    it('handles response without data wrapper (direct result)', async () => {
      mockGet.mockResolvedValue(mockSlateDetail);

      const result = await SlateService.get(1);

      // The service returns res.data ?? res ?? null — if no data prop, uses the response itself
      expect(result).not.toBeNull();
    });

    it('returns null when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Not found'));

      const result = await SlateService.get(999);

      expect(result).toBeNull();
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('posts slate and returns created slate from data wrapper', async () => {
      mockPost.mockResolvedValue({ data: mockSlate });

      const result = await SlateService.create({ title: 'Horror Collection', description: 'Best horror pitches' });

      expect(mockPost).toHaveBeenCalledWith('/api/slates', {
        title: 'Horror Collection',
        description: 'Best horror pitches',
      });
      expect(result?.title).toBe('Horror Collection');
    });

    it('handles response without data wrapper', async () => {
      mockPost.mockResolvedValue(mockSlate);

      const result = await SlateService.create({ title: 'Horror Collection' });

      expect(result).not.toBeNull();
    });

    it('returns null when API throws', async () => {
      mockPost.mockRejectedValue(new Error('Unauthorized'));

      const result = await SlateService.create({ title: 'New Slate' });

      expect(result).toBeNull();
    });

    it('includes cover_image when provided', async () => {
      mockPost.mockResolvedValue({ data: mockSlate });

      await SlateService.create({ title: 'Test', cover_image: 'https://example.com/img.jpg' });

      expect(mockPost).toHaveBeenCalledWith('/api/slates', expect.objectContaining({ cover_image: 'https://example.com/img.jpg' }));
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('puts slate update and returns updated slate', async () => {
      const updatedSlate = { ...mockSlate, title: 'Updated Horror Collection' };
      mockPut.mockResolvedValue({ data: updatedSlate });

      const result = await SlateService.update(1, { title: 'Updated Horror Collection' });

      expect(mockPut).toHaveBeenCalledWith('/api/slates/1', { title: 'Updated Horror Collection' });
      expect(result?.title).toBe('Updated Horror Collection');
    });

    it('can update status to draft', async () => {
      const draftSlate = { ...mockSlate, status: 'draft' as const };
      mockPut.mockResolvedValue({ data: draftSlate });

      const result = await SlateService.update(1, { status: 'draft' });

      expect(result?.status).toBe('draft');
    });

    it('returns null when API throws', async () => {
      mockPut.mockRejectedValue(new Error('Not found'));

      const result = await SlateService.update(999, { title: 'Bad' });

      expect(result).toBeNull();
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('calls delete on correct endpoint and returns true on success', async () => {
      mockDelete.mockResolvedValue({ success: true });

      const result = await SlateService.remove(1);

      expect(mockDelete).toHaveBeenCalledWith('/api/slates/1');
      expect(result).toBe(true);
    });

    it('returns false when API throws', async () => {
      mockDelete.mockRejectedValue(new Error('Not found'));

      const result = await SlateService.remove(999);

      expect(result).toBe(false);
    });
  });

  // ─── addPitch ──────────────────────────────────────────────────────────────
  describe('addPitch', () => {
    it('posts pitch to slate and returns true on success', async () => {
      mockPost.mockResolvedValue({ success: true });

      const result = await SlateService.addPitch(1, 100);

      expect(mockPost).toHaveBeenCalledWith('/api/slates/1/pitches', { pitch_id: 100 });
      expect(result).toBe(true);
    });

    it('returns false when API throws', async () => {
      mockPost.mockRejectedValue(new Error('Pitch already in slate'));

      const result = await SlateService.addPitch(1, 100);

      expect(result).toBe(false);
    });
  });

  // ─── removePitch ───────────────────────────────────────────────────────────
  describe('removePitch', () => {
    it('calls delete on correct endpoint and returns true on success', async () => {
      mockDelete.mockResolvedValue({ success: true });

      const result = await SlateService.removePitch(1, 100);

      expect(mockDelete).toHaveBeenCalledWith('/api/slates/1/pitches/100');
      expect(result).toBe(true);
    });

    it('returns false when API throws', async () => {
      mockDelete.mockRejectedValue(new Error('Not found'));

      const result = await SlateService.removePitch(1, 999);

      expect(result).toBe(false);
    });
  });

  // ─── reorderPitches ────────────────────────────────────────────────────────
  describe('reorderPitches', () => {
    it('puts reorder and returns true on success', async () => {
      mockPut.mockResolvedValue({ success: true });

      const result = await SlateService.reorderPitches(1, [3, 1, 2]);

      expect(mockPut).toHaveBeenCalledWith('/api/slates/1/pitches/reorder', { pitch_ids: [3, 1, 2] });
      expect(result).toBe(true);
    });

    it('returns false when API throws', async () => {
      mockPut.mockRejectedValue(new Error('Invalid order'));

      const result = await SlateService.reorderPitches(1, []);

      expect(result).toBe(false);
    });
  });
});
