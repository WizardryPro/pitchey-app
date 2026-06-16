/**
 * Slate Service — API calls for curated pitch collections
 *
 * apiClient methods NEVER throw — they resolve with a TypedApiResponse
 * `{ success, data?, error? }`, returning `{ success:false, error }` on
 * 4xx/5xx/network failure. Every method below must therefore honor the
 * `success` flag and surface failure as null/false rather than reporting
 * the error wrapper as if it were a successful result.
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

/**
 * True when the apiClient response represents a failure.
 * apiClient resolves with `{ success:false, error }` on any non-2xx / network
 * error. We treat an explicit `success === false` as failure; responses that
 * omit `success` are passed through (the older/unwrapped success shape).
 */
function isFailure(res: any): boolean {
  return res?.success === false;
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
      if (isFailure(res)) return [];
      return (res as any)?.data?.slates ?? (res as any)?.slates ?? [];
    } catch {
      return [];
    }
  }

  static async get(id: number): Promise<SlateDetail | null> {
    try {
      const res = await apiClient.get<SlateDetail>(`/api/slates/${id}`);
      if (isFailure(res)) return null;
      return (res as any)?.data ?? res ?? null;
    } catch {
      return null;
    }
  }

  static async create(data: { title: string; description?: string; cover_image?: string }): Promise<Slate | null> {
    try {
      const res = await apiClient.post<Slate>('/api/slates', data);
      if (isFailure(res)) {
        console.error('[slate] create failed', (res as any)?.error);
        return null;
      }
      return (res as any)?.data ?? res ?? null;
    } catch (e) {
      console.error('[slate] create failed', e);
      return null;
    }
  }

  static async update(id: number, data: Partial<Pick<Slate, 'title' | 'description' | 'cover_image' | 'status'>>): Promise<Slate | null> {
    try {
      const res = await apiClient.put<Slate>(`/api/slates/${id}`, data);
      if (isFailure(res)) {
        console.error('[slate] update failed', (res as any)?.error);
        return null;
      }
      return (res as any)?.data ?? res ?? null;
    } catch (e) {
      console.error('[slate] update failed', e);
      return null;
    }
  }

  static async remove(id: number): Promise<boolean> {
    try {
      const res = await apiClient.delete(`/api/slates/${id}`);
      if (isFailure(res)) {
        console.error('[slate] remove failed', (res as any)?.error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[slate] remove failed', e);
      return false;
    }
  }

  static async addPitch(slateId: number, pitchId: number): Promise<boolean> {
    try {
      const res = await apiClient.post(`/api/slates/${slateId}/pitches`, { pitch_id: pitchId });
      if (isFailure(res)) {
        console.error('[slate] addPitch failed', (res as any)?.error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[slate] addPitch failed', e);
      return false;
    }
  }

  static async removePitch(slateId: number, pitchId: number): Promise<boolean> {
    try {
      const res = await apiClient.delete(`/api/slates/${slateId}/pitches/${pitchId}`);
      if (isFailure(res)) {
        console.error('[slate] removePitch failed', (res as any)?.error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[slate] removePitch failed', e);
      return false;
    }
  }

  static async reorderPitches(slateId: number, pitchIds: number[]): Promise<boolean> {
    try {
      const res = await apiClient.put(`/api/slates/${slateId}/pitches/reorder`, { pitch_ids: pitchIds });
      if (isFailure(res)) {
        console.error('[slate] reorderPitches failed', (res as any)?.error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[slate] reorderPitches failed', e);
      return false;
    }
  }
}
