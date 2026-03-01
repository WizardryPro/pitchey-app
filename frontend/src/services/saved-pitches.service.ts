// Saved Pitches Service - Complete saved pitches management
import { apiClient } from '../lib/api-client';
import type { Pitch, ApiResponse } from '@shared/types/api';

export interface SavedPitch {
  id: number;
  userId: number;
  pitchId: number;
  savedAt: string;
  notes?: string;
  pitch?: Pitch;
}

export interface SavedPitchesResponse {
  savedPitches: SavedPitch[];
  total: number;
  page?: number;
  limit?: number;
}

export interface SavePitchRequest {
  pitchId: number;
  notes?: string;
}

export class SavedPitchesService {
  // Get all saved pitches for the current user
  static async getSavedPitches(params?: {
    page?: number;
    limit?: number;
    search?: string;
    genre?: string;
    format?: string;
  }): Promise<SavedPitchesResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.genre) searchParams.append('genre', params.genre);
    if (params?.format) searchParams.append('format', params.format);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/api/saved-pitches?${queryString}` : '/api/saved-pitches';

    const response = await apiClient.get<ApiResponse<SavedPitchesResponse>>(endpoint);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch saved pitches');
    }

    // Handle different response structures
    const data = response.data as any;
    if (data?.savedPitches !== undefined) {
      return data as SavedPitchesResponse;
    } else if (Array.isArray(data)) {
      // If data is directly an array, wrap it in expected structure
      return {
        savedPitches: data as SavedPitch[],
        total: data.length
      };
    } else {
      // Fallback structure
      return {
        savedPitches: [],
        total: 0
      };
    }
  }

  // Save a pitch
  static async savePitch(request: SavePitchRequest): Promise<SavedPitch> {
    const response = await apiClient.post<ApiResponse<SavedPitch>>(
      '/api/saved-pitches',
      request
    );

    if (!response.success) {
      // Enhanced error handling for different error formats
      let errorMessage = 'Failed to save pitch';
      
      if (typeof response.error === 'string') {
        errorMessage = response.error;
      } else if (response.error && typeof response.error.message === 'string') {
        errorMessage = response.error.message;
      } else if (response.error?.code === 'DUPLICATE_SAVE') {
        errorMessage = 'This pitch is already in your saved list';
      }
      
      throw new Error(errorMessage);
    }

    // Handle different response structures
    const data = response.data;
    if (data && typeof data === 'object' && 'id' in data) {
      return data as unknown as SavedPitch;
    } else {
      throw new Error('Invalid response format from server');
    }
  }

  // Remove a saved pitch
  static async unsavePitch(savedPitchId: number): Promise<void> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `/api/saved-pitches/${savedPitchId}`
    );

    if (!response.success) {
      let errorMessage = 'Failed to remove saved pitch';
      
      if (typeof response.error === 'string') {
        errorMessage = response.error;
      } else if (response.error && typeof response.error.message === 'string') {
        errorMessage = response.error.message;
      }
      
      throw new Error(errorMessage);
    }
  }

  // Check if a pitch is saved by the current user
  static async isPitchSaved(pitchId: number): Promise<{
    isSaved: boolean;
    savedPitchId?: number;
    savedAt?: string;
  }> {
    try {
      const response = await apiClient.get<ApiResponse<{
        isSaved: boolean;
        savedPitchId?: number;
        savedAt?: string;
      }>>(`/api/saved-pitches/check/${pitchId}`);

      if (!response.success) {
        // Don't throw for check operations, return false instead
        return {
          isSaved: false
        };
      }

      return {
        isSaved: (response.data as any)?.isSaved || false,
        savedPitchId: (response.data as any)?.savedPitchId,
        savedAt: (response.data as any)?.savedAt
      };
    } catch (error) {
      console.error('Error checking if pitch is saved:', error);
      return {
        isSaved: false
      };
    }
  }

  // Update notes for a saved pitch
  static async updateSavedPitchNotes(savedPitchId: number, notes: string): Promise<SavedPitch> {
    const response = await apiClient.put<ApiResponse<SavedPitch>>(
      `/api/saved-pitches/${savedPitchId}`,
      { notes }
    );

    if (!response.success) {
      let errorMessage = 'Failed to update saved pitch notes';
      
      if (typeof response.error === 'string') {
        errorMessage = response.error;
      } else if (response.error && typeof response.error.message === 'string') {
        errorMessage = response.error.message;
      }
      
      throw new Error(errorMessage);
    }

    return response.data as unknown as SavedPitch;
  }

  // Get saved pitch statistics
  static async getSavedPitchStats(): Promise<{
    totalSaved: number;
    byGenre: Record<string, number>;
    byFormat: Record<string, number>;
    recentlyAdded: number;
  }> {
    const response = await apiClient.get<ApiResponse<{
      totalSaved: number;
      byGenre: Record<string, number>;
      byFormat: Record<string, number>;
      recentlyAdded: number;
    }>>('/api/saved-pitches/stats');

    if (!response.success) {
      // Return empty stats instead of throwing
      return {
        totalSaved: 0,
        byGenre: {},
        byFormat: {},
        recentlyAdded: 0
      };
    }

    return (response.data as any) || {
      totalSaved: 0,
      byGenre: {},
      byFormat: {},
      recentlyAdded: 0
    };
  }
}

// Export singleton instance
export const savedPitchesService = SavedPitchesService;