import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock apiClient BEFORE importing the service ─────────────────────────────
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: vi.fn(),
    delete: vi.fn(),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

import { callsService } from '../calls.service';
import type { OpenCall, CallSubmission, MySubmission } from '../calls.service';

const mockCall: OpenCall = {
  id: 1,
  poster_user_id: 10,
  poster_type: 'production',
  title: 'Sci-Fi Drama',
  mandate: 'Looking for fresh sci-fi stories',
  seeking_genres: 'Sci-Fi',
  seeking_formats: 'Feature',
  budget_min_usd: 100000,
  budget_max_usd: 500000,
  region: 'UK',
  status: 'open',
  slots: 5,
  deadline: '2026-12-31',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-10T00:00:00Z',
  poster_name: 'Big Studio',
  poster_username: 'bigstudio',
  poster_verification_tier: 'gold',
  poster_user_type: 'production',
  submission_count: 3,
};

const mockSubmission: CallSubmission = {
  id: 100,
  call_id: 1,
  pitch_id: 200,
  message: 'My pitch is perfect for this!',
  status: 'new',
  created_at: '2026-02-01T00:00:00Z',
  pitch_title: 'My Sci-Fi Pitch',
  creator_name: 'Alice',
  creator_id: 42,
};

const mockMySubmission: MySubmission = {
  id: 50,
  call_id: 1,
  pitch_id: 200,
  status: 'shortlisted',
  created_at: '2026-02-01T00:00:00Z',
  call_title: 'Sci-Fi Drama',
  call_poster_type: 'production',
  pitch_title: 'My Sci-Fi Pitch',
};

