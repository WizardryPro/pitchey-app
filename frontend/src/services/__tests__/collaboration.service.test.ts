import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock apiClient BEFORE importing the service ────────────────────
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();

vi.mock('../../lib/api-client', () => ({
  apiClient: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    put: (...args: any[]) => mockPut(...args),
    delete: vi.fn(),
  },
}));

import CollaborationService from '../collaboration.service';

describe('CollaborationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getCollaborations ───────────────────────────────────────────
  describe('getCollaborations', () => {
    it('returns collaborations on success', async () => {
      const mockCollaborations = [
        {
          id: 'c1',
          title: 'Action Film Co-Creation',
          type: 'co-creation',
          status: 'active',
          partner: { id: 'p1', name: 'Film Studio', type: 'production', verified: true },
          description: 'Collaborative feature film',
          proposedDate: '2026-01-01',
          lastUpdate: '2026-01-10',
          priority: 'high',
          isPublic: false,
        },
      ];

      mockGet.mockResolvedValue({
        success: true,
        data: { collaborations: mockCollaborations },
      });

      const result = await CollaborationService.getCollaborations();

      expect(mockGet).toHaveBeenCalledWith('/api/collaborations');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Action Film Co-Creation');
    });

    it('returns empty array when API returns no data', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await CollaborationService.getCollaborations();

      expect(result).toEqual([]);
    });

    it('returns empty array when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await CollaborationService.getCollaborations();

      expect(result).toEqual([]);
    });

    it('applies type filter as query param (skips "all")', async () => {
      mockGet.mockResolvedValue({ success: true, data: { collaborations: [] } });

      await CollaborationService.getCollaborations({ type: 'investment' });

      expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('type=investment'));
    });

    it('does not append filter param when filter is "all"', async () => {
      mockGet.mockResolvedValue({ success: true, data: { collaborations: [] } });

      await CollaborationService.getCollaborations({ type: 'all', status: 'all' });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).not.toContain('type=');
      expect(url).not.toContain('status=');
    });

    it('applies status and partnerId filters', async () => {
      mockGet.mockResolvedValue({ success: true, data: { collaborations: [] } });

      await CollaborationService.getCollaborations({ status: 'active', partnerId: 'p42' });

      const url = mockGet.mock.calls[0][0] as string;
      expect(url).toContain('status=active');
      expect(url).toContain('partnerId=p42');
    });
  });

  // ─── getCollaborationById ────────────────────────────────────────
  describe('getCollaborationById', () => {
    it('returns collaboration by id on success', async () => {
      const mockCollab = {
        id: 'c1',
        title: 'Film Deal',
        type: 'investment',
        status: 'pending',
        partner: { id: 'p2', name: 'Investor', type: 'investor', verified: false },
        description: 'Investment collaboration',
        proposedDate: '2026-01-01',
        lastUpdate: '2026-01-05',
        priority: 'medium',
        isPublic: true,
      };

      mockGet.mockResolvedValue({ success: true, data: { collaboration: mockCollab } });

      const result = await CollaborationService.getCollaborationById('c1');

      expect(mockGet).toHaveBeenCalledWith('/api/collaborations/c1');
      expect(result?.title).toBe('Film Deal');
    });

    it('returns null when collaboration not found', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await CollaborationService.getCollaborationById('missing');

      expect(result).toBeNull();
    });

    it('returns null when API throws', async () => {
      mockGet.mockRejectedValue(new Error('Not found'));

      const result = await CollaborationService.getCollaborationById('x');

      expect(result).toBeNull();
    });
  });

  // ─── createCollaboration ─────────────────────────────────────────
  describe('createCollaboration', () => {
    it('posts and returns new collaboration', async () => {
      const mockCollab = {
        id: 'c2',
        title: 'New Deal',
        type: 'production',
        status: 'pending',
        partner: { id: 'p3', name: 'Studio', type: 'production', verified: true },
        description: 'Production partnership',
        proposedDate: '2026-02-01',
        lastUpdate: '2026-02-01',
        priority: 'high',
        isPublic: false,
      };

      mockPost.mockResolvedValue({ success: true, data: { collaboration: mockCollab } });

      const result = await CollaborationService.createCollaboration({
        title: 'New Deal',
        type: 'production',
        partnerId: 'p3',
        description: 'Production partnership',
      });

      expect(mockPost).toHaveBeenCalledWith('/api/collaborations', expect.objectContaining({
        title: 'New Deal',
        type: 'production',
      }));
      expect(result.id).toBe('c2');
    });

    it('throws on API failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Partner not found' } });

      await expect(
        CollaborationService.createCollaboration({
          title: 'Bad Deal',
          type: 'investment',
          partnerId: 'invalid',
          description: 'Desc',
        })
      ).rejects.toThrow('Partner not found');
    });

    it('throws with string error', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'Unauthorized' });

      await expect(
        CollaborationService.createCollaboration({
          title: 'Deal',
          type: 'co-creation',
          partnerId: 'p1',
          description: 'Desc',
        })
      ).rejects.toThrow('Unauthorized');
    });
  });

  // ─── updateCollaborationStatus ───────────────────────────────────
  describe('updateCollaborationStatus', () => {
    it('calls put with correct endpoint and status', async () => {
      mockPut.mockResolvedValue({ success: true });

      await CollaborationService.updateCollaborationStatus('c1', 'active');

      expect(mockPut).toHaveBeenCalledWith('/api/collaborations/c1/status', { status: 'active' });
    });

    it('throws on failure', async () => {
      mockPut.mockResolvedValue({ success: false, error: { message: 'Not found' } });

      await expect(
        CollaborationService.updateCollaborationStatus('c1', 'declined')
      ).rejects.toThrow('Not found');
    });
  });

  // ─── acceptCollaboration ────────────────────────────────────────
  describe('acceptCollaboration', () => {
    it('calls updateCollaborationStatus with "active"', async () => {
      mockPut.mockResolvedValue({ success: true });

      await CollaborationService.acceptCollaboration('c1');

      expect(mockPut).toHaveBeenCalledWith('/api/collaborations/c1/status', { status: 'active' });
    });
  });

  // ─── declineCollaboration ────────────────────────────────────────
  describe('declineCollaboration', () => {
    it('calls updateCollaborationStatus with "declined"', async () => {
      mockPut.mockResolvedValue({ success: true });

      await CollaborationService.declineCollaboration('c1');

      expect(mockPut).toHaveBeenCalledWith('/api/collaborations/c1/status', { status: 'declined' });
    });
  });

  // ─── cancelCollaboration ─────────────────────────────────────────
  describe('cancelCollaboration', () => {
    it('calls updateCollaborationStatus with "cancelled"', async () => {
      mockPut.mockResolvedValue({ success: true });

      await CollaborationService.cancelCollaboration('c1');

      expect(mockPut).toHaveBeenCalledWith('/api/collaborations/c1/status', { status: 'cancelled' });
    });
  });

  // ─── completeCollaboration ───────────────────────────────────────
  describe('completeCollaboration', () => {
    it('calls updateCollaborationStatus with "completed"', async () => {
      mockPut.mockResolvedValue({ success: true });

      await CollaborationService.completeCollaboration('c1');

      expect(mockPut).toHaveBeenCalledWith('/api/collaborations/c1/status', { status: 'completed' });
    });
  });

  // ─── sendMessage ─────────────────────────────────────────────────
  describe('sendMessage', () => {
    it('posts message to correct endpoint', async () => {
      mockPost.mockResolvedValue({ success: true });

      await CollaborationService.sendMessage('c1', 'Hello, partner!');

      expect(mockPost).toHaveBeenCalledWith('/api/collaborations/c1/messages', {
        content: 'Hello, partner!',
      });
    });

    it('throws on failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { message: 'Message failed' } });

      await expect(CollaborationService.sendMessage('c1', 'Hi')).rejects.toThrow('Message failed');
    });
  });

  // ─── getCollaborationStats ───────────────────────────────────────
  describe('getCollaborationStats', () => {
    it('returns stats on success', async () => {
      const mockStats = { total: 10, active: 4, pending: 3, completed: 2, totalValue: 50000 };

      mockGet.mockResolvedValue({ success: true, data: { stats: mockStats } });

      const result = await CollaborationService.getCollaborationStats();

      expect(mockGet).toHaveBeenCalledWith('/api/collaborations/stats');
      expect(result.total).toBe(10);
      expect(result.active).toBe(4);
      expect(result.totalValue).toBe(50000);
    });

    it('returns empty stats on failure (no throw)', async () => {
      mockGet.mockResolvedValue({ success: false });

      const result = await CollaborationService.getCollaborationStats();

      expect(result.total).toBe(0);
      expect(result.active).toBe(0);
    });

    it('returns empty stats when throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      const result = await CollaborationService.getCollaborationStats();

      expect(result.total).toBe(0);
    });
  });
});
