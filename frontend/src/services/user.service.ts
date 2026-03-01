// User Service - Complete user management
import { apiClient } from '../lib/api-client';
import type { User as ApiUser, ApiResponse } from '@shared/types/api';

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8001' : '');

// Types
export interface User {
  id: number;
  email: string;
  username: string;
  name?: string;
  userType: 'creator' | 'investor' | 'production';
  bio?: string;
  profileImage?: string;
  coverImage?: string;
  location?: string;
  website?: string;
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    imdb?: string;
    instagram?: string;
  };
  professionalInfo?: {
    company?: string;
    position?: string;
    experience?: string;
    specialties?: string[];
    achievements?: string[];
  };
  preferences?: {
    genres?: string[];
    formats?: string[];
    budgetRange?: { min: number; max: number };
    notificationSettings?: {
      emailNotifications: boolean;
      pitchUpdates: boolean;
      messages: boolean;
      follows: boolean;
    };
  };
  stats?: {
    totalPitches?: number;
    totalFollowers?: number;
    totalFollowing?: number;
    totalViews?: number;
    totalInvestments?: number;
  };
  companyName?: string;
  companyNumber?: string;
  companyWebsite?: string;
  companyAddress?: string;
  emailVerified: boolean;
  companyVerified?: boolean;
  isActive: boolean;
  subscriptionTier?: 'free' | 'starter' | 'professional' | 'enterprise';
  createdAt: string;
  updatedAt: string;
}

export interface ProfileUpdateInput {
  name?: string;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    imdb?: string;
    instagram?: string;
  };
  professionalInfo?: {
    company?: string;
    position?: string;
    experience?: string;
    specialties?: string[];
    achievements?: string[];
  };
  preferences?: {
    genres?: string[];
    formats?: string[];
    budgetRange?: { min: number; max: number };
  };
}

export interface SettingsUpdateInput {
  emailNotifications?: boolean;
  pitchUpdates?: boolean;
  messageNotifications?: boolean;
  followNotifications?: boolean;
  publicProfile?: boolean;
  allowMessages?: boolean;
  twoFactorEnabled?: boolean;
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export class UserService {
  // Get current user profile
  static async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<{ success: boolean; user: User }>(
      '/api/user/profile'
    );

    if (!response.success || !response.data?.user) {
      throw new Error(response.error?.message || 'Failed to fetch user profile');
    }

    return response.data.user;
  }

  // Get user by ID
  static async getUserById(userId: number): Promise<User> {
    const response = await apiClient.get<{ success: boolean; user: User }>(
      `/api/users/${userId}`
    );

    if (!response.success || !response.data?.user) {
      throw new Error(response.error?.message || 'User not found');
    }

    return response.data.user;
  }

  // Get user by username
  static async getUserByUsername(username: string): Promise<User> {
    const response = await apiClient.get<{ success: boolean; user: User }>(
      `/api/users/username/${username}`
    );

    if (!response.success || !response.data?.user) {
      throw new Error(response.error?.message || 'User not found');
    }

    return response.data.user;
  }

  // Update profile
  static async updateProfile(updates: ProfileUpdateInput): Promise<User> {
    const response = await apiClient.put<{ success: boolean; user: User }>(
      '/api/user/profile',
      updates
    );

    if (!response.success || !response.data?.user) {
      throw new Error(response.error?.message || 'Failed to update profile');
    }

    // Update localStorage
    localStorage.setItem('user', JSON.stringify(response.data.user));

    return response.data.user;
  }

  // Update settings
  static async updateSettings(settings: SettingsUpdateInput): Promise<void> {
    const response = await apiClient.put<{ success: boolean }>(
      '/api/user/settings',
      settings
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update settings');
    }
  }

  // Get settings
  static async getSettings(): Promise<SettingsUpdateInput> {
    const response = await apiClient.get<{ success: boolean; settings: SettingsUpdateInput }>(
      '/api/user/settings'
    );

    if (!response.success || !response.data?.settings) {
      throw new Error(response.error?.message || 'Failed to fetch settings');
    }

    return response.data.settings;
  }

  // Change password
  static async changePassword(data: PasswordChangeInput): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/user/change-password',
      data
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to change password');
    }
  }

  // Upload profile image
  static async uploadProfileImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', 'profile');

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      throw new Error('Failed to upload profile image');
    }

    const data = await response.json();
    return data.imageUrl;
  }

  // Upload cover image
  static async uploadCoverImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', 'cover');

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      throw new Error('Failed to upload cover image');
    }

    const data = await response.json();
    return data.imageUrl;
  }

  // Delete account
  static async deleteAccount(password: string): Promise<void> {
    const response = await apiClient.delete<{ success: boolean }>(
      '/api/user/account',
      { data: { password } }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete account');
    }

    // Clear local storage
    localStorage.clear();
  }

  // Search users
  static async searchUsers(query: string, filters?: {
    userType?: string;
    verified?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ users: User[]; total: number }> {
    const params = new URLSearchParams({ q: query });
    if (filters?.userType) params.append('userType', filters.userType);
    if (filters?.verified !== undefined) params.append('verified', filters.verified.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const response = await apiClient.get<{ 
      success: boolean; 
      users: User[]; 
      total: number 
    }>(`/api/users/search?${params}`);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to search users');
    }

    return {
      users: response.data?.users || [],
      total: response.data?.total || 0
    };
  }

  // Get user stats
  static async getUserStats(userId?: number): Promise<any> {
    const endpoint = userId ? `/api/users/${userId}/stats` : '/api/user/stats';
    const response = await apiClient.get<{ success: boolean; stats: any }>(endpoint);

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch user stats');
    }

    return response.data?.stats;
  }

  // Verify email
  static async verifyEmail(token: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/user/verify-email',
      { token }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to verify email');
    }
  }

  // Resend verification email
  static async resendVerificationEmail(): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/user/resend-verification',
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to resend verification email');
    }
  }

  // Request password reset
  static async requestPasswordReset(email: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/user/forgot-password',
      { email }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to request password reset');
    }
  }

  // Reset password with token
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/user/reset-password',
      { token, newPassword }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to reset password');
    }
  }

  // Get notifications preferences
  static async getNotificationPreferences(): Promise<any> {
    const response = await apiClient.get<{ success: boolean; preferences: any }>(
      '/api/user/notification-preferences'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch notification preferences');
    }

    return response.data?.preferences;
  }

  // Update notification preferences
  static async updateNotificationPreferences(preferences: any): Promise<void> {
    const response = await apiClient.put<{ success: boolean }>(
      '/api/user/notification-preferences',
      preferences
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update notification preferences');
    }
  }

  // Company verification (for production/investor accounts)
  static async requestCompanyVerification(documents: File[]): Promise<void> {
    const formData = new FormData();
    documents.forEach((doc, index) => {
      formData.append(`document_${index}`, doc);
    });

    const response = await fetch(`${API_BASE_URL}/api/upload/documents/multiple`, {
      method: 'POST',
      body: formData,
      credentials: 'include' // Send cookies for Better Auth session
    });

    if (!response.ok) {
      throw new Error('Failed to submit company verification');
    }
  }
}

// Export singleton instance
export const userService = UserService;
