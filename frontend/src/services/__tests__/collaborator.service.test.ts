import { describe, it, expect, vi, beforeEach } from 'vitest';

// collaborator.service uses `fetch` directly (not apiClient), so we stub globalThis.fetch.

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { CollaboratorService } from '../collaborator.service';
import type { Collaborator, Collaboration, CollaborationProject, CollaborationNote, ActivityEntry } from '../collaborator.service';

// Helpers to build mock Response objects
function makeResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const mockCollaborator: Collaborator = {
  id: 1,
  user_id: 42,
  invited_email: 'bob@example.com',
  role: 'editor',
  custom_role_name: null,
  status: 'active',
  user: { name: 'Bob', avatar_url: null },
  invited_at: '2026-01-01T00:00:00Z',
  accepted_at: '2026-01-02T00:00:00Z',
};

const mockCollaboration: Collaboration = {
  project_id: 10,
  project_title: 'Sci-Fi Feature',
  project_stage: 'development',
  my_role: 'writer',
  owner: { name: 'Alice', avatar_url: null },
  completion_percentage: 40,
  next_milestone: 'Script review',
  accepted_at: '2026-01-10T00:00:00Z',
};

const mockProject: CollaborationProject = {
  id: 10,
  title: 'Sci-Fi Feature',
  stage: 'development',
  status: 'active',
  priority: 'high',
  completion_percentage: 40,
  next_milestone: 'Script review',
  milestone_date: null,
  start_date: null,
  target_completion_date: null,
  notes: null,
  my_role: 'writer',
  owner: { name: 'Alice', avatar_url: null },
  budget_visible: false,
};

const mockNote: CollaborationNote = {
  id: 1,
  content: 'Check script by Friday',
  category: 'task',
  author: 'Bob',
  created_at: '2026-01-15T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
};

const mockActivity: ActivityEntry = {
  id: 1,
  action: 'comment_added',
  entity_id: 100,
  created_at: '2026-01-20T00:00:00Z',
  user: { name: 'Alice', avatar_url: null, role: 'owner' },
};