describe('callsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── list ──────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('returns calls on success (no filters)', async () => {
      mockGet.mockResolvedValue({ success: true, data: { calls: [mockCall] } });

      const result = await callsService.list();

      expect(mockGet).toHaveBeenCalledWith('/api/calls');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Sci-Fi Drama');
    });

    it('appends type filter when not "all"', async () => {
      mockGet.mockResolvedValue({ success: true, data: { calls: [] } });

      await callsService.list({ type: 'production' });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('type=production'));
    });

    it('does NOT append type filter when value is "all"', async () => {
      mockGet.mockResolvedValue({ success: true, data: { calls: [] } });

      await callsService.list({ type: 'all' });

      const call = mockGet.mock.calls[0][0] as string;
      expect(call).not.toContain('type=');
    });

    it('appends genre filter', async () => {
      mockGet.mockResolvedValue({ success: true, data: { calls: [] } });

      await callsService.list({ genre: 'Drama' });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('genre=Drama'));
    });

    it('appends q filter', async () => {
      mockGet.mockResolvedValue({ success: true, data: { calls: [] } });

      await callsService.list({ q: 'thriller' });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('q=thriller'));
    });

    it('appends status filter', async () => {
      mockGet.mockResolvedValue({ success: true, data: { calls: [] } });

      await callsService.list({ status: 'closed' });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('status=closed'));
    });

    it('appends multiple filters', async () => {
      mockGet.mockResolvedValue({ success: true, data: { calls: [mockCall] } });

      await callsService.list({ type: 'investor', genre: 'Comedy', status: 'open' });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain('type=investor');
      expect(url).toContain('genre=Comedy');
      expect(url).toContain('status=open');
    });

    it('returns empty array when API returns failure', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await callsService.list();

      expect(result).toEqual([]);
    });

    it('returns empty array when no calls in response', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      const result = await callsService.list();

      expect(result).toEqual([]);
    });

    it('handles double-wrapped data (data.data.calls)', async () => {
      mockGet.mockResolvedValue({ success: true, data: { data: { calls: [mockCall] } } });

      const result = await callsService.list();

      expect(result).toHaveLength(1);
    });
  });

  // ─── mine ──────────────────────────────────────────────────────────────────
  describe('mine', () => {
    it('returns my posted calls on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: { calls: [mockCall] } });

      const result = await callsService.mine();

      expect(mockGet).toHaveBeenCalledWith('/api/calls/mine');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('returns empty array on API failure', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await callsService.mine();

      expect(result).toEqual([]);
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('posts and returns the created call id', async () => {
      mockPost.mockResolvedValue({ success: true, data: { id: 42 } });

      const result = await callsService.create({
        title: 'New Call',
        mandate: 'Seeking great stories',
        status: 'open',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/calls', expect.objectContaining({ title: 'New Call' }));
      expect(result).toBe(42);
    });

    it('throws on API failure with error message', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Validation error' } });

      await expect(callsService.create({ title: 'Bad' })).rejects.toThrow('Validation error');
    });

    it('throws with default message when no error message in response', async () => {
      mockPost.mockResolvedValue({ success: false });

      await expect(callsService.create({ title: 'Bad' })).rejects.toThrow('Failed to post call');
    });

    it('throws with string error', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'Not allowed' });

      await expect(callsService.create({ title: 'Bad' })).rejects.toThrow('Not allowed');
    });

    it('returns null when id missing from successful response', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} });

      const result = await callsService.create({ title: 'No ID' });

      expect(result).toBeNull();
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('patches the call and resolves on success', async () => {
      mockPatch.mockResolvedValue({ success: true });

      await expect(callsService.update(1, { status: 'closed' })).resolves.toBeUndefined();
      expect(mockPatch).toHaveBeenCalledWith('/api/calls/1', { status: 'closed' });
    });

    it('throws on API failure', async () => {
      mockPatch.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      await expect(callsService.update(99, { title: 'Update' })).rejects.toThrow('Not found');
    });

    it('throws with default message when no error details', async () => {
      mockPatch.mockResolvedValue({ success: false });

      await expect(callsService.update(1, {})).rejects.toThrow('Failed to update call');
    });
  });

  // ─── submit ────────────────────────────────────────────────────────────────
  describe('submit', () => {
    it('posts submission and resolves on success', async () => {
      mockPost.mockResolvedValue({ success: true });

      await expect(callsService.submit(1, 200, 'My pitch!')).resolves.toBeUndefined();
      expect(mockPost).toHaveBeenCalledWith('/api/calls/1/submissions', {
        pitchId: 200,
        message: 'My pitch!',
      });
    });

    it('throws on API failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Already submitted' } });

      await expect(callsService.submit(1, 200, 'Dup')).rejects.toThrow('Already submitted');
    });

    it('throws with default message on unspecified failure', async () => {
      mockPost.mockResolvedValue({ success: false });

      await expect(callsService.submit(1, 200, '')).rejects.toThrow('Failed to submit');
    });
  });

  // ─── submissions ───────────────────────────────────────────────────────────
  describe('submissions', () => {
    it('returns submissions for a call', async () => {
      mockGet.mockResolvedValue({ success: true, data: { submissions: [mockSubmission] } });

      const result = await callsService.submissions(1);

      expect(mockGet).toHaveBeenCalledWith('/api/calls/1/submissions');
      expect(result).toHaveLength(1);
      expect(result[0].pitch_title).toBe('My Sci-Fi Pitch');
    });

    it('returns empty array on failure', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await callsService.submissions(99);

      expect(result).toEqual([]);
    });

    it('returns empty array when no submissions in response', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      const result = await callsService.submissions(1);

      expect(result).toEqual([]);
    });
  });

  // ─── mySubmissions ─────────────────────────────────────────────────────────
  describe('mySubmissions', () => {
    it('returns my submissions on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: { submissions: [mockMySubmission] } });

      const result = await callsService.mySubmissions();

      expect(mockGet).toHaveBeenCalledWith('/api/calls/submissions/mine');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('shortlisted');
    });

    it('returns empty array on failure', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await callsService.mySubmissions();

      expect(result).toEqual([]);
    });
  });

  // ─── updateSubmission ──────────────────────────────────────────────────────
  describe('updateSubmission', () => {
    it('patches submission status and resolves on success', async () => {
      mockPatch.mockResolvedValue({ success: true });

      await expect(callsService.updateSubmission(100, 'accepted')).resolves.toBeUndefined();
      expect(mockPatch).toHaveBeenCalledWith('/api/calls/submissions/100', { status: 'accepted' });
    });

    it('throws on API failure', async () => {
      mockPatch.mockResolvedValue({ success: false, error: { message: 'Submission not found' } });

      await expect(callsService.updateSubmission(999, 'declined')).rejects.toThrow('Submission not found');
    });

    it('throws with default message when no error details', async () => {
      mockPatch.mockResolvedValue({ success: false });

      await expect(callsService.updateSubmission(1, 'declined')).rejects.toThrow('Failed to update submission');
    });

    it('handles all valid SubmissionStatus values', async () => {
      const statuses = ['new', 'shortlisted', 'declined', 'accepted'] as const;
      mockPatch.mockResolvedValue({ success: true });

      for (const status of statuses) {
        await expect(callsService.updateSubmission(1, status)).resolves.toBeUndefined();
      }
      expect(mockPatch).toHaveBeenCalledTimes(statuses.length);
    });
  });
});
