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

function unwrap<T>(res: { success: boolean; data?: unknown }, key: string, fallback: T): T {
  if (!res.success) return fallback;
  const d = res.data as Record<string, unknown> | undefined;
  const inner = (d?.data as Record<string, unknown> | undefined) ?? d;
  return ((inner?.[key] as T) ?? fallback);
}

class CompareService {
  async subjects(type: 'creator' | 'pitch', ids: number[]): Promise<CompareSubject[]> {
    if (ids.length === 0) return [];
    const res = await apiClient.get<{ subjects: CompareSubject[] }>(`/api/compare?type=${type}&ids=${ids.join(',')}`);
    return unwrap<CompareSubject[]>(res, 'subjects', []);
  }

  async creators(ids: number[]): Promise<CompareSubject[]> {
    return this.subjects('creator', ids);
  }

  // Picker typeahead — dedicated creator/production search.
  async searchCreators(q: string): Promise<CreatorOption[]> {
    if (!q.trim()) return [];
    const res = await apiClient.get<{ creators: Array<Record<string, unknown>> }>(`/api/compare/creators?q=${encodeURIComponent(q)}`);
    const creators = unwrap<Array<Record<string, unknown>>>(res, 'creators', []);
    return creators.map((u) => ({
      id: Number(u.id),
      name: String(u.name || u.username || 'Unknown'),
      username: u.username as string | undefined,
      avatar: (u.avatar as string | null | undefined) ?? null,
      userType: u.user_type as string | undefined,
    })).filter((u) => Number.isFinite(u.id));
  }
}

export const compareService = new CompareService();
