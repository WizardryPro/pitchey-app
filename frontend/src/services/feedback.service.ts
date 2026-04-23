/**
 * Feedback Service — Structured pitch feedback CRUD
 */

import { apiClient } from '../lib/api-client';

export interface FeedbackSubmission {
  rating?: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  overall_feedback?: string;
  is_interested?: boolean;
  is_anonymous?: boolean;
}

export interface FeedbackEntry {
  id: number;
  reviewer_type: string;
  rating: number | null;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  overall_feedback: string | null;
  is_interested: boolean;
  is_anonymous: boolean;
  created_at: string;
  reviewer_id: number | null;
  reviewer_name: string;
  reviewer_company: string | null;
}

export interface RatingStats {
  pitchey_score: number;
  viewer_score: number;
  avg_rating: number;
  total_reviews: number;
  distribution: number[];  // 10 buckets [1..10]
}

/** Per-role rating aggregate from GROUP BY reviewer_type on pitch_feedback + UNION with pitch_ratings_anonymous. */
export interface RoleBreakdownEntry {
  count: number;
  avgRating: number;
  weightedAvg: number;
}

/** Keys are reviewer_type values — production/investor/creator/peer (industry) or viewer/watcher/anonymous (audience). */
export interface RoleBreakdown {
  production?: RoleBreakdownEntry;
  investor?: RoleBreakdownEntry;
  creator?: RoleBreakdownEntry;
  peer?: RoleBreakdownEntry;
  viewer?: RoleBreakdownEntry;
  watcher?: RoleBreakdownEntry;
  anonymous?: RoleBreakdownEntry;
}

export interface FeedbackResponse {
  ratings: RatingStats | null;
  breakdown?: RoleBreakdown;
  feedback: FeedbackEntry[];
}

export interface CommentEntry {
  id: number;
  content: string;
  created_at: string;
  display_name: string;
  user_type: string;
}

export interface ConsumptionStatus {
  eligible: boolean;
  viewDuration: number;
  threshold: number;
}

export class FeedbackService {
  // Note: apiClient.get returns { success, data } where `data` is ALREADY the
  // server's `.data` field unwrapped (see api-client.ts makeRequest). Consumers
  // used to read `res.data?.data` (double-unwrap) which always fell through to
  // the default — feedback UI looked broken across the board even when the
  // backend returned valid data. Fixed 2026-04-23.
  static async getConsumptionStatus(pitchId: number): Promise<ConsumptionStatus> {
    try {
      const res = await apiClient.get<ConsumptionStatus>(`/api/pitches/${pitchId}/consumption-status`);
      return res.data ?? { eligible: false, viewDuration: 0, threshold: 30 };
    } catch {
      return { eligible: false, viewDuration: 0, threshold: 30 };
    }
  }

  static async getFeedback(pitchId: number): Promise<FeedbackResponse> {
    try {
      const res = await apiClient.get<FeedbackResponse>(`/api/pitches/${pitchId}/feedback`);
      return res.data ?? { ratings: null, feedback: [] };
    } catch {
      return { ratings: null, feedback: [] };
    }
  }

  static async getMyFeedback(pitchId: number): Promise<FeedbackEntry | null> {
    try {
      const res = await apiClient.get<FeedbackEntry | null>(`/api/pitches/${pitchId}/feedback/mine`);
      return res.data ?? null;
    } catch {
      return null;
    }
  }

  static async submit(pitchId: number, data: FeedbackSubmission): Promise<{ id: number } | null> {
    const res = await apiClient.post<{ id: number }>(`/api/pitches/${pitchId}/feedback`, data);
    return res.data ?? null;
  }

  static async update(pitchId: number, data: FeedbackSubmission): Promise<boolean> {
    const res = await apiClient.put<{ success: boolean }>(`/api/pitches/${pitchId}/feedback`, data);
    return res.data?.success ?? false;
  }

  static async remove(pitchId: number): Promise<boolean> {
    const res = await apiClient.delete<{ success: boolean }>(`/api/pitches/${pitchId}/feedback`);
    return res.data?.success ?? false;
  }

  /** Submit a quick rating (works for anonymous + authenticated users) */
  static async submitRating(pitchId: number, rating: number): Promise<boolean> {
    try {
      const res = await apiClient.post<{ success: boolean }>(`/api/pitches/${pitchId}/rate`, { rating });
      return res.data?.success ?? false;
    } catch {
      return false;
    }
  }

  /** Get user's current rating for a pitch */
  static async getRatingStatus(pitchId: number): Promise<number | null> {
    try {
      const res = await apiClient.get<{ rating: number | null }>(`/api/pitches/${pitchId}/rating-status`);
      return res.data?.rating ?? null;
    } catch {
      return null;
    }
  }

  /** Get comments for a pitch */
  static async getComments(pitchId: number): Promise<CommentEntry[]> {
    try {
      const res = await apiClient.get<CommentEntry[]>(`/api/pitches/${pitchId}/comments`);
      return res.data ?? [];
    } catch {
      return [];
    }
  }

  /** Submit a comment */
  static async submitComment(pitchId: number, content: string): Promise<boolean> {
    try {
      const res = await apiClient.post<{ success: boolean }>(`/api/pitches/${pitchId}/comments`, { content });
      return res.data?.success ?? false;
    } catch {
      return false;
    }
  }
}
