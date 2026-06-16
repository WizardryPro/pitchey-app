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

import { FeedbackService } from '../feedback.service';
import type { FeedbackEntry, FeedbackResponse, ConsumptionStatus, FeedbackProgress, CommentEntry } from '../feedback.service';

const mockFeedbackEntry: FeedbackEntry = {
  id: 1,
  reviewer_type: 'investor',
  rating: 8,
  strengths: ['Original concept', 'Strong characters'],
  weaknesses: ['Pacing issues'],
  suggestions: ['Tighten second act'],
  overall_feedback: 'Very promising pitch',
  is_interested: true,
  is_anonymous: false,
  created_at: '2026-01-15T00:00:00Z',
  reviewer_id: 42,
  reviewer_name: 'Sarah Investor',
  reviewer_company: 'Big Fund LLC',
};

const mockFeedbackResponse: FeedbackResponse = {
  ratings: {
    pitchey_score: 7.5,
    viewer_score: 8.2,
    avg_rating: 7.9,
    total_reviews: 12,
    distribution: [0, 0, 0, 1, 1, 2, 3, 2, 2, 1],
  },
  breakdown: {
    investor: { count: 5, avgRating: 8.1, weightedAvg: 8.5 },
  },
  feedback: [mockFeedbackEntry],
};

const mockConsumptionStatus: ConsumptionStatus = {
  eligible: true,
  viewDuration: 45,
  threshold: 30,
};

const mockFeedbackProgress: FeedbackProgress = {
  hasFeedback: true,
  feedbackAt: '2026-01-10T00:00:00Z',
  editedSinceFeedback: true,
  editCount: 2,
  scoreAtFeedback: 7.0,
  scoreNow: 7.5,
  scoreDelta: 0.5,
};

const mockComment: CommentEntry = {
  id: 1,
  content: 'Great concept!',
  created_at: '2026-01-20T00:00:00Z',
  display_name: 'Alice',
  user_type: 'creator',
  is_anonymous: false,
};