describe('CollaboratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getAllTeamCollaborators ────────────────────────────────────────────────
  describe('getAllTeamCollaborators', () => {
    it('fetches team collaborators and returns response', async () => {
      const responseBody = {
        success: true,
        data: {
          collaborators: [mockCollaborator],
          stats: { total: 1, active: 1, pending: 0, projects: 1 },
        },
      };
      mockFetch.mockResolvedValue(makeResponse(responseBody));

      const result = await CollaboratorService.getAllTeamCollaborators();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/production/team/collaborators'),
        expect.objectContaining({ credentials: 'include' })
      );
      expect(result.success).toBe(true);
      expect((result.data as any).collaborators).toHaveLength(1);
    });

    it('passes through error responses', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: false, error: 'Unauthorized' }));

      const result = await CollaboratorService.getAllTeamCollaborators();

      expect(result.success).toBe(false);
    });
  });

  // ─── inviteCollaborator ────────────────────────────────────────────────────
  describe('inviteCollaborator', () => {
    it('POSTs invite with correct data', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { collaborator: mockCollaborator } }));

      const result = await CollaboratorService.inviteCollaborator(10, {
        email: 'bob@example.com',
        role: 'editor',
        custom_role_name: null,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/10/collaborators/invite'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'bob@example.com', role: 'editor', custom_role_name: null }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('includes Content-Type header', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { collaborator: mockCollaborator } }));

      await CollaboratorService.inviteCollaborator(10, { email: 'test@test.com', role: 'viewer' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) })
      );
    });
  });

  // ─── listCollaborators ─────────────────────────────────────────────────────
  describe('listCollaborators', () => {
    it('fetches collaborators for a project', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { collaborators: [mockCollaborator] } }));

      const result = await CollaboratorService.listCollaborators(10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/10/collaborators'),
        expect.objectContaining({ credentials: 'include' })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── removeCollaborator ────────────────────────────────────────────────────
  describe('removeCollaborator', () => {
    it('DELETEs collaborator from project', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true }));

      const result = await CollaboratorService.removeCollaborator(10, 1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/10/collaborators/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── updateCollaboratorRole ────────────────────────────────────────────────
  describe('updateCollaboratorRole', () => {
    it('PATCHes collaborator role', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { collaborator: mockCollaborator } }));

      const result = await CollaboratorService.updateCollaboratorRole(10, 1, { role: 'viewer' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/10/collaborators/1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ role: 'viewer' }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('includes custom_role_name when provided', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { collaborator: mockCollaborator } }));

      await CollaboratorService.updateCollaboratorRole(10, 1, {
        role: 'custom',
        custom_role_name: 'Script Doctor',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.custom_role_name).toBe('Script Doctor');
    });
  });

  // ─── resendInvite ──────────────────────────────────────────────────────────
  describe('resendInvite', () => {
    it('POSTs to resend endpoint', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true }));

      const result = await CollaboratorService.resendInvite(10, 1);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects/10/collaborators/1/resend'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── acceptInvite ──────────────────────────────────────────────────────────
  describe('acceptInvite', () => {
    it('POSTs token to accept endpoint', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { project_id: 10, title: 'Sci-Fi Feature', stage: 'dev' } }));

      const result = await CollaboratorService.acceptInvite('invite_token_abc');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/collaborate/accept'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token: 'invite_token_abc' }),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── getMyCollaborations ───────────────────────────────────────────────────
  describe('getMyCollaborations', () => {
    it('fetches collaborations from /api/my/collaborations', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { collaborations: [mockCollaboration] } }));

      const result = await CollaboratorService.getMyCollaborations();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/my/collaborations'),
        expect.objectContaining({ credentials: 'include' })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── getCollaborationProject ───────────────────────────────────────────────
  describe('getCollaborationProject', () => {
    it('fetches specific collaboration project', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { project: mockProject } }));

      const result = await CollaboratorService.getCollaborationProject(10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/my/collaborations/10'),
        expect.objectContaining({ credentials: 'include' })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── getCollaborationChecklist ─────────────────────────────────────────────
  describe('getCollaborationChecklist', () => {
    it('fetches checklist for a project', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { checklist: { item1: true }, my_role: 'writer' } }));

      const result = await CollaboratorService.getCollaborationChecklist(10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/my/collaborations/10/checklist'),
        expect.objectContaining({ credentials: 'include' })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── toggleChecklistItem ───────────────────────────────────────────────────
  describe('toggleChecklistItem', () => {
    it('PATCHes checklist item to completed', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { item_id: 'item1', completed: true } }));

      const result = await CollaboratorService.toggleChecklistItem(10, 'item1', true);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/my/collaborations/10/checklist/item1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ completed: true }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('PATCHes checklist item to not completed', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { item_id: 'item1', completed: false } }));

      await CollaboratorService.toggleChecklistItem(10, 'item1', false);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.completed).toBe(false);
    });
  });

  // ─── getCollaborationNotes ─────────────────────────────────────────────────
  describe('getCollaborationNotes', () => {
    it('fetches notes for a project', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { notes: [mockNote] } }));

      const result = await CollaboratorService.getCollaborationNotes(10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/my/collaborations/10/notes'),
        expect.objectContaining({ credentials: 'include' })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── addCollaborationNote ──────────────────────────────────────────────────
  describe('addCollaborationNote', () => {
    it('POSTs note to project', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { note: mockNote } }));

      const result = await CollaboratorService.addCollaborationNote(10, {
        content: 'Check script by Friday',
        category: 'task',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/my/collaborations/10/notes'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'Check script by Friday', category: 'task' }),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  // ─── getCollaborationActivity ──────────────────────────────────────────────
  describe('getCollaborationActivity', () => {
    it('fetches activity without params', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { activity: [mockActivity] } }));

      const result = await CollaboratorService.getCollaborationActivity(10);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/my/collaborations/10/activity'),
        expect.objectContaining({ credentials: 'include' })
      );
      // No query string when no params
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('?');
      expect(result.success).toBe(true);
    });

    it('appends limit param when provided', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { activity: [] } }));

      await CollaboratorService.getCollaborationActivity(10, { limit: 20 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
    });

    it('appends offset param when provided', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { activity: [] } }));

      await CollaboratorService.getCollaborationActivity(10, { offset: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=10'),
        expect.any(Object)
      );
    });

    it('appends both limit and offset when provided', async () => {
      mockFetch.mockResolvedValue(makeResponse({ success: true, data: { activity: [] } }));

      await CollaboratorService.getCollaborationActivity(10, { limit: 5, offset: 15 });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=5');
      expect(calledUrl).toContain('offset=15');
    });
  });
});
