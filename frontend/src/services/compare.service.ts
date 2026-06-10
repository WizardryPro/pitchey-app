import { apiClient } from '../lib/api-client';

// One shared subject shape for both type=creator and type=pitch. Creator-only
// fields (username/user_type/avatar/pitch_count) and pitch-only fields
// (subtitle/thumbnail/genre/format) are optional; the UI picks rows by type.
export interface CompareSubject {
  subject_id: number;
  name: string;
  username?: string | null;
  user_type?: string | null;
  verification_tier: string | null;
  avatar?: string | null;
  subtitle?: string | null;
  thumbnail?: string | null;
  genre?: string | null;
  format?: string | null;
  pitch_count?: number | string | null;
  avg_heat: number | string | null;
  avg_pitchey: number | string | null;
  total_views: number | string;
  total_likes: number | string;
  budget_min: number | string | null;
  budget_max: number | string | null;
  newest_at: string | null;
  genres: string[];
}

/** @deprecated use CompareSubject */
export type CreatorSubject = CompareSubject;

export interface CreatorOption {
  id: number;
  name: string;
  username?: string;
  avatar?: string | null;
  userType?: string;
}

// Generic picker item used by the compare page for both creators and slates.
export interface PickerItem {
  id: number;
  name: string;
  sub?: string;          // username/userType, or slate owner
  image?: string | null; // avatar or slate cover
}

function unwrap<T>(res: { success: boolean; data?: unknown }, key: string, fallback: T): T {
  if (!res.success) return fallback;
  const d = res.data as Record<string, unknown> | undefined;
  const inner = (d?.data as Record<string, unknown> | undefined) ?? d;
  return ((inner?.[key] as T) ?? fallback);
}

function errMessage(res: { error?: unknown }, def: string): string {
  const e = res.error as { message?: string } | string | undefined;
  if (typeof e === 'string') return e || def;
  return e?.message || def;
}

export interface SavedComparison {
  id: number;
  title: string;
  subject_type: 'creator' | 'pitch' | 'slate';
  subject_ids: string;
  share_token: string;
  created_at: string;
}

class CompareService {
  async subjects(type: 'creator' | 'pitch' | 'slate', ids: number[]): Promise<CompareSubject[]> {
    if (ids.length === 0) return [];
    const res = await apiClient.get<{ subjects: CompareSubject[] }>(`/api/compare?type=${type}&ids=${ids.join(',')}`);
    return unwrap<CompareSubject[]>(res, 'subjects', []);
  }

  async creators(ids: number[]): Promise<CompareSubject[]> {
    return this.subjects('creator', ids);
  }

  // Picker typeahead — dedicated creator/production search.
  async searchCreators(q: string): Promise<PickerItem[]> {
    if (!q.trim()) return [];
    const res = await apiClient.get<{ creators: Array<Record<string, unknown>> }>(`/api/compare/creators?q=${encodeURIComponent(q)}`);
    const creators = unwrap<Array<Record<string, unknown>>>(res, 'creators', []);
    return creators.map((u) => ({
      id: Number(u.id),
      name: String(u.name || u.username || 'Unknown'),
      sub: u.user_type as string | undefined,
      image: (u.avatar as string | null | undefined) ?? null,
    })).filter((u) => Number.isFinite(u.id));
  }

  async shared(token: string): Promise<{ title: string; type: 'creator' | 'pitch' | 'slate'; subjects: CompareSubject[] }> {
    const res = await apiClient.get<{ title: string; type: string; subjects: CompareSubject[] }>(`/api/compare/shared/${encodeURIComponent(token)}`);
    if (!res.success) throw new Error(errMessage(res, 'Comparison not found'));
    const d = (res.data as Record<string, unknown>) || {};
    const inner = (d.data as Record<string, unknown> | undefined) ?? d;
    return {
      title: String(inner.title ?? 'Comparison'),
      type: (inner.type as 'creator' | 'pitch' | 'slate') ?? 'creator',
      subjects: (inner.subjects as CompareSubject[]) ?? [],
    };
  }

  async save(title: string, type: string, ids: number[]): Promise<{ id: number; share_token: string }> {
    const res = await apiClient.post<{ id: number; share_token: string }>('/api/compare/saved', { title, type, ids: ids.join(',') });
    if (!res.success) throw new Error(errMessage(res, 'Failed to save'));
    const d = (res.data as Record<string, unknown>) || {};
    const inner = (d.data as Record<string, unknown> | undefined) ?? d;
    return { id: Number(inner.id), share_token: String(inner.share_token) };
  }

  async listSaved(): Promise<SavedComparison[]> {
    const res = await apiClient.get<{ comparisons: SavedComparison[] }>('/api/compare/saved');
    return unwrap<SavedComparison[]>(res, 'comparisons', []);
  }

  async deleteSaved(id: number): Promise<void> {
    await apiClient.delete(`/api/compare/saved/${id}`);
  }

  async searchSlates(q: string): Promise<PickerItem[]> {
    if (!q.trim()) return [];
    const res = await apiClient.get<{ slates: Array<Record<string, unknown>> }>(`/api/compare/slates?q=${encodeURIComponent(q)}`);
    const slates = unwrap<Array<Record<string, unknown>>>(res, 'slates', []);
    return slates.map((s) => ({
      id: Number(s.id),
      name: String(s.name || 'Untitled slate'),
      sub: s.owner as string | undefined,
      image: (s.thumbnail as string | null | undefined) ?? null,
    })).filter((s) => Number.isFinite(s.id));
  }
}

export const compareService = new CompareService();
