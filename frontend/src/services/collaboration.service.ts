/**
 * Collaboration Service - API client for collaboration management
 * Integrates with /api/collaborations endpoints (when available)
 * Falls back to related endpoints for partial data
 */

import { apiClient } from '../lib/api-client';

// Types for collaboration data
export interface CollaborationPartner {
  id: string;
  name: string;
  type: 'creator' | 'investor' | 'production' | 'distributor' | 'talent';
  avatar?: string;
  company?: string;
  verified: boolean;
}

export interface CollaborationProject {
  id: string;
  title: string;
  genre: string;
}

export interface CollaborationTerms {
  budget?: number;
  equity?: number;
  timeline?: string;
  deliverables?: string[];
}

export interface Collaboration {
  id: string;
  title: string;
  type: 'co-creation' | 'investment' | 'production' | 'distribution' | 'talent';
  status: 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';
  partner: CollaborationPartner;
  project?: CollaborationProject;
  description: string;
  terms?: CollaborationTerms;
  proposedDate: string;
  startDate?: string;
  endDate?: string;
  lastUpdate: string;
  priority: 'low' | 'medium' | 'high';
  isPublic: boolean;
  metrics?: {
    rating?: number;
    reviews?: number;
    completionRate?: number;
  };
}

export class CollaborationService {
  /**
   * Get all collaborations for the current user
   */
  static async getCollaborations(filters?: {
    type?: string;
    status?: string;
    partnerId?: string;
  }): Promise<Collaboration[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.type && filters.type !== 'all') params.append('type', filters.type);
      if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters?.partnerId) params.append('partnerId', filters.partnerId);

      const queryString = params.toString();
      const url = `/api/collaborations${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get<{ collaborations: Collaboration[] }>(url);

      if (response.success && response.data?.collaborations) {
        return response.data.collaborations;
      }

      // If no dedicated endpoint exists, return empty array
      // The component will handle empty state gracefully
      return [];
    } catch (error) {
      console.error('Failed to fetch collaborations:', error);
      return [];
    }
  }

  /**
   * Get a specific collaboration by ID
   */
  static async getCollaborationById(collaborationId: string): Promise<Collaboration | null> {
    try {
      const response = await apiClient.get<{ collaboration: Collaboration }>(
        `/api/collaborations/${collaborationId}`
      );

      if (response.success && response.data?.collaboration) {
        return response.data.collaboration;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch collaboration:', error);
      return null;
    }
  }

  /**
   * Create a new collaboration proposal
   */
  static async createCollaboration(data: {
    title: string;
    type: Collaboration['type'];
    partnerId: string;
    projectId?: string;
    description: string;
    terms?: CollaborationTerms;
    priority?: Collaboration['priority'];
  }): Promise<Collaboration> {
    const response = await apiClient.post<{ collaboration: Collaboration }>(
      '/api/collaborations',
      data
    );

    if (!response.success || !response.data?.collaboration) {
      throw new Error(
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Failed to create collaboration'
      );
    }

    return response.data.collaboration;
  }

  /**
   * Update collaboration status
   */
  static async updateCollaborationStatus(
    collaborationId: string,
    status: Collaboration['status']
  ): Promise<void> {
    const response = await apiClient.put<{ message: string }>(
      `/api/collaborations/${collaborationId}/status`,
      { status }
    );

    if (!response.success) {
      throw new Error(
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Failed to update collaboration status'
      );
    }
  }

  /**
   * Accept a collaboration proposal
   */
  static async acceptCollaboration(collaborationId: string): Promise<void> {
    return this.updateCollaborationStatus(collaborationId, 'active');
  }

  /**
   * Decline a collaboration proposal
   */
  static async declineCollaboration(collaborationId: string): Promise<void> {
    return this.updateCollaborationStatus(collaborationId, 'declined');
  }

  /**
   * Cancel a collaboration
   */
  static async cancelCollaboration(collaborationId: string): Promise<void> {
    return this.updateCollaborationStatus(collaborationId, 'cancelled');
  }

  /**
   * Mark collaboration as completed
   */
  static async completeCollaboration(collaborationId: string): Promise<void> {
    return this.updateCollaborationStatus(collaborationId, 'completed');
  }

  /**
   * Send a message within a collaboration
   */
  static async sendMessage(
    collaborationId: string,
    message: string
  ): Promise<void> {
    const response = await apiClient.post<{ message: string }>(
      `/api/collaborations/${collaborationId}/messages`,
      { content: message }
    );

    if (!response.success) {
      throw new Error(
        typeof response.error === 'string'
          ? response.error
          : response.error?.message || 'Failed to send message'
      );
    }
  }

  /**
   * Get collaboration statistics
   */
  static async getCollaborationStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    completed: number;
    totalValue: number;
  }> {
    try {
      const response = await apiClient.get<{
        stats: {
          total: number;
          active: number;
          pending: number;
          completed: number;
          totalValue: number;
        };
      }>('/api/collaborations/stats');

      if (response.success && response.data?.stats) {
        return response.data.stats;
      }

      return {
        total: 0,
        active: 0,
        pending: 0,
        completed: 0,
        totalValue: 0
      };
    } catch (error) {
      console.error('Failed to fetch collaboration stats:', error);
      return {
        total: 0,
        active: 0,
        pending: 0,
        completed: 0,
        totalValue: 0
      };
    }
  }
}

export default CollaborationService;
