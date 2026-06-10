import { apiClient } from '../lib/api-client';

export interface OpenCall {
  id: number;
  poster_user_id: number;
  poster_type: 'production' | 'investor';
  title: string;
  mandate: string;
  seeking_genres: string | null;
  seeking_formats: string | null;
  budget_min_usd: number | null;
  budget_max_usd: number | null;
  region: string | null;
  status: 'open' | 'closed';
  slots: number | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  poster_name: string | null;
  poster_username: string | null;
  poster_verification_tier: string | null;
  poster_user_type: string | null;
  submission_count?: number | string;
}

export type SubmissionStatus = 'new' | 'shortlisted' | 'declined' | 'accepted';

export interface CallSubmission {
  id: number;
  call_id: number;
  pitch_id: number;
  message?: string;
  status: SubmissionStatus;
  created_at: string;
  pitch_title?: string;
  pitch_logline?: string;
  pitch_genre?: string;
  pitch_thumbnail?: string;
  creator_name?: string;
  creator_id?: number;
  creator_verification_tier?: string | null;
}

export interface MySubmission {
  id: number;
  call_id: number;
  pitch_id: number;
  status: SubmissionStatus;
  created_at: string;
  call_title?: string;
  call_poster_type?: string;
  call_poster_name?: string;
  pitch_title?: string;
}

export interface CallInput {
  title: string;
  mandate?: string;
  seekingGenres?: string;
  seekingFormats?: string;
  budgetMinUsd?: number | null;
  budgetMaxUsd?: number | null;
  region?: string;
  slots?: number | null;
  deadline?: string | null;
  status?: 'open' | 'closed';
}

// The backend wraps responses as { success, data: {...} }; apiClient may or may
// not unwrap one layer, so read both shapes defensively (same pattern as pitch.service).
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

export interface CallFilters {
  type?: string;   // 'all' | 'production' | 'investor'
  genre?: string;
  q?: string;
  status?: string; // 'open' | 'closed'
}

class CallsService {
  async list(filters: CallFilters = {}): Promise<OpenCall[]> {
    const qs = new URLSearchParams();
    if (filters.type && filters.type !== 'all') qs.set('type', filters.type);
    if (filters.genre) qs.set('genre', filters.genre);
    if (filters.q) qs.set('q', filters.q);
    if (filters.status) qs.set('status', filters.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await apiClient.get<{ calls: OpenCall[] }>(`/api/calls${suffix}`);
    return unwrap<OpenCall[]>(res, 'calls', []);
  }

  async mine(): Promise<OpenCall[]> {
    const res = await apiClient.get<{ calls: OpenCall[] }>('/api/calls/mine');
    return unwrap<OpenCall[]>(res, 'calls', []);
  }

  async create(input: CallInput): Promise<number | null> {
    const res = await apiClient.post<{ id: number }, CallInput>('/api/calls', input);
    if (!res.success) throw new Error(errMessage(res, 'Failed to post call'));
    return unwrap<number | null>(res, 'id', null);
  }

  async update(id: number, patch: Partial<CallInput>): Promise<void> {
    const res = await apiClient.patch(`/api/calls/${id}`, patch);
    if (!res.success) throw new Error(errMessage(res, 'Failed to update call'));
  }

  // --- Phase 2: submissions ---

  async submit(callId: number, pitchId: number, message: string): Promise<void> {
    const res = await apiClient.post(`/api/calls/${callId}/submissions`, { pitchId, message });
    if (!res.success) throw new Error(errMessage(res, 'Failed to submit'));
  }

  async submissions(callId: number): Promise<CallSubmission[]> {
    const res = await apiClient.get<{ submissions: CallSubmission[] }>(`/api/calls/${callId}/submissions`);
    return unwrap<CallSubmission[]>(res, 'submissions', []);
  }

  async mySubmissions(): Promise<MySubmission[]> {
    const res = await apiClient.get<{ submissions: MySubmission[] }>('/api/calls/submissions/mine');
    return unwrap<MySubmission[]>(res, 'submissions', []);
  }

  async updateSubmission(id: number, status: SubmissionStatus): Promise<void> {
    const res = await apiClient.patch(`/api/calls/submissions/${id}`, { status });
    if (!res.success) throw new Error(errMessage(res, 'Failed to update submission'));
  }
}

export const callsService = new CallsService();