describe('FeedbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getConsumptionStatus ──────────────────────────────────────────────────
  describe('getConsumptionStatus', () => {
    it('returns consumption status on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockConsumptionStatus });

      const result = await FeedbackService.getConsumptionStatus(100);

      expect(mockGet).toHaveBeenCalledWith('/api/pitches/100/consumption-status');
      expect(result.eligible).toBe(true);
      expect(result.viewDuration).toBe(45);
      expect(result.threshold).toBe(30);
    });

    it('returns default status when data is null/undefined', async () => {
      mockGet.mockResolvedValue({ success: true, data: undefined });

      const result = await FeedbackService.getConsumptionStatus(100);

      expect(result.eligible).toBe(false);
      expect(result.viewDuration).toBe(0);
      expect(result.threshold).toBe(30);
    });

    it('returns default status on API error', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await FeedbackService.getConsumptionStatus(100);

      expect(result.eligible).toBe(false);
      expect(result.viewDuration).toBe(0);
      expect(result.threshold).toBe(30);
    });

    it('returns default status on non-ok API response', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await FeedbackService.getConsumptionStatus(100);

      // data is undefined → returns default
      expect(result.eligible).toBe(false);
    });
  });

  // ─── getFeedback ───────────────────────────────────────────────────────────
  describe('getFeedback', () => {
    it('returns feedback response on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockFeedbackResponse });

      const result = await FeedbackService.getFeedback(100);

      expect(mockGet).toHaveBeenCalledWith('/api/pitches/100/feedback');
      expect(result.ratings?.avg_rating).toBe(7.9);
      expect(result.feedback).toHaveLength(1);
      expect(result.feedback[0].reviewer_name).toBe('Sarah Investor');
    });

    it('returns empty response when data is undefined', async () => {
      mockGet.mockResolvedValue({ success: true, data: undefined });

      const result = await FeedbackService.getFeedback(100);

      expect(result.ratings).toBeNull();
      expect(result.feedback).toEqual([]);
    });

    it('returns empty response on API error', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));

      const result = await FeedbackService.getFeedback(100);

      expect(result.ratings).toBeNull();
      expect(result.feedback).toEqual([]);
    });
  });

  // ─── getMyFeedback ─────────────────────────────────────────────────────────
  describe('getMyFeedback', () => {
    it('returns my feedback entry on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockFeedbackEntry });

      const result = await FeedbackService.getMyFeedback(100);

      expect(mockGet).toHaveBeenCalledWith('/api/pitches/100/feedback/mine');
      expect(result?.id).toBe(1);
      expect(result?.rating).toBe(8);
    });

    it('returns null when no feedback exists (data null)', async () => {
      mockGet.mockResolvedValue({ success: true, data: null });

      const result = await FeedbackService.getMyFeedback(100);

      expect(result).toBeNull();
    });

    it('returns null when data is undefined', async () => {
      mockGet.mockResolvedValue({ success: true, data: undefined });

      const result = await FeedbackService.getMyFeedback(100);

      expect(result).toBeNull();
    });

    it('returns null on API error', async () => {
      mockGet.mockRejectedValue(new Error('Unauthorized'));

      const result = await FeedbackService.getMyFeedback(100);

      expect(result).toBeNull();
    });
  });

  // ─── getFeedbackProgress ───────────────────────────────────────────────────
  describe('getFeedbackProgress', () => {
    it('returns feedback progress on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: { progress: mockFeedbackProgress } });

      const result = await FeedbackService.getFeedbackProgress(100);

      expect(mockGet).toHaveBeenCalledWith('/api/pitches/100/feedback-progress');
      expect(result?.hasFeedback).toBe(true);
      expect(result?.scoreDelta).toBe(0.5);
    });

    it('returns null when progress is missing from data', async () => {
      mockGet.mockResolvedValue({ success: true, data: {} });

      const result = await FeedbackService.getFeedbackProgress(100);

      expect(result).toBeNull();
    });

    it('returns null when data is undefined', async () => {
      mockGet.mockResolvedValue({ success: true, data: undefined });

      const result = await FeedbackService.getFeedbackProgress(100);

      expect(result).toBeNull();
    });

    it('returns null on API error', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));

      const result = await FeedbackService.getFeedbackProgress(100);

      expect(result).toBeNull();
    });
  });

  // ─── submit ────────────────────────────────────────────────────────────────
  describe('submit', () => {
    it('posts feedback and returns id on success', async () => {
      mockPost.mockResolvedValue({ success: true, data: { id: 99 } });

      const result = await FeedbackService.submit(100, {
        rating: 8,
        strengths: ['Good concept'],
        weaknesses: [],
        suggestions: [],
        is_anonymous: false,
      });

      expect(mockPost).toHaveBeenCalledWith('/api/pitches/100/feedback', expect.objectContaining({
        rating: 8,
        strengths: ['Good concept'],
      }));
      expect(result?.id).toBe(99);
    });

    it('returns null when data is undefined', async () => {
      mockPost.mockResolvedValue({ success: true, data: undefined });

      const result = await FeedbackService.submit(100, { strengths: [], weaknesses: [], suggestions: [] });

      expect(result).toBeNull();
    });

    it('returns null when API fails (no throw)', async () => {
      mockPost.mockResolvedValue({ success: false });

      const result = await FeedbackService.submit(100, { strengths: [], weaknesses: [], suggestions: [] });

      expect(result).toBeNull();
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('puts updated feedback and returns true on success', async () => {
      mockPut.mockResolvedValue({ success: true, data: { id: 1, created_at: '2026-01-01' } });

      const result = await FeedbackService.update(100, {
        rating: 9,
        strengths: ['Even better now'],
        weaknesses: [],
        suggestions: [],
      });

      expect(mockPut).toHaveBeenCalledWith('/api/pitches/100/feedback', expect.objectContaining({ rating: 9 }));
      expect(result).toBe(true);
    });

    it('returns false when API fails', async () => {
      mockPut.mockResolvedValue({ success: false });

      const result = await FeedbackService.update(100, { strengths: [], weaknesses: [], suggestions: [] });

      expect(result).toBe(false);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('deletes feedback and returns true on success', async () => {
      mockDelete.mockResolvedValue({ success: true, data: { success: true } });

      const result = await FeedbackService.remove(100);

      expect(mockDelete).toHaveBeenCalledWith('/api/pitches/100/feedback');
      expect(result).toBe(true);
    });

    it('returns false when data.success is false', async () => {
      mockDelete.mockResolvedValue({ success: true, data: { success: false } });

      const result = await FeedbackService.remove(100);

      expect(result).toBe(false);
    });

    it('returns false when data is undefined', async () => {
      mockDelete.mockResolvedValue({ success: true, data: undefined });

      const result = await FeedbackService.remove(100);

      expect(result).toBe(false);
    });
  });

  // ─── submitRating ──────────────────────────────────────────────────────────
  describe('submitRating', () => {
    it('posts rating and returns true on success', async () => {
      mockPost.mockResolvedValue({ success: true, data: { rating: 7 } });

      const result = await FeedbackService.submitRating(100, 7);

      expect(mockPost).toHaveBeenCalledWith('/api/pitches/100/rate', { rating: 7 });
      expect(result).toBe(true);
    });

    it('returns false when API response is not successful', async () => {
      mockPost.mockResolvedValue({ success: false });

      const result = await FeedbackService.submitRating(100, 5);

      expect(result).toBe(false);
    });

    it('returns false on API error', async () => {
      mockPost.mockRejectedValue(new Error('Server error'));

      const result = await FeedbackService.submitRating(100, 5);

      expect(result).toBe(false);
    });

    it('handles ratings at boundary values (1 and 10)', async () => {
      mockPost.mockResolvedValue({ success: true, data: { rating: 1 } });
      expect(await FeedbackService.submitRating(100, 1)).toBe(true);

      mockPost.mockResolvedValue({ success: true, data: { rating: 10 } });
      expect(await FeedbackService.submitRating(100, 10)).toBe(true);
    });
  });

  // ─── getRatingStatus ───────────────────────────────────────────────────────
  describe('getRatingStatus', () => {
    it('returns the current rating when present', async () => {
      mockGet.mockResolvedValue({ success: true, data: { rating: 8 } });

      const result = await FeedbackService.getRatingStatus(100);

      expect(mockGet).toHaveBeenCalledWith('/api/pitches/100/rating-status');
      expect(result).toBe(8);
    });

    it('returns null when rating is null in response', async () => {
      mockGet.mockResolvedValue({ success: true, data: { rating: null } });

      const result = await FeedbackService.getRatingStatus(100);

      expect(result).toBeNull();
    });

    it('returns null when data is undefined', async () => {
      mockGet.mockResolvedValue({ success: true, data: undefined });

      const result = await FeedbackService.getRatingStatus(100);

      expect(result).toBeNull();
    });

    it('returns null on API error', async () => {
      mockGet.mockRejectedValue(new Error('Unauthorized'));

      const result = await FeedbackService.getRatingStatus(100);

      expect(result).toBeNull();
    });
  });

  // ─── getComments ───────────────────────────────────────────────────────────
  describe('getComments', () => {
    it('returns comments on success', async () => {
      mockGet.mockResolvedValue({ success: true, data: [mockComment] });

      const result = await FeedbackService.getComments(100);

      expect(mockGet).toHaveBeenCalledWith('/api/pitches/100/comments');
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Great concept!');
    });

    it('returns empty array when data is undefined', async () => {
      mockGet.mockResolvedValue({ success: true, data: undefined });

      const result = await FeedbackService.getComments(100);

      expect(result).toEqual([]);
    });

    it('returns empty array on API error', async () => {
      mockGet.mockRejectedValue(new Error('Server error'));

      const result = await FeedbackService.getComments(100);

      expect(result).toEqual([]);
    });
  });

  // ─── submitComment ─────────────────────────────────────────────────────────
  describe('submitComment', () => {
    it('posts comment and returns true on success', async () => {
      mockPost.mockResolvedValue({ success: true, data: { id: 5 } });

      const result = await FeedbackService.submitComment(100, 'Great pitch!');

      expect(mockPost).toHaveBeenCalledWith('/api/pitches/100/comments', {
        content: 'Great pitch!',
        isAnonymous: false,
      });
      expect(result).toBe(true);
    });

    it('submits anonymously when isAnonymous is true', async () => {
      mockPost.mockResolvedValue({ success: true, data: { id: 6 } });

      await FeedbackService.submitComment(100, 'Anonymous comment', true);

      expect(mockPost).toHaveBeenCalledWith('/api/pitches/100/comments', {
        content: 'Anonymous comment',
        isAnonymous: true,
      });
    });

    it('returns false when API response is not successful', async () => {
      mockPost.mockResolvedValue({ success: false });

      const result = await FeedbackService.submitComment(100, 'Bad comment');

      expect(result).toBe(false);
    });

    it('returns false on API error', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      const result = await FeedbackService.submitComment(100, 'Failing comment');

      expect(result).toBe(false);
    });

    it('defaults isAnonymous to false when not provided', async () => {
      mockPost.mockResolvedValue({ success: true, data: { id: 7 } });

      await FeedbackService.submitComment(100, 'Named comment');

      const callArgs = mockPost.mock.calls[0][1] as { isAnonymous: boolean };
      expect(callArgs.isAnonymous).toBe(false);
    });
  });
});
