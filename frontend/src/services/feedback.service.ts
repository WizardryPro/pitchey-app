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
  avg_rating: number;
  total_reviews: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

export interface FeedbackResponse {
  ratings: RatingStats | null;
  feedback: FeedbackEntry[];
}

export class FeedbackService {
  static async getFeedback(pitchId: number): Promise<FeedbackResponse> {
    try {
      const res = await apiClient.get<{ data: FeedbackResponse }>(`/api/pitches/${pitchId}/feedback`);
      return res.data?.data ?? { ratings: null, feedback: [] };
    } catch {
      return { ratings: null, feedback: [] };
    }
  }

  static async getMyFeedback(pitchId: number): Promise<FeedbackEntry | null> {
    try {
      const res = await apiClient.get<{ data: FeedbackEntry | null }>(`/api/pitches/${pitchId}/feedback/mine`);
      return res.data?.data ?? null;
    } catch {
      return null;
    }
  }

  static async submit(pitchId: number, data: FeedbackSubmission): Promise<{ id: number } | null> {
    const res = await apiClient.post<{ data: { id: number } }>(`/api/pitches/${pitchId}/feedback`, data);
    return res.data?.data ?? null;
  }

  static async update(pitchId: number, data: FeedbackSubmission): Promise<boolean> {
    const res = await apiClient.put<{ success: boolean }>(`/api/pitches/${pitchId}/feedback`, data);
    return res.data?.success ?? false;
  }

  static async remove(pitchId: number): Promise<boolean> {
    const res = await apiClient.delete<{ success: boolean }>(`/api/pitches/${pitchId}/feedback`);
    return res.data?.success ?? false;
  }
}
