/**
 * Collaborator Service
 * API methods for project collaboration — invitation management + scoped project access.
 */

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? (isDev ? 'http://localhost:8001' : '');

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return response.json() as Promise<ApiResponse<T>>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Collaborator {
  id: number;
  user_id: number | null;
  invited_email: string;
  role: string;
  custom_role_name: string | null;
  status: 'pending' | 'active' | 'removed';
  user: { name: string; avatar_url: string | null } | null;
  invited_at: string;
  accepted_at: string | null;
  invite_token?: string;
}

export interface Collaboration {
  project_id: number;
  project_title: string;
  project_stage: string;
  my_role: string;
  custom_role_name?: string | null;
  owner: { name: string; avatar_url: string | null };
  completion_percentage: number;
  next_milestone: string | null;
  accepted_at: string;
}

export interface CollaborationProject {
  id: number;
  title: string;
  stage: string;
  status: string;
  priority: string;
  completion_percentage: number;
  next_milestone: string | null;
  milestone_date: string | null;
  start_date: string | null;
  target_completion_date: string | null;
  notes: string | null;
  my_role: string;
  owner: { name: string; avatar_url: string | null };
  budget_visible: boolean;
  budget_allocated?: number;
  budget_spent?: number;
  budget_remaining?: number;
}

export interface CollaborationNote {
  id: number;
  content: string;
  category: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityEntry {
  id: number;
  action: string;
  entity_id: number | null;
  created_at: string;
  user: { name: string; avatar_url: string | null; role: string | null };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CollaboratorService {
  // --- Production company (invitation management) ---

  static async inviteCollaborator(
    projectId: number,
    data: { email: string; role: string; custom_role_name?: string | null }
  ): Promise<ApiResponse<{ collaborator: Collaborator }>> {
    return request(`/api/projects/${projectId}/collaborators/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async listCollaborators(projectId: number): Promise<ApiResponse<{ collaborators: Collaborator[] }>> {
    return request(`/api/projects/${projectId}/collaborators`);
  }

  static async removeCollaborator(projectId: number, collaboratorId: number): Promise<ApiResponse> {
    return request(`/api/projects/${projectId}/collaborators/${collaboratorId}`, {
      method: 'DELETE',
    });
  }

  static async updateCollaboratorRole(
    projectId: number,
    collaboratorId: number,
    data: { role: string; custom_role_name?: string | null }
  ): Promise<ApiResponse<{ collaborator: Collaborator }>> {
    return request(`/api/projects/${projectId}/collaborators/${collaboratorId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  static async resendInvite(projectId: number, collaboratorId: number): Promise<ApiResponse> {
    return request(`/api/projects/${projectId}/collaborators/${collaboratorId}/resend`, {
      method: 'POST',
    });
  }

  // --- Invite acceptance ---

  static async acceptInvite(token: string): Promise<ApiResponse<{ project_id: number; title: string; stage: string }>> {
    return request('/api/collaborate/accept', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // --- Collaborator project access ---

  static async getMyCollaborations(): Promise<ApiResponse<{ collaborations: Collaboration[] }>> {
    return request('/api/my/collaborations');
  }

  static async getCollaborationProject(projectId: number): Promise<ApiResponse<{ project: CollaborationProject }>> {
    return request(`/api/my/collaborations/${projectId}`);
  }

  static async getCollaborationChecklist(projectId: number): Promise<ApiResponse<{ checklist: Record<string, unknown>; my_role: string }>> {
    return request(`/api/my/collaborations/${projectId}/checklist`);
  }

  static async toggleChecklistItem(
    projectId: number,
    itemId: string,
    completed: boolean
  ): Promise<ApiResponse<{ item_id: string; completed: boolean }>> {
    return request(`/api/my/collaborations/${projectId}/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
  }

  static async getCollaborationNotes(projectId: number): Promise<ApiResponse<{ notes: CollaborationNote[] }>> {
    return request(`/api/my/collaborations/${projectId}/notes`);
  }

  static async addCollaborationNote(
    projectId: number,
    data: { content: string; category: string }
  ): Promise<ApiResponse<{ note: CollaborationNote }>> {
    return request(`/api/my/collaborations/${projectId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getCollaborationActivity(
    projectId: number,
    params?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<{ activity: ActivityEntry[] }>> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request(`/api/my/collaborations/${projectId}/activity${qs ? `?${qs}` : ''}`);
  }
}
