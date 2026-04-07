/**
 * Slate Service — API calls for curated pitch collections
 */

import { apiClient } from '../lib/api-client';

export interface Slate {
  id: number;
  title: string;
  description: string | null;
  cover_image: string | null;
  status: 'draft' | 'published';
  pitch_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SlatePitch {
  entry_id: number;
  position: number;
  added_at: string;
  id: number;
  title: string;
  logline: string;
  genre: string | null;
  format: string | null;
  cover_image: string | null;
  view_count: number;
  like_count: number;
  status: string;
  created_at: string;
}

export interface SlateDetail extends Slate {
  pitches: SlatePitch[];
}

export class SlateService {
  static async list(params?: { status?: string; page?: number; limit?: number }): Promise<Slate[]> {
    try {
      const qs = new URLSearchParams();
      if (params?.status) qs.append('status', params.status);
      if (params?.page) qs.append('page', String(params.page));
      if (params?.limit) qs.append('limit', String(params.limit));
      const url = `/api/slates${qs.toString() ? '?' + qs.toString() : ''}`;
      const res = await apiClient.get<{ slates: Slate[] }>(url);
      return (res as any)?.data?.slates ?? (res as any)?.slates ?? [];
    } catch {
      return [];
    }
  }

  static async get(id: number): Promise<SlateDetail | null> {
    try {
      const res = await apiClient.get<SlateDetail>(`/api/slates/${id}`);
      return (res as any)?.data ?? res ?? null;
    } catch {
      return null;
    }
  }

  static async create(data: { title: string; description?: string; cover_image?: string }): Promise<Slate | null> {
    try {
      const res = await apiClient.post<Slate>('/api/slates', data);
      return (res as any)?.data ?? res ?? null;
    } catch {
      return null;
    }
  }

  static async update(id: number, data: Partial<Pick<Slate, 'title' | 'description' | 'cover_image' | 'status'>>): Promise<Slate | null> {
    try {
      const res = await apiClient.put<Slate>(`/api/slates/${id}`, data);
      return (res as any)?.data ?? res ?? null;
    } catch {
      return null;
    }
  }

  static async remove(id: number): Promise<boolean> {
    try {
      await apiClient.delete(`/api/slates/${id}`);
      return true;
    } catch {
      return false;
    }
  }

  static async addPitch(slateId: number, pitchId: number): Promise<boolean> {
    try {
      await apiClient.post(`/api/slates/${slateId}/pitches`, { pitch_id: pitchId });
      return true;
    } catch {
      return false;
    }
  }

  static async removePitch(slateId: number, pitchId: number): Promise<boolean> {
    try {
      await apiClient.delete(`/api/slates/${slateId}/pitches/${pitchId}`);
      return true;
    } catch {
      return false;
    }
  }

  static async reorderPitches(slateId: number, pitchIds: number[]): Promise<boolean> {
    try {
      await apiClient.put(`/api/slates/${slateId}/pitches/reorder`, { pitch_ids: pitchIds });
      return true;
    } catch {
      return false;
    }
  }
}
